package groups

import (
	"time"

	"github.com/google/uuid"
)

type MemberRole string

const (
	RoleAdmin  MemberRole = "admin"
	RoleMember MemberRole = "member"
)

type HistoryMode string

const (
	HistoryFull     HistoryMode = "full"
	HistoryViewOnly HistoryMode = "view-only"
)

type Member struct {
	UserID      uuid.UUID  `json:"user_id"`
	Username    string     `json:"username,omitempty"`
	DisplayName string     `json:"display_name"`
	AvatarURI   string     `json:"avatar_uri,omitempty"`
	Role        MemberRole `json:"role"`
	JoinedAt    time.Time  `json:"joined_at"`
}

type Group struct {
	ID             uuid.UUID   `json:"id"`
	Title          string      `json:"title"`
	Description    string      `json:"description,omitempty"`
	AvatarURL      string      `json:"avatar_url,omitempty"`
	CreatedBy      uuid.UUID   `json:"created_by"`
	CreatedAt      time.Time   `json:"created_at"`
	HistoryEnabled bool        `json:"history_enabled"`
	HistoryMode    HistoryMode `json:"history_mode"`
	// HistoryLimit is max past messages for new members; -1 = unlimited.
	HistoryLimit int      `json:"history_limit"`
	MemberCount  int      `json:"member_count"`
	Members      []Member `json:"members,omitempty"`
}

type CreateGroupRequest struct {
	Title       string      `json:"title" binding:"required"`
	Description string      `json:"description"`
	AvatarURL   string      `json:"avatar_url"`
	MemberIDs   []uuid.UUID `json:"member_ids"` // peers; creator always included as admin
}

type PatchGroupRequest struct {
	Title          *string      `json:"title"`
	Description    *string      `json:"description"`
	AvatarURL      *string      `json:"avatar_url"`
	HistoryEnabled *bool        `json:"history_enabled"`
	HistoryMode    *HistoryMode `json:"history_mode"`
	HistoryLimit   *int         `json:"history_limit"`
}

type AddMembersRequest struct {
	UserIDs []uuid.UUID `json:"user_ids" binding:"required"`
}

type SetRoleRequest struct {
	Role MemberRole `json:"role" binding:"required"`
}
