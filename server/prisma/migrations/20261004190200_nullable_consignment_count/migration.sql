-- Disable foreign keys BEFORE BEGIN so dropping the parent cannot null Sample.consignmentId.
-- Release preflight must stop on duplicate WorkItems or unrecognized consignment schema.
PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;
CREATE TEMP TABLE "_intake_schema_guard" ("ok" INTEGER NOT NULL CHECK ("ok" = 1));
INSERT INTO "_intake_schema_guard" VALUES ((SELECT COUNT(*) FROM pragma_table_info('Consignment') WHERE name IN ('id', 'code', 'labId', 'projectCode', 'submitterName', 'submitterOrg', 'submitterPhone', 'submitterEmail', 'deliveredBy', 'deliveredAt', 'receivedBy', 'receivedAt', 'deliveryNoteRef', 'expectedCount', 'sampleCount', 'acceptedCount', 'rejectedCount', 'status', 'custodyHandoverAt', 'custodyCarrierName', 'custodyTrackingNumber', 'custodySenderSignature', 'receivingOfficerId', 'receivingOfficerName', 'receivingOfficerSignature', 'notes', 'metadata', 'createdAt', 'updatedAt')) = 29 AND (SELECT COUNT(*) FROM pragma_table_info('Consignment')) = 29);
-- Preserve every known index. Refuse extra/custom schema instead of dropping it.
INSERT INTO "_intake_schema_guard" VALUES ((SELECT COUNT(*) FROM sqlite_master WHERE tbl_name = 'Consignment' AND type = 'index' AND sql IS NOT NULL AND name NOT IN ('Consignment_code_key', 'Consignment_labId_idx', 'Consignment_projectCode_idx')) = 0);
INSERT INTO "_intake_schema_guard" VALUES ((SELECT COUNT(*) FROM sqlite_master WHERE tbl_name = 'Consignment' AND type = 'trigger') = 0 AND (SELECT COUNT(*) FROM pragma_foreign_key_list('Consignment')) = 0);
CREATE TABLE "new_Consignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "projectCode" TEXT,
    "submitterName" TEXT,
    "submitterOrg" TEXT,
    "submitterPhone" TEXT,
    "submitterEmail" TEXT,
    "deliveredBy" TEXT,
    "deliveredAt" DATETIME,
    "receivedBy" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryNoteRef" TEXT,
    "expectedCount" INTEGER,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "custodyHandoverAt" DATETIME,
    "custodyCarrierName" TEXT,
    "custodyTrackingNumber" TEXT,
    "custodySenderSignature" TEXT,
    "receivingOfficerId" TEXT,
    "receivingOfficerName" TEXT,
    "receivingOfficerSignature" TEXT,
    "notes" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Consignment" ("id", "code", "labId", "projectCode", "submitterName", "submitterOrg", "submitterPhone", "submitterEmail", "deliveredBy", "deliveredAt", "receivedBy", "receivedAt", "deliveryNoteRef", "expectedCount", "sampleCount", "acceptedCount", "rejectedCount", "status", "custodyHandoverAt", "custodyCarrierName", "custodyTrackingNumber", "custodySenderSignature", "receivingOfficerId", "receivingOfficerName", "receivingOfficerSignature", "notes", "metadata", "createdAt", "updatedAt") SELECT "id", "code", "labId", "projectCode", "submitterName", "submitterOrg", "submitterPhone", "submitterEmail", "deliveredBy", "deliveredAt", "receivedBy", "receivedAt", "deliveryNoteRef", "expectedCount", "sampleCount", "acceptedCount", "rejectedCount", "status", "custodyHandoverAt", "custodyCarrierName", "custodyTrackingNumber", "custodySenderSignature", "receivingOfficerId", "receivingOfficerName", "receivingOfficerSignature", "notes", "metadata", "createdAt", "updatedAt" FROM "Consignment";
INSERT INTO "_intake_schema_guard" VALUES ((SELECT COUNT(*) FROM "new_Consignment") = (SELECT COUNT(*) FROM "Consignment"));
DROP TABLE "Consignment";
ALTER TABLE "new_Consignment" RENAME TO "Consignment";
CREATE UNIQUE INDEX "Consignment_code_key" ON "Consignment"("code");
CREATE INDEX "Consignment_labId_idx" ON "Consignment"("labId");
CREATE INDEX "Consignment_projectCode_idx" ON "Consignment"("projectCode");
INSERT INTO "_intake_schema_guard" VALUES ((SELECT COUNT(*) FROM pragma_foreign_key_check) = 0);
DROP TABLE "_intake_schema_guard";
COMMIT;
PRAGMA foreign_keys = ON;
