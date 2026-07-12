package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const expoPushURL = "https://exp.host/--/api/v2/push/send"

// ExpoSender delivers Expo push tokens via Expo's push service
// (which routes to FCM/APNs under the hood for Expo apps).
type ExpoSender struct {
	http     *http.Client
	endpoint string
}

func NewExpoSender() *ExpoSender {
	return &ExpoSender{
		http:     &http.Client{Timeout: 12 * time.Second},
		endpoint: expoPushURL,
	}
}

func (s *ExpoSender) Name() string { return "expo" }

type expoMessage struct {
	To       string            `json:"to"`
	Title    string            `json:"title,omitempty"`
	Body     string            `json:"body,omitempty"`
	Data     map[string]string `json:"data,omitempty"`
	Sound    string            `json:"sound,omitempty"`
	Priority string            `json:"priority,omitempty"`
	Channel  string            `json:"channelId,omitempty"`
}

type expoTicket struct {
	Status  string `json:"status"`
	ID      string `json:"id,omitempty"`
	Message string `json:"message,omitempty"`
	Details *struct {
		Error string `json:"error,omitempty"`
	} `json:"details,omitempty"`
}

type expoResponse struct {
	Data []expoTicket `json:"data"`
}

func (s *ExpoSender) Deliver(ctx context.Context, job PushJob, tokens []string) ([]string, error) {
	if s == nil || len(tokens) == 0 {
		return nil, nil
	}
	msgs := make([]expoMessage, 0, len(tokens))
	data := map[string]string{}
	for k, v := range job.Data {
		data[k] = v
	}
	if job.Category != "" {
		data["category"] = job.Category
	}
	for _, t := range tokens {
		msgs = append(msgs, expoMessage{
			To:       t,
			Title:    job.Title,
			Body:     job.Body,
			Data:     data,
			Sound:    "default",
			Priority: "high",
			Channel:  "default",
		})
	}
	raw, err := json.Marshal(msgs)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Accept-Encoding", "gzip, deflate")

	res, err := s.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(res.Body, 64<<10))
	if res.StatusCode >= 300 {
		return nil, fmt.Errorf("expo push status %d: %s", res.StatusCode, string(body))
	}
	var parsed expoResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		// Expo may return a single ticket object for one message.
		var single expoTicket
		if err2 := json.Unmarshal(body, &single); err2 == nil && single.Status != "" {
			parsed.Data = []expoTicket{single}
		} else {
			return nil, fmt.Errorf("expo push decode: %w", err)
		}
	}
	var invalid []string
	for i, ticket := range parsed.Data {
		if ticket.Status == "error" {
			code := ""
			if ticket.Details != nil {
				code = ticket.Details.Error
			}
			if code == "DeviceNotRegistered" || code == "InvalidCredentials" {
				if i < len(tokens) {
					invalid = append(invalid, tokens[i])
				}
			}
		}
	}
	return invalid, nil
}
