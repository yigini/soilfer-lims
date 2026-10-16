-- #208: additive immutable print requests; no historical prints are inferred.
CREATE TABLE "LabelPrintEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "containerId" TEXT,
    "code" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "reason" TEXT,
    "by" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabelPrintEvent_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LabelPrintEvent_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "SampleContainer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LabelPrintEvent_entity_entityId_ordinal_key" ON "LabelPrintEvent"("entity", "entityId", "ordinal");
CREATE INDEX "LabelPrintEvent_sampleId_idx" ON "LabelPrintEvent"("sampleId");
CREATE INDEX "LabelPrintEvent_containerId_idx" ON "LabelPrintEvent"("containerId");

-- Contract guards
CREATE TRIGGER "LabelPrintEvent_validate_insert" BEFORE INSERT ON "LabelPrintEvent"
WHEN NEW."entity" NOT IN ('SAMPLE','CONTAINER') OR NEW."format" NOT IN ('STANDARD','COMPACT')
 OR typeof(NEW."count") <> 'integer' OR NEW."count" < 1 OR NEW."count" > 20
 OR typeof(NEW."ordinal") <> 'integer' OR NEW."ordinal" <> 1 + COALESCE((SELECT max("ordinal") FROM "LabelPrintEvent" WHERE "entity"=NEW."entity" AND "entityId"=NEW."entityId"),0)
 OR length(trim(NEW."id"))=0 OR length(trim(NEW."by"))=0 OR upper(trim(NEW."by")) IN ('SYSTEM','UNKNOWN')
 OR length(trim(NEW."code"))=0 OR length(NEW."code")>128 OR NEW."code" GLOB '*[^ -~]*'
 OR NEW."at" IS NULL
 OR (NEW."reason" IS NOT NULL AND (length(trim(NEW."reason"))=0 OR length(NEW."reason")>1000))
 OR (NEW."ordinal">1 AND (NEW."reason" IS NULL OR length(trim(NEW."reason"))=0))
 OR NOT EXISTS (SELECT 1 FROM "Sample" s WHERE s."id"=NEW."sampleId" AND s."status" NOT IN ('REJECTED','RECEIVED_REJECTED','DISPOSED'))
 OR (NEW."entity"='SAMPLE' AND (NEW."containerId" IS NOT NULL OR NEW."entityId"<>NEW."sampleId"
     OR NOT EXISTS (SELECT 1 FROM "Sample" s WHERE s."id"=NEW."sampleId" AND NEW."code"=COALESCE(NULLIF(s."labSampleCode",''),s."labId"))))
 OR (NEW."entity"='CONTAINER' AND (NEW."containerId" IS NULL OR NEW."entityId"<>NEW."containerId"
     OR NOT EXISTS (SELECT 1 FROM "SampleContainer" c WHERE c."id"=NEW."entityId" AND c."sampleId"=NEW."sampleId" AND c."code"=NEW."code" AND c."status"='ACTIVE')))
BEGIN
 SELECT RAISE(ABORT, 'LABEL_PRINT_EVENT_INVALID');
END;
CREATE TRIGGER "LabelPrintEvent_no_update" BEFORE UPDATE ON "LabelPrintEvent"
BEGIN
 SELECT RAISE(ABORT, 'LABEL_PRINT_EVENT_IMMUTABLE');
END;
CREATE TRIGGER "LabelPrintEvent_no_delete" BEFORE DELETE ON "LabelPrintEvent"
BEGIN
 SELECT RAISE(ABORT, 'LABEL_PRINT_EVENT_IMMUTABLE');
END;
