ALTER TABLE chats DROP COLUMN IF EXISTS disappear_seconds;
ALTER TABLE messages DROP COLUMN IF EXISTS expires_at;
