ALTER TABLE "Sample" ADD COLUMN "labSampleCode" TEXT;
CREATE UNIQUE INDEX "Sample_labSampleCode_key" ON "Sample"("labSampleCode");
ALTER TABLE "WorkItem" ADD COLUMN "legacyLabId" TEXT;

CREATE TABLE "LabSequence" (
    "labId" TEXT NOT NULL,
    "scope" TEXT NOT NULL CHECK ("scope" IN ('SAMPLE', 'REPORT', 'CONSIGNMENT', 'BATCH')),
    "year" INTEGER NOT NULL CHECK ("year" >= 0),
    "next" INTEGER NOT NULL DEFAULT 1 CHECK ("next" >= 1),
    PRIMARY KEY ("labId", "scope", "year")
);
