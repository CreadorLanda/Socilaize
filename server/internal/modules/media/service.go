package media

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	ErrNotFound     = errors.New("media_not_found")
	ErrTooLarge     = errors.New("media_too_large")
	ErrUnsupported  = errors.New("media_unsupported_type")
	ErrNotOwner     = errors.New("media_not_owner")
	ErrInvalidFile  = errors.New("media_invalid_file")
)

// MaxUploadBytes default 25 MiB — override via config.
const DefaultMaxUploadBytes int64 = 25 << 20

type Service struct {
	repo    *Repository
	rootDir string
	maxSize int64
}

func NewService(repo *Repository, rootDir string, maxSize int64) *Service {
	if maxSize <= 0 {
		maxSize = DefaultMaxUploadBytes
	}
	return &Service{repo: repo, rootDir: rootDir, maxSize: maxSize}
}

func (s *Service) toObject(row objectRow) Object {
	name := ""
	if row.OriginalName != nil {
		name = *row.OriginalName
	}
	return Object{
		ID:           row.ID,
		OwnerID:      row.OwnerID,
		Kind:         Kind(row.Kind),
		MimeType:     row.MimeType,
		SizeBytes:    row.SizeBytes,
		Width:        row.Width,
		Height:       row.Height,
		DurationMs:   row.DurationMs,
		OriginalName: name,
		URL:          "/api/media/" + row.ID.String() + "/file",
		CreatedAt:    row.CreatedAt,
	}
}

// Upload streams a file to disk and records metadata.
func (s *Service) Upload(
	ctx context.Context,
	ownerID uuid.UUID,
	filename string,
	contentType string,
	r io.Reader,
	sizeHint int64,
	width, height, durationMs *int,
) (Object, error) {
	if sizeHint > 0 && sizeHint > s.maxSize {
		return Object{}, ErrTooLarge
	}

	kind, mimeType, ext := classify(filename, contentType)
	if kind == "" {
		return Object{}, ErrUnsupported
	}

	if err := os.MkdirAll(s.userDir(ownerID), 0o750); err != nil {
		return Object{}, fmt.Errorf("mkdir: %w", err)
	}

	id := uuid.New()
	rel := filepath.ToSlash(filepath.Join(ownerID.String(), id.String()+ext))
	abs := filepath.Join(s.rootDir, filepath.FromSlash(rel))

	f, err := os.OpenFile(abs, os.O_CREATE|os.O_WRONLY|os.O_EXCL, 0o640)
	if err != nil {
		return Object{}, fmt.Errorf("create file: %w", err)
	}
	defer f.Close()

	limited := io.LimitReader(r, s.maxSize+1)
	written, err := io.Copy(f, limited)
	if err != nil {
		_ = os.Remove(abs)
		return Object{}, fmt.Errorf("write: %w", err)
	}
	if written > s.maxSize {
		_ = os.Remove(abs)
		return Object{}, ErrTooLarge
	}
	if written == 0 {
		_ = os.Remove(abs)
		return Object{}, ErrInvalidFile
	}

	row, err := s.repo.Insert(ctx, ownerID, kind, mimeType, written, rel, filename, width, height, durationMs)
	if err != nil {
		_ = os.Remove(abs)
		return Object{}, err
	}
	return s.toObject(row), nil
}

func (s *Service) Get(ctx context.Context, id uuid.UUID) (Object, error) {
	row, err := s.repo.Get(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Object{}, ErrNotFound
		}
		return Object{}, err
	}
	return s.toObject(row), nil
}

// Open returns a read handle + metadata for streaming the file.
func (s *Service) Open(ctx context.Context, id uuid.UUID) (Object, *os.File, error) {
	row, err := s.repo.Get(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Object{}, nil, ErrNotFound
		}
		return Object{}, nil, err
	}
	abs := filepath.Join(s.rootDir, filepath.FromSlash(row.StoragePath))
	// Prevent path escape.
	if !strings.HasPrefix(filepath.Clean(abs), filepath.Clean(s.rootDir)) {
		return Object{}, nil, ErrNotFound
	}
	f, err := os.Open(abs)
	if err != nil {
		if os.IsNotExist(err) {
			return Object{}, nil, ErrNotFound
		}
		return Object{}, nil, err
	}
	return s.toObject(row), f, nil
}

func (s *Service) Delete(ctx context.Context, id, ownerID uuid.UUID) error {
	row, err := s.repo.Delete(ctx, id, ownerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	abs := filepath.Join(s.rootDir, filepath.FromSlash(row.StoragePath))
	_ = os.Remove(abs)
	return nil
}

func (s *Service) userDir(ownerID uuid.UUID) string {
	return filepath.Join(s.rootDir, ownerID.String())
}

func classify(filename, contentType string) (Kind, string, string) {
	ct := strings.ToLower(strings.TrimSpace(contentType))
	if i := strings.Index(ct, ";"); i >= 0 {
		ct = strings.TrimSpace(ct[:i])
	}
	ext := strings.ToLower(filepath.Ext(filename))
	if ct == "" || ct == "application/octet-stream" {
		if ext != "" {
			if t := mime.TypeByExtension(ext); t != "" {
				ct = t
			}
		}
	}
	if ct == "" {
		ct = "application/octet-stream"
	}

	switch {
	case strings.HasPrefix(ct, "image/"):
		return KindImage, ct, ensureExt(ext, ".jpg")
	case strings.HasPrefix(ct, "video/"):
		return KindVideo, ct, ensureExt(ext, ".mp4")
	case strings.HasPrefix(ct, "audio/"):
		return KindAudio, ct, ensureExt(ext, ".m4a")
	case ct == "application/pdf" ||
		strings.HasPrefix(ct, "text/") ||
		strings.Contains(ct, "document") ||
		strings.Contains(ct, "msword") ||
		strings.Contains(ct, "officedocument") ||
		ext == ".pdf" || ext == ".doc" || ext == ".docx" || ext == ".txt":
		return KindDocument, ct, ensureExt(ext, ".bin")
	default:
		// Allow common binary attachments as document.
		if ext != "" {
			return KindDocument, ct, ext
		}
		return "", "", ""
	}
}

func ensureExt(ext, fallback string) string {
	if ext == "" || len(ext) > 12 {
		return fallback
	}
	// Keep only safe chars.
	for _, c := range ext {
		if (c < 'a' || c > 'z') && (c < '0' || c > '9') && c != '.' {
			return fallback
		}
	}
	return ext
}
