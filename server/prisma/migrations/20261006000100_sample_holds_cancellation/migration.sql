-- #183: additive cancellation provenance and canonical holds. No old row rewrite.
ALTER TABLE "WorkItem" ADD COLUMN "cancellationCode" TEXT
  CHECK ("cancellationCode" IS NULL OR "cancellationCode" IN ('INTAKE_UNDONE','INTAKE_REJECTED'));
ALTER TABLE "WorkItem" ADD COLUMN "cancellationReason" TEXT;
ALTER TABLE "WorkItem" ADD COLUMN "cancelledBy" TEXT;
ALTER TABLE "WorkItem" ADD COLUMN "cancelledAt" DATETIME;

CREATE TABLE "SampleHold" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "sampleId" TEXT NOT NULL REFERENCES "Sample"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "type" TEXT NOT NULL CHECK ("type" IN ('PROVENANCE','CUSTODY','CLIENT_QUERY','QC','OTHER')),
  "reason" TEXT NOT NULL CHECK (length(trim("reason")) > 0),
  "raisedBy" TEXT NOT NULL CHECK (length(trim("raisedBy")) > 0),
  "raisedAt" DATETIME NOT NULL,
  "resolvedBy" TEXT,
  "resolvedAt" DATETIME,
  "resolution" TEXT,
  "attributionSource" TEXT NOT NULL CHECK ("attributionSource" IN ('KOBO_CONFLICT_AUDIT','LEGACY_HOLD_UPDATED_AT','REVIEWED_MAPPING','LIVE')),
  "compatMarker" TEXT CHECK ("compatMarker" IS NULL OR "compatMarker" = 'KOBO_PROVENANCE'),
  CHECK (("resolvedAt" IS NULL AND "resolvedBy" IS NULL AND "resolution" IS NULL) OR
    ("resolvedAt" IS NOT NULL AND COALESCE(length(trim("resolvedBy")),0) > 0 AND COALESCE(length(trim("resolution")),0) > 0))
);
CREATE INDEX "SampleHold_sampleId_resolvedAt_idx" ON "SampleHold"("sampleId","resolvedAt");
CREATE UNIQUE INDEX "SampleHold_one_backfilled_per_sample" ON "SampleHold"("sampleId")
  WHERE "attributionSource" IN ('KOBO_CONFLICT_AUDIT','LEGACY_HOLD_UPDATED_AT','REVIEWED_MAPPING');

-- Fresh Prisma schemas get these same integrity guards without table rebuilds.
CREATE TRIGGER "SampleHold_insert_guard" BEFORE INSERT ON "SampleHold"
WHEN NEW."type" NOT IN ('PROVENANCE','CUSTODY','CLIENT_QUERY','QC','OTHER')
  OR COALESCE(length(trim(NEW."reason")),0) = 0 OR COALESCE(length(trim(NEW."raisedBy")),0) = 0
  OR NEW."raisedAt" IS NULL
  OR NEW."attributionSource" NOT IN ('KOBO_CONFLICT_AUDIT','LEGACY_HOLD_UPDATED_AT','REVIEWED_MAPPING','LIVE')
  OR (NEW."compatMarker" IS NOT NULL AND NEW."compatMarker" <> 'KOBO_PROVENANCE')
  OR (NEW."compatMarker" IS NOT NULL AND NEW."type" <> 'PROVENANCE')
  OR (NEW."attributionSource" <> 'LIVE' AND COALESCE(NEW."compatMarker",'') <> 'KOBO_PROVENANCE')
  OR (NEW."resolvedAt" IS NULL AND (NEW."resolvedBy" IS NOT NULL OR NEW."resolution" IS NOT NULL))
  OR (NEW."resolvedAt" IS NOT NULL AND (COALESCE(length(trim(NEW."resolvedBy")),0) = 0 OR COALESCE(length(trim(NEW."resolution")),0) = 0))
BEGIN
  SELECT RAISE(ABORT, 'INVALID_SAMPLE_HOLD');
END;

CREATE TRIGGER "SampleHold_update_guard" BEFORE UPDATE ON "SampleHold"
WHEN NEW."type" NOT IN ('PROVENANCE','CUSTODY','CLIENT_QUERY','QC','OTHER')
  OR COALESCE(length(trim(NEW."reason")),0) = 0 OR COALESCE(length(trim(NEW."raisedBy")),0) = 0
  OR NEW."raisedAt" IS NULL
  OR NEW."attributionSource" NOT IN ('KOBO_CONFLICT_AUDIT','LEGACY_HOLD_UPDATED_AT','REVIEWED_MAPPING','LIVE')
  OR (NEW."compatMarker" IS NOT NULL AND NEW."compatMarker" <> 'KOBO_PROVENANCE')
  OR (NEW."compatMarker" IS NOT NULL AND NEW."type" <> 'PROVENANCE')
  OR (NEW."attributionSource" <> 'LIVE' AND COALESCE(NEW."compatMarker",'') <> 'KOBO_PROVENANCE')
  OR (NEW."resolvedAt" IS NULL AND (NEW."resolvedBy" IS NOT NULL OR NEW."resolution" IS NOT NULL))
  OR (NEW."resolvedAt" IS NOT NULL AND (COALESCE(length(trim(NEW."resolvedBy")),0) = 0 OR COALESCE(length(trim(NEW."resolution")),0) = 0))
BEGIN
  SELECT RAISE(ABORT, 'INVALID_SAMPLE_HOLD');
END;

CREATE TRIGGER "SampleHold_raise_immutable" BEFORE UPDATE ON "SampleHold"
WHEN NEW."id" IS NOT OLD."id" OR NEW."sampleId" IS NOT OLD."sampleId"
  OR NEW."type" IS NOT OLD."type" OR NEW."reason" IS NOT OLD."reason"
  OR NEW."raisedBy" IS NOT OLD."raisedBy" OR NEW."raisedAt" IS NOT OLD."raisedAt"
  OR NEW."attributionSource" IS NOT OLD."attributionSource" OR NEW."compatMarker" IS NOT OLD."compatMarker"
BEGIN
  SELECT RAISE(ABORT, 'SAMPLE_HOLD_RAISE_IMMUTABLE');
END;

CREATE TRIGGER "SampleHold_resolution_final" BEFORE UPDATE ON "SampleHold"
WHEN OLD."resolvedAt" IS NOT NULL AND (NEW."resolvedAt" IS NOT OLD."resolvedAt"
  OR NEW."resolvedBy" IS NOT OLD."resolvedBy" OR NEW."resolution" IS NOT OLD."resolution")
BEGIN
  SELECT RAISE(ABORT, 'SAMPLE_HOLD_RESOLUTION_IMMUTABLE');
END;

CREATE TRIGGER "SampleHold_delete_refusal" BEFORE DELETE ON "SampleHold"
BEGIN
  SELECT RAISE(ABORT, 'SAMPLE_HOLD_DELETE_REFUSED');
END;

CREATE TRIGGER "WorkItem_cancellation_insert_guard" BEFORE INSERT ON "WorkItem"
WHEN (NEW."cancellationCode" IS NULL AND (NEW."cancellationReason" IS NOT NULL OR NEW."cancelledBy" IS NOT NULL OR NEW."cancelledAt" IS NOT NULL))
  OR (NEW."cancellationCode" IS NOT NULL AND (NEW."cancellationCode" NOT IN ('INTAKE_UNDONE','INTAKE_REJECTED')
    OR COALESCE(length(trim(NEW."cancellationReason")),0) = 0 OR COALESCE(length(trim(NEW."cancelledBy")),0) = 0 OR NEW."cancelledAt" IS NULL))
BEGIN
  SELECT RAISE(ABORT, 'INVALID_CANCELLATION_PROVENANCE');
END;

CREATE TRIGGER "WorkItem_cancellation_update_guard" BEFORE UPDATE ON "WorkItem"
WHEN (NEW."cancellationCode" IS NULL AND (NEW."cancellationReason" IS NOT NULL OR NEW."cancelledBy" IS NOT NULL OR NEW."cancelledAt" IS NOT NULL))
  OR (NEW."cancellationCode" IS NOT NULL AND (NEW."cancellationCode" NOT IN ('INTAKE_UNDONE','INTAKE_REJECTED')
    OR COALESCE(length(trim(NEW."cancellationReason")),0) = 0 OR COALESCE(length(trim(NEW."cancelledBy")),0) = 0 OR NEW."cancelledAt" IS NULL))
BEGIN
  SELECT RAISE(ABORT, 'INVALID_CANCELLATION_PROVENANCE');
END;
