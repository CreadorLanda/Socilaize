package channels

import "testing"

func TestNormalizeHandle(t *testing.T) {
	if normalizeHandle("@Hello_World!!") != "hello_world" {
		t.Fatal(normalizeHandle("@Hello_World!!"))
	}
}
