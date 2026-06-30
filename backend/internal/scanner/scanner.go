package scanner

import (
	"context"
	"encoding/binary"
	"fmt"
	"net"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gosnmp/gosnmp"
	"github.com/polije/netmon/internal/config"
	"github.com/polije/netmon/internal/model"
	"github.com/polije/netmon/internal/store"
	"go.uber.org/zap"
)

type Scanner struct {
	cfg *config.Config
	s   *store.Store
	log *zap.Logger
}

func New(cfg *config.Config, s *store.Store, log *zap.Logger) *Scanner {
	return &Scanner{cfg: cfg, s: s, log: log}
}

// Scan performs ICMP/TCP ping sweep + SNMP sysDescr walk over CIDR, returns discovered hosts.
func (sc *Scanner) Scan(ctx context.Context, cidr string, communities []string) ([]model.ScanResult, error) {
	_, ipNet, err := net.ParseCIDR(cidr)
	if err != nil {
		return nil, fmt.Errorf("parse cidr %w", err)
	}
	ips := expandIPs(ipNet)
	sc.log.Info("starting scan", zap.String("cidr", cidr), zap.Int("hosts", len(ips)), zap.Int("workers", sc.cfg.Scan.Concurrency))

	var (
		mu    sync.Mutex
		found []model.ScanResult
		wg    sync.WaitGroup
		sem   = make(chan struct{}, sc.cfg.Scan.Concurrency)
	)
	for _, ip := range ips {
		if ctx.Err() != nil {
			break
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(ip string) {
			defer wg.Done()
			defer func() { <-sem }()
			lat, ok := sc.probeIP(ip)
			if !ok {
				return
			}
			res := model.ScanResult{IP: ip, LatencyMs: lat, CIDR: cidr}
			// try SNMP communities
			for _, comm := range communities {
				desc, name, vendor, modelName, err := sc.snmpSysinfo(ip, comm)
				if err != nil {
					continue
				}
				res.SysDescr = desc
				res.Hostname = name
				res.Community = comm
				res.Vendor = guessVendor(desc, vendor)
				res.Model = modelName
				break
			}
			// port probe common device ports
			for _, p := range []int{22, 80, 443, 161, 8080, 8443, 8291, 23} {
				if probePort(ip, p, 500*time.Millisecond) {
					res.OpenPorts = append(res.OpenPorts, p)
				}
			}
			mu.Lock()
			found = append(found, res)
			mu.Unlock()
		}(ip)
	}
	wg.Wait()
	return found, nil
}

func (sc *Scanner) probeIP(ip string) (float64, bool) {
	// 1. TCP ping to common ports (excluding 161 because SNMP uses UDP)
	ports := []int{22, 80, 443, 8291, 8443, 23, 8080}
	var best time.Duration = 9999 * time.Second
	for _, p := range ports {
		start := time.Now()
		conn, err := net.DialTimeout("tcp", net.JoinHostPort(ip, strconv.Itoa(p)), sc.cfg.Scan.PingTimeout)
		if err == nil {
			d := time.Since(start)
			if d < best {
				best = d
			}
			conn.Close()
		}
	}
	if best != 9999*time.Second {
		return float64(best.Microseconds()) / 1000.0, true
	}

	// 2. Fallback: Quick SNMP UDP check (essential for SNMP-only devices)
	start := time.Now()
	g := &gosnmp.GoSNMP{
		Target:    ip,
		Port:      161,
		Community: "public",
		Version:   gosnmp.Version2c,
		Timeout:   200 * time.Millisecond,
		Retries:   0,
	}
	if err := g.Connect(); err == nil {
		_, err = g.Get([]string{".1.3.6.1.2.1.1.2.0"})
		g.Conn.Close()
		if err == nil {
			return float64(time.Since(start).Microseconds()) / 1000.0, true
		}
	}

	// 3. Fallback: System ping utility (runs with raw privilege because NetMon runs under sudo)
	start = time.Now()
	cmd := exec.Command("ping", "-c", "1", "-W", "1", ip)
	if err := cmd.Run(); err == nil {
		return float64(time.Since(start).Milliseconds()), true
	}

	return 0, false
}

func probePort(ip string, p int, to time.Duration) bool {
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(ip, strconv.Itoa(p)), to)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

func (sc *Scanner) snmpSysinfo(ip, community string) (descr, name, vendor, modelName string, err error) {
	g := &gosnmp.GoSNMP{
		Target:    ip,
		Port:      161,
		Community: community,
		Version:   gosnmp.Version2c,
		Timeout:   sc.cfg.Scan.SNMPTimeout,
		Retries:   1,
	}
	if err := g.Connect(); err != nil {
		return "", "", "", "", err
	}
	defer g.Conn.Close()
	oids := []string{".1.3.6.1.2.1.1.1.0", ".1.3.6.1.2.1.1.5.0", ".1.3.6.1.2.1.1.2.0"}
	res, err := g.Get(oids)
	if err != nil {
		return "", "", "", "", err
	}
	for _, v := range res.Variables {
		s := snmpStr(v.Value)
		switch v.Name {
		case ".1.3.6.1.2.1.1.1.0":
			descr = s
		case ".1.3.6.1.2.1.1.5.0":
			name = s
		case ".1.3.6.1.2.1.1.2.0":
			vendor = s
		}
	}
	modelName = guessModel(descr)
	return
}

// Import commits discovered devices into the store
func (sc *Scanner) Import(ctx context.Context, r model.ScanResult) error {
	cat := guessCategory(r.Vendor, r.OpenPorts)
	d := &model.Device{
		Hostname: firstNonEmpty(r.Hostname, "sw-"+strings.ReplaceAll(r.IP, ".", "-")),
		IP: r.IP, Category: cat, Vendor: r.Vendor, Model: r.Model,
		Status: model.StatusOnline, SNMP: r.Community != "",
		SNMPCommunity: r.Community, Site: "main", Source: "snmp",
		AutoDiscovered: true,
	}
	return sc.s.UpsertDevice(d)
}

func expandIPs(n *net.IPNet) []string {
	var out []string
	mask := binary.BigEndian.Uint32(n.Mask)
	first := binary.BigEndian.Uint32(n.IP) & mask
	last := first | ^mask
	for a := first + 1; a < last; a++ {
		ip := make(net.IP, 4)
		binary.BigEndian.PutUint32(ip, a)
		out = append(out, ip.String())
	}
	if len(out) > 8192 {
		return out[:8192]
	}
	return out
}

func snmpStr(v any) string {
	switch val := v.(type) {
	case string:
		return strings.TrimSpace(val)
	case []byte:
		return strings.TrimSpace(string(val))
	default:
		return fmt.Sprintf("%v", val)
	}
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

func guessVendor(descr, oid string) string {
	d := strings.ToLower(descr) + " " + strings.ToLower(oid)
	switch {
	case strings.Contains(d, "mikrotik"):
		return "MikroTik"
	case strings.Contains(d, "aruba"):
		return "Aruba"
	case strings.Contains(d, "ruijie"):
		return "Ruijie"
	case strings.Contains(d, "unifi") || strings.Contains(d, "ubnt") || strings.Contains(d, "ui, inc"):
		return "UniFi"
	case strings.Contains(d, "juniper"):
		return "Juniper"
	case strings.Contains(d, "cisco"):
		return "Cisco"
	case strings.Contains(d, "linux"):
		return "Linux"
	}
	return "Unknown"
}

func guessModel(descr string) string {
	d := strings.ToLower(descr)
	for _, m := range []string{
		"CCR2116", "CCR2004", "RB5009", "CX 6300M", "2930F", "2530",
		"AP-515", "AP-505", "AP-577", "RG-S5750", "RG-S2910", "RG-RAP2260",
		"USW-Pro", "USW-", "U6-Pro", "U7-Pro", "U6-LR", "U6-Mesh", "U6-Enterprise",
		"EX4300", "EX2300",
	} {
		if strings.Contains(d, strings.ToLower(m)) {
			return m
		}
	}
	// first 32 chars of descr
	if len(descr) > 40 {
		return descr[:40]
	}
	return descr
}

func guessCategory(vendor string, ports []int) model.Category {
	hasAP := func() bool {
		for _, p := range ports {
			if p == 8443 || p == 8080 {
				return true
			}
		}
		return false
	}
	switch vendor {
	case "MikroTik":
		return model.CatRouter
	case "Aruba", "Ruijie", "Juniper":
		if hasAP() {
			return model.CatAP
		}
		return model.CatSwitch
	case "UniFi":
		if hasAP() {
			return model.CatAP
		}
		return model.CatSwitch
	default:
		if hasAP() {
			return model.CatAP
		}
		return model.CatSwitch
	}
}
