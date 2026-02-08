# SETUP.md - Konfiguracja MCP Server

## Tryb pracy: HTTP z Bearer token

Serwer MCP działa wyłącznie w trybie HTTP (Streamable HTTP). Wszystkie endpointy `/mcp` wymagają uwierzytelnienia przez nagłówek `Authorization: Bearer <token>`.

| Endpoint | Auth | Opis |
|----------|------|------|
| `GET /health` | Brak | Healthcheck dla Docker |
| `POST /mcp` | Bearer token | MCP JSON-RPC (stateless) |
| `GET /mcp` | Bearer token | 405 (SSE nie wspierane) |
| `DELETE /mcp` | Bearer token | 405 (sesje nie wspierane) |

---

## 1. Zmienne konfiguracyjne

### Wymagane zmienne

```env
# ===== Autentykacja serwera (WYMAGANE) =====
# Serwer odmówi startu bez tego klucza!
MCP_API_KEY=twoj-tajny-klucz

# ===== Google OAuth2 (YouTube + Gmail) =====
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxx
GOOGLE_REFRESH_TOKEN=1//xxxxxxxxxxxxxxxxxxxxxx

# ===== AI Provider (podsumowania wideo) =====
AI_PROVIDER=openai          # openai | anthropic | deepseek
AI_API_KEY=sk-xxxxxxxx      # klucz API wybranego providera
AI_MODEL=gpt-4o-mini        # model do podsumowań

# ===== Qdrant (semantic search) =====
QDRANT_URL=http://qdrant:6333    # w Docker: http://qdrant:6333, lokalnie: http://localhost:6333
QDRANT_API_KEY=                  # opcjonalny, jeśli Qdrant ma włączony API key
QDRANT_COLLECTION=default

# ===== Embeddingi (do Qdrant search) =====
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_ENDPOINT=https://api.openai.com/v1/embeddings

# ===== Gmail =====
RECIPIENT_EMAIL=twoj_email@example.com
```

### Opcjonalne zmienne

```env
MCP_PORT=3000
MCP_HOST=0.0.0.0
LOG_LEVEL=info          # debug | info | warn | error
```

### Gdzie je wpisać?

**VPS/Docker:** Utwórz plik `.env` obok `docker-compose.yml` (na VPS: `/root/.env`). Docker Compose automatycznie podstawi wartości do zmiennych `${...}` w `docker-compose.yml`.

```bash
cp .env.example .env
# edytuj .env i uzupełnij wartości
```

**Lokalnie:** Utwórz `.env` w katalogu projektu.

---

## 2. Bezpieczeństwo - generowanie MCP_API_KEY

`MCP_API_KEY` to shared secret (Bearer token) chroniący endpointy `/mcp`. Wygeneruj silny klucz:

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# OpenSSL
openssl rand -hex 32

# Python
python -c "import secrets; print(secrets.token_hex(32))"
```

Zapisz wygenerowany klucz w `.env`:

```env
MCP_API_KEY=a1b2c3d4e5f6...  # 64-znakowy hex
```

Każdy klient (Claude Desktop, n8n, curl) musi wysyłać ten klucz w nagłówku:

```
Authorization: Bearer a1b2c3d4e5f6...
```

---

## 3. Testowanie serwera

### A) Test kompilacji

```bash
npm run build
```

### B) Test HTTP

```bash
# Uruchom serwer (wymaga MCP_API_KEY w .env lub zmiennej środowiskowej)
MCP_API_KEY=test-key node dist/index.js
```

W drugim terminalu:

```bash
# Health check (bez auth)
curl http://localhost:3000/health
# Oczekiwana odpowiedź: {"status":"ok","tools":3}

# Request BEZ auth → 401
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}'

# Request Z auth → działa
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}'
```

### C) Test w Docker

```bash
cd Docker
docker-compose build mcp-server
docker-compose up mcp-server

# W drugim terminalu:
curl http://localhost:3000/health
```

### D) Testy jednostkowe

```bash
npx tsx --test tests/unit/*.test.ts
```

---

## 4. Podłączenie do Claude Desktop (HTTP + Bearer token)

Claude Desktop obsługuje zdalne serwery MCP przez HTTP. Zamiast uruchamiania procesu lokalnie, podajesz URL i nagłówki:

### Konfiguracja

Otwórz plik konfiguracyjny Claude Desktop:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "devrk-mcp": {
      "url": "https://mcp.twoja-domena.com/mcp",
      "headers": {
        "Authorization": "Bearer twoj-mcp-api-key"
      }
    }
  }
}
```

> **Lokalne testowanie:** Zamiast `https://mcp.twoja-domena.com/mcp` użyj `http://localhost:3000/mcp`.

### Po zapisaniu konfiguracji

1. Zamknij Claude Desktop całkowicie (Task Manager / Activity Monitor)
2. Uruchom ponownie
3. Otwórz nowy czat - narzędzia MCP powinny pojawić się pod ikoną narzędzi

### Weryfikacja

Napisz w Claude Desktop:

```
Pokaż moje najnowsze filmy z YouTube
```

Jeśli serwer jest poprawnie podłączony, Claude wywoła narzędzie `youtube__get_latest_videos`.

### Troubleshooting

- **401 Unauthorized** - sprawdź czy `MCP_API_KEY` w `.env` serwera zgadza się z `Authorization` header w kliencie
- **Serwer nie startuje** - sprawdź czy `MCP_API_KEY` jest ustawiony (serwer odmawia startu bez niego)
- **Connection refused** - sprawdź czy serwer nasłuchuje na właściwym porcie i adresie

---

## 5. Klucze Google OAuth2

Projekt używa Google OAuth2 do:
- **YouTube Data API v3** - pobieranie subskrypcji i najnowszych filmów
- **Gmail API** - wysyłanie email digestów

### Krok 1: Utwórz projekt w Google Cloud Console

1. Wejdź na https://console.cloud.google.com/
2. Utwórz nowy projekt (np. `devrk-mcp`)
3. W menu bocznym przejdź do **APIs & Services > Library**
4. Włącz dwa API:
   - **YouTube Data API v3**
   - **Gmail API**

### Krok 2: Skonfiguruj OAuth Consent Screen

1. **APIs & Services > OAuth consent screen**
2. Wybierz **External** (chyba że masz Google Workspace)
3. Wypełnij:
   - App name: `devrk-mcp`
   - User support email: twój email
   - Developer contact: twój email
4. W zakładce **Scopes** dodaj:
   - `https://www.googleapis.com/auth/youtube.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
5. W zakładce **Test users** dodaj swój adres Gmail

### Krok 3: Utwórz credentials (Client ID + Secret)

1. **APIs & Services > Credentials**
2. Kliknij **Create Credentials > OAuth client ID**
3. Application type: **Web application**
4. Name: `devrk-mcp`
5. Authorized redirect URIs: dodaj `https://developers.google.com/oauthplayground`
6. Zapisz - otrzymasz:
   - **Client ID** → `GOOGLE_CLIENT_ID`
   - **Client Secret** → `GOOGLE_CLIENT_SECRET`

### Krok 4: Wygeneruj Refresh Token

1. Wejdź na https://developers.google.com/oauthplayground
2. Kliknij ikonę **ustawień** (koło zębate, prawy górny róg)
3. Zaznacz **Use your own OAuth credentials**
4. Wpisz swój Client ID i Client Secret
5. W panelu po lewej znajdź i zaznacz scope'y:
   - **YouTube Data API v3** → `https://www.googleapis.com/auth/youtube.readonly`
   - **Gmail API** → `https://www.googleapis.com/auth/gmail.send`
6. Kliknij **Authorize APIs** → zaloguj się swoim kontem Google
7. Kliknij **Exchange authorization code for tokens**
8. Skopiuj **Refresh token** → `GOOGLE_REFRESH_TOKEN`

> **Uwaga:** Refresh token nie wygasa, ale może zostać unieważniony jeśli zmienisz hasło, ręcznie cofniesz dostęp, lub aplikacja jest w trybie "Testing" i minie 7 dni. Aby uniknąć wygasania po 7 dniach, opublikuj aplikację (przycisk **Publish App** w OAuth consent screen) - nie wymaga to weryfikacji Google dla użytku własnego.

---

## 6. Konfiguracja AI Providera

AI provider służy do dwóch celów:
1. **Podsumowania filmów YouTube** (2-zdaniowe streszczenia transkryptów)
2. **Generowanie embeddingów** dla Qdrant semantic search

### Obsługiwane providery

| Provider | `AI_PROVIDER` | `AI_MODEL` (przykład) | `AI_API_KEY` |
|----------|---------------|----------------------|--------------|
| OpenAI | `openai` | `gpt-4o-mini` | `sk-...` |
| Anthropic | `anthropic` | `claude-haiku-4-5-20251001` | `sk-ant-...` |
| DeepSeek | `deepseek` | `deepseek-chat` | `sk-...` |

### OpenAI (domyślny)

1. Wejdź na https://platform.openai.com/api-keys
2. Utwórz nowy klucz API
3. Ustaw w `.env`:

```env
AI_PROVIDER=openai
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
AI_MODEL=gpt-4o-mini
```

> `gpt-4o-mini` to najtańszy model z dobrą jakością podsumowań. Dla lepszej jakości użyj `gpt-4o`.

### Anthropic

1. Wejdź na https://console.anthropic.com/settings/keys
2. Utwórz nowy klucz API
3. Ustaw w `.env`:

```env
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
AI_MODEL=claude-haiku-4-5-20251001
```

### DeepSeek

1. Wejdź na https://platform.deepseek.com/api_keys
2. Utwórz nowy klucz API
3. Ustaw w `.env`:

```env
AI_PROVIDER=deepseek
AI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
AI_MODEL=deepseek-chat
```

### Embeddingi (dla Qdrant search)

Embeddingi używają osobnego endpointu (domyślnie OpenAI), ale dzielą `AI_API_KEY`. Jeśli używasz OpenAI jako AI providera, embeddingi działają out of the box:

```env
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_ENDPOINT=https://api.openai.com/v1/embeddings
```

Jeśli używasz Anthropic/DeepSeek jako AI providera, ale chcesz embeddingi z OpenAI - potrzebujesz osobnego klucza OpenAI. W obecnej konfiguracji `AI_API_KEY` jest współdzielony, więc najprościej jest:
- Użyć OpenAI jako AI provider (wtedy zarówno podsumowania jak i embeddingi korzystają z tego samego klucza)
- LUB zmienić `EMBEDDING_ENDPOINT` na provider kompatybilny z Twoim kluczem

### Bez klucza AI

Serwer działa bez `AI_API_KEY` - podsumowania filmów będą zastąpione obciętym tekstem opisu (fallback). Qdrant search nie będzie działał bez klucza (potrzebuje embeddingów).
