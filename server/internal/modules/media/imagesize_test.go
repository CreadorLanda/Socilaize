package media

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"testing"
)

// The sticker format check is only meaningful if dimensions come from the
// bytes. These use real encoder output rather than hand-built headers, so
// a wrong offset cannot pass by accident.
func TestSniffImageSizeOnRealFiles(t *testing.T) {
	if !haveEncoder() {
		t.Skip("no image encoder available")
	}
	dir := t.TempDir()

	cases := []struct {
		name   string
		file   string
		w, h   int
		script string
	}{
		{"png", "tray.png", 96, 96, "Image.new('RGB',(96,96),'red').save(out)"},
		{"webp lossy", "lossy.webp", 512, 512, "Image.new('RGB',(512,512),'blue').save(out,'WEBP',lossless=False)"},
		{"webp lossless", "lossless.webp", 512, 512, "Image.new('RGB',(512,512),'green').save(out,'WEBP',lossless=True)"},
		{"webp animated", "anim.webp", 512, 512, "f=[Image.new('RGB',(512,512),c) for c in ('red','blue')]; f[0].save(out,'WEBP',save_all=True,append_images=f[1:],duration=100)"},
		{"webp non-square", "rect.webp", 300, 200, "Image.new('RGB',(300,200),'gray').save(out,'WEBP')"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out := filepath.Join(dir, tc.file)
			if err := encode(out, tc.script); err != nil {
				t.Fatalf("encoding %s failed: %v", tc.file, err)
			}
			f, err := os.Open(out)
			if err != nil {
				t.Fatal(err)
			}
			defer f.Close()

			head := make([]byte, sniffHeaderBytes)
			n, _ := f.Read(head)
			w, h := sniffImageSize(head[:n])
			if w == nil || h == nil {
				t.Fatalf("%s: no dimensions read", tc.file)
			}
			if *w != tc.w || *h != tc.h {
				t.Errorf("%s: got %dx%d, want %dx%d", tc.file, *w, *h, tc.w, tc.h)
			}
		})
	}
}

func TestSniffImageSizeRejectsJunk(t *testing.T) {
	for _, b := range [][]byte{
		nil,
		[]byte("not an image"),
		[]byte("RIFF____WEBP"), // truncated
		{0x89, 'P', 'N', 'G'},  // truncated PNG signature
	} {
		if w, h := sniffImageSize(b); w != nil || h != nil {
			t.Errorf("expected no dimensions for %q, got %v x %v", b, w, h)
		}
	}
}

// encode writes a real image via PIL so the parser is tested against
// genuine encoder output, not hand-built headers.
func encode(out, script string) error {
	prog := "from PIL import Image\nout = " + strconv.Quote(out) + "\n" + script + "\n"
	cmd := exec.Command("python3", "-c", prog)
	if b, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("%v: %s", err, b)
	}
	return nil
}

func haveEncoder() bool {
	if _, err := exec.LookPath("python3"); err != nil {
		return false
	}
	return exec.Command("python3", "-c", "import PIL").Run() == nil
}
