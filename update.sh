#!/bin/bash
# ==============================================================================
# NetMon Polije - Auto-Update and Hotfix Script
# Runs git pull, rebuilds UI, recompiles Go binary, and restarts services.
# ==============================================================================

set -e

# Color variables
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0;0m' # No Color

# Print header
echo -e "${BLUE}======================================================================"
echo -e "                 NetMon Polije - Auto-Update Utility                  "
echo -e "======================================================================${NC}"

# Check if run as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Script ini harus dijalankan sebagai root (gunakan sudo).${NC}"
    exit 1
fi

# Detect WSL
IS_WSL=false
if grep -qEi "(Microsoft|WSL)" /proc/version &>/dev/null; then
    IS_WSL=true
fi

# 1. Pull latest code from Git
echo -e "\n${BLUE}[1/4] Menarik pembaruan kode terbaru dari Git...${NC}"
# Allow safe directory for git in case of owner conflicts
git config --global --add safe.directory "$(pwd)" || true

if [ -d .git ]; then
    git pull origin master
    echo -e "${GREEN}✓ Kode berhasil diperbarui dari GitHub.${NC}"
else
    echo -e "${YELLOW}Warning: Bukan direktori Git. Melewati langkah git pull...${NC}"
fi

# 2. Build Frontend UI
echo -e "\n${BLUE}[2/4] Membangun ulang aset statis Frontend (React/Vite)...${NC}"
# Fix ownership issues before build
chown -R $(logname):$(logname) . 2>/dev/null || true

# Run npm build as the normal user who initiated sudo (to avoid node_modules root ownership issues)
sudo -u $(logname) npm run build

# Copy build result to backend embedding directory
echo "Menyalin aset UI dist ke folder embed backend..."
mkdir -p backend/dist
rm -rf backend/dist/*
cp -r dist/* backend/dist/
echo -e "${GREEN}✓ Frontend UI berhasil dibangun.${NC}"

# 3. Compile Go Backend
echo -e "\n${BLUE}[3/4] Mengompilasi ulang biner Go Backend...${NC}"
cd backend
go mod tidy
CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o netmon .
cd ..

# Copy binary to target deploy directory
DEPLOY_DIR="/opt/netmon"
mkdir -p $DEPLOY_DIR
cp backend/netmon $DEPLOY_DIR/netmon
chown -R netmon:netmon $DEPLOY_DIR
echo -e "${GREEN}✓ Biner backend berhasil dikompilasi dan disalin ke $DEPLOY_DIR/netmon.${NC}"

# Update config.yaml port if it exists to match the new 9090 port
if [ -f /etc/netmon/config.yaml ]; then
    echo "Memperbarui port di /etc/netmon/config.yaml ke 9090..."
    sed -i 's/port: 8080/port: 9090/g' /etc/netmon/config.yaml || true
fi

# Reset PostgreSQL database tables to ensure clean migration on start
echo -e "\n${BLUE}[Resetting Database] Mengosongkan tabel database PostgreSQL...${NC}"
if command -v psql &>/dev/null; then
    sudo -u postgres psql -d netmon -c "DROP TABLE IF EXISTS devices, metrics, alerts CASCADE;" || true
    echo -e "${GREEN}✓ Tabel database netmon berhasil di-drop (reset).${NC}"
else
    echo -e "${YELLOW}Warning: PostgreSQL client (psql) tidak terdeteksi. Melewati database reset...${NC}"
fi



# 4. Restart services
echo -e "\n${BLUE}[4/4] Memuat ulang layanan...${NC}"
if [ "$IS_WSL" = false ] && systemctl is-active --quiet netmon; then
    echo "Mendeteksi systemd service aktif. Melakukan restart netmon..."
    systemctl restart netmon
    echo -e "${GREEN}✓ Layanan netmon berhasil dijalankan ulang (systemctl restart netmon).${NC}"
else
    if [ "$IS_WSL" = true ]; then
        echo -e "${YELLOW}Info: Berjalan di WSL. Silakan restart aplikasi Anda secara manual dengan:${NC}"
    else
        echo -e "${YELLOW}Info: Systemd service tidak terdeteksi aktif. Silakan jalankan aplikasi secara manual dengan:${NC}"
    fi
    echo -e "  ${BLUE}sudo /opt/netmon/netmon -config /etc/netmon/config.yaml -seed=true${NC}"
fi

echo -e "\n${GREEN}======================================================================"
echo -e "                     UPDATE SELESAI DENGAN SUKSES                     "
echo -e "======================================================================${NC}"
