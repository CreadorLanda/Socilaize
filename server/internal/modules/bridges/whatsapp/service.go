package whatsapp

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	ErrNotFound     = errors.New("bridge_not_found")
	ErrPairingBusy  = errors.New("pairing_in_progress")
	// ErrPairingRateLimited is returned when WhatsApp closes the socket too
	// fast (typical of repeated attempts from one IP). Surface a clear UX
	// message instead of the raw "EOF" the lib emits.
	ErrPairingRateLimited = errors.New("pairing_rate_limited")
	// ErrPhoneNotOnWhatsApp covers WhatsApp's "info query 400 bad-request"
	// — that's how they refuse pairing for a number not on the platform.
	ErrPhoneNotOnWhatsApp = errors.New("phone_not_on_whatsapp")
)

type Service struct {
	repo    *Repository
	manager *Manager
}

func NewService(repo *Repository, m *Manager) *Service {
	return &Service{repo: repo, manager: m}
}

// Link starts a phone-pairing session.
//
// Defends against accidental floods:
//   - if a valid pending code already exists for this user (and the phone
//     hasn't changed), reuse it. Hitting WhatsApp again for the same code
//     wastes both rate-limit budget and a fresh device row.
//   - otherwise: request a new code, persist 'pending'.
func (s *Service) Link(ctx context.Context, userID uuid.UUID, phone string) (LinkResponse, error) {
	existing, err := s.repo.Get(ctx, userID)
	if err != nil && !IsNoRows(err) {
		return LinkResponse{}, fmt.Errorf("read existing bridge: %w", err)
	}
	if existing != nil &&
		existing.Status == StatusPending &&
		existing.Phone == phone &&
		existing.PairingCode != nil &&
		existing.PairingExpiresAt != nil &&
		time.Until(*existing.PairingExpiresAt) > 10*time.Second {
		// Same number, code still has > 10s to live — let the client use
		// the one we already issued. Saves a roundtrip to WhatsApp.
		return LinkResponse{
			Status:           StatusPending,
			Phone:            existing.Phone,
			PairingCode:      *existing.PairingCode,
			PairingExpiresAt: *existing.PairingExpiresAt,
		}, nil
	}

	code, expires, err := s.manager.StartPairing(ctx, userID, phone)
	if err != nil {
		return LinkResponse{}, classifyPairingError(err)
	}
	if err := s.repo.UpsertPending(ctx, userID, phone, code, expires); err != nil {
		return LinkResponse{}, fmt.Errorf("persist pending: %w", err)
	}
	return LinkResponse{
		Status:           StatusPending,
		Phone:            phone,
		PairingCode:      code,
		PairingExpiresAt: expires,
	}, nil
}

// classifyPairingError maps whatsmeow's raw failure modes to typed sentinels
// the controller can turn into useful HTTP codes / messages. The patterns
// here come from observed behaviour:
//
//   - "EOF" / "frame header" → WhatsApp closed the socket without a reason
//     (typical of rate-limit and unsupported clients).
//   - "info query returned status 400" → number isn't on WhatsApp.
func classifyPairingError(err error) error {
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "eof"), strings.Contains(msg, "frame header"):
		return ErrPairingRateLimited
	case strings.Contains(msg, "status 400"), strings.Contains(msg, "bad-request"):
		return ErrPhoneNotOnWhatsApp
	default:
		return fmt.Errorf("start pairing: %w", err)
	}
}

// Status — the polled view. Reads the row, and if the row says "linked"
// but the in-process client is gone (e.g. server restart), reflect that
// as "disconnected" so the client doesn't claim connection it doesn't have.
func (s *Service) Status(ctx context.Context, userID uuid.UUID) (StatusResponse, error) {
	row, err := s.repo.Get(ctx, userID)
	if IsNoRows(err) {
		return StatusResponse{Status: StatusDisconnected}, nil
	}
	if err != nil {
		return StatusResponse{}, fmt.Errorf("read bridge: %w", err)
	}
	out := StatusResponse{
		Status:   row.Status,
		Phone:    row.Phone,
		LinkedAt: row.LinkedAt,
	}
	if row.JID != nil {
		out.JID = *row.JID
	}
	if row.PairingCode != nil {
		out.PairingCode = *row.PairingCode
	}
	if row.PairingExpiresAt != nil {
		out.PairingExpiresAt = row.PairingExpiresAt
	}
	if row.LastError != nil {
		out.LastError = *row.LastError
	}
	// In-process reality check — if we claim linked but the client isn't
	// alive, demote to disconnected for this response. (We don't write
	// that back to the row; restoring the client on boot is a follow-up.)
	if out.Status == StatusLinked && !s.manager.IsConnected(userID) {
		out.Status = StatusDisconnected
	}
	return out, nil
}

// Unlink — best-effort remote logout, then drop the row.
func (s *Service) Unlink(ctx context.Context, userID uuid.UUID) error {
	if err := s.manager.Unlink(ctx, userID); err != nil {
		return fmt.Errorf("manager unlink: %w", err)
	}
	if err := s.repo.Delete(ctx, userID); err != nil {
		return fmt.Errorf("delete row: %w", err)
	}
	return nil
}
