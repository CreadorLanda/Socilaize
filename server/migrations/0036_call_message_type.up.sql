-- A call leaves a row in the conversation.
--
-- A call used to leave nothing behind: the thread said nothing about who rang
-- or whether it was answered, and there was no way to get back into one that
-- was still going except by finding it in a separate screen.
ALTER TABLE messages
    DROP CONSTRAINT IF EXISTS messages_message_type_check,
    ADD CONSTRAINT messages_message_type_check
        CHECK (message_type IN ('text','image','video','audio',
                                'document','sticker','location','contact',
                                'poll','event','system','reply','game','call'));
