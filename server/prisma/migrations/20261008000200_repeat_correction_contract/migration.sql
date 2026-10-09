-- #191 pins6067488471 /6067875897 /6068463777. No data backfill.
-- Historical attempts and the #190 source/receipt are never rewritten.
ALTER TABLE "WorkAttempt" ADD COLUMN "parentAttemptId" TEXT;
ALTER TABLE "WorkAttempt" ADD COLUMN "note" TEXT;

-- INSTALLER_GUARDS_AFTER_SCHEMA
-- Replace exactly two #190 guards with receipt-verified successor definitions.
DROP TRIGGER "WorkAttempt_evidence_update";
DROP TRIGGER "WorkAttempt_identity_update";

CREATE TRIGGER "WorkAttempt_evidence_update" BEFORE UPDATE ON "WorkAttempt"
WHEN (NEW."evidenceData" IS NOT OLD."evidenceData" OR NEW."evidenceHash" IS NOT OLD."evidenceHash" OR NEW."instrumentId" IS NOT OLD."instrumentId") AND NOT (OLD."status" = 'OPEN'
 AND OLD."evidenceHash" IS NULL
 AND NEW."status" = 'RECORDED'
 AND NEW."evidenceHash" IS NOT NULL
 AND NEW."evidenceData" IS NOT NULL
 AND (NEW."evidenceData" IS OLD."evidenceData" OR OLD."evidenceData" IS NULL)
 AND (NEW."evidenceHash" IS OLD."evidenceHash" OR OLD."evidenceHash" IS NULL)
 AND (NEW."instrumentId" IS OLD."instrumentId" OR OLD."instrumentId" IS NULL)
 AND (NEW."executedMethodRevision" IS OLD."executedMethodRevision" OR OLD."executedMethodRevision" IS NULL)
 AND (NEW."author" IS OLD."author" OR OLD."author" IS NULL)
 AND (NEW."authorName" IS OLD."authorName" OR OLD."authorName" IS NULL)
 AND (NEW."qcBatchId" IS OLD."qcBatchId" OR OLD."qcBatchId" IS NULL)
 AND (NEW."materialAliquot" IS OLD."materialAliquot" OR OLD."materialAliquot" IS NULL)
 AND NEW."id" IS OLD."id"
 AND NEW."workItemId" IS OLD."workItemId"
 AND NEW."orderLineId" IS OLD."orderLineId"
 AND NEW."attemptNo" IS OLD."attemptNo"
 AND NEW."batchId" IS OLD."batchId"
 AND NEW."reason" IS OLD."reason"
 AND NEW."requestedBy" IS OLD."requestedBy"
 AND NEW."requestedAt" IS OLD."requestedAt"
 AND NEW."parentAttemptId" IS OLD."parentAttemptId"
 AND NEW."note" IS OLD."note"
 AND NEW."rawData" IS OLD."rawData"
 AND NEW."calcVersion" IS OLD."calcVersion"
 AND NEW."dilutionFactor" IS OLD."dilutionFactor"
 AND NEW."aliquotId" IS OLD."aliquotId"
 AND NEW."legacyAttemptNoConflict" IS OLD."legacyAttemptNoConflict"
 AND NEW."version" IS OLD."version"
 AND NEW."createdAt" IS OLD."createdAt"
 AND NEW."updatedAt" IS OLD."updatedAt")
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_EVIDENCE_IMMUTABLE');
END;

CREATE TRIGGER "WorkAttempt_identity_update" BEFORE UPDATE ON "WorkAttempt"
WHEN (NEW."id" IS NOT OLD."id" OR NEW."workItemId" IS NOT OLD."workItemId" OR NEW."orderLineId" IS NOT OLD."orderLineId"
 OR NEW."attemptNo" IS NOT OLD."attemptNo" OR NEW."executedMethodRevision" IS NOT OLD."executedMethodRevision"
 OR NEW."author" IS NOT OLD."author" OR NEW."authorName" IS NOT OLD."authorName" OR NEW."materialAliquot" IS NOT OLD."materialAliquot"
 OR NEW."qcBatchId" IS NOT OLD."qcBatchId" OR NEW."version" IS NOT OLD."version"
 OR NEW."createdAt" IS NOT OLD."createdAt" OR NEW."updatedAt" IS NOT OLD."updatedAt"
 OR NEW."reason" IS NOT OLD."reason" OR NEW."requestedBy" IS NOT OLD."requestedBy" OR NEW."requestedAt" IS NOT OLD."requestedAt"
 OR NEW."rawData" IS NOT OLD."rawData" OR NEW."calcVersion" IS NOT OLD."calcVersion"
 OR NEW."dilutionFactor" IS NOT OLD."dilutionFactor" OR NEW."aliquotId" IS NOT OLD."aliquotId") AND NOT (OLD."status" = 'OPEN'
 AND OLD."evidenceHash" IS NULL
 AND NEW."status" = 'RECORDED'
 AND NEW."evidenceHash" IS NOT NULL
 AND NEW."evidenceData" IS NOT NULL
 AND (NEW."evidenceData" IS OLD."evidenceData" OR OLD."evidenceData" IS NULL)
 AND (NEW."evidenceHash" IS OLD."evidenceHash" OR OLD."evidenceHash" IS NULL)
 AND (NEW."instrumentId" IS OLD."instrumentId" OR OLD."instrumentId" IS NULL)
 AND (NEW."executedMethodRevision" IS OLD."executedMethodRevision" OR OLD."executedMethodRevision" IS NULL)
 AND (NEW."author" IS OLD."author" OR OLD."author" IS NULL)
 AND (NEW."authorName" IS OLD."authorName" OR OLD."authorName" IS NULL)
 AND (NEW."qcBatchId" IS OLD."qcBatchId" OR OLD."qcBatchId" IS NULL)
 AND (NEW."materialAliquot" IS OLD."materialAliquot" OR OLD."materialAliquot" IS NULL)
 AND NEW."id" IS OLD."id"
 AND NEW."workItemId" IS OLD."workItemId"
 AND NEW."orderLineId" IS OLD."orderLineId"
 AND NEW."attemptNo" IS OLD."attemptNo"
 AND NEW."batchId" IS OLD."batchId"
 AND NEW."reason" IS OLD."reason"
 AND NEW."requestedBy" IS OLD."requestedBy"
 AND NEW."requestedAt" IS OLD."requestedAt"
 AND NEW."parentAttemptId" IS OLD."parentAttemptId"
 AND NEW."note" IS OLD."note"
 AND NEW."rawData" IS OLD."rawData"
 AND NEW."calcVersion" IS OLD."calcVersion"
 AND NEW."dilutionFactor" IS OLD."dilutionFactor"
 AND NEW."aliquotId" IS OLD."aliquotId"
 AND NEW."legacyAttemptNoConflict" IS OLD."legacyAttemptNoConflict"
 AND NEW."version" IS OLD."version"
 AND NEW."createdAt" IS OLD."createdAt"
 AND NEW."updatedAt" IS OLD."updatedAt")
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_IDENTITY_IMMUTABLE');
END;

CREATE TRIGGER "WorkAttempt_request_facts_update" BEFORE UPDATE ON "WorkAttempt"
WHEN NEW."parentAttemptId" IS NOT OLD."parentAttemptId" OR NEW."note" IS NOT OLD."note"
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_REQUEST_IMMUTABLE');
END;

CREATE TRIGGER "WorkAttempt_repeat_reason_insert" BEFORE INSERT ON "WorkAttempt"
WHEN NEW."attemptNo" > 1 AND NEW."reason" IS NULL
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_REASON_REQUIRED');
END;

CREATE TRIGGER "WorkAttempt_parent_insert" BEFORE INSERT ON "WorkAttempt"
WHEN NEW."parentAttemptId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "WorkAttempt" parent
    WHERE parent."id" = NEW."parentAttemptId" AND parent."workItemId" = NEW."workItemId" AND parent."attemptNo" < NEW."attemptNo")
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_PARENT_INVALID');
END;

-- The complete column contract makes newly added, unreviewed columns frozen by
-- default: a later migration must deliberately provide its successor guard.
CREATE TRIGGER "WorkAttempt_column_contract_insert" BEFORE INSERT ON "WorkAttempt"
WHEN EXISTS (SELECT 1 FROM pragma_table_xinfo('WorkAttempt') WHERE "name" NOT IN ('id','workItemId','orderLineId','attemptNo','executedMethodRevision','author','authorName','materialAliquot','instrumentId','qcBatchId','batchId','reason','requestedBy','requestedAt','parentAttemptId','note','rawData','calcVersion','dilutionFactor','aliquotId','legacyAttemptNoConflict','version','status','evidenceHash','evidenceData','createdAt','updatedAt'))
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_COLUMN_CONTRACT_MISMATCH');
END;

CREATE TRIGGER "WorkAttempt_column_contract_update" BEFORE UPDATE ON "WorkAttempt"
WHEN EXISTS (SELECT 1 FROM pragma_table_xinfo('WorkAttempt') WHERE "name" NOT IN ('id','workItemId','orderLineId','attemptNo','executedMethodRevision','author','authorName','materialAliquot','instrumentId','qcBatchId','batchId','reason','requestedBy','requestedAt','parentAttemptId','note','rawData','calcVersion','dilutionFactor','aliquotId','legacyAttemptNoConflict','version','status','evidenceHash','evidenceData','createdAt','updatedAt'))
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_COLUMN_CONTRACT_MISMATCH');
END;

CREATE TRIGGER "WorkAttempt_first_fill_update" BEFORE UPDATE ON "WorkAttempt"
WHEN OLD."status" = 'OPEN' AND NEW."status" = 'RECORDED' AND NOT (OLD."status" = 'OPEN'
 AND OLD."evidenceHash" IS NULL
 AND NEW."status" = 'RECORDED'
 AND NEW."evidenceHash" IS NOT NULL
 AND NEW."evidenceData" IS NOT NULL
 AND (NEW."evidenceData" IS OLD."evidenceData" OR OLD."evidenceData" IS NULL)
 AND (NEW."evidenceHash" IS OLD."evidenceHash" OR OLD."evidenceHash" IS NULL)
 AND (NEW."instrumentId" IS OLD."instrumentId" OR OLD."instrumentId" IS NULL)
 AND (NEW."executedMethodRevision" IS OLD."executedMethodRevision" OR OLD."executedMethodRevision" IS NULL)
 AND (NEW."author" IS OLD."author" OR OLD."author" IS NULL)
 AND (NEW."authorName" IS OLD."authorName" OR OLD."authorName" IS NULL)
 AND (NEW."qcBatchId" IS OLD."qcBatchId" OR OLD."qcBatchId" IS NULL)
 AND (NEW."materialAliquot" IS OLD."materialAliquot" OR OLD."materialAliquot" IS NULL)
 AND NEW."id" IS OLD."id"
 AND NEW."workItemId" IS OLD."workItemId"
 AND NEW."orderLineId" IS OLD."orderLineId"
 AND NEW."attemptNo" IS OLD."attemptNo"
 AND NEW."batchId" IS OLD."batchId"
 AND NEW."reason" IS OLD."reason"
 AND NEW."requestedBy" IS OLD."requestedBy"
 AND NEW."requestedAt" IS OLD."requestedAt"
 AND NEW."parentAttemptId" IS OLD."parentAttemptId"
 AND NEW."note" IS OLD."note"
 AND NEW."rawData" IS OLD."rawData"
 AND NEW."calcVersion" IS OLD."calcVersion"
 AND NEW."dilutionFactor" IS OLD."dilutionFactor"
 AND NEW."aliquotId" IS OLD."aliquotId"
 AND NEW."legacyAttemptNoConflict" IS OLD."legacyAttemptNoConflict"
 AND NEW."version" IS OLD."version"
 AND NEW."createdAt" IS OLD."createdAt"
 AND NEW."updatedAt" IS OLD."updatedAt")
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_FIRST_FILL_REFUSED');
END;

CREATE TRIGGER "WorkAttempt_status_transition_update" BEFORE UPDATE OF "status" ON "WorkAttempt"
WHEN NEW."status" IS NOT OLD."status" AND NEW."status" IN ('OPEN','RECORDED','SUBMITTED','ACCEPTED','QUESTIONED','INVALIDATED','SUPERSEDED')
 AND NOT ((OLD."status" = 'OPEN' AND NEW."status" = 'RECORDED' AND (OLD."status" = 'OPEN'
 AND OLD."evidenceHash" IS NULL
 AND NEW."status" = 'RECORDED'
 AND NEW."evidenceHash" IS NOT NULL
 AND NEW."evidenceData" IS NOT NULL
 AND (NEW."evidenceData" IS OLD."evidenceData" OR OLD."evidenceData" IS NULL)
 AND (NEW."evidenceHash" IS OLD."evidenceHash" OR OLD."evidenceHash" IS NULL)
 AND (NEW."instrumentId" IS OLD."instrumentId" OR OLD."instrumentId" IS NULL)
 AND (NEW."executedMethodRevision" IS OLD."executedMethodRevision" OR OLD."executedMethodRevision" IS NULL)
 AND (NEW."author" IS OLD."author" OR OLD."author" IS NULL)
 AND (NEW."authorName" IS OLD."authorName" OR OLD."authorName" IS NULL)
 AND (NEW."qcBatchId" IS OLD."qcBatchId" OR OLD."qcBatchId" IS NULL)
 AND (NEW."materialAliquot" IS OLD."materialAliquot" OR OLD."materialAliquot" IS NULL)
 AND NEW."id" IS OLD."id"
 AND NEW."workItemId" IS OLD."workItemId"
 AND NEW."orderLineId" IS OLD."orderLineId"
 AND NEW."attemptNo" IS OLD."attemptNo"
 AND NEW."batchId" IS OLD."batchId"
 AND NEW."reason" IS OLD."reason"
 AND NEW."requestedBy" IS OLD."requestedBy"
 AND NEW."requestedAt" IS OLD."requestedAt"
 AND NEW."parentAttemptId" IS OLD."parentAttemptId"
 AND NEW."note" IS OLD."note"
 AND NEW."rawData" IS OLD."rawData"
 AND NEW."calcVersion" IS OLD."calcVersion"
 AND NEW."dilutionFactor" IS OLD."dilutionFactor"
 AND NEW."aliquotId" IS OLD."aliquotId"
 AND NEW."legacyAttemptNoConflict" IS OLD."legacyAttemptNoConflict"
 AND NEW."version" IS OLD."version"
 AND NEW."createdAt" IS OLD."createdAt"
 AND NEW."updatedAt" IS OLD."updatedAt"))
    OR (OLD."status" = 'RECORDED' AND NEW."status" IN ('SUBMITTED','QUESTIONED','INVALIDATED'))
    OR (OLD."status" = 'SUBMITTED' AND NEW."status" IN ('ACCEPTED','QUESTIONED','INVALIDATED')))
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_TRANSITION_REFUSED');
END;

CREATE TRIGGER "AuditLog_attempt_event_update" BEFORE UPDATE ON "AuditLog"
WHEN OLD."entity" = 'WORK_ATTEMPT' OR NEW."entity" = 'WORK_ATTEMPT'
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_EVENT_IMMUTABLE');
END;

CREATE TRIGGER "AuditLog_attempt_event_delete" BEFORE DELETE ON "AuditLog"
WHEN OLD."entity" = 'WORK_ATTEMPT'
BEGIN
    SELECT RAISE(ABORT, 'WORK_ATTEMPT_EVENT_IMMUTABLE');
END;

-- #191 pin6069548259: only an accepted-QC, reasoned attempt handoff.
DROP TRIGGER "WorkItem_batch_membership_guard";

CREATE TRIGGER "WorkItem_batch_membership_guard" BEFORE UPDATE ON "WorkItem"
WHEN ((NEW.batchId IS NOT OLD.batchId OR NEW.rackPosition IS NOT OLD.rackPosition) AND (((EXISTS (SELECT 1 FROM "Batch" b WHERE b.id=OLD.batchId AND b.startedAt IS NOT NULL)
  OR EXISTS (SELECT 1 FROM "BatchAnalyte" a WHERE a.batchId=OLD.batchId AND a.legacyMembershipFrozen=1)
  OR EXISTS (SELECT 1 FROM "QcMeasurement" q WHERE q.batchId=OLD.batchId)) AND NOT (
    NEW.batchId IS NOT OLD.batchId AND OLD.status NOT IN ('SUBMITTED','ACCEPTED','WAIVED','CANCELLED')
    AND EXISTS (SELECT 1 FROM "BatchPositionWorkItem" m JOIN "BatchPosition" p ON p.id=m.positionId
      JOIN "BatchAnalyte" a ON a.batchId=p.batchId AND (a.analysisCode=m.analysisCode
        OR (json_valid(p.legacySource) AND json_extract(p.legacySource,'$.textureAlias')=1 AND a.analysisCode=json_extract(p.legacySource,'$.batchAnalysis')))
      WHERE m.workItemId=OLD.id AND p.batchId=OLD.batchId AND (a.status IN ('REPEAT_ORDERED','REJECTED')
        OR (a.provenance='NATIVE' AND a.status='ACCEPTED_WITH_DEVIATION' AND OLD.status='REPEAT_REQUIRED'
          AND EXISTS (SELECT 1 FROM "BatchDisposition" d WHERE d.batchId=a.batchId AND d.analysisCode=a.analysisCode
            AND d.decision='REPEAT_BRACKET' AND d.scope IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM "BatchDisposition" later WHERE later.batchId=d.batchId AND later.analysisCode=d.analysisCode
              AND (later.decidedAt>d.decidedAt OR (later.decidedAt=d.decidedAt AND later.id>d.id)))
            AND EXISTS (SELECT 1 FROM json_each(d.scope,'$.affectedWorkItemIds') affected WHERE affected.value=OLD.id)
            AND NOT EXISTS (SELECT 1 FROM json_each(d.scope,'$.sealedAffectedWorkItemIds') sealed WHERE sealed.value=OLD.id)))))
    AND (NEW.batchId IS NULL OR EXISTS (SELECT 1 FROM "Batch" target WHERE target.id=NEW.batchId AND target.status='OPEN'
      AND target.startedAt IS NULL AND NOT EXISTS (SELECT 1 FROM "BatchAnalyte" a WHERE a.batchId=target.id AND a.legacyMembershipFrozen=1)
      AND NOT EXISTS (SELECT 1 FROM "QcMeasurement" q WHERE q.batchId=target.id)))
  )) OR (EXISTS (SELECT 1 FROM "Batch" b WHERE b.id=NEW.batchId AND b.startedAt IS NOT NULL)
  OR EXISTS (SELECT 1 FROM "BatchAnalyte" a WHERE a.batchId=NEW.batchId AND a.legacyMembershipFrozen=1)
  OR EXISTS (SELECT 1 FROM "QcMeasurement" q WHERE q.batchId=NEW.batchId)))) AND NOT (NEW.batchId IS NULL AND NEW.rackPosition IS NULL AND OLD.batchId IS NOT NULL
 AND NEW.status = 'REPEAT_REQUIRED' AND OLD.status NOT IN ('REPEAT_REQUIRED','ACCEPTED','WAIVED','CANCELLED')
 AND EXISTS (
    SELECT 1 FROM "WorkAttempt" child JOIN "WorkAttempt" parent ON parent.id=child.parentAttemptId
    JOIN "AuditLog" event ON event.entity='WORK_ATTEMPT' AND event.entityId=child.id AND event.action='CREATED'
    WHERE child.workItemId=OLD.id AND parent.workItemId=OLD.id AND child.attemptNo>parent.attemptNo
      AND child.status='OPEN' AND parent.status IN ('QUESTIONED','INVALIDATED')
      AND parent.evidenceHash IS NOT NULL AND parent.batchId IS OLD.batchId AND parent.qcBatchId IS OLD.batchId
      AND child.reason IN ('QC_BATCH_FAIL','REVIEW_OUTLIER','DUPLICATE_DISAGREEMENT','ABOVE_RANGE_DILUTION','INSTRUMENT_FAULT','PREP_ERROR','CONFIRMATION','OTHER')
      AND child.requestedBy IS NOT NULL AND child.requestedAt IS NOT NULL AND event.performedBy=child.requestedBy
      AND (child.reason<>'OTHER' OR COALESCE(length(trim(child.note)),0)>0)
      AND json_valid(event.details) AND json_extract(event.details,'$.from') IS NULL
      AND json_extract(event.details,'$.to')='OPEN' AND json_extract(event.details,'$.reason')=child.reason
      AND json_extract(event.details,'$.note') IS child.note
 )
 AND EXISTS (
    SELECT 1 FROM "BatchPositionWorkItem" membership JOIN "BatchPosition" position ON position.id=membership.positionId
    JOIN "BatchAnalyte" analyte ON analyte.batchId=position.batchId AND (analyte.analysisCode=membership.analysisCode
      OR (json_valid(position.legacySource) AND json_extract(position.legacySource,'$.textureAlias')=1
        AND analyte.analysisCode=json_extract(position.legacySource,'$.batchAnalysis')))
    WHERE membership.workItemId=OLD.id AND position.batchId=OLD.batchId
      AND (analyte.analysisCode=OLD.analysis OR (json_valid(position.legacySource)
        AND json_extract(position.legacySource,'$.textureAlias')=1
        AND OLD.analysis IN ('TEXTURE','SOIL_PSD_TEXTURE','SOIL_TEXTURE','PSA','pSA','Particle Size Analysis')
        AND analyte.analysisCode=json_extract(position.legacySource,'$.batchAnalysis')))
      AND analyte.status IN ('QC_PASS','QC_WARN','ACCEPTED_WITH_DEVIATION')
 )
 AND NOT EXISTS (
    SELECT 1 FROM "BatchPositionWorkItem" membership JOIN "BatchPosition" position ON position.id=membership.positionId
    LEFT JOIN "BatchAnalyte" analyte ON analyte.batchId=position.batchId
      AND (analyte.analysisCode=membership.analysisCode OR (json_valid(position.legacySource)
        AND json_extract(position.legacySource,'$.textureAlias')=1
        AND analyte.analysisCode=json_extract(position.legacySource,'$.batchAnalysis')))
      AND (analyte.analysisCode=OLD.analysis OR (json_valid(position.legacySource)
        AND json_extract(position.legacySource,'$.textureAlias')=1
        AND OLD.analysis IN ('TEXTURE','SOIL_PSD_TEXTURE','SOIL_TEXTURE','PSA','pSA','Particle Size Analysis')
        AND analyte.analysisCode=json_extract(position.legacySource,'$.batchAnalysis')))
    WHERE membership.workItemId=OLD.id AND position.batchId=OLD.batchId
      AND (analyte.analysisCode IS NULL OR analyte.status NOT IN ('QC_PASS','QC_WARN','ACCEPTED_WITH_DEVIATION'))
 ))
BEGIN
  SELECT RAISE(ABORT, 'BATCH_MEMBERSHIP_FROZEN');
END;
