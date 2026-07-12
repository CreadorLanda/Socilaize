-- 0014_story_kinds.up.sql
-- Allow interactive story kinds (poll / question). Live remains client-only for now.

ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_kind_check;

ALTER TABLE stories
    ADD CONSTRAINT stories_kind_check
    CHECK (kind IN ('image', 'video', 'text', 'audio', 'poll', 'question'));
