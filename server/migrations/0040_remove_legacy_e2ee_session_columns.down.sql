-- 0006 never added these columns: its CREATE TABLE IF NOT EXISTS was a no-op
-- because 0001 already owns `sessions` for refresh tokens. The real schema
-- immediately before 0040 therefore has nothing to restore.
SELECT 1;
