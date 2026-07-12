// Package server wires platform packages to feature modules. This is the
// only place that knows about every module — modules themselves stay
// independent and self-contained.
package server

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/CreadorLanda/Socilaize/server/internal/config"
	"github.com/CreadorLanda/Socilaize/server/internal/middleware"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/auth"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/bridges/whatsapp"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/health"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/keys"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/channels"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/groups"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/media"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/messages"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/notifications"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/stories"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/users"
	pgplatform "github.com/CreadorLanda/Socilaize/server/internal/platform/postgres"
	"github.com/CreadorLanda/Socilaize/server/internal/platform/realtime"
	rdplatform "github.com/CreadorLanda/Socilaize/server/internal/platform/redis"
)

// Server is the running API process — owns the routers and the platform
// connections, so shutdown can close everything in one place.
type Server struct {
	cfg          config.Config
	router       http.Handler
	pg           *pgxpool.Pool
	rdb          *redis.Client
	wa           *whatsapp.Manager
	pubSrv       *http.Server
	internalSrv  *http.Server // mTLS-protected, nil when disabled
	errCh        chan error
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

	keysRepo := keys.NewRepository(pg)
	keysSvc := keys.NewService(keysRepo, usersRepo)
	keysCtl := keys.NewController(keysSvc)
	keys.Register(authed, keysCtl)

	// Realtime hub (WebSocket fan-out for messaging events).
	hub := realtime.NewHub()

	// Notifications — device tokens, prefs, Redis push queue.
	notifRepo := notifications.NewRepository(pg)
	notifSvc := notifications.NewService(notifRepo, rdb)
	notifCtl := notifications.NewController(notifSvc)
	notifications.Register(authed, notifCtl)

	// Native E2E-encrypted messaging (push for offline peers via notifSvc).
	msgRepo := messages.NewRepository(pg, cfg.Crypto.MessageKey)
	msgSvc := messages.NewService(msgRepo, keysSvc, usersRepo, hub, notifSvc)
	msgCtl := messages.NewController(msgSvc, hub, []byte(cfg.JWT.Secret))
	messages.Register(authed, msgCtl)
	// WS lives on the public /api group — token is validated inside the handler.
	messages.RegisterWS(api, msgCtl)

	// Media uploads (auth) + public file streaming by UUID.
	mediaRepo := media.NewRepository(pg)
	mediaSvc := media.NewService(mediaRepo, cfg.Media.Dir, cfg.Media.MaxUploadBytes)
	mediaCtl := media.NewController(mediaSvc)
	media.Register(authed, mediaCtl)
	media.RegisterPublic(api, mediaCtl)

	// Group chats (roles + history settings on chats type=group).
	groupsRepo := groups.NewRepository(pg)
	groupsCtl := groups.NewController(groups.NewService(groupsRepo))
	groups.Register(authed, groupsCtl)

	// Ephemeral stories (24h feed + views).
	storiesRepo := stories.NewRepository(pg)
	storiesCtl := stories.NewController(stories.NewService(storiesRepo))
	stories.Register(authed, storiesCtl)

	// Discover channels + posts.
	channelsRepo := channels.NewRepository(pg)
	channelsCtl := channels.NewController(channels.NewService(channelsRepo))
	channels.Register(authed, channelsCtl)

	// WhatsApp bridge - thin HTTP client to Baileys sidecar.
	waRepo := whatsapp.NewRepository(pg, cfg.Crypto.MessageKey)
	waMgr := whatsapp.NewManager(cfg.WA.BridgeURL, cfg.WA.InternalToken)
	waCtl := whatsapp.NewController(whatsapp.NewService(waRepo, waMgr))
	whatsapp.Register(authed, waCtl)

	// Inbound bridge webhook. Uses its own Bearer-token check against the
	// shared internal token, not the user-facing JWT auth.
	waWebhook := whatsapp.NewWebhookController(waRepo, cfg.WA.InternalToken)
	api.POST("/internal/wa/events", waWebhook.PostEvent)

	// ── Internal mTLS server ──────────────────────────────────────────────
	// A second HTTPS listener that requires a valid client certificate
	// signed by our CA. Used exclusively by the wa-bridge sidecar so the
	// webhook is not accessible over plain TCP.
	//
	// Only starts when WA_INTERNAL_ADDR and all TLS cert paths are set.
	var internalSrv *http.Server
	if cfg.WA.InternalAddr != "" &&
		cfg.WA.TLSCACert != "" &&
		cfg.WA.TLSCert != "" &&
		cfg.WA.TLSKey != "" {
		internalSrv, err = newInternalServer(cfg, r)
		if err != nil {
			pg.Close()
			return nil, fmt.Errorf("internal server: %w", err)
		}
	}

	return &Server{cfg: cfg, router: r, pg: pg, rdb: rdb, wa: waMgr, internalSrv: internalSrv, errCh: make(chan error, 2)}, nil
}

func (s *Server) Handler() http.Handler { return s.router }

// ListenAndServe starts all listeners in the background.
// Returns immediately. Errors are sent to s.errCh.
func (s *Server) ListenAndServe() {
	s.pubSrv = &http.Server{
		Addr:              s.cfg.HTTP.Addr,
		Handler:           s.router,
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		err := s.pubSrv.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			s.errCh <- err
		}
	}()

	if s.internalSrv != nil {
		go func() {
			if err := s.internalSrv.ListenAndServeTLS("", ""); err != nil && !errors.Is(err, http.ErrServerClosed) {
				s.errCh <- err
			}
		}()
	}
}

// Err returns a channel that receives the first listener error.
func (s *Server) Err() <-chan error { return s.errCh }

// Close releases platform connections and stops all listeners.
// Safe to call multiple times.
func (s *Server) Close() {
	if s.pubSrv != nil {
		_ = s.pubSrv.Close()
	}
	if s.internalSrv != nil {
		_ = s.internalSrv.Close()
	}
	if s.wa != nil {
		s.wa.Close()
	}
	if s.rdb != nil {
		_ = s.rdb.Close()
	}
	if s.pg != nil {
		s.pg.Close()
	}
}

// newInternalServer creates an HTTPS server with mandatory client cert
// verification for the bridge webhook.
func newInternalServer(cfg config.Config, handler http.Handler) (*http.Server, error) {
	caPEM, err := os.ReadFile(cfg.WA.TLSCACert)
	if err != nil {
		return nil, fmt.Errorf("read CA cert: %w", err)
	}
	caPool := x509.NewCertPool()
	if !caPool.AppendCertsFromPEM(caPEM) {
		return nil, errors.New("no CA certs appended (empty or invalid PEM)")
	}

	cert, err := tls.LoadX509KeyPair(cfg.WA.TLSCert, cfg.WA.TLSKey)
	if err != nil {
		return nil, fmt.Errorf("load server cert: %w", err)
	}

	tlsCfg := &tls.Config{
		Certificates: []tls.Certificate{cert},
		ClientCAs:    caPool,
		ClientAuth:   tls.RequireAndVerifyClientCert,
		MinVersion:   tls.VersionTLS13,
	}

	return &http.Server{
		Addr:              cfg.WA.InternalAddr,
		Handler:           handler,
		TLSConfig:         tlsCfg,
		ReadHeaderTimeout: 10 * time.Second,
	}, nil
}
