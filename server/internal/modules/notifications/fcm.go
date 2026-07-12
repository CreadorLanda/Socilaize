package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const fcmScope = "https://www.googleapis.com/auth/firebase.messaging"

// FCMConfig holds Firebase Cloud Messaging HTTP v1 settings.
type FCMConfig struct {
	// ProjectID is the Firebase / GCP project id.
	ProjectID string
	// CredentialsJSON is the service-account JSON body (preferred in K8s secrets).
	CredentialsJSON []byte
	// CredentialsFile is a path to a service-account JSON file.
	CredentialsFile string
}

// FCMSender delivers native FCM registration tokens via HTTP v1.
type FCMSender struct {
	projectID string
	http      *http.Client
	ts        oauth2.TokenSource
	mu        sync.Mutex
}

// NewFCMSender builds a sender when credentials are available.
// Returns nil if project id or credentials are missing (caller treats as disabled).
func NewFCMSender(cfg FCMConfig) (*FCMSender, error) {
	projectID := strings.TrimSpace(cfg.ProjectID)
	if projectID == "" {
		return nil, nil
	}
	raw := cfg.CredentialsJSON
	if len(raw) == 0 && cfg.CredentialsFile != "" {
		b, err := os.ReadFile(cfg.CredentialsFile)
		if err != nil {
			return nil, fmt.Errorf("read fcm credentials: %w", err)
		}
		raw = b
	}
	if len(raw) == 0 {
		// Fall back to GOOGLE_APPLICATION_CREDENTIALS file if set.
		if p := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS"); p != "" {
			b, err := os.ReadFile(p)
			if err != nil {
				return nil, fmt.Errorf("read GOOGLE_APPLICATION_CREDENTIALS: %w", err)
			}
			raw = b
		}
	}
	if len(raw) == 0 {
		return nil, nil
	}

	creds, err := google.CredentialsFromJSON(context.Background(), raw, fcmScope)
	if err != nil {
		return nil, fmt.Errorf("parse fcm credentials: %w", err)
	}
	return &FCMSender{
		projectID: projectID,
		http:      &http.Client{Timeout: 12 * time.Second},
		ts:        creds.TokenSource,
	}, nil
}

func (s *FCMSender) Name() string { return "fcm" }

func (s *FCMSender) Deliver(ctx context.Context, job PushJob, tokens []string) ([]string, error) {
	if s == nil || len(tokens) == 0 {
		return nil, nil
	}
	var invalid []string
	var firstErr error
	for _, tok := range tokens {
		if err := s.sendOne(ctx, job, tok); err != nil {
			if isUnregistered(err) {
				invalid = append(invalid, tok)
				continue
			}
			if firstErr == nil {
				firstErr = err
			}
		}
	}
	return invalid, firstErr
}

type fcmMessageRequest struct {
	Message fcmMessage `json:"message"`
}

type fcmMessage struct {
	Token        string            `json:"token"`
	Notification *fcmNotification  `json:"notification,omitempty"`
	Data         map[string]string `json:"data,omitempty"`
	Android      *fcmAndroidConfig `json:"android,omitempty"`
	APNS         *fcmAPNSConfig    `json:"apns,omitempty"`
}

type fcmNotification struct {
	Title string `json:"title,omitempty"`
	Body  string `json:"body,omitempty"`
}

type fcmAndroidConfig struct {
	Priority string `json:"priority,omitempty"`
}

type fcmAPNSConfig struct {
	Headers map[string]string `json:"headers,omitempty"`
	Payload map[string]any    `json:"payload,omitempty"`
}

func (s *FCMSender) sendOne(ctx context.Context, job PushJob, token string) error {
	data := map[string]string{}
	for k, v := range job.Data {
		data[k] = v
	}
	if job.Category != "" {
		data["category"] = job.Category
	}
	reqBody := fcmMessageRequest{
		Message: fcmMessage{
			Token: token,
			Notification: &fcmNotification{
				Title: job.Title,
				Body:  job.Body,
			},
			Data: data,
			Android: &fcmAndroidConfig{
				Priority: "HIGH",
			},
			APNS: &fcmAPNSConfig{
				Headers: map[string]string{"apns-priority": "10"},
				Payload: map[string]any{
					"aps": map[string]any{
						"sound": "default",
					},
				},
			},
		},
	}
	raw, err := json.Marshal(reqBody)
	if err != nil {
		return err
	}
	url := fmt.Sprintf("https://fcm.googleapis.com/v1/projects/%s/messages:send", s.projectID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	tok, err := s.ts.Token()
	if err != nil {
		return fmt.Errorf("fcm oauth token: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	res, err := s.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(res.Body, 8<<10))
	if res.StatusCode >= 200 && res.StatusCode < 300 {
		return nil
	}
	return &fcmError{Status: res.StatusCode, Body: string(body)}
}

type fcmError struct {
	Status int
	Body   string
}

func (e *fcmError) Error() string {
	return fmt.Sprintf("fcm status %d: %s", e.Status, e.Body)
}

func isUnregistered(err error) bool {
	var fe *fcmError
	if err == nil {
		return false
	}
	if e, ok := err.(*fcmError); ok {
		fe = e
	} else {
		msg := strings.ToLower(err.Error())
		return strings.Contains(msg, "unregistered") ||
			strings.Contains(msg, "notfound") ||
			strings.Contains(msg, "registration-token-not-registered")
	}
	msg := strings.ToLower(fe.Body)
	return fe.Status == 404 ||
		strings.Contains(msg, "unregistered") ||
		strings.Contains(msg, "not_found") ||
		strings.Contains(msg, "registration-token-not-registered")
}
