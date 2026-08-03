package stickers

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// mediaMeta is what we need from an uploaded blob to validate it as a
// sticker before committing the pack.
type mediaMeta struct {
	ID     uuid.UUID
	Owner  uuid.UUID
	Mime   string
	Size   int64
	Width  *int
	Height *int
}

// MediaForOwner loads the given media rows, but only those the caller
// owns — this is what stops a client claiming someone else's upload.
func (r *Repository) MediaForOwner(ctx context.Context, ids []uuid.UUID, owner uuid.UUID) (map[uuid.UUID]mediaMeta, error) {
	// pgx has no encode plan for []uuid.UUID, so pass text and let Postgres
	// cast. Sending the slice directly fails with "cannot find encode plan".
	list := make([]string, len(ids))
	for i, id := range ids {
		list[i] = id.String()
	}

	const q = `
		SELECT id, owner_id, mime_type, size_bytes, width, height
		FROM media_objects
		WHERE id = ANY($1::uuid[]) AND owner_id = $2
	`
	rows, err := r.db.Query(ctx, q, list, owner)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[uuid.UUID]mediaMeta, len(ids))
	for rows.Next() {
		var m mediaMeta
		if err := rows.Scan(&m.ID, &m.Owner, &m.Mime, &m.Size, &m.Width, &m.Height); err != nil {
			return nil, err
		}
		out[m.ID] = m
	}
	return out, rows.Err()
}

// CreatePack writes the pack and its stickers in one transaction, so a
// failure part-way cannot leave an empty pack behind.
func (r *Repository) CreatePack(ctx context.Context, owner uuid.UUID, req CreatePackRequest) (uuid.UUID, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx)

	var packID uuid.UUID
	// Re-importing the same bundle replaces its contents instead of
	// creating a duplicate (see the unique index on owner_id, source_id).
	err = tx.QueryRow(ctx, `
		INSERT INTO sticker_packs (owner_id, name, author, tray_media_id, source_id, animated)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (owner_id, source_id) WHERE source_id IS NOT NULL
		DO UPDATE SET name = EXCLUDED.name,
		              author = EXCLUDED.author,
		              tray_media_id = EXCLUDED.tray_media_id,
		              animated = EXCLUDED.animated
		RETURNING id
	`, owner, req.Name, req.Author, req.TrayID, req.SourceID, req.Animated).Scan(&packID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert pack: %w", err)
	}

	if _, err := tx.Exec(ctx, `DELETE FROM stickers WHERE pack_id = $1`, packID); err != nil {
		return uuid.Nil, fmt.Errorf("clear stickers: %w", err)
	}

	for i, s := range req.Stickers {
		if _, err := tx.Exec(ctx, `
			INSERT INTO stickers (pack_id, media_id, emojis, position)
			VALUES ($1, $2, $3, $4)
		`, packID, s.MediaID, s.Emojis, i); err != nil {
			return uuid.Nil, fmt.Errorf("insert sticker %d: %w", i, err)
		}
	}

	return packID, tx.Commit(ctx)
}

func (r *Repository) ListPacks(ctx context.Context, owner uuid.UUID) ([]Pack, error) {
	const q = `
		SELECT p.id, p.owner_id, p.name, p.author, p.source_id, p.animated, p.is_favorites,
		       p.created_at, p.tray_media_id,
		       (SELECT COUNT(*) FROM stickers s WHERE s.pack_id = p.id)
		FROM sticker_packs p
		WHERE p.owner_id = $1
		ORDER BY p.is_favorites DESC, p.created_at DESC
	`
	rows, err := r.db.Query(ctx, q, owner)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Pack
	for rows.Next() {
		var p Pack
		var trayID *uuid.UUID
		if err := rows.Scan(&p.ID, &p.OwnerID, &p.Name, &p.Author, &p.SourceID,
			&p.Animated, &p.IsFavorites, &p.CreatedAt, &trayID, &p.Count); err != nil {
			return nil, err
		}
		p.TrayURL = mediaURL(trayID)
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Repository) GetPack(ctx context.Context, packID, owner uuid.UUID) (*Pack, error) {
	const q = `
		SELECT p.id, p.owner_id, p.name, p.author, p.source_id, p.animated, p.is_favorites,
		       p.created_at, p.tray_media_id
		FROM sticker_packs p
		WHERE p.id = $1 AND p.owner_id = $2
	`
	var p Pack
	var trayID *uuid.UUID
	err := r.db.QueryRow(ctx, q, packID, owner).Scan(
		&p.ID, &p.OwnerID, &p.Name, &p.Author, &p.SourceID, &p.Animated, &p.IsFavorites, &p.CreatedAt, &trayID,
	)
	if err != nil {
		return nil, err
	}
	p.TrayURL = mediaURL(trayID)

	rows, err := r.db.Query(ctx, `
		SELECT s.id, s.media_id, s.emojis, s.position
		FROM stickers s
		WHERE s.pack_id = $1
		ORDER BY s.position
	`, packID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var s Sticker
		if err := rows.Scan(&s.ID, &s.MediaID, &s.Emojis, &s.Position); err != nil {
			return nil, err
		}
		s.URL = "/api/media/" + s.MediaID.String() + "/file"
		p.Stickers = append(p.Stickers, s)
	}
	p.Count = len(p.Stickers)
	return &p, rows.Err()
}

func (r *Repository) DeletePack(ctx context.Context, packID, owner uuid.UUID) error {
	tag, err := r.db.Exec(ctx,
		`DELETE FROM sticker_packs WHERE id = $1 AND owner_id = $2`, packID, owner)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

// mediaURL renders the client-facing path for a media id, matching what
// the media module returns.
func mediaURL(id *uuid.UUID) *string {
	if id == nil {
		return nil
	}
	u := "/api/media/" + id.String() + "/file"
	return &u
}

// SaveToFavorites appends one sticker to the caller's favourites pack,
// creating the pack on first use. Re-saving the same sticker is a no-op
// rather than a duplicate row.
func (r *Repository) SaveToFavorites(ctx context.Context, owner, mediaID uuid.UUID, emojis, packName string) (uuid.UUID, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx)

	var packID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO sticker_packs (owner_id, name, is_favorites)
		VALUES ($1, $2, TRUE)
		ON CONFLICT (owner_id) WHERE is_favorites
		DO UPDATE SET name = sticker_packs.name
		RETURNING id
	`, owner, packName).Scan(&packID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("favorites pack: %w", err)
	}

	// Saving the same sticker twice must be a no-op. There is no unique
	// constraint on (pack_id, media_id) — packs may legitimately repeat a
	// sticker — so dedupe explicitly rather than relying on ON CONFLICT,
	// which silently did nothing and inserted a duplicate.
	_, err = tx.Exec(ctx, `
		INSERT INTO stickers (pack_id, media_id, emojis, position)
		SELECT $1, $2, $3, COALESCE(MAX(position) + 1, 0)
		FROM stickers WHERE pack_id = $1
		HAVING NOT EXISTS (
			SELECT 1 FROM stickers WHERE pack_id = $1 AND media_id = $2
		)
	`, packID, mediaID, emojis)
	if err != nil {
		return uuid.Nil, fmt.Errorf("append sticker: %w", err)
	}

	return packID, tx.Commit(ctx)
}

// RemoveSticker deletes one sticker, but only from a pack the caller owns.
func (r *Repository) RemoveSticker(ctx context.Context, stickerID, owner uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM stickers s
		USING sticker_packs p
		WHERE s.id = $1 AND s.pack_id = p.id AND p.owner_id = $2
	`, stickerID, owner)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
