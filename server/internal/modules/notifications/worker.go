package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

// Worker drains q:push.send and attempts delivery.
//
// Delivery backends (first match wins for side-effects):
//  1. PUSH_WEBHOOK_URL — POST JSON {user_id,title,body,data,tokens[]}
//  2. Always logs at info for dogfood visibility
//
// Real FCM/APNs HTTP v1 can plug in here later without changing producers.
type Worker struct {
	repo       *Repository
	rdb        *redis.Client
	webhookURL string
	http       *http.Client
	cancel     context.CancelFunc
}

func NewWorker(repo *Repository, rdb *redis.Client, webhookURL string) *Worker {
	return &Worker{
		repo:       repo,
		rdb:        rdb,
		webhookURL: webhookURL,
		http:       &http.Client{Timeout: 8 * time.Second},
	}
}

// Start runs the consumer loop until Stop is called.
func (w *Worker) Start() {
	if w.rdb == nil {
		log.Warn().Msg("push worker: no redis, disabled")
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	w.cancel = cancel
	go w.loop(ctx)
	log.Info().Str("queue", pushQueueKey).Msg("push worker started")
}

// Stop cancels the loop.
func (w *Worker) Stop() {
	if w.cancel != nil {
		w.cancel()
	}
}

func (w *Worker) loop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
		// BRPOP with short timeout so we can notice cancel.
		res, err := w.rdb.BRPop(ctx, 2*time.Second, pushQueueKey).Result()
		if err != nil {
			if err == redis.Nil || err == context.Canceled || ctx.Err() != nil {
				if ctx.Err() != nil {
					return
				}
				continue
			}
			log.Warn().Err(err).Msg("push worker brpop")
			time.Sleep(time.Second)
			continue
		}
		if len(res) < 2 {
			continue
		}
		w.handle(ctx, res[1])
	}
}

func (w *Worker) handle(ctx context.Context, raw string) {
	var job PushJob
	if err := json.Unmarshal([]byte(raw), &job); err != nil {
		log.Warn().Err(err).Str("raw", raw).Msg("push job decode")
		return
	}
	uid, err := uuid.Parse(job.UserID)
	if err != nil {
		log.Warn().Str("user_id", job.UserID).Msg("push job bad user")
		return
	}
	tokens, err := w.repo.ListTokens(ctx, uid)
	if err != nil {
		log.Warn().Err(err).Msg("list tokens")
		return
	}
	if len(tokens) == 0 {
		log.Debug().Str("user", job.UserID).Msg("push skipped: no devices")
		return
	}

	log.Info().
		Str("user", job.UserID).
		Str("category", job.Category).
		Str("title", job.Title).
		Int("devices", len(tokens)).
		Msg("push deliver")

	if w.webhookURL != "" {
		if err := w.postWebhook(ctx, job, tokens); err != nil {
			log.Warn().Err(err).Msg("push webhook failed")
		}
	}
}

type webhookPayload struct {
	UserID   string            `json:"user_id"`
	Title    string            `json:"title"`
	Body     string            `json:"body"`
	Data     map[string]string `json:"data,omitempty"`
	Category string            `json:"category"`
	Tokens   []string          `json:"tokens"`
}

func (w *Worker) postWebhook(ctx context.Context, job PushJob, tokens []string) error {
	body, err := json.Marshal(webhookPayload{
		UserID:   job.UserID,
		Title:    job.Title,
		Body:     job.Body,
		Data:     job.Data,
		Category: job.Category,
		Tokens:   tokens,
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, w.webhookURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := w.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		log.Warn().Int("status", res.StatusCode).Msg("push webhook non-2xx")
	}
	return nil
}
