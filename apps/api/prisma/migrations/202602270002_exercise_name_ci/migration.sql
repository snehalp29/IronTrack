-- Case-insensitive uniqueness for exercise names scoped by owner/global, excluding soft-deleted rows.
CREATE UNIQUE INDEX IF NOT EXISTS "ExerciseTemplate_owner_or_global_lower_name_active_key"
ON "ExerciseTemplate" (
  COALESCE("ownerUserId", '00000000-0000-0000-0000-000000000000'::uuid),
  LOWER("name")
)
WHERE "deletedAt" IS NULL;
