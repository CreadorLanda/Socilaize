ALTER TABLE chats ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'pending', 'blocked'));

CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status);
