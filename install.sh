#!/bin/bash
# ==============================================================================
# NetMon Polije - Single-Command Installer Script
# Optimized for: Ubuntu 22.04 LTS / 24.04 LTS, Debian 12 (VM, Bare Metal, WSL)
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
echo -e "          NetMon Polije - Campus Network Monitoring Installer          "
echo -e "======================================================================${NC}"

# 1. Check if run as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Installer ini harus dijalankan sebagai root (gunakan sudo).${NC}"
    exit 1
fi

# Detect WSL
IS_WSL=false
if grep -qEi "(Microsoft|WSL)" /proc/version &>/dev/null; then
    IS_WSL=true
    echo -e "${YELLOW}Info: Lingkungan WSL terdeteksi.${NC}"
fi

# 2. Check System Requirements
echo -e "\n${BLUE}[1/6] Memeriksa kelengkapan sistem...${NC}"

# Check RAM
TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_MEM" -lt 950 ]; then
    echo -e "${YELLOW}Warning: RAM terdeteksi kurang dari 1GB (${TOTAL_MEM}MB). Beberapa build step mungkin lambat.${NC}"
else
    echo -e "${GREEN}✓ RAM Cukup: ${TOTAL_MEM}MB${NC}"
fi

# Check OS distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME=$ID
    OS_VERSION=$VERSION_ID
else
    echo -e "${RED}Error: Gagal mendeteksi sistem operasi.${NC}"
    exit 1
fi

if [[ "$OS_NAME" != "ubuntu" && "$OS_NAME" != "debian" ]]; then
    echo -e "${RED}Error: Installer ini hanya mendukung Ubuntu atau Debian.${NC}"
    exit 1
else
    echo -e "${GREEN}✓ OS didukung: ${NAME} ${VERSION}${NC}"
fi

# Check common ports
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        return 1
    else
        return 0
    fi
}

echo -e "Memeriksa ketersediaan port..."
if ! check_port 8080; then
    echo -e "${RED}Error: Port 8080 sedang digunakan oleh aplikasi lain.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Port 8080 Tersedia${NC}"

# 3. Add PPAs and Repositories
echo -e "\n${BLUE}[2/6] Menambahkan PPA dan dependensi repositori...${NC}"
apt-get update -y
apt-get install -y curl gnupg software-properties-common lsb-release lsof build-essential git

# Add Go PPA (Ubuntu only)
if [ "$OS_NAME" == "ubuntu" ]; then
    echo "Menambahkan PPA Golang..."
    add-apt-repository -y ppa:longsleep/golang-backports
fi

# Add NodeSource Node.js 20 LTS Repository
echo "Menambahkan repositori Node.js 20 LTS..."
mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg --yes
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list

# Add PostgreSQL Official Repository
echo "Menambahkan repositori PostgreSQL..."
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg --yes
echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | tee /etc/apt/sources.list.d/pgdg.list

# Update Package Index
apt-get update -y

# 4. Install Dependencies (Go, Node, Postgres)
echo -e "\n${BLUE}[3/6] Menginstal Go, Node.js, dan PostgreSQL...${NC}"

# Install packages
if [ "$OS_NAME" == "ubuntu" ]; then
    apt-get install -y golang-go nodejs postgresql-16 postgresql-contrib-16
else
    # Debian: Go from standard backports or stable package
    apt-get install -y golang nodejs postgresql-16 postgresql-contrib-16
fi

# Verify Installations
GO_VER=$(go version || echo "Gagal")
NODE_VER=$(node -v || echo "Gagal")
NPM_VER=$(npm -v || echo "Gagal")
PG_VER=$(psql --version || echo "Gagal")

echo -e "${GREEN}✓ Golang terinstal: ${GO_VER}${NC}"
echo -e "${GREEN}✓ Node.js terinstal: ${NODE_VER} (NPM ${NPM_VER})${NC}"
echo -e "${GREEN}✓ PostgreSQL terinstal: ${PG_VER}${NC}"

# Start and enable PostgreSQL
echo "Memulai layanan PostgreSQL..."
if [ "$IS_WSL" = true ]; then
    service postgresql start || true
else
    systemctl start postgresql
    systemctl enable postgresql
fi

# 5. Configure Database
echo -e "\n${BLUE}[4/6] Mengonfigurasi PostgreSQL database...${NC}"

DB_USER="netmon"
DB_PASS=$(openssl rand -hex 12)
DB_NAME="netmon"

# Create Database and User
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" || true
sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" || true

echo -e "${GREEN}✓ Database PostgreSQL '$DB_NAME' berhasil dikonfigurasi.${NC}"
echo -e "User: ${BLUE}$DB_USER${NC}"
echo -e "Password: ${BLUE}$DB_PASS${NC}"

# 6. Build the Application
echo -e "\n${BLUE}[5/6] Mengompilasi kode program (Build)...${NC}"

# Build Frontend first
echo "Membangun UI statis (Vite)..."
npm install --no-audit --no-fund
npm run build

# Copy build result to backend embedding directory
echo "Menyalin UI dist ke direktori embed backend..."
mkdir -p backend/dist
cp -r dist/* backend/dist/

# Build Go Backend
echo "Membangun Go biner..."
cd backend
go mod tidy
CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o netmon .
cd ..

echo -e "${GREEN}✓ Kompilasi program selesai.${NC}"

# 7. Configure systemd Service (if VM/Baremetal)
echo -e "\n${BLUE}[6/6] Memasang konfigurasi deploy...${NC}"

# Create netmon runtime directory and user
id -u netmon &>/dev/null || useradd -m -s /bin/false netmon
mkdir -p /etc/netmon
mkdir -p /var/log/netmon
chown -R netmon:netmon /var/log/netmon

# Copy binary & config to target deployment path
DEPLOY_DIR="/opt/netmon"
mkdir -p $DEPLOY_DIR/data
cp backend/netmon $DEPLOY_DIR/netmon
cp backend/config.example.yaml /etc/netmon/config.yaml
chown -R netmon:netmon $DEPLOY_DIR
chown -R netmon:netmon /etc/netmon

# Update config.yaml to use PostgreSQL
cat <<EOT > /etc/netmon/config.yaml
server:
  host: 0.0.0.0
  port: 8080
  cors: true

database:
  driver: postgres
  dsn: "postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME?sslmode=disable"

poll:
  interval: 30s
  icmp: true
  workers: 128
  bulk_oids: true

log:
  level: info
  pretty: false

snmp:
  communities:
    - publicPolije
    - polijeRO
    - ruijieRO
    - unifiRO
    - public
  port: 161
  timeout: 750ms
  retries: 2
  version: v2c

unifi:
  enabled: false
  url: https://10.10.1.40:8443
  user: netmon@polije.ac.id
  pass: CHANGE_PASSWORD
  site: default
  auto_adopt: true
  interval: 5m
  insecure: true

scan:
  default_cidr: 10.10.0.0/22
  concurrency: 256
  ping_timeout: 800ms
  snmp_timeout: 750ms
  auto_import: false
EOT

chown netmon:netmon /etc/netmon/config.yaml

# Create systemd service if not WSL
if [ "$IS_WSL" = false ]; then
    echo "Memasang unit systemd service..."
    cat <<EOT > /etc/systemd/system/netmon.service
[Unit]
Description=NetMon Polije Campus Network Monitoring
After=network.target postgresql.service

[Service]
Type=simple
User=netmon
WorkingDirectory=/opt/netmon
ExecStart=/opt/netmon/netmon -config /etc/netmon/config.yaml -seed=true
Restart=always
RestartSec=5
StandardOutput=append:/var/log/netmon/output.log
StandardError=append:/var/log/netmon/error.log

[Install]
WantedBy=multi-user.target
EOT

    systemctl daemon-reload
    systemctl enable netmon
    systemctl start netmon
    echo -e "${GREEN}✓ NetMon Polije berhasil dipasang sebagai systemd service dan dijalankan.${NC}"
else
    echo -e "${YELLOW}Info: Karena Anda menggunakan WSL, silakan jalankan aplikasi secara manual:${NC}"
    echo -e "  sudo -u netmon /opt/netmon/netmon -config /etc/netmon/config.yaml -seed=true"
fi

# Print installation receipt
echo -e "\n${GREEN}======================================================================"
echo -e "                   INSTALASI BERHASIL DISELESAIKAN                    "
echo -e "======================================================================${NC}"
echo -e "Aplikasi NetMon Polije siap diakses melalui browser pada port 8080."
echo -e "URL: ${BLUE}http://localhost:8080/${NC}"
echo -e "Lokasi Biner: ${BLUE}$DEPLOY_DIR/netmon${NC}"
echo -e "Berkas Konfigurasi: ${BLUE}/etc/netmon/config.yaml${NC}"
echo -e "Layanan Database: ${BLUE}PostgreSQL 16 (DB: $DB_NAME, User: $DB_USER)${NC}"
if [ "$IS_WSL" = false ]; then
    echo -e "Status Service: Jalankan ${BLUE}sudo systemctl status netmon${NC} untuk melihat log."
fi
echo -e "======================================================================"
