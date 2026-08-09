package messages

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

// TestHistoryVisibilityIsEnforced covers a promise the schema made and nothing
// kept.
//
// `chats.history_enabled` has carried the comment "when false, new members
// only see post-join messages" since migration 0010. ListMessages never read
// it, so every new member saw the entire history regardless.
func TestHistoryVisibilityIsEnforced(t *testing.T) {
	pool := testDB(t)
	ctx := context.Background()
	svc := newTestService(pool)

	alice := createTestUser(t, pool, "alice_"+uuid.NewString()[:8])
	bob := createTestUser(t, pool, "bob_"+uuid.NewString()[:8])
	carol := createTestUser(t, pool, "carol_"+uuid.NewString()[:8])

	chat, err := svc.CreateDirectChat(ctx, alice, bob)
	if err != nil {
		t.Fatalf("CreateDirectChat: %v", err)
	}
	if _, err := svc.AcceptChat(ctx, chat.ID, bob); err != nil {
		t.Fatalf("AcceptChat: %v", err)
	}

	before, err := svc.SendMessage(ctx, chat.ID, alice, SendMessageRequest{Content: "said before carol arrived"})
	if err != nil {
		t.Fatalf("SendMessage: %v", err)
	}

	// Carol joins with history withheld — the shape AddMemberWithHistory
	// writes when the person adding chooses not to share.
	if _, err := pool.Exec(ctx, `
		INSERT INTO chat_participants (chat_id, user_id, role, history_from)
		VALUES ($1, $2, 'member', NOW())
	`, chat.ID, carol); err != nil {
		t.Fatalf("add carol: %v", err)
	}

	after, err := svc.SendMessage(ctx, chat.ID, alice, SendMessageRequest{Content: "said after"})
	if err != nil {
		t.Fatalf("SendMessage after: %v", err)
	}

	seen, err := svc.ListMessages(ctx, chat.ID, carol, 50, 0)
	if err != nil {
		t.Fatalf("ListMessages(carol): %v", err)
	}
	ids := map[int64]bool{}
	for _, m := range seen {
		ids[m.ID] = true
	}
	if ids[before.ID] {
		t.Fatal("a member added without history can read what was said before they arrived")
	}
	if !ids[after.ID] {
		t.Fatal("a member cannot read what was said after they joined")
	}

	// Alice, who was there all along, still sees everything. The rule is per
	// member: hiding history from a new arrival must not hide it from the
	// people who were already reading.
	full, err := svc.ListMessages(ctx, chat.ID, alice, 50, 0)
	if err != nil {
		t.Fatalf("ListMessages(alice): %v", err)
	}
	aliceIDs := map[int64]bool{}
	for _, m := range full {
		aliceIDs[m.ID] = true
	}
	if !aliceIDs[before.ID] || !aliceIDs[after.ID] {
		t.Fatal("an existing member lost access to history")
	}
}

// TestSharedHistoryStaysVisible: the default, and what happens when the person
// adding chooses to share.
func TestSharedHistoryStaysVisible(t *testing.T) {
	pool := testDB(t)
	ctx := context.Background()
	svc := newTestService(pool)

	alice := createTestUser(t, pool, "alice_"+uuid.NewString()[:8])
	bob := createTestUser(t, pool, "bob_"+uuid.NewString()[:8])
	dave := createTestUser(t, pool, "dave_"+uuid.NewString()[:8])

	chat, _ := svc.CreateDirectChat(ctx, alice, bob)
	if _, err := svc.AcceptChat(ctx, chat.ID, bob); err != nil {
		t.Fatalf("AcceptChat: %v", err)
	}
	old, err := svc.SendMessage(ctx, chat.ID, alice, SendMessageRequest{Content: "older than dave"})
	if err != nil {
		t.Fatalf("SendMessage: %v", err)
	}

	// history_from NULL — shared, which is also what an older client that
	// omits the flag produces.
	if _, err := pool.Exec(ctx, `
		INSERT INTO chat_participants (chat_id, user_id, role) VALUES ($1, $2, 'member')
	`, chat.ID, dave); err != nil {
		t.Fatalf("add dave: %v", err)
	}

	seen, err := svc.ListMessages(ctx, chat.ID, dave, 50, 0)
	if err != nil {
		t.Fatalf("ListMessages: %v", err)
	}
	for _, m := range seen {
		if m.ID == old.ID {
			return
		}
	}
	t.Fatal("history was shared but the new member cannot see it")
}
