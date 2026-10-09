-- #210 pin6091161203: additive request evidence; no historical backfill.
ALTER TABLE "SampleAmendment" ADD COLUMN "requestPayload" TEXT;
ALTER TABLE "SampleAmendment" ADD COLUMN "version" INTEGER;
ALTER TABLE "SampleAmendment" ADD COLUMN "priorApprovedBy" TEXT;
ALTER TABLE "SampleAmendment" ADD COLUMN "priorApprovedAt" DATETIME;
ALTER TABLE "SampleAmendment" ADD COLUMN "selectedWorkItemIds" TEXT;

-- Contract guards
CREATE TRIGGER "SampleAmendment_request_evidence_immutable"
BEFORE UPDATE OF "requestPayload", "selectedWorkItemIds" ON "SampleAmendment"
WHEN NEW.requestPayload IS NOT OLD.requestPayload OR NEW.selectedWorkItemIds IS NOT OLD.selectedWorkItemIds
BEGIN SELECT RAISE(ABORT, 'AMENDMENT_REQUEST_IMMUTABLE'); END;

CREATE TRIGGER "SampleAmendment_new_request_guard"
BEFORE INSERT ON "SampleAmendment"
WHEN NEW.version IS NOT NULL AND (
 typeof(NEW.version) <> 'integer' OR NEW.version <> 1 OR NEW.status <> 'PENDING'
 OR NEW.requestPayload IS NULL OR NOT json_valid(NEW.requestPayload) OR json_type(NEW.requestPayload) <> 'object'
 OR NEW.selectedWorkItemIds IS NULL OR NOT json_valid(NEW.selectedWorkItemIds) OR json_type(NEW.selectedWorkItemIds) <> 'array'
 OR NEW.authorizedBy IS NOT NULL OR NEW.authorizedAt IS NOT NULL
 OR NEW.priorApprovedBy IS NOT NULL OR NEW.priorApprovedAt IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'AMENDMENT_REQUEST_INVALID'); END;

CREATE TRIGGER "SampleAmendment_version_guard"
BEFORE UPDATE ON "SampleAmendment"
WHEN (OLD.version IS NULL AND NEW.version IS NOT NULL)
 OR (OLD.version IS NOT NULL AND (typeof(NEW.version) <> 'integer' OR NEW.version <> OLD.version + 1))
BEGIN SELECT RAISE(ABORT, 'AMENDMENT_VERSION_CONFLICT'); END;

CREATE TRIGGER "SampleAmendment_prior_approval_guard"
BEFORE UPDATE OF "priorApprovedBy", "priorApprovedAt" ON "SampleAmendment"
WHEN (NEW.priorApprovedBy IS NOT OLD.priorApprovedBy OR NEW.priorApprovedAt IS NOT OLD.priorApprovedAt) AND (
 OLD.version IS NULL OR OLD.status <> 'PENDING' OR NEW.status <> 'APPROVED'
 OR NEW.authorizedBy IS NULL OR NEW.authorizedAt IS NULL
 OR OLD.priorApprovedBy IS NOT NULL OR OLD.priorApprovedAt IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'AMENDMENT_PRIOR_APPROVAL_IMMUTABLE'); END;

CREATE TRIGGER "SampleAmendment_delete_immutable"
BEFORE DELETE ON "SampleAmendment"
BEGIN SELECT RAISE(ABORT, 'AMENDMENT_DELETE_REFUSED'); END;
