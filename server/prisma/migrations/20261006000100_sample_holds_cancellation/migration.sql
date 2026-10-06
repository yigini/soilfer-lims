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
    ("resolvedAt" IS NOT NULL AND length(trim("resolvedBy")) > 0 AND length(trim("resolution")) > 0))
);
CREATE INDEX "SampleHold_sampleId_resolvedAt_idx" ON "SampleHold"("sampleId","resolvedAt");
CREATE UNIQUE INDEX "SampleHold_one_backfilled_per_sample" ON "SampleHold"("sampleId")
  WHERE "attributionSource" IN ('KOBO_CONFLICT_AUDIT','LEGACY_HOLD_UPDATED_AT','REVIEWED_MAPPING');
