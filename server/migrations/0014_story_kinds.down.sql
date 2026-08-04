-- Revert poll/question kinds (stories of those kinds must be deleted first).

DELETE FROM stories WHERE kind IN ('poll', 'question');

ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_kind_check;

ALTER TABLE stories
    ADD CONSTRAINT stories_kind_check
    CHECK (kind IN ('image', 'video', 'text', 'audio'));
