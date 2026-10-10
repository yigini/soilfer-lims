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
