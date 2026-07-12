package notifications

import "testing"

func TestSplitTokens(t *testing.T) {
	expo, fcm, other := splitTokens([]string{
		"ExponentPushToken[abc]",
		"ExpoPushToken[xyz]",
		"native-fcm-token-12345678",
		"dev-abc123",
		"  ",
		"another-native-token",
	})
	if len(expo) != 2 {
		t.Fatalf("expo=%v", expo)
	}
	if len(fcm) != 2 {
		t.Fatalf("fcm=%v", fcm)
	}
	if len(other) != 1 || other[0] != "dev-abc123" {
		t.Fatalf("other=%v", other)
	}
}

func TestIsExpoToken(t *testing.T) {
	if !isExpoToken("ExponentPushToken[x]") {
		t.Fatal("expected expo")
	}
	if isExpoToken("fcm-native") {
		t.Fatal("expected not expo")
	}
}

func TestIsUnregistered(t *testing.T) {
	if !isUnregistered(&fcmError{Status: 404, Body: `{"error":{"status":"NOT_FOUND"}}`}) {
		t.Fatal("404 should unregistered")
	}
	if !isUnregistered(&fcmError{Status: 400, Body: `UNREGISTERED`}) {
		t.Fatal("body UNREGISTERED")
	}
	if isUnregistered(&fcmError{Status: 500, Body: "internal"}) {
		t.Fatal("500 not unregistered")
	}
}
