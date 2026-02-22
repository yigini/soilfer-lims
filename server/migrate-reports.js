// migrate-reports.js — Run inside Docker to add Report tables
// Usage: node migrate-reports.js

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'prisma', 'dev.db');
const db = new Database(dbPath);

console.log('Connected to:', dbPath);

// Check existing tables
const existing = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
console.log('Existing tables:', existing.length);

// Create Report table
if (!existing.includes('Report')) {
    db.exec(`
        CREATE TABLE "Report" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "sampleId" TEXT NOT NULL,
            "labId" TEXT,
            "version" INTEGER NOT NULL DEFAULT 1,
            "status" TEXT NOT NULL DEFAULT 'DRAFT',
            "firstName" TEXT,
            "surname" TEXT,
            "phone" TEXT,
            "phoneNorm" TEXT,
            "projectCode" TEXT,
            "projectName" TEXT,
            "sampleLabId" TEXT,
            "content" TEXT,
            "generatedBy" TEXT NOT NULL,
            "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "publishedAt" DATETIME,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL
        );
        CREATE INDEX "Report_sampleId_idx" ON "Report"("sampleId");
        CREATE INDEX "Report_labId_idx" ON "Report"("labId");
        CREATE INDEX "Report_status_idx" ON "Report"("status");
        CREATE INDEX "Report_projectCode_idx" ON "Report"("projectCode");
        CREATE INDEX "Report_sampleLabId_idx" ON "Report"("sampleLabId");
    `);
    console.log('✅ Created Report table');
} else {
    console.log('⏭️  Report table already exists');
}

// Create ReportShareLink table
if (!existing.includes('ReportShareLink')) {
    db.exec(`
        CREATE TABLE "ReportShareLink" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "reportId" TEXT NOT NULL,
            "tokenHash" TEXT NOT NULL,
            "expiresAt" DATETIME,
            "isRevoked" BOOLEAN NOT NULL DEFAULT 0,
            "createdBy" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "revokedAt" DATETIME,
            "revokedBy" TEXT,
            CONSTRAINT "ReportShareLink_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
        CREATE UNIQUE INDEX "ReportShareLink_tokenHash_key" ON "ReportShareLink"("tokenHash");
        CREATE INDEX "ReportShareLink_reportId_idx" ON "ReportShareLink"("reportId");
    `);
    console.log('✅ Created ReportShareLink table');
} else {
    console.log('⏭️  ReportShareLink table already exists');
}

// Create ReportAccessLog table
if (!existing.includes('ReportAccessLog')) {
    db.exec(`
        CREATE TABLE "ReportAccessLog" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "linkId" TEXT NOT NULL,
            "accessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "ipAddress" TEXT,
            "userAgent" TEXT,
            CONSTRAINT "ReportAccessLog_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "ReportShareLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
        CREATE INDEX "ReportAccessLog_linkId_idx" ON "ReportAccessLog"("linkId");
    `);
    console.log('✅ Created ReportAccessLog table');
} else {
    console.log('⏭️  ReportAccessLog table already exists');
}

// Verify
const finalTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Report%'").all();
console.log('\nReport tables:', finalTables.map(t => t.name));

db.close();
console.log('\n✅ Migration complete');
