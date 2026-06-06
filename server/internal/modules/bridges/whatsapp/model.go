// Package whatsapp is the Socialize API side of the WhatsApp bridge.
//
// The Go API talks HTTP to a Baileys sidecar (server/wa-bridge). The
// sidecar owns the WhatsApp WebSocket and per-user auth state on disk;
// we handle persistence, routing, and the user-facing REST API.
//
// Each linked user has one entry in wa_bridges (status, pairing code).
// Incoming messages land in wa_messages.
package whatsapp

import "time"

// Status enumerates the bridge state shown to the client.
type Status string

const (
	StatusPending      Status = "pending"      // pairing code returned, awaiting user entry
	StatusLinked       Status = "linked"       // pair_success seen, session persisted
	StatusFailed       Status = "failed"       // pair_error, code expired, etc.
	StatusDisconnected Status = "disconnected" // explicit unlink (or remote logout)
)

// LinkRequest is the JSON body of POST /bridges/whatsapp/link.
//
// Phone is the WhatsApp-bound number, in E.164. The client passes the user's
// registration phone if `use_same` is true; either way the server validates
// the format and treats `phone` as authoritative.
type LinkRequest struct {
	Phone string `json:"phone" binding:"required,e164"`
}

// LinkResponse carries the pairing code the user must enter on their phone:
//
//   WhatsApp → Linked devices → Link with phone number → enter code
//
// The code is 8 characters, conventionally formatted XXXX-XXXX. It expires
// after ~120 seconds — we surface that via PairingExpiresAt.
type LinkResponse struct {
	Status            Status     `json:"status"`
	Phone             string     `json:"phone"`
	PairingCode       string     `json:"pairing_code"`
	PairingExpiresAt  time.Time  `json:"pairing_expires_at"`
}

// StatusResponse is the polled view of a user's bridge.
type StatusResponse struct {
	Status            Status     `json:"status"`
	Phone             string     `json:"phone,omitempty"`
	JID               string     `json:"jid,omitempty"`
	PairingCode       string     `json:"pairing_code,omitempty"`
	PairingExpiresAt  *time.Time `json:"pairing_expires_at,omitempty"`
	LastError         string     `json:"last_error,omitempty"`
	LinkedAt          *time.Time `json:"linked_at,omitempty"`
}

// bridgeRow is the persistence-level shape, populated from wa_bridges.
// UpdatedAt is used by the service's local rate-limit cooldown check.
type bridgeRow struct {
	Phone            string
	JID              *string
	Status           Status
	PairingCode      *string
	PairingExpiresAt *time.Time
	LastError        *string
	LinkedAt         *time.Time
	UpdatedAt        *time.Time
}
