# NetMon Polije 🌐

[![Go Version](https://img.shields.io/badge/Go-1.23%2B-blue.svg)](https://golang.org)
[![React Version](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**NetMon Polije** adalah sistem monitoring jaringan kampus terpadu yang dirancang khusus untuk memantau infrastruktur perangkat aktif (Server, Router, Switch, dan Access Point) di lingkungan **Politeknik Negeri Jember**. Sistem ini menggabungkan performa *polling* backend berbasis **Go** dengan antarmuka dasbor modern berbasis **React**.

---

## ✨ Fitur Utama

- **Real-Time SNMP & ICMP Poller:** Melakukan polling berkala (default 30 detik) untuk memantau penggunaan CPU, RAM, suhu perangkat, *latency*, persentase *packet loss*, serta *traffic interface* (bandwidth masuk/keluar).
- **Network Auto-Discovery:** Fitur pemindaian subnet (CIDR sweep) cepat untuk mendeteksi perangkat aktif baru dan mencocokkan *SNMP community string* secara otomatis.
- **UniFi Controller Native Sync:** Integrasi langsung dengan API UniFi OS (UDM/Cloud Key) untuk sinkronisasi inventori Access Point dan Switch serta adopsi perangkat baru (*auto-adopt*).
- **Dasbor Apple-Clean & Responsif:** Tampilan UI minimalis dan bersih menggunakan ikon **Lucide React**, visualisasi bandwidth real-time dengan **Recharts**, serta peta topologi jaringan kampus L3.
- **Dukungan Multi-Database:** Mendukung penyimpanan database lokal ringan menggunakan **SQLite3** dan skala produksi menggunakan **PostgreSQL/TimescaleDB**.

---

## 🏗️ Arsitektur Sistem

```mermaid
graph TD
    UI[React Vite Frontend] <--> API[Go Fiber Rest API]
    API <--> DB[(SQLite3 / PostgreSQL)]
    Poller[Go SNMP/ICMP Poller] --> DB
    Scanner[SNMP Subnet Scanner] --> DB
    UniFi[UniFi Sync Agent] --> DB
```

---

## 🛠️ Persyaratan Sistem (Dependencies)

Untuk menjalankan dan membangun proyek ini secara lokal, pastikan perangkat Anda telah terinstal:
- **Go** (versi 1.23 atau lebih baru)
- **Node.js** (versi 20 LTS atau lebih baru)
- **npm** (bawaan Node.js)
- **PostgreSQL** atau **SQLite3**

---

## 🚀 Panduan Pengembangan Lokal (Development)

### 1. Jalankan Backend Go
Masuk ke direktori `backend` dan jalankan server Fiber:
```bash
cd backend
# Unduh dependensi backend
go mod tidy
# Jalankan biner dengan config.example.yaml
go run . -config config.example.yaml -seed=true
```
Backend secara default akan aktif di `http://localhost:8080` dan menggunakan database SQLite lokal `./data/netmon.db`.

### 2. Jalankan Frontend React
Di jendela terminal baru pada root direktori proyek, jalankan server pengembangan Vite:
```bash
# Instal dependensi frontend
npm install
# Jalankan Vite server
npm run dev
```
Frontend akan aktif di `http://localhost:5173`. Di lingkungan pengembangan, frontend dikonfigurasi untuk terhubung secara dinamis ke backend pada port `8080`.

---

## 📦 Panduan Deployment Produksi (Production Setup)

Kami menyediakan skrip installer satu perintah (`install.sh`) yang dirancang untuk **Ubuntu (22.04/24.04)**, **Debian 12**, atau **WSL2** dengan hak akses root.

Skrip ini akan mengotomatiskan langkah berikut:
1. Memeriksa ketersediaan port dan RAM.
2. Memasang repositori PPA resmi untuk Go, Node.js, dan PostgreSQL 16.
3. Membuat database & user PostgreSQL dengan kredensial acak yang aman.
4. Melakukan kompilasi aset frontend Vite dan menyematkannya (*embed*) ke dalam biner Go.
5. Memasang aplikasi sebagai background service menggunakan **systemd**.

### Cara Menjalankan Installer:
```bash
# Berikan izin eksekusi pada script
chmod +x install.sh

# Jalankan installer dengan sudo
sudo ./install.sh
```

Setelah instalasi selesai, NetMon Polije dapat langsung diakses di browser melalui port `8080` (misal: `http://ip-server:8080`).

---

## ⚙️ Berkas Konfigurasi (`config.yaml`)

Semua konfigurasi sistem seperti interval polling, credentials UniFi API, dan string komunitas SNMP diatur dalam `/etc/netmon/config.yaml`.

Contoh struktur konfigurasi:
```yaml
server:
  host: 0.0.0.0
  port: 8080
  cors: true

database:
  driver: postgres # sqlite3 atau postgres
  dsn: "postgres://netmon:secret_pass@localhost:5432/netmon?sslmode=disable"

poll:
  interval: 30s
  icmp: true
  workers: 128
```

---

## 📄 Lisensi

Proyek ini dilisensikan di bawah **MIT License** - lihat berkas [LICENSE](LICENSE) untuk detail lebih lanjut.
