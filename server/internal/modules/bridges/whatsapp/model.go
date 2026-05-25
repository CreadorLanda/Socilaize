// Package whatsapp is the Socialize API side of the WhatsApp bridge.
//
// Unlike the typical mautrix-whatsapp setup (which proxies through a Matrix
// homeserver), this module embeds the whatsmeow library directly. We're not
// a Matrix bridge — we relay messages between our own users and WhatsApp.
//
// Each linked user has one in-process whatsmeow.Client driven by the bridge
// Manager. Their session bytes live in the whatsmeow_* tables that the
// sqlstore container manages automatically; everything we own
// (status, pairing code, last error) lives in wa_bridges.
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
type bridgeRow struct {
	Phone            string
	JID              *string
	Status           Status
	PairingCode      *string
	PairingExpiresAt *time.Time
	LastError        *string
	LinkedAt         *time.Time
}
