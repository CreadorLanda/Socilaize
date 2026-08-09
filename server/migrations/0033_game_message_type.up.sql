ALTER TABLE messages
    DROP CONSTRAINT IF EXISTS messages_message_type_check,
    ADD CONSTRAINT messages_message_type_check
        CHECK (message_type IN ('text','image','video','audio',
              'document','sticker','location','contact',
              'poll','event','system','reply','game'));
