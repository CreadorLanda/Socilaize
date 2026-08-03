-- When a post was last edited.
--
-- Shown next to the timestamp: a channel post is public, and silently
-- rewriting one after people have read and reacted to it is the kind of
-- edit a reader deserves to know happened.
ALTER TABLE channel_posts ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
