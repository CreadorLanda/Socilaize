package messages

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func testEnvelope(t *testing.T, prefix string, header any) string {
	t.Helper()
	h, err := json.Marshal(header)
	if err != nil {
		t.Fatal(err)
	}
	return prefix + base64.RawURLEncoding.EncodeToString(h) + "." +
		base64.RawURLEncoding.EncodeToString([]byte("ciphertext"))
}

func testDirectEnvelope(payload string) string {
	header, _ := json.Marshal(directEnvelopeHeader{Version: 1, Identity: "test-identity", Counter: 0})
	return directEnvelopePrefix + base64.RawURLEncoding.EncodeToString(header) + "." +
		base64.RawURLEncoding.EncodeToString([]byte(payload))
}

func testGroupEnvelope(sender string, epoch, counter int64) string {
	header, _ := json.Marshal(groupEnvelopeHeader{Version: 1, Sender: sender, Epoch: epoch, Counter: counter})
	return groupEnvelopePrefix + base64.RawURLEncoding.EncodeToString(header) + "." +
		base64.RawURLEncoding.EncodeToString([]byte("ciphertext"))
}

func TestValidateEnvelope(t *testing.T) {
	direct := testEnvelope(t, directEnvelopePrefix, directEnvelopeHeader{Version: 1, Identity: "peer", Counter: 0})
	group := testEnvelope(t, groupEnvelopePrefix, groupEnvelopeHeader{Version: 1, Sender: "peer", Epoch: 2, Counter: 4})
	for _, tc := range []struct {
		name string
		wire string
		want bool
	}{
		{"direct", direct, true},
		{"group", group, true},
		{"plaintext", "hello", false},
		{"missing body", direct[:strings.LastIndex(direct, ".")+1], false},
		{"wrong version", testEnvelope(t, directEnvelopePrefix, directEnvelopeHeader{Version: 2, Identity: "peer", Counter: 0}), false},
		{"negative counter", testEnvelope(t, directEnvelopePrefix, directEnvelopeHeader{Version: 1, Identity: "peer", Counter: -1}), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := validateEnvelope(tc.wire); got != tc.want {
				t.Fatalf("validateEnvelope() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestValidateEnvelopeForChat(t *testing.T) {
	sender := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	other := uuid.MustParse("00000000-0000-0000-0000-000000000002")
	tests := []struct {
		name string
		wire string
		user uuid.UUID
		kind ChatType
		want bool
	}{
		{"direct soc1", testDirectEnvelope("x"), sender, ChatDirect, true},
		{"direct rejects soc1g", testGroupEnvelope(sender.String(), 0, 0), sender, ChatDirect, false},
		{"group sender matches", testGroupEnvelope(sender.String(), 0, 0), sender, ChatGroup, true},
		{"group sender differs", testGroupEnvelope(other.String(), 0, 0), sender, ChatGroup, false},
		{"group sender empty", testGroupEnvelope("", 0, 0), sender, ChatGroup, false},
		{"group negative epoch", testGroupEnvelope(sender.String(), -1, 0), sender, ChatGroup, false},
		{"group negative counter", testGroupEnvelope(sender.String(), 0, -1), sender, ChatGroup, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := validateEnvelopeForChat(tt.wire, tt.user, tt.kind); got != tt.want {
				t.Fatalf("validateEnvelopeForChat() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestUserSendableMessageType(t *testing.T) {
	for _, typ := range []MessageType{MsgText, MsgImage, MsgVideo, MsgAudio, MsgDocument, MsgSticker, MsgLocation, MsgContact, MsgPoll, MsgEvent, MsgReply, MsgGame} {
		if !userSendableMessageType(typ) {
			t.Errorf("%q should be user-sendable", typ)
		}
	}
	for _, typ := range []MessageType{MsgSystem, MsgCall, MessageType("unknown")} {
		if userSendableMessageType(typ) {
			t.Errorf("%q should be internal or invalid", typ)
		}
	}
}
