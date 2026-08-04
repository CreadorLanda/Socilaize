package messages

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

// A chat muted with no end date must still serialise. encoding/json
// rejects any year outside [0,9999], so a sentinel at 9999-12-31 breaks
// the moment a positive UTC offset carries it into year 10000 — and that
// takes the whole chat list down with a 500, not just the muted row.
func TestMutedForeverChatMarshals(t *testing.T) {
	for _, loc := range []string{"UTC", "Europe/Lisbon", "Pacific/Kiritimati"} {
		tz, err := time.LoadLocation(loc)
		if err != nil {
			t.Skipf("tzdata unavailable for %s", loc)
		}
		muted := mutedForever.In(tz)
		c := Chat{MutedUntil: &muted}

		b, err := json.Marshal([]Chat{c})
		if err != nil {
			t.Fatalf("marshal muted chat in %s: %v", loc, err)
		}
		if !strings.Contains(string(b), "muted_until") {
			t.Fatalf("muted_until missing from payload in %s: %s", loc, b)
		}
	}
}

// Kiritimati is UTC+14, the largest positive offset in the tz database —
// the worst case for the overflow above.
func TestMutedForeverLeavesHeadroom(t *testing.T) {
	if y := mutedForever.Year(); y >= 9999 {
		t.Fatalf("mutedForever year %d leaves no room for a positive UTC offset", y)
	}
}

func TestListChatsOptionsNormalize(t *testing.T) {
	cases := []struct {
		in, wantLimit, wantOffset int
	}{
		{0, DefaultChatPageSize, 0},
		{-5, DefaultChatPageSize, 0},
		{10, 10, 0},
		{MaxChatPageSize + 1, MaxChatPageSize, 0},
	}
	for _, tc := range cases {
		o := ListChatsOptions{Limit: tc.in, Offset: -1}
		o.Normalize()
		if o.Limit != tc.wantLimit || o.Offset != tc.wantOffset {
			t.Errorf("Normalize(limit=%d) = (%d,%d), want (%d,%d)",
				tc.in, o.Limit, o.Offset, tc.wantLimit, tc.wantOffset)
		}
	}
}
