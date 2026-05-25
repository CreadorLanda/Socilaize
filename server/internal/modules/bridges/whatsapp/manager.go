package whatsapp

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	whatsmeowEvents "go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"

	_ "github.com/jackc/pgx/v5/stdlib" // database/sql driver for whatsmeow
)

// Manager owns the in-process whatsmeow state per user.
//
// We keep ONE entry per user (the pendingPair below). The deviceStore is
// preserved across pairing retries — Baileys' `useMultiFileAuthState`
// does the same trick: WhatsApp sees one client retrying, not N fresh
// clients, which makes their per-IP rate-limit kick in far less often.
//
// What's intentionally NOT here yet:
//   - persisting the pre-pair device (noise key, identity key) to disk so
//     identity survives a server restart. For now the in-memory cache
//     is enough; if we restart, the user just starts a new pair cycle.
//   - multi-device fanout. One device per user for now.
type Manager struct {
	container *sqlstore.Container
	repo      *Repository
	logger    waLog.Logger

	mu       sync.Mutex
	sessions map[uuid.UUID]*pendingPair
}

// pendingPair holds the per-user state. The device may be reused across
// many StartPairing calls; the client is recreated whenever we need a
// fresh WebSocket. Once a pair succeeds, the same struct still holds
// the (now-paired) client.
type pendingPair struct {
	device *store.Device
	client *whatsmeow.Client
}

// NewManager opens the whatsmeow sqlstore against the same Postgres we use
// for the rest of the app, and prepares an empty sessions map.
func NewManager(ctx context.Context, postgresURL string, repo *Repository) (*Manager, error) {
	dbLog := waLog.Stdout("wa-db", "WARN", true)
	container, err := sqlstore.New(ctx, "pgx", postgresURL, dbLog)
	if err != nil {
		return nil, fmt.Errorf("whatsmeow sqlstore: %w", err)
	}
	return &Manager{
		container: container,
		repo:      repo,
		logger:    waLog.Stdout("wa", "INFO", true),
		sessions:  make(map[uuid.UUID]*pendingPair),
	}, nil
}

// Close disconnects every active client. Best-effort.
func (m *Manager) Close() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, s := range m.sessions {
		if s.client != nil {
			s.client.Disconnect()
		}
		delete(m.sessions, id)
	}
}

// StartPairing requests a phone-pairing code from WhatsApp and returns it
// to the caller. The user types the code into WhatsApp → Linked devices →
// Link with phone number.
//
// Device identity is reused across calls: if this user already has a
// pre-pair device in our cache, we open a NEW WebSocket but with the
// SAME noise/identity keys. That makes the retry look like one client
// reconnecting (the Baileys default behaviour) rather than N strangers
// — which is what WhatsApp's per-IP rate-limit punishes hardest.
func (m *Manager) StartPairing(ctx context.Context, userID uuid.UUID, phone string) (string, time.Time, error) {
	// Strip + and any spacing — whatsmeow wants pure digits for PairPhone.
	cleanPhone := strings.NewReplacer("+", "", " ", "", "-", "").Replace(phone)

	// Reuse the device store if we still have it around; only the
	// WebSocket-bearing Client gets torn down between attempts.
	m.mu.Lock()
	session, exists := m.sessions[userID]
	if !exists {
		session = &pendingPair{device: m.container.NewDevice()}
		m.sessions[userID] = session
	} else if session.client != nil {
		// Old client lingered from a previous attempt — close it cleanly
		// before we create a new one over the same device store.
		session.client.Disconnect()
		session.client = nil
	}
	deviceStore := session.device
	m.mu.Unlock()

	client := whatsmeow.NewClient(deviceStore, m.logger)
	m.mu.Lock()
	session.client = client
	m.mu.Unlock()

	client.AddEventHandler(m.eventHandler(userID))

	log.Info().
		Str("user", userID.String()).
		Str("phone", cleanPhone).
		Msg("wa: connecting for pair")

	// fail tears down the WebSocket but keeps the device store around so
	// the next attempt reuses the same identity.
	fail := func(wrap string, err error) (string, time.Time, error) {
		client.Disconnect()
		m.mu.Lock()
		session.client = nil
		m.mu.Unlock()
		return "", time.Time{}, fmt.Errorf("%s: %w", wrap, err)
	}

	// Subscribe to the QR channel BEFORE Connect — whatsmeow's package docs
	// say "wait for events.QR before PairPhone to ensure the connection is
	// fully established". Without this, PairPhone can race the WS handshake
	// and WhatsApp closes the socket (the EOF we kept seeing).
	qrChan, err := client.GetQRChannel(ctx)
	if err != nil {
		return fail("qr channel", err)
	}
	if err := client.Connect(); err != nil {
		return fail("connect to whatsapp", err)
	}

	// Wait for the first QR-style signal — that proves the connection is
	// ready to accept pair-related queries. We drain ignoring its content
	// (we want PHONE pairing, not QR scan). 10s is well above any healthy
	// roundtrip; if it doesn't arrive WhatsApp is already unhappy.
	select {
	case evt := <-qrChan:
		log.Info().Str("user", userID.String()).Str("event", evt.Event).Msg("wa: qr channel ready")
	case <-time.After(10 * time.Second):
		return fail("connect to whatsapp", fmt.Errorf("timed out waiting for handshake"))
	case <-ctx.Done():
		return fail("connect to whatsapp", ctx.Err())
	}

	// `showPushNotification = false`: don't push to the target phone (we
	// rely on the user opening Linked Devices manually). Pushing has been
	// observed to make WhatsApp pickier about who can request a code.
	const displayName = "Socialize"
	code, err := client.PairPhone(ctx, cleanPhone, false, whatsmeow.PairClientChrome, displayName)
	if err != nil {
		// Log the raw error verbatim so the classifier in service.go can
		// be tuned against real patterns. The "EOF" we see in the WARN
		// line is the *close* error, not what PairPhone returned.
		log.Warn().
			Err(err).
			Str("user", userID.String()).
			Str("phone", cleanPhone).
			Str("raw_error", err.Error()).
			Msg("wa: PairPhone failed")
		return fail("pair phone", err)
	}
	log.Info().
		Str("user", userID.String()).
		Str("code", code).
		Msg("wa: pair code issued")

	// Pairing codes are good for ~2 minutes per WhatsApp. We expose this so
	// the client can show a countdown / refresh button at the right time.
	expires := time.Now().Add(120 * time.Second)

	// Session entry was created at the top — no need to re-set client here.
	return formatPairingCode(code), expires, nil
}

// IsConnected reports whether we still have a live client and it's online.
func (m *Manager) IsConnected(userID uuid.UUID) bool {
	m.mu.Lock()
	s, ok := m.sessions[userID]
	m.mu.Unlock()
	return ok && s != nil && s.client != nil && s.client.IsConnected() && s.client.IsLoggedIn()
}

// Unlink logs out from WhatsApp (server-side revoke) and drops the local
// session. If the user wasn't connected, this is a no-op success.
func (m *Manager) Unlink(ctx context.Context, userID uuid.UUID) error {
	m.mu.Lock()
	s, ok := m.sessions[userID]
	if ok {
		delete(m.sessions, userID)
	}
	m.mu.Unlock()

	if !ok || s == nil || s.client == nil {
		return nil
	}
	c := s.client
	if c.IsLoggedIn() {
		if err := c.Logout(ctx); err != nil && !errors.Is(err, whatsmeow.ErrNotLoggedIn) {
			c.Disconnect()
			return fmt.Errorf("logout: %w", err)
		}
	}
	c.Disconnect()
	return nil
}

// dropSession discards both client and device cache for the user. Used
// after a remote LoggedOut event — the device identity is now invalid.
func (m *Manager) dropSession(userID uuid.UUID) {
	m.mu.Lock()
	s, ok := m.sessions[userID]
	if ok {
		delete(m.sessions, userID)
	}
	m.mu.Unlock()
	if ok && s != nil && s.client != nil {
		s.client.Disconnect()
	}
}

// eventHandler is the bridge between whatsmeow events and our repository.
// We care about three signals for the registration flow:
//
//   - PairSuccess: the user entered the code, session is durable now.
//   - PairError:   pairing failed (wrong number, code expired, network).
//   - LoggedOut:   the remote side cut the link (unlinked from phone).
//
// Message events come later; for now we just persist link state.
func (m *Manager) eventHandler(userID uuid.UUID) func(any) {
	return func(evt any) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		switch e := evt.(type) {
		case *whatsmeowEvents.PairSuccess:
			jid := e.ID.String()
			if err := m.repo.MarkLinked(ctx, userID, jid); err != nil {
				log.Error().Err(err).Str("user", userID.String()).Msg("wa: mark linked")
			} else {
				log.Info().Str("user", userID.String()).Str("jid", jid).Msg("wa: pair_success")
			}
		case *whatsmeowEvents.PairError:
			reason := "pair_error"
			if e.Error != nil {
				reason = e.Error.Error()
			}
			_ = m.repo.MarkFailed(ctx, userID, reason)
			log.Warn().Str("user", userID.String()).Str("reason", reason).Msg("wa: pair_error")
		case *whatsmeowEvents.LoggedOut:
			_ = m.repo.MarkDisconnected(ctx, userID)
			m.dropSession(userID)
			log.Info().Str("user", userID.String()).Msg("wa: logged_out")
		}
	}
}

// formatPairingCode mirrors WhatsApp's UI presentation: 8 chars in two
// hyphen-separated groups of four.
func formatPairingCode(raw string) string {
	if len(raw) == 8 {
		return raw[:4] + "-" + raw[4:]
	}
	return raw
}
