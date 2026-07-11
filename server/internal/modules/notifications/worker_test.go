package notifications

import (
	"encoding/json"
	"testing"
)

func TestWebhookPayloadShape(t *testing.T) {
	p := webhookPayload{
		UserID:   "u1",
		Title:    "Hi",
		Body:     "There",
		Category: "messages",
		Tokens:   []string{"tok"},
	}
	b, err := json.Marshal(p)
	if err != nil {
		t.Fatal(err)
	}
	var back map[string]any
	if err := json.Unmarshal(b, &back); err != nil {
		t.Fatal(err)
	}
	if back["title"] != "Hi" {
		t.Fatal(back)
	}
}
