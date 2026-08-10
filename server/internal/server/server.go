// Package server wires platform packages to feature modules. This is the
// only place that knows about every module — modules themselves stay
// independent and self-contained.
package server

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/CreadorLanda/Socilaize/server/internal/config"
	"github.com/CreadorLanda/Socilaize/server/internal/middleware"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/auth"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/calls"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/channels"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/groups"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/health"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/keys"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/media"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/messages"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/notifications"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/stickers"
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
	pushWorker   *notifications.Worker
	callSweeper  *calls.Sweeper
	mediaSweeper *media.Sweeper
	msgSweeper   *messages.Sweeper
	pubSrv       *http.Server
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

	// Notifications — device tokens, prefs, Redis push queue + worker.
	notifRepo := notifications.NewRepository(pg)
	notifSvc := notifications.NewService(notifRepo, rdb)
	notifCtl := notifications.NewController(notifSvc)
	notifications.Register(authed, notifCtl)
	pushWorker := notifications.NewWorker(notifRepo, rdb, notifications.WorkerOpts{
		WebhookURL: cfg.Push.WebhookURL,
		FCM: notifications.FCMConfig{
			ProjectID:       cfg.Push.FCMProjectID,
			CredentialsFile: cfg.Push.FCMCredentialsFile,
			CredentialsJSON: []byte(cfg.Push.FCMCredentialsJSON),
		},
	})

	// Native E2E-encrypted messaging (push for offline peers via notifSvc).
	msgRepo := messages.NewRepository(pg, cfg.Crypto.MessageKey)
	msgSvc := messages.NewService(msgRepo, keysSvc, usersRepo, hub, notifSvc)
	msgCtl := messages.NewController(msgSvc, hub, []byte(cfg.JWT.Secret))
	messages.Register(authed, msgCtl)
	// WS lives on the public /api group — token is validated inside the handler.
	messages.RegisterWS(api, msgCtl)

	// Media uploads (auth) + public file streaming by UUID.
	mediaRepo := media.NewRepository(pg)
	mediaSvc := media.NewService(mediaRepo, cfg.Media.Dir, cfg.Media.MaxUploadBytes, cfg.Media.TTL)
	mediaCtl := media.NewController(mediaSvc)
	media.Register(authed, mediaCtl)

	// The server is a relay for media, not a store: bytes are swept once
	// every recipient has them, or when the deadline passes.
	mediaSweeper := media.NewSweeper(mediaRepo, cfg.Media.Dir, cfg.Media.SweepEvery)

	// Group chats (roles + history settings on chats type=group).
	groupsRepo := groups.NewRepository(pg)
	groupsCtl := groups.NewController(groups.NewService(groupsRepo))
	groups.Register(authed, groupsCtl)

	// Ephemeral stories (24h feed + views).
	storiesRepo := stories.NewRepository(pg)
	storiesCtl := stories.NewController(stories.NewService(storiesRepo, chatOpener{msgSvc}))
	stories.Register(authed, storiesCtl)

	// Imported sticker packs (bytes live in media_objects).
	stickersRepo := stickers.NewRepository(pg)
	stickersCtl := stickers.NewController(stickers.NewService(stickersRepo, mediaCopier{mediaSvc}))
	stickers.Register(authed, stickersCtl)

	// Calls: the server signs who may join which room and nothing else. No
	// audio or video passes through here — the SFU is a separate process, and
	// the streams are encrypted with a key derived on the devices.
	//
	// The history repo records who rang whom and who answered — the call log
	// read from bundled sample data before this.
	callsHistory := calls.NewHistoryRepo(pg)
	// A call whose participants all vanished would otherwise stay "running"
	// forever, and the log would offer to join an empty room.
	callSweeper := calls.NewSweeper(callsHistory, 10*time.Minute, 4*time.Hour)
	callsCtl := calls.NewController(calls.NewService(
		calls.Config{
			URL:       cfg.LiveKit.URL,
			APIKey:    cfg.LiveKit.APIKey,
			APISecret: cfg.LiveKit.APISecret,
		},
		chatParticipation{msgRepo},
		userNames{usersRepo},
		callRinger{repo: msgRepo, hub: hub, push: notifSvc},
		callsHistory,
		callTrace{repo: msgRepo, hub: hub},
	))
	calls.Register(authed, callsCtl)

	// Discover channels + posts.
	channelsRepo := channels.NewRepository(pg)
	channelsCtl := channels.NewController(channels.NewService(channelsRepo))
	channels.Register(authed, channelsCtl)

	return &Server{
		cfg: cfg, router: r, pg: pg, rdb: rdb,
		pushWorker: pushWorker, mediaSweeper: mediaSweeper, callSweeper: callSweeper,
		msgSweeper: messages.NewSweeper(msgSvc, 5*time.Minute),
		errCh:      make(chan error, 2),
	}, nil
}

// chatParticipation and userNames adapt existing repositories to the narrow
// interfaces the calls module declares, so it imports neither — same pattern
// as mediaCopier below.
type chatParticipation struct{ repo *messages.Repository }

func (c chatParticipation) IsParticipant(ctx context.Context, chatID, userID uuid.UUID) (bool, error) {
	return c.repo.IsParticipant(ctx, chatID, userID)
}

func (c chatParticipation) MemberIDs(ctx context.Context, chatID uuid.UUID) ([]uuid.UUID, error) {
	return c.repo.ParticipantIDs(ctx, chatID)
}

// callRinger makes the other phones ring.
//
// Live participants get a websocket event, which the app turns into an
// incoming-call screen. Everyone else gets a push — without it a call is
// silent until someone happens to open the app.
type callRinger struct {
	repo *messages.Repository
	hub  *realtime.Hub
	push *notifications.Service
}

func (c callRinger) Ring(ctx context.Context, chatID, caller uuid.UUID, callerName, mode string) {
	ids, err := c.repo.ParticipantIDs(ctx, chatID)
	if err != nil {
		return
	}
	data := map[string]string{
		"type":        "call.incoming",
		"chat_id":     chatID.String(),
		"caller_id":   caller.String(),
		"caller_name": callerName,
		"mode":        mode,
	}

	for _, uid := range ids {
		if uid == caller {
			continue
		}
		if c.hub != nil && c.hub.Online(uid) {
			// Already on the wire — a push as well would ring twice.
			c.hub.PublishJSON([]uuid.UUID{uid}, "call.incoming", chatID.String(), data)
			continue
		}
		if c.push != nil {
			_ = c.push.NotifyUser(ctx, uid, "calls", callerName, callBody(mode), data)
		}
	}
}

// RingUsers reaches a named few rather than everyone in the chat.
//
// Used when people are pulled into a call already running: they may not be in
// the conversation at all, so "everyone in the chat" would both miss them and
// ring people who are already talking.
func (c callRinger) RingUsers(ctx context.Context, chatID uuid.UUID, users []uuid.UUID, callerName, mode string) {
	data := map[string]string{
		"type":        "call.incoming",
		"chat_id":     chatID.String(),
		"caller_name": callerName,
		"mode":        mode,
	}
	for _, uid := range users {
		if c.hub != nil && c.hub.Online(uid) {
			c.hub.PublishJSON([]uuid.UUID{uid}, "call.incoming", chatID.String(), data)
			continue
		}
		if c.push != nil {
			_ = c.push.NotifyUser(ctx, uid, "calls", callerName, callBody(mode), data)
		}
	}
}

func callBody(mode string) string {
	if mode == "video" {
		return "Incoming video call"
	}
	return "Incoming call"
}

// callTrace writes the row a call leaves in the conversation.
//
// The content is the call id and mode, not a sentence: the outcome — answered,
// missed, how long it lasted — is not known when the row is written, and the
// client resolves it from the call log when rendering.
type callTrace struct {
	repo *messages.Repository
	hub  *realtime.Hub
}

func (c callTrace) RecordCall(ctx context.Context, chatID, caller, callID uuid.UUID, mode string) {
	body := fmt.Sprintf(`{"call_id":%q,"mode":%q}`, callID.String(), mode)
	id, err := c.repo.InsertMessage(ctx, chatID, caller, body, messages.MsgCall, nil, nil, messages.Origin{})
	if err != nil || c.hub == nil {
		return
	}
	// Live participants see the row appear as the call starts, which is what
	// makes "join" reachable without leaving the conversation.
	ids, err := c.repo.ParticipantIDs(ctx, chatID)
	if err != nil {
		return
	}
	c.hub.PublishJSON(ids, "message.new", chatID.String(), map[string]any{
		"id": id, "chat_id": chatID.String(), "sender_id": caller.String(),
		"content": body, "message_type": string(messages.MsgCall),
	})
}

type userNames struct{ repo *users.Repository }

func (u userNames) DisplayName(ctx context.Context, userID uuid.UUID) (string, error) {
	usr, err := u.repo.ByID(ctx, userID)
	if err != nil || usr == nil {
		return "", err
	}
	return usr.DisplayName, nil
}

// mediaCopier adapts media.Service to the narrow interface the stickers
// module declares, so neither module has to know the other's shape.
type mediaCopier struct{ svc *media.Service }

func (m mediaCopier) Duplicate(ctx context.Context, srcID, newOwner uuid.UUID) (uuid.UUID, error) {
	obj, err := m.svc.Duplicate(ctx, srcID, newOwner)
	if err != nil {
		return uuid.Nil, err
	}
	return obj.ID, nil
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

	if s.callSweeper != nil {
		s.callSweeper.Start()
	}
	if s.pushWorker != nil {
		s.pushWorker.Start()
	}
	if s.mediaSweeper != nil {
		s.mediaSweeper.Start()
	}
	if s.msgSweeper != nil {
		s.msgSweeper.Start()
	}
}

// Err returns a channel that receives the first listener error.
func (s *Server) Err() <-chan error { return s.errCh }

// Close releases platform connections and stops all listeners.
// Safe to call multiple times.
func (s *Server) Close() {
	if s.callSweeper != nil {
		s.callSweeper.Start()
	}
	if s.pushWorker != nil {
		s.pushWorker.Stop()
	}
	if s.mediaSweeper != nil {
		s.mediaSweeper.Stop()
	}
	if s.msgSweeper != nil {
		s.msgSweeper.Stop()
	}
	if s.pubSrv != nil {
		_ = s.pubSrv.Close()
	}
	if s.rdb != nil {
		_ = s.rdb.Close()
	}
	if s.pg != nil {
		s.pg.Close()
	}
}

// chatOpener lets a blind story thread graduate into a real conversation
// without the stories module importing the messages one.
type chatOpener struct{ svc *messages.Service }

func (c chatOpener) OpenDirectChat(ctx context.Context, a, b uuid.UUID) (uuid.UUID, error) {
	chat, err := c.svc.CreateDirectChat(ctx, a, b)
	if err != nil {
		return uuid.Nil, err
	}
	return chat.ID, nil
}
