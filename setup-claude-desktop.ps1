# Setup script dla Claude Desktop MCP
# Uruchom w PowerShell: .\setup-claude-desktop.ps1

Write-Host "=== Konfiguracja Claude Desktop dla devrk-mcp ===" -ForegroundColor Cyan
Write-Host ""

# Sprawdź czy dist/index.js istnieje
$projectPath = $PSScriptRoot
$distPath = Join-Path $projectPath "dist\index.js"

if (-not (Test-Path $distPath)) {
    Write-Host "❌ Błąd: dist/index.js nie istnieje!" -ForegroundColor Red
    Write-Host "   Najpierw uruchom: npm run build" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Znaleziono dist/index.js" -ForegroundColor Green

# Ścieżka do konfiguracji Claude Desktop
$claudeConfigDir = Join-Path $env:APPDATA "Claude"
$claudeConfigPath = Join-Path $claudeConfigDir "claude_desktop_config.json"

Write-Host ""
Write-Host "Ścieżka konfiguracji Claude Desktop:" -ForegroundColor Cyan
Write-Host "  $claudeConfigPath" -ForegroundColor Gray

# Utwórz katalog jeśli nie istnieje
if (-not (Test-Path $claudeConfigDir)) {
    Write-Host ""
    Write-Host "Tworzę katalog Claude..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $claudeConfigDir -Force | Out-Null
}

# Sprawdź czy plik już istnieje
$existingConfig = $null
if (Test-Path $claudeConfigPath) {
    Write-Host ""
    Write-Host "⚠️  Plik konfiguracyjny już istnieje!" -ForegroundColor Yellow
    Write-Host ""
    $overwrite = Read-Host "Czy chcesz go nadpisać? (tak/nie)"

    if ($overwrite -ne "tak") {
        Write-Host ""
        Write-Host "❌ Anulowano. Edytuj plik ręcznie:" -ForegroundColor Red
        Write-Host "   $claudeConfigPath" -ForegroundColor Gray
        exit 0
    }

    # Backup starej konfiguracji
    $backupPath = "$claudeConfigPath.backup"
    Copy-Item $claudeConfigPath $backupPath -Force
    Write-Host "✅ Utworzono backup: $backupPath" -ForegroundColor Green
}

# Pobierz dane od użytkownika
Write-Host ""
Write-Host "=== Konfiguracja Composio ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pobierz klucze z: https://app.composio.dev/" -ForegroundColor Gray
Write-Host ""

$composioApiKey = Read-Host "COMPOSIO_API_KEY (comp_...)"
$composioUserId = Read-Host "COMPOSIO_USER_ID"
$recipientEmail = Read-Host "RECIPIENT_EMAIL (opcjonalne, Enter aby pominąć)"

if ([string]::IsNullOrWhiteSpace($composioApiKey)) {
    Write-Host ""
    Write-Host "❌ COMPOSIO_API_KEY jest wymagany!" -ForegroundColor Red
    exit 1
}

if ([string]::IsNullOrWhiteSpace($composioUserId)) {
    Write-Host ""
    Write-Host "❌ COMPOSIO_USER_ID jest wymagany!" -ForegroundColor Red
    exit 1
}

# Przygotuj ścieżkę (escape backslashes dla JSON)
$distPathJson = $distPath -replace '\\', '\\'

# Utwórz konfigurację
$config = @{
    mcpServers = @{
        "devrk-mcp" = @{
            command = "node"
            args = @($distPathJson)
            env = @{
                COMPOSIO_API_KEY = $composioApiKey
                COMPOSIO_MCP_ENDPOINT = "https://backend.composio.dev/api/v1/mcp"
                COMPOSIO_USER_ID = $composioUserId
                LOG_LEVEL = "info"
            }
        }
    }
}

# Dodaj recipient email jeśli podany
if (-not [string]::IsNullOrWhiteSpace($recipientEmail)) {
    $config.mcpServers."devrk-mcp".env.RECIPIENT_EMAIL = $recipientEmail
}

# Zapisz do pliku
$configJson = $config | ConvertTo-Json -Depth 10
Set-Content -Path $claudeConfigPath -Value $configJson -Encoding UTF8

Write-Host ""
Write-Host "=== Konfiguracja zapisana ===" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Plik zapisany: $claudeConfigPath" -ForegroundColor Green
Write-Host ""

# Pokaż zawartość
Write-Host "Zawartość pliku:" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray
Get-Content $claudeConfigPath | Write-Host -ForegroundColor Gray
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host ""

# Instrukcje końcowe
Write-Host "=== Następne kroki ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Upewnij się że połączyłeś konta w Composio:" -ForegroundColor Yellow
Write-Host "   https://app.composio.dev/ → Apps → YouTube (Connect)" -ForegroundColor Gray
Write-Host "   https://app.composio.dev/ → Apps → Gmail (Connect)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Zrestartuj Claude Desktop CAŁKOWICIE" -ForegroundColor Yellow
Write-Host "   (zamknij i uruchom ponownie)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Sprawdź ikonę 🔌 w Claude Desktop" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Przetestuj w Claude Desktop:" -ForegroundColor Yellow
Write-Host '   "Pokaż moje subskrypcje YouTube"' -ForegroundColor Gray
Write-Host ""
Write-Host "=== Troubleshooting ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Logi Claude Desktop:" -ForegroundColor Yellow
Write-Host "  $env:LOCALAPPDATA\Claude\logs\" -ForegroundColor Gray
Write-Host ""
Write-Host "Dokumentacja:" -ForegroundColor Yellow
Write-Host "  docs/CLAUDE-DESKTOP-SETUP.md" -ForegroundColor Gray
Write-Host ""
