-- 0016_chat_settings.up.sql
--
-- Per-participant chat management. These settings are deliberately on
-- chat_participants and not on chats: pinning, muting and archiving are
-- personal choices, so two people in the same conversation must be able
-- to disagree.
--
-- Semantics:
--   pinned_at   — non-null pins the chat to the top of the caller's list.
--   muted_until — non-null suppresses push until that instant. A far-future
--                 timestamp means "muted forever".
--   archived_at — non-null hides the chat from the default list; it still
--                 shows under ?archived=true.
--   cleared_at  — messages created at or before this instant are hidden
--                 from this user only. The rows stay for the other side.
--   hidden_at   — "delete chat": drops it from the list entirely, but it
--                 comes back if a message arrives after this instant. This
--                 is what lets a deleted 1:1 reappear when the peer writes.

ALTER TABLE chat_participants
    ADD COLUMN IF NOT EXISTS pinned_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cleared_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS hidden_at   TIMESTAMPTZ;

-- The chat list is always scoped to one user and ordered pinned-first,
-- so keep the per-user slice cheap to scan.
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_pinned
    ON chat_participants(user_id, pinned_at DESC NULLS LAST);

-- ListChats resolves each chat's newest message with a LATERAL join.
-- (chat_id, id DESC) makes that a single index step per chat.
CREATE INDEX IF NOT EXISTS idx_messages_chat_id_desc
    ON messages(chat_id, id DESC);

COMMENT ON COLUMN chat_participants.pinned_at   IS 'Non-null pins the chat for this user';
COMMENT ON COLUMN chat_participants.muted_until IS 'Suppress push until this instant';
COMMENT ON COLUMN chat_participants.archived_at IS 'Non-null hides the chat from the default list';
COMMENT ON COLUMN chat_participants.cleared_at  IS 'Hide messages at/before this instant for this user only';
COMMENT ON COLUMN chat_participants.hidden_at   IS 'Deleted chat; reappears when a newer message arrives';
