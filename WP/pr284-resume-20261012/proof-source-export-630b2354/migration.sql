-- #200 additive instrument templates and retained source receipts; no data backfill.
CREATE TABLE "ImportTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "mapping" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersedesId" TEXT,
    CONSTRAINT "ImportTemplate_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "ImportTemplate_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "EquipmentAsset" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "ImportTemplate_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "ImportTemplate" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE "InstrumentImportReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "labId" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "mappingSnapshot" TEXT NOT NULL,
    "importedBy" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstrumentImportReceipt_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "InstrumentImportReceipt_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "EquipmentAsset" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "InstrumentImportReceipt_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ImportTemplate" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX "ImportTemplate_supersedesId_key" ON "ImportTemplate"("supersedesId");

ALTER TABLE "WorkItemDraft" ADD COLUMN "importReceiptId" TEXT REFERENCES "InstrumentImportReceipt"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Contract guards
CREATE TRIGGER "ImportTemplate_insert_contract"
BEFORE INSERT ON "ImportTemplate"
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'IMPORT_TEMPLATE_INPUT_INVALID')
    WHERE trim(NEW."name") = '' OR trim(NEW."createdBy") = ''
       OR typeof(NEW."version") <> 'integer' OR NEW."version" < 1
       OR json_valid(NEW."mapping") <> 1;
    SELECT RAISE(ABORT, 'IMPORT_TEMPLATE_INSTRUMENT_MISMATCH')
    WHERE NOT EXISTS (
        SELECT 1 FROM "EquipmentAsset" e JOIN "Lab" l ON l."id" = NEW."labId"
        WHERE e."id" = NEW."instrumentId" AND e."labId" IN (l."id", l."code")
    );
    SELECT RAISE(ABORT, 'IMPORT_TEMPLATE_REVISION_INVALID')
    WHERE (NEW."supersedesId" IS NULL AND NEW."version" <> 1)
       OR (NEW."supersedesId" IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM "ImportTemplate" prior WHERE prior."id" = NEW."supersedesId"
             AND prior."labId" = NEW."labId" AND prior."instrumentId" = NEW."instrumentId"
             AND NEW."version" = prior."version" + 1
       ));
END;

CREATE TRIGGER "ImportTemplate_immutable_update"
BEFORE UPDATE ON "ImportTemplate"
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'IMPORT_TEMPLATE_IMMUTABLE');
END;

CREATE TRIGGER "ImportTemplate_immutable_delete"
BEFORE DELETE ON "ImportTemplate"
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'IMPORT_TEMPLATE_IMMUTABLE');
END;

CREATE TRIGGER "InstrumentImportReceipt_insert_contract"
BEFORE INSERT ON "InstrumentImportReceipt"
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'IMPORT_RECEIPT_INPUT_INVALID')
    WHERE length(NEW."sourceSha256") <> 64 OR NEW."sourceSha256" GLOB '*[^a-f0-9]*'
       OR trim(NEW."sourceName") = '' OR trim(NEW."importedBy") = ''
       OR json_valid(NEW."mappingSnapshot") <> 1;
    SELECT RAISE(ABORT, 'IMPORT_RECEIPT_TEMPLATE_MISMATCH')
    WHERE NOT EXISTS (
        SELECT 1 FROM "ImportTemplate" t WHERE t."id" = NEW."templateId"
          AND t."labId" = NEW."labId" AND t."instrumentId" = NEW."instrumentId"
          AND t."version" = NEW."templateVersion"
    );
END;

CREATE TRIGGER "InstrumentImportReceipt_immutable_update"
BEFORE UPDATE ON "InstrumentImportReceipt"
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'IMPORT_RECEIPT_IMMUTABLE');
END;

CREATE TRIGGER "InstrumentImportReceipt_immutable_delete"
BEFORE DELETE ON "InstrumentImportReceipt"
FOR EACH ROW
BEGIN
    SELECT RAISE(ABORT, 'IMPORT_RECEIPT_IMMUTABLE');
END;
