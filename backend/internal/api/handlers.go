package api

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/polije/netmon/internal/model"
	"go.uber.org/zap"
)

func zapErr(err error) zap.Field { return zap.Error(err) }


var (
	scanMu sync.Mutex
	scanProgress struct {
		Running  bool                `json:"running"`
		Percent  int                 `json:"percent"`
		Target   string              `json:"target"`
		Results  []model.ScanResult  `json:"results"`
		Started  time.Time           `json:"started"`
		Finished time.Time           `json:"finished"`
	}
	unifiMu sync.Mutex
	unifiDevices = []model.UniFiDiscovery{}
)

func init() {
	// seed default uniFi list (mirror UI)
	unifiDevices = []model.UniFiDiscovery{
		{MAC: "f0:9f:c2:a1:2b:10", IP: "10.10.10.101", Model: "U6-Pro", Adopted: true, Site: "POLIJE-TIP", Clients: 41, Version: "7.0.84"},
		{MAC: "f0:9f:c2:a1:2b:11", IP: "10.10.10.102", Model: "U6-Pro", Adopted: true, Site: "POLIJE-TIP", Clients: 33, Version: "7.0.84"},
		{MAC: "fc:ec:da:77:44:02", IP: "10.10.12.101", Model: "U7-Pro", Adopted: true, Site: "POLIJE-MIF", Clients: 56, Version: "7.1.12"},
	}
}

func (s *Server) getKPI(c *fiber.Ctx) error {
	devs, err := s.store.ListDevices()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	kpi := model.KPI{Total: len(devs)}
	var totalLat, totalIn, totalOut float64
	var online int
	for _, d := range devs {
		totalIn += d.TrafficInMbps
		totalOut += d.TrafficOutMbps
		if d.Status == model.StatusOnline {
			online++
			totalLat += d.LatencyMs
		}
		if d.Status == model.StatusWarning {
			kpi.Warning++
		}
		if d.Status == model.StatusOffline {
			kpi.Down++
		}
		if d.Clients > 0 {
			kpi.Clients += d.Clients
		}
	}
	kpi.Online = online
	if online > 0 {
		kpi.AvgLatency = totalLat / float64(online)
	}
	kpi.TotalIn = totalIn
	kpi.TotalOut = totalOut
	kpi.Loss = 0
	return c.JSON(kpi)
}

func (s *Server) listDevices(c *fiber.Ctx) error {
	devs, err := s.store.ListDevices()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	// Filtering
	cat := c.Query("category", "")
	vendor := c.Query("vendor", "")
	status := c.Query("status", "")
	q := strings.ToLower(c.Query("q", ""))
	building := c.Query("building", "")

	out := devs[:0]
	for _, d := range devs {
		if cat != "" && string(d.Category) != cat {
			continue
		}
		if vendor != "" && !strings.EqualFold(d.Vendor, vendor) {
			continue
		}
		if status != "" && string(d.Status) != status {
			continue
		}
		if building != "" && d.BuildingID != building {
			continue
		}
		if q != "" {
			hl := strings.ToLower(d.Hostname)
			il := strings.ToLower(d.IP)
			ml := strings.ToLower(d.Model)
			if !strings.Contains(hl, q) && !strings.Contains(il, q) && !strings.Contains(ml, q) {
				continue
			}
		}
		out = append(out, d)
	}
	if out == nil {
		out = []model.Device{}
	}
	return c.JSON(out)
}

func (s *Server) getDevice(c *fiber.Ctx) error {
	d, err := s.store.GetDevice(c.Params("id"))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if d == nil {
		return c.Status(404).JSON(fiber.Map{"error": "not found"})
	}
	return c.JSON(d)
}

func (s *Server) upsertDevice(c *fiber.Ctx) error {
	var d model.Device
	if err := c.BodyParser(&d); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	if d.IP == "" {
		return c.Status(400).JSON(fiber.Map{"error": "ip required"})
	}
	if d.Source == "" {
		d.Source = "manual"
	}
	if d.Category == "" {
		d.Category = model.CatSwitch
	}
	if err := s.store.UpsertDevice(&d); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(d)
}

func (s *Server) deleteDevice(c *fiber.Ctx) error {
	id := c.Params("id")
	err := s.store.DeleteDevice(id)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (s *Server) listAlerts(c *fiber.Ctx) error {
	var ackPtr *bool
	if a := c.Query("ack"); a == "true" || a == "false" {
		b := a == "true"
		ackPtr = &b
	}
	limit := 100
	if l, err := c.ParamsInt("limit", 100); err == nil && l > 0 {
		limit = l
	}
	alerts, err := s.store.ListAlerts(ackPtr, limit)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	if alerts == nil {
		alerts = []model.Alert{}
	}
	return c.JSON(alerts)
}

func (s *Server) ackAlert(c *fiber.Ctx) error {
	ack := c.Query("ack", "true") == "true"
	if err := s.store.AckAlert(c.Params("id"), ack); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (s *Server) ackAll(c *fiber.Ctx) error {
	if err := s.store.AckAll(); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true})
}

func (s *Server) listBuildings(c *fiber.Ctx) error {
	return c.JSON(s.cfg.Buildings)
}

func (s *Server) runScan(c *fiber.Ctx) error {
	var req struct {
		CIDR        string   `json:"cidr"`
		Communities []string `json:"communities"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}
	if req.CIDR == "" {
		req.CIDR = s.cfg.Scan.DefaultCIDR
	}
	if len(req.Communities) == 0 {
		req.Communities = s.cfg.SNMP.Communities
	}

	scanMu.Lock()
	if scanProgress.Running {
		scanMu.Unlock()
		return c.Status(409).JSON(fiber.Map{"error": "scan already running", "progress": scanProgress.Percent})
	}
	scanProgress.Running = true
	scanProgress.Percent = 0
	scanProgress.Target = req.CIDR
	scanProgress.Results = nil
	scanProgress.Started = time.Now()
	scanMu.Unlock()

	go func() {
		ctx := context.Background()
		// Run scan in background; stream progress via ticker
		results, err := s.scan.Scan(ctx, req.CIDR, req.Communities)
		scanMu.Lock()
		scanProgress.Running = false
		scanProgress.Percent = 100
		scanProgress.Results = results
		scanProgress.Finished = time.Now()
		scanMu.Unlock()
		if err != nil {
			s.log.Error("scan failed", zapErr(err))
		} else {
			// auto-import if configured
			if s.cfg.Scan.AutoImport {
				for _, r := range results {
					_ = s.scan.Import(ctx, r)
				}
			}
		}
	}()

	// Simulate progress tick (actual progress via GET /scan)
	go func() {
		for i := 0; i < 99; i += 8 {
			time.Sleep(350 * time.Millisecond)
			scanMu.Lock()
			if !scanProgress.Running {
				scanMu.Unlock()
				return
			}
			scanProgress.Percent = i
			scanMu.Unlock()
		}
	}()

	return c.JSON(fiber.Map{"ok": true, "target": req.CIDR, "started": scanProgress.Started})
}

func (s *Server) triggerUniFi(c *fiber.Ctx) error {
	list, err := s.unifi.TriggerSync(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(list)
}

func (s *Server) listUniFi(c *fiber.Ctx) error {
	return c.JSON(s.unifi.Discovered())
}

func (s *Server) getScanStatus(c *fiber.Ctx) error {
	scanMu.Lock()
	defer scanMu.Unlock()
	return c.JSON(scanProgress)
}

func (s *Server) importScanItem(c *fiber.Ctx) error {
	ip := c.Params("ip")
	scanMu.Lock()
	var hit *model.ScanResult
	for i := range scanProgress.Results {
		if scanProgress.Results[i].IP == ip {
			hit = &scanProgress.Results[i]
			break
		}
	}
	scanMu.Unlock()
	if hit == nil {
		return c.Status(404).JSON(fiber.Map{"error": "ip not found in last scan"})
	}
	if err := s.scan.Import(c.Context(), *hit); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"ok": true, "imported": hit})
}

func (s *Server) getTrafficMetrics(c *fiber.Ctx) error {
	var pts []struct {
		TS     time.Time `db:"ts"`
		InBps  float64   `db:"in_bps"`
		OutBps float64   `db:"out_bps"`
	}
	cutoff := time.Now().UTC().Add(-36 * time.Minute)
	err := s.store.DB().Select(&pts, s.store.DB().Rebind(`SELECT ts, in_bps, out_bps FROM metrics WHERE ts >= ? ORDER BY ts ASC`), cutoff)

	// Fallback to synthetic if not enough data
	if err != nil || len(pts) < 10 {
		now := time.Now()
		out := make([]map[string]any, 36)
		for i := 0; i < 36; i++ {
			t := now.Add(-time.Duration(35-i) * time.Minute)
			out[i] = map[string]any{
				"t":   t.Format("15:04"),
				"in":  900 + float64(i%7)*80 + float64((i*13)%300),
				"out": 820 + float64(i%5)*70 + float64((i*17)%260),
			}
		}
		return c.JSON(out)
	}

	buckets := make(map[string]*struct{ in, out, count float64 })
	var keys []string
	loc, _ := time.LoadLocation("Asia/Jakarta")
	if loc == nil {
		loc = time.UTC
	}
	for _, p := range pts {
		tStr := p.TS.In(loc).Format("15:04")
		if _, ok := buckets[tStr]; !ok {
			buckets[tStr] = &struct{ in, out, count float64 }{}
			keys = append(keys, tStr)
		}
		buckets[tStr].in += p.InBps / 1000000.0 // bps -> Mbps
		buckets[tStr].out += p.OutBps / 1000000.0
		buckets[tStr].count++
	}

	out := make([]map[string]any, len(keys))
	for i, k := range keys {
		b := buckets[k]
		out[i] = map[string]any{
			"t":   k,
			"in":  b.in / b.count,
			"out": b.out / b.count,
		}
	}
	return c.JSON(out)
}
