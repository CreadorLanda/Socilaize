package realtime

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestPublishToEmptyHub(t *testing.T) {
	h := NewHub()
	// Must not panic when nobody is connected.
	h.PublishJSON([]uuid.UUID{uuid.New()}, "message.new", uuid.New().String(), map[string]string{"ok": "1"})
}

func TestPublishJSONPayload(t *testing.T) {
	h := NewHub()
	uid := uuid.New()
	c := &client{
		userID: uid,
		send:   make(chan []byte, 4),
		hub:    h,
	}
	h.register(c)
	defer h.unregister(c)

	payload := map[string]any{"hello": "world"}
	h.PublishJSON([]uuid.UUID{uid}, "typing", "chat-1", payload)

	select {
	case raw := <-c.send:
		var ev Event
		if err := json.Unmarshal(raw, &ev); err != nil {
			t.Fatal(err)
		}
		if ev.Type != "typing" || ev.ChatID != "chat-1" {
			t.Fatalf("unexpected event: %+v", ev)
		}
		var p map[string]any
		if err := json.Unmarshal(ev.Payload, &p); err != nil {
			t.Fatal(err)
		}
		if p["hello"] != "world" {
			t.Fatalf("payload: %v", p)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for publish")
	}
}
