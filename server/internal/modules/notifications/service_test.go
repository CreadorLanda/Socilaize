package notifications

import "testing"

func TestPlatforms(t *testing.T) {
	if PlatformIOS != "ios" || PlatformAndroid != "android" {
		t.Fatal("platform constants")
	}
}

func TestQueueKey(t *testing.T) {
	if pushQueueKey != "q:push.send" {
		t.Fatal(pushQueueKey)
	}
}
