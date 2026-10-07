DROP TRIGGER "WorkItem_batch_membership_guard";

CREATE TRIGGER "WorkItem_batch_membership_guard" BEFORE UPDATE ON "WorkItem"
WHEN (NEW.batchId IS NOT OLD.batchId OR NEW.rackPosition IS NOT OLD.rackPosition) AND (((EXISTS (SELECT 1 FROM "Batch" b WHERE b.id=OLD.batchId AND b.startedAt IS NOT NULL)
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
  OR EXISTS (SELECT 1 FROM "QcMeasurement" q WHERE q.batchId=NEW.batchId)))
BEGIN
  SELECT RAISE(ABORT, 'BATCH_MEMBERSHIP_FROZEN');
END;
