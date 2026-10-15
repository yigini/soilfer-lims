/**
 * Migration script for Stage C: RC-12 Consignment Data Model
 * Adds Consignment table and consignmentId column on Sample in SQLite
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace('file:', '')
    : path.join(__dirname, '..', 'prisma', 'dev.db');

console.log('[MIGRATE-C] Running Stage C schema migration on:', dbPath);

if (!fs.existsSync(dbPath)) {
    console.error(`[MIGRATE-C] Database file does not exist at ${dbPath}`);
    process.exit(1);
}

const db = new Database(dbPath);

try {
    // 1. Create Consignment table if not exists
    db.exec(`
        CREATE TABLE IF NOT EXISTS "Consignment" (
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
            "expectedCount" INTEGER NOT NULL DEFAULT 0,
            "sampleCount" INTEGER NOT NULL DEFAULT 0,
            "acceptedCount" INTEGER NOT NULL DEFAULT 0,
            "rejectedCount" INTEGER NOT NULL DEFAULT 0,
            "status" TEXT NOT NULL DEFAULT 'RECEIVED',
            "notes" TEXT,
            "metadata" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "Consignment_code_key" ON "Consignment"("code");
        CREATE INDEX IF NOT EXISTS "Consignment_labId_idx" ON "Consignment"("labId");
        CREATE INDEX IF NOT EXISTS "Consignment_projectCode_idx" ON "Consignment"("projectCode");
    `);
    console.log('  + Ensured Consignment table and indexes exist.');

    // 2. Add consignmentId to Sample if not exists
    const sampleCols = db.pragma('table_info(Sample)');
    const hasConsignmentId = sampleCols.some(c => c.name === 'consignmentId');

    if (!hasConsignmentId) {
        db.exec(`
            ALTER TABLE "Sample" ADD COLUMN "consignmentId" TEXT REFERENCES "Consignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
            CREATE INDEX IF NOT EXISTS "Sample_consignmentId_idx" ON "Sample"("consignmentId");
        `);
        console.log('  + Added Sample.consignmentId column and index.');
    } else {
        console.log('  ✓ Sample.consignmentId column already exists.');
    }

    console.log('[MIGRATE-C] Stage C migration completed successfully.');
} catch (err) {
    console.error('[MIGRATE-C] Migration failed:', err);
    process.exit(1);
} finally {
    db.close();
}
