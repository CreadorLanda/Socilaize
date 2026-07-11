package users

import (
	"context"
	"errors"
	"regexp"

	"github.com/google/uuid"
)

var (
	ErrNotFound        = errors.New("user_not_found")
	ErrUsernameInvalid = errors.New("username_invalid")
	ErrUsernameTaken   = errors.New("username_taken")
)

// usernameRe — same rule the mobile client uses (3–20 chars, lowercase
// letters, digits, underscores). Validating server-side too keeps the
// invariant: every username row in the DB is well-formed.
var usernameRe = regexp.MustCompile(`^[a-z0-9_]{3,20}$`)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// Me returns the authenticated user's full profile.
func (s *Service) Me(ctx context.Context, userID uuid.UUID) (*User, error) {
	u, err := s.repo.ByID(ctx, userID)
	if IsNoRows(err) {
		return nil, ErrNotFound
	}
	return u, err
}

// ByUsername — public lookup. Honours username_public: if the target's
// username is private, only contacts can see it. Contact graph isn't here
// yet, so for now private = 404 unless it's the same user.
func (s *Service) ByUsername(ctx context.Context, callerID uuid.UUID, username string) (*User, error) {
	u, err := s.repo.ByUsername(ctx, username)
	if IsNoRows(err) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if !u.UsernamePublic && u.ID != callerID {
		return nil, ErrNotFound
	}
	return u, nil
}

// CheckAvailability — strict username validation + uniqueness check.
func (s *Service) CheckAvailability(ctx context.Context, callerID uuid.UUID, username string) (AvailabilityResponse, error) {
	if !usernameRe.MatchString(username) {
		return AvailabilityResponse{Username: username, Available: false}, ErrUsernameInvalid
	}
	taken, err := s.repo.IsUsernameTaken(ctx, username, callerID)
	if err != nil {
		return AvailabilityResponse{}, err
	}
	return AvailabilityResponse{Username: username, Available: !taken}, nil
}

// Search finds users by username or display_name. Only returns users who
// have username_public = true. The caller is excluded from results.
func (s *Service) Search(ctx context.Context, callerID uuid.UUID, query string) ([]User, error) {
	if len(query) < 2 {
		return nil, nil
	}
	return s.repo.Search(ctx, query, callerID)
}

// Patch applies a profile patch. Validates the username (when supplied)
// and surfaces a precise error so the controller can map it to 409.
func (s *Service) Patch(ctx context.Context, userID uuid.UUID, p PatchRequest) (*User, error) {
	if p.Username != nil {
		if !usernameRe.MatchString(*p.Username) {
			return nil, ErrUsernameInvalid
		}
		taken, err := s.repo.IsUsernameTaken(ctx, *p.Username, userID)
		if err != nil {
			return nil, err
		}
		if taken {
			return nil, ErrUsernameTaken
		}
	}
	u, err := s.repo.Patch(ctx, userID, p)
	if IsNoRows(err) {
		return nil, ErrNotFound
	}
	return u, err
}
