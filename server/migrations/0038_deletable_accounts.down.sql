-- Reversing this needs the orphans gone: NOT NULL cannot come back while a
-- deleted account's messages sit there with a NULL sender. They are removed,
-- which is the only way back and is why this migration is one-way in practice.
DELETE FROM messages WHERE sender_id IS NULL;
DELETE FROM chats WHERE created_by IS NULL;

ALTER TABLE messages DROP CONSTRAINT messages_sender_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES users(id);
ALTER TABLE messages ALTER COLUMN sender_id SET NOT NULL;

ALTER TABLE chats DROP CONSTRAINT chats_created_by_fkey;
ALTER TABLE chats ADD CONSTRAINT chats_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id);
ALTER TABLE chats ALTER COLUMN created_by SET NOT NULL;
