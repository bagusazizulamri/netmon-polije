package api

import (
	"context"
	"embed"
	"io/fs"
	"net/http"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/polije/netmon/internal/config"
	"github.com/polije/netmon/internal/scanner"
	"github.com/polije/netmon/internal/store"
	"github.com/polije/netmon/internal/unifi"
	"go.uber.org/zap"
)

// Server is the HTTP API
type Server struct {
	cfg    *config.Config
	app    *fiber.App
	store  *store.Store
	scan   *scanner.Scanner
	unifi  *unifi.Client
	log    *zap.Logger
}

func New(cfg *config.Config, s *store.Store, scan *scanner.Scanner, uc *unifi.Client, log *zap.Logger, staticFS embed.FS) *Server {
	app := fiber.New(fiber.Config{
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
		AppName:      "netmon-polije",
	})
	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format:     "${status} ${method} ${path} ${latency}\n",
		TimeFormat: "15:04:05",
	}))
	if cfg.Server.CORS {
		app.Use(cors.New(cors.Config{
			AllowOrigins: "*",
			AllowHeaders: "Content-Type, Authorization",
			AllowMethods: "GET,POST,PUT,DELETE,PATCH,OPTIONS",
		}))
	}

	srv := &Server{cfg: cfg, app: app, store: s, scan: scan, unifi: uc, log: log}
	srv.register(staticFS)
	return srv
}

func (s *Server) register(staticFS embed.FS) {
	api := s.app.Group("/api")
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "ts": time.Now().UTC(), "campus": "Politeknik Negeri Jember"})
	})

	// KPI
	api.Get("/kpi", s.getKPI)
	// Devices
	api.Get("/devices", s.listDevices)
	api.Get("/devices/:id", s.getDevice)
	api.Post("/devices", s.upsertDevice)
	api.Delete("/devices/:id", s.deleteDevice)

	// Alerts
	api.Get("/alerts", s.listAlerts)
	api.Post("/alerts/:id/ack", s.ackAlert)
	api.Post("/alerts/ack-all", s.ackAll)

	// Buildings (for map)
	api.Get("/buildings", s.listBuildings)

	// Scan
	api.Post("/scan", s.runScan)
	api.Get("/scan", s.getScanStatus)
	api.Post("/scan/:ip/import", s.importScanItem)

	// UniFi
	api.Post("/unifi/sync", s.triggerUniFi)
	api.Get("/unifi/devices", s.listUniFi)

	// Metrics for chart
	api.Get("/metrics/traffic", s.getTrafficMetrics)

	// Serve embedded landing page (from //go:embed dist)
	if _, err := staticFS.Open("dist/index.html"); err == nil {
		if sub, err := fs.Sub(staticFS, "dist"); err == nil {
			s.app.Get("/", func(c *fiber.Ctx) error {
				f, err := sub.Open("index.html")
				if err != nil {
					return c.Status(404).SendString("not found")
				}
				defer f.Close()
				c.Set("Content-Type", "text/html; charset=utf-8")
				return c.SendStream(f)
			})
		}
	}
}

func (s *Server) Listen() error {
	addr := fiberHost(s.cfg.Server.Host, s.cfg.Server.Port)
	s.log.Info("api listening", zap.String("addr", addr))
	return s.app.Listen(addr)
}

func (s *Server) Shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return s.app.ShutdownWithContext(ctx)
}

func (s *Server) Test(req *http.Request) (*http.Response, error) {
	return s.app.Test(req)
}

func fiberHost(host string, port int) string {
	// bind 0.0.0.0 works for bare metal, VM, Docker, and WSL with portproxy
	return host + ":" + strconv.Itoa(port)
}
