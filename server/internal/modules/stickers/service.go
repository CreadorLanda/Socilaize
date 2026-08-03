package stickers

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	ErrPackNotFound    = errors.New("pack_not_found")
	ErrTooFewStickers  = errors.New("too_few_stickers")
	ErrTooManyStickers = errors.New("too_many_stickers")
	ErrMediaNotFound   = errors.New("sticker_media_not_found")
	ErrBadFormat       = errors.New("invalid_sticker_format")
)

// MediaCopier is satisfied by *media.Service. Kept as an interface so this
// module does not import another module's service, per the layout rules.
type MediaCopier interface {
	Duplicate(ctx context.Context, srcID, newOwner uuid.UUID) (copiedID uuid.UUID, err error)
}

type Service struct {
	repo  *Repository
	media MediaCopier
}

func NewService(repo *Repository, mediaCopier MediaCopier) *Service {
	return &Service{repo: repo, media: mediaCopier}
}

// FormatIssue explains why one file was rejected, so the client can show
// the user which sticker failed rather than a blanket error.
type FormatIssue struct {
	MediaID uuid.UUID `json:"media_id"`
	Reason  string    `json:"reason"`
}

func (s *Service) CreatePack(ctx context.Context, owner uuid.UUID, req CreatePackRequest) (*Pack, []FormatIssue, error) {
	if len(req.Stickers) < MinStickersInPack {
		return nil, nil, ErrTooFewStickers
	}
	if len(req.Stickers) > MaxStickersInPack {
		return nil, nil, ErrTooManyStickers
	}

	ids := make([]uuid.UUID, 0, len(req.Stickers)+1)
	for _, st := range req.Stickers {
		ids = append(ids, st.MediaID)
	}
	if req.TrayID != nil {
		ids = append(ids, *req.TrayID)
	}

	// Only the caller's own uploads are eligible.
	metas, err := s.repo.MediaForOwner(ctx, ids, owner)
	if err != nil {
		return nil, nil, err
	}

	var issues []FormatIssue
	for _, st := range req.Stickers {
		m, ok := metas[st.MediaID]
		if !ok {
			return nil, nil, ErrMediaNotFound
		}
		if reason := validateSticker(m, req.Animated); reason != "" {
			issues = append(issues, FormatIssue{MediaID: st.MediaID, Reason: reason})
		}
	}
	if req.TrayID != nil {
		m, ok := metas[*req.TrayID]
		if !ok {
			return nil, nil, ErrMediaNotFound
		}
		if reason := validateTray(m); reason != "" {
			issues = append(issues, FormatIssue{MediaID: *req.TrayID, Reason: reason})
		}
	}
	if len(issues) > 0 {
		return nil, issues, ErrBadFormat
	}

	if strings.TrimSpace(req.Name) == "" {
		req.Name = "Stickers"
	}

	packID, err := s.repo.CreatePack(ctx, owner, req)
	if err != nil {
		return nil, nil, fmt.Errorf("create pack: %w", err)
	}
	pack, err := s.repo.GetPack(ctx, packID, owner)
	if err != nil {
		return nil, nil, err
	}
	return pack, nil, nil
}

// SaveToFavorites adds one sticker to the caller's saved pack. Unlike a
// normal pack this accepts a single sticker — see migration 0018.
func (s *Service) SaveToFavorites(ctx context.Context, owner uuid.UUID, req SaveStickerRequest, packName string) (*Pack, error) {
	mediaID := req.MediaID

	// A sticker someone else sent is not ours to reference, so take a copy
	// first. Without this, saving a received sticker failed outright, and
	// any saved one would vanish if the sender deleted their account.
	metas, err := s.repo.MediaForOwner(ctx, []uuid.UUID{mediaID}, owner)
	if err != nil {
		return nil, err
	}
	if _, mine := metas[mediaID]; !mine {
		if s.media == nil {
			return nil, ErrMediaNotFound
		}
		copied, err := s.media.Duplicate(ctx, mediaID, owner)
		if err != nil {
			return nil, ErrMediaNotFound
		}
		mediaID = copied
		metas, err = s.repo.MediaForOwner(ctx, []uuid.UUID{mediaID}, owner)
		if err != nil {
			return nil, err
		}
	}

	m, ok := metas[mediaID]
	if !ok {
		return nil, ErrMediaNotFound
	}
	// Saved stickers still have to be real stickers, or the picker ends up
	// rendering arbitrary images at sticker size.
	if reason := validateSticker(m, false); reason != "" {
		if reason2 := validateSticker(m, true); reason2 != "" {
			return nil, ErrBadFormat
		}
	}
	packID, err := s.repo.SaveToFavorites(ctx, owner, mediaID, req.Emojis, packName)
	if err != nil {
		return nil, err
	}
	return s.repo.GetPack(ctx, packID, owner)
}

// RemoveSticker deletes a single sticker from one of the caller's packs.
func (s *Service) RemoveSticker(ctx context.Context, stickerID, owner uuid.UUID) error {
	if err := s.repo.RemoveSticker(ctx, stickerID, owner); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrPackNotFound
		}
		return err
	}
	return nil
}

func (s *Service) ListPacks(ctx context.Context, owner uuid.UUID) ([]Pack, error) {
	return s.repo.ListPacks(ctx, owner)
}

func (s *Service) GetPack(ctx context.Context, packID, owner uuid.UUID) (*Pack, error) {
	p, err := s.repo.GetPack(ctx, packID, owner)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPackNotFound
		}
		return nil, err
	}
	return p, nil
}

func (s *Service) DeletePack(ctx context.Context, packID, owner uuid.UUID) error {
	if err := s.repo.DeletePack(ctx, packID, owner); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrPackNotFound
		}
		return err
	}
	return nil
}

// validateSticker checks one blob against the published sticker format.
// Returns an empty string when the file is fine.
func validateSticker(m mediaMeta, animated bool) string {
	if !isStickerImage(m.Mime) {
		return "must be WebP or PNG"
	}
	if m.Width == nil || m.Height == nil {
		return "missing dimensions"
	}
	if *m.Width != StickerDimension || *m.Height != StickerDimension {
		return fmt.Sprintf("must be %dx%d, got %dx%d",
			StickerDimension, StickerDimension, *m.Width, *m.Height)
	}
	limit := int64(MaxStaticBytes)
	if animated {
		limit = MaxAnimatedBytes
	}
	if m.Size > limit {
		return fmt.Sprintf("over %d KB", limit/1024)
	}
	return ""
}

func validateTray(m mediaMeta) string {
	if m.Width == nil || m.Height == nil {
		return "missing dimensions"
	}
	if *m.Width != TrayDimension || *m.Height != TrayDimension {
		return fmt.Sprintf("tray icon must be %dx%d, got %dx%d",
			TrayDimension, TrayDimension, *m.Width, *m.Height)
	}
	if m.Size > MaxTrayBytes {
		return fmt.Sprintf("tray icon over %d KB", MaxTrayBytes/1024)
	}
	return ""
}

// WebP is the interop format, but PNG is accepted too: expo-image-manipulator
// can only emit WebP on Android, so an iOS client creating a sticker would
// otherwise be rejected outright. Both render fine; only an export-to-
// WhatsApp feature would need to convert PNG to WebP first.
func isStickerImage(mime string) bool {
	m := strings.ToLower(strings.TrimSpace(mime))
	return m == "image/webp" || m == "image/png"
}
