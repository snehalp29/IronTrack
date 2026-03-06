ALTER TABLE "ExerciseTemplate"
ADD CONSTRAINT "ExerciseTemplate_owner_or_global_check"
CHECK ("isGlobal" = true OR "ownerUserId" IS NOT NULL);

CREATE INDEX "Set_completedAt_idx" ON "Set"("completedAt");
