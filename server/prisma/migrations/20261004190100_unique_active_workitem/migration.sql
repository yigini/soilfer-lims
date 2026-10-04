-- Existing duplicates must be explicitly resolved by a manager before this migration.
CREATE UNIQUE INDEX "WorkItem_one_active_per_analysis" ON "WorkItem"("sampleId", "analysis") WHERE "duplicateOf" IS NULL;
