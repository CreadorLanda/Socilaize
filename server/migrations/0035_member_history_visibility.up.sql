-- Whether one member may read what was said before they arrived.
--
-- `chats.history_enabled` has existed since 0010, with a comment promising
-- "when false, new members only see post-join messages". Nothing ever read it:
-- ListMessages does not consult it, so every new member saw everything.
--
-- Per member, not per group, and that is the point. A group-wide switch can be
-- flipped later, retroactively exposing a conversation to someone who joined
-- under different terms. The decision belongs to the person doing the adding,
-- at the moment they add — and then it stops moving.
ALTER TABLE chat_participants
    ADD COLUMN IF NOT EXISTS history_from TIMESTAMPTZ;

COMMENT ON COLUMN chat_participants.history_from
    IS 'Earliest message this member may read. NULL means the whole history.';

-- Existing members keep what they already had: full history. Writing joined_at
-- here instead would hide, from people who have been reading a group for
-- months, everything said before they joined.
UPDATE chat_participants SET history_from = NULL WHERE history_from IS NOT NULL;
