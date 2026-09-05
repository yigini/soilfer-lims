const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve(__dirname, '..', 'prisma', 'dev.db');
console.log(`[P2 Migration] Applying DDL to: ${dbPath}`);
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS "SampleOrderRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT,
    "requestedBy" TEXT,
    "authorizedBy" TEXT,
    "authorizedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SampleOrderRevision_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SampleOrderRevision_sampleId_version_key" ON "SampleOrderRevision"("sampleId", "version");
CREATE INDEX IF NOT EXISTS "SampleOrderRevision_sampleId_idx" ON "SampleOrderRevision"("sampleId");

CREATE TABLE IF NOT EXISTS "OrderLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "revisionId" TEXT NOT NULL,
    "analysis" TEXT NOT NULL,
    "methodologyId" TEXT,
    "methodRevision" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "omissionReason" TEXT,
    "omissionAuthorizedBy" TEXT,
    "omissionAuthorizedAt" DATETIME,
    "predecessorLineId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderLine_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "SampleOrderRevision" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "OrderLine_revisionId_idx" ON "OrderLine"("revisionId");
CREATE INDEX IF NOT EXISTS "OrderLine_analysis_idx" ON "OrderLine"("analysis");

CREATE TABLE IF NOT EXISTS "WorkAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workItemId" TEXT NOT NULL,
    "orderLineId" TEXT,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "executedMethodRevision" TEXT,
    "author" TEXT,
    "authorName" TEXT,
    "materialAliquot" TEXT,
    "instrumentId" TEXT,
    "qcBatchId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "evidenceHash" TEXT,
    "evidenceData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkAttempt_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkAttempt_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "WorkAttempt_workItemId_idx" ON "WorkAttempt"("workItemId");
CREATE INDEX IF NOT EXISTS "WorkAttempt_orderLineId_idx" ON "WorkAttempt"("orderLineId");

CREATE TABLE IF NOT EXISTS "ReviewDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "workItemId" TEXT,
    "submissionItemId" TEXT,
    "attemptId" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "evidenceVersion" INTEGER,
    "evidenceHash" TEXT,
    "reviewerId" TEXT NOT NULL,
    "reviewerName" TEXT,
    "authorization" TEXT,
    "policyVersion" TEXT DEFAULT 'v1',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewDecision_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewDecision_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ReviewDecision_sampleId_idx" ON "ReviewDecision"("sampleId");
CREATE INDEX IF NOT EXISTS "ReviewDecision_workItemId_idx" ON "ReviewDecision"("workItemId");

CREATE TABLE IF NOT EXISTS "SampleAmendment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sampleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT NOT NULL,
    "affectedOrderLines" TEXT,
    "affectedResults" TEXT,
    "affectedReports" TEXT,
    "impactAssessment" TEXT,
    "authorizedBy" TEXT,
    "authorizedAt" DATETIME,
    "resolution" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SampleAmendment_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SampleAmendment_sampleId_idx" ON "SampleAmendment"("sampleId");

CREATE TABLE IF NOT EXISTS "CommandReceipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "idempotencyKey" TEXT NOT NULL,
    "commandType" TEXT NOT NULL,
    "targetResource" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "outcome" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CommandReceipt_idempotencyKey_key" ON "CommandReceipt"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CommandReceipt_idempotencyKey_idx" ON "CommandReceipt"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CommandReceipt_actor_idx" ON "CommandReceipt"("actor");

CREATE UNIQUE INDEX IF NOT EXISTS "Report_sampleId_version_key" ON "Report"("sampleId", "version");
`);

console.log('✅ Package P2 DDL applied successfully!');
db.close();
