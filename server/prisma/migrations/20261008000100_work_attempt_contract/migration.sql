-- #190 additive metadata. The reviewed installer backfills inside its
-- transaction between this DDL and the guards/indexes below. It never edits
-- original attempt fields or already-linked Result evidence.
ALTER TABLE "WorkAttempt" ADD COLUMN "batchId" TEXT REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkAttempt" ADD COLUMN "reason" TEXT;
ALTER TABLE "WorkAttempt" ADD COLUMN "requestedBy" TEXT;
ALTER TABLE "WorkAttempt" ADD COLUMN "requestedAt" DATETIME;
ALTER TABLE "WorkAttempt" ADD COLUMN "rawData" TEXT;
ALTER TABLE "WorkAttempt" ADD COLUMN "calcVersion" TEXT;
ALTER TABLE "WorkAttempt" ADD COLUMN "dilutionFactor" REAL;
ALTER TABLE "WorkAttempt" ADD COLUMN "aliquotId" TEXT;
ALTER TABLE "WorkAttempt" ADD COLUMN "legacyAttemptNoConflict" TEXT;
ALTER TABLE "ReviewDecision" ADD COLUMN "reasonCode" TEXT;

CREATE INDEX "WorkAttempt_workItemId_attemptNo_idx" ON "WorkAttempt"("workItemId", "attemptNo");
CREATE INDEX "WorkAttempt_batchId_idx" ON "WorkAttempt"("batchId");

-- INSTALLER_GUARDS_AFTER_BACKFILL
CREATE TRIGGER "ReviewDecision_attempt_insert_guard" BEFORE INSERT ON "ReviewDecision"
BEGIN
    SELECT CASE
        WHEN NEW."attemptId" IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM "WorkAttempt" a JOIN "WorkItem" w ON w."id" = a."workItemId"
            WHERE a."id" = NEW."attemptId" AND a."workItemId" = NEW."workItemId" AND w."sampleId" = NEW."sampleId"
            AND EXISTS (SELECT 1 FROM "Result" r WHERE r."attemptId" = a."id" AND r."isCurrent" = 1))
        THEN RAISE(ABORT, 'REVIEW_ATTEMPT_INVALID')
        WHEN NEW."attemptId" IS NULL AND EXISTS (
            SELECT 1 FROM "WorkItem" w WHERE w."id" = NEW."workItemId"
            AND w."analysis" NOT IN ('ARCH','ARCHIVING','Archive','DISP','DISPOSAL','DRYING','Dispose','HOMOGENIZATION','MILLING','PREP','PREPARATION','SAMPLE_PREP','SIEVING','SPEC_FTIR','SPEC_MIR','SPEC_NIR','SPEC_VIS_NIR'))
            AND NOT (NEW."decision" = 'OMIT' AND NOT EXISTS (SELECT 1 FROM "WorkAttempt" a WHERE a."workItemId" = NEW."workItemId"))
        THEN RAISE(ABORT, 'REVIEW_ATTEMPT_REQUIRED')
    END;
END;

CREATE TRIGGER "ReviewDecision_attempt_immutable" BEFORE UPDATE OF "attemptId" ON "ReviewDecision"
WHEN NEW."attemptId" IS NOT OLD."attemptId"
BEGIN
    SELECT RAISE(ABORT, 'REVIEW_DECISION_IMMUTABLE');
END;

CREATE TRIGGER "Result_attempt_required_insert" BEFORE INSERT ON "Result"
WHEN NEW."attemptId" IS NULL AND NOT COALESCE((NEW."provenance" = 'IMPORTED' AND NOT EXISTS (SELECT 1 FROM "WorkItem" w WHERE w."sampleId" = NEW."sampleId" AND w."analysis" = NEW."param" AND w."duplicateOf" IS NULL)), 0)
BEGIN
    SELECT RAISE(ABORT, 'RESULT_ATTEMPT_REQUIRED');
END;

CREATE TRIGGER "Result_attempt_link_immutable" BEFORE UPDATE OF "attemptId" ON "Result"
WHEN OLD."attemptId" IS NOT NULL AND NEW."attemptId" IS NOT OLD."attemptId"
 AND (NEW."attemptId" IS NULL OR EXISTS (
    SELECT 1 FROM "WorkAttempt" a JOIN "WorkItem" w ON w."id" = a."workItemId"
    WHERE a."id" = NEW."attemptId" AND w."sampleId" = NEW."sampleId"))
BEGIN
    SELECT RAISE(ABORT, 'RESULT_ATTEMPT_IMMUTABLE');
END;

CREATE TRIGGER "WorkAttempt_reason_insert" BEFORE INSERT ON "WorkAttempt"
WHEN NEW."reason" IS NOT NULL AND NEW."reason" NOT IN ('QC_BATCH_FAIL','REVIEW_OUTLIER','DUPLICATE_DISAGREEMENT','ABOVE_RANGE_DILUTION','INSTRUMENT_FAULT','PREP_ERROR','TRANSCRIPTION_ERROR','CLIENT_RETEST','CONFIRMATION','OTHER')
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_REASON_INVALID');
END;

CREATE TRIGGER "WorkAttempt_reason_update" BEFORE UPDATE OF "reason" ON "WorkAttempt"
WHEN NEW."reason" IS NOT NULL AND NEW."reason" NOT IN ('QC_BATCH_FAIL','REVIEW_OUTLIER','DUPLICATE_DISAGREEMENT','ABOVE_RANGE_DILUTION','INSTRUMENT_FAULT','PREP_ERROR','TRANSCRIPTION_ERROR','CLIENT_RETEST','CONFIRMATION','OTHER')
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_REASON_INVALID');
END;

CREATE UNIQUE INDEX "WorkAttempt_workItemId_attemptNo_unique" ON "WorkAttempt"("workItemId", "attemptNo") WHERE "legacyAttemptNoConflict" IS NULL;
CREATE UNIQUE INDEX "result_one_current" ON "Result"("sampleId", "param", "replicateNo", "attemptId") WHERE "isCurrent" = 1;

CREATE TRIGGER "WorkAttempt_status_insert" BEFORE INSERT ON "WorkAttempt"
WHEN NEW."status" IS NULL OR NEW."status" NOT IN ('OPEN','RECORDED','SUBMITTED','ACCEPTED','QUESTIONED','INVALIDATED','SUPERSEDED')
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_STATUS_INVALID');
END;

CREATE TRIGGER "WorkAttempt_status_update" BEFORE UPDATE OF "status" ON "WorkAttempt"
WHEN NEW."status" IS NULL OR NEW."status" NOT IN ('OPEN','RECORDED','SUBMITTED','ACCEPTED','QUESTIONED','INVALIDATED','SUPERSEDED')
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_STATUS_INVALID');
END;

CREATE TRIGGER "WorkAttempt_conflict_flag_insert" BEFORE INSERT ON "WorkAttempt"
WHEN NEW."legacyAttemptNoConflict" IS NOT NULL
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_CONFLICT_FLAG_FORBIDDEN');
END;

CREATE TRIGGER "WorkAttempt_conflict_flag_update" BEFORE UPDATE OF "legacyAttemptNoConflict" ON "WorkAttempt"
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_CONFLICT_FLAG_IMMUTABLE');
END;

CREATE TRIGGER "WorkAttempt_evidence_update" BEFORE UPDATE ON "WorkAttempt"
WHEN NEW."evidenceData" IS NOT OLD."evidenceData" OR NEW."evidenceHash" IS NOT OLD."evidenceHash" OR NEW."instrumentId" IS NOT OLD."instrumentId"
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_EVIDENCE_IMMUTABLE');
END;

CREATE TRIGGER "WorkAttempt_identity_update" BEFORE UPDATE ON "WorkAttempt"
WHEN NEW."id" IS NOT OLD."id" OR NEW."workItemId" IS NOT OLD."workItemId" OR NEW."orderLineId" IS NOT OLD."orderLineId"
 OR NEW."attemptNo" IS NOT OLD."attemptNo" OR NEW."executedMethodRevision" IS NOT OLD."executedMethodRevision"
 OR NEW."author" IS NOT OLD."author" OR NEW."authorName" IS NOT OLD."authorName" OR NEW."materialAliquot" IS NOT OLD."materialAliquot"
 OR NEW."qcBatchId" IS NOT OLD."qcBatchId" OR NEW."version" IS NOT OLD."version"
 OR NEW."createdAt" IS NOT OLD."createdAt" OR NEW."updatedAt" IS NOT OLD."updatedAt"
 OR NEW."reason" IS NOT OLD."reason" OR NEW."requestedBy" IS NOT OLD."requestedBy" OR NEW."requestedAt" IS NOT OLD."requestedAt"
 OR NEW."rawData" IS NOT OLD."rawData" OR NEW."calcVersion" IS NOT OLD."calcVersion"
 OR NEW."dilutionFactor" IS NOT OLD."dilutionFactor" OR NEW."aliquotId" IS NOT OLD."aliquotId"
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_IDENTITY_IMMUTABLE');
END;

CREATE TRIGGER "WorkAttempt_batchId_update" BEFORE UPDATE OF "batchId" ON "WorkAttempt"
WHEN OLD."batchId" IS NOT NULL AND NEW."batchId" IS NOT OLD."batchId"
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_BATCH_IMMUTABLE');
END;

CREATE TRIGGER "WorkAttempt_number_insert" BEFORE INSERT ON "WorkAttempt"
WHEN typeof(NEW."attemptNo") IS NOT 'integer' OR NEW."attemptNo" < 1
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_NUMBER_INVALID');
END;

CREATE TRIGGER "WorkAttempt_delete" BEFORE DELETE ON "WorkAttempt"
WHEN NOT EXISTS (SELECT 1 FROM "Result" r WHERE r."attemptId" = OLD."id")
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_DELETE_REFUSED');
END;
