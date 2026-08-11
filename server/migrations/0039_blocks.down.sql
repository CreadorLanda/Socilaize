-- Put the blocks back where they were: on the conversation, symmetric.
-- Anyone blocked in either direction ends up with a blocked chat again, which
-- is the closest the old shape can express.
UPDATE chats SET status = 'blocked'
WHERE type = 'direct' AND EXISTS (
    SELECT 1 FROM blocks b
    JOIN chat_participants p1 ON p1.user_id = b.blocker_id AND p1.chat_id = chats.id
    JOIN chat_participants p2 ON p2.user_id = b.blocked_id AND p2.chat_id = chats.id
);

DROP TABLE IF EXISTS blocks;
