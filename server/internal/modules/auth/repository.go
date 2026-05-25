package auth

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SessionRow is the slice of the sessions table the auth service needs.
type SessionRow struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	DeviceID  uuid.UUID
	ExpiresAt time.Time
}

// Repository owns SQL access for this module. Queries live next to each
// other so a reviewer can see "all auth SQL" in one file.
type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// UserByPhoneHash returns the user by hashed phone, or pgx.ErrNoRows.
func (r *Repository) UserByPhoneHash(ctx context.Context, hash []byte) (*User, error) {
	const q = `
		SELECT id, username, display_name, created_at
		FROM users
		WHERE phone_hash = $1
	`
	row := r.db.QueryRow(ctx, q, hash)
	var u User
	if err := row.Scan(&u.ID, &u.Username, &u.DisplayName, &u.CreatedAt); err != nil {
		return nil, err
	}
	return &u, nil
}

// CreateUser inserts a fresh user, returning the populated row.
func (r *Repository) CreateUser(ctx context.Context, phoneHash []byte, username, displayName string) (*User, error) {
	id := uuid.New()
	const q = `
		INSERT INTO users (id, phone_hash, username, display_name)
		VALUES ($1, $2, $3, $4)
		RETURNING id, username, display_name, created_at
	`
	row := r.db.QueryRow(ctx, q, id, phoneHash, username, displayName)
	var u User
	if err := row.Scan(&u.ID, &u.Username, &u.DisplayName, &u.CreatedAt); err != nil {
		return nil, err
	}
	return &u, nil
}

// CreateSession persists a (hashed) session for a given user/device pair.
// Tokens are hashed before storage — the bearer keeps the originals.
func (r *Repository) CreateSession(ctx context.Context, userID, deviceID uuid.UUID, tokenHash, refreshHash []byte) error {
	const q = `
		INSERT INTO sessions (id, user_id, device_id, token_hash, refresh_hash, expires_at)
		VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days')
	`
	_, err := r.db.Exec(ctx, q, uuid.New(), userID, deviceID, tokenHash, refreshHash)
	return err
}

// SessionByRefreshHash looks up an active session by the hashed refresh token.
// Returns pgx.ErrNoRows when the token doesn't match (caller treats as
// 401 — no information leakage).
func (r *Repository) SessionByRefreshHash(ctx context.Context, refreshHash []byte) (*SessionRow, error) {
	const q = `
		SELECT id, user_id, device_id, expires_at
		FROM sessions
		WHERE refresh_hash = $1
	`
	row := r.db.QueryRow(ctx, q, refreshHash)
	var s SessionRow
	if err := row.Scan(&s.ID, &s.UserID, &s.DeviceID, &s.ExpiresAt); err != nil {
		return nil, err
	}
	return &s, nil
}

// RotateSession swaps the (token_hash, refresh_hash) pair on a session row in
// place. We keep the same row to preserve creation history and identity —
// rotation is logically the same session continuing with fresh credentials.
func (r *Repository) RotateSession(ctx context.Context, sessionID uuid.UUID, tokenHash, refreshHash []byte) error {
	const q = `
		UPDATE sessions
		SET token_hash = $1,
		    refresh_hash = $2,
		    expires_at = NOW() + INTERVAL '30 days'
		WHERE id = $3
	`
	ct, err := r.db.Exec(ctx, q, tokenHash, refreshHash, sessionID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return errors.New("session not found")
	}
	return nil
}

// RegisterDevice inserts or updates a device row, returning its id.
func (r *Repository) RegisterDevice(ctx context.Context, userID uuid.UUID, name, platform string, signalIdentity []byte) (uuid.UUID, error) {
	id := uuid.New()
	const q = `
		INSERT INTO devices (id, user_id, name, platform, signal_identity)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`
	row := r.db.QueryRow(ctx, q, id, userID, name, platform, signalIdentity)
	var out uuid.UUID
	if err := row.Scan(&out); err != nil {
		return uuid.Nil, err
	}
	return out, nil
}

// IsNoRows is a small helper so callers don't import pgx just to test it.
func IsNoRows(err error) bool { return err != nil && err == pgx.ErrNoRows }
