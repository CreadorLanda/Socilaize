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
// Revoked rows are still returned so the service can spot a replay.
type SessionRow struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	DeviceID  uuid.UUID
	FamilyID  uuid.UUID
	ExpiresAt time.Time
	Revoked   bool
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

// CreateSession persists a (hashed) session and starts a new refresh-token
// family. Returns (sessionID, familyID) so callers can record both.
//
// Tokens are hashed before storage — the bearer keeps the originals.
func (r *Repository) CreateSession(ctx context.Context, userID, deviceID uuid.UUID, tokenHash, refreshHash []byte) (uuid.UUID, uuid.UUID, error) {
	id := uuid.New()
	family := uuid.New()
	const q = `
		INSERT INTO sessions (id, user_id, device_id, token_hash, refresh_hash, expires_at, family_id)
		VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days', $6)
	`
	_, err := r.db.Exec(ctx, q, id, userID, deviceID, tokenHash, refreshHash, family)
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}
	return id, family, nil
}

// SessionByRefreshHash looks up a session by the hashed refresh token,
// *including* revoked rows. The service uses the Revoked flag to spot a
// replay (the only legitimate caller has the live token, not a revoked
// one — anyone presenting a revoked token has stolen it).
func (r *Repository) SessionByRefreshHash(ctx context.Context, refreshHash []byte) (*SessionRow, error) {
	const q = `
		SELECT id, user_id, device_id, family_id, expires_at, revoked_at IS NOT NULL
		FROM sessions
		WHERE refresh_hash = $1
	`
	row := r.db.QueryRow(ctx, q, refreshHash)
	var s SessionRow
	if err := row.Scan(&s.ID, &s.UserID, &s.DeviceID, &s.FamilyID, &s.ExpiresAt, &s.Revoked); err != nil {
		return nil, err
	}
	return &s, nil
}

// RotateSession atomically marks the parent session revoked and inserts a
// new session row with fresh hashes in the same family. Returns the new
// session id. If the parent is already revoked or gone, no rows are
// affected and ErrAlreadyRevoked is returned — the service translates
// that to a "replay detected" path.
func (r *Repository) RotateSession(
	ctx context.Context,
	parent SessionRow,
	tokenHash, refreshHash []byte,
) (uuid.UUID, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	ct, err := tx.Exec(ctx, `
		UPDATE sessions
		SET revoked_at = NOW()
		WHERE id = $1 AND revoked_at IS NULL
	`, parent.ID)
	if err != nil {
		return uuid.Nil, err
	}
	if ct.RowsAffected() == 0 {
		return uuid.Nil, ErrAlreadyRevoked
	}

	newID := uuid.New()
	if _, err := tx.Exec(ctx, `
		INSERT INTO sessions
		    (id, user_id, device_id, token_hash, refresh_hash, expires_at, family_id, parent_id)
		VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days', $6, $7)
	`, newID, parent.UserID, parent.DeviceID, tokenHash, refreshHash, parent.FamilyID, parent.ID); err != nil {
		return uuid.Nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return uuid.Nil, err
	}
	return newID, nil
}

// RevokeFamily marks every live session in a family revoked. Idempotent —
// already-revoked rows are left alone. Used both on logout (single device)
// and on replay detection (all devices in that family).
func (r *Repository) RevokeFamily(ctx context.Context, familyID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE sessions
		SET revoked_at = NOW()
		WHERE family_id = $1 AND revoked_at IS NULL
	`, familyID)
	return err
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

// ErrAlreadyRevoked is returned by RotateSession when the parent row was
// already revoked (or removed). The service treats it as a replay signal.
var ErrAlreadyRevoked = errors.New("session_already_revoked")

// IsNoRows is a small helper so callers don't import pgx just to test it.
func IsNoRows(err error) bool { return err != nil && errors.Is(err, pgx.ErrNoRows) }
