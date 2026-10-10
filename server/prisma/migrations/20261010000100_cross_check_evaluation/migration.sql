CREATE TABLE "CrossCheckEvaluation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "reasonCode" TEXT,
    "inputs" TEXT NOT NULL,
    "thresholds" TEXT NOT NULL,
    "evaluatedBy" TEXT NOT NULL,
    "evaluatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrossCheckEvaluation_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CrossCheckEvaluation_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "CrossCheckEvaluation_sampleId_evaluatedAt_idx" ON "CrossCheckEvaluation"("sampleId", "evaluatedAt");

CREATE INDEX "CrossCheckEvaluation_labId_sampleId_evaluatedAt_idx" ON "CrossCheckEvaluation"("labId", "sampleId", "evaluatedAt");

-- Contract guards
CREATE TRIGGER "CrossCheckEvaluation_update_immutable"
BEFORE UPDATE ON "CrossCheckEvaluation"
BEGIN
    SELECT RAISE(ABORT, 'CROSS_CHECK_EVALUATION_IMMUTABLE');
END;

CREATE TRIGGER "CrossCheckEvaluation_delete_immutable"
BEFORE DELETE ON "CrossCheckEvaluation"
BEGIN
    SELECT RAISE(ABORT, 'CROSS_CHECK_EVALUATION_IMMUTABLE');
END;
