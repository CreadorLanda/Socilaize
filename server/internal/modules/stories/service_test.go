package stories

import "testing"

func TestKinds(t *testing.T) {
	if KindImage != "image" || KindText != "text" {
		t.Fatal()
	}
}
