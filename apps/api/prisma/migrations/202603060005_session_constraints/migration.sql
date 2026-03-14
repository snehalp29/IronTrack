ALTER TABLE "ExerciseTemplate"
ALTER COLUMN "name" TYPE VARCHAR(120);

ALTER TABLE "WorkoutTemplate"
ALTER COLUMN "name" TYPE VARCHAR(120);

ALTER TABLE "WorkoutSession"
ALTER COLUMN "notes" TYPE VARCHAR(4000);

CREATE UNIQUE INDEX "WorkoutSession_single_in_progress_per_user"
ON "WorkoutSession" ("userId")
WHERE status = 'IN_PROGRESS' AND "deletedAt" IS NULL;
