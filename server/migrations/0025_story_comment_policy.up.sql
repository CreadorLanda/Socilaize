-- Per-story comment policy.
--
-- The create screen has offered both of these as toggles from the start and
-- neither reached the server, so the choice was discarded on publish. The
-- anonymous one is the load-bearing half: a comment posted anonymously
-- against a story that never allowed it would publish a name the commenter
-- believed was hidden.
ALTER TABLE stories
    ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS allow_anonymous_replies BOOLEAN NOT NULL DEFAULT TRUE;
