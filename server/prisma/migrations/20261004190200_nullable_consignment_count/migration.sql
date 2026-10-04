-- Disable foreign keys BEFORE BEGIN so dropping the parent cannot null Sample.consignmentId.
-- Release preflight must stop on duplicate WorkItems or unrecognized consignment schema.
PRAGMA foreign_keys = OFF;
BEGIN IMMEDIATE;
CREATE TEMP TABLE "_intake_schema_guard" ("ok" INTEGER NOT NULL CHECK ("ok" = 1));
INSERT INTO "_intake_schema_guard" VALUES ((SELECT COUNT(*) FROM pragma_table_xinfo('Consignment')) = 29);
INSERT INTO "_intake_schema_guard" VALUES ((SELECT COUNT(*) FROM pragma_table_info('Consignment') WHERE name IN ('id', 'code', 'labId', 'projectCode', 'submitterName', 'submitterOrg', 'submitterPhone', 'submitterEmail', 'deliveredBy', 'deliveredAt', 'receivedBy', 'receivedAt', 'deliveryNoteRef', 'expectedCount', 'sampleCount', 'acceptedCount', 'rejectedCount', 'status', 'custodyHandoverAt', 'custodyCarrierName', 'custodyTrackingNumber', 'custodySenderSignature', 'receivingOfficerId', 'receivingOfficerName', 'receivingOfficerSignature', 'notes', 'metadata', 'createdAt', 'updatedAt')) = 29 AND (SELECT COUNT(*) FROM pragma_table_info('Consignment')) = 29);
-- Preserve every known index. Refuse extra/custom schema instead of dropping it.
INSERT INTO "_intake_schema_guard" VALUES ((SELECT COUNT(*) FROM sqlite_master WHERE tbl_name = 'Consignment' AND type = 'index' AND sql IS NOT NULL AND name NOT IN ('Consignment_code_key', 'Consignment_labId_idx', 'Consignment_projectCode_idx')) = 0);
INSERT INTO "_intake_schema_guard" VALUES ((SELECT COUNT(*) FROM pragma_index_list('Consignment') WHERE origin != 'pk' AND name NOT IN ('Consignment_code_key', 'Consignment_labId_idx', 'Consignment_projectCode_idx')) = 0);
INSERT INTO "_intake_schema_guard" VALUES ((SELECT COUNT(*) FROM pragma_index_info('Consignment_code_key')) = 1 AND (SELECT name FROM pragma_index_info('Consignment_code_key')) = 'code' AND (SELECT "unique" FROM pragma_index_list('Consignment') WHERE name = 'Consignment_code_key') = 1);
INSERT INTO "_intake_schema_guard" VALUES ((SELECT COUNT(*) FROM pragma_index_info('Consignment_labId_idx')) = 1 AND (SELECT name FROM pragma_index_info('Consignment_labId_idx')) = 'labId');
INSERT INTO "_intake_schema_guard" VALUES ((SELECT COUNT(*) FROM pragma_index_info('Consignment_projectCode_idx')) = 1 AND (SELECT name FROM pragma_index_info('Consignment_projectCode_idx')) = 'projectCode');
INSERT INTO "_intake_schema_guard" VALUES ((SELECT COUNT(*) FROM pragma_index_xinfo('Consignment_code_key') WHERE "key" = 1 AND (coll != 'BINARY' OR "desc" != 0)) = 0 AND (SELECT COUNT(*) FROM pragma_index_xinfo('Consignment_labId_idx') WHERE "key" = 1 AND (coll != 'BINARY' OR "desc" != 0)) = 0 AND (SELECT COUNT(*) FROM pragma_index_xinfo('Consignment_projectCode_idx') WHERE "key" = 1 AND (coll != 'BINARY' OR "desc" != 0)) = 0);
INSERT INTO "_intake_schema_guard" VALUES ((SELECT COUNT(*) FROM sqlite_master WHERE tbl_name = 'Consignment' AND type = 'trigger') = 0 AND (SELECT COUNT(*) FROM pragma_foreign_key_list('Consignment')) = 0);
INSERT INTO "_intake_schema_guard" VALUES ((SELECT COUNT(*) FROM pragma_index_list('Consignment') WHERE name IN ('Consignment_code_key', 'Consignment_labId_idx', 'Consignment_projectCode_idx') AND (partial != 0 OR "unique" != (name = 'Consignment_code_key'))) = 0);
-- A custom column collation or CHECK constraint needs its own reviewed migration.
INSERT INTO "_intake_schema_guard" VALUES ((SELECT instr(replace(replace(replace(replace(lower(sql), ' ', ''), char(9), ''), char(10), ''), char(13), ''), 'check(') = 0 AND instr(lower(sql), 'collate') = 0 FROM sqlite_master WHERE type = 'table' AND name = 'Consignment'));
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
INSERT INTO "_intake_schema_guard" VALUES ((SELECT COUNT(*) FROM pragma_table_info('Consignment') c JOIN pragma_table_info('new_Consignment') n ON c.name = n.name WHERE c.name != 'expectedCount' AND (c.type != n.type OR c."notnull" != n."notnull" OR c.pk != n.pk OR c.dflt_value IS NOT n.dflt_value)) = 0);
INSERT INTO "_intake_schema_guard" VALUES ((SELECT type = 'INTEGER' AND "notnull" = 1 AND dflt_value = '0' FROM pragma_table_info('Consignment') WHERE name = 'expectedCount'));
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
