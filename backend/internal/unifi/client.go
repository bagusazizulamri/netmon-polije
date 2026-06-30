package unifi

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/polije/netmon/internal/config"
	"github.com/polije/netmon/internal/model"
	"github.com/polije/netmon/internal/store"
	"go.uber.org/zap"
)

// Client talks to UniFi Network Controller (UniFi OS or legacy)
type Client struct {
	cfg    *config.UniFiConfig
	log    *zap.Logger
	s      *store.Store
	hc     *http.Client
	mu     sync.Mutex
	cookies []*http.Cookie
}

func New(cfg *config.UniFiConfig, s *store.Store, log *zap.Logger) *Client {
	jar, _ := cookiejar.New(nil)
	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: cfg.Insecure},
	}
	return &Client{
		cfg: cfg,
		log: log,
		s:   s,
		hc:  &http.Client{Timeout: 15 * time.Second, Jar: jar, Transport: tr},
	}
}

// Run blocks, runs sync on interval
func (c *Client) Run(ctx context.Context) error {
	if !c.cfg.Enabled {
		c.log.Info("unifi autosync disabled")
		<-ctx.Done()
		return nil
	}
	c.log.Info("unifi autosync started", zap.Duration("interval", c.cfg.Interval), zap.String("url", c.cfg.URL))
	if err := c.login(ctx); err != nil {
		c.log.Warn("unifi initial login failed, will retry", zap.Error(err))
	}
	if err := c.Sync(ctx); err != nil {
		c.log.Warn("initial unifi sync failed", zap.Error(err))
	}
	t := time.NewTicker(c.cfg.Interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-t.C:
			if err := c.Sync(ctx); err != nil {
				c.log.Warn("unifi sync failed, re-login", zap.Error(err))
				_ = c.login(ctx)
				_ = c.Sync(ctx)
			}
		}
	}
}

func (c *Client) login(ctx context.Context) error {
	body := map[string]string{"username": c.cfg.User, "password": c.cfg.Pass}
	// UniFi OS uses /api/auth/login, legacy uses /api/login
	endpoints := []string{
		c.cfg.URL + "/api/auth/login",
		c.cfg.URL + "/api/login",
	}
	for _, ep := range endpoints {
		if err := ctx.Err(); err != nil {
			return err
		}
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, ep, jsonReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")
		resp, err := c.hc.Do(req)
		if err != nil {
			continue
		}
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
		if resp.StatusCode < 300 {
			c.log.Debug("unifi login ok", zap.String("endpoint", ep))
			return nil
		}
	}
	return fmt.Errorf("unifi login failed on all endpoints")
}

func (c *Client) Sync(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Try UniFi OS API first, fallback to legacy
	devs, err := c.fetchDevices(ctx, "/proxy/network/api/s/"+c.cfg.Site+"/stat/device")
	if err != nil {
		devs, err = c.fetchDevices(ctx, "/api/s/"+c.cfg.Site+"/stat/device")
		if err != nil {
			return err
		}
	}
	c.log.Info("unifi synced devices", zap.Int("n", len(devs)))
	for _, ud := range devs {
		cat := model.CatAP
		if strings.Contains(ud.Model, "USW") || strings.Contains(strings.ToLower(ud.Model), "switch") {
			cat = model.CatSwitch
		}
		status := model.StatusOnline
		if ud.State == 0 {
			status = model.StatusOffline
		}
		if !ud.Adopted {
			if c.cfg.AutoAdopt {
				_ = c.adopt(ctx, ud.MAC)
			}
			continue
		}
		hostname := ud.Name
		if hostname == "" {
			hostname = ud.Hostname
		}
		if hostname == "" {
			hostname = "uf-" + lastOctet(ud.IP)
		}
		d := &model.Device{
			Hostname: hostname, IP: ud.IP, Category: cat, Vendor: "UniFi", Model: ud.Model,
			Status: status, CPU: ud.CPU, Mem: ud.Mem, Temp: ud.Temp, Clients: ud.NumSta,
			UptimeSec:            int64(ud.Uptime),
			TrafficInMbps:        float64(ud.RxBytes) / 125000,
			TrafficOutMbps:       float64(ud.TxBytes) / 125000,
			LatencyMs:            1.5,
			Site:                 "main",
			Source:               "unifi",
			SNMP:                 false,
		}
		if err := c.s.UpsertDevice(d); err != nil {
			c.log.Warn("upsert unifi device", zap.Error(err), zap.String("ip", ud.IP))
		}
	}
	return nil
}

func (c *Client) fetchDevices(ctx context.Context, path string) ([]udev, error) {
	u, _ := url.Parse(c.cfg.URL + path)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	req.Header.Set("Accept", "application/json")
	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(b))
	}
	var wrapped struct {
		Meta struct {
			Rc string `json:"rc"`
		} `json:"meta"`
		Data []udev `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&wrapped); err != nil {
		return nil, err
	}
	return wrapped.Data, nil
}

func (c *Client) adopt(ctx context.Context, mac string) error {
	body := map[string]string{"mac": mac}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost,
		c.cfg.URL+"/api/s/"+c.cfg.Site+"/cmd/devmgr", jsonReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.hc.Do(req)
	if err != nil {
		return err
	}
	io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
	c.log.Info("adopting unifi device", zap.String("mac", mac))
	return nil
}

func jsonReader(v any) io.Reader {
	b, _ := json.Marshal(v)
	return strings.NewReader(string(b))
}

func lastOctet(ip string) string {
	parts := strings.Split(ip, ".")
	if len(parts) == 4 {
		return parts[3]
	}
	return "0"
}

// udev is a minimal UniFi API device struct
type udev struct {
	ID       string `json:"_id"`
	MAC      string `json:"mac"`
	IP       string `json:"ip"`
	Model    string `json:"model"`
	Type     string `json:"type"`
	Version  string `json:"version"`
	Name     string `json:"name"`
	Hostname string `json:"hostname"`
	Adopted  bool   `json:"adopted"`
	State    int    `json:"state"`
	Uptime   int    `json:"uptime"`
	CPU      float64 `json:"cpu"`
	Mem      float64 `json:"mem"`
	MemTotal int64  `json:"mem_total"`
	Temp     float64 `json:"temperature"`
	NumSta   int    `json:"num_sta"`
	RxBytes  int64  `json:"rx_bytes"`
	TxBytes  int64  `json:"tx_bytes"`
}

