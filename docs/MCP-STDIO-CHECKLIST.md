# MCP Stdio Checklist - Unikaj problemów "inactive"

## ✅ Przed uruchomieniem serwera MCP ze stdio transport

### 1. Logowanie - KRYTYCZNE! ⚠️

**Problem:** Jeśli logger pisze na stdout, zakłóci protokół MCP i serwer będzie "inactive".

**Checklist:**

- [ ] ✅ Wszystkie logi idą na **stderr** (nie stdout)
- [ ] ✅ Używasz `console.error()` zamiast `console.log()`
- [ ] ✅ Jeśli używasz biblioteki logowania (pino/winston):
  - Skonfigurowana `destination: 2` (stderr)
  - **LUB** zastąpiona prostym loggerem z `console.error()`
- [ ] ❌ BRAK `console.log()` w całym projekcie
- [ ] ❌ BRAK `process.stdout.write()` w całym projekcie

**Test:**
```bash
# Sprawdź czy są console.log() w kodzie
grep -r "console\.log" src/

# Powinno zwrócić: nic!
```

**Przykład poprawnego loggera:**
```typescript
// src/utils/logger.ts
function log(level, msg) {
  console.error(`[${new Date().toISOString()}] [${level}] ${msg}`);
}

export const logger = {
  info: (msg) => log('INFO', msg),
  error: (msg) => log('ERROR', msg)
};
```

### 2. Struktura projektu

- [ ] ✅ `src/index.ts` uruchamia MCP SDK Server
- [ ] ✅ `src/mcp-server.ts` zawiera stdio transport
- [ ] ✅ Narzędzia w `src/servers/{nazwa}/{tool}.ts`
- [ ] ✅ Każde narzędzie używa Zod schemas

### 3. Konfiguracja Claude Desktop

- [ ] ✅ Ścieżka do `dist/index.js` jest **absolutna**
- [ ] ✅ Plik `dist/index.js` istnieje (po `npm run build`)
- [ ] ✅ Zmienne środowiskowe w `env` są ustawione
- [ ] ❌ BRAK konfliktów nazw (usunięto stare serwery o podobnych nazwach)

### 4. Build i deploy

- [ ] ✅ `npm run build` bez błędów
- [ ] ✅ `dist/` zawiera wszystkie pliki
- [ ] ✅ Claude Desktop całkowicie zrestartowany (Task Manager → End Task)

## 🐛 Symptomy problemów

### Serwer "inactive" + logi pokazują:

```
[devrk-mcp] [info] Server started and connected successfully
[devrk-mcp] [info] Message from client: {"method":"initialize"...}
// ... logi mieszają się z JSON ...
[devrk-mcp] [info] Client transport closed  ← PROBLEM!
```

**Diagnoza:** Logger pisze na stdout i zakłóca JSON-RPC

**Fix:** Zmień wszystkie logi na stderr (console.error)

### Serwer "inactive" + brak logów:

**Diagnoza:** Serwer nie uruchamia się w ogóle

**Fix:**
1. Test ręczny: `node dist/index.js`
2. Sprawdź błędy kompilacji TypeScript
3. Sprawdź czy ścieżka w konfiguracji Claude Desktop jest poprawna

### Serwer "active" ale narzędzia nie działają:

**Diagnoza:** Problem z implementacją narzędzi, nie z transport

**Fix:** Sprawdź logi wywołań narzędzi w `%LOCALAPPDATA%\Claude\logs\`

## 📋 Quick reference

**Logi Claude Desktop:**
- Windows: `%LOCALAPPDATA%\Claude\logs\mcp-server-devrk-mcp.log`
- macOS: `~/Library/Logs/Claude/mcp-server-devrk-mcp.log`

**Test ręczny:**
```bash
cd /path/to/devrk-mcp
npm run build
node dist/index.js
# Serwer czeka na stdin - to OK!
# Ctrl+C żeby wyjść
```

**Cache cleanup (jeśli serwer nadal "inactive"):**
```powershell
# Windows
Stop-Process -Name "Claude" -Force
Remove-Item "$env:LOCALAPPDATA\Claude\Cache\*" -Recurse -Force
# Uruchom Claude Desktop
```

## 🎓 Dlaczego to jest ważne?

**MCP Protocol używa stdio dla komunikacji:**
- **stdin** → Claude Desktop wysyła JSON-RPC requests
- **stdout** → Serwer MCP odpowiada JSON-RPC responses
- **stderr** → Logi aplikacji (nie zakłócają protokołu!)

**Jeśli logger pisze na stdout:**
```
stdout: {"jsonrpc":"2.0","id":1,"result":...}
stdout: [INFO] Server processing request  ← To NISZCZY JSON!
stdout: {"jsonrpc":"2.0","id":2,...
```

Claude Desktop próbuje sparsować `[INFO] Server processing request` jako JSON-RPC i dostaje błąd parsowania → zamyka połączenie → serwer "inactive".

**Dlatego: ZAWSZE stderr dla logów!**

## ✅ Gdy wszystko działa poprawnie

Logi powinny pokazywać:
```
✅ Server started and connected successfully
✅ Message from client: {"method":"initialize"...}
✅ Message from server: {"jsonrpc":"2.0","id":0,"result":...}
✅ Message from client: {"method":"tools/list"...}
✅ Message from server: {"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}
✅ BRAK "Client transport closed"
```

I serwer będzie active! 🎉

## 📚 Więcej informacji

- [CLAUDE.md - Troubleshooting](../CLAUDE.md#troubleshooting)
- [CLAUDE-DESKTOP-SETUP.md](./CLAUDE-DESKTOP-SETUP.md)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
