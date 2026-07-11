package groups

import (
	"context"
	"time"

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

func (r *Repository) Create(
	ctx context.Context,
	creator uuid.UUID,
	title, description, avatar string,
	memberIDs []uuid.UUID,
) (uuid.UUID, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	defer tx.Rollback(ctx)

	var id uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO chats (type, title, description, avatar_url, created_by, status)
		VALUES ('group', $1, NULLIF($2,''), NULLIF($3,''), $4, 'active')
		RETURNING id
	`, title, description, avatar, creator).Scan(&id)
	if err != nil {
		return uuid.Nil, err
	}

	// Creator as admin
	if _, err := tx.Exec(ctx, `
		INSERT INTO chat_participants (chat_id, user_id, role)
		VALUES ($1, $2, 'admin')
	`, id, creator); err != nil {
		return uuid.Nil, err
	}

	seen := map[uuid.UUID]struct{}{creator: {}}
	for _, mid := range memberIDs {
		if _, ok := seen[mid]; ok {
			continue
		}
		seen[mid] = struct{}{}
		if _, err := tx.Exec(ctx, `
			INSERT INTO chat_participants (chat_id, user_id, role)
			VALUES ($1, $2, 'member')
			ON CONFLICT DO NOTHING
		`, id, mid); err != nil {
			return uuid.Nil, err
		}
	}

	// System message: group created
	if _, err := tx.Exec(ctx, `
		INSERT INTO messages (chat_id, sender_id, content, message_type)
		VALUES ($1, $2, $3, 'system')
	`, id, creator, "group_created"); err != nil {
		return uuid.Nil, err
	}

	return id, tx.Commit(ctx)
}

type groupRow struct {
	ID             uuid.UUID
	Title          *string
	Description    *string
	AvatarURL      *string
	CreatedBy      uuid.UUID
	CreatedAt      time.Time
	HistoryEnabled bool
	HistoryMode    string
	HistoryLimit   int
}

func (r *Repository) Get(ctx context.Context, id uuid.UUID) (groupRow, error) {
	const q = `
		SELECT id, title, description, avatar_url, created_by, created_at,
		       history_enabled, history_mode, history_limit
		FROM chats
		WHERE id = $1 AND type = 'group'
	`
	var g groupRow
	err := r.db.QueryRow(ctx, q, id).Scan(
		&g.ID, &g.Title, &g.Description, &g.AvatarURL, &g.CreatedBy, &g.CreatedAt,
		&g.HistoryEnabled, &g.HistoryMode, &g.HistoryLimit,
	)
	return g, err
}

func (r *Repository) ListForUser(ctx context.Context, userID uuid.UUID) ([]groupRow, error) {
	const q = `
		SELECT c.id, c.title, c.description, c.avatar_url, c.created_by, c.created_at,
		       c.history_enabled, c.history_mode, c.history_limit
		FROM chats c
		JOIN chat_participants cp ON cp.chat_id = c.id
		WHERE c.type = 'group' AND cp.user_id = $1
		ORDER BY c.created_at DESC
	`
	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []groupRow
	for rows.Next() {
		var g groupRow
		if err := rows.Scan(
			&g.ID, &g.Title, &g.Description, &g.AvatarURL, &g.CreatedBy, &g.CreatedAt,
			&g.HistoryEnabled, &g.HistoryMode, &g.HistoryLimit,
		); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func (r *Repository) ListMembers(ctx context.Context, chatID uuid.UUID) ([]Member, error) {
	const q = `
		SELECT cp.user_id, COALESCE(u.username,''), COALESCE(u.display_name,''),
		       COALESCE(u.avatar_uri,''), COALESCE(cp.role,'member'), cp.joined_at
		FROM chat_participants cp
		JOIN users u ON u.id = cp.user_id
		WHERE cp.chat_id = $1
		ORDER BY cp.role DESC, cp.joined_at ASC
	`
	rows, err := r.db.Query(ctx, q, chatID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Member
	for rows.Next() {
		var m Member
		var role string
		if err := rows.Scan(&m.UserID, &m.Username, &m.DisplayName, &m.AvatarURI, &role, &m.JoinedAt); err != nil {
			return nil, err
		}
		m.Role = MemberRole(role)
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *Repository) MemberRole(ctx context.Context, chatID, userID uuid.UUID) (MemberRole, error) {
	var role string
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(role,'member') FROM chat_participants
		WHERE chat_id = $1 AND user_id = $2
	`, chatID, userID).Scan(&role)
	if err != nil {
		return "", err
	}
	return MemberRole(role), nil
}

func (r *Repository) IsParticipant(ctx context.Context, chatID, userID uuid.UUID) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM chat_participants WHERE chat_id = $1 AND user_id = $2)
	`, chatID, userID).Scan(&ok)
	return ok, err
}

func (r *Repository) Patch(
	ctx context.Context,
	id uuid.UUID,
	title, description, avatar *string,
	histEnabled *bool,
	histMode *HistoryMode,
	histLimit *int,
) error {
	// Single UPDATE with COALESCE for optional fields.
	_, err := r.db.Exec(ctx, `
		UPDATE chats SET
			title = COALESCE($2, title),
			description = COALESCE($3, description),
			avatar_url = COALESCE($4, avatar_url),
			history_enabled = COALESCE($5, history_enabled),
			history_mode = COALESCE($6, history_mode),
			history_limit = COALESCE($7, history_limit)
		WHERE id = $1 AND type = 'group'
	`, id, title, description, avatar, histEnabled, histMode, histLimit)
	return err
}

func (r *Repository) AddMember(ctx context.Context, chatID, userID uuid.UUID, role MemberRole) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO chat_participants (chat_id, user_id, role)
		VALUES ($1, $2, $3)
		ON CONFLICT (chat_id, user_id) DO NOTHING
	`, chatID, userID, string(role))
	return err
}

func (r *Repository) RemoveMember(ctx context.Context, chatID, userID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM chat_participants WHERE chat_id = $1 AND user_id = $2
	`, chatID, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r *Repository) SetRole(ctx context.Context, chatID, userID uuid.UUID, role MemberRole) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE chat_participants SET role = $3
		WHERE chat_id = $1 AND user_id = $2
	`, chatID, userID, string(role))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r *Repository) AdminCount(ctx context.Context, chatID uuid.UUID) (int, error) {
	var n int
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM chat_participants
		WHERE chat_id = $1 AND role = 'admin'
	`, chatID).Scan(&n)
	return n, err
}

func (r *Repository) InsertSystem(ctx context.Context, chatID, actor uuid.UUID, text string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO messages (chat_id, sender_id, content, message_type)
		VALUES ($1, $2, $3, 'system')
	`, chatID, actor, text)
	return err
}
