package stories

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	ErrNotFound     = errors.New("story_not_found")
	ErrNotAuthor    = errors.New("not_story_author")
	ErrInvalidKind  = errors.New("invalid_kind")
	ErrInvalidVis   = errors.New("invalid_visibility")
	ErrNeedMedia    = errors.New("media_required")
	ErrEmptyCaption = errors.New("empty_caption")
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) toStory(x row, me uuid.UUID) Story {
	media := ""
	if x.MediaURL != nil {
		media = *x.MediaURL
	}
	name, user, avatar := x.AuthorName, x.AuthorUser, x.AuthorAvatar
	if x.IsAnonymous && x.AuthorID != me {
		name, user, avatar = "Anonymous", "", ""
	}
	return Story{
		ID:           x.ID,
		AuthorID:     x.AuthorID,
		AuthorName:   name,
		AuthorUser:   user,
		AuthorAvatar: avatar,
		Kind:         Kind(x.Kind),
		Caption:      x.Caption,
		MediaURL:     media,
		Accent:       x.Accent,
		Visibility:   Visibility(x.Visibility),
		IsAnonymous:  x.IsAnonymous,
		DurationSec:  x.DurationSec,
		ExpiresAt:    x.ExpiresAt,
		CreatedAt:    x.CreatedAt,
		Viewers:      x.Viewers,
		IsViewed:     x.IsViewed,
		IsOwn:        x.AuthorID == me,
	}
}

func (s *Service) Create(ctx context.Context, author uuid.UUID, req CreateRequest) (Story, error) {
	kind := req.Kind
	switch kind {
	case KindImage, KindVideo, KindText, KindAudio, KindPoll, KindQuestion:
	default:
		return Story{}, ErrInvalidKind
	}
	vis := req.Visibility
	if vis == "" {
		vis = VisContacts
	}
	switch vis {
	case VisPublic, VisContacts, VisClose:
	default:
		return Story{}, ErrInvalidVis
	}
	caption := strings.TrimSpace(req.Caption)
	// Text-like kinds need a caption (poll/question store options in caption).
	if (kind == KindText || kind == KindPoll || kind == KindQuestion) && caption == "" {
		return Story{}, ErrEmptyCaption
	}
	if (kind == KindImage || kind == KindVideo || kind == KindAudio) && strings.TrimSpace(req.MediaURL) == "" {
		return Story{}, ErrNeedMedia
	}
	accent := req.Accent
	if accent == "" {
		accent = "#2D5BFF"
	}
	dur := req.DurationSec
	if dur <= 0 {
		dur = 5
	}
	if dur > 30 {
		dur = 30
	}
	ttl := req.TTLHours
	if ttl <= 0 {
		ttl = 24
	}
	if ttl > 48 {
		ttl = 48
	}
	expires := time.Now().UTC().Add(time.Duration(ttl) * time.Hour)

	id, err := s.repo.Insert(ctx, author, kind, caption, strings.TrimSpace(req.MediaURL), accent, vis, req.IsAnonymous, dur, expires)
	if err != nil {
		return Story{}, err
	}
	return s.Get(ctx, id, author)
}

func (s *Service) Get(ctx context.Context, id, viewer uuid.UUID) (Story, error) {
	x, err := s.repo.Get(ctx, id, viewer)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Story{}, ErrNotFound
		}
		return Story{}, err
	}
	return s.toStory(x, viewer), nil
}

func (s *Service) Feed(ctx context.Context, viewer uuid.UUID) ([]Story, error) {
	rows, err := s.repo.Feed(ctx, viewer)
	if err != nil {
		return nil, err
	}
	out := make([]Story, 0, len(rows))
	for _, x := range rows {
		out = append(out, s.toStory(x, viewer))
	}
	return out, nil
}

func (s *Service) View(ctx context.Context, id, viewer uuid.UUID) (Story, error) {
	st, err := s.Get(ctx, id, viewer)
	if err != nil {
		return Story{}, err
	}
	if st.AuthorID != viewer {
		_ = s.repo.MarkViewed(ctx, id, viewer)
		st, _ = s.Get(ctx, id, viewer)
	}
	return st, nil
}

func (s *Service) Delete(ctx context.Context, id, author uuid.UUID) error {
	err := s.repo.Delete(ctx, id, author)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func (s *Service) React(ctx context.Context, id, user uuid.UUID, emoji string) error {
	if _, err := s.Get(ctx, id, user); err != nil {
		return err
	}
	emoji = strings.TrimSpace(emoji)
	if emoji == "" {
		return ErrInvalidKind
	}
	return s.repo.React(ctx, id, user, emoji)
}
