-- #206: additive physical container identities; no historical aliquot backfill.
CREATE TABLE "SampleContainer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "parentId" TEXT,
    "kind" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "massG" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "storageLocationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "SampleContainer_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SampleContainer_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SampleContainer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SampleContainer_code_key" ON "SampleContainer"("code");
CREATE INDEX "SampleContainer_sampleId_idx" ON "SampleContainer"("sampleId");
CREATE INDEX "SampleContainer_parentId_idx" ON "SampleContainer"("parentId");
-- Separate additive counter avoids gaps in the historical SAMPLE namespace.
-- This guarded allocator table is managed by the receipt installer, not db push.
CREATE TABLE "ContainerSequence" (
    "labId" TEXT NOT NULL,
    "year" INTEGER NOT NULL CHECK ("year" >= 0),
    "next" INTEGER NOT NULL DEFAULT 1 CHECK ("next" >= 1),
    PRIMARY KEY ("labId", "year")
);

-- Contract guards
CREATE TRIGGER "SampleContainer_validate_insert" BEFORE INSERT ON "SampleContainer"
WHEN NEW."kind" NOT IN ('BULK','FINE_EARTH','GROUND','ALIQUOT','ARCHIVE')
 OR NEW."status" <> 'ACTIVE' OR NEW."storageLocationId" IS NOT NULL
 OR length(trim(NEW."id")) = 0 OR length(trim(NEW."code")) = 0
 OR length(trim(NEW."createdBy")) = 0 OR upper(trim(NEW."createdBy")) IN ('SYSTEM','UNKNOWN')
 OR (NEW."massG" IS NOT NULL AND (typeof(NEW."massG") NOT IN ('integer','real') OR NEW."massG" <= 0 OR NEW."massG" > 1.7976931348623157e308))
 OR (NEW."parentId" IS NULL AND NEW."kind" <> 'BULK')
 OR (NEW."parentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "SampleContainer" parent
     WHERE parent."id" = NEW."parentId" AND parent."sampleId" = NEW."sampleId" AND parent."status" = 'ACTIVE'))
 OR EXISTS (SELECT 1 FROM "Sample" sample WHERE NEW."code" IN (sample."id",sample."originalId",sample."labId",sample."labSampleCode"))
BEGIN
 SELECT RAISE(ABORT, 'SAMPLE_CONTAINER_INVALID');
END;
-- Identity and parentage stay append-only. #207/#208 need a reviewed successor
-- for custody/lifecycle changes; neither workflow is silently enabled here.
CREATE TRIGGER "SampleContainer_no_update" BEFORE UPDATE ON "SampleContainer"
BEGIN
 SELECT RAISE(ABORT, 'SAMPLE_CONTAINER_IMMUTABLE');
END;
CREATE TRIGGER "SampleContainer_no_delete" BEFORE DELETE ON "SampleContainer"
BEGIN
 SELECT RAISE(ABORT, 'SAMPLE_CONTAINER_IMMUTABLE');
END;
-- The existing nullable attempt column is retained byte-for-byte. Only new
-- attempts can acquire a same-sample physical aliquot; #191 still freezes it.
CREATE TRIGGER "WorkAttempt_aliquot_insert" BEFORE INSERT ON "WorkAttempt"
WHEN NEW."aliquotId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "SampleContainer" container
 JOIN "WorkItem" work ON work."sampleId" = container."sampleId"
 WHERE work."id" = NEW."workItemId" AND container."id" = NEW."aliquotId"
 AND container."kind" = 'ALIQUOT' AND container."status" = 'ACTIVE')
BEGIN
 SELECT RAISE(ABORT, 'SAMPLE_CONTAINER_ALIQUOT_INVALID');
END;
