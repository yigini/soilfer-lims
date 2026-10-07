-- #186: additive physical positions and immutable QC evidence. No legacy data is rewritten.

ALTER TABLE "Batch" ADD COLUMN "instrumentId" TEXT REFERENCES "EquipmentAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Batch" ADD COLUMN "analystUsername" TEXT REFERENCES "User"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Batch" ADD COLUMN "startedAt" DATETIME;

ALTER TABLE "Batch" ADD COLUMN "completedAt" DATETIME;

CREATE TABLE "BatchAnalyte" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "labId" TEXT,
    "analysisCode" TEXT NOT NULL,
    "methodologyId" TEXT,
    "methodResolution" TEXT,
    "qcRuleId" TEXT,
    "qcRuleVersion" INTEGER,
    "policyVersion" INTEGER,
    "criteriaSnapshot" TEXT,
    "crmOrdinal" INTEGER,
    "status" TEXT NOT NULL,
    "provenance" TEXT NOT NULL,
    "legacyMembershipFrozen" BOOLEAN NOT NULL DEFAULT false,
    "legacySource" TEXT,
    CONSTRAINT "BatchAnalyte_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BatchAnalyte_methodologyId_fkey" FOREIGN KEY ("methodologyId") REFERENCES "Methodology" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BatchAnalyte_qcRuleId_fkey" FOREIGN KEY ("qcRuleId") REFERENCES "QcRule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "BatchPosition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "sampleId" TEXT,
    "duplicateOfPositionId" TEXT,
    "historicalSnapshotSeq" INTEGER,
    "provenance" TEXT NOT NULL,
    "legacySource" TEXT,
    CONSTRAINT "BatchPosition_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BatchPosition_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BatchPosition_duplicateOfPositionId_fkey" FOREIGN KEY ("duplicateOfPositionId") REFERENCES "BatchPosition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "BatchPositionWorkItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "positionId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "analysisCode" TEXT NOT NULL,
    CONSTRAINT "BatchPositionWorkItem_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "BatchPosition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BatchPositionWorkItem_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "BatchPositionReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "positionId" TEXT NOT NULL,
    "analysisCode" TEXT NOT NULL,
    "referenceMaterialId" TEXT NOT NULL,
    "referenceValueId" TEXT,
    "referenceUse" TEXT NOT NULL,
    "referenceSnapshot" TEXT,
    "serviceStatus" TEXT NOT NULL DEFAULT 'SERVED',
    "boundBy" TEXT,
    "boundAt" DATETIME,
    "supersededById" TEXT,
    "correctionReason" TEXT,
    CONSTRAINT "BatchPositionReference_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "BatchPosition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BatchPositionReference_referenceMaterialId_fkey" FOREIGN KEY ("referenceMaterialId") REFERENCES "ReferenceMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BatchPositionReference_referenceValueId_fkey" FOREIGN KEY ("referenceValueId") REFERENCES "ReferenceValue" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "QcMeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "analysisCode" TEXT NOT NULL,
    "replicateNo" INTEGER NOT NULL,
    "value" REAL,
    "rawInput" TEXT,
    "censoring" TEXT,
    "censoringLimit" REAL,
    "enteredBy" TEXT,
    "enteredAt" DATETIME,
    "supersededById" TEXT,
    "correctionReason" TEXT,
    "legacySource" TEXT,
    CONSTRAINT "QcMeasurement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QcMeasurement_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "BatchPosition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "QcEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "analysisCode" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "ruleId" TEXT,
    "ruleVersion" INTEGER,
    "policyVersion" INTEGER,
    "verdict" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "evaluatedBy" TEXT,
    "evaluatedAt" DATETIME,
    "supersedesId" TEXT,
    "legacySource" TEXT,
    CONSTRAINT "QcEvaluation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QcEvaluation_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "QcRule" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QcEvaluation_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "QcEvaluation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "BatchDisposition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "analysisCode" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "decidedBy" TEXT,
    "decidedAt" DATETIME,
    "legacySource" TEXT,
    CONSTRAINT "BatchDisposition_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "BatchEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "by" TEXT,
    "at" DATETIME,
    CONSTRAINT "BatchEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "BatchAnalyte_labId_analysisCode_methodologyId_idx" ON "BatchAnalyte"("labId", "analysisCode", "methodologyId");

CREATE UNIQUE INDEX "BatchAnalyte_batchId_analysisCode_key" ON "BatchAnalyte"("batchId", "analysisCode");

CREATE UNIQUE INDEX "BatchPosition_batchId_position_key" ON "BatchPosition"("batchId", "position");

CREATE UNIQUE INDEX "BatchPositionWorkItem_workItemId_key" ON "BatchPositionWorkItem"("workItemId");

CREATE UNIQUE INDEX "BatchPositionWorkItem_positionId_analysisCode_key" ON "BatchPositionWorkItem"("positionId", "analysisCode");

CREATE INDEX "BatchPositionReference_positionId_analysisCode_idx" ON "BatchPositionReference"("positionId", "analysisCode");

CREATE INDEX "QcMeasurement_batchId_analysisCode_idx" ON "QcMeasurement"("batchId", "analysisCode");

CREATE INDEX "QcMeasurement_positionId_analysisCode_replicateNo_idx" ON "QcMeasurement"("positionId", "analysisCode", "replicateNo");

CREATE UNIQUE INDEX "QcEvaluation_batchId_analysisCode_version_key" ON "QcEvaluation"("batchId", "analysisCode", "version");

CREATE INDEX "BatchDisposition_batchId_analysisCode_idx" ON "BatchDisposition"("batchId", "analysisCode");

CREATE INDEX "BatchEvent_batchId_at_idx" ON "BatchEvent"("batchId", "at");

CREATE UNIQUE INDEX "BatchAnalyte_crm_ordinal_unique" ON "BatchAnalyte"("labId","analysisCode","methodologyId","crmOrdinal") WHERE "crmOrdinal" IS NOT NULL;

CREATE UNIQUE INDEX "BatchPositionReference_current_unique" ON "BatchPositionReference"("positionId","analysisCode") WHERE "supersededById" IS NULL;

CREATE UNIQUE INDEX "QcMeasurement_current_unique" ON "QcMeasurement"("positionId","analysisCode","replicateNo") WHERE "supersededById" IS NULL;

CREATE TRIGGER "Batch_legacy_qc_immutable" BEFORE UPDATE ON "Batch"
WHEN NEW."qcResults" IS NOT OLD."qcResults"
  OR NEW."disposition" IS NOT OLD."disposition"
  OR NEW."history" IS NOT OLD."history"
  OR NEW."workItemIds" IS NOT OLD."workItemIds"
BEGIN
  SELECT RAISE(ABORT, 'BATCH_LEGACY_EVIDENCE_IMMUTABLE');
END;

CREATE TRIGGER "Batch_first_start_immutable" BEFORE UPDATE ON "Batch"
WHEN OLD.startedAt IS NOT NULL AND (NEW.startedAt IS NOT OLD.startedAt OR NEW.analystUsername IS NOT OLD.analystUsername OR NEW.instrumentId IS NOT OLD.instrumentId)
BEGIN
  SELECT RAISE(ABORT, 'BATCH_RUN_METADATA_IMMUTABLE');
END;

CREATE TRIGGER "BatchQcResult_frozen_insert" BEFORE INSERT ON "BatchQcResult"
BEGIN
  SELECT RAISE(ABORT, 'BATCH_LEGACY_EVIDENCE_IMMUTABLE');
END;

CREATE TRIGGER "BatchQcResult_frozen_update" BEFORE UPDATE ON "BatchQcResult"
BEGIN
  SELECT RAISE(ABORT, 'BATCH_LEGACY_EVIDENCE_IMMUTABLE');
END;

CREATE TRIGGER "BatchQcResult_frozen_delete" BEFORE DELETE ON "BatchQcResult"
BEGIN
  SELECT RAISE(ABORT, 'BATCH_LEGACY_EVIDENCE_IMMUTABLE');
END;

CREATE TRIGGER "BatchAnalyte_insert_guard" BEFORE INSERT ON "BatchAnalyte"
WHEN NEW.status NOT IN ('OPEN','IN_RUN','QC_PENDING','QC_PASS','QC_WARN','QC_FAIL','ACCEPTED_WITH_DEVIATION','REPEAT_ORDERED','REJECTED','CLOSED')
  OR NEW.provenance NOT IN ('NATIVE','LEGACY_MIGRATED','PROFILE_ONLY')
  OR NEW.labId IS NOT (SELECT b.labId FROM "Batch" b WHERE b.id=NEW.batchId)
  OR NEW.legacyMembershipFrozen NOT IN (0,1)
  OR (NEW.crmOrdinal IS NOT NULL AND (typeof(NEW.crmOrdinal)<>'integer' OR NEW.crmOrdinal<1 OR NEW.provenance<>'NATIVE'))
  OR (NEW.methodologyId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Methodology" m WHERE m.id=NEW.methodologyId AND m.analysisCode=NEW.analysisCode))
  OR (NEW.qcRuleId IS NULL) <> (NEW.qcRuleVersion IS NULL)
  OR (NEW.qcRuleId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "QcRule" r JOIN "Lab" l ON l.id=r.labId
    WHERE r.id=NEW.qcRuleId AND r.version=NEW.qcRuleVersion AND r.analysisCode=NEW.analysisCode AND NEW.labId IN (l.id,l.code)
    AND (r.methodologyId IS NULL OR r.methodologyId=NEW.methodologyId)))
  OR (NEW.criteriaSnapshot IS NOT NULL AND NOT json_valid(NEW.criteriaSnapshot))
  OR (NEW.policyVersion IS NOT NULL AND (typeof(NEW.policyVersion)<>'integer' OR NEW.policyVersion<0))
  OR (NEW.provenance='NATIVE' AND (NEW.methodologyId IS NULL OR NEW.labId IS NULL OR NEW.legacyMembershipFrozen<>0
    OR (NEW.criteriaSnapshot IS NULL) <> (NEW.policyVersion IS NULL)
    OR (NEW.criteriaSnapshot IS NULL) <> (NEW.crmOrdinal IS NULL)
    OR (NEW.criteriaSnapshot IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Batch" b WHERE b.id=NEW.batchId AND b.startedAt IS NOT NULL))))
BEGIN
  SELECT RAISE(ABORT, 'BATCH_ANALYTE_INVALID');
END;

CREATE TRIGGER "BatchAnalyte_update_guard" BEFORE UPDATE ON "BatchAnalyte"
WHEN NEW.status NOT IN ('OPEN','IN_RUN','QC_PENDING','QC_PASS','QC_WARN','QC_FAIL','ACCEPTED_WITH_DEVIATION','REPEAT_ORDERED','REJECTED','CLOSED')
  OR NEW.provenance NOT IN ('NATIVE','LEGACY_MIGRATED','PROFILE_ONLY')
  OR NEW.labId IS NOT (SELECT b.labId FROM "Batch" b WHERE b.id=NEW.batchId)
  OR NEW.legacyMembershipFrozen NOT IN (0,1)
  OR (NEW.crmOrdinal IS NOT NULL AND (typeof(NEW.crmOrdinal)<>'integer' OR NEW.crmOrdinal<1 OR NEW.provenance<>'NATIVE'))
  OR (NEW.methodologyId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Methodology" m WHERE m.id=NEW.methodologyId AND m.analysisCode=NEW.analysisCode))
  OR (NEW.qcRuleId IS NULL) <> (NEW.qcRuleVersion IS NULL)
  OR (NEW.qcRuleId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "QcRule" r JOIN "Lab" l ON l.id=r.labId
    WHERE r.id=NEW.qcRuleId AND r.version=NEW.qcRuleVersion AND r.analysisCode=NEW.analysisCode AND NEW.labId IN (l.id,l.code)
    AND (r.methodologyId IS NULL OR r.methodologyId=NEW.methodologyId)))
  OR (NEW.criteriaSnapshot IS NOT NULL AND NOT json_valid(NEW.criteriaSnapshot))
  OR (NEW.policyVersion IS NOT NULL AND (typeof(NEW.policyVersion)<>'integer' OR NEW.policyVersion<0))
  OR (NEW.provenance='NATIVE' AND (NEW.methodologyId IS NULL OR NEW.labId IS NULL OR NEW.legacyMembershipFrozen<>0
    OR (NEW.criteriaSnapshot IS NULL) <> (NEW.policyVersion IS NULL)
    OR (NEW.criteriaSnapshot IS NULL) <> (NEW.crmOrdinal IS NULL)
    OR (NEW.criteriaSnapshot IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Batch" b WHERE b.id=NEW.batchId AND b.startedAt IS NOT NULL))))
BEGIN
  SELECT RAISE(ABORT, 'BATCH_ANALYTE_INVALID');
END;

CREATE TRIGGER "BatchAnalyte_identity_immutable" BEFORE UPDATE ON "BatchAnalyte"
WHEN NEW.id IS NOT OLD.id OR NEW.batchId IS NOT OLD.batchId OR NEW.analysisCode IS NOT OLD.analysisCode
  OR NEW.labId IS NOT OLD.labId OR NEW.legacySource IS NOT OLD.legacySource
  OR NEW.legacyMembershipFrozen IS NOT OLD.legacyMembershipFrozen
  OR (OLD.provenance='NATIVE' AND NEW.provenance IS NOT OLD.provenance)
  OR (OLD.crmOrdinal IS NOT NULL AND NEW.crmOrdinal IS NOT OLD.crmOrdinal)
  OR (OLD.criteriaSnapshot IS NOT NULL AND (NEW.qcRuleId IS NOT OLD.qcRuleId OR NEW.qcRuleVersion IS NOT OLD.qcRuleVersion OR NEW.policyVersion IS NOT OLD.policyVersion OR NEW.criteriaSnapshot IS NOT OLD.criteriaSnapshot OR NEW.methodologyId IS NOT OLD.methodologyId))
BEGIN
  SELECT RAISE(ABORT, 'BATCH_ANALYTE_EVIDENCE_IMMUTABLE');
END;

CREATE TRIGGER "BatchAnalyte_membership_insert_guard" BEFORE INSERT ON "BatchAnalyte"
WHEN EXISTS (SELECT 1 FROM "Batch" b WHERE b.id=NEW.batchId AND b.startedAt IS NOT NULL)
  OR EXISTS (SELECT 1 FROM "BatchAnalyte" a WHERE a.batchId=NEW.batchId AND a.legacyMembershipFrozen=1)
  OR EXISTS (SELECT 1 FROM "QcMeasurement" q WHERE q.batchId=NEW.batchId)
BEGIN
  SELECT RAISE(ABORT, 'BATCH_MEMBERSHIP_FROZEN');
END;

CREATE TRIGGER "BatchAnalyte_membership_delete_guard" BEFORE DELETE ON "BatchAnalyte"
WHEN EXISTS (SELECT 1 FROM "Batch" b WHERE b.id=OLD.batchId AND b.startedAt IS NOT NULL)
  OR EXISTS (SELECT 1 FROM "BatchAnalyte" a WHERE a.batchId=OLD.batchId AND a.legacyMembershipFrozen=1)
  OR EXISTS (SELECT 1 FROM "QcMeasurement" q WHERE q.batchId=OLD.batchId)
BEGIN
  SELECT RAISE(ABORT, 'BATCH_MEMBERSHIP_FROZEN');
END;

CREATE TRIGGER "BatchAnalyte_membership_update_guard" BEFORE UPDATE ON "BatchAnalyte"
WHEN (NEW.methodologyId IS NOT OLD.methodologyId OR NEW.provenance IS NOT OLD.provenance) AND (EXISTS (SELECT 1 FROM "Batch" b WHERE b.id=OLD.batchId AND b.startedAt IS NOT NULL)
  OR EXISTS (SELECT 1 FROM "BatchAnalyte" a WHERE a.batchId=OLD.batchId AND a.legacyMembershipFrozen=1)
  OR EXISTS (SELECT 1 FROM "QcMeasurement" q WHERE q.batchId=OLD.batchId))
BEGIN
  SELECT RAISE(ABORT, 'BATCH_MEMBERSHIP_FROZEN');
END;

CREATE TRIGGER "BatchPosition_insert_guard" BEFORE INSERT ON "BatchPosition"
WHEN typeof(NEW.position)<>'integer' OR NEW.position<1
  OR (NEW.historicalSnapshotSeq IS NOT NULL AND (typeof(NEW.historicalSnapshotSeq)<>'integer' OR NEW.historicalSnapshotSeq<1 OR NEW.provenance<>'LEGACY_MIGRATED'))
  OR NEW.kind NOT IN ('SAMPLE','BLANK','DUPLICATE','LRM','CRM','ICV','CCV','CCB','CAL_STD','CONTROL')
  OR NEW.provenance NOT IN ('NATIVE','LEGACY_MIGRATED','PROFILE_ONLY')
  OR (NEW.provenance='NATIVE' AND ((NEW.kind IN ('SAMPLE','DUPLICATE') AND NEW.sampleId IS NULL)
    OR (NEW.kind='DUPLICATE' AND NEW.duplicateOfPositionId IS NULL) OR NEW.kind='CONTROL'))
  OR (NEW.duplicateOfPositionId IS NOT NULL AND (NEW.kind<>'DUPLICATE' OR NOT EXISTS (
    SELECT 1 FROM "BatchPosition" p WHERE p.id=NEW.duplicateOfPositionId AND p.kind='SAMPLE' AND p.batchId=NEW.batchId AND p.sampleId IS NEW.sampleId)))
BEGIN
  SELECT RAISE(ABORT, 'BATCH_POSITION_INVALID');
END;

CREATE TRIGGER "BatchPosition_update_guard" BEFORE UPDATE ON "BatchPosition"
WHEN typeof(NEW.position)<>'integer' OR NEW.position<1
  OR (NEW.historicalSnapshotSeq IS NOT NULL AND (typeof(NEW.historicalSnapshotSeq)<>'integer' OR NEW.historicalSnapshotSeq<1 OR NEW.provenance<>'LEGACY_MIGRATED'))
  OR NEW.kind NOT IN ('SAMPLE','BLANK','DUPLICATE','LRM','CRM','ICV','CCV','CCB','CAL_STD','CONTROL')
  OR NEW.provenance NOT IN ('NATIVE','LEGACY_MIGRATED','PROFILE_ONLY')
  OR (NEW.provenance='NATIVE' AND ((NEW.kind IN ('SAMPLE','DUPLICATE') AND NEW.sampleId IS NULL)
    OR (NEW.kind='DUPLICATE' AND NEW.duplicateOfPositionId IS NULL) OR NEW.kind='CONTROL'))
  OR (NEW.duplicateOfPositionId IS NOT NULL AND (NEW.kind<>'DUPLICATE' OR NOT EXISTS (
    SELECT 1 FROM "BatchPosition" p WHERE p.id=NEW.duplicateOfPositionId AND p.kind='SAMPLE' AND p.batchId=NEW.batchId AND p.sampleId IS NEW.sampleId)))
BEGIN
  SELECT RAISE(ABORT, 'BATCH_POSITION_INVALID');
END;

CREATE TRIGGER "BatchPosition_membership_insert_guard" BEFORE INSERT ON "BatchPosition"
WHEN (NEW.kind='SAMPLE' OR NEW.provenance<>'PROFILE_ONLY'
  OR NOT EXISTS (SELECT 1 FROM "BatchAnalyte" a WHERE a.batchId=NEW.batchId AND a.provenance<>'NATIVE'))
  AND (EXISTS (SELECT 1 FROM "Batch" b WHERE b.id=NEW.batchId AND b.startedAt IS NOT NULL)
  OR EXISTS (SELECT 1 FROM "BatchAnalyte" a WHERE a.batchId=NEW.batchId AND a.legacyMembershipFrozen=1)
  OR EXISTS (SELECT 1 FROM "QcMeasurement" q WHERE q.batchId=NEW.batchId))
BEGIN
  SELECT RAISE(ABORT, 'BATCH_MEMBERSHIP_FROZEN');
END;

CREATE TRIGGER "BatchPosition_membership_update_guard" BEFORE UPDATE ON "BatchPosition"
WHEN EXISTS (SELECT 1 FROM "Batch" b WHERE b.id=NEW.batchId AND b.startedAt IS NOT NULL)
  OR EXISTS (SELECT 1 FROM "BatchAnalyte" a WHERE a.batchId=NEW.batchId AND a.legacyMembershipFrozen=1)
  OR EXISTS (SELECT 1 FROM "QcMeasurement" q WHERE q.batchId=NEW.batchId)
BEGIN
  SELECT RAISE(ABORT, 'BATCH_MEMBERSHIP_FROZEN');
END;

CREATE TRIGGER "BatchPosition_membership_delete_guard" BEFORE DELETE ON "BatchPosition"
WHEN EXISTS (SELECT 1 FROM "Batch" b WHERE b.id=OLD.batchId AND b.startedAt IS NOT NULL)
  OR EXISTS (SELECT 1 FROM "BatchAnalyte" a WHERE a.batchId=OLD.batchId AND a.legacyMembershipFrozen=1)
  OR EXISTS (SELECT 1 FROM "QcMeasurement" q WHERE q.batchId=OLD.batchId)
BEGIN
  SELECT RAISE(ABORT, 'BATCH_MEMBERSHIP_FROZEN');
END;

CREATE TRIGGER "BatchPosition_identity_guard" BEFORE UPDATE ON "BatchPosition"
WHEN NEW.id IS NOT OLD.id OR NEW.batchId IS NOT OLD.batchId OR NEW.historicalSnapshotSeq IS NOT OLD.historicalSnapshotSeq OR NEW.legacySource IS NOT OLD.legacySource
BEGIN
  SELECT RAISE(ABORT, 'BATCH_POSITION_INVALID');
END;

CREATE TRIGGER "BatchPositionWorkItem_insert_guard" BEFORE INSERT ON "BatchPositionWorkItem"
WHEN NOT EXISTS (SELECT 1 FROM "BatchPosition" p JOIN "WorkItem" w ON w.id=NEW.workItemId
  WHERE p.id=NEW.positionId AND p.kind='SAMPLE' AND p.sampleId=w.sampleId AND p.batchId=w.batchId AND NEW.analysisCode=w.analysis)
BEGIN
  SELECT RAISE(ABORT, 'BATCH_POSITION_WORK_ITEM_INVALID');
END;

CREATE TRIGGER "BatchPositionWorkItem_immutable" BEFORE UPDATE ON "BatchPositionWorkItem"
BEGIN
  SELECT RAISE(ABORT, 'BATCH_POSITION_WORK_ITEM_IMMUTABLE');
END;

CREATE TRIGGER "BatchPositionWorkItem_membership_insert_guard" BEFORE INSERT ON "BatchPositionWorkItem"
WHEN EXISTS (SELECT 1 FROM "Batch" b WHERE b.id=(SELECT p.batchId FROM "BatchPosition" p WHERE p.id=NEW.positionId) AND b.startedAt IS NOT NULL)
  OR EXISTS (SELECT 1 FROM "BatchAnalyte" a WHERE a.batchId=(SELECT p.batchId FROM "BatchPosition" p WHERE p.id=NEW.positionId) AND a.legacyMembershipFrozen=1)
  OR EXISTS (SELECT 1 FROM "QcMeasurement" q WHERE q.batchId=(SELECT p.batchId FROM "BatchPosition" p WHERE p.id=NEW.positionId))
BEGIN
  SELECT RAISE(ABORT, 'BATCH_MEMBERSHIP_FROZEN');
END;

CREATE TRIGGER "BatchPositionWorkItem_membership_delete_guard" BEFORE DELETE ON "BatchPositionWorkItem"
WHEN EXISTS (SELECT 1 FROM "Batch" b WHERE b.id=(SELECT p.batchId FROM "BatchPosition" p WHERE p.id=OLD.positionId) AND b.startedAt IS NOT NULL)
  OR EXISTS (SELECT 1 FROM "BatchAnalyte" a WHERE a.batchId=(SELECT p.batchId FROM "BatchPosition" p WHERE p.id=OLD.positionId) AND a.legacyMembershipFrozen=1)
  OR EXISTS (SELECT 1 FROM "QcMeasurement" q WHERE q.batchId=(SELECT p.batchId FROM "BatchPosition" p WHERE p.id=OLD.positionId))
BEGIN
  SELECT RAISE(ABORT, 'BATCH_MEMBERSHIP_FROZEN');
END;

CREATE TRIGGER "WorkItem_batch_membership_guard" BEFORE UPDATE ON "WorkItem"
WHEN (NEW.batchId IS NOT OLD.batchId OR NEW.rackPosition IS NOT OLD.rackPosition) AND ((EXISTS (SELECT 1 FROM "Batch" b WHERE b.id=OLD.batchId AND b.startedAt IS NOT NULL)
  OR EXISTS (SELECT 1 FROM "BatchAnalyte" a WHERE a.batchId=OLD.batchId AND a.legacyMembershipFrozen=1)
  OR EXISTS (SELECT 1 FROM "QcMeasurement" q WHERE q.batchId=OLD.batchId)) OR (EXISTS (SELECT 1 FROM "Batch" b WHERE b.id=NEW.batchId AND b.startedAt IS NOT NULL)
  OR EXISTS (SELECT 1 FROM "BatchAnalyte" a WHERE a.batchId=NEW.batchId AND a.legacyMembershipFrozen=1)
  OR EXISTS (SELECT 1 FROM "QcMeasurement" q WHERE q.batchId=NEW.batchId)))
BEGIN
  SELECT RAISE(ABORT, 'BATCH_MEMBERSHIP_FROZEN');
END;

CREATE TRIGGER "BatchPositionReference_insert_guard" BEFORE INSERT ON "BatchPositionReference"
WHEN NEW.serviceStatus NOT IN ('SERVED','NOT_SERVED') OR NEW.supersededById IS NOT NULL
  OR (NEW.serviceStatus='SERVED' AND (NEW.referenceSnapshot IS NULL OR NOT json_valid(NEW.referenceSnapshot)))
  OR (NEW.serviceStatus='NOT_SERVED' AND (NEW.referenceSnapshot IS NOT NULL OR NEW.referenceValueId IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM "BatchPositionReference" r WHERE r.supersededById=NEW.id)
    OR NOT EXISTS (SELECT 1 FROM "BatchPosition" p JOIN "BatchAnalyte" a ON a.batchId=p.batchId AND a.analysisCode=NEW.analysisCode
      JOIN "Batch" b ON b.id=p.batchId WHERE p.id=NEW.positionId AND a.provenance='NATIVE'
      AND ((b.startedAt IS NULL AND NEW.correctionReason='REBUILD_BEFORE_START')
        OR (json_type(a.criteriaSnapshot,'$.requiredPositions')='object' AND NOT EXISTS (
          SELECT 1 FROM json_each(json_extract(a.criteriaSnapshot,'$.requiredPositions.' || NEW.referenceUse)) r WHERE r.value=NEW.positionId))))))
  OR NOT EXISTS (SELECT 1 FROM "BatchPosition" p JOIN "BatchAnalyte" a ON a.batchId=p.batchId AND a.analysisCode=NEW.analysisCode
    JOIN "ReferenceMaterial" r ON r.id=NEW.referenceMaterialId JOIN "Lab" l ON l.id=r.labId
    WHERE p.id=NEW.positionId AND p.kind=NEW.referenceUse AND p.kind IN ('CRM','LRM','ICV','CCV','CCB') AND a.labId IN (l.id,l.code))
  OR (NEW.referenceUse='CCB' AND (NEW.referenceValueId IS NOT NULL OR NOT EXISTS (SELECT 1 FROM "ReferenceMaterial" r WHERE r.id=NEW.referenceMaterialId AND r.kind='BLANK_MATRIX')))
  OR (NEW.serviceStatus='NOT_SERVED' AND NOT EXISTS (SELECT 1 FROM "ReferenceMaterial" r WHERE r.id=NEW.referenceMaterialId
    AND ((NEW.referenceUse='CRM' AND r.kind='CRM') OR (NEW.referenceUse='LRM' AND r.kind IN ('CRM','LRM','CHECK_STANDARD'))
      OR (NEW.referenceUse='ICV' AND r.kind IN ('CHECK_STANDARD','CRM')) OR (NEW.referenceUse='CCV' AND r.kind IN ('CHECK_STANDARD','CALIBRATION_STANDARD','CRM')))))
  OR (NEW.serviceStatus='SERVED' AND NEW.referenceUse<>'CCB' AND NOT EXISTS (
    SELECT 1 FROM "ReferenceValue" v JOIN "ReferenceMaterial" r ON r.id=v.referenceMaterialId
    JOIN "BatchPosition" p ON p.id=NEW.positionId JOIN "BatchAnalyte" a ON a.batchId=p.batchId AND a.analysisCode=NEW.analysisCode
    WHERE v.id=NEW.referenceValueId AND v.referenceMaterialId=NEW.referenceMaterialId AND v.analysisCode=NEW.analysisCode
    AND (v.methodologyId IS NULL OR v.methodologyId=a.methodologyId)
    AND ((NEW.referenceUse='CRM' AND r.kind='CRM' AND v.valueType='CERTIFIED')
      OR (NEW.referenceUse='LRM' AND r.kind IN ('CRM','LRM','CHECK_STANDARD'))
      OR (NEW.referenceUse='ICV' AND r.kind IN ('CHECK_STANDARD','CRM'))
      OR (NEW.referenceUse='CCV' AND r.kind IN ('CHECK_STANDARD','CALIBRATION_STANDARD','CRM')))))
  OR (EXISTS (SELECT 1 FROM "BatchPosition" p JOIN "BatchAnalyte" a ON a.batchId=p.batchId AND a.analysisCode=NEW.analysisCode
    WHERE p.id=NEW.positionId AND a.provenance='NATIVE') AND (COALESCE(length(trim(NEW.boundBy)),0)=0 OR NEW.boundAt IS NULL))
BEGIN
  SELECT RAISE(ABORT, 'REFERENCE_USE_INCOMPATIBLE');
END;

CREATE TRIGGER "BatchPositionReference_correction_reason_guard" BEFORE INSERT ON "BatchPositionReference"
WHEN EXISTS (SELECT 1 FROM "BatchPositionReference" r WHERE r.supersededById=NEW.id) AND COALESCE(length(trim(NEW.correctionReason)),0)=0
BEGIN
  SELECT RAISE(ABORT, 'QC_CORRECTION_REASON_REQUIRED');
END;

CREATE TRIGGER "BatchPositionReference_lot_guard" BEFORE INSERT ON "BatchPositionReference"
WHEN EXISTS (SELECT 1 FROM "BatchPositionReference" r WHERE r.positionId=NEW.positionId AND r.supersededById IS NULL AND r.referenceMaterialId<>NEW.referenceMaterialId)
BEGIN
  SELECT RAISE(ABORT, 'REFERENCE_POSITION_LOT_CONFLICT');
END;

CREATE TRIGGER "BatchPositionReference_supersede_guard" BEFORE UPDATE ON "BatchPositionReference"
WHEN NEW."id" IS NOT OLD."id"
  OR NEW."positionId" IS NOT OLD."positionId"
  OR NEW."analysisCode" IS NOT OLD."analysisCode"
  OR NEW."referenceMaterialId" IS NOT OLD."referenceMaterialId"
  OR NEW."referenceValueId" IS NOT OLD."referenceValueId"
  OR NEW."referenceUse" IS NOT OLD."referenceUse"
  OR NEW."referenceSnapshot" IS NOT OLD."referenceSnapshot"
  OR NEW."serviceStatus" IS NOT OLD."serviceStatus"
  OR NEW."boundBy" IS NOT OLD."boundBy"
  OR NEW."boundAt" IS NOT OLD."boundAt"
  OR NEW."correctionReason" IS NOT OLD."correctionReason"
  OR OLD.supersededById IS NOT NULL OR NEW.supersededById IS NULL OR NEW.supersededById=NEW.id
BEGIN
  SELECT RAISE(ABORT, 'QC_REFERENCE_IMMUTABLE');
END;

CREATE TRIGGER "BatchPositionReference_delete_guard" BEFORE DELETE ON "BatchPositionReference"
BEGIN
  SELECT RAISE(ABORT, 'QC_REFERENCE_IMMUTABLE');
END;

CREATE TRIGGER "QcMeasurement_insert_guard" BEFORE INSERT ON "QcMeasurement"
WHEN typeof(NEW.replicateNo)<>'integer' OR NEW.replicateNo<1 OR NEW.supersededById IS NOT NULL
  OR NOT EXISTS (SELECT 1 FROM "BatchPosition" p JOIN "BatchAnalyte" a ON a.batchId=p.batchId AND a.analysisCode=NEW.analysisCode WHERE p.id=NEW.positionId AND p.batchId=NEW.batchId)
  OR EXISTS (SELECT 1 FROM "BatchPositionReference" r WHERE r.positionId=NEW.positionId AND r.analysisCode=NEW.analysisCode AND r.supersededById IS NULL AND r.serviceStatus='NOT_SERVED')
  OR EXISTS (SELECT 1 FROM "BatchPosition" p WHERE p.id=NEW.positionId AND p.provenance='NATIVE' AND p.kind IN ('SAMPLE','DUPLICATE') AND NEW.replicateNo<>1)
  OR EXISTS (SELECT 1 FROM "BatchPosition" p WHERE p.id=NEW.positionId AND p.provenance='NATIVE' AND p.kind IN ('SAMPLE','DUPLICATE')
    AND NOT EXISTS (SELECT 1 FROM "BatchPositionWorkItem" w WHERE w.analysisCode=NEW.analysisCode
      AND w.positionId=CASE WHEN p.kind='DUPLICATE' THEN p.duplicateOfPositionId ELSE p.id END))
  OR (EXISTS (SELECT 1 FROM "BatchAnalyte" a WHERE a.batchId=NEW.batchId AND a.analysisCode=NEW.analysisCode AND a.provenance='NATIVE')
    AND (COALESCE(length(trim(NEW.enteredBy)),0)=0 OR NEW.enteredAt IS NULL
      OR (NEW.value IS NULL AND NEW.censoring IS NULL) OR (NEW.value IS NOT NULL AND typeof(NEW.value) NOT IN ('integer','real'))
      OR (NEW.censoring IS NOT NULL AND NEW.censoring NOT IN ('<','<=','>','>='))))
  OR (EXISTS (SELECT 1 FROM "QcMeasurement" q WHERE q.supersededById=NEW.id)
    AND COALESCE(length(trim(NEW.correctionReason)),0)=0)
BEGIN
  SELECT RAISE(ABORT, 'QC_MEASUREMENT_INVALID');
END;

CREATE TRIGGER "QcMeasurement_start_guard" BEFORE INSERT ON "QcMeasurement"
WHEN EXISTS (SELECT 1 FROM "BatchAnalyte" a JOIN "Batch" b ON b.id=a.batchId WHERE a.batchId=NEW.batchId AND a.analysisCode=NEW.analysisCode AND a.provenance='NATIVE' AND b.startedAt IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'QC_RUN_NOT_STARTED');
END;

CREATE TRIGGER "QcMeasurement_supersede_guard" BEFORE UPDATE ON "QcMeasurement"
WHEN NEW."id" IS NOT OLD."id"
  OR NEW."batchId" IS NOT OLD."batchId"
  OR NEW."positionId" IS NOT OLD."positionId"
  OR NEW."analysisCode" IS NOT OLD."analysisCode"
  OR NEW."replicateNo" IS NOT OLD."replicateNo"
  OR NEW."value" IS NOT OLD."value"
  OR NEW."rawInput" IS NOT OLD."rawInput"
  OR NEW."censoring" IS NOT OLD."censoring"
  OR NEW."censoringLimit" IS NOT OLD."censoringLimit"
  OR NEW."enteredBy" IS NOT OLD."enteredBy"
  OR NEW."enteredAt" IS NOT OLD."enteredAt"
  OR NEW."correctionReason" IS NOT OLD."correctionReason"
  OR NEW."legacySource" IS NOT OLD."legacySource"
  OR OLD.supersededById IS NOT NULL OR NEW.supersededById IS NULL OR NEW.supersededById=NEW.id
BEGIN
  SELECT RAISE(ABORT, 'QC_MEASUREMENT_IMMUTABLE');
END;

CREATE TRIGGER "QcMeasurement_delete_guard" BEFORE DELETE ON "QcMeasurement"
BEGIN
  SELECT RAISE(ABORT, 'QC_MEASUREMENT_IMMUTABLE');
END;

CREATE TRIGGER "QcEvaluation_insert_guard" BEFORE INSERT ON "QcEvaluation"
WHEN NEW.verdict NOT IN ('PASS','WARN','FAIL','INCOMPLETE','NOT_REQUIRED') OR NOT json_valid(NEW.details)
  OR typeof(NEW.version)<>'integer' OR NEW.version<>(SELECT COALESCE(MAX(q.version),0)+1 FROM "QcEvaluation" q WHERE q.batchId=NEW.batchId AND q.analysisCode=NEW.analysisCode)
  OR NOT EXISTS (SELECT 1 FROM "BatchAnalyte" a WHERE a.batchId=NEW.batchId AND a.analysisCode=NEW.analysisCode)
  OR (NEW.version=1 AND NEW.supersedesId IS NOT NULL)
  OR (NEW.version>1 AND NOT EXISTS (SELECT 1 FROM "QcEvaluation" q WHERE q.id=NEW.supersedesId AND q.batchId=NEW.batchId AND q.analysisCode=NEW.analysisCode AND q.version=NEW.version-1))
BEGIN
  SELECT RAISE(ABORT, 'QC_EVALUATION_INVALID');
END;

CREATE TRIGGER "QcEvaluation_start_guard" BEFORE INSERT ON "QcEvaluation"
WHEN EXISTS (SELECT 1 FROM "BatchAnalyte" a JOIN "Batch" b ON b.id=a.batchId WHERE a.batchId=NEW.batchId AND a.analysisCode=NEW.analysisCode AND a.provenance='NATIVE' AND b.startedAt IS NULL)
BEGIN
  SELECT RAISE(ABORT, 'QC_RUN_NOT_STARTED');
END;

CREATE TRIGGER "QcEvaluation_frozen_criteria_guard" BEFORE INSERT ON "QcEvaluation"
WHEN EXISTS (SELECT 1 FROM "BatchAnalyte" a JOIN "Batch" b ON b.id=a.batchId WHERE a.batchId=NEW.batchId AND a.analysisCode=NEW.analysisCode AND a.provenance='NATIVE' AND b.startedAt IS NOT NULL
  AND (NEW.ruleId IS NOT a.qcRuleId OR NEW.ruleVersion IS NOT a.qcRuleVersion OR NEW.policyVersion IS NOT a.policyVersion
    OR json_extract(NEW.details,'$.criteriaSnapshot') IS NOT a.criteriaSnapshot
    OR COALESCE(length(trim(NEW.evaluatedBy)),0)=0 OR NEW.evaluatedAt IS NULL))
BEGIN
  SELECT RAISE(ABORT, 'QC_EVALUATION_CRITERIA_MISMATCH');
END;

CREATE TRIGGER "QcEvaluation_immutable_update" BEFORE UPDATE ON "QcEvaluation"
BEGIN
  SELECT RAISE(ABORT, 'QC_EVALUATION_IMMUTABLE');
END;

CREATE TRIGGER "QcEvaluation_immutable_delete" BEFORE DELETE ON "QcEvaluation"
BEGIN
  SELECT RAISE(ABORT, 'QC_EVALUATION_IMMUTABLE');
END;

CREATE TRIGGER "BatchDisposition_immutable_update" BEFORE UPDATE ON "BatchDisposition"
BEGIN
  SELECT RAISE(ABORT, 'BATCH_DISPOSITION_IMMUTABLE');
END;

CREATE TRIGGER "BatchDisposition_immutable_delete" BEFORE DELETE ON "BatchDisposition"
BEGIN
  SELECT RAISE(ABORT, 'BATCH_DISPOSITION_IMMUTABLE');
END;

CREATE TRIGGER "BatchEvent_immutable_update" BEFORE UPDATE ON "BatchEvent"
BEGIN
  SELECT RAISE(ABORT, 'BATCH_EVENT_IMMUTABLE');
END;

CREATE TRIGGER "BatchEvent_immutable_delete" BEFORE DELETE ON "BatchEvent"
BEGIN
  SELECT RAISE(ABORT, 'BATCH_EVENT_IMMUTABLE');
END;

CREATE TRIGGER "BatchDisposition_insert_guard" BEFORE INSERT ON "BatchDisposition"
WHEN NEW.decision NOT IN ('ACCEPT_WITH_DEVIATION','REPEAT_BATCH','REPEAT_BRACKET','REJECT') OR (NEW.legacySource IS NULL AND (COALESCE(length(trim(NEW.reason)),0)=0 OR COALESCE(length(trim(NEW.decidedBy)),0)=0 OR NEW.decidedAt IS NULL))
BEGIN
  SELECT RAISE(ABORT, 'BATCH_DISPOSITION_INVALID');
END;

CREATE TRIGGER "BatchEvent_insert_guard" BEFORE INSERT ON "BatchEvent"
WHEN NOT json_valid(NEW.payload) OR COALESCE(length(trim(NEW.type)),0)=0
BEGIN
  SELECT RAISE(ABORT, 'BATCH_EVENT_INVALID');
END;
