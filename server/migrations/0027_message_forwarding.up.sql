-- How many hops a message has made.
--
-- 0 means written here. 1 means forwarded once. The count only ever goes up,
-- and it travels with the content rather than with the sender, which is the
-- whole point: a message that has been passed along five times is a
-- different kind of claim than one somebody typed to you.
--
-- Not a boolean, because "forwarded" and "forwarded many times" are the two
-- labels people act on, and a boolean can only carry the first.
ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS forward_count INT NOT NULL DEFAULT 0;

-- Where a forwarded channel post came from, so the bubble can offer a way
-- back to it. Null for everything else.
ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS source_channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS source_post_id UUID REFERENCES channel_posts(id) ON DELETE SET NULL;
