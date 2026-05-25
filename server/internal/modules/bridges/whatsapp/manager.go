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
	"go.mau.fi/whatsmeow/store/sqlstore"
	whatsmeowEvents "go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"

	_ "github.com/jackc/pgx/v5/stdlib" // database/sql driver for whatsmeow
)

// Manager owns the in-process whatsmeow.Client per linked user. The sqlstore
// container is created once at startup and shared across all clients — it
// auto-migrates the whatsmeow_* tables on first use.
//
// What's intentionally NOT here yet:
//   - reconnect on process restart (linked users would need their clients
//     spun up again on boot). Lands with the message-bridging chunk.
//   - multi-device fanout. One client per user for now.
type Manager struct {
	container *sqlstore.Container
	repo      *Repository
	logger    waLog.Logger

	mu      sync.Mutex
	clients map[uuid.UUID]*whatsmeow.Client
}

// NewManager opens the whatsmeow sqlstore against the same Postgres we use
// for the rest of the app, and prepares an empty client map.
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
		clients:   make(map[uuid.UUID]*whatsmeow.Client),
	}, nil
}

// Close disconnects every active client. Best-effort.
func (m *Manager) Close() {
	m.mu.Lock()
	defer m.mu.Unlock()
	for id, c := range m.clients {
		c.Disconnect()
		delete(m.clients, id)
	}
}

// StartPairing creates a fresh device, connects anonymously to WhatsApp,
// requests a phone-pairing code, and registers the event handlers that
// persist a successful pair into wa_bridges. Returns the formatted code
// (XXXX-XXXX) and its expiry timestamp.
func (m *Manager) StartPairing(ctx context.Context, userID uuid.UUID, phone string) (string, time.Time, error) {
	// Strip + and any spacing — whatsmeow wants pure digits for PairPhone.
	cleanPhone := strings.NewReplacer("+", "", " ", "", "-", "").Replace(phone)

	// Drop any previous client for this user — they're starting over.
	m.dropClient(userID)

	deviceStore := m.container.NewDevice()
	client := whatsmeow.NewClient(deviceStore, m.logger)

	client.AddEventHandler(m.eventHandler(userID))

	if err := client.Connect(); err != nil {
		return "", time.Time{}, fmt.Errorf("connect to whatsapp: %w", err)
	}

	// Display name shown on WhatsApp's "Linked devices" list.
	const displayName = "Socialize"
	code, err := client.PairPhone(ctx, cleanPhone, true, whatsmeow.PairClientChrome, displayName)
	if err != nil {
		client.Disconnect()
		return "", time.Time{}, fmt.Errorf("pair phone: %w", err)
	}

	// Pairing codes are good for ~2 minutes per WhatsApp. We expose this so
	// the client can show a countdown / refresh button at the right time.
	expires := time.Now().Add(120 * time.Second)

	m.mu.Lock()
	m.clients[userID] = client
	m.mu.Unlock()

	return formatPairingCode(code), expires, nil
}

// IsConnected reports whether we still have a live client and it's online.
func (m *Manager) IsConnected(userID uuid.UUID) bool {
	m.mu.Lock()
	c, ok := m.clients[userID]
	m.mu.Unlock()
	return ok && c != nil && c.IsConnected() && c.IsLoggedIn()
}

// Unlink logs out from WhatsApp (server-side revoke) and drops the local
// session. If the user wasn't connected, this is a no-op success.
func (m *Manager) Unlink(ctx context.Context, userID uuid.UUID) error {
	m.mu.Lock()
	c, ok := m.clients[userID]
	if ok {
		delete(m.clients, userID)
	}
	m.mu.Unlock()

	if !ok || c == nil {
		return nil
	}
	if c.IsLoggedIn() {
		if err := c.Logout(ctx); err != nil && !errors.Is(err, whatsmeow.ErrNotLoggedIn) {
			c.Disconnect()
			return fmt.Errorf("logout: %w", err)
		}
	}
	c.Disconnect()
	return nil
}

func (m *Manager) dropClient(userID uuid.UUID) {
	m.mu.Lock()
	c, ok := m.clients[userID]
	if ok {
		delete(m.clients, userID)
	}
	m.mu.Unlock()
	if ok && c != nil {
		c.Disconnect()
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
			m.dropClient(userID)
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
