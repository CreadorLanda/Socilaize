package channels

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Invitations to help run a channel.
//
// Adding someone as admin or publisher used to take effect immediately, which
// meant a stranger could put your name against whatever their channel
// published. The grant now waits for you to say yes.

var (
	ErrInviteNotFound = errors.New("invite_not_found")
	// ErrInvitePending is not a failure: the request was created and is
	// waiting. It is an error value so callers cannot mistake the empty
	// Member for a completed grant.
	ErrInvitePending = errors.New("invite_pending")
)

// invitable are the roles that require the person's agreement. Plain
// membership is absent: that is following, which people do to themselves.
var invitable = map[MemberRole]bool{
	RoleAdmin:     true,
	RolePublisher: true,
}

// RoleInvite is one pending request, as the person being asked sees it.
type RoleInvite struct {
	ID uuid.UUID `json:"id"`
	// Enough of the channel to decide without opening it.
	ChannelID     uuid.UUID  `json:"channel_id"`
	ChannelName   string     `json:"channel_name"`
	ChannelHandle string     `json:"channel_handle"`
	ChannelAvatar string     `json:"channel_avatar,omitempty"`
	Role          MemberRole `json:"role"`
	// Who asked. Named on purpose: "someone made you an admin" is not a
	// decision anyone can weigh.
	InvitedByName string    `json:"invited_by_name"`
	InvitedByUser string    `json:"invited_by_username"`
	CreatedAt     time.Time `json:"created_at"`
}

// ── repository ──────────────────────────────────────────────────────────────

func (r *Repository) upsertInvite(ctx context.Context, channelID, userID, invitedBy uuid.UUID, role MemberRole) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO channel_role_invites (channel_id, user_id, role, invited_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (channel_id, user_id) DO UPDATE
		   SET role = EXCLUDED.role, invited_by = EXCLUDED.invited_by, created_at = NOW()
	`, channelID, userID, string(role), invitedBy)
	return err
}

func (r *Repository) invitesForUser(ctx context.Context, userID uuid.UUID) ([]RoleInvite, error) {
	rows, err := r.db.Query(ctx, `
		SELECT i.id, i.channel_id, c.name, c.handle, COALESCE(c.avatar_url, ''),
		       i.role, COALESCE(u.display_name, ''), u.username, i.created_at
		FROM channel_role_invites i
		JOIN channels c ON c.id = i.channel_id
		JOIN users u ON u.id = i.invited_by
		WHERE i.user_id = $1
		ORDER BY i.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []RoleInvite{}
	for rows.Next() {
		var v RoleInvite
		if err := rows.Scan(&v.ID, &v.ChannelID, &v.ChannelName, &v.ChannelHandle,
			&v.ChannelAvatar, &v.Role, &v.InvitedByName, &v.InvitedByUser,
			&v.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// inviteFor resolves an invitation, scoped to the person it was sent to.
// Anyone else gets no rows, so an id alone reveals nothing.
func (r *Repository) inviteFor(ctx context.Context, inviteID, userID uuid.UUID) (channelID uuid.UUID, role MemberRole, err error) {
	err = r.db.QueryRow(ctx, `
		SELECT channel_id, role FROM channel_role_invites
		WHERE id = $1 AND user_id = $2
	`, inviteID, userID).Scan(&channelID, &role)
	return
}

func (r *Repository) deleteInvite(ctx context.Context, inviteID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM channel_role_invites WHERE id = $1`, inviteID)
	return err
}

// ── service ─────────────────────────────────────────────────────────────────

// PendingInvites lists the requests waiting on the caller.
func (s *Service) PendingInvites(ctx context.Context, userID uuid.UUID) ([]RoleInvite, error) {
	return s.repo.invitesForUser(ctx, userID)
}

// AcceptInvite grants the role that was offered.
//
// The role is read from the stored invitation rather than from the request,
// so accepting cannot be turned into a way to award yourself a better one.
func (s *Service) AcceptInvite(ctx context.Context, inviteID, userID uuid.UUID) (uuid.UUID, error) {
	channelID, role, err := s.repo.inviteFor(ctx, inviteID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, ErrInviteNotFound
		}
		return uuid.Nil, err
	}
	if err := s.repo.upsertMember(ctx, channelID, userID, role); err != nil {
		return uuid.Nil, err
	}
	return channelID, s.repo.deleteInvite(ctx, inviteID)
}

// DeclineInvite drops the request. The channel is not told, and nothing is
// recorded: a refusal that leaves a trace is a refusal people hesitate over.
func (s *Service) DeclineInvite(ctx context.Context, inviteID, userID uuid.UUID) error {
	if _, _, err := s.repo.inviteFor(ctx, inviteID, userID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInviteNotFound
		}
		return err
	}
	return s.repo.deleteInvite(ctx, inviteID)
}
