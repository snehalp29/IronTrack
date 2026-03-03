-- Enforce uniqueness for owner-specific exercises (ownerUserId IS NOT NULL).
CREATE UNIQUE INDEX IF NOT EXISTS "ExerciseTemplate_owner_lower_name_active_key"
ON "ExerciseTemplate" (
  "ownerUserId",
  LOWER("name")
)
WHERE "deletedAt" IS NULL
  AND "ownerUserId" IS NOT NULL;

-- Enforce uniqueness for global exercises (ownerUserId IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS "ExerciseTemplate_global_lower_name_active_key"
ON "ExerciseTemplate" (
  LOWER("name")
)
WHERE "deletedAt" IS NULL
  AND "ownerUserId" IS NULL;
