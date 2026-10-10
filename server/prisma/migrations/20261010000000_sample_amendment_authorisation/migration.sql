-- #210 pin6091161203: additive request evidence; no historical backfill.
ALTER TABLE "SampleAmendment" ADD COLUMN "requestPayload" TEXT;
ALTER TABLE "SampleAmendment" ADD COLUMN "version" INTEGER;
ALTER TABLE "SampleAmendment" ADD COLUMN "priorApprovedBy" TEXT;
ALTER TABLE "SampleAmendment" ADD COLUMN "priorApprovedAt" DATETIME;
ALTER TABLE "SampleAmendment" ADD COLUMN "selectedWorkItemIds" TEXT;

-- Pin6091749343: exact fresh Prisma7.10 link authority; no backfill.
CREATE TABLE "SampleAmendmentAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amendmentId" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "parentAttemptId" TEXT NOT NULL,
    "childAttemptId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SampleAmendmentAttempt_amendmentId_fkey" FOREIGN KEY ("amendmentId") REFERENCES "SampleAmendment" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "SampleAmendmentAttempt_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "SampleAmendmentAttempt_parentAttemptId_fkey" FOREIGN KEY ("parentAttemptId") REFERENCES "WorkAttempt" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "SampleAmendmentAttempt_childAttemptId_fkey" FOREIGN KEY ("childAttemptId") REFERENCES "WorkAttempt" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "SampleAmendmentAttempt_childAttemptId_key" ON "SampleAmendmentAttempt"("childAttemptId");

-- #210 pin6094004400: exact fresh Prisma7.10 withdrawal authority.
CREATE TABLE "ReportAmendmentWithdrawal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "amendmentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReportAmendmentWithdrawal_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "ReportAmendmentWithdrawal_amendmentId_fkey" FOREIGN KEY ("amendmentId") REFERENCES "SampleAmendment" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "ReportAmendmentWithdrawal_reportId_key" ON "ReportAmendmentWithdrawal"("reportId");

-- Contract guards
CREATE TRIGGER "SampleAmendment_request_evidence_immutable"
BEFORE UPDATE OF "requestPayload", "selectedWorkItemIds" ON "SampleAmendment"
WHEN NEW.requestPayload IS NOT OLD.requestPayload OR NEW.selectedWorkItemIds IS NOT OLD.selectedWorkItemIds
BEGIN SELECT RAISE(ABORT, 'AMENDMENT_REQUEST_IMMUTABLE');
END;

CREATE TRIGGER "SampleAmendment_new_request_guard"
BEFORE INSERT ON "SampleAmendment"
WHEN NEW.version IS NOT NULL AND (
 typeof(NEW.version) <> 'integer' OR NEW.version <> 1 OR NEW.status <> 'PENDING'
 OR CASE WHEN json_valid(NEW.requestPayload) THEN json_type(NEW.requestPayload) ELSE NULL END IS NOT 'object'
 OR CASE WHEN json_valid(NEW.selectedWorkItemIds) THEN json_type(NEW.selectedWorkItemIds) ELSE NULL END IS NOT 'array'
 OR NEW.authorizedBy IS NOT NULL OR NEW.authorizedAt IS NOT NULL
 OR NEW.priorApprovedBy IS NOT NULL OR NEW.priorApprovedAt IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'AMENDMENT_REQUEST_INVALID');
END;

CREATE TRIGGER "SampleAmendment_version_guard"
BEFORE UPDATE ON "SampleAmendment"
WHEN (OLD.version IS NULL AND NEW.version IS NOT NULL)
 OR (OLD.version IS NOT NULL AND (typeof(NEW.version) <> 'integer' OR NEW.version <> OLD.version + 1))
BEGIN SELECT RAISE(ABORT, 'AMENDMENT_VERSION_CONFLICT');
END;

CREATE TRIGGER "SampleAmendment_prior_approval_guard"
BEFORE UPDATE OF "priorApprovedBy", "priorApprovedAt" ON "SampleAmendment"
WHEN (NEW.priorApprovedBy IS NOT OLD.priorApprovedBy OR NEW.priorApprovedAt IS NOT OLD.priorApprovedAt) AND (
 OLD.version IS NULL OR OLD.status <> 'PENDING' OR NEW.status <> 'APPROVED'
 OR NEW.authorizedBy IS NULL OR NEW.authorizedAt IS NULL
 OR OLD.priorApprovedBy IS NOT NULL OR OLD.priorApprovedAt IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'AMENDMENT_PRIOR_APPROVAL_IMMUTABLE');
END;

CREATE TRIGGER "SampleAmendment_delete_immutable"
BEFORE DELETE ON "SampleAmendment"
BEGIN SELECT RAISE(ABORT, 'AMENDMENT_DELETE_REFUSED');
END;

CREATE TRIGGER "SampleAmendmentAttempt_context_guard"
BEFORE INSERT ON "SampleAmendmentAttempt"
WHEN NEW.reason NOT IN ('CLIENT_RETEST', 'CONFIRMATION') OR NOT EXISTS (
 SELECT 1 FROM "SampleAmendment" a
 JOIN "WorkItem" w ON w.id=NEW.workItemId AND w.sampleId=a.sampleId
 JOIN "WorkAttempt" parent ON parent.id=NEW.parentAttemptId AND parent.workItemId=w.id
 JOIN "WorkAttempt" child ON child.id=NEW.childAttemptId AND child.workItemId=w.id
 WHERE a.id=NEW.amendmentId AND a.type='SCIENTIFIC' AND a.status='APPROVED'
  AND typeof(a.version)='integer' AND a.version>1
  AND a.authorizedBy IS NOT NULL AND a.authorizedAt IS NOT NULL
  AND parent.status='ACCEPTED' AND child.status='OPEN'
  AND child.parentAttemptId IS NEW.parentAttemptId AND child.reason IS NEW.reason
  AND CASE WHEN json_valid(a.selectedWorkItemIds) THEN json_type(a.selectedWorkItemIds) ELSE NULL END IS 'array'
  AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(a.selectedWorkItemIds) THEN a.selectedWorkItemIds ELSE '[]' END)
   WHERE type='text' AND value=NEW.workItemId)
)
BEGIN SELECT RAISE(ABORT, 'AMENDMENT_ATTEMPT_CONTEXT_MISMATCH');
END;

CREATE TRIGGER "SampleAmendmentAttempt_update_immutable"
BEFORE UPDATE ON "SampleAmendmentAttempt"
BEGIN SELECT RAISE(ABORT, 'AMENDMENT_ATTEMPT_IMMUTABLE');
END;

CREATE TRIGGER "SampleAmendmentAttempt_delete_immutable"
BEFORE DELETE ON "SampleAmendmentAttempt"
BEGIN SELECT RAISE(ABORT, 'AMENDMENT_ATTEMPT_IMMUTABLE');
END;

CREATE TRIGGER "ReportAmendmentWithdrawal_context_guard"
BEFORE INSERT ON "ReportAmendmentWithdrawal"
WHEN NOT EXISTS (
 SELECT 1 FROM "Report" r JOIN "SampleAmendment" a ON a.sampleId=r.sampleId
 WHERE r.id=NEW.reportId AND a.id=NEW.amendmentId
  AND r.status='PUBLISHED' AND r.publishedAt IS NOT NULL
  AND a.type='SCIENTIFIC' AND a.status='APPROVED'
  AND typeof(a.version)='integer' AND a.version>1
  AND a.requestPayload IS NOT NULL AND a.selectedWorkItemIds IS NOT NULL
  AND a.authorizedBy IS NOT NULL AND a.authorizedAt IS NOT NULL
)
BEGIN SELECT RAISE(ABORT, 'REPORT_WITHDRAWAL_CONTEXT_MISMATCH');
END;

CREATE TRIGGER "ReportAmendmentWithdrawal_update_immutable"
BEFORE UPDATE ON "ReportAmendmentWithdrawal"
BEGIN SELECT RAISE(ABORT, 'REPORT_WITHDRAWAL_IMMUTABLE');
END;

CREATE TRIGGER "ReportAmendmentWithdrawal_delete_immutable"
BEFORE DELETE ON "ReportAmendmentWithdrawal"
BEGIN SELECT RAISE(ABORT, 'REPORT_WITHDRAWAL_IMMUTABLE');
END;

CREATE TRIGGER "Report_withdrawal_insert_guard"
BEFORE INSERT ON "Report"
WHEN NEW.status='WITHDRAWN'
BEGIN SELECT RAISE(ABORT, 'REPORT_WITHDRAWAL_CONTEXT_MISMATCH');
END;

CREATE TRIGGER "Report_withdrawal_status_guard"
BEFORE UPDATE OF "status" ON "Report"
WHEN (NEW.status='WITHDRAWN' AND OLD.status IS NOT 'WITHDRAWN' AND (
 OLD.status IS NOT 'PUBLISHED' OR NOT EXISTS (
  SELECT 1 FROM "ReportAmendmentWithdrawal" w WHERE w.reportId=OLD.id)))
 OR (OLD.status='WITHDRAWN' AND NEW.status IS NOT 'WITHDRAWN')
BEGIN SELECT RAISE(ABORT, 'REPORT_WITHDRAWAL_CONTEXT_MISMATCH');
END;

CREATE TRIGGER "Report_withdrawal_content_guard"
BEFORE UPDATE ON "Report"
WHEN (OLD.status='WITHDRAWN' OR NEW.status='WITHDRAWN') AND (
 NEW."id" IS NOT OLD."id" OR
 NEW."sampleId" IS NOT OLD."sampleId" OR
 NEW."labId" IS NOT OLD."labId" OR
 NEW."version" IS NOT OLD."version" OR
 NEW."reportNumberBase" IS NOT OLD."reportNumberBase" OR
 NEW."revision" IS NOT OLD."revision" OR
 NEW."policyVersion" IS NOT OLD."policyVersion" OR
 NEW."firstName" IS NOT OLD."firstName" OR
 NEW."surname" IS NOT OLD."surname" OR
 NEW."phone" IS NOT OLD."phone" OR
 NEW."phoneNorm" IS NOT OLD."phoneNorm" OR
 NEW."projectCode" IS NOT OLD."projectCode" OR
 NEW."projectName" IS NOT OLD."projectName" OR
 NEW."sampleLabId" IS NOT OLD."sampleLabId" OR
 NEW."content" IS NOT OLD."content" OR
 NEW."generatedBy" IS NOT OLD."generatedBy" OR
 NEW."generatedAt" IS NOT OLD."generatedAt" OR
 NEW."publishedAt" IS NOT OLD."publishedAt" OR
 NEW."createdAt" IS NOT OLD."createdAt")
BEGIN SELECT RAISE(ABORT, 'REPORT_WITHDRAWAL_IMMUTABLE');
END;
