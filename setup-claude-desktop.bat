@echo off
REM Setup script dla Claude Desktop MCP - Windows CMD version
REM Uruchom: setup-claude-desktop.bat

echo.
echo === Konfiguracja Claude Desktop dla devrk-mcp ===
echo.

REM Sprawdź czy dist/index.js istnieje
if not exist "%~dp0dist\index.js" (
    echo [ERROR] dist/index.js nie istnieje!
    echo         Najpierw uruchom: npm run build
    echo.
    pause
    exit /b 1
)

echo [OK] Znaleziono dist/index.js
echo.

REM Ścieżka do konfiguracji Claude Desktop
set CLAUDE_CONFIG_DIR=%APPDATA%\Claude
set CLAUDE_CONFIG_PATH=%CLAUDE_CONFIG_DIR%\claude_desktop_config.json

echo Sciezka konfiguracji Claude Desktop:
echo   %CLAUDE_CONFIG_PATH%
echo.

REM Utwórz katalog jeśli nie istnieje
if not exist "%CLAUDE_CONFIG_DIR%" (
    echo Tworze katalog Claude...
    mkdir "%CLAUDE_CONFIG_DIR%"
)

REM Sprawdź czy plik już istnieje
if exist "%CLAUDE_CONFIG_PATH%" (
    echo.
    echo [UWAGA] Plik konfiguracyjny juz istnieje!
    echo.
    set /p OVERWRITE="Czy chcesz go nadpisac? (tak/nie): "

    if /i not "%OVERWRITE%"=="tak" (
        echo.
        echo [ANULOWANO] Edytuj plik recznie:
        echo   %CLAUDE_CONFIG_PATH%
        echo.
        pause
        exit /b 0
    )

    REM Backup starej konfiguracji
    copy "%CLAUDE_CONFIG_PATH%" "%CLAUDE_CONFIG_PATH%.backup" >nul
    echo [OK] Utworzono backup
)

echo.
echo === Instrukcja ===
echo.
echo Ten skrypt utworzy szablon pliku konfiguracyjnego.
echo Musisz recznie edytowac plik i wpisac:
echo.
echo 1. COMPOSIO_API_KEY (z https://app.composio.dev/)
echo 2. COMPOSIO_USER_ID (z https://app.composio.dev/)
echo 3. RECIPIENT_EMAIL (opcjonalne)
echo.
pause

REM Przygotuj ścieżkę (escape backslashes dla JSON)
set DIST_PATH=%~dp0dist\index.js
set DIST_PATH=%DIST_PATH:\=\\%

REM Utwórz plik konfiguracyjny
(
echo {
echo   "mcpServers": {
echo     "devrk-mcp": {
echo       "command": "node",
echo       "args": [
echo         "%DIST_PATH%"
echo       ],
echo       "env": {
echo         "COMPOSIO_API_KEY": "comp_WPISZ_TUTAJ_SWOJ_KLUCZ",
echo         "COMPOSIO_MCP_ENDPOINT": "https://backend.composio.dev/api/v1/mcp",
echo         "COMPOSIO_USER_ID": "WPISZ_TUTAJ_SWOJ_USER_ID",
echo         "RECIPIENT_EMAIL": "twoj.email@example.com",
echo         "LOG_LEVEL": "info"
echo       }
echo     }
echo   }
echo }
) > "%CLAUDE_CONFIG_PATH%"

echo.
echo === Konfiguracja zapisana ===
echo.
echo [OK] Plik zapisany: %CLAUDE_CONFIG_PATH%
echo.
echo.
echo === WAZNE: Edytuj plik i wpisz swoje klucze! ===
echo.
echo Otwieram plik w Notatniku...
echo.

REM Otwórz plik w Notatniku
notepad "%CLAUDE_CONFIG_PATH%"

echo.
echo === Nastepne kroki ===
echo.
echo 1. W pliku konfiguracyjnym wpisz:
echo    - COMPOSIO_API_KEY (z https://app.composio.dev/ - Settings - API Keys)
echo    - COMPOSIO_USER_ID (z https://app.composio.dev/ - Settings - Profile)
echo    - RECIPIENT_EMAIL (opcjonalne)
echo.
echo 2. Zapisz plik (Ctrl+S) i zamknij Notatnik
echo.
echo 3. Upewnij sie ze polaczyles konta w Composio:
echo    https://app.composio.dev/ - Apps - YouTube (Connect)
echo    https://app.composio.dev/ - Apps - Gmail (Connect)
echo.
echo 4. Zrestartuj Claude Desktop CALKOWICIE
echo.
echo 5. Sprawdz ikone 🔌 w Claude Desktop
echo.
echo 6. Przetestuj w Claude Desktop:
echo    "Pokaz moje subskrypcje YouTube"
echo.
echo === Troubleshooting ===
echo.
echo Logi Claude Desktop:
echo   %LOCALAPPDATA%\Claude\logs\
echo.
echo Dokumentacja:
echo   docs\CLAUDE-DESKTOP-SETUP.md
echo.
pause
