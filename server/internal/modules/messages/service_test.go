package messages

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/CreadorLanda/Socilaize/server/internal/modules/keys"
	"github.com/CreadorLanda/Socilaize/server/internal/modules/users"
	"github.com/CreadorLanda/Socilaize/server/internal/platform/postgres"
)

// testDB connects to a Postgres instance that already has the schema
// migrated (`make docker-up-local && make migrate-up`). Skips instead of
// failing when no test database is configured, so `go test ./...` stays
// DB-free in environments without Docker/Postgres.
func testDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_POSTGRES_URL")
	if url == "" {
		t.Skip("TEST_POSTGRES_URL not set — skipping integration test (see make docker-up-local)")
	}
	pool, err := postgres.Open(context.Background(), url)
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// createTestUser inserts a minimal user row directly. The auth module's
// OTP/registration flow isn't relevant to the chat-status logic under test.
func createTestUser(t *testing.T, pool *pgxpool.Pool, username string) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	var id uuid.UUID
	err := pool.QueryRow(ctx, `
		INSERT INTO users (phone_hash, username, display_name)
		VALUES (gen_random_bytes(32), $1, $1)
		RETURNING id
	`, username).Scan(&id)
	if err != nil {
		t.Fatalf("create test user %q: %v", username, err)
	}
	t.Cleanup(func() {
		pool.Exec(context.Background(), `DELETE FROM users WHERE id = $1`, id)
	})
	return id
}

func newTestService(pool *pgxpool.Pool) *Service {
	usersRepo := users.NewRepository(pool)
	keysSvc := keys.NewService(keys.NewRepository(pool), usersRepo)
	return NewService(NewRepository(pool, ""), keysSvc, usersRepo, nil)
}

// TestDirectChatFriendRequestFlow exercises the whole pending → accept
// lifecycle: a fresh direct chat is a "friend request" that caps the
// requester at one message until the recipient accepts, after which the
// conversation must be unlimited in both directions.
func TestDirectChatFriendRequestFlow(t *testing.T) {
	pool := testDB(t)
	ctx := context.Background()
	svc := newTestService(pool)

	alice := createTestUser(t, pool, "alice_"+uuid.NewString()[:8])
	bob := createTestUser(t, pool, "bob_"+uuid.NewString()[:8])

	chat, err := svc.CreateDirectChat(ctx, alice, bob)
	if err != nil {
		t.Fatalf("CreateDirectChat: %v", err)
	}
	if chat.Status != ChatStatusPending {
		t.Fatalf("status = %q, want %q", chat.Status, ChatStatusPending)
	}

	if _, err := svc.SendMessage(ctx, chat.ID, alice, SendMessageRequest{Content: "hi"}); err != nil {
		t.Fatalf("first message while pending: %v", err)
	}
	if _, err := svc.SendMessage(ctx, chat.ID, alice, SendMessageRequest{Content: "hi again"}); !errors.Is(err, ErrPendingChatLimit) {
		t.Fatalf("expected pending_chat_limit on second message, got %v", err)
	}

	// Creator cannot accept their own request.
	if _, err := svc.AcceptChat(ctx, chat.ID, alice); !errors.Is(err, ErrCannotAcceptOwn) {
		t.Fatalf("expected cannot_accept_own, got %v", err)
	}

	accepted, err := svc.AcceptChat(ctx, chat.ID, bob)
	if err != nil {
		t.Fatalf("AcceptChat: %v", err)
	}
	if accepted.Status != ChatStatusActive {
		t.Fatalf("status after accept = %q, want %q", accepted.Status, ChatStatusActive)
	}

	// Regression guard: before the fix, the 1-message cap applied forever,
	// not just while pending — active chats must allow unlimited messages.
	for i := 0; i < 3; i++ {
		if _, err := svc.SendMessage(ctx, chat.ID, alice, SendMessageRequest{Content: "after accept"}); err != nil {
			t.Fatalf("message %d from alice after accept: %v", i, err)
		}
	}
	if _, err := svc.SendMessage(ctx, chat.ID, bob, SendMessageRequest{Content: "reply"}); err != nil {
		t.Fatalf("bob's reply after accept: %v", err)
	}
}

// TestBlockedChatRejectsMessages guards against the opposite regression:
// a blocked chat must reject sends outright, not just cap them at one.
func TestBlockedChatRejectsMessages(t *testing.T) {
	pool := testDB(t)
	ctx := context.Background()
	svc := newTestService(pool)

	alice := createTestUser(t, pool, "alice_"+uuid.NewString()[:8])
	bob := createTestUser(t, pool, "bob_"+uuid.NewString()[:8])

	chat, err := svc.CreateDirectChat(ctx, alice, bob)
	if err != nil {
		t.Fatalf("CreateDirectChat: %v", err)
	}
	if err := svc.BlockChat(ctx, chat.ID, bob); err != nil {
		t.Fatalf("BlockChat: %v", err)
	}
	if _, err := svc.SendMessage(ctx, chat.ID, alice, SendMessageRequest{Content: "hello?"}); !errors.Is(err, ErrChatBlocked) {
		t.Fatalf("expected chat_blocked, got %v", err)
	}
}

// TestNonParticipantCannotAccessChat ensures accept/block/list/send
// reject callers who are not members (IDOR guard).
func TestNonParticipantCannotAccessChat(t *testing.T) {
	pool := testDB(t)
	ctx := context.Background()
	svc := newTestService(pool)

	alice := createTestUser(t, pool, "alice_"+uuid.NewString()[:8])
	bob := createTestUser(t, pool, "bob_"+uuid.NewString()[:8])
	eve := createTestUser(t, pool, "eve_"+uuid.NewString()[:8])

	chat, err := svc.CreateDirectChat(ctx, alice, bob)
	if err != nil {
		t.Fatalf("CreateDirectChat: %v", err)
	}

	if _, err := svc.AcceptChat(ctx, chat.ID, eve); !errors.Is(err, ErrNotParticipant) {
		t.Fatalf("AcceptChat by non-participant: got %v", err)
	}
	if err := svc.BlockChat(ctx, chat.ID, eve); !errors.Is(err, ErrNotParticipant) {
		t.Fatalf("BlockChat by non-participant: got %v", err)
	}
	if _, err := svc.SendMessage(ctx, chat.ID, eve, SendMessageRequest{Content: "nope"}); !errors.Is(err, ErrNotParticipant) {
		t.Fatalf("SendMessage by non-participant: got %v", err)
	}
	if _, err := svc.ListMessages(ctx, chat.ID, eve, 10, 0); !errors.Is(err, ErrNotParticipant) {
		t.Fatalf("ListMessages by non-participant: got %v", err)
	}
}
