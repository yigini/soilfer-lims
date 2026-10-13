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
