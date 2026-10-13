CREATE TABLE "ControlLimitProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "analysisCode" TEXT NOT NULL,
    "methodologyId" TEXT NOT NULL,
    "referenceMaterialId" TEXT NOT NULL,
    "mean" REAL NOT NULL,
    "sd" REAL NOT NULL,
    "n" INTEGER NOT NULL,
    "selectionSnapshot" TEXT NOT NULL,
    "policySnapshot" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "proposedBy" TEXT NOT NULL,
    "proposedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ControlLimitProposal_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ControlLimitProposal_methodologyId_fkey" FOREIGN KEY ("methodologyId") REFERENCES "Methodology" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ControlLimitProposal_referenceMaterialId_fkey" FOREIGN KEY ("referenceMaterialId") REFERENCES "ReferenceMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ControlLimitSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "analysisCode" TEXT NOT NULL,
    "methodologyId" TEXT NOT NULL,
    "referenceMaterialId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "mean" REAL NOT NULL,
    "sd" REAL NOT NULL,
    "n" INTEGER NOT NULL,
    "fromDate" DATETIME NOT NULL,
    "toDate" DATETIME,
    "approvedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "ControlLimitSet_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ControlLimitSet_methodologyId_fkey" FOREIGN KEY ("methodologyId") REFERENCES "Methodology" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ControlLimitSet_referenceMaterialId_fkey" FOREIGN KEY ("referenceMaterialId") REFERENCES "ReferenceMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ControlLimitSet_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ControlLimitProposal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "QcReviewObligation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "evidenceSnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QcReviewObligation_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QcReviewObligation_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "QcEvaluation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "QcReviewResolution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obligationId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "resolvedBy" TEXT NOT NULL,
    "resolvedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QcReviewResolution_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "QcReviewObligation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ControlLimitProposal_labId_analysisCode_methodologyId_referenceMaterialId_idx" ON "ControlLimitProposal"("labId", "analysisCode", "methodologyId", "referenceMaterialId");

CREATE UNIQUE INDEX "ControlLimitSet_proposalId_key" ON "ControlLimitSet"("proposalId");

CREATE INDEX "ControlLimitSet_labId_analysisCode_methodologyId_referenceMaterialId_idx" ON "ControlLimitSet"("labId", "analysisCode", "methodologyId", "referenceMaterialId");

CREATE INDEX "QcReviewObligation_labId_createdAt_idx" ON "QcReviewObligation"("labId", "createdAt");

CREATE UNIQUE INDEX "QcReviewObligation_evaluationId_rule_key" ON "QcReviewObligation"("evaluationId", "rule");

CREATE UNIQUE INDEX "QcReviewResolution_obligationId_key" ON "QcReviewResolution"("obligationId");

-- Contract guards: no historical QC/policy row or evaluation is rewritten.
CREATE UNIQUE INDEX "ControlLimitSet_one_approved_series" ON "ControlLimitSet"("labId", "analysisCode", "methodologyId", "referenceMaterialId") WHERE "status"='APPROVED';

CREATE TRIGGER "control_limit_proposal_insert" BEFORE INSERT ON "ControlLimitProposal"
BEGIN
 SELECT CASE WHEN NEW."n"<2 OR NEW."sd"<=0 OR length(trim(NEW."reason"))=0 OR NOT json_valid(NEW."selectionSnapshot") OR NOT json_valid(NEW."policySnapshot")
  OR json_type(NEW."selectionSnapshot")<>'array'
  OR NEW."n" < coalesce(json_extract(NEW."policySnapshot", '$.values."qc.controlChartMinPoints"'),2147483647)
  OR NEW."n" <> (SELECT count(*) FROM json_each(NEW."selectionSnapshot") WHERE json_extract(value,'$.selected')=1)
  OR EXISTS(SELECT 1 FROM json_each(NEW."selectionSnapshot") WHERE json_extract(value,'$.selected')=0 AND length(trim(coalesce(json_extract(value,'$.exclusionReason'),'')))=0)
  OR NOT EXISTS(SELECT 1 FROM "Methodology" m WHERE m."id"=NEW."methodologyId" AND m."analysisCode"=NEW."analysisCode" AND (m."labId" IS NULL OR m."labId" IN (NEW."labId",(SELECT "code" FROM "Lab" WHERE "id"=NEW."labId"))))
  OR NOT EXISTS(SELECT 1 FROM "ReferenceMaterial" r WHERE r."id"=NEW."referenceMaterialId" AND r."labId"=NEW."labId")
  OR NOT EXISTS(SELECT 1 FROM "User" WHERE "username"=NEW."proposedBy")
 THEN RAISE(ABORT,'QC_CHART_PROPOSAL_INVALID') END;
END;

CREATE TRIGGER "control_limit_set_insert" BEFORE INSERT ON "ControlLimitSet"
BEGIN
 SELECT CASE WHEN NEW."status"<>'APPROVED' OR NEW."toDate" IS NOT NULL OR NOT EXISTS(
  SELECT 1 FROM "ControlLimitProposal" p WHERE p."id"=NEW."proposalId" AND p."labId"=NEW."labId" AND p."analysisCode"=NEW."analysisCode"
   AND p."methodologyId"=NEW."methodologyId" AND p."referenceMaterialId"=NEW."referenceMaterialId"
   AND p."mean"=NEW."mean" AND p."sd"=NEW."sd" AND p."n"=NEW."n" AND p."proposedBy"<>NEW."approvedBy")
  OR NOT EXISTS(SELECT 1 FROM "User" WHERE "username"=NEW."approvedBy")
 THEN RAISE(ABORT,'QC_CHART_APPROVAL_INVALID') END;
END;

CREATE TRIGGER "qc_review_obligation_insert" BEFORE INSERT ON "QcReviewObligation"
BEGIN
 SELECT CASE WHEN NOT json_valid(NEW."evidenceSnapshot") OR json_type(NEW."evidenceSnapshot")<>'array'
  OR NOT EXISTS(SELECT 1 FROM "QcEvaluation" e JOIN "Batch" b ON b."id"=e."batchId", json_each(e."details",'$.evaluation.controlCharts') c, json_each(c.value,'$.review') r
   WHERE e."id"=NEW."evaluationId" AND b."labId"=NEW."labId" AND r.value=NEW."rule")
 THEN RAISE(ABORT,'QC_CHART_REVIEW_INVALID') END;
END;

CREATE TRIGGER "qc_review_resolution_insert" BEFORE INSERT ON "QcReviewResolution"
BEGIN
 SELECT CASE WHEN NEW."outcome" NOT IN ('NO_ACTION','INVESTIGATE_NEW_LIMITS') OR length(trim(NEW."note"))=0
  OR NOT EXISTS(SELECT 1 FROM "User" WHERE "username"=NEW."resolvedBy")
 THEN RAISE(ABORT,'QC_CHART_RESOLUTION_INVALID') END;
END;

CREATE TRIGGER "control_limit_set_supersede_only" BEFORE UPDATE ON "ControlLimitSet"
BEGIN
 SELECT CASE WHEN OLD."status"<>'APPROVED' OR NEW."status"<>'SUPERSEDED' OR OLD."toDate" IS NOT NULL OR NEW."toDate" IS NULL
  OR NEW."toDate"<OLD."fromDate" OR NEW."id" IS NOT OLD."id" OR NEW."labId" IS NOT OLD."labId"
  OR NEW."analysisCode" IS NOT OLD."analysisCode" OR NEW."methodologyId" IS NOT OLD."methodologyId"
  OR NEW."referenceMaterialId" IS NOT OLD."referenceMaterialId" OR NEW."proposalId" IS NOT OLD."proposalId"
  OR NEW."mean" IS NOT OLD."mean" OR NEW."sd" IS NOT OLD."sd" OR NEW."n" IS NOT OLD."n"
  OR NEW."fromDate" IS NOT OLD."fromDate" OR NEW."approvedBy" IS NOT OLD."approvedBy"
 THEN RAISE(ABORT,'QC_CHART_LIMITS_IMMUTABLE') END;
END;

CREATE TRIGGER "ControlLimitProposal_update_refused" BEFORE UPDATE ON "ControlLimitProposal"
BEGIN
 SELECT RAISE(ABORT,'QC_CHART_EVIDENCE_IMMUTABLE');
END;

CREATE TRIGGER "ControlLimitProposal_delete_refused" BEFORE DELETE ON "ControlLimitProposal"
BEGIN
 SELECT RAISE(ABORT,'QC_CHART_EVIDENCE_IMMUTABLE');
END;

CREATE TRIGGER "ControlLimitSet_delete_refused" BEFORE DELETE ON "ControlLimitSet"
BEGIN
 SELECT RAISE(ABORT,'QC_CHART_EVIDENCE_IMMUTABLE');
END;

CREATE TRIGGER "QcReviewObligation_update_refused" BEFORE UPDATE ON "QcReviewObligation"
BEGIN
 SELECT RAISE(ABORT,'QC_CHART_EVIDENCE_IMMUTABLE');
END;

CREATE TRIGGER "QcReviewObligation_delete_refused" BEFORE DELETE ON "QcReviewObligation"
BEGIN
 SELECT RAISE(ABORT,'QC_CHART_EVIDENCE_IMMUTABLE');
END;

CREATE TRIGGER "QcReviewResolution_update_refused" BEFORE UPDATE ON "QcReviewResolution"
BEGIN
 SELECT RAISE(ABORT,'QC_CHART_EVIDENCE_IMMUTABLE');
END;

CREATE TRIGGER "QcReviewResolution_delete_refused" BEFORE DELETE ON "QcReviewResolution"
BEGIN
 SELECT RAISE(ABORT,'QC_CHART_EVIDENCE_IMMUTABLE');
END;
