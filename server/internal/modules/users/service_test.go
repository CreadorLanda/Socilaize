package users

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

// usernameRe is the single source of truth for what a username may contain.
// If this changes, the mobile client's local regex must move in lockstep —
// the comment on usernameRe says so explicitly. These cases guard the
// invariant against accidental loosening.
func TestUsernameRegex(t *testing.T) {
	for _, tt := range []struct {
		name string
		in   string
		want bool
	}{
		{"too short", "ab", false},
		{"too long", "abcdefghijklmnopqrstu", false},
		{"min length ok", "abc", true},
		{"max length ok", "abcdefghijklmnopqrst", true},
		{"digits ok", "alex_99", true},
		{"underscore ok", "a_b_c", true},
		{"uppercase rejected", "Alex", false},
		{"hyphen rejected", "alex-1", false},
		{"dot rejected", "alex.1", false},
		{"space rejected", "alex 1", false},
		{"emoji rejected", "alex😀", false},
		{"empty rejected", "", false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			got := usernameRe.MatchString(tt.in)
			if got != tt.want {
				t.Errorf("MatchString(%q) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

// Search short-circuits before touching the repo, so this is safe to run
// with a nil repo — it's the mobile search box's debounce boundary (search
// screen waits for 2 chars) enforced again server-side.
func TestSearchRequiresMinimumQueryLength(t *testing.T) {
	svc := NewService(nil)
	for _, q := range []string{"", "a"} {
		got, err := svc.Search(context.Background(), uuid.New(), q)
		if err != nil || got != nil {
			t.Errorf("Search(%q) = %v, %v; want nil, nil", q, got, err)
		}
	}
}
