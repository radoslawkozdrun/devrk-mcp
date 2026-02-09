#!/bin/bash

# Skrypt do aktualizacji MCP Server na VPS
# Lokalizacja: /root/update_mcp_server

set -e  # Zatrzymaj skrypt przy bĹ‚Ä™dzie

# Kolory dla outputu
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Aktualizacja MCP Server ===${NC}"

# 1. Zaktualizuj repozytorium mcp-server
echo -e "${YELLOW}[1/5] Aktualizacja repozytorium...${NC}"
cd /root/repo/mcp-server

# SprawdĹş czy sÄ… niezapisane zmiany
if [[ -n $(git status -s) ]]; then
    echo -e "${RED}UWAGA: SÄ… niezapisane zmiany w repozytorium!${NC}"
    git status -s
    read -p "Czy chcesz kontynuowaÄ‡? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Aktualizacja anulowana.${NC}"
        exit 1
    fi
fi

# Pobierz najnowsze zmiany
git fetch origin
git pull origin main || git pull origin master

# Pobierz numer ostatniego commita (krĂłtki hash)
COMMIT_HASH=$(git rev-parse --short HEAD)
echo -e "${GREEN}Aktualny commit: ${COMMIT_HASH}${NC}"

# 3. Przebuduj obraz dockerowy
echo -e "${YELLOW}[4/5] PeĹ‚ne czyszczenie Docker...${NC}"
cd /root

# Zatrzymaj i usuĹ„ kontener
echo -e "${YELLOW}Zatrzymywanie i usuwanie starego kontenera...${NC}"
docker-compose stop mcp-server 2>/dev/null || true
docker-compose rm -f mcp-server 2>/dev/null || true

# UsuĹ„ stary obraz mcp-server
echo -e "${YELLOW}Usuwanie starych obrazĂłw...${NC}"
docker images | grep mcp-server | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
docker images | grep root_mcp-server | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true

# WyczyĹ›Ä‡ nieuĹĽywane obrazy i kontenery
echo -e "${YELLOW}Czyszczenie nieuĹĽywanych zasobĂłw Docker...${NC}"
docker image prune -f
docker container prune -f

# 4. Budowanie i uruchomienie
echo -e "${YELLOW}[5/5] Budowanie nowego obrazu...${NC}"
docker compose build --no-cache mcp-server

# Uruchom kontener
echo -e "${YELLOW}Uruchamianie kontenera...${NC}"
docker compose up -d mcp-server

# SprawdĹş status
echo -e "${GREEN}=== Status kontenera ===${NC}"
docker compose ps mcp-server

# PokaĹĽ ostatnie logi
echo -e "${GREEN}=== Ostatnie logi (10 linii) ===${NC}"
docker compose logs --tail=10 mcp-server

echo -e "${GREEN}=== Aktualizacja zakoĹ„czona! ===${NC}"
echo -e "${GREEN}Commit: ${COMMIT_HASH}${NC}"
