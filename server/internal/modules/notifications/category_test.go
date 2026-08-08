package notifications

import "testing"

// TestMessageCategoryMatchesClient guards a contract that spans two codebases.
//
// The client registers its reply action under an identifier; the server names
// that identifier in the payload. They are never checked against each other at
// runtime — if they drift, the notification still arrives, it just silently
// loses its reply box, and nothing anywhere reports it.
func TestMessageCategoryMatchesClient(t *testing.T) {
	// Kept in step with mobile/data/push.ts → MESSAGE_CATEGORY.
	const clientSide = "yo.message"
	if messageCategory != clientSide {
		t.Fatalf("server category %q, client registers %q — the reply box will not appear",
			messageCategory, clientSide)
	}
}

// TestOnlyMessagesGetReplyBox: offering a reply on a story or a call would
// promise something with nowhere to go.
func TestOnlyMessagesGetReplyBox(t *testing.T) {
	for _, tt := range []struct {
		category string
		want     bool
	}{
		{"messages", true},
		{"groups", true},
		{"stories", false},
		{"calls", false},
		{"", false},
	} {
		aps := apsPayload(PushJob{Category: tt.category})
		_, got := aps["category"]
		if got != tt.want {
			t.Fatalf("category %q: reply box = %v, want %v", tt.category, got, tt.want)
		}
	}
}
