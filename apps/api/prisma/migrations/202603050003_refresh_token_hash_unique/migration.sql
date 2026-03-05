-- Enforce refresh token hash uniqueness to prevent duplicate active rows.
DROP INDEX IF EXISTS "RefreshToken_tokenHash_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_tokenHash_key"
ON "RefreshToken" ("tokenHash");
