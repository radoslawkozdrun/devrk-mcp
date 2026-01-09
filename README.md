# devrk-mcp

MCP (Model Context Protocol) Server w TypeScript - modularny, rozszerzalny system narzędzi dla agentów AI.

Projekt łączy **[Anthropic "Code Execution with MCP"](https://www.anthropic.com/engineering/code-execution-with-mcp)** guidelines (progressive disclosure, tools as code) z **[oficjalnym MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)** (standardowy protokół, transport).

**Korzyści:**
- ✅ Redukcja zużycia tokenów o 75-87% (lazy loading narzędzi)
- ✅ Standardowa implementacja protokołu MCP
- ✅ Modularność: jedno narzędzie = jeden plik
- ✅ Progressive disclosure: model odkrywa narzędzia na żądanie

📖 **[Jak to działa? Przeczytaj szczegółowe wyjaśnienie →](./docs/ANTHROPIC-MCP-SDK-INTEGRATION.md)**

## Szybki start

### 1. Instalacja zależności

```bash
npm install
```

### 2. Build projektu

```bash
npm run build
```

### 3. Konfiguracja Claude Desktop

**Automatyczna (Windows PowerShell):**
```powershell
.\setup-claude-desktop.ps1
```

**Automatyczna (Windows CMD):**
```cmd
setup-claude-desktop.bat
```

**Ręczna konfiguracja:**

Szczegółowa instrukcja: **[docs/CLAUDE-DESKTOP-SETUP.md](./docs/CLAUDE-DESKTOP-SETUP.md)**

Krótka wersja:
1. Pobierz klucze API z https://app.composio.dev/
2. Połącz konta YouTube i Gmail w Composio dashboard
3. Edytuj plik konfiguracyjny Claude Desktop:
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
4. Wklej konfigurację z `examples/claude-desktop-config.json`
5. Zastąp placeholder'y swoimi kluczami API
6. Zrestartuj Claude Desktop

### 4. Test połączenia

W Claude Desktop wpisz:
```
Pokaż moje subskrypcje YouTube
```

Claude powinien zobaczyć twój serwer MCP i zwrócić listę subskrybowanych kanałów.

### Development (opcjonalnie)

```bash
# Development z hot reload
npm run dev

# Testy
npm test

# Lint
npm run lint
```

## Dostępne serwery

### YouTube Server (via Composio)
- `youtube__get_subscriptions` - Pobierz wszystkie subskrybowane kanały
- `youtube__get_playlist_items` - Pobierz filmy z playlisty
- `youtube__get_latest_videos` - Pobierz najnowsze filmy ze wszystkich subskrypcji (z opcjonalnym emailem)

### Gmail Server (via Composio)
- `gmail__send_email` - Wyślij email (HTML/plain text)

**Wymagane:** Konto [Composio](https://composio.dev) z połączonymi kontami YouTube i Gmail.

## Komendy

- `npm run dev` - Uruchomienie w trybie deweloperskim z hot reload (tsx watch)
- `npm run build` - Kompilacja TypeScript do JavaScript
- `npm start` - Uruchomienie skompilowanej wersji produkcyjnej
- `npm test` - Uruchomienie testów
- `npm run test:watch` - Testy w trybie watch
- `npm run lint` - Sprawdzenie typów TypeScript
- `npm run clean` - Usunięcie skompilowanych plików

## Struktura projektu

```
src/
├── servers/         # Moduły narzędzi (każdy katalog = osobny "serwer")
├── skills/          # Reużywalne workflow wysokiego poziomu
├── types/           # Współdzielone typy
├── utils/           # Funkcje pomocnicze
│   ├── tool-factory.ts   # createTool helper
│   └── logger.ts         # Strukturalne logowanie
├── client.ts        # Główny klient MCP
├── config.ts        # Konfiguracja z .env
└── index.ts         # Entry point serwera

tests/
├── unit/            # Testy jednostkowe
├── integration/     # Testy integracyjne
└── fixtures/        # Dane testowe
```

## Dodawanie nowego serwera (modułu narzędzi)

1. Utwórz katalog `src/servers/{nazwa-serwera}/`
2. Zaimplementuj narzędzia jako osobne pliki TypeScript
3. Wyeksportuj przez `index.ts` w katalogu serwera
4. Zarejestruj w `src/servers/index.ts`

Przykład:

```typescript
// src/servers/example/myTool.ts
import { z } from 'zod';
import { createTool } from '../../utils/tool-factory.js';

const InputSchema = z.object({
  value: z.string().describe('Input value')
});

const OutputSchema = z.object({
  result: z.string()
});

export const myTool = createTool({
  name: 'example__my_tool',
  input: InputSchema,
  output: OutputSchema,
  execute: async (input) => {
    return { result: input.value.toUpperCase() };
  }
});
```

Więcej szczegółów w [CLAUDE.md](./CLAUDE.md).

## Dokumentacja

- **[CLAUDE.md](./CLAUDE.md)** - Wytyczne projektowe, wzorce implementacji, konwencje, **troubleshooting**
- **[CLAUDE-DESKTOP-SETUP.md](./docs/CLAUDE-DESKTOP-SETUP.md)** - Kompletny przewodnik konfiguracji Claude Desktop
- **[ANTHROPIC-MCP-SDK-INTEGRATION.md](./docs/ANTHROPIC-MCP-SDK-INTEGRATION.md)** - Jak łączyć Anthropic guidelines z MCP SDK
- **[WHY-ZOD.md](./docs/WHY-ZOD.md)** - Dlaczego Zod jest niezbędny w MCP

## Troubleshooting

Jeśli serwer pokazuje się jako **"inactive"** w Claude Desktop - sprawdź [sekcję Troubleshooting w CLAUDE.md](./CLAUDE.md#troubleshooting).

**Najczęstszy problem:** Logger pisze na stdout zamiast stderr i zakłóca protokół MCP. Rozwiązanie: używaj `console.error()` zamiast `console.log()`.

## Architektura

Projekt implementuje podejście **hybrydowe**:

```
┌─────────────────────────────────────────┐
│  MCP SDK (@modelcontextprotocol)        │  ← Protokół, transport (stdio/HTTP)
├─────────────────────────────────────────┤
│  Tool Registry & Lazy Loading           │  ← Progressive disclosure
├─────────────────────────────────────────┤
│  Tools as Code (src/servers/)           │  ← Nasze narzędzia
└─────────────────────────────────────────┘
```

**Kluczowa zasada:** Narzędzia są importowane **dopiero gdy są wywoływane**, nie upfront. To redukuje zużycie tokenów o 75-87% w porównaniu do tradycyjnego podejścia.

Więcej w [dokumentacji integracji](./docs/ANTHROPIC-MCP-SDK-INTEGRATION.md).

## Licencja

ISC
