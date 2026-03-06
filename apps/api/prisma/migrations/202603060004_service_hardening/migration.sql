ALTER TABLE "User"
ALTER COLUMN "email" TYPE VARCHAR(320);

ALTER TABLE "RefreshToken"
ALTER COLUMN "tokenHash" TYPE CHAR(64);

CREATE INDEX IF NOT EXISTS "WorkoutSession_userId_status_idx"
ON "WorkoutSession"("userId", "status");

ALTER TABLE "Set"
ADD CONSTRAINT "Set_payload_size_check"
CHECK (octet_length(("payload")::text) <= 4000);
