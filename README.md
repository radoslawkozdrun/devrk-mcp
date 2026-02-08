# devrk-mcp

MCP (Model Context Protocol) Server w TypeScript - modularny, rozszerzalny system narzedzi dla agentow AI.

Projekt laczy **[Anthropic "Code Execution with MCP"](https://www.anthropic.com/engineering/code-execution-with-mcp)** guidelines (progressive disclosure, tools as code) z **[oficjalnym MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)** (standardowy protokol, transport).

**Korzysci:**
- Redukcja zuzycia tokenow o 75-87% (lazy loading narzedzi)
- Standardowa implementacja protokolu MCP
- Modularnosc: jedno narzedzie = jeden plik
- Progressive disclosure: model odkrywa narzedzia na zadanie

## Dostepne serwery

### YouTube (`youtube`)
- **`youtube__get_latest_videos`** - Pobiera najnowsze filmy ze wszystkich subskrypcji, generuje transkrypcje i AI podsumowania (2 zdania). Opcjonalnie wysyla email digest.

### Qdrant RAG (`qdrant-rag`)
- **`qdrant_rag__search`** - Wyszukiwanie semantyczne w bazie wektorowej Qdrant (generuje embedding, szuka podobnych dokumentow)
- **`qdrant_rag__list_collections`** - Lista kolekcji z podstawowymi statystykami

## Szybki start

### 1. Instalacja

```bash
npm install
```

### 2. Konfiguracja

Skopiuj `.env.example` do `.env` i uzupelnij:

```bash
cp .env.example .env
```

**Wymagane zmienne:**

| Zmienna | Opis |
|---------|------|
| `GOOGLE_CLIENT_ID` | Google OAuth2 Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 Client Secret |
| `GOOGLE_REFRESH_TOKEN` | Google OAuth2 Refresh Token |
| `AI_API_KEY` | Klucz API dla AI (OpenAI/Anthropic/DeepSeek) |
| `QDRANT_URL` | URL instancji Qdrant (domyslnie `http://localhost:6333`) |

Google OAuth2 credentials tworzy sie w [Google Cloud Console](https://console.cloud.google.com) z wlaczonymi YouTube Data API v3 i Gmail API.

### 3. Build

```bash
npm run build
```

### 4. Konfiguracja Claude Desktop

Edytuj plik konfiguracyjny Claude Desktop:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "devrk-mcp": {
      "command": "node",
      "args": ["C:\\sciezka\\do\\devrk-mcp\\dist\\index.js"],
      "env": {
        "GOOGLE_CLIENT_ID": "...",
        "GOOGLE_CLIENT_SECRET": "...",
        "GOOGLE_REFRESH_TOKEN": "...",
        "AI_PROVIDER": "openai",
        "AI_API_KEY": "...",
        "AI_MODEL": "gpt-4o-mini",
        "QDRANT_URL": "http://localhost:6333",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Zrestartuj Claude Desktop po zapisaniu.

### 5. Test

W Claude Desktop:
```
Pokaz mi najnowsze filmy z YouTube z ostatnich 24 godzin
```

## Komendy

| Komenda | Opis |
|---------|------|
| `npm run dev` | Development z hot reload (tsx watch) |
| `npm run build` | Kompilacja TypeScript |
| `npm start` | Uruchomienie produkcyjne |
| `npm test` | Testy jednostkowe |
| `npm run lint` | Sprawdzenie typow TypeScript |

## Struktura projektu

```
src/
├── servers/                    # Moduly narzedzi
│   ├── youtube/
│   │   ├── getLatestVideos.ts  # Filmy + transkrypcje + AI summary
│   │   ├── utils.ts            # channelIdToUploadsPlaylistId
│   │   └── index.ts
│   ├── qdrant-rag/
│   │   ├── search.ts           # Wyszukiwanie semantyczne
│   │   ├── listCollections.ts  # Lista kolekcji
│   │   └── index.ts
│   └── index.ts                # Rejestr serwerow
├── utils/
│   ├── google-auth.ts          # Wspolny OAuth2 client
│   ├── ai-summarizer.ts        # Multi-provider AI (openai/anthropic/deepseek)
│   ├── gmail-sender.ts         # Wysylanie emaili przez Gmail API
│   ├── tool-factory.ts         # createTool helper
│   ├── email-formatter.ts      # HTML email z filmami
│   ├── email-templates.ts      # Szablony email
│   └── logger.ts               # Logger (stderr only - MCP safe)
├── types/                      # Wspoldzielone typy
├── config.ts                   # Konfiguracja z .env
├── mcp-server.ts               # MCP SDK + lazy loading
└── index.ts                    # Entry point
```

## Architektura

```
┌─────────────────────────────────────────┐
│  MCP SDK (@modelcontextprotocol)        │  ← Protokol, transport (stdio)
├─────────────────────────────────────────┤
│  Tool Registry & Lazy Loading           │  ← Progressive disclosure
├─────────────────────────────────────────┤
│  Tools as Code (src/servers/)           │  ← YouTube, Qdrant RAG
└─────────────────────────────────────────┘
```

Narzedzia sa importowane **dopiero gdy sa wywolywane**, nie upfront. Redukuje to zuzycie tokenow o 75-87%.

## Dodawanie nowego serwera

1. Utworz katalog `src/servers/{nazwa-serwera}/`
2. Zaimplementuj narzedzia jako osobne pliki (jedno narzedzie = jeden plik)
3. Wyeksportuj przez `index.ts`
4. Zarejestruj w `src/servers/index.ts`
5. Dodaj testy w `tests/unit/`

Wiecej szczegolow: [CLAUDE.md](./CLAUDE.md)

## Dokumentacja

- **[CLAUDE.md](./CLAUDE.md)** - Wytyczne projektowe, wzorce, konwencje, troubleshooting
- **[docs/WHY-ZOD.md](./docs/WHY-ZOD.md)** - Dlaczego Zod jest niezbedny w MCP
- **[docs/MCP-STDIO-CHECKLIST.md](./docs/MCP-STDIO-CHECKLIST.md)** - Checklist stdio (unikanie "inactive")

## Troubleshooting

Jesli serwer pokazuje sie jako **"inactive"** w Claude Desktop:

1. Sprawdz czy nie ma `console.log()` w kodzie (powinno byc `console.error()`)
2. Sprawdz logi: `%LOCALAPPDATA%\Claude\logs\mcp-server-devrk-mcp.log`
3. Rebuild: `npm run build`
4. Restart Claude Desktop calkowicie

Wiecej: [CLAUDE.md - Troubleshooting](./CLAUDE.md#troubleshooting)

## Licencja

ISC
