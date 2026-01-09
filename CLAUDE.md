# CLAUDE.md - MCP Server Project

## O projekcie

Serwer MCP (Model Context Protocol) w TypeScript - modularny, rozszerzalny system narzędzi dla agentów AI. Projekt implementuje podejście **code execution with MCP** zgodnie z [wytycznymi Anthropic](https://www.anthropic.com/engineering/code-execution-with-mcp) i może opcjonalnie używać [oficjalnego TypeScript MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) dla standardowego transportu protokołu.

## Kluczowa zasada architektury

**Narzędzia jako kod, nie jako definicje w kontekście.**

Zamiast ładować wszystkie definicje narzędzi do kontekstu modelu, eksponujemy je jako pliki TypeScript. Model odkrywa i importuje tylko te, których potrzebuje. To drastycznie redukuje zużycie tokenów i poprawia wydajność agenta.

## Struktura projektu

```
src/
├── servers/                    # Moduły narzędzi (każdy katalog = osobny "serwer")
│   ├── {nazwa-serwera}/
│   │   ├── {narzędzie}.ts      # Pojedyncze narzędzie
│   │   └── index.ts            # Eksport publiczny API serwera
│   └── index.ts                # Rejestr wszystkich serwerów
├── skills/                     # Reużywalne workflow wysokiego poziomu
│   └── {nazwa-skill}/
│       ├── SKILL.md            # Dokumentacja dla modelu
│       └── index.ts            # Implementacja
├── client.ts                   # Główny klient MCP
├── types/                      # Współdzielone typy
├── utils/                      # Funkcje pomocnicze
└── index.ts                    # Entry point serwera
```

## Wzorce implementacji

### Dodawanie nowego serwera (modułu narzędzi)

```typescript
// src/servers/{nazwa}/index.ts
export * from './toolA';
export * from './toolB';
// Eksportuj tylko publiczne API
```

### Implementacja pojedynczego narzędzia

```typescript
// src/servers/{nazwa}/{narzędzie}.ts
import { z } from 'zod';
import { createTool } from '../../utils/tool-factory';

// 1. Schema wejścia (walidacja + dokumentacja)
const InputSchema = z.object({
  param1: z.string().describe('Opis parametru'),
  param2: z.number().optional().default(10)
});

// 2. Schema wyjścia
const OutputSchema = z.object({
  result: z.string(),
  metadata: z.record(z.unknown()).optional()
});

// 3. Implementacja z JSDoc
/**
 * Krótki opis co robi narzędzie
 * 
 * @example
 * const result = await toolName({ param1: 'value' });
 */
export const toolName = createTool({
  name: 'server__tool_name',
  input: InputSchema,
  output: OutputSchema,
  execute: async (input) => {
    // implementacja
    return { result: '...' };
  }
});
```

### Tworzenie skill (reużywalny workflow)

Skills łączą wiele narzędzi w wyższego poziomu operacje:

```typescript
// src/skills/{nazwa}/index.ts
import * as serverA from '../../servers/serverA';
import * as serverB from '../../servers/serverB';

export async function skillName(options: SkillOptions) {
  const dataA = await serverA.fetchData(options);
  const processed = transform(dataA);
  return serverB.saveData(processed);
}
```

Każdy skill powinien mieć `SKILL.md` z opisem dla modelu:
- Co skill robi
- Kiedy go używać
- Przykłady wywołania

## Zasady projektowe

### 1. Progressive disclosure

Model odkrywa narzędzia przez filesystem. Nie ładuj definicji upfront:

```typescript
// Model może eksplorować strukturę
import * as servers from './servers';
// Potem załadować konkretny moduł
const { specificTool } = await import('./servers/specific');
```

### 2. Filtrowanie przed zwróceniem

Przetwarzaj dane w środowisku wykonawczym, nie w kontekście modelu:

```typescript
// ✅ Zwracaj podsumowanie, nie surowe dane
return {
  count: items.length,
  summary: aggregateSummary(items),
  sample: items.slice(0, 5)
};
```

### 3. Jedno narzędzie = jeden plik

Ułatwia odkrywanie i utrzymanie. Nazwy plików powinny jasno opisywać funkcję.

### 4. Kompozycja przez skills

Złożone operacje implementuj jako skills, nie jako mega-narzędzia.

## Konwencje

### Nazewnictwo

| Element | Styl | Przykład |
|---------|------|----------|
| Katalogi serwerów | kebab-case | `google-drive/` |
| Pliki narzędzi | camelCase | `searchDocuments.ts` |
| Nazwy narzędzi (wewnętrzne) | snake_case z prefixem | `gdrive__search_documents` |
| Funkcje eksportowane | camelCase | `searchDocuments()` |
| Typy/Interfejsy | PascalCase | `SearchOptions` |
| Schematy Zod | PascalCase + Schema | `SearchOptionsSchema` |

### Obsługa błędów

```typescript
// Dedykowana klasa błędu dla narzędzi
export class ToolError extends Error {
  constructor(
    public tool: string,
    message: string,
    public cause?: Error,
    public retryable: boolean = false
  ) {
    super(`[${tool}] ${message}`);
  }
}
```

### Logowanie

**KRYTYCZNE DLA MCP STDIO:**

MCP używa **stdout** do komunikacji JSON-RPC. **WSZYSTKIE** logi **MUSZĄ** iść na **stderr**, inaczej zakłócą protokół!

```typescript
// ✅ POPRAWNIE - console.error() (stderr)
console.error('[INFO] Server started');
console.error('[DEBUG] Tool called:', toolName);

// ❌ ŹLE - console.log() (stdout) - ZAKŁÓCI MCP!
console.log('Server started'); // NIE UŻYWAJ!
```

**Implementacja loggera:**

```typescript
// src/utils/logger.ts
// Prosty logger używający console.error() dla MCP stdio compatibility

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ?? LOG_LEVELS.info;

function log(level, msgOrObj, msg) {
  if (LOG_LEVELS[level] < currentLevel) return;

  const timestamp = new Date().toISOString();

  if (typeof msgOrObj === 'string') {
    console.error(`[${timestamp}] [${level.toUpperCase()}] ${msgOrObj}`);
  } else if (msg) {
    console.error(`[${timestamp}] [${level.toUpperCase()}] ${msg}`, JSON.stringify(msgOrObj, null, 2));
  } else {
    console.error(`[${timestamp}] [${level.toUpperCase()}]`, JSON.stringify(msgOrObj, null, 2));
  }
}

export const logger = {
  debug: (msgOrObj, msg?) => log('debug', msgOrObj, msg),
  info: (msgOrObj, msg?) => log('info', msgOrObj, msg),
  warn: (msgOrObj, msg?) => log('warn', msgOrObj, msg),
  error: (msgOrObj, msg?) => log('error', msgOrObj, msg),
  fatal: (msgOrObj, msg?) => log('fatal', msgOrObj, msg)
};
```

**Użycie:**

```typescript
logger.info('Server started');
logger.info({ tool: 'name', count: 10 }, 'Operation completed');
logger.error({ error: err.message }, 'Operation failed');

// NIE: logger.info({ data: sensitiveData }, '...'); // Nie loguj wrażliwych danych
```

**Dlaczego NIE używamy pino/winston/innych bibliotek?**

Biblioteki logowania często używają skomplikowanych stream'ów i mogą pisać na stdout mimo konfiguracji `destination: stderr`. W środowisku MCP stdio **prostota = niezawodność**. `console.error()` gwarantuje stderr.

## Wymagania techniczne

### Zależności core

- **TypeScript** - strict mode włączony
- **Zod** - walidacja schematów (v3.25+)
- **tsx** - development runtime
- **@modelcontextprotocol/sdk** - oficjalny MCP SDK (dla stdio/HTTP transport)
- **zod-to-json-schema** - konwersja Zod → JSON Schema dla MCP

**Uwaga:** Nie używamy pino/winston - prosty logger z `console.error()` jest najlepszy dla MCP stdio!

### Konfiguracja

Zmienne środowiskowe przez `.env`, bez hardkodowanych wartości:

```typescript
// src/config.ts
export const config = {
  server: {
    port: env('MCP_PORT', 3000),
    logLevel: env('LOG_LEVEL', 'info')
  }
  // Dodawaj sekcje per serwer/integracja
};
```

### Rate limiting

Każda integracja zewnętrzna powinna mieć rate limiter:

```typescript
import Bottleneck from 'bottleneck';

export const rateLimiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 100
});

// Użycie w narzędziu
const result = await rateLimiter.schedule(() => apiCall());
```

## Testowanie

```
tests/
├── unit/           # Testy izolowane, mockowane zależności
├── integration/    # Testy pełnych workflow
└── fixtures/       # Dane testowe
```

- Każde narzędzie ma test jednostkowy
- Skills mają testy integracyjne
- Mockuj zewnętrzne API

## Bezpieczeństwo

- Waliduj wszystkie inputy (Zod)
- Nie loguj tokenów, kluczy, danych osobowych
- OAuth scopes - zasada najmniejszych uprawnień
- Timeout dla wszystkich wywołań zewnętrznych

## Docker

Projekt działa w kontenerze. Zapewnij:
- Multi-stage build (dev/prod)
- Health check endpoint
- Graceful shutdown

## Integracja z oficjalnym MCP SDK

Projekt może używać oficjalnego [TypeScript MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) od ModelContextProtocol dla standardowej implementacji protokołu.

### Instalacja SDK

```bash
npm install @modelcontextprotocol/server zod
```

**Uwaga:** SDK używa wewnętrznie Zod v4, ale jest kompatybilny z projektami używającymi Zod v3.25+.

### Architektura hybrydowa

Nasz projekt łączy **"tools as code"** (progressive disclosure) z **MCP SDK** (standardowy transport):

```
┌─────────────────────────────────────────┐
│  MCP SDK Server (@modelcontextprotocol) │  ← Obsługa protokołu, transport
├─────────────────────────────────────────┤
│  Tool Registry & Discovery Layer        │  ← Dynamiczne ładowanie narzędzi
├─────────────────────────────────────────┤
│  Tools as Code (src/servers/)           │  ← Nasze narzędzia (YouTube, Gmail, etc.)
└─────────────────────────────────────────┘
```

**Korzyści:**
- MCP SDK: standardowy protokół, transport (stdio/HTTP), kompatybilność
- Tools as Code: redukcja tokenów, progressive disclosure, modularność

### Rejestracja narzędzi w MCP SDK

Zamiast ładować wszystkie definicje upfront, rejestruj narzędzia lazy-loaded:

```typescript
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

const server = new McpServer({
  name: 'devrk-mcp',
  version: '1.0.0'
});

// Rejestracja narzędzia z naszej architektury
server.registerTool(
  'youtube__get_latest_videos',
  {
    title: 'Get Latest YouTube Videos',
    description: 'Fetch latest videos from subscribed channels',
    inputSchema: {
      videosPerChannel: z.number().optional().default(5),
      maxChannels: z.number().optional().default(50),
      hoursBack: z.number().optional()
    },
    outputSchema: {
      channels: z.array(z.any()),
      totalVideos: z.number(),
      summary: z.string()
    }
  },
  async (params) => {
    // Lazy load narzędzia tylko gdy jest wywoływane
    const { getLatestVideos } = await import('./servers/youtube/getLatestVideos.js');

    const result = await getLatestVideos.execute(params);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }],
      structuredContent: result
    };
  }
);
```

### Transport: stdio vs Streamable HTTP

**Stdio** - dla lokalnych integracji (Claude Desktop, command-line):
```typescript
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Streamable HTTP** - zalecane dla produkcji (web apps, remote access):
```typescript
import { createMcpExpressApp } from '@modelcontextprotocol/server';

const app = createMcpExpressApp({
  host: 'localhost',
  server: server
});

app.listen(3000, () => {
  console.log('MCP Server listening on http://localhost:3000');
});
```

**DNS Rebinding Protection:** `createMcpExpressApp()` automatycznie włącza ochronę dla `localhost`.

### Dynamiczny rejestr narzędzi

Zamiast rejestrować wszystkie narzędzia ręcznie, stwórz auto-discovery:

```typescript
// src/mcp-bridge.ts
import { McpServer } from '@modelcontextprotocol/server';
import { getAllServers } from './servers/index.js';

export async function registerAllTools(mcpServer: McpServer) {
  const servers = getAllServers();

  for (const serverMeta of servers) {
    for (const toolName of serverMeta.tools) {
      // Lazy register - ładuj tylko metadane, nie implementację
      mcpServer.registerTool(
        `${serverMeta.name}__${toolName}`,
        await loadToolMetadata(serverMeta.name, toolName),
        async (params) => {
          // Lazy load implementacji dopiero przy wywołaniu
          const tool = await loadToolImplementation(serverMeta.name, toolName);
          const result = await tool.execute(params);

          return {
            content: [{ type: 'text', text: JSON.stringify(result) }],
            structuredContent: result
          };
        }
      );
    }
  }
}

async function loadToolMetadata(server: string, tool: string) {
  // Ładuj tylko schemat Zod, nie cały kod narzędzia
  const module = await import(`./servers/${server}/${tool}.js`);
  return {
    title: extractTitle(module),
    description: extractDescription(module),
    inputSchema: module.default?.inputSchema || module[tool]?.inputSchema,
    outputSchema: module.default?.outputSchema || module[tool]?.outputSchema
  };
}
```

### Lifecycle managment

```typescript
// src/index.ts
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { registerAllTools } from './mcp-bridge.js';
import { logger } from './utils/logger.js';

async function main() {
  const server = new McpServer({
    name: 'devrk-mcp',
    version: '1.0.0'
  });

  // Rejestruj narzędzia z progressive disclosure
  await registerAllTools(server);

  // Setup transport
  const transport = new StdioServerTransport();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down MCP server...');
    await server.close();
    process.exit(0);
  });

  // Start server
  await server.connect(transport);
  logger.info('MCP Server started');
}

main().catch((error) => {
  logger.fatal({ error }, 'Failed to start MCP server');
  process.exit(1);
});
```

### Resources vs Tools

MCP SDK rozróżnia:

**Tools** - akcje wykonywane przez serwer (nasze narzędzia):
```typescript
server.registerTool('youtube__get_latest_videos', ...);
```

**Resources** - dane tylko do odczytu, cache, metadata:
```typescript
server.registerResource(
  'channel-metadata',
  'Channel metadata cache',
  async () => ({
    contents: [{
      uri: 'cache://channels/metadata',
      mimeType: 'application/json',
      text: JSON.stringify(cachedMetadata)
    }]
  })
);
```

**Kiedy używać Resources:**
- Cache wyników (żeby nie wywoływać API wielokrotnie)
- Metadata kanałów/użytkowników
- Konfiguracja dostępna dla modelu
- Wielkie dane (zwracaj link zamiast embedować w tool response)

### Best Practices dla MCP SDK

1. **Lazy loading** - importuj narzędzia dopiero gdy są wywoływane
2. **Streamable HTTP** dla produkcji, stdio dla lokalnych testów
3. **Resources dla cache** - nie odpytuj API za każdym razem
4. **Structured content** - zawsze zwracaj zarówno text jak structured
5. **Error handling** - używaj ToolError z flagą retryable
6. **Timeouts** - każde narzędzie ma timeout z config
7. **Logging** - strukturalne logi bez wrażliwych danych

### Przykład: Pełna integracja

```typescript
// src/mcp-server.ts
import { McpServer } from '@modelcontextprotocol/server';
import { createMcpExpressApp } from '@modelcontextprotocol/server';
import { config } from './config.js';
import { logger } from './utils/logger.js';

// Stwórz serwer MCP
const mcpServer = new McpServer({
  name: 'devrk-mcp',
  version: '1.0.0',
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

// Auto-register wszystkich narzędzi
import { getAllServers } from './servers/index.js';
const servers = getAllServers();

for (const server of servers) {
  logger.info({ server: server.name, tools: server.tools.length },
    'Registering server tools');

  for (const toolName of server.tools) {
    const fullName = `${server.name}__${toolName}`;

    mcpServer.registerTool(
      fullName,
      {
        title: `${server.name} ${toolName}`,
        description: `Tool from ${server.name} server`,
        // Schematy ładowane dynamicznie
      },
      async (params) => {
        // Lazy load przy wywołaniu
        const { [toolName]: tool } = await import(
          `./servers/${server.name}/${toolName}.js`
        );

        const result = await tool.call(params);

        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          structuredContent: result
        };
      }
    );
  }
}

// Setup Streamable HTTP transport
const app = createMcpExpressApp({
  host: 'localhost',
  server: mcpServer
});

app.listen(config.server.port, () => {
  logger.info({ port: config.server.port }, 'MCP Server ready');
});
```

### Debugging MCP SDK

```bash
# Uruchom serwer ze szczegółowymi logami
DEBUG=mcp:* npm run dev

# Test z stdio transport
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | npm run dev
```

### Więcej informacji

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Dokumentacja serwera](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)
- [Przykłady](https://github.com/modelcontextprotocol/typescript-sdk/tree/main/examples)
- [Specyfikacja protokołu MCP](https://spec.modelcontextprotocol.io/)

## Troubleshooting

### Serwer pokazuje się jako "inactive" w Claude Desktop

**Objawy:**
- Serwer widoczny w Settings → Connectors
- Status pokazuje "inactive" lub brak zielonej kropki
- Logi pokazują że serwer działa poprawnie

**Przyczyny i rozwiązania:**

#### 1. Logger pisze na stdout zamiast stderr ⚠️ NAJCZĘSTSZY PROBLEM

**Problem:** Jeśli logger (pino, winston, lub zwykły `console.log()`) pisze na **stdout**, zakłóca to protokół MCP i Claude Desktop zamyka połączenie.

**Symptomy w logach:**
```
[devrk-mcp] [info] Server started and connected successfully
[devrk-mcp] [info] Message from client: {"method":"initialize"...}
[devrk-mcp] [info] Message from server: {"jsonrpc":"2.0"...}
// Logi aplikacji mieszają się z JSON-RPC messages
[devrk-mcp] [info] Client transport closed  ← Claude Desktop zamyka połączenie!
```

**Rozwiązanie:**
```typescript
// ❌ ŹLE - zakłóca MCP protocol
console.log('Server started');
logger.info('Server started'); // jeśli logger pisze na stdout

// ✅ DOBRZE - zawsze stderr
console.error('Server started');
```

**Fix:**
1. Zastąp wszystkie `console.log()` → `console.error()`
2. Jeśli używasz biblioteki logowania (pino/winston):
   - Albo skonfiguruj `destination: 2` (stderr)
   - **LUB LEPIEJ:** Zastąp prostym loggerem z `console.error()` (zalecane)
3. Rebuild: `npm run build`
4. Restart Claude Desktop całkowicie (Task Manager → End Task)

#### 2. Konflikt nazw serwerów w konfiguracji

**Problem:** Dwa serwery MCP o podobnych nazwach powodują konflikt.

**Przykład:**
```json
{
  "mcpServers": {
    "mcp-server-devrk": { ... },  // Stary
    "devrk-mcp": { ... }           // Nowy
  }
}
```

**Rozwiązanie:** Usuń stary/nieużywany serwer z konfiguracji.

#### 3. Niepoprawny format JSON Schema

**Problem:** Schema z `$ref` i `definitions` może powodować problemy w starszych wersjach Claude Desktop.

**Rozwiązanie:** Używaj flat schema (już zaimplementowane w `loadToolMetadata()`).

#### 4. Cache Claude Desktop

**Problem:** Claude Desktop cache trzyma starą konfigurację.

**Rozwiązanie:**
```powershell
# Windows PowerShell
Stop-Process -Name "Claude" -Force
Remove-Item "$env:LOCALAPPDATA\Claude\Cache\*" -Recurse -Force
# Uruchom Claude Desktop ponownie
```

### Błędy "Cannot find module" dla narzędzi

**Problem:** Tool registry używa nazw w `snake_case`, ale pliki są w `camelCase`.

**Rozwiązanie:** W `src/servers/index.ts` używaj nazw plików (camelCase):
```typescript
{
  name: 'youtube',
  tools: ['getSubscriptions', 'getLatestVideos'] // ✅ camelCase (nazwy plików)
  // NIE: ['get_subscriptions', 'get_latest_videos'] // ❌ snake_case
}
```

MCP SDK automatycznie konwertuje do snake_case dla nazw narzędzi.

### Serwer nie startuje / crashes

**Diagnostyka:**
```bash
# Test ręczny
cd /path/to/devrk-mcp
npm run build
node dist/index.js
# Sprawdź czy są błędy

# Test z debug
LOG_LEVEL=debug node dist/index.js
```

**Sprawdź:**
1. Czy wszystkie zmienne środowiskowe są ustawione
2. Czy ścieżka w `claude_desktop_config.json` jest absolutna i poprawna
3. Czy `dist/index.js` istnieje (po `npm run build`)

### Logi Claude Desktop

**Windows:** `%LOCALAPPDATA%\Claude\logs\mcp-server-devrk-mcp.log`
**macOS:** `~/Library/Logs/Claude/mcp-server-devrk-mcp.log`

**Co szukać:**
- `Server started and connected successfully` ✅
- `Message from client: {"method":"initialize"` ✅
- `Client transport closed` ❌ (problem z połączeniem)
- JSON parse errors ❌ (logi na stdout!)

### Kiedy "inactive" jest OK

Jeśli logi pokazują:
```
✅ Server started and connected successfully
✅ Message from client: {"method":"initialize"...}
✅ tools/list zwraca narzędzia
✅ BRAK "Client transport closed"
```

...ale GUI nadal pokazuje "inactive" - **zignoruj status GUI i po prostu użyj narzędzi**:
```
Pokaż moje subskrypcje YouTube
```

To może być kosmetyczny bug GUI w Claude Desktop. Narzędzia będą działać!

## Rozszerzanie projektu

### Dodanie nowego serwera (integracji)

1. Utwórz katalog `src/servers/{nazwa}/`
2. Zaimplementuj narzędzia jako osobne pliki
3. Wyeksportuj przez `index.ts`
4. Dodaj testy
5. Zaktualizuj dokumentację

### Dodanie nowego skill

1. Utwórz katalog `src/skills/{nazwa}/`
2. Napisz `SKILL.md` z opisem
3. Zaimplementuj w `index.ts`
4. Dodaj testy integracyjne

## Git

Conventional Commits:
```
feat(server-name): add new tool
fix(skills): handle edge case
refactor: extract common utilities
docs: update CLAUDE.md
```