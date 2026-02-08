#!/bin/bash

# Skrypt do aktualizacji MCP Server na VPS
# Lokalizacja: /root/update_mcp_server

set -e  # Zatrzymaj skrypt przy błędzie

# Kolory dla outputu
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Aktualizacja MCP Server ===${NC}"

# 1. Zaktualizuj repozytorium mcp-server
echo -e "${YELLOW}[1/5] Aktualizacja repozytorium...${NC}"
cd /root/repo/mcp-server

# Sprawdź czy są niezapisane zmiany
if [[ -n $(git status -s) ]]; then
    echo -e "${RED}UWAGA: Są niezapisane zmiany w repozytorium!${NC}"
    git status -s
    read -p "Czy chcesz kontynuować? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Aktualizacja anulowana.${NC}"
        exit 1
    fi
fi

# Pobierz najnowsze zmiany
git fetch origin
git pull origin main || git pull origin master

# Pobierz numer ostatniego commita (krótki hash)
COMMIT_HASH=$(git rev-parse --short HEAD)
echo -e "${GREEN}Aktualny commit: ${COMMIT_HASH}${NC}"

# 2. Backup docker-compose.yml
echo -e "${YELLOW}[2/5] Tworzenie backupu docker-compose.yml...${NC}"

# Utwórz katalog na backupy jeśli nie istnieje
mkdir -p /root/docker_compose_backups

# Nazwa pliku backup z numerem commita
BACKUP_FILE="/root/docker_compose_backups/docker-compose.yml_backup_${COMMIT_HASH}"

# Skopiuj plik
if [ -f /root/docker-compose.yml ]; then
    cp /root/docker-compose.yml "$BACKUP_FILE"
    echo -e "${GREEN}Backup utworzony: ${BACKUP_FILE}${NC}"
else
    echo -e "${YELLOW}Plik /root/docker-compose.yml nie istnieje, pomijam backup${NC}"
fi

# 3. Nadpisz docker-compose.yml z repozytorium
echo -e "${YELLOW}[3/5] Kopiowanie docker-compose.yml z repozytorium...${NC}"
cp /root/repo/mcp-server/Docker/docker-compose.yml /root/docker-compose.yml
echo -e "${GREEN}docker-compose.yml zaktualizowany${NC}"

# 4. Przebuduj obraz dockerowy
echo -e "${YELLOW}[4/5] Pełne czyszczenie Docker...${NC}"
cd /root

# Zatrzymaj i usuń kontener
echo -e "${YELLOW}Zatrzymywanie i usuwanie starego kontenera...${NC}"
docker-compose stop mcp-server 2>/dev/null || true
docker-compose rm -f mcp-server 2>/dev/null || true

# Usuń stary obraz mcp-server
echo -e "${YELLOW}Usuwanie starych obrazów...${NC}"
docker images | grep mcp-server | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
docker images | grep root_mcp-server | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

# Wyczyść nieużywane obrazy i kontenery
echo -e "${YELLOW}Czyszczenie nieużywanych zasobów Docker...${NC}"
docker image prune -f
docker container prune -f

# 5. Budowanie i uruchomienie
echo -e "${YELLOW}[5/5] Budowanie nowego obrazu...${NC}"
docker-compose build --no-cache mcp-server

# Uruchom kontener
echo -e "${YELLOW}Uruchamianie kontenera...${NC}"
docker-compose up -d mcp-server

# Sprawdź status
echo -e "${GREEN}=== Status kontenera ===${NC}"
docker-compose ps mcp-server

# Pokaż ostatnie logi
echo -e "${GREEN}=== Ostatnie logi (10 linii) ===${NC}"
docker-compose logs --tail=10 mcp-server

echo -e "${GREEN}=== Aktualizacja zakończona! ===${NC}"
echo -e "${GREEN}Commit: ${COMMIT_HASH}${NC}"
echo -e "${GREEN}Backup: ${BACKUP_FILE}${NC}"

# Wyświetl listę backupów
echo -e "${YELLOW}=== Lista backupów ===${NC}"
ls -lh /root/docker_compose_backups/ | tail -5
