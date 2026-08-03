ALTER TABLE stories
    DROP COLUMN IF EXISTS allow_comments,
    DROP COLUMN IF EXISTS allow_anonymous_replies;
