-- 0010_groups.up.sql
-- Group chats reuse `chats` (type=group). Add roles + history settings.

ALTER TABLE chat_participants
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('admin', 'member'));

ALTER TABLE chats
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS history_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS history_mode TEXT NOT NULL DEFAULT 'full'
        CHECK (history_mode IN ('view-only', 'full')),
    ADD COLUMN IF NOT EXISTS history_limit INT NOT NULL DEFAULT 50;

-- Creator of existing groups (if any) becomes admin.
UPDATE chat_participants cp
SET role = 'admin'
FROM chats c
WHERE cp.chat_id = c.id
  AND c.type = 'group'
  AND cp.user_id = c.created_by;

COMMENT ON COLUMN chat_participants.role IS 'admin | member — group only (direct ignores)';
COMMENT ON COLUMN chats.history_enabled IS 'When false, new members only see post-join messages';
COMMENT ON COLUMN chats.history_mode IS 'view-only | full — whether new members may reply to history';
COMMENT ON COLUMN chats.history_limit IS 'Max past messages for new members; -1 = unlimited';
