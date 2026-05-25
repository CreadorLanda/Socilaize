package whatsapp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// Manager is now a thin HTTP client to the wa-bridge sidecar (a Baileys-
// backed Node service). The sidecar owns the WhatsApp WebSocket and the
// per-user auth state on disk; we just orchestrate from Go.
//
// All requests use a shared Bearer token. The sidecar refuses anything
// without it, and the matching webhook handler in this package refuses
// inbound events without it too — so a stray request can't impersonate
// either side from outside the docker network.
type Manager struct {
	bridgeURL string
	token     string
	http      *http.Client
}

// NewManager builds the client. If bridgeURL is empty the manager still
// works but every call returns ErrBridgeDisabled — the controller maps
// that to 503 so the rest of the API stays alive.
func NewManager(bridgeURL, internalToken string) *Manager {
	return &Manager{
		bridgeURL: bridgeURL,
		token:     internalToken,
		http: &http.Client{
			// Pair requests hit WhatsApp's servers; a fresh handshake can
			// take a few seconds. 15s is generous without being abusive.
			Timeout: 15 * time.Second,
		},
	}
}

// Close is a no-op now (the sidecar owns lifecycle). Kept so the server
// package can call it unconditionally on shutdown.
func (m *Manager) Close() {}

// ErrBridgeDisabled means no WA_BRIDGE_URL was configured.
var ErrBridgeDisabled = errors.New("wa_bridge_disabled")

// PairingResult mirrors the sidecar's /pair/start response shape.
type PairingResult struct {
	PairingCode string `json:"pairing_code"`
	ExpiresAt   string `json:"expires_at"`
}

// StartPairing asks the sidecar to issue a pairing code. The sidecar
// reuses Baileys' on-disk creds for this user_id if any exist, so retries
// look like one client reconnecting (the whole point of the switch from
// whatsmeow's NewDevice-per-attempt pattern).
func (m *Manager) StartPairing(ctx context.Context, userID uuid.UUID, phone string) (string, time.Time, error) {
	if m.bridgeURL == "" {
		return "", time.Time{}, ErrBridgeDisabled
	}
	body, _ := json.Marshal(map[string]string{
		"user_id": userID.String(),
		"phone":   phone,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		m.bridgeURL+"/pair/start", bytes.NewReader(body))
	if err != nil {
		return "", time.Time{}, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+m.token)

	res, err := m.http.Do(req)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("call bridge: %w", err)
	}
	defer res.Body.Close()

	raw, _ := io.ReadAll(res.Body)

	if res.StatusCode == http.StatusOK {
		var out PairingResult
		if err := json.Unmarshal(raw, &out); err != nil {
			return "", time.Time{}, fmt.Errorf("decode bridge response: %w", err)
		}
		expires, perr := time.Parse(time.RFC3339, out.ExpiresAt)
		if perr != nil {
			// Don't fail the whole flow on a malformed timestamp from the
			// sidecar — just default to 2 minutes (Baileys' nominal TTL).
			expires = time.Now().Add(120 * time.Second)
		}
		return out.PairingCode, expires, nil
	}

	// Map the sidecar's error envelope back into sentinels so service.go
	// can return the same HTTP codes it always did.
	var envelope struct {
		Error  string `json:"error"`
		Detail string `json:"detail,omitempty"`
	}
	_ = json.Unmarshal(raw, &envelope)
	log.Warn().
		Str("user", userID.String()).
		Str("phone", phone).
		Int("status", res.StatusCode).
		Str("error", envelope.Error).
		Str("detail", envelope.Detail).
		Msg("wa: pair start failed")
	return "", time.Time{}, classifyByEnvelope(envelope.Error, envelope.Detail)
}

// IsConnected is a best-effort liveness check — we ask the sidecar for
// the user's current status. Used by service.Status to demote stale rows.
func (m *Manager) IsConnected(userID uuid.UUID) bool {
	if m.bridgeURL == "" {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		m.bridgeURL+"/pair/status?user_id="+userID.String(), nil)
	if err != nil {
		return false
	}
	req.Header.Set("Authorization", "Bearer "+m.token)
	res, err := m.http.Do(req)
	if err != nil {
		return false
	}
	defer res.Body.Close()
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return false
	}
	return body.Status == "linked"
}

// Unlink asks the sidecar to logout and wipe the user's creds.
func (m *Manager) Unlink(ctx context.Context, userID uuid.UUID) error {
	if m.bridgeURL == "" {
		return nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete,
		m.bridgeURL+"/pair/"+userID.String(), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+m.token)
	res, err := m.http.Do(req)
	if err != nil {
		return fmt.Errorf("call bridge: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("bridge unlink returned %d", res.StatusCode)
	}
	return nil
}

// InternalToken is exposed so the webhook handler can verify inbound
// events against the same shared secret.
func (m *Manager) InternalToken() string { return m.token }

// classifyByEnvelope maps the sidecar's stable error strings onto our
// existing service-level sentinels. Keeps the controller's HTTP mapping
// (429 / 422 / 502) unchanged.
func classifyByEnvelope(code, detail string) error {
	switch code {
	case "pairing_rate_limited":
		return ErrPairingRateLimited
	case "phone_not_on_whatsapp":
		return ErrPhoneNotOnWhatsApp
	default:
		if detail != "" {
			return fmt.Errorf("start pairing: %s: %s", code, detail)
		}
		return fmt.Errorf("start pairing: %s", code)
	}
}
