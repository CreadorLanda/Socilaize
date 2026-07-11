package groups

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	ErrNotFound       = errors.New("group_not_found")
	ErrNotMember      = errors.New("not_group_member")
	ErrNotAdmin       = errors.New("not_group_admin")
	ErrLastAdmin      = errors.New("cannot_remove_last_admin")
	ErrInvalidTitle   = errors.New("invalid_title")
	ErrInvalidRole    = errors.New("invalid_role")
	ErrInvalidHistory = errors.New("invalid_history_settings")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) toGroup(row groupRow, members []Member) Group {
	title := ""
	if row.Title != nil {
		title = *row.Title
	}
	desc := ""
	if row.Description != nil {
		desc = *row.Description
	}
	avatar := ""
	if row.AvatarURL != nil {
		avatar = *row.AvatarURL
	}
	return Group{
		ID:             row.ID,
		Title:          title,
		Description:    desc,
		AvatarURL:      avatar,
		CreatedBy:      row.CreatedBy,
		CreatedAt:      row.CreatedAt,
		HistoryEnabled: row.HistoryEnabled,
		HistoryMode:    HistoryMode(row.HistoryMode),
		HistoryLimit:   row.HistoryLimit,
		MemberCount:    len(members),
		Members:        members,
	}
}

func (s *Service) load(ctx context.Context, id uuid.UUID) (Group, error) {
	row, err := s.repo.Get(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Group{}, ErrNotFound
		}
		return Group{}, err
	}
	members, err := s.repo.ListMembers(ctx, id)
	if err != nil {
		return Group{}, err
	}
	return s.toGroup(row, members), nil
}

func (s *Service) requireMember(ctx context.Context, groupID, userID uuid.UUID) error {
	ok, err := s.repo.IsParticipant(ctx, groupID, userID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrNotMember
	}
	return nil
}

func (s *Service) requireAdmin(ctx context.Context, groupID, userID uuid.UUID) error {
	if err := s.requireMember(ctx, groupID, userID); err != nil {
		return err
	}
	role, err := s.repo.MemberRole(ctx, groupID, userID)
	if err != nil {
		return err
	}
	if role != RoleAdmin {
		return ErrNotAdmin
	}
	return nil
}

func (s *Service) Create(ctx context.Context, creator uuid.UUID, req CreateGroupRequest) (Group, error) {
	title := strings.TrimSpace(req.Title)
	if len(title) < 1 || len(title) > 80 {
		return Group{}, ErrInvalidTitle
	}
	id, err := s.repo.Create(ctx, creator, title, strings.TrimSpace(req.Description), req.AvatarURL, req.MemberIDs)
	if err != nil {
		return Group{}, err
	}
	return s.load(ctx, id)
}

func (s *Service) Get(ctx context.Context, groupID, userID uuid.UUID) (Group, error) {
	if err := s.requireMember(ctx, groupID, userID); err != nil {
		// Hide existence from non-members.
		if errors.Is(err, ErrNotMember) {
			return Group{}, ErrNotFound
		}
		return Group{}, err
	}
	return s.load(ctx, groupID)
}

func (s *Service) List(ctx context.Context, userID uuid.UUID) ([]Group, error) {
	rows, err := s.repo.ListForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]Group, 0, len(rows))
	for _, row := range rows {
		members, err := s.repo.ListMembers(ctx, row.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, s.toGroup(row, members))
	}
	return out, nil
}

func (s *Service) Patch(ctx context.Context, groupID, userID uuid.UUID, req PatchGroupRequest) (Group, error) {
	if err := s.requireAdmin(ctx, groupID, userID); err != nil {
		return Group{}, err
	}
	var title, desc, avatar *string
	if req.Title != nil {
		t := strings.TrimSpace(*req.Title)
		if len(t) < 1 || len(t) > 80 {
			return Group{}, ErrInvalidTitle
		}
		title = &t
	}
	if req.Description != nil {
		d := strings.TrimSpace(*req.Description)
		desc = &d
	}
	if req.AvatarURL != nil {
		avatar = req.AvatarURL
	}
	if req.HistoryMode != nil {
		if *req.HistoryMode != HistoryFull && *req.HistoryMode != HistoryViewOnly {
			return Group{}, ErrInvalidHistory
		}
	}
	if req.HistoryLimit != nil {
		// allow -1 (unlimited) or positive
		if *req.HistoryLimit < -1 || *req.HistoryLimit == 0 {
			return Group{}, ErrInvalidHistory
		}
	}
	if err := s.repo.Patch(ctx, groupID, title, desc, avatar, req.HistoryEnabled, req.HistoryMode, req.HistoryLimit); err != nil {
		return Group{}, err
	}
	return s.load(ctx, groupID)
}

func (s *Service) AddMembers(ctx context.Context, groupID, actor uuid.UUID, userIDs []uuid.UUID) (Group, error) {
	if err := s.requireAdmin(ctx, groupID, actor); err != nil {
		return Group{}, err
	}
	for _, uid := range userIDs {
		if uid == uuid.Nil {
			continue
		}
		if err := s.repo.AddMember(ctx, groupID, uid, RoleMember); err != nil {
			return Group{}, err
		}
	}
	_ = s.repo.InsertSystem(ctx, groupID, actor, "members_added")
	return s.load(ctx, groupID)
}

func (s *Service) RemoveMember(ctx context.Context, groupID, actor, target uuid.UUID) (Group, error) {
	// Admin can remove others; anyone can leave themselves.
	if actor != target {
		if err := s.requireAdmin(ctx, groupID, actor); err != nil {
			return Group{}, err
		}
	} else {
		if err := s.requireMember(ctx, groupID, actor); err != nil {
			return Group{}, err
		}
	}

	role, err := s.repo.MemberRole(ctx, groupID, target)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Group{}, ErrNotMember
		}
		return Group{}, err
	}
	if role == RoleAdmin {
		n, err := s.repo.AdminCount(ctx, groupID)
		if err != nil {
			return Group{}, err
		}
		if n <= 1 {
			return Group{}, ErrLastAdmin
		}
	}
	if err := s.repo.RemoveMember(ctx, groupID, target); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Group{}, ErrNotMember
		}
		return Group{}, err
	}
	_ = s.repo.InsertSystem(ctx, groupID, actor, "member_removed")
	// If actor left, they can no longer load the group — return empty-ish ok via Get error.
	if actor == target {
		return Group{ID: groupID}, nil
	}
	return s.load(ctx, groupID)
}

func (s *Service) SetRole(ctx context.Context, groupID, actor, target uuid.UUID, role MemberRole) (Group, error) {
	if err := s.requireAdmin(ctx, groupID, actor); err != nil {
		return Group{}, err
	}
	if role != RoleAdmin && role != RoleMember {
		return Group{}, ErrInvalidRole
	}
	if role == RoleMember {
		// Don't demote last admin.
		cur, err := s.repo.MemberRole(ctx, groupID, target)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return Group{}, ErrNotMember
			}
			return Group{}, err
		}
		if cur == RoleAdmin {
			n, err := s.repo.AdminCount(ctx, groupID)
			if err != nil {
				return Group{}, err
			}
			if n <= 1 {
				return Group{}, ErrLastAdmin
			}
		}
	}
	if err := s.repo.SetRole(ctx, groupID, target, role); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Group{}, ErrNotMember
		}
		return Group{}, err
	}
	return s.load(ctx, groupID)
}
