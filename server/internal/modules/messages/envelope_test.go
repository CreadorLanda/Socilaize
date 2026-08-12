package messages

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
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
