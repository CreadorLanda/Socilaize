package users

import "testing"

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
