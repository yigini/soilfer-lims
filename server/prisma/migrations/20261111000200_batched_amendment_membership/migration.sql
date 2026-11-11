-- Add the authorised amendment handoff for accepted batched work.
DROP TRIGGER "WorkItem_batch_membership_guard";

CREATE TRIGGER "WorkItem_batch_membership_guard" BEFORE UPDATE ON "WorkItem"
WHEN (((NEW.batchId IS NOT OLD.batchId OR NEW.rackPosition IS NOT OLD.rackPosition) AND (((EXISTS (SELECT 1 FROM "Batch" b WHERE b.id=OLD.batchId AND b.startedAt IS NOT NULL)
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
  OR EXISTS (SELECT 1 FROM "QcMeasurement" q WHERE q.batchId=NEW.batchId))))
 OR (NEW.batchId IS NULL AND OLD.batchId IS NOT NULL AND NEW.status='REPEAT_REQUIRED'
   AND NOT (
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
  ))) AND NOT (NEW.batchId IS NULL AND NEW.rackPosition IS NULL AND OLD.batchId IS NOT NULL
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
 AND NOT (NEW.batchId IS NULL AND NEW.rackPosition IS NULL AND OLD.batchId IS NOT NULL
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
      AND analyte.status='CLOSED' AND EXISTS (
        WITH final_evaluation AS (
          SELECT e.* FROM "QcEvaluation" e
          WHERE e.batchId=analyte.batchId AND e.analysisCode=analyte.analysisCode
          ORDER BY e.version DESC LIMIT 1
        ), final_disposition AS (
          SELECT d.* FROM "BatchDisposition" d
          WHERE d.batchId=analyte.batchId AND (d.analysisCode IS NULL OR d.analysisCode=analyte.analysisCode)
          ORDER BY d.decidedAt DESC,d.id DESC LIMIT 1
        ), final_evidence AS (
          SELECT evaluation.verdict,
            CASE WHEN EXISTS (SELECT 1 FROM final_disposition)
              THEN (SELECT disposition.decision FROM final_disposition disposition
                WHERE NOT EXISTS (
                  SELECT 1 FROM "BatchEvent" reopened
                  WHERE reopened.batchId=analyte.batchId AND reopened.type='REOPENED'
                    AND reopened.at>=disposition.decidedAt AND json_valid(reopened.payload)
                    AND (CASE WHEN json_type(reopened.payload,'$.analysisCodes')='array'
                      THEN EXISTS (SELECT 1 FROM json_each(reopened.payload,'$.analysisCodes') code WHERE code.value=analyte.analysisCode)
                      ELSE json_extract(reopened.payload,'$.analysisCode') IS NULL
                        OR json_extract(reopened.payload,'$.analysisCode')=analyte.analysisCode END)
                ))
              WHEN json_valid(evaluation.details) AND json_extract(evaluation.details,'$.legacy')=1
                THEN CASE WHEN json_type(evaluation.details,'$.disposition')='object'
                  THEN COALESCE(json_extract(evaluation.details,'$.disposition.canonicalDecision'),
                    json_extract(evaluation.details,'$.disposition.decision'))
                  WHEN json_valid(json_extract(evaluation.details,'$.disposition'))
                  THEN COALESCE(json_extract(json_extract(evaluation.details,'$.disposition'),'$.canonicalDecision'),
                    json_extract(json_extract(evaluation.details,'$.disposition'),'$.decision')) END
              END decision
          FROM (SELECT 1) anchor LEFT JOIN final_evaluation evaluation ON 1
          WHERE NOT EXISTS (
            SELECT 1 FROM "BatchEvent" reopened
            WHERE reopened.batchId=analyte.batchId AND reopened.type='REOPENED' AND json_valid(reopened.payload)
              AND EXISTS (SELECT 1 FROM json_each(reopened.payload,'$.previousEvaluationIds') previous WHERE previous.value=evaluation.id)
          )
        )
        SELECT 1 FROM final_evidence
        WHERE decision IN ('ACCEPT_WITH_DEVIATION','PROCEED_WITH_WARNING')
          OR (decision IS NULL AND verdict IN ('PASS','WARN'))
      )
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
      AND (analyte.analysisCode IS NULL OR NOT (analyte.status='CLOSED' AND EXISTS (
        WITH final_evaluation AS (
          SELECT e.* FROM "QcEvaluation" e
          WHERE e.batchId=analyte.batchId AND e.analysisCode=analyte.analysisCode
          ORDER BY e.version DESC LIMIT 1
        ), final_disposition AS (
          SELECT d.* FROM "BatchDisposition" d
          WHERE d.batchId=analyte.batchId AND (d.analysisCode IS NULL OR d.analysisCode=analyte.analysisCode)
          ORDER BY d.decidedAt DESC,d.id DESC LIMIT 1
        ), final_evidence AS (
          SELECT evaluation.verdict,
            CASE WHEN EXISTS (SELECT 1 FROM final_disposition)
              THEN (SELECT disposition.decision FROM final_disposition disposition
                WHERE NOT EXISTS (
                  SELECT 1 FROM "BatchEvent" reopened
                  WHERE reopened.batchId=analyte.batchId AND reopened.type='REOPENED'
                    AND reopened.at>=disposition.decidedAt AND json_valid(reopened.payload)
                    AND (CASE WHEN json_type(reopened.payload,'$.analysisCodes')='array'
                      THEN EXISTS (SELECT 1 FROM json_each(reopened.payload,'$.analysisCodes') code WHERE code.value=analyte.analysisCode)
                      ELSE json_extract(reopened.payload,'$.analysisCode') IS NULL
                        OR json_extract(reopened.payload,'$.analysisCode')=analyte.analysisCode END)
                ))
              WHEN json_valid(evaluation.details) AND json_extract(evaluation.details,'$.legacy')=1
                THEN CASE WHEN json_type(evaluation.details,'$.disposition')='object'
                  THEN COALESCE(json_extract(evaluation.details,'$.disposition.canonicalDecision'),
                    json_extract(evaluation.details,'$.disposition.decision'))
                  WHEN json_valid(json_extract(evaluation.details,'$.disposition'))
                  THEN COALESCE(json_extract(json_extract(evaluation.details,'$.disposition'),'$.canonicalDecision'),
                    json_extract(json_extract(evaluation.details,'$.disposition'),'$.decision')) END
              END decision
          FROM (SELECT 1) anchor LEFT JOIN final_evaluation evaluation ON 1
          WHERE NOT EXISTS (
            SELECT 1 FROM "BatchEvent" reopened
            WHERE reopened.batchId=analyte.batchId AND reopened.type='REOPENED' AND json_valid(reopened.payload)
              AND EXISTS (SELECT 1 FROM json_each(reopened.payload,'$.previousEvaluationIds') previous WHERE previous.value=evaluation.id)
          )
        )
        SELECT 1 FROM final_evidence
        WHERE decision IN ('ACCEPT_WITH_DEVIATION','PROCEED_WITH_WARNING')
          OR (decision IS NULL AND verdict IN ('PASS','WARN'))
      )))
 ))
 AND NOT (NEW.batchId IS NULL AND NEW.rackPosition IS NULL AND OLD.batchId IS NOT NULL
 AND OLD.status='ACCEPTED' AND NEW.status='REPEAT_REQUIRED'
 AND EXISTS (
    SELECT 1 FROM "SampleAmendmentAttempt" link
    JOIN "SampleAmendment" amendment ON amendment.id=link.amendmentId AND amendment.sampleId=OLD.sampleId
    JOIN "Sample" sample ON sample.id=amendment.sampleId
    JOIN "WorkAttempt" parent ON parent.id=link.parentAttemptId AND parent.workItemId=OLD.id
    JOIN "WorkAttempt" child ON child.id=link.childAttemptId AND child.workItemId=OLD.id
    JOIN "AuditLog" event ON event.entity='WORK_ATTEMPT' AND event.entityId=child.id AND event.action='CREATED'
    WHERE link.workItemId=OLD.id AND amendment.type='SCIENTIFIC' AND amendment.status='APPROVED'
      AND typeof(amendment.version)='integer' AND amendment.version>1
      AND sample.status='PROCESSING' AND amendment.authorizedBy IS NOT NULL AND amendment.authorizedAt IS NOT NULL
      AND amendment.priorApprovedBy IS sample.approvedBy AND amendment.priorApprovedAt IS sample.approvedAt
      AND parent.status='ACCEPTED' AND parent.evidenceHash IS NOT NULL AND child.status='OPEN'
      AND child.parentAttemptId=parent.id AND child.attemptNo>parent.attemptNo
      AND link.reason IN ('CLIENT_RETEST','CONFIRMATION') AND child.reason=link.reason
      AND child.requestedBy=amendment.authorizedBy AND child.requestedAt=amendment.authorizedAt
      AND child.note IS amendment.reason AND event.performedBy=amendment.authorizedBy
      AND json_valid(amendment.selectedWorkItemIds) AND json_type(amendment.selectedWorkItemIds)='array'
      AND EXISTS (SELECT 1 FROM json_each(amendment.selectedWorkItemIds) selected WHERE selected.type='text' AND selected.value=OLD.id)
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
      AND (analyte.status IN ('QC_PASS','QC_WARN','ACCEPTED_WITH_DEVIATION') OR (analyte.status='CLOSED' AND EXISTS (
        WITH final_evaluation AS (
          SELECT e.* FROM "QcEvaluation" e
          WHERE e.batchId=analyte.batchId AND e.analysisCode=analyte.analysisCode
          ORDER BY e.version DESC LIMIT 1
        ), final_disposition AS (
          SELECT d.* FROM "BatchDisposition" d
          WHERE d.batchId=analyte.batchId AND (d.analysisCode IS NULL OR d.analysisCode=analyte.analysisCode)
          ORDER BY d.decidedAt DESC,d.id DESC LIMIT 1
        ), final_evidence AS (
          SELECT evaluation.verdict,
            CASE WHEN EXISTS (SELECT 1 FROM final_disposition)
              THEN (SELECT disposition.decision FROM final_disposition disposition
                WHERE NOT EXISTS (
                  SELECT 1 FROM "BatchEvent" reopened
                  WHERE reopened.batchId=analyte.batchId AND reopened.type='REOPENED'
                    AND reopened.at>=disposition.decidedAt AND json_valid(reopened.payload)
                    AND (CASE WHEN json_type(reopened.payload,'$.analysisCodes')='array'
                      THEN EXISTS (SELECT 1 FROM json_each(reopened.payload,'$.analysisCodes') code WHERE code.value=analyte.analysisCode)
                      ELSE json_extract(reopened.payload,'$.analysisCode') IS NULL
                        OR json_extract(reopened.payload,'$.analysisCode')=analyte.analysisCode END)
                ))
              WHEN json_valid(evaluation.details) AND json_extract(evaluation.details,'$.legacy')=1
                THEN CASE WHEN json_type(evaluation.details,'$.disposition')='object'
                  THEN COALESCE(json_extract(evaluation.details,'$.disposition.canonicalDecision'),
                    json_extract(evaluation.details,'$.disposition.decision'))
                  WHEN json_valid(json_extract(evaluation.details,'$.disposition'))
                  THEN COALESCE(json_extract(json_extract(evaluation.details,'$.disposition'),'$.canonicalDecision'),
                    json_extract(json_extract(evaluation.details,'$.disposition'),'$.decision')) END
              END decision
          FROM (SELECT 1) anchor LEFT JOIN final_evaluation evaluation ON 1
          WHERE NOT EXISTS (
            SELECT 1 FROM "BatchEvent" reopened
            WHERE reopened.batchId=analyte.batchId AND reopened.type='REOPENED' AND json_valid(reopened.payload)
              AND EXISTS (SELECT 1 FROM json_each(reopened.payload,'$.previousEvaluationIds') previous WHERE previous.value=evaluation.id)
          )
        )
        SELECT 1 FROM final_evidence
        WHERE decision IN ('ACCEPT_WITH_DEVIATION','PROCEED_WITH_WARNING')
          OR (decision IS NULL AND verdict IN ('PASS','WARN'))
      )))
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
      AND (analyte.analysisCode IS NULL OR NOT (analyte.status IN ('QC_PASS','QC_WARN','ACCEPTED_WITH_DEVIATION') OR (analyte.status='CLOSED' AND EXISTS (
        WITH final_evaluation AS (
          SELECT e.* FROM "QcEvaluation" e
          WHERE e.batchId=analyte.batchId AND e.analysisCode=analyte.analysisCode
          ORDER BY e.version DESC LIMIT 1
        ), final_disposition AS (
          SELECT d.* FROM "BatchDisposition" d
          WHERE d.batchId=analyte.batchId AND (d.analysisCode IS NULL OR d.analysisCode=analyte.analysisCode)
          ORDER BY d.decidedAt DESC,d.id DESC LIMIT 1
        ), final_evidence AS (
          SELECT evaluation.verdict,
            CASE WHEN EXISTS (SELECT 1 FROM final_disposition)
              THEN (SELECT disposition.decision FROM final_disposition disposition
                WHERE NOT EXISTS (
                  SELECT 1 FROM "BatchEvent" reopened
                  WHERE reopened.batchId=analyte.batchId AND reopened.type='REOPENED'
                    AND reopened.at>=disposition.decidedAt AND json_valid(reopened.payload)
                    AND (CASE WHEN json_type(reopened.payload,'$.analysisCodes')='array'
                      THEN EXISTS (SELECT 1 FROM json_each(reopened.payload,'$.analysisCodes') code WHERE code.value=analyte.analysisCode)
                      ELSE json_extract(reopened.payload,'$.analysisCode') IS NULL
                        OR json_extract(reopened.payload,'$.analysisCode')=analyte.analysisCode END)
                ))
              WHEN json_valid(evaluation.details) AND json_extract(evaluation.details,'$.legacy')=1
                THEN CASE WHEN json_type(evaluation.details,'$.disposition')='object'
                  THEN COALESCE(json_extract(evaluation.details,'$.disposition.canonicalDecision'),
                    json_extract(evaluation.details,'$.disposition.decision'))
                  WHEN json_valid(json_extract(evaluation.details,'$.disposition'))
                  THEN COALESCE(json_extract(json_extract(evaluation.details,'$.disposition'),'$.canonicalDecision'),
                    json_extract(json_extract(evaluation.details,'$.disposition'),'$.decision')) END
              END decision
          FROM (SELECT 1) anchor LEFT JOIN final_evaluation evaluation ON 1
          WHERE NOT EXISTS (
            SELECT 1 FROM "BatchEvent" reopened
            WHERE reopened.batchId=analyte.batchId AND reopened.type='REOPENED' AND json_valid(reopened.payload)
              AND EXISTS (SELECT 1 FROM json_each(reopened.payload,'$.previousEvaluationIds') previous WHERE previous.value=evaluation.id)
          )
        )
        SELECT 1 FROM final_evidence
        WHERE decision IN ('ACCEPT_WITH_DEVIATION','PROCEED_WITH_WARNING')
          OR (decision IS NULL AND verdict IN ('PASS','WARN'))
      ))))
 ))
BEGIN
  SELECT RAISE(ABORT, 'BATCH_MEMBERSHIP_FROZEN');
END;
