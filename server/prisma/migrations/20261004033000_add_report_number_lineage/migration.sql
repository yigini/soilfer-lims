-- Additive report lineage; historical rows and frozen content are untouched.
ALTER TABLE "Report" ADD COLUMN "reportNumberBase" TEXT;
ALTER TABLE "Report" ADD COLUMN "revision" INTEGER;

CREATE TABLE "ReportSequence" (
    "labId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "ReportSequence_labId_year_key" ON "ReportSequence"("labId", "year");
CREATE UNIQUE INDEX "Report_number_revision_key" ON "Report"("reportNumberBase", "revision")
    WHERE "reportNumberBase" IS NOT NULL;
