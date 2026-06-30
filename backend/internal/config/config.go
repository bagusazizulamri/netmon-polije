package config

import (
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server    ServerConfig     `mapstructure:"server"`
	Database  DatabaseConfig   `mapstructure:"database"`
	Poll      PollConfig       `mapstructure:"poll"`
	Log       LogConfig        `mapstructure:"log"`
	SNMP      SNMPConfig       `mapstructure:"snmp"`
	UniFi     UniFiConfig      `mapstructure:"unifi"`
	Scan      ScanConfig       `mapstructure:"scan"`
	Buildings []BuildingConfig `mapstructure:"buildings"`
}

type BuildingConfig struct {
	ID     string `mapstructure:"id" json:"id"`
	Name   string `mapstructure:"name" json:"name"`
	Short  string `mapstructure:"short" json:"short"`
	Subnet string `mapstructure:"subnet" json:"subnet"`
	Vlan   int    `mapstructure:"vlan" json:"vlan"`
}

type ServerConfig struct {
	Host string `mapstructure:"host"`
	Port int    `mapstructure:"port"`
	CORS bool   `mapstructure:"cors"`
}

type DatabaseConfig struct {
	Driver string `mapstructure:"driver"` // sqlite3 or postgres
	DSN    string `mapstructure:"dsn"`
}

type PollConfig struct {
	Interval  time.Duration `mapstructure:"interval"`
	ICMP      bool          `mapstructure:"icmp"`
	Workers   int           `mapstructure:"workers"`
	BulkOIDs  bool          `mapstructure:"bulk_oids"`
}

type LogConfig struct {
	Level  string `mapstructure:"level"`
	Pretty bool   `mapstructure:"pretty"`
}

type SNMPConfig struct {
	Communities []string      `mapstructure:"communities"`
	Port        uint16        `mapstructure:"port"`
	Timeout     time.Duration `mapstructure:"timeout"`
	Retries     int           `mapstructure:"retries"`
	Version     string        `mapstructure:"version"` // v2c / v3
	V3          SNMPv3        `mapstructure:"v3"`
}

type SNMPv3 struct {
	User      string `mapstructure:"user"`
	AuthProto string `mapstructure:"auth_proto"` // MD5/SHA
	AuthPass  string `mapstructure:"auth_pass"`
	PrivProto string `mapstructure:"priv_proto"` // AES/DES
	PrivPass  string `mapstructure:"priv_pass"`
}

type UniFiConfig struct {
	Enabled   bool          `mapstructure:"enabled"`
	URL       string        `mapstructure:"url"`
	User      string        `mapstructure:"user"`
	Pass      string        `mapstructure:"pass"`
	Site      string        `mapstructure:"site"`
	AutoAdopt bool          `mapstructure:"auto_adopt"`
	Interval  time.Duration `mapstructure:"interval"`
	Insecure  bool          `mapstructure:"insecure"`
}

type ScanConfig struct {
	DefaultCIDR string        `mapstructure:"default_cidr"`
	Concurrency int           `mapstructure:"concurrency"`
	PingTimeout time.Duration `mapstructure:"ping_timeout"`
	SNMPTimeout time.Duration `mapstructure:"snmp_timeout"`
	AutoImport  bool          `mapstructure:"auto_import"`
}

// C holds loaded config
var C *Config

func Load(path string) (*Config, error) {
	v := viper.New()
	v.SetConfigFile(path)
	v.SetConfigType("yaml")

	// WSL-friendly defaults (bind 0.0.0.0 so portproxy works)
	v.SetDefault("server.host", "0.0.0.0")
	v.SetDefault("server.port", 8080)
	v.SetDefault("server.cors", true)

	v.SetDefault("database.driver", "sqlite3")
	v.SetDefault("database.dsn", "./data/netmon.db")

	v.SetDefault("poll.interval", "30s")
	v.SetDefault("poll.icmp", true)
	v.SetDefault("poll.workers", 128)
	v.SetDefault("poll.bulk_oids", true)

	v.SetDefault("log.level", "info")
	v.SetDefault("log.pretty", true)

	v.SetDefault("snmp.communities", []string{"publicPolije", "polijeRO", "ruijieRO", "unifiRO", "public"})
	v.SetDefault("snmp.port", 161)
	v.SetDefault("snmp.timeout", "750ms")
	v.SetDefault("snmp.retries", 2)
	v.SetDefault("snmp.version", "v2c")

	v.SetDefault("unifi.enabled", true)
	v.SetDefault("unifi.url", "https://10.10.1.40:8443")
	v.SetDefault("unifi.site", "default")
	v.SetDefault("unifi.interval", "5m")
	v.SetDefault("unifi.insecure", true)
	v.SetDefault("unifi.auto_adopt", true)

	v.SetDefault("scan.default_cidr", "10.10.0.0/22")
	v.SetDefault("scan.concurrency", 256)
	v.SetDefault("scan.ping_timeout", "800ms")
	v.SetDefault("scan.snmp_timeout", "750ms")
	v.SetDefault("scan.auto_import", false)

	v.SetEnvPrefix("NETMON")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	if err := v.ReadInConfig(); err != nil {
		// allow no config file; defaults apply
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}
	cfg := &Config{}
	if err := v.Unmarshal(cfg); err != nil {
		return nil, err
	}
	if len(cfg.Buildings) == 0 {
		cfg.Buildings = []BuildingConfig{
			{ID: "rektorat", Name: "Gedung Utama / Rektorat", Short: "REKT", Subnet: "10.10.0.0/24", Vlan: 10},
			{ID: "tip", Name: "Jurusan Teknologi Informasi", Short: "TIP", Subnet: "10.10.10.0/24", Vlan: 110},
			{ID: "tik", Name: "TIK / Data Center", Short: "TIK", Subnet: "10.10.1.0/24", Vlan: 1},
			{ID: "mif", Name: "Gedung MIF", Short: "MIF", Subnet: "10.10.12.0/24", Vlan: 112},
			{ID: "mesin", Name: "Teknik Mesin", Short: "MSN", Subnet: "10.10.20.0/24", Vlan: 120},
			{ID: "tep", Name: "Teknologi Pertanian", Short: "TEP", Subnet: "10.10.30.0/24", Vlan: 130},
			{ID: "pet", Name: "Peternakan", Short: "PET", Subnet: "10.10.40.0/24", Vlan: 140},
			{ID: "labterpadu", Name: "Lab Terpadu", Short: "LAB", Subnet: "10.10.50.0/24", Vlan: 150},
			{ID: "perpustakaan", Name: "Perpustakaan", Short: "PUS", Subnet: "10.10.60.0/24", Vlan: 160},
			{ID: "aula", Name: "Aula Soetrisno", Short: "AULA", Subnet: "10.10.61.0/24", Vlan: 161},
			{ID: "gor", Name: "GOR Perjuangan 45", Short: "GOR", Subnet: "10.10.62.0/24", Vlan: 162},
			{ID: "asrama", Name: "Asrama Mahasiswa", Short: "ASR", Subnet: "10.10.70.0/24", Vlan: 170},
			{ID: "kantin", Name: "Kantin Pusat", Short: "KTN", Subnet: "10.10.71.0/24", Vlan: 171},
			{ID: "greenhouse", Name: "Green House / Lab Lapang", Short: "GH", Subnet: "10.10.80.0/24", Vlan: 180},
		}
	}
	C = cfg
	return cfg, nil
}
