# Przykłady użycia devrk-mcp

## 🚀 Szybki start

**Kompletna instrukcja:** [../docs/CLAUDE-DESKTOP-SETUP.md](../docs/CLAUDE-DESKTOP-SETUP.md)

### Automatyczna konfiguracja (Windows)

```powershell
# PowerShell
.\setup-claude-desktop.ps1

# LUB CMD
setup-claude-desktop.bat
```

### Ręczna konfiguracja

1. Zbuduj projekt: `npm run build`
2. Skopiuj `claude-desktop-config.json` do lokalizacji Claude Desktop
3. Zastąp placeholder'y swoimi kluczami API
4. Zrestartuj Claude Desktop

**Lokalizacja pliku konfiguracyjnego:**
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

## 📝 Przykłady promptów dla Claude Desktop

### YouTube subscriptions
```
Pokaż moje subskrypcje YouTube
```

### Latest videos
```
Pobierz 3 najnowsze filmy z każdego z moich 10 kanałów YouTube
```

### Latest videos with email digest
```
Pobierz najnowsze filmy YouTube z ostatnich 24 godzin i wyślij mi email z podsumowaniem
```

### Filter by time
```
Pokaż mi filmy z ostatnich 12 godzin z moich 5 najpopularniejszych kanałów
```

### Send email
```
Wyślij email do myself@example.com z tematem "Test MCP" i treścią "Hello from devrk-mcp!"
```

## 🔧 Debugging

### Włącz verbose logging

W pliku `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "devrk-mcp": {
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### Logi Claude Desktop

**Windows:** `%LOCALAPPDATA%\Claude\logs\mcp-server-devrk-mcp.log`
**macOS:** `~/Library/Logs/Claude/mcp-server-devrk-mcp.log`

### Test bez Claude Desktop

```bash
# Build
npm run build

# Ustaw zmienne środowiskowe
set COMPOSIO_API_KEY=comp_xxx
set COMPOSIO_USER_ID=your_user_id
set COMPOSIO_MCP_ENDPOINT=https://backend.composio.dev/api/v1/mcp

# Uruchom
node dist/index.js
```

## 🐛 Troubleshooting

### "Server not responding"
→ Sprawdź ścieżkę do `dist/index.js` (musi być absolutna)
→ Sprawdź logi: `%LOCALAPPDATA%\Claude\logs\`

### "Composio authentication failed"
→ Sprawdź klucze API w Composio dashboard
→ Upewnij się że YouTube/Gmail są połączone (status "Connected" ✅)

### "Tool not found"
→ Uruchom `npm run build` ponownie
→ Sprawdź czy `dist/servers/youtube/*.js` istnieją

**Pełna instrukcja troubleshooting:** [../docs/CLAUDE-DESKTOP-SETUP.md](../docs/CLAUDE-DESKTOP-SETUP.md)

## 📚 Więcej dokumentacji

- **[Konfiguracja Claude Desktop](../docs/CLAUDE-DESKTOP-SETUP.md)** - Kompletny przewodnik
- **[Integracja MCP SDK](../docs/ANTHROPIC-MCP-SDK-INTEGRATION.md)** - Architektura i lazy loading
- **[Dlaczego Zod?](../docs/WHY-ZOD.md)** - Runtime validation
- **[CLAUDE.md](../CLAUDE.md)** - Wytyczne projektowe
