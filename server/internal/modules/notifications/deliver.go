package notifications

import (
	"context"
	"strings"
)

// Deliverer sends a push job to one or more device tokens.
// Implementations must be safe for concurrent use.
type Deliverer interface {
	// Name is used in logs (fcm, expo, webhook).
	Name() string
	// Deliver attempts delivery for the given tokens. It may return a subset
	// of invalid tokens that should be pruned from storage.
	Deliver(ctx context.Context, job PushJob, tokens []string) (invalid []string, err error)
}

// isExpoToken reports whether the token is an Expo push token.
func isExpoToken(token string) bool {
	t := strings.TrimSpace(token)
	return strings.HasPrefix(t, "ExponentPushToken[") ||
		strings.HasPrefix(t, "ExpoPushToken[")
}

// isDevToken is a local placeholder registered when push APIs are unavailable.
func isDevToken(token string) bool {
	return strings.HasPrefix(strings.TrimSpace(token), "dev-")
}

// splitTokens partitions device tokens by delivery backend.
func splitTokens(tokens []string) (expo, fcm, other []string) {
	for _, raw := range tokens {
		t := strings.TrimSpace(raw)
		if t == "" {
			continue
		}
		if isDevToken(t) {
			other = append(other, t)
			continue
		}
		if isExpoToken(t) {
			expo = append(expo, t)
			continue
		}
		fcm = append(fcm, t)
	}
	return expo, fcm, other
}
