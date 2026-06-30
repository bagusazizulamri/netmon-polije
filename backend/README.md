# NetMon Polije — Backend

Backend monitoring jaringan kampus Polije yang **ringan, cepat, stabil**, ditulis dalam **Go 1.23**.
Dirancang agar dapat berjalan di:

- **Bare metal** Linux (Ubuntu/Debian/Rocky)
- **VM** (Proxmox, KVM, VMware)
- **WSL2** (Windows) dengan NAT – bind `0.0.0.0` + portproxy PowerShell
- **Docker / docker-compose**
- Raspberry Pi 4/5 (build `GOARCH=arm64`)

## Stack

| Layer | Teknologi |
|---|---|
| HTTP API | [Fiber](https://gofiber.io) |
| SNMP Polling | [gosnmp](https://github.com/gosnmp/gosnmp) v2c/v3, concurrency worker pool |
| UniFi Sync | REST API native (UniFi OS + legacy) dengan session cookie, auto-adopt |
| Discovery scan | ICMP/TCP ping sweep + SNMP walk, concurrency 256, ~20 detik /22 |
| Storage | SQLite (default) atau Postgres/[TimescaleDB](https://www.timescale.com/) |
| Logging | zap (structured) |
| Scheduler | internal ticker (terpisah untuk poller & UniFi) |
| Observability | JSON API, siap ditambah Prometheus `/metrics` |

## Fitur

- Multi-vendor: **MikroTik, Aruba, Ruijie, UniFi, Juniper, Dell, HPE, Supermicro**
- Auto-detect SNMP (multi-community dicoba berurutan)
- Auto-sinkronisasi perangkat UniFi (AP + switch) + auto-adopt untuk perangkat belum diadopt
- TCP-ping (tanpa CAP_NET_RAW) sehingga *works out of the box* di WSL2 userland
- Alert kritis/warning otomatis (CPU, memori, temp, loss, offline)
- Seed data default untuk 18 perangkat Polije
- CORS built-in, siap di-hit oleh frontend React

## Menjalankan

### 1. Jalan langsung (development)

```bash
cd backend
go mod tidy
go run . -config config.example.yaml
```

API listen di `http://0.0.0.0:8080`.

### 2. Build binary

```bash
cd backend
CGO_ENABLED=1 go build -ldflags="-s -w" -o netmon .
./netmon -config config.yaml
```

Binary size ~12 MB. Idle RAM ~28 MB.

### 3. Docker

```bash
# dari root project
docker compose up -d --build
```

`network_mode: host` direkomendasikan di Linux/bare metal untuk akses LAN penuh.
Di Windows/WSL2 dengan Docker Desktop, comment `network_mode: host` dan gunakan port mapping.

### 4. WSL2 NAT (Windows Host)

Jalankan PowerShell **Administrator**:

```powershell
$WSLIP = (wsl hostname -I).Trim().Split(" ")[0]
netsh interface portproxy add v4tov4 listenport=8080 listenaddress=0.0.0.0 connectport=8080 connectaddress=$WSLIP
# buka firewall
New-NetFirewallRule -DisplayName "NetMon Polije" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080
```

Untuk mirrored networking (Windows 11 23H2+), tambahkan di `%USERPROFILE%\.wslconfig`:

```ini
[wsl2]
networkingMode=mirrored
```

## Endpoint API

| Method | Path | Kegunaan |
|---|---|---|
| GET | `/api/health` | health check |
| GET | `/api/kpi` | ringkasan KPI dashboard |
| GET | `/api/devices` | list device (filter: `?category=ap&vendor=UniFi&building=tip&q=10.10.10`) |
| GET | `/api/devices/:id` | detail per device |
| POST | `/api/devices` | tambah/update manual |
| DELETE | `/api/devices/:id` | hapus |
| GET | `/api/alerts` | list alert (`?ack=true/false`) |
| POST | `/api/alerts/:id/ack?ack=true` | ack/unack alert |
| POST | `/api/alerts/ack-all` | ack semua |
| GET | `/api/buildings` | daftar gedung Polije |
| POST | `/api/scan` | trigger SNMP network scan `{"cidr":"10.10.0.0/22","communities":[...]}` |
| POST | `/api/unifi/sync` | force sync UniFi |
| GET | `/api/unifi/devices` | list perangkat UniFi yang disync |
| GET | `/api/metrics/traffic` | 36 poin time-series throughput aggregate |

## Konfigurasi via ENV

Semua key di `config.yaml` bisa dioverride via env dengan prefix `NETMON_` dan pemisah `_`, mis.

```
NETMON_UNIFI_PASS=secret123
NETMON_SNMP_COMMUNITIES=pub1,pub2
NETMON_POLL_INTERVAL=30s
```

## Struktur kode

```
backend/
├── main.go                 # entrypoint + wiring
├── seed.go                 # seed data demo
├── config.example.yaml
├── Dockerfile
├── dist/index.html         # landing page API
└── internal/
    ├── config/             # viper config
    ├── model/              # structs: Device, Alert, Metric, KPI
    ├── store/              # SQLite (+ Postgres-ready interface)
    ├── poller/             # SNMP + TCP-ping polling loop
    ├── unifi/              # UniFi controller client (login + sync)
    ├── scanner/            # SNMP network discovery
    └── api/                # Fiber routes + handlers
```

## Roadmap production

- Ganti SQLite ke Postgres + TimescaleDB untuk retensi metrik jangka panjang
- Tambah NATS JetStream untuk horizontal poller (multi-site Nganjuk, Bondowoso, Sidoarjo)
- Prometheus exporter + Grafana dashboards opsional
- Webhook/Telegram/Email notifikasi via Alertmanager
- 802.1X session + RADIUS accounting integration
