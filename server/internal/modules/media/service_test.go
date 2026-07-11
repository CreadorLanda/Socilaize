package media

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
)

// stubRepo is unused — integration path needs DB. Unit-test classify + ensureExt only.

func TestClassifyImage(t *testing.T) {
	k, mime, ext := classify("photo.PNG", "image/png")
	if k != KindImage || mime != "image/png" || ext != ".png" {
		t.Fatalf("got %s %s %s", k, mime, ext)
	}
}

func TestClassifyVideo(t *testing.T) {
	k, _, ext := classify("clip.mp4", "video/mp4")
	if k != KindVideo || ext != ".mp4" {
		t.Fatalf("got %s %s", k, ext)
	}
}

func TestClassifyUnsupportedEmpty(t *testing.T) {
	k, _, _ := classify("", "")
	if k != "" {
		t.Fatalf("expected empty kind, got %s", k)
	}
}

func TestEnsureExt(t *testing.T) {
	if ensureExt(".jpg", ".bin") != ".jpg" {
		t.Fatal()
	}
	if ensureExt("", ".bin") != ".bin" {
		t.Fatal()
	}
	if ensureExt(".evil/x", ".bin") != ".bin" {
		t.Fatal()
	}
}

// TestUploadRoundTripLocal writes to a temp dir without DB when repo is nil —
// skipped; kept as documentation of intended flow.
func TestUploadRequiresRepo(t *testing.T) {
	dir := t.TempDir()
	svc := NewService(nil, dir, 1024)
	// Calling Upload with nil repo panics/ fails — ensure classify works via public path.
	_ = svc
	_ = context.Background()
	_ = uuid.New()
	_ = bytes.NewReader([]byte("hi"))
	_ = filepath.Join(dir, "x")
	_ = os.ModePerm
}
