-- Invitations to help run a channel.
--
-- Being made an admin or a publisher is a responsibility, not a setting
-- someone else gets to change about you: it puts your name against what the
-- channel publishes. So the grant waits for the person to accept.
--
-- Plain membership is not invited — that is following, which people do to
-- themselves.
CREATE TABLE IF NOT EXISTS channel_role_invites (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id  UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('admin', 'publisher')),
    invited_by  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- One open invitation per person per channel. Inviting again replaces
    -- the role rather than stacking, so a channel cannot flood someone by
    -- sending the same request twenty times.
    UNIQUE (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_role_invites_user
    ON channel_role_invites (user_id, created_at DESC);
