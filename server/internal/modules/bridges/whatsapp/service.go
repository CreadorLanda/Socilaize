package whatsapp

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
)

var (
	ErrNotFound     = errors.New("bridge_not_found")
	ErrPairingBusy  = errors.New("pairing_in_progress")
)

type Service struct {
	repo    *Repository
	manager *Manager
}

func NewService(repo *Repository, m *Manager) *Service {
	return &Service{repo: repo, manager: m}
}

// Link starts a phone-pairing session: request a code from WhatsApp,
// persist a 'pending' row, return both to the controller.
func (s *Service) Link(ctx context.Context, userID uuid.UUID, phone string) (LinkResponse, error) {
	code, expires, err := s.manager.StartPairing(ctx, userID, phone)
	if err != nil {
		return LinkResponse{}, fmt.Errorf("start pairing: %w", err)
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
