package main

import (
	"context"
	"embed"
	"flag"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/polije/netmon/internal/api"
	"github.com/polije/netmon/internal/config"
	"github.com/polije/netmon/internal/poller"
	"github.com/polije/netmon/internal/scanner"
	"github.com/polije/netmon/internal/store"
	"github.com/polije/netmon/internal/unifi"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

//go:embed all:dist
var uiFS embed.FS

func main() {
	var cfgPath string
	flag.StringVar(&cfgPath, "config", "config.yaml", "path to config file")
	var seed bool
	flag.BoolVar(&seed, "seed", true, "seed demo devices if DB empty")
	flag.Parse()

	cfg, err := config.Load(cfgPath)
	must(err)

	log := mustLogger(cfg)
	defer log.Sync()

	// Ensure data dir exists
	if cfg.Database.Driver == "sqlite3" {
		_ = os.MkdirAll(filepath.Dir(cfg.Database.DSN), 0o755)
	}

	s, err := store.Open(cfg.Database.Driver, cfg.Database.DSN)
	must(err)
	log.Info("database opened", zap.String("driver", cfg.Database.Driver), zap.String("dsn", cfg.Database.DSN))

	if seed {
		if err := seedIfEmpty(s); err != nil {
			log.Warn("seed failed", zap.Error(err))
		}
	}

	sc := scanner.New(cfg, s, log)
	p := poller.New(cfg, s, log)
	uc := unifi.New(&cfg.UniFi, s, log)

	// embedded UI is served by api; we don't need to pass it here if dist/ doesn't exist yet.
	// use a blank embed.FS if dist is not present at build time.
	srv := api.New(cfg, s, sc, log, uiFS)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	errCh := make(chan error, 4)

	// Poller
	go func() { errCh <- p.Run(ctx) }()
	// UniFi sync
	go func() { errCh <- uc.Run(ctx) }()
	// HTTP
	go func() { errCh <- srv.Listen() }()

	log.Info("netmon-polije started",
		zap.Int("port", cfg.Server.Port),
		zap.String("host", cfg.Server.Host),
		zap.Duration("poll_interval", cfg.Poll.Interval),
	)

	// Wait signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errCh:
		log.Error("fatal", zap.Error(err))
	case sig := <-sigCh:
		log.Info("shutdown signal", zap.String("sig", sig.String()))
	}
	cancel()
	shutdownCtx, scCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer scCancel()
	_ = shutdownCtx
	_ = srv.Shutdown()
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}

func mustLogger(cfg *config.Config) *zap.Logger {
	var zc zap.Config
	if cfg.Log.Pretty {
		zc = zap.NewDevelopmentConfig()
		zc.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	} else {
		zc = zap.NewProductionConfig()
	}
	lvl, err := zapcore.ParseLevel(cfg.Log.Level)
	if err != nil {
		lvl = zapcore.InfoLevel
	}
	zc.Level = zap.NewAtomicLevelAt(lvl)
	return zap.Must(zc.Build())
}
