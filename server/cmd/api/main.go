// Command api is the entry point for the Socialize backend.
//
// One binary, one process. Wires the platform packages (Postgres, Redis,
// logger, config) once and hands them to each feature module in
// internal/modules/* via the bootstrap in internal/server.
package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"

	"github.com/CreadorLanda/Socilaize/server/internal/config"
	"github.com/CreadorLanda/Socilaize/server/internal/server"
)

func main() {
	// .env is optional in dev; ignore missing.
	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("config")
	}

	srv, err := server.New(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("server init")
	}

	httpSrv := &http.Server{
		Addr:              cfg.HTTP.Addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Info().Str("addr", cfg.HTTP.Addr).Msg("listening")
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal().Err(err).Msg("listen")
		}
	}()

	// Graceful shutdown on SIGINT / SIGTERM.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Info().Msg("shutdown")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("http shutdown")
	}
	srv.Close()
}
