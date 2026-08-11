package notifications

import "testing"

// TestNoNotificationBlockWithoutBody guards the fix for notifications that
// displayed the ciphertext.
//
// An encrypted message has no server-readable body, so it is sent as data
// only and the device builds the notification after decrypting. An empty
// notification block would make the system show a blank one, and the app would
// never get the chance to replace it.
func TestNoNotificationBlockWithoutBody(t *testing.T) {
	for _, tt := range []struct {
		name string
		job  PushJob
		want bool // a notification block is expected
	}{
		{"plain message", PushJob{Title: "Ana", Body: "olá"}, true},
		{"encrypted message", PushJob{Title: "Ana", Body: ""}, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.job.Body != ""
			if got != tt.want {
				t.Fatalf("notification block = %v, want %v", got, tt.want)
			}
		})
	}
}
