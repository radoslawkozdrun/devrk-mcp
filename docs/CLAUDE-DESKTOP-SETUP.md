# Połączenie MCP z Claude Desktop - Kompletny Przewodnik

## Krok 1: Zbuduj projekt

```bash
cd C:\Data\03_Repozytoria\devrk-mcp
npm install
npm run build
```

Po pomyślnej kompilacji będziesz miał katalog `dist/` z plikiem `index.js`.

## Krok 2: Uzyskaj klucze API Composio

### 2.1 Załóż konto Composio

1. Przejdź do https://app.composio.dev/
2. Zarejestruj się (darmowe konto)
3. Po zalogowaniu przejdź do dashboardu

### 2.2 Pobierz API Key

1. W dashboardie Composio kliknij na swój profil (prawy górny róg)
2. Wybierz **"Settings"** → **"API Keys"**
3. Kliknij **"Generate API Key"**
4. Skopiuj klucz (format: `comp_xxxxxxxxxx`)

**WAŻNE:** Zapisz klucz - nie będziesz mógł go ponownie zobaczyć!

### 2.3 Pobierz User ID

1. W dashboardzie Composio kliknij na swój profil
2. Wybierz **"Settings"** → **"Profile"**
3. Znajdź **"User ID"** (lub "Entity ID")
4. Skopiuj ID

### 2.4 Połącz konta YouTube i Gmail

#### YouTube:
1. W dashboardzie Composio przejdź do **"Apps"**
2. Znajdź **"YouTube"** i kliknij **"Connect"**
3. Zaloguj się kontem Google
4. Zezwól na dostęp do YouTube
5. Sprawdź status: powinno być **"Connected"** ✅

#### Gmail:
1. W dashboardzie Composio przejdź do **"Apps"**
2. Znajdź **"Gmail"** i kliknij **"Connect"**
3. Zaloguj się kontem Google (tym samym lub innym)
4. Zezwól na dostęp do Gmail
5. Sprawdź status: powinno być **"Connected"** ✅

**Uwaga:** Composio działa jako OAuth proxy - nie musisz konfigurować własnych credentials Google API.

## Krok 3: Lokalizacja pliku konfiguracyjnego Claude Desktop

### Windows:
```
%APPDATA%\Claude\claude_desktop_config.json
```

Pełna ścieżka (zwykle):
```
C:\Users\TwojaNazwaUżytkownika\AppData\Roaming\Claude\claude_desktop_config.json
```

### macOS:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

Pełna ścieżka:
```
/Users/TwojaNazwaUżytkownika/Library/Application Support/Claude/claude_desktop_config.json
```

### Linux:
```
~/.config/Claude/claude_desktop_config.json
```

## Krok 4: Utwórz/Edytuj plik konfiguracyjny

### Windows (przykład dla twojej ścieżki):

Utwórz plik `C:\Users\rkozd\AppData\Roaming\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "devrk-mcp": {
      "command": "node",
      "args": [
        "C:\\Data\\03_Repozytoria\\devrk-mcp\\dist\\index.js"
      ],
      "env": {
        "COMPOSIO_API_KEY": "comp_twój_klucz_api_tutaj",
        "COMPOSIO_MCP_ENDPOINT": "https://backend.composio.dev/api/v1/mcp",
        "COMPOSIO_USER_ID": "twój_user_id_tutaj",
        "RECIPIENT_EMAIL": "twoj.email@example.com",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**WAŻNE dla Windows:**
- Używaj podwójnych backslashy `\\` w ścieżkach
- Lub użyj forward slash: `C:/Data/03_Repozytoria/devrk-mcp/dist/index.js`

### macOS/Linux (przykład):

```json
{
  "mcpServers": {
    "devrk-mcp": {
      "command": "node",
      "args": [
        "/Users/TwojaNazwa/projects/devrk-mcp/dist/index.js"
      ],
      "env": {
        "COMPOSIO_API_KEY": "comp_twój_klucz_api_tutaj",
        "COMPOSIO_MCP_ENDPOINT": "https://backend.composio.dev/api/v1/mcp",
        "COMPOSIO_USER_ID": "twój_user_id_tutaj",
        "RECIPIENT_EMAIL": "twoj.email@example.com",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Opis zmiennych środowiskowych:

| Zmienna | Opis | Wymagana | Przykład |
|---------|------|----------|----------|
| `COMPOSIO_API_KEY` | Klucz API z Composio | ✅ Tak | `comp_abc123xyz...` |
| `COMPOSIO_MCP_ENDPOINT` | Endpoint Composio MCP | ✅ Tak | `https://backend.composio.dev/api/v1/mcp` |
| `COMPOSIO_USER_ID` | User ID z Composio | ✅ Tak | `user_abc123...` |
| `RECIPIENT_EMAIL` | Email dla automatycznych powiadomień | ❌ Opcjonalne | `jan.kowalski@gmail.com` |
| `LOG_LEVEL` | Poziom logowania | ❌ Opcjonalne | `info` / `debug` / `error` |

**Uwaga:** `RECIPIENT_EMAIL` jest opcjonalne. Jeśli ustawisz, narzędzie `youtube__get_latest_videos` automatycznie wyśle email z podsumowaniem filmów.

## Krok 5: Restart Claude Desktop

1. **Zamknij Claude Desktop całkowicie** (sprawdź system tray/pasek zadań)
2. Uruchom Claude Desktop ponownie
3. Poczekaj 10-15 sekund na inicjalizację

## Krok 6: Weryfikacja połączenia

### Sprawdź ikonę MCP:
- Powinieneś zobaczyć ikonę **🔌** lub **🔨** przy polu tekstowym w Claude Desktop
- Kliknij na ikonę - powinieneś zobaczyć listę serwerów MCP
- Znajdź **"devrk-mcp"** na liście

### Test połączenia w Claude Desktop:

Wpisz w Claude Desktop:
```
Sprawdź połączenie z moim MCP serverem
```

Claude powinien odpowiedzieć że widzi twój serwer i dostępne narzędzia.

### Test narzędzi:

**Test 1: Lista subskrypcji YouTube**
```
Pokaż moje subskrybowane kanały YouTube
```

**Test 2: Najnowsze filmy**
```
Pobierz 3 najnowsze filmy z moich 5 kanałów YouTube
```

**Test 3: Wysyłanie emaila**
```
Wyślij testowy email do myself@example.com z tematem "Test MCP" i treścią "Działa!"
```

## Troubleshooting

### Problem: Serwer pokazuje się jako "inactive" ⚠️ NAJCZĘSTSZY

**Objawy:**
- Serwer widoczny w Settings → Connectors
- Status: "inactive" (brak zielonej kropki)
- Logi pokazują: `Server started and connected successfully`
- Ale zaraz potem: `Client transport closed`

**Przyczyna:** Logger pisze na **stdout** zamiast **stderr** i zakłóca protokół MCP.

**Rozwiązanie:**

MCP używa stdout do komunikacji JSON-RPC. **Wszystkie logi MUSZĄ iść na stderr!**

Jeśli w kodzie masz:
```typescript
// ❌ ŹLE - zakłóca MCP
console.log('Server started');

// ✅ DOBRZE
console.error('Server started');
```

**Projekt już używa poprawnego loggera**, ale jeśli modyfikowałeś kod:
1. Sprawdź `src/utils/logger.ts` - powinien używać `console.error()`
2. Sprawdź czy nie ma `console.log()` w kodzie
3. Rebuild: `npm run build`
4. Restart Claude Desktop (Task Manager → End Task → uruchom ponownie)

**Test czy to ten problem:**

Sprawdź logi:
```
%LOCALAPPDATA%\Claude\logs\mcp-server-devrk-mcp.log
```

Jeśli widzisz:
```
[devrk-mcp] [info] Server started...
// ... logi aplikacji mieszają się z JSON messages ...
[devrk-mcp] [info] Client transport closed  ← TO OZNACZA PROBLEM Z LOGGEREM!
```

**Więcej szczegółów:** [CLAUDE.md - Troubleshooting](../CLAUDE.md#troubleshooting)

### Problem: "Server not responding" lub brak ikony 🔌

**Rozwiązanie 1: Sprawdź ścieżkę**
```bash
# Windows - sprawdź czy plik istnieje:
dir "C:\Data\03_Repozytoria\devrk-mcp\dist\index.js"

# macOS/Linux:
ls -la /path/to/devrk-mcp/dist/index.js
```

**Rozwiązanie 2: Sprawdź logi Claude Desktop**

Windows:
```
%LOCALAPPDATA%\Claude\logs\mcp-server-devrk-mcp.log
```
Pełna ścieżka:
```
C:\Users\rkozd\AppData\Local\Claude\logs\
```

macOS:
```
~/Library/Logs/Claude/mcp-server-devrk-mcp.log
```

**Rozwiązanie 3: Test ręczny**
```bash
# Uruchom serwer ręcznie w terminalu
cd C:\Data\03_Repozytoria\devrk-mcp
set COMPOSIO_API_KEY=comp_xxx
set COMPOSIO_MCP_ENDPOINT=https://backend.composio.dev/api/v1/mcp
set COMPOSIO_USER_ID=your_user_id
node dist/index.js
```

Jeśli widzisz błędy - to problem z konfiguracją lub kodem.
Jeśli wszystko OK - problem jest w konfiguracji Claude Desktop.

### Problem: "Composio authentication failed"

**Przyczyna:** Błędne klucze API lub niepołączone konta

**Rozwiązanie:**
1. Sprawdź czy `COMPOSIO_API_KEY` jest poprawny (powinien zaczynać się od `comp_`)
2. Sprawdź czy `COMPOSIO_USER_ID` jest poprawny
3. Zaloguj się do https://app.composio.dev/
4. Sprawdź czy YouTube i Gmail mają status **"Connected"** ✅
5. Jeśli nie - przejdź ponownie przez Krok 2.4

### Problem: "Tool not found" lub "youtube__get_subscriptions not found"

**Przyczyna:** Build nie zawiera wszystkich plików

**Rozwiązanie:**
```bash
cd C:\Data\03_Repozytoria\devrk-mcp
npm run clean
npm install
npm run build
```

Sprawdź czy folder `dist/servers/youtube/` istnieje i zawiera pliki:
```bash
dir dist\servers\youtube\
# Powinno być: getSubscriptions.js, getPlaylistItems.js, getLatestVideos.js
```

### Problem: Email się nie wysyła

**Przyczyna:** Brak połączenia Gmail lub błędny `RECIPIENT_EMAIL`

**Rozwiązanie:**
1. Sprawdź czy Gmail jest połączony w Composio dashboard
2. Sprawdź czy `RECIPIENT_EMAIL` jest poprawnym adresem email
3. Sprawdź logi czy pojawia się komunikat o wysyłaniu emaila
4. Spróbuj użyć narzędzia `gmail__send_email` bezpośrednio

### Problem: Rate limiting (429 errors)

**Przyczyna:** Za dużo requestów do Composio API

**Rozwiązanie:**
1. Zmniejsz `maxChannels` w wywołaniach narzędzi
2. Zwiększ opóźnienia między wywołaniami
3. Composio darmowe konto ma limity - sprawdź dashboard

## Przykłady użycia w Claude Desktop

### Przykład 1: Digest filmów z ostatnich 24h z emailem
```
Pobierz najnowsze filmy YouTube z ostatnich 24 godzin z moich 10 najpopularniejszych kanałów i wyślij mi email z podsumowaniem
```

### Przykład 2: Filmy z konkretnych kanałów
```
Pokaż mi 5 najnowszych filmów z każdego z moich kanałów o programowaniu
```

### Przykład 3: Wyszukiwanie w subskrypcjach
```
Sprawdź czy subskrybuję kanał "Fireship" i jeśli tak, pokaż jego 3 ostatnie filmy
```

### Przykład 4: Automatyczny email digest
```
Co tydzień wysyłaj mi email z 10 najnowszymi filmami z moich subskrypcji
```
(Uwaga: To wymaga ustawienia crona/scheduled task - na razie trzeba ręcznie uruchamiać)

## Bezpieczeństwo

### ⚠️ Nie commituj kluczy do Git!

Plik konfiguracyjny Claude Desktop **NIE jest w repozytorium Git**. To dobrze!

**Nigdy nie commituj:**
- `claude_desktop_config.json` z kluczami API
- `.env` z kluczami API
- Żadnych plików zawierających `COMPOSIO_API_KEY`

### ✅ Dobre praktyki:

1. **Trzymaj klucze w Claude Desktop config** - tylko tam
2. **Używaj .env.example** - bez prawdziwych kluczy
3. **Rotuj klucze** - co kilka miesięcy generuj nowe
4. **Monitoruj użycie** - sprawdzaj dashboard Composio

## Konfiguracja dla zespołu

Jeśli pracujesz w zespole, każdy developer powinien:

1. Mieć własne konto Composio
2. Mieć własny `COMPOSIO_API_KEY`
3. Połączyć własne konta YouTube/Gmail
4. Używać własnego `claude_desktop_config.json`

**Nie udostępniajcie kluczy API!** Każdy członek zespołu powinien mieć własne.

## Następne kroki

Po pomyślnym połączeniu możesz:

1. **Eksperymentować z narzędziami** - Claude nauczy się jak je używać
2. **Dodać własne serwery** - zobacz `docs/CLAUDE.md` jak tworzyć nowe narzędzia
3. **Dostosować konfigurację** - zmień `LOG_LEVEL` na `debug` jeśli chcesz więcej informacji
4. **Zautomatyzować** - użyj MCP z własnych skryptów (programmatic usage)

## Wsparcie

Jeśli masz problemy:

1. Sprawdź logi: `%LOCALAPPDATA%\Claude\logs\` (Windows) lub `~/Library/Logs/Claude/` (macOS)
2. Sprawdź dokumentację: `docs/ANTHROPIC-MCP-SDK-INTEGRATION.md`
3. Sprawdź konfigurację Composio: https://app.composio.dev/
4. Uruchom ręcznie serwer w terminalu żeby zobaczyć błędy
