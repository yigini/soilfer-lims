-- Audit 2.6: additive PT evidence. Existing scores/outcomes are never recomputed.
ALTER TABLE "ProficiencyRound" ADD COLUMN "ncrStatus" TEXT;
ALTER TABLE "ProficiencyRound" ADD COLUMN "classificationLimits" TEXT;
ALTER TABLE "ProficiencyRound" ADD COLUMN "legacyScoreFlag" TEXT;
ALTER TABLE "ProficiencyRound" ADD COLUMN "legacyFlaggedAt" DATETIME;
ALTER TABLE "ProficiencyRound" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "ProficiencyRound" ADD COLUMN "deletedBy" TEXT;
ALTER TABLE "ProficiencyRound" ADD COLUMN "deleteReason" TEXT;

CREATE TRIGGER "ProficiencyRound_ncr_status_insert_guard"
BEFORE INSERT ON "ProficiencyRound"
WHEN NEW."ncrStatus" IS NOT NULL AND NEW."ncrStatus" <> 'PENDING'
BEGIN
  SELECT RAISE(ABORT, 'PT_NCR_STATUS_INVALID');
END;

CREATE TRIGGER "ProficiencyRound_ncr_status_update_guard"
BEFORE UPDATE OF "ncrStatus" ON "ProficiencyRound"
WHEN NEW."ncrStatus" IS NOT NULL AND NEW."ncrStatus" <> 'PENDING'
BEGIN
  SELECT RAISE(ABORT, 'PT_NCR_STATUS_INVALID');
END;
