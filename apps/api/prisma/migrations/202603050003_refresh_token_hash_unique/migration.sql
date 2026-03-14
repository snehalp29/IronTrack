-- Enforce refresh token hash uniqueness to prevent duplicate active rows.
DROP INDEX IF EXISTS "RefreshToken_tokenHash_idx";

WITH ranked_duplicates AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY "tokenHash"
        ORDER BY ("revokedAt" IS NULL) DESC, "createdAt" DESC, id DESC
      ) AS row_rank
    FROM "RefreshToken"
  ) ranked
  WHERE ranked.row_rank > 1
)
DELETE FROM "RefreshToken"
WHERE id IN (SELECT id FROM ranked_duplicates);

CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_tokenHash_key"
ON "RefreshToken" ("tokenHash");
