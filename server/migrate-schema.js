/**
 * One-time migration to add missing columns and tables.
 * Run inside Docker: node server/migrate-schema.js
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace('file:', '')
    : path.join(__dirname, 'prisma', 'dev.db');

console.log(`[migrate-schema] Using DB: ${dbPath}`);
const db = new Database(dbPath);

// Helper to check if a column exists
function columnExists(table, column) {
    const info = db.prepare(`PRAGMA table_info("${table}")`).all();
    return info.some(c => c.name === column);
}

// Helper to check if a table exists
function tableExists(table) {
    const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
    return !!row;
}

const migrations = [];

// --- Language table: add isActive column if missing ---
if (tableExists('Language') && !columnExists('Language', 'isActive')) {
    db.exec(`ALTER TABLE "Language" ADD COLUMN "isActive" BOOLEAN DEFAULT 1`);
    migrations.push('Language.isActive added');
}

// --- Report table ---
if (!tableExists('Report')) {
    db.exec(`
        CREATE TABLE "Report" (
            "id" TEXT PRIMARY KEY NOT NULL,
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
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX "Report_sampleId_idx" ON "Report"("sampleId");
        CREATE INDEX "Report_labId_idx" ON "Report"("labId");
        CREATE INDEX "Report_status_idx" ON "Report"("status");
        CREATE INDEX "Report_projectCode_idx" ON "Report"("projectCode");
        CREATE INDEX "Report_sampleLabId_idx" ON "Report"("sampleLabId");
    `);
    migrations.push('Report table created');
}

// --- ReportShareLink table ---
if (!tableExists('ReportShareLink')) {
    db.exec(`
        CREATE TABLE "ReportShareLink" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "reportId" TEXT NOT NULL,
            "tokenHash" TEXT NOT NULL UNIQUE,
            "expiresAt" DATETIME,
            "isRevoked" BOOLEAN NOT NULL DEFAULT 0,
            "createdBy" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "revokedAt" DATETIME,
            "revokedBy" TEXT,
            FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE
        );
        CREATE INDEX "ReportShareLink_reportId_idx" ON "ReportShareLink"("reportId");
    `);
    migrations.push('ReportShareLink table created');
}

// --- ReportAccessLog table ---
if (!tableExists('ReportAccessLog')) {
    db.exec(`
        CREATE TABLE "ReportAccessLog" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "linkId" TEXT NOT NULL,
            "accessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "ipAddress" TEXT,
            "userAgent" TEXT,
            FOREIGN KEY ("linkId") REFERENCES "ReportShareLink"("id") ON DELETE CASCADE
        );
        CREATE INDEX "ReportAccessLog_linkId_idx" ON "ReportAccessLog"("linkId");
    `);
    migrations.push('ReportAccessLog table created');
}

// --- OperationalGate table ---
if (!tableExists('OperationalGate')) {
    db.exec(`
        CREATE TABLE "OperationalGate" (
            "id" TEXT PRIMARY KEY NOT NULL,
            "code" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            "labId" TEXT,
            "isActive" BOOLEAN NOT NULL DEFAULT 1
        );
        CREATE UNIQUE INDEX "OperationalGate_code_labId_key" ON "OperationalGate"("code", "labId");
    `);
    migrations.push('OperationalGate table created');
}

if (migrations.length === 0) {
    console.log('[migrate-schema] ✓ All tables and columns already exist. Nothing to do.');
} else {
    console.log(`[migrate-schema] ✓ Applied ${migrations.length} migration(s):`);
    migrations.forEach(m => console.log(`  - ${m}`));
}

db.close();
