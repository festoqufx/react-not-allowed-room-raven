ALTER TABLE user_profile
    ALTER COLUMN isverified SET DEFAULT FALSE;

ALTER TABLE user_profile
    ADD COLUMN IF NOT EXISTS verification_token_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profile_verification_token_hash
    ON user_profile(verification_token_hash)
    WHERE verification_token_hash IS NOT NULL;
