-- Public comments on a story, with one level of replies.
--
-- The screen has had a comment sheet with nested replies and avatars since
-- the beginning, reading from a field that only existed in the mock fixture —
-- so every real story showed an empty sheet.
--
-- author_id is always stored, including on anonymous comments: moderation and
-- "delete my own" both need it. It is simply never serialised when the
-- comment is anonymous, which is enforced in the query rather than left to
-- each caller to remember.
CREATE TABLE IF NOT EXISTS story_comments (
    id           BIGSERIAL PRIMARY KEY,
    story_id     UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    author_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- One level only: a reply to a reply attaches to the same top comment.
    parent_id    BIGINT REFERENCES story_comments(id) ON DELETE CASCADE,
    body         TEXT NOT NULL,
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_comments_story
    ON story_comments (story_id, created_at);

CREATE INDEX IF NOT EXISTS idx_story_comments_parent
    ON story_comments (parent_id);
