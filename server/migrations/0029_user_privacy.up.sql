-- Privacy settings, per user.
--
-- The settings screen has offered all three since the beginning and none of
-- them left the device: they were React state, reset on every navigation and
-- never sent anywhere.
--
-- read_receipts is reciprocal, which is the part that makes it honest: with
-- it off you neither send read receipts nor see anyone else's. A setting that
-- only hides your own is a way to take without giving.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_seen_visibility TEXT NOT NULL DEFAULT 'everyone'
        CHECK (last_seen_visibility IN ('everyone', 'contacts', 'nobody')),
    ADD COLUMN IF NOT EXISTS photo_visibility TEXT NOT NULL DEFAULT 'everyone'
        CHECK (photo_visibility IN ('everyone', 'contacts', 'nobody')),
    ADD COLUMN IF NOT EXISTS read_receipts BOOLEAN NOT NULL DEFAULT TRUE;
