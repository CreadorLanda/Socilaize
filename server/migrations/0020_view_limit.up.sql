-- 0020_view_limit.up.sql
--
-- "View once" generalised: the sender picks how many times a message may
-- be opened. Enforced server-side because the count has to survive a
-- reinstall — tracking it on the device would make it a suggestion.
--
-- view_limit NULL means unlimited, which is every existing message.

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS view_limit INT;

-- One row per (message, viewer). The count of rows for a message is how
-- many distinct people opened it; a viewer opening twice is not two views.
CREATE TABLE IF NOT EXISTS message_views (
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id    UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    views      INT    NOT NULL DEFAULT 1,
    first_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

COMMENT ON COLUMN messages.view_limit
    IS 'How many times each recipient may open this; NULL = unlimited';
COMMENT ON TABLE message_views
    IS 'Per-recipient open counts, enforcing view_limit across reinstalls';
