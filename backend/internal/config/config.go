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
	X      int    `mapstructure:"x" json:"x"`
	Y      int    `mapstructure:"y" json:"y"`
	W      int    `mapstructure:"w" json:"w"`
	H      int    `mapstructure:"h" json:"h"`
	Subnet string `mapstructure:"subnet" json:"subnet"`
	Vlan   int    `mapstructure:"vlan" json:"vlan"`
	Color  string `mapstructure:"color" json:"color"`
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
	v.SetDefault("server.port", 9090)
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
			{ID: "rektorat", Name: "Gedung Utama / Rektorat", Short: "REKT", X: 500, Y: 120, W: 210, H: 78, Subnet: "10.10.0.0/24", Vlan: 10, Color: "#eaf1ff"},
			{ID: "tip", Name: "Jurusan Teknologi Informasi", Short: "TIP", X: 260, Y: 210, W: 190, H: 74, Subnet: "10.10.10.0/24", Vlan: 110, Color: "#eefbf3"},
			{ID: "tik", Name: "TIK / Data Center", Short: "TIK", X: 498, Y: 238, W: 210, H: 66, Subnet: "10.10.1.0/24", Vlan: 1, Color: "#fff6e9"},
			{ID: "mif", Name: "Gedung MIF", Short: "MIF", X: 736, Y: 208, W: 170, H: 68, Subnet: "10.10.12.0/24", Vlan: 112, Color: "#f1f5ff"},
			{ID: "mesin", Name: "Teknik Mesin", Short: "MSN", X: 120, Y: 312, W: 164, H: 62, Subnet: "10.10.20.0/24", Vlan: 120, Color: "#f9f2ff"},
			{ID: "tep", Name: "Teknologi Pertanian", Short: "TEP", X: 315, Y: 318, W: 168, H: 60, Subnet: "10.10.30.0/24", Vlan: 130, Color: "#f2fff5"},
			{ID: "pet", Name: "Peternakan", Short: "PET", X: 514, Y: 334, W: 156, H: 58, Subnet: "10.10.40.0/24", Vlan: 140, Color: "#fff7f2"},
			{ID: "labterpadu", Name: "Lab Terpadu", Short: "LAB", X: 704, Y: 312, W: 190, H: 60, Subnet: "10.10.50.0/24", Vlan: 150, Color: "#f5fbff"},
			{ID: "perpustakaan", Name: "Perpustakaan", Short: "PUS", X: 208, Y: 418, W: 170, H: 56, Subnet: "10.10.60.0/24", Vlan: 160, Color: "#f7f7ff"},
			{ID: "aula", Name: "Aula Soetrisno", Short: "AULA", X: 410, Y: 424, W: 174, H: 54, Subnet: "10.10.61.0/24", Vlan: 161, Color: "#fffaf0"},
			{ID: "gor", Name: "GOR Perjuangan 45", Short: "GOR", X: 620, Y: 419, W: 214, H: 58, Subnet: "10.10.62.0/24", Vlan: 162, Color: "#f2fbff"},
			{ID: "asrama", Name: "Asrama Mahasiswa", Short: "ASR", X: 156, Y: 512, W: 198, H: 52, Subnet: "10.10.70.0/24", Vlan: 170, Color: "#fef6ff"},
			{ID: "kantin", Name: "Kantin Pusat", Short: "KTN", X: 402, Y: 514, W: 154, H: 50, Subnet: "10.10.71.0/24", Vlan: 171, Color: "#f8fff3"},
			{ID: "greenhouse", Name: "Green House / Lab Lapang", Short: "GH", X: 634, Y: 508, W: 216, H: 52, Subnet: "10.10.80.0/24", Vlan: 180, Color: "#f1fff9"},
		}
	}
	C = cfg
	return cfg, nil
}
