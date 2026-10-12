-- #211 pin6097077343: additive report revision evidence; historical rows stay NULL.
ALTER TABLE "Report" ADD COLUMN "supersedesReportId" TEXT;
ALTER TABLE "Report" ADD COLUMN "amendmentId" TEXT;
ALTER TABLE "Report" ADD COLUMN "amendmentReason" TEXT;
ALTER TABLE "Report" ADD COLUMN "issuedBy" TEXT;
ALTER TABLE "Report" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "Report" ADD COLUMN "amendmentAuthorizedBy" TEXT;

-- Contract guards
CREATE UNIQUE INDEX "Report_amendmentId_key" ON "Report"("amendmentId")
    WHERE "amendmentId" IS NOT NULL;

CREATE TRIGGER "Report_revision_evidence_immutable"
BEFORE UPDATE OF "supersedesReportId", "amendmentId", "amendmentReason", "issuedBy", "approvedBy", "amendmentAuthorizedBy" ON "Report"
WHEN NEW."supersedesReportId" IS NOT OLD."supersedesReportId" OR NEW."amendmentId" IS NOT OLD."amendmentId"
 OR NEW."amendmentReason" IS NOT OLD."amendmentReason" OR NEW."issuedBy" IS NOT OLD."issuedBy"
 OR NEW."approvedBy" IS NOT OLD."approvedBy" OR NEW."amendmentAuthorizedBy" IS NOT OLD."amendmentAuthorizedBy"
BEGIN SELECT RAISE(ABORT, 'REPORT_REVISION_IMMUTABLE');
END;

CREATE TRIGGER "Report_revision_amendment_guard"
BEFORE INSERT ON "Report"
WHEN (NEW."issuedBy" IS NULL AND (NEW."supersedesReportId" IS NOT NULL OR NEW."amendmentId" IS NOT NULL
  OR NEW."amendmentReason" IS NOT NULL OR NEW."approvedBy" IS NOT NULL OR NEW."amendmentAuthorizedBy" IS NOT NULL))
 OR (NEW."issuedBy" IS NOT NULL AND (
  (COALESCE(NEW."revision", 0) > 0 AND (NEW."amendmentId" IS NULL OR NEW."supersedesReportId" IS NULL))
  OR (NEW."amendmentId" IS NULL AND (NEW."amendmentReason" IS NOT NULL OR NEW."amendmentAuthorizedBy" IS NOT NULL))
  OR (NEW."amendmentId" IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM "SampleAmendment" a JOIN "Report" p ON p.id=NEW."supersedesReportId" AND p.sampleId=a.sampleId
   WHERE a.id=NEW."amendmentId" AND a.sampleId=NEW."sampleId" AND a.status='APPROVED'
    AND typeof(a.version)='integer' AND a.version>1 AND a.requestPayload IS NOT NULL
    AND a.authorizedBy IS NOT NULL AND a.authorizedBy IS NEW."amendmentAuthorizedBy"
    AND a.reason IS NEW."amendmentReason"
    AND (p.reportNumberBase IS NULL OR p.reportNumberBase IS NEW."reportNumberBase")
    AND NEW."revision" > COALESCE(p.revision, 0)))))
BEGIN SELECT RAISE(ABORT, 'REPORT_AMENDMENT_CONTEXT_MISMATCH');
END;
