-- Rollback is intentionally non-destructive. The removed columns were
-- legacy server-side E2EE material and are not recreated, because restoring
-- them would reintroduce an insecure capability. Restore from a database
-- backup only if an external legacy consumer is proven to require them.
SELECT 1;
