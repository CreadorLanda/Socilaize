// Package server wires platform packages to feature modules. This is the
// only place that knows about every module — modules themselves stay
// independent and self-contained.
package server

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/CreadorLanda/Socilaize/server/internal/config"
	"github.com/CreadorLanda/Socilaize/server/internal/middleware"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/auth"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/bridges/whatsapp"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/health"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/keys"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/users"
	pgplatform "github.com/CreadorLanda/Socilaize/server/internal/platform/postgres"
	rdplatform "github.com/CreadorLanda/Socilaize/server/internal/platform/redis"
)

// Server is the running API process — owns the router and the platform
// connections, so shutdown can close everything in one place.
type Server struct {
	cfg    config.Config
	router http.Handler
	pg     *pgxpool.Pool
	rdb    *redis.Client
}

// New constructs the Server: opens the platform connections, builds each
// module, and registers routes.
func New(cfg config.Config) (*Server, error) {
	ctx := context.Background()

	pg, err := pgplatform.Open(ctx, cfg.Postgres.URL)
	if err != nil {
		return nil, err
	}
	rdb, err := rdplatform.Open(ctx, cfg.Redis.URL)
	if err != nil {
		pg.Close()
		return nil, err
	}

	if cfg.Env == "prod" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(middleware.RequestID(), middleware.Recovery(), gin.Logger())

	api := r.Group("/api")

	// Health is mounted on /api so a single load-balancer rule covers it.
	health.New(pg, rdb).Register(api)

	// Public routes (no auth required).
	authRepo := auth.NewRepository(pg)
	authSvc := auth.NewService(authRepo, rdb, cfg.JWT)
	authCtl := auth.NewController(authSvc, cfg)
	auth.Register(api, authCtl)

	// Protected routes — every endpoint past this point needs a valid
	// access token. Mounted as a sub-group so /auth/* stays open.
	authed := api.Group("")
	authed.Use(middleware.Auth([]byte(cfg.JWT.Secret)))

	usersRepo := users.NewRepository(pg)
	usersCtl := users.NewController(users.NewService(usersRepo))
	users.Register(authed, usersCtl)

	// Pre-key bundles for X3DH. Reuses the users repository to resolve
	// /by-username/:handle lookups.
	keysCtl := keys.NewController(keys.NewService(keys.NewRepository(pg), usersRepo))
	keys.Register(authed, keysCtl)

	// WhatsApp bridge (skeleton). Sits behind auth — only signed-in users
	// can link/unlink/inspect their bridge.
	waCtl := whatsapp.NewController(whatsapp.NewService(pg, rdb))
	whatsapp.Register(authed, waCtl)

	return &Server{cfg: cfg, router: r, pg: pg, rdb: rdb}, nil
}

func (s *Server) Handler() http.Handler { return s.router }

// Close releases platform connections. Safe to call after Shutdown.
func (s *Server) Close() {
	if s.rdb != nil {
		_ = s.rdb.Close()
	}
	if s.pg != nil {
		s.pg.Close()
	}
}
