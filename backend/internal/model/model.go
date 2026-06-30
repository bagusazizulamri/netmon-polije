package model

import "time"

type Status string

const (
	StatusOnline      Status = "online"
	StatusWarning     Status = "warning"
	StatusOffline     Status = "offline"
	StatusMaintenance Status = "maintenance"
)

type Category string

const (
	CatServer Category = "server"
	CatRouter Category = "router"
	CatSwitch Category = "switch"
	CatAP     Category = "ap"
)

type Device struct {
	ID             string    `db:"id" json:"id"`
	Hostname       string    `db:"hostname" json:"hostname"`
	IP             string    `db:"ip" json:"ip"`
	Category       Category  `db:"category" json:"category"`
	Vendor         string    `db:"vendor" json:"vendor"`
	Model          string    `db:"model" json:"model"`
	BuildingID     string    `db:"building_id" json:"buildingId"`
	Floor          string    `db:"floor" json:"floor"`
	Status         Status    `db:"status" json:"status"`
	UptimeSec      int64     `db:"uptime_sec" json:"uptimeSec"`
	CPU            float64   `db:"cpu" json:"cpu"`
	Mem            float64   `db:"mem" json:"mem"`
	Temp           float64   `db:"temp" json:"temp"`
	LatencyMs      float64   `db:"latency_ms" json:"latencyMs"`
	Loss           float64   `db:"loss" json:"loss"`
	TrafficInMbps  float64   `db:"traffic_in_mbps" json:"trafficInMbps"`
	TrafficOutMbps float64   `db:"traffic_out_mbps" json:"trafficOutMbps"`
	Clients        int       `db:"clients" json:"clients"`
	PoEW           float64   `db:"poe_w" json:"poeW"`
	SNMP           bool      `db:"snmp" json:"snmp"`
	SNMPCommunity  string    `db:"snmp_community" json:"snmpCommunity"`
	Site           string    `db:"site" json:"site"`
	LastSeen       time.Time `db:"last_seen" json:"lastSeen"`
	Notes          string    `db:"notes" json:"notes"`
	AutoDiscovered bool      `db:"auto_discovered" json:"autoDiscovered"`
	Source         string    `db:"source" json:"source"` // manual/snmp/unifi
	CreatedAt      time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time `db:"updated_at" json:"updatedAt"`
}

type Alert struct {
	ID        string    `db:"id" json:"id"`
	DeviceID  string    `db:"device_id" json:"deviceId"`
	Severity  string    `db:"severity" json:"sev"`
	Message   string    `db:"message" json:"message"`
	Ack       bool      `db:"ack" json:"ack"`
	CreatedAt time.Time `db:"created_at" json:"time"`
}

type MetricPoint struct {
	DeviceID  string    `db:"device_id" json:"deviceId"`
	Timestamp time.Time `db:"ts" json:"ts"`
	CPU       float64   `db:"cpu" json:"cpu"`
	Mem       float64   `db:"mem" json:"mem"`
	Temp      float64   `db:"temp" json:"temp"`
	Latency   float64   `db:"latency" json:"latency"`
	InBps     float64   `db:"in_bps" json:"inBps"`
	OutBps    float64   `db:"out_bps" json:"outBps"`
	Clients   int       `db:"clients" json:"clients"`
}

type UniFiDevice struct {
	MAC      string `json:"mac"`
	IP       string `json:"ip"`
	Model    string `json:"model"`
	Adopted  bool   `json:"adopted"`
	Site     string `json:"site"`
	Clients  int    `json:"clients"`
	Version  string `json:"version"`
	Hostname string `json:"hostname"`
}

type ScanResult struct {
	IP        string   `json:"ip"`
	Hostname  string   `json:"hostname"`
	Vendor    string   `json:"vendor"`
	Model     string   `json:"model"`
	SysDescr  string   `json:"sysDescr"`
	Community string   `json:"community"`
	OpenPorts []int    `json:"openPorts"`
	LatencyMs float64  `json:"latencyMs"`
	CIDR      string   `json:"cidr"`
}

type KPI struct {
	Total      int     `json:"total"`
	Online     int     `json:"online"`
	Warning    int     `json:"warning"`
	Down       int     `json:"down"`
	AvgLatency float64 `json:"avgLat"`
	Loss       float64 `json:"loss"`
	TotalIn    float64 `json:"tIn"`
	TotalOut   float64 `json:"tOut"`
	Clients    int     `json:"clients"`
}

type UniFiDiscovery struct {
	MAC      string `json:"mac"`
	IP       string `json:"ip"`
	Model    string `json:"model"`
	Adopted  bool   `json:"adopted"`
	Site     string `json:"site"`
	Clients  int    `json:"clients"`
	Version  string `json:"version"`
	Hostname string `json:"hostname,omitempty"`
}
