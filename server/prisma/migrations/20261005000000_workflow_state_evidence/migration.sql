-- Additive only: historical rows and existing indexes/foreign keys are preserved.
ALTER TABLE "Sample" ADD COLUMN "holdPriorStatus" TEXT;
ALTER TABLE "Sample" ADD COLUMN "legacyStatus" TEXT;
ALTER TABLE "WorkItem" ADD COLUMN "holdPriorStatus" TEXT;
ALTER TABLE "WorkItem" ADD COLUMN "legacyStatus" TEXT;

CREATE TABLE "ResultEvidenceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resultId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "gate" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResultEvidenceEvent_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResultEvidenceEvent_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ResultEvidenceEvent_resultId_gate_createdAt_idx" ON "ResultEvidenceEvent" ("resultId", "gate", "createdAt");
CREATE INDEX "ResultEvidenceEvent_sampleId_createdAt_idx" ON "ResultEvidenceEvent" ("sampleId", "createdAt");
