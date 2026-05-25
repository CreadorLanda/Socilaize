package whatsapp

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository { return &Repository{db: db} }

// UpsertPending records the start of a link attempt: phone + pairing code +
// expiry. If a row already exists for the user we overwrite — the user is
// asking to re-pair, and the old code is no longer useful anyway.
func (r *Repository) UpsertPending(ctx context.Context, userID uuid.UUID, phone, code string, expiresAt time.Time) error {
	const q = `
		INSERT INTO wa_bridges (user_id, phone, status, pairing_code, pairing_expires_at, updated_at)
		VALUES ($1, $2, 'pending', $3, $4, NOW())
		ON CONFLICT (user_id) DO UPDATE
		   SET phone              = EXCLUDED.phone,
		       status             = 'pending',
		       pairing_code       = EXCLUDED.pairing_code,
		       pairing_expires_at = EXCLUDED.pairing_expires_at,
		       jid                = NULL,
		       last_error         = NULL,
		       linked_at          = NULL,
		       updated_at         = NOW()
	`
	_, err := r.db.Exec(ctx, q, userID, phone, code, expiresAt)
	return err
}

// MarkLinked is called from the pair_success event handler — clears the
// pairing code and stamps linked_at.
func (r *Repository) MarkLinked(ctx context.Context, userID uuid.UUID, jid string) error {
	const q = `
		UPDATE wa_bridges
		SET status             = 'linked',
		    jid                = $2,
		    pairing_code       = NULL,
		    pairing_expires_at = NULL,
		    last_error         = NULL,
		    linked_at          = NOW(),
		    updated_at         = NOW()
		WHERE user_id = $1
	`
	ct, err := r.db.Exec(ctx, q, userID, jid)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("no wa_bridge row for user %s", userID)
	}
	return nil
}

// MarkFailed surfaces an error to /status without dropping the row.
func (r *Repository) MarkFailed(ctx context.Context, userID uuid.UUID, reason string) error {
	const q = `
		UPDATE wa_bridges
		SET status     = 'failed',
		    last_error = $2,
		    updated_at = NOW()
		WHERE user_id = $1
	`
	_, err := r.db.Exec(ctx, q, userID, reason)
	return err
}

// MarkDisconnected — explicit unlink or remote logout.
func (r *Repository) MarkDisconnected(ctx context.Context, userID uuid.UUID) error {
	const q = `
		UPDATE wa_bridges
		SET status     = 'disconnected',
		    updated_at = NOW()
		WHERE user_id = $1
	`
	_, err := r.db.Exec(ctx, q, userID)
	return err
}

// Get fetches the user's bridge row, or pgx.ErrNoRows if there's none.
func (r *Repository) Get(ctx context.Context, userID uuid.UUID) (*bridgeRow, error) {
	const q = `
		SELECT phone, jid, status, pairing_code, pairing_expires_at, last_error, linked_at, updated_at
		FROM wa_bridges
		WHERE user_id = $1
	`
	row := r.db.QueryRow(ctx, q, userID)
	var b bridgeRow
	if err := row.Scan(&b.Phone, &b.JID, &b.Status, &b.PairingCode, &b.PairingExpiresAt, &b.LastError, &b.LinkedAt, &b.UpdatedAt); err != nil {
		return nil, err
	}
	return &b, nil
}

// UpsertFailed records a failed pairing attempt for the cooldown logic.
// We persist the phone so the user can see what was attempted, and the
// reason so /status surfaces something actionable.
func (r *Repository) UpsertFailed(ctx context.Context, userID uuid.UUID, phone, reason string) error {
	const q = `
		INSERT INTO wa_bridges (user_id, phone, status, last_error, updated_at)
		VALUES ($1, $2, 'failed', $3, NOW())
		ON CONFLICT (user_id) DO UPDATE
		   SET phone              = EXCLUDED.phone,
		       status             = 'failed',
		       last_error         = EXCLUDED.last_error,
		       pairing_code       = NULL,
		       pairing_expires_at = NULL,
		       updated_at         = NOW()
	`
	_, err := r.db.Exec(ctx, q, userID, phone, reason)
	return err
}

// Delete removes the bridge row entirely — used when the user wants a
// hard wipe (not just disconnect).
func (r *Repository) Delete(ctx context.Context, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM wa_bridges WHERE user_id = $1`, userID)
	return err
}

// IsNoRows keeps pgx out of caller imports.
func IsNoRows(err error) bool { return err != nil && errors.Is(err, pgx.ErrNoRows) }
