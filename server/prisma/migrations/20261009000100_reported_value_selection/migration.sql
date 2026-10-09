-- #192 pins6072618378,6072757161,6073013502,6073057498.
-- Additive selection evidence. No Result, attempt, QC, audit or report changes.
CREATE TABLE "ReportedValueSelection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workItemId" TEXT NOT NULL,
  "analysisCode" TEXT NOT NULL,
  "selectionGroupId" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "attemptIds" TEXT NOT NULL,
  "resultIds" TEXT NOT NULL,
  "value" REAL,
  "valueText" TEXT NOT NULL,
  "unit" TEXT,
  "censoring" TEXT NOT NULL,
  "methodologyId" TEXT,
  "rule" TEXT NOT NULL,
  "policyKey" TEXT NOT NULL,
  "policyVersion" INTEGER NOT NULL,
  "policyRule" TEXT NOT NULL,
  "qcRuleSnapshot" TEXT NOT NULL,
  "evidenceSnapshot" TEXT NOT NULL,
  "lineageSnapshot" TEXT NOT NULL,
  "outputParams" TEXT NOT NULL,
  "derivation" TEXT,
  "reason" TEXT,
  "selectedBy" TEXT NOT NULL,
  "selectedAt" DATETIME NOT NULL,
  "supersedesId" TEXT,
  "backfill" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ReportedValueSelection_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReportedValueSelection_supersedesId_key" ON "ReportedValueSelection"("supersedesId");
CREATE UNIQUE INDEX "ReportedValueSelection_selectionGroupId_analysisCode_key" ON "ReportedValueSelection"("selectionGroupId", "analysisCode");
CREATE INDEX "ReportedValueSelection_workItemId_analysisCode_idx" ON "ReportedValueSelection"("workItemId", "analysisCode");

-- INSTALLER_GUARDS_AFTER_SCHEMA
CREATE UNIQUE INDEX "ReportedValueSelection_one_root" ON "ReportedValueSelection"("workItemId", "analysisCode") WHERE "supersedesId" IS NULL;
CREATE TRIGGER "ReportedValueSelection_update_refused" BEFORE UPDATE ON "ReportedValueSelection"
BEGIN SELECT RAISE(ABORT, 'REPORTED_VALUE_SELECTION_IMMUTABLE'); END;
CREATE TRIGGER "ReportedValueSelection_delete_refused" BEFORE DELETE ON "ReportedValueSelection"
BEGIN SELECT RAISE(ABORT, 'REPORTED_VALUE_SELECTION_IMMUTABLE'); END;
CREATE TRIGGER "ReportedValueSelection_insert_contract" BEFORE INSERT ON "ReportedValueSelection"
WHEN NEW."mode" NOT IN ('ATTEMPT','MEAN','NOT_REPORTABLE')
 OR NEW."rule" NOT IN ('AUTO_SINGLE','AUTO_DUPLICATE_MEAN','AUTO_LATEST_AFTER_INVALIDATION','AUTO_LATEST_VALID','REVIEWER')
 OR NEW."policyRule" NOT IN ('MEAN_IF_WITHIN_R','LATEST_VALID','REVIEWER_PICKS')
 OR NEW."policyKey" <> 'results.reportedValueRule'
 OR NEW."policyVersion" < 0
 OR NEW."censoring" NOT IN ('NONE','BELOW_LOQ','ABOVE_RANGE')
 OR length(trim(NEW."id"))=0 OR length(trim(NEW."analysisCode"))=0
 OR length(trim(NEW."selectionGroupId"))=0 OR length(trim(NEW."selectedBy"))=0
 OR CASE WHEN json_valid(NEW."attemptIds") THEN json_type(NEW."attemptIds") <> 'array' ELSE 1 END
 OR CASE WHEN json_valid(NEW."resultIds") THEN json_type(NEW."resultIds") <> 'array' ELSE 1 END
 OR CASE WHEN json_valid(NEW."qcRuleSnapshot") THEN json_type(NEW."qcRuleSnapshot") <> 'array' ELSE 1 END
 OR CASE WHEN json_valid(NEW."evidenceSnapshot") THEN json_type(NEW."evidenceSnapshot") <> 'object' ELSE 1 END
 OR CASE WHEN json_valid(NEW."lineageSnapshot") THEN json_type(NEW."lineageSnapshot") <> 'object' ELSE 1 END
 OR CASE WHEN json_valid(NEW."outputParams") THEN json_type(NEW."outputParams") <> 'array' ELSE 1 END
 OR NOT EXISTS(SELECT 1 FROM json_each(NEW."outputParams") WHERE value=NEW."analysisCode")
 OR (NEW."mode"='NOT_REPORTABLE' AND (NEW."reason" IS NULL OR length(trim(NEW."reason"))=0 OR NEW."value" IS NOT NULL OR NEW."valueText"<>''))
 OR (NEW."mode"<>'NOT_REPORTABLE' AND (json_array_length(NEW."attemptIds")=0 OR json_array_length(NEW."resultIds")=0))
 OR (NEW."supersedesId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM "ReportedValueSelection" old
     WHERE old."id"=NEW."supersedesId" AND old."workItemId"=NEW."workItemId" AND old."analysisCode"=NEW."analysisCode"
       AND old."selectionGroupId"<>NEW."selectionGroupId"))
 OR EXISTS(SELECT 1 FROM "ReportedValueSelection" sibling WHERE sibling."selectionGroupId"=NEW."selectionGroupId" AND (
     sibling."workItemId"<>NEW."workItemId" OR sibling."mode"<>NEW."mode" OR sibling."attemptIds"<>NEW."attemptIds"
     OR sibling."rule"<>NEW."rule" OR sibling."policyVersion"<>NEW."policyVersion" OR sibling."policyRule"<>NEW."policyRule"
     OR sibling."lineageSnapshot"<>NEW."lineageSnapshot" OR sibling."outputParams"<>NEW."outputParams"
     OR sibling."qcRuleSnapshot"<>NEW."qcRuleSnapshot" OR sibling."evidenceSnapshot"<>NEW."evidenceSnapshot"
     OR sibling."selectedBy"<>NEW."selectedBy" OR sibling."selectedAt"<>NEW."selectedAt" OR sibling."reason" IS NOT NEW."reason"
     OR sibling."backfill"<>NEW."backfill"))
BEGIN SELECT RAISE(ABORT, 'REPORTED_VALUE_SELECTION_INVALID'); END;
