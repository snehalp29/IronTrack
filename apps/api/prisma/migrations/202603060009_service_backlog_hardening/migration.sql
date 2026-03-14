ALTER TABLE "ExerciseTemplate" DROP CONSTRAINT "ExerciseTemplate_ownerUserId_fkey";

ALTER TABLE "ExerciseTemplate"
ADD CONSTRAINT "ExerciseTemplate_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User"
ALTER COLUMN "avatarUrl" TYPE VARCHAR(2048);

ALTER TABLE "MuscleGroup"
ALTER COLUMN "imageUrl" TYPE VARCHAR(2048);

ALTER TABLE "MuscleGroup"
ALTER COLUMN "iconUrl" TYPE VARCHAR(2048);

ALTER TABLE "Equipment"
ALTER COLUMN "iconUrl" TYPE VARCHAR(2048);

ALTER TABLE "ExerciseVideo"
ALTER COLUMN "url" TYPE VARCHAR(2048);

ALTER TABLE "ExerciseVideo"
ALTER COLUMN "thumbnailUrl" TYPE VARCHAR(2048);

ALTER TABLE "PRRecord"
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "UserStreak"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ChecklistItem"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "PRRecord"
ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "UserStreak"
ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "ChecklistItem"
ALTER COLUMN "updatedAt" DROP DEFAULT;

CREATE UNIQUE INDEX "WorkoutTemplate_userId_orderIndex_active_key"
ON "WorkoutTemplate"("userId", "orderIndex")
WHERE "deletedAt" IS NULL AND "orderIndex" IS NOT NULL;

CREATE UNIQUE INDEX "WorkoutTemplate_userId_lower_name_active_key"
ON "WorkoutTemplate"("userId", LOWER("name"))
WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "ExerciseVideo_exerciseTemplateId_primary_key"
ON "ExerciseVideo"("exerciseTemplateId")
WHERE "isPrimary" = true;

CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
CREATE INDEX "ExerciseTemplate_deletedAt_idx" ON "ExerciseTemplate"("deletedAt");
CREATE INDEX "WorkoutTemplate_deletedAt_idx" ON "WorkoutTemplate"("deletedAt");
CREATE INDEX "WorkoutSession_userId_finishedAt_idx" ON "WorkoutSession"("userId", "finishedAt");
CREATE INDEX "WorkoutSession_deletedAt_idx" ON "WorkoutSession"("deletedAt");
CREATE INDEX "SessionExercise_exerciseTemplateId_idx" ON "SessionExercise"("exerciseTemplateId");
CREATE INDEX "SessionExercise_deletedAt_idx" ON "SessionExercise"("deletedAt");
CREATE INDEX "Set_deletedAt_idx" ON "Set"("deletedAt");
CREATE INDEX "PRRecord_userId_achievedAt_idx" ON "PRRecord"("userId", "achievedAt");
CREATE INDEX "PRRecord_sessionId_idx" ON "PRRecord"("sessionId");
CREATE INDEX "PRRecord_setId_idx" ON "PRRecord"("setId");

ALTER TABLE "Set"
ADD CONSTRAINT "Set_rpe_range_check"
CHECK ("rpe" IS NULL OR ("rpe" >= 1 AND "rpe" <= 10)),
ADD CONSTRAINT "Set_durationSeconds_nonnegative_check"
CHECK ("durationSeconds" IS NULL OR "durationSeconds" >= 0),
ADD CONSTRAINT "Set_weight_nonnegative_check"
CHECK ("weight" IS NULL OR "weight" >= 0),
ADD CONSTRAINT "Set_reps_nonnegative_check"
CHECK ("reps" IS NULL OR "reps" >= 0),
ADD CONSTRAINT "Set_orderIndex_nonnegative_check"
CHECK ("orderIndex" >= 0);

ALTER TABLE "WorkoutTemplate"
ADD CONSTRAINT "WorkoutTemplate_orderIndex_nonnegative_check"
CHECK ("orderIndex" IS NULL OR "orderIndex" >= 0);

ALTER TABLE "WorkoutTemplateExercise"
ADD CONSTRAINT "WorkoutTemplateExercise_orderIndex_nonnegative_check"
CHECK ("orderIndex" >= 0);

ALTER TABLE "WorkoutSession"
ADD CONSTRAINT "WorkoutSession_totalVolume_nonnegative_check"
CHECK ("totalVolume" IS NULL OR "totalVolume" >= 0),
ADD CONSTRAINT "WorkoutSession_version_positive_check"
CHECK ("version" >= 1),
ADD CONSTRAINT "WorkoutSession_status_endedReason_check"
CHECK (
  ("status" = 'IN_PROGRESS' AND "endedReason" IS NULL)
  OR ("status" = 'FINISHED' AND "endedReason" IS NOT NULL)
),
ADD CONSTRAINT "WorkoutSession_finishedAt_after_startedAt_check"
CHECK ("finishedAt" IS NULL OR "finishedAt" >= "startedAt"),
ADD CONSTRAINT "WorkoutSession_startedAt_not_future_check"
CHECK ("startedAt" <= CURRENT_TIMESTAMP + INTERVAL '5 minutes');

ALTER TABLE "SessionExercise"
ADD CONSTRAINT "SessionExercise_orderIndex_nonnegative_check"
CHECK ("orderIndex" >= 0),
ADD CONSTRAINT "SessionExercise_version_positive_check"
CHECK ("version" >= 1);

ALTER TABLE "PRRecord"
ADD CONSTRAINT "PRRecord_value_positive_check"
CHECK ("value" > 0);

ALTER TABLE "UserStreak"
ADD CONSTRAINT "UserStreak_invariants_check"
CHECK (
  "currentStreakDays" >= 0
  AND "longestStreakDays" >= 0
  AND "longestStreakDays" >= "currentStreakDays"
);
