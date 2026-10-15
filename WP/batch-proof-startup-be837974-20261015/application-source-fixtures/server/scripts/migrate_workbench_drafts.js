/**
 * Migration script for Technician Workbench Redesign: WorkItemDraft Table
 * Creates the WorkItemDraft table with foreign key and indices in SQLite.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace('file:', '')
    : path.join(__dirname, '..', 'prisma', 'dev.db');

console.log('[MIGRATE-DRAFTS] Running WorkItemDraft schema migration on:', dbPath);

if (!fs.existsSync(dbPath)) {
    console.error(`[MIGRATE-DRAFTS] Database file does not exist at ${dbPath}`);
    process.exit(1);
}

const db = new Database(dbPath);

try {
    db.exec(`
        CREATE TABLE IF NOT EXISTS "WorkItemDraft" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "workItemId" TEXT NOT NULL UNIQUE,
            "sampleId" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "labId" TEXT,
            "analysis" TEXT NOT NULL,
            "value" TEXT,
            "values" TEXT,
            "checks" TEXT,
            "basis" TEXT DEFAULT 'AIR_DRY',
            "replicateNo" INTEGER NOT NULL DEFAULT 1,
            "instrumentId" TEXT,
            "methodologyId" TEXT,
            "notes" TEXT,
            "baseVersion" INTEGER NOT NULL DEFAULT 0,
            "draftVersion" INTEGER NOT NULL DEFAULT 1,
            "conflictValue" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "WorkItemDraft_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );

        CREATE INDEX IF NOT EXISTS "WorkItemDraft_userId_labId_idx" ON "WorkItemDraft"("userId", "labId");
        CREATE INDEX IF NOT EXISTS "WorkItemDraft_sampleId_analysis_idx" ON "WorkItemDraft"("sampleId", "analysis");
    `);

    console.log('[MIGRATE-DRAFTS] ✓ WorkItemDraft table and indices created successfully.');
} catch (err) {
    console.error('[MIGRATE-DRAFTS] ❌ Migration failed:', err.message);
    process.exit(1);
} finally {
    db.close();
}
