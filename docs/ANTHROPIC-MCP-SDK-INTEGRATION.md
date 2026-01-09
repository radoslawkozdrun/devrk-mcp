# Anthropic Guidelines + MCP TypeScript SDK - Integration Guide

## TL;DR: Tak, da się pogodzić!

**Anthropic "Code Execution with MCP"** + **MCP TypeScript SDK** = Idealne połączenie

- ✅ SDK obsługuje protokół i transport (standardy)
- ✅ Nasze narzędzia są "tools as code" (redukcja tokenów)
- ✅ Lazy loading przy wywołaniu (progressive disclosure)

## Kluczowa różnica: Tradycyjne MCP vs Nasze podejście

### ❌ Problem: Tradycyjne MCP (bez Anthropic guidelines)

```typescript
// Wszystkie narzędzia ładowane do pamięci i kontekstu
import { youtubeTools } from './youtube';
import { gmailTools } from './gmail';
import { driveTools } from './drive';
// ... 20 kolejnych importów

const server = new McpServer();

// Rejestrujesz WSZYSTKO od razu
server.registerTool('youtube_get_subscriptions', youtubeTools.getSubscriptions);
server.registerTool('youtube_get_videos', youtubeTools.getVideos);
server.registerTool('gmail_send', gmailTools.send);
server.registerTool('gmail_search', gmailTools.search);
// ... 50+ narzędzi

// ❌ PROBLEM: Model widzi definicje wszystkich 50+ narzędzi
// ❌ PROBLEM: Wszystkie implementacje załadowane w pamięci
// ❌ PROBLEM: Ogromne zużycie tokenów w każdym requescie
```

**Koszt:**
- 50 narzędzi × ~200 tokenów definicji = **10,000 tokenów** w każdym requeście
- Wszystkie implementacje w pamięci (~10MB+)
- Model musi parsować wszystkie definicje za każdym razem

### ✅ Rozwiązanie: Anthropic + MCP SDK (nasze podejście)

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

const server = new Server({ name: 'devrk-mcp', version: '1.0.0' });

// Rejestrujesz TYLKO metadane (nazwa + schemat)
// Implementacja NIE jest importowana
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'youtube__get_subscriptions',
        description: 'Get YouTube subscriptions',
        inputSchema: { type: 'object', properties: {...} }
        // ✅ Tylko schemat - NIE ma kodu implementacji
      }
    ]
  };
});

// Implementacja ładowana DOPIERO gdy narzędzie jest wywoływane
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;

  // ✅ LAZY LOAD: Import tylko teraz
  const { getSubscriptions } = await import('./servers/youtube/getSubscriptions.js');

  // ✅ Wykonaj i zwolnij z pamięci
  const result = await getSubscriptions.execute(request.params.arguments);

  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
```

**Korzyści:**
- Model widzi tylko nazwę + schemat = **~50 tokenów** zamiast 200
- 50 narzędzi × 50 tokenów = **2,500 tokenów** (oszczędność **75%**)
- Implementacje ładowane tylko gdy potrzebne
- Pamięć: tylko aktualnie wykonywane narzędzie (~500KB zamiast 10MB)

## Jak to działa w praktyce

### 1. Struktura projektu (zgodna z Anthropic)

```
src/
├── servers/                           # Tools as code
│   ├── youtube/
│   │   ├── getSubscriptions.ts       # ← Pojedynczy plik = jedno narzędzie
│   │   ├── getPlaylistItems.ts
│   │   └── getLatestVideos.ts
│   └── gmail/
│       └── sendEmail.ts
├── mcp-server.ts                      # ← SDK integration + lazy loading
└── index.ts                           # ← Entry point
```

### 2. Implementacja narzędzia (tools as code)

```typescript
// src/servers/youtube/getSubscriptions.ts
import { z } from 'zod';
import { createTool } from '../../utils/tool-factory.js';

const InputSchema = z.object({
  maxResults: z.number().optional().default(50)
});

const OutputSchema = z.object({
  subscriptions: z.array(z.any()),
  count: z.number()
});

/**
 * Get YouTube subscriptions
 */
export const getSubscriptions = createTool({
  name: 'youtube__get_subscriptions',
  input: InputSchema,
  output: OutputSchema,
  execute: async (input) => {
    // Implementacja tutaj
    const subs = await fetchSubscriptions(input.maxResults);
    return { subscriptions: subs, count: subs.length };
  }
});
```

**✅ To jest "tool as code" - kod w pliku, nie w definicji narzędzia**

### 3. Rejestracja w MCP SDK (lazy loading)

```typescript
// src/mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server({
  name: 'devrk-mcp',
  version: '1.0.0'
});

// Map przechowuje TYLKO metadane
const toolRegistry = new Map<string, {
  serverName: string;
  toolName: string;
  description: string;
  inputSchema: any;
}>();

// Inicjalizacja: Ładujemy TYLKO schematy, NIE implementacje
async function initToolRegistry() {
  toolRegistry.set('youtube__get_subscriptions', {
    serverName: 'youtube',
    toolName: 'getSubscriptions',
    description: 'Get YouTube subscriptions',
    inputSchema: {
      type: 'object',
      properties: {
        maxResults: { type: 'number', default: 50 }
      }
    }
  });
}

// tools/list - zwraca tylko metadane
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Array.from(toolRegistry.values()).map(t => ({
      name: `${t.serverName}__${t.toolName}`,
      description: t.description,
      inputSchema: t.inputSchema
    }))
  };
});

// tools/call - LAZY LOAD implementacji
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolEntry = toolRegistry.get(request.params.name);

  // ✅ Import DOPIERO TERAZ (nie wcześniej)
  const module = await import(
    `./servers/${toolEntry.serverName}/${toolEntry.toolName}.js`
  );

  const tool = module[toolEntry.toolName];

  // ✅ Wykonaj
  const result = await tool.execute(request.params.arguments);

  // ✅ Zwolnij z pamięci (garbage collection)
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }]
  };
});
```

### 4. Transport (SDK obsługuje protokół)

```typescript
// Stdio dla Claude Desktop / CLI
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const transport = new StdioServerTransport();
await server.connect(transport);

// Lub HTTP dla web apps
// import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
```

## Dlaczego to działa

### SDK zajmuje się:
1. ✅ **Protokół MCP** - JSON-RPC, message handling
2. ✅ **Transport** - stdio, HTTP/SSE
3. ✅ **Komunikacja** - request/response cycle
4. ✅ **Standardy** - zgodność ze specyfikacją MCP

### Nasze narzędzia (Anthropic guidelines):
1. ✅ **Tools as code** - każde narzędzie = plik .ts
2. ✅ **Lazy loading** - import tylko gdy wywoływane
3. ✅ **Progressive disclosure** - model odkrywa przez filesystem
4. ✅ **Redukcja tokenów** - tylko schematy, nie kod

### Połączenie:
```
┌─────────────────────────────────────────────┐
│  MCP Request (tools/list)                   │
├─────────────────────────────────────────────┤
│  MCP SDK                                    │
│  - Odbiera request                          │
│  - Parsuje JSON-RPC                         │
│  - Wywołuje nasz handler                    │
├─────────────────────────────────────────────┤
│  Nasz kod (Anthropic guidelines)            │
│  - Zwraca tylko metadane z toolRegistry     │
│  - NIE importuje implementacji              │
└─────────────────────────────────────────────┘
         ↓
Model otrzymuje: ["youtube__get_subscriptions"]
Koszt: ~50 tokenów

┌─────────────────────────────────────────────┐
│  MCP Request (tools/call youtube__get_subs) │
├─────────────────────────────────────────────┤
│  MCP SDK                                    │
│  - Odbiera request                          │
│  - Parsuje parametry                        │
│  - Wywołuje nasz handler                    │
├─────────────────────────────────────────────┤
│  Nasz kod (Lazy loading)                    │
│  - await import('./youtube/getSubscriptions')│
│  - Wykonuje tool.execute()                  │
│  - Zwraca wynik                             │
└─────────────────────────────────────────────┘
         ↓
Model otrzymuje: { subscriptions: [...], count: 10 }
```

## Porównanie: Token usage

### Tradycyjny MCP (bez Anthropic):
```
Request 1 (tools/list):
- 50 narzędzi × 200 tokenów = 10,000 tokenów

Request 2 (tools/call):
- Tool execution + 10,000 tokenów context = 10,000+ tokenów

Total: ~20,000 tokenów
```

### Anthropic + SDK (nasze podejście):
```
Request 1 (tools/list):
- 50 narzędzi × 50 tokenów (tylko nazwy+schematy) = 2,500 tokenów

Request 2 (tools/call):
- Tool execution + 50 tokenów tool context = ~100 tokenów

Total: ~2,600 tokenów

Oszczędność: 87%
```

## Praktyczny przykład: Claude Desktop integration

### 1. Skonfiguruj Claude Desktop

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "devrk-mcp": {
      "command": "node",
      "args": ["/path/to/devrk-mcp/dist/index.js"],
      "env": {
        "COMPOSIO_API_KEY": "your-key",
        "COMPOSIO_MCP_ENDPOINT": "https://...",
        "COMPOSIO_USER_ID": "your-id"
      }
    }
  }
}
```

### 2. Claude używa narzędzia

```
User: "Pokaż moje subskrypcje YouTube"

Claude:
1. Lista dostępnych narzędzi (tools/list)
   → Widzi: youtube__get_subscriptions, youtube__get_videos, gmail__send...
   → Koszt: 2,500 tokenów (tylko nazwy+schematy)

2. Wywołuje youtube__get_subscriptions (tools/call)
   → SDK lazy-loaduje getSubscriptions.ts
   → Wykonuje tool.execute()
   → Zwraca wynik
   → Koszt: 100 tokenów (tylko ten tool)

3. Odpowiada użytkownikowi

Total: 2,600 tokenów (zamiast 20,000)
```

## Best Practices

### ✅ DO:

1. **Jeden plik = jedno narzędzie**
   ```
   src/servers/youtube/getSubscriptions.ts  ✅
   src/servers/youtube/allTools.ts          ❌
   ```

2. **Lazy load w handler'ze**
   ```typescript
   // ✅ Import w tools/call handler
   const module = await import(`./servers/${name}.js`);

   // ❌ Import na górze pliku
   import { allTools } from './servers';
   ```

3. **Metadane w registry, implementacja w plikach**
   ```typescript
   // ✅ Tylko schema w registry
   toolRegistry.set('tool1', { schema: {...} });

   // ❌ Implementacja w registry
   toolRegistry.set('tool1', { execute: async () => {...} });
   ```

4. **Schematy Zod dla walidacji**
   ```typescript
   // ✅ Zod schema (type-safe + runtime validation)
   const InputSchema = z.object({ maxResults: z.number() });

   // ❌ Plain TypeScript types (tylko compile-time)
   interface Input { maxResults: number }
   ```

### ❌ DON'T:

1. **Nie ładuj wszystkich narzędzi upfront**
   ```typescript
   // ❌ Źle
   import * as youtube from './servers/youtube';
   import * as gmail from './servers/gmail';
   // ... wszystkie serwery

   // ✅ Dobrze
   // Żadnych importów implementacji w mcp-server.ts
   ```

2. **Nie trzymaj implementacji w pamięci**
   ```typescript
   // ❌ Źle
   const toolImplementations = new Map();
   toolImplementations.set('tool1', await import('./tool1'));

   // ✅ Dobrze
   // Import w momencie wywołania, potem garbage collection
   ```

3. **Nie duplikuj kodu narzędzi w MCP SDK**
   ```typescript
   // ❌ Źle
   server.registerTool('youtube__get_subs', {
     execute: async (params) => {
       // Cała implementacja tutaj - duplikacja kodu
       const subs = await fetchFromAPI();
       return { subscriptions: subs };
     }
   });

   // ✅ Dobrze
   server.setRequestHandler(CallToolRequestSchema, async (request) => {
     // Tylko import i delegacja
     const tool = await import('./servers/youtube/getSubscriptions.js');
     return await tool.execute(request.params.arguments);
   });
   ```

## Podsumowanie

| Aspekt | Tradycyjne MCP | Anthropic + SDK |
|--------|----------------|-----------------|
| **Protokół** | MCP SDK ✅ | MCP SDK ✅ |
| **Transport** | stdio/HTTP ✅ | stdio/HTTP ✅ |
| **Narzędzia** | Wszystkie w kontekście ❌ | Lazy-loaded ✅ |
| **Token usage** | ~10,000/request ❌ | ~2,500/request ✅ |
| **Pamięć** | Wszystkie w RAM (~10MB) ❌ | Tylko używane (~500KB) ✅ |
| **Modularność** | Monolity ❌ | Jeden plik = jedno narzędzie ✅ |
| **Progressive disclosure** | Nie ❌ | Tak ✅ |

**Odpowiedź: TAK, można i należy łączyć oba podejścia!**

- MCP SDK = standardy, protokół, transport
- Anthropic guidelines = architektura, lazy loading, token efficiency

To nie są konkurencyjne podejścia - to komplementarne warstwy tej samej architektury.
