package store

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	_ "github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/polije/netmon/internal/model"
)

type Store struct {
	db     *sqlx.DB
	driver string
}

func Open(driver, dsn string) (*Store, error) {
	db, err := sqlx.Open(driver, dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	db.SetMaxOpenConns(16)
	db.SetMaxIdleConns(4)
	db.SetConnMaxLifetime(30 * time.Minute)
	if err := db.Ping(); err != nil {
		return nil, err
	}
	s := &Store{db: db, driver: driver}
	if err := s.migrate(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) DB() *sqlx.DB { return s.db }

func (s *Store) migrate() error {
	var stmts []string
	if s.driver == "postgres" {
		stmts = []string{
			`CREATE TABLE IF NOT EXISTS devices (
				id TEXT PRIMARY KEY,
				hostname TEXT, ip TEXT UNIQUE, category TEXT, vendor TEXT, model TEXT,
				building_id TEXT, floor TEXT, status TEXT, uptime_sec INTEGER,
				cpu REAL, mem REAL, temp REAL, latency_ms REAL, loss REAL,
				traffic_in_mbps REAL, traffic_out_mbps REAL, clients INTEGER, poe_w REAL,
				snmp BOOLEAN, snmp_community TEXT, site TEXT, last_seen TIMESTAMPTZ,
				notes TEXT, auto_discovered BOOLEAN, source TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
			)`,
			`CREATE TABLE IF NOT EXISTS metrics (
				device_id TEXT, ts TIMESTAMPTZ, cpu REAL, mem REAL, temp REAL, latency REAL,
				in_bps REAL, out_bps REAL, clients INTEGER,
				PRIMARY KEY(device_id, ts)
			)`,
			`CREATE TABLE IF NOT EXISTS alerts (
				id TEXT PRIMARY KEY, device_id TEXT, severity TEXT, message TEXT, ack BOOLEAN,
				created_at TIMESTAMPTZ
			)`,
			`CREATE INDEX IF NOT EXISTS idx_metrics_ts ON metrics(ts);`,
			`CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);`,
			`CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);`,
		}
	} else {
		stmts = []string{
			`CREATE TABLE IF NOT EXISTS devices (
				id TEXT PRIMARY KEY,
				hostname TEXT, ip TEXT UNIQUE, category TEXT, vendor TEXT, model TEXT,
				building_id TEXT, floor TEXT, status TEXT, uptime_sec INTEGER,
				cpu REAL, mem REAL, temp REAL, latency_ms REAL, loss REAL,
				traffic_in_mbps REAL, traffic_out_mbps REAL, clients INTEGER, poe_w REAL,
				snmp BOOLEAN, snmp_community TEXT, site TEXT, last_seen DATETIME,
				notes TEXT, auto_discovered BOOLEAN, source TEXT, created_at DATETIME, updated_at DATETIME
			)`,
			`CREATE TABLE IF NOT EXISTS metrics (
				device_id TEXT, ts DATETIME, cpu REAL, mem REAL, temp REAL, latency REAL,
				in_bps REAL, out_bps REAL, clients INTEGER,
				PRIMARY KEY(device_id, ts)
			)`,
			`CREATE TABLE IF NOT EXISTS alerts (
				id TEXT PRIMARY KEY, device_id TEXT, severity TEXT, message TEXT, ack BOOLEAN,
				created_at DATETIME
			)`,
			`CREATE INDEX IF NOT EXISTS idx_metrics_ts ON metrics(ts);`,
			`CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);`,
			`CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);`,
		}
	}
	for _, q := range stmts {
		if _, err := s.db.Exec(q); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}
	return nil
}

func (s *Store) ListDevices() ([]model.Device, error) {
	var out []model.Device
	err := s.db.Select(&out, `SELECT * FROM devices ORDER BY hostname`)
	if errors.Is(err, sql.ErrNoRows) {
		return out, nil
	}
	return out, err
}

func (s *Store) GetDevice(id string) (*model.Device, error) {
	var d model.Device
	err := s.db.Get(&d, s.db.Rebind(`SELECT * FROM devices WHERE id = ? OR ip = ?`), id, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &d, err
}

func (s *Store) UpsertDevice(d *model.Device) error {
	now := time.Now().UTC()
	if d.ID == "" {
		d.ID = uuid.NewString()[:8]
	}
	d.UpdatedAt = now
	if d.CreatedAt.IsZero() {
		d.CreatedAt = now
	}
	_, err := s.db.NamedExec(`INSERT INTO devices
		(id, hostname, ip, category, vendor, model, building_id, floor, status, uptime_sec,
		 cpu, mem, temp, latency_ms, loss, traffic_in_mbps, traffic_out_mbps, clients, poe_w,
		 snmp, snmp_community, site, last_seen, notes, auto_discovered, source, created_at, updated_at)
		VALUES (:id, :hostname, :ip, :category, :vendor, :model, :building_id, :floor, :status, :uptime_sec,
		 :cpu, :mem, :temp, :latency_ms, :loss, :traffic_in_mbps, :traffic_out_mbps, :clients, :poe_w,
		 :snmp, :snmp_community, :site, :last_seen, :notes, :auto_discovered, :source, :created_at, :updated_at)
		ON CONFLICT(ip) DO UPDATE SET
		 hostname=excluded.hostname, category=excluded.category, vendor=excluded.vendor, model=excluded.model,
		 building_id=excluded.building_id, floor=excluded.floor, status=excluded.status,
		 uptime_sec=excluded.uptime_sec, cpu=excluded.cpu, mem=excluded.mem, temp=excluded.temp,
		 latency_ms=excluded.latency_ms, loss=excluded.loss,
		 traffic_in_mbps=excluded.traffic_in_mbps, traffic_out_mbps=excluded.traffic_out_mbps,
		 clients=excluded.clients, poe_w=excluded.poe_w, snmp=excluded.snmp,
		 snmp_community=excluded.snmp_community, site=excluded.site,
		 last_seen=excluded.last_seen, notes=excluded.notes,
		 auto_discovered=excluded.auto_discovered, source=excluded.source, updated_at=excluded.updated_at
	`, d)
	return err
}

func (s *Store) DeleteDevice(id string) error {
	_, err := s.db.Exec(s.db.Rebind(`DELETE FROM devices WHERE id = ?`), id)
	return err
}

func (s *Store) BulkUpdateStatus(devices []model.Device) error {
	tx, err := s.db.Beginx()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	stmt, err := tx.Preparex(s.db.Rebind(`UPDATE devices SET status=?, cpu=?, mem=?, temp=?, latency_ms=?, loss=?,
		traffic_in_mbps=?, traffic_out_mbps=?, clients=?, uptime_sec=?, last_seen=?, updated_at=? WHERE id=?`))
	if err != nil {
		return err
	}
	defer stmt.Close()
	now := time.Now().UTC()
	for i := range devices {
		d := &devices[i]
		if _, err := stmt.Exec(d.Status, d.CPU, d.Mem, d.Temp, d.LatencyMs, d.Loss,
			d.TrafficInMbps, d.TrafficOutMbps, d.Clients, d.UptimeSec, now, now, d.ID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) InsertMetric(m *model.MetricPoint) error {
	_, err := s.db.Exec(s.db.Rebind(`INSERT INTO metrics(device_id, ts, cpu, mem, temp, latency, in_bps, out_bps, clients)
		VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(device_id, ts) DO UPDATE SET 
		cpu=EXCLUDED.cpu, mem=EXCLUDED.mem, temp=EXCLUDED.temp, latency=EXCLUDED.latency, in_bps=EXCLUDED.in_bps, out_bps=EXCLUDED.out_bps, clients=EXCLUDED.clients`),
		m.DeviceID, m.Timestamp, m.CPU, m.Mem, m.Temp, m.Latency, m.InBps, m.OutBps, m.Clients)
	return err
}

func (s *Store) ListAlerts(ack *bool, limit int) ([]model.Alert, error) {
	var out []model.Alert
	q := `SELECT * FROM alerts WHERE 1=1`
	var args []any
	if ack != nil {
		q += ` AND ack = ?`
		args = append(args, *ack)
	}
	q += ` ORDER BY created_at DESC LIMIT ?`
	args = append(args, limit)
	err := s.db.Select(&out, s.db.Rebind(q), args...)
	if errors.Is(err, sql.ErrNoRows) {
		return out, nil
	}
	return out, err
}

func (s *Store) CreateAlert(a *model.Alert) error {
	if a.ID == "" {
		a.ID = uuid.NewString()[:10]
	}
	if a.CreatedAt.IsZero() {
		a.CreatedAt = time.Now().UTC()
	}
	_, err := s.db.Exec(s.db.Rebind(`INSERT INTO alerts(id, device_id, severity, message, ack, created_at)
		VALUES(?, ?, ?, ?, ?, ?)`), a.ID, a.DeviceID, a.Severity, a.Message, a.Ack, a.CreatedAt)
	return err
}

func (s *Store) AckAlert(id string, ack bool) error {
	_, err := s.db.Exec(s.db.Rebind(`UPDATE alerts SET ack = ? WHERE id = ?`), ack, id)
	return err
}

func (s *Store) AckAll() error {
	_, err := s.db.Exec(`UPDATE alerts SET ack = true`)
	return err
}
