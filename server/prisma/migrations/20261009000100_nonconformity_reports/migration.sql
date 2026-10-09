-- Audit193 pins6071242717,6075820954,6076135661. Retained evidence is unchanged.
CREATE TABLE "NonconformityReport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "labId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "refType" TEXT NOT NULL,
  "refId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "impactAssessment" TEXT,
  "correctiveAction" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "raisedBy" TEXT NOT NULL,
  "closedBy" TEXT,
  "closedAt" DATETIME,
  "firstQcEvaluationId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "NonconformityReport_source_refType_refId_key" ON "NonconformityReport"("source","refType","refId");
CREATE INDEX "NonconformityReport_labId_status_source_idx" ON "NonconformityReport"("labId","status","source");
ALTER TABLE "ProficiencyRound" ADD COLUMN "nonconformityId" TEXT REFERENCES "NonconformityReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER "NonconformityReport_insert_guard"
BEFORE INSERT ON "NonconformityReport"
WHEN NEW."source" NOT IN ('QC','PT','REPEAT_LIMIT','CUSTOMER','INTAKE','OTHER')
  OR NEW."status" <> 'OPEN' OR NEW."closedBy" IS NOT NULL OR NEW."closedAt" IS NOT NULL
  OR length(trim(NEW."id"))=0 OR length(trim(NEW."refType"))=0 OR length(trim(NEW."refId"))=0
  OR length(trim(NEW."description"))=0 OR length(trim(NEW."raisedBy"))=0
  OR (NEW."impactAssessment" IS NOT NULL AND length(trim(NEW."impactAssessment"))=0)
  OR (NEW."correctiveAction" IS NOT NULL AND length(trim(NEW."correctiveAction"))=0)
BEGIN
  SELECT RAISE(ABORT,'NCR_INPUT_INVALID');
END;

CREATE TRIGGER "NonconformityReport_update_guard"
BEFORE UPDATE ON "NonconformityReport"
WHEN OLD."status"='CLOSED'
  OR NEW."id" IS NOT OLD."id" OR NEW."labId" IS NOT OLD."labId" OR NEW."source" IS NOT OLD."source"
  OR NEW."refType" IS NOT OLD."refType" OR NEW."refId" IS NOT OLD."refId"
  OR NEW."description" IS NOT OLD."description" OR NEW."raisedBy" IS NOT OLD."raisedBy"
  OR NEW."firstQcEvaluationId" IS NOT OLD."firstQcEvaluationId" OR NEW."createdAt" IS NOT OLD."createdAt"
  OR NOT ((OLD."status"='OPEN' AND NEW."status"='ACTION') OR (OLD."status"='ACTION' AND NEW."status"='CLOSED'))
  OR NEW."impactAssessment" IS NULL OR length(trim(NEW."impactAssessment"))=0
  OR (OLD."correctiveAction" IS NOT NULL AND (NEW."correctiveAction" IS NULL OR length(trim(NEW."correctiveAction"))=0))
  OR (NEW."status"='ACTION' AND (NEW."closedBy" IS NOT NULL OR NEW."closedAt" IS NOT NULL))
  OR (NEW."status"='CLOSED' AND (NEW."correctiveAction" IS NULL OR length(trim(NEW."correctiveAction"))=0
    OR NEW."closedBy" IS NULL OR length(trim(NEW."closedBy"))=0 OR NEW."closedAt" IS NULL))
BEGIN
  SELECT RAISE(ABORT,'NCR_TRANSITION_REFUSED');
END;

CREATE TRIGGER "NonconformityReport_delete_guard"
BEFORE DELETE ON "NonconformityReport"
BEGIN
  SELECT RAISE(ABORT,'NCR_DELETE_REFUSED');
END;

-- Only the two old PT guards are superseded; their #189 release bytes stay intact.
DROP TRIGGER "ProficiencyRound_ncr_status_insert_guard";
DROP TRIGGER "ProficiencyRound_ncr_status_update_guard";
CREATE TRIGGER "ProficiencyRound_ncr_status_insert_guard"
BEFORE INSERT ON "ProficiencyRound"
WHEN NOT ((NEW."ncrStatus" IS NULL AND NEW."nonconformityId" IS NULL)
  OR (NEW."ncrStatus" IS 'RAISED' AND NEW."nonconformityId" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "NonconformityReport" n WHERE n."id"=NEW."nonconformityId" AND n."source"='PT'
      AND n."refType"='ProficiencyRound' AND n."refId"=NEW."id" AND n."labId"=NEW."labId")))
BEGIN
  SELECT RAISE(ABORT,'PT_NCR_STATUS_INVALID');
END;

CREATE TRIGGER "ProficiencyRound_ncr_status_update_guard"
BEFORE UPDATE ON "ProficiencyRound"
WHEN (NEW."ncrStatus" IS NOT OLD."ncrStatus" AND NOT (
    NEW."ncrStatus" IS 'RAISED' AND (OLD."ncrStatus" IS NULL OR OLD."ncrStatus" IS 'PENDING')))
  OR (OLD."nonconformityId" IS NOT NULL AND NEW."nonconformityId" IS NOT OLD."nonconformityId")
  OR NOT ((NEW."ncrStatus" IS NULL AND NEW."nonconformityId" IS NULL)
    OR (NEW."ncrStatus" IS 'PENDING' AND OLD."ncrStatus" IS 'PENDING' AND NEW."nonconformityId" IS NULL)
    OR (NEW."ncrStatus" IS 'RAISED' AND NEW."nonconformityId" IS NOT NULL AND EXISTS (
      SELECT 1 FROM "NonconformityReport" n WHERE n."id"=NEW."nonconformityId" AND n."source"='PT'
        AND n."refType"='ProficiencyRound' AND n."refId"=NEW."id" AND n."labId"=NEW."labId")))
BEGIN
  SELECT RAISE(ABORT,'PT_NCR_STATUS_INVALID');
END;
