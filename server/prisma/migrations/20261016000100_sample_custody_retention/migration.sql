-- #207: additive custody and policy-derived retention. Old evidence is retained.
ALTER TABLE "Sample" ADD COLUMN "retainUntil" DATETIME;
ALTER TABLE "InventoryLocation" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'REAGENT';

CREATE TABLE "CustodyEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "sampleId" TEXT,
    "containerId" TEXT,
    "consignmentId" TEXT,
    "type" TEXT NOT NULL,
    "fromLocationId" TEXT,
    "toLocationId" TEXT,
    "by" TEXT NOT NULL,
    "actorId" TEXT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'LIVE',
    "acknowledgement" BOOLEAN NOT NULL DEFAULT true,
    "counterparty" TEXT,
    "reference" TEXT,
    "evidence" TEXT,
    CONSTRAINT "CustodyEvent_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "CustodyEvent_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "SampleContainer" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "CustodyEvent_consignmentId_fkey" FOREIGN KEY ("consignmentId") REFERENCES "Consignment" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "CustodyEvent_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "InventoryLocation" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "CustodyEvent_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "InventoryLocation" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX "CustodyEvent_sampleId_at_idx" ON "CustodyEvent"("sampleId", "at");
CREATE INDEX "CustodyEvent_consignmentId_at_idx" ON "CustodyEvent"("consignmentId", "at");
CREATE INDEX "CustodyEvent_labId_at_idx" ON "CustodyEvent"("labId", "at");

-- Contract guards
CREATE TRIGGER "CustodyEvent_no_update" BEFORE UPDATE ON "CustodyEvent"
BEGIN
 SELECT RAISE(ABORT, 'CUSTODY_EVENT_IMMUTABLE');
END;
CREATE TRIGGER "CustodyEvent_no_delete" BEFORE DELETE ON "CustodyEvent"
BEGIN
 SELECT RAISE(ABORT, 'CUSTODY_EVENT_IMMUTABLE');
END;
CREATE TRIGGER "CustodyEvent_validate_insert" BEFORE INSERT ON "CustodyEvent"
WHEN NEW."type" NOT IN ('RECEIVED','MOVED','ISSUED','RETURNED','SENT_OUT','DISPOSED')
 OR NEW."source" NOT IN ('LIVE','LEGACY') OR length(trim(NEW."by")) = 0
 OR NEW."sampleId" IS NULL AND NEW."consignmentId" IS NULL
 OR NEW."containerId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "SampleContainer" c WHERE c."id" = NEW."containerId" AND c."sampleId" = NEW."sampleId")
 OR NEW."sampleId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Sample" s WHERE s."id" = NEW."sampleId" AND s."assignedLab" = NEW."labId")
 OR NEW."sampleId" IS NOT NULL AND NEW."consignmentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Sample" s WHERE s."id" = NEW."sampleId" AND s."consignmentId" = NEW."consignmentId")
 OR NEW."sampleId" IS NULL AND NEW."consignmentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Consignment" c WHERE c."id" = NEW."consignmentId" AND c."labId" = NEW."labId")
 OR NEW."fromLocationId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "InventoryLocation" l WHERE l."id" = NEW."fromLocationId" AND l."labId" = NEW."labId" AND l."purpose" = 'SAMPLE')
 OR NEW."toLocationId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "InventoryLocation" l WHERE l."id" = NEW."toLocationId" AND l."labId" = NEW."labId" AND l."purpose" = 'SAMPLE' AND l."isActive" = 1)
 OR NEW."source" = 'LIVE' AND (NEW."actorId" IS NULL OR length(trim(NEW."actorId")) = 0 OR NEW."acknowledgement" <> 1)
 OR NEW."source" = 'LIVE' AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = NEW."actorId" AND u."username" = NEW."by" AND u."isActive" = 1)
 OR NEW."source" = 'LIVE' AND NEW."type" IN ('MOVED','RETURNED') AND NEW."toLocationId" IS NULL
 OR NEW."source" = 'LEGACY' AND (NEW."type" <> 'RECEIVED' OR NEW."acknowledgement" <> 0)
 OR NEW."evidence" IS NOT NULL AND NOT json_valid(NEW."evidence")
BEGIN
 SELECT RAISE(ABORT, 'CUSTODY_EVENT_INVALID');
END;
CREATE UNIQUE INDEX "CustodyEvent_first_sample_receipt" ON "CustodyEvent"("sampleId") WHERE "type" = 'RECEIVED' AND "containerId" IS NULL AND "sampleId" IS NOT NULL;
CREATE UNIQUE INDEX "CustodyEvent_first_consignment_receipt" ON "CustodyEvent"("consignmentId") WHERE "type" = 'RECEIVED' AND "sampleId" IS NULL;
CREATE TRIGGER "InventoryLocation_purpose_insert" BEFORE INSERT ON "InventoryLocation"
WHEN NEW."purpose" NOT IN ('REAGENT','SAMPLE')
BEGIN
 SELECT RAISE(ABORT, 'CUSTODY_LOCATION_INVALID');
END;
CREATE TRIGGER "InventoryLocation_purpose_update" BEFORE UPDATE ON "InventoryLocation"
WHEN NEW."purpose" NOT IN ('REAGENT','SAMPLE') OR NEW."purpose" <> OLD."purpose" OR NEW."labId" <> OLD."labId"
BEGIN
 SELECT RAISE(ABORT, 'CUSTODY_LOCATION_INVALID');
END;
