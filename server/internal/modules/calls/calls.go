// Package calls hands out join tokens for the self-hosted LiveKit SFU.
//
// The server does exactly one thing here: it decides who may join which room,
// and signs a short-lived token saying so. It never touches audio or video,
// and it never learns the key those streams are encrypted with — that is
// derived on the devices from the chat's existing E2EE session.
//
// A room is a chat. Naming them after the chat id is what makes the
// permission check possible at all: "may this user join room X" reduces to
// "is this user a participant of chat X", which the chat module already
// answers.
package calls

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/livekit/protocol/auth"

	"github.com/CreadorLanda/Socilaize/server/internal/middleware"
)

var (
	// ErrCallsDisabled means no SFU is configured. Reported rather than
	// papered over: a token for a room nobody can reach looks like a working
	// call right up until the moment it silently fails to connect.
	ErrCallsDisabled = errors.New("calls_disabled")
	ErrNotAllowed    = errors.New("not_a_participant")
)

// TokenTTL is how long a join token stays valid.
//
// Short on purpose. The token is fetched immediately before joining, so it
// never needs to outlive that; a long-lived one is a standing invitation to
// a room, sitting in whatever logs the request passed through.
const TokenTTL = 5 * time.Minute

// Participation is the one question this module asks of the rest of the app.
//
// An interface rather than a repository import: modules here do not reach
// into each other's storage, and "who is in this chat" is already answered
// elsewhere.
type Participation interface {
	IsParticipant(ctx context.Context, chatID, userID uuid.UUID) (bool, error)
	// MemberIDs is everyone the call reaches, so the log can say who was rung
	// and who never answered.
	MemberIDs(ctx context.Context, chatID uuid.UUID) ([]uuid.UUID, error)
}

// Identity resolves the display name shown to the other participants.
type Identity interface {
	DisplayName(ctx context.Context, userID uuid.UUID) (string, error)
}

// Trace writes the row a call leaves in the conversation.
//
// Separate from Ringer because ringing is transient and this is permanent:
// one wakes a phone, the other is what the thread still says tomorrow.
type Trace interface {
	RecordCall(ctx context.Context, chatID, caller uuid.UUID, callID uuid.UUID, mode string)
}

// Ringer is how the other side finds out. Without it a call is silent until
// someone happens to open the app — which is not a call, it is a room that
// exists.
type Ringer interface {
	// Ring reaches everyone in the chat except the caller, live and by push.
	Ring(ctx context.Context, chatID, caller uuid.UUID, callerName, mode string)
	// RingUsers reaches a named few — the people just pulled into a call,
	// who may not be in the chat at all.
	RingUsers(ctx context.Context, chatID uuid.UUID, users []uuid.UUID, callerName, mode string)
}

type Config struct {
	URL       string
	APIKey    string
	APISecret string
}

func (c Config) enabled() bool {
	return c.URL != "" && c.APIKey != "" && c.APISecret != ""
}

type Service struct {
	cfg   Config
	chats Participation
	users Identity
	ring  Ringer
	// log records what happened. Optional: without it calls still work, they
	// simply leave no trace.
	log   *HistoryRepo
	trace Trace
}

func NewService(cfg Config, chats Participation, users Identity, ring Ringer, log *HistoryRepo, trace Trace) *Service {
	return &Service{cfg: cfg, chats: chats, users: users, ring: ring, log: log, trace: trace}
}

// Grant is what the client needs to join.
type Grant struct {
	// URL of the SFU. Sent per request rather than compiled into the app so
	// moving the SFU does not require shipping a new build.
	URL   string `json:"url"`
	Room  string `json:"room"`
	Token string `json:"token"`
	// Identity is the participant id inside the room. The user's own id, so
	// the client can tell whose track is whose.
	Identity  string    `json:"identity"`
	ExpiresAt time.Time `json:"expires_at"`
}

// TokenFor issues a join token.
//
// Order matters here: the call is created or found first, because the room is
// named after it. Building the token before knowing the call would name a room
// nobody else is in.
func (s *Service) TokenFor(ctx context.Context, chatID, userID uuid.UUID, ring bool, mode string) (Grant, error) {
	if !s.cfg.enabled() {
		return Grant{}, ErrCallsDisabled
	}

	// Two ways in, and they are different questions.
	//
	// Starting a call requires being in the conversation. Joining one requires
	// being on that call's guest list — which is how someone pulled into a
	// one-to-one call can enter a room whose chat they are not part of.
	inChat, err := s.chats.IsParticipant(ctx, chatID, userID)
	if err != nil {
		return Grant{}, err
	}

	var callID uuid.UUID
	var haveCall bool
	if s.log != nil {
		callID, haveCall, _ = s.log.Running(ctx, chatID)
	}

	invited := false
	if haveCall && !inChat {
		invited, _ = s.log.MayJoin(ctx, callID, userID)
	}
	if !inChat && !invited {
		// Reported as not-found rather than forbidden: "you may not join this"
		// also confirms the call exists.
		return Grant{}, ErrNotAllowed
	}

	name, err := s.users.DisplayName(ctx, userID)
	if err != nil || name == "" {
		name = "…"
	}

	// Create or join the call before naming the room after it.
	if s.log != nil {
		if ring && inChat {
			members, _ := s.chats.MemberIDs(ctx, chatID)
			id, created, err := s.log.Start(ctx, chatID, userID, mode, members)
			if err == nil {
				callID, haveCall = id, true
				if created && s.trace != nil {
					// Only on a genuinely new call. Start joins an existing one
					// when the group is already talking, and a second row would
					// read as a second call.
					s.trace.RecordCall(ctx, chatID, userID, id, mode)
				}
			}
		} else if haveCall {
			_ = s.log.Join(ctx, callID, userID)
		}
	}

	// The room is the call, not the chat.
	//
	// It used to be the chat id, which made the permission check simple and
	// made it impossible to pull anyone into a call without adding them to the
	// conversation. Falling back to the chat id keeps calls working when the
	// log is not configured at all.
	room := chatID.String()
	if haveCall {
		room = callID.String()
	}

	at := auth.NewAccessToken(s.cfg.APIKey, s.cfg.APISecret).
		SetIdentity(userID.String()).
		SetName(name).
		SetValidFor(TokenTTL).
		SetVideoGrant(&auth.VideoGrant{
			Room:     room,
			RoomJoin: true,
			// Publishing and subscribing only. No room administration: a
			// participant must not be able to remove others or mint further
			// tokens from inside the call.
			CanPublish:     boolPtr(true),
			CanSubscribe:   boolPtr(true),
			CanPublishData: boolPtr(true),
		})

	token, err := at.ToJWT()
	if err != nil {
		return Grant{}, err
	}

	// Ringing on the first join, not on every token request.
	//
	// Both sides fetch a token — the caller to start, the callee to answer —
	// so ringing unconditionally would make the phone ring in the hand of the
	// person answering it.
	if ring && s.ring != nil {
		s.ring.Ring(ctx, chatID, userID, name, mode)
	}

	return Grant{
		URL:       s.cfg.URL,
		Room:      room,
		Token:     token,
		Identity:  userID.String(),
		ExpiresAt: time.Now().Add(TokenTTL),
	}, nil
}

func boolPtr(b bool) *bool { return &b }

// ── controller ──────────────────────────────────────────────────────────────

type Controller struct{ svc *Service }

func NewController(svc *Service) *Controller { return &Controller{svc: svc} }

// PostToken — POST /chats/:id/call/token
func (c *Controller) PostToken(ctx *gin.Context) {
	chatID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	// The caller asks to ring; the person answering does not.
	ring := ctx.Query("ring") == "1"
	mode := ctx.Query("mode")
	if mode != "video" {
		mode = "voice"
	}
	grant, err := c.svc.TokenFor(ctx.Request.Context(), chatID, middleware.UserIDFrom(ctx), ring, mode)
	switch {
	case errors.Is(err, ErrCallsDisabled):
		ctx.JSON(http.StatusServiceUnavailable, gin.H{"error": ErrCallsDisabled.Error()})
		return
	case errors.Is(err, ErrNotAllowed):
		// Reported as not-found, not forbidden: "you may not join this" also
		// confirms the room exists.
		ctx.JSON(http.StatusNotFound, gin.H{"error": "chat_not_found"})
		return
	case err != nil:
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal"})
		return
	}
	ctx.JSON(http.StatusOK, grant)
}

// GetHistory — GET /calls
func (c *Controller) GetHistory(ctx *gin.Context) {
	if c.svc.log == nil {
		ctx.JSON(http.StatusOK, []Entry{})
		return
	}
	list, err := c.svc.log.History(ctx.Request.Context(), middleware.UserIDFrom(ctx), 50)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal"})
		return
	}
	ctx.JSON(http.StatusOK, list)
}

// PostDecline — POST /chats/:id/call/decline
//
// Saying no explicitly, which reads differently in the log from never
// answering at all.
func (c *Controller) PostDecline(ctx *gin.Context) {
	chatID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	userID := middleware.UserIDFrom(ctx)
	if ok, err := c.svc.chats.IsParticipant(ctx.Request.Context(), chatID, userID); err != nil || !ok {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "chat_not_found"})
		return
	}
	if c.svc.log != nil {
		if callID, running, _ := c.svc.log.Running(ctx.Request.Context(), chatID); running {
			_ = c.svc.log.Decline(ctx.Request.Context(), callID, userID)
		}
	}
	ctx.Status(http.StatusNoContent)
}

type InviteRequest struct {
	UserIDs []uuid.UUID `json:"user_ids" binding:"required,min=1,max=16"`
}

// PostInvite — POST /chats/:id/call/invite
//
// Pulls people into a call already running, without touching the conversation.
// The chat keeps exactly the participants it had; only the call's guest list
// grows.
func (c *Controller) PostInvite(ctx *gin.Context) {
	chatID, err := uuid.Parse(ctx.Param("id"))
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_id"})
		return
	}
	var req InviteRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "detail": err.Error()})
		return
	}
	userID := middleware.UserIDFrom(ctx)

	// Only someone already in the call may widen it. Otherwise an outsider who
	// learned a chat id could add themselves.
	if c.svc.log == nil {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{"error": ErrCallsDisabled.Error()})
		return
	}
	callID, running, _ := c.svc.log.Running(ctx.Request.Context(), chatID)
	if !running {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "no_call_running"})
		return
	}
	if ok, _ := c.svc.log.MayJoin(ctx.Request.Context(), callID, userID); !ok {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "no_call_running"})
		return
	}

	added, err := c.svc.log.Invite(ctx.Request.Context(), callID, req.UserIDs)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "internal"})
		return
	}

	// Ring only the people who were actually added — someone already in the
	// call must not have their phone ring again.
	if len(added) > 0 && c.svc.ring != nil {
		name, _ := c.svc.users.DisplayName(ctx.Request.Context(), userID)
		c.svc.ring.RingUsers(ctx.Request.Context(), chatID, added, name, "voice")
	}

	ctx.JSON(http.StatusOK, gin.H{"invited": len(added)})
}

// Register mounts the call routes on a JWT-protected group.
func Register(rg *gin.RouterGroup, c *Controller) {
	rg.POST("/chats/:id/call/token", c.PostToken)
	rg.POST("/chats/:id/call/decline", c.PostDecline)
	rg.POST("/chats/:id/call/invite", c.PostInvite)
	rg.GET("/calls", c.GetHistory)
}
