const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

// Legacy values are inserted into a new schema before its real additive guards
// are installed. Existing constraints are never dropped, disabled or bypassed.
async function createLegacyClosureDatabase({ analysis, labId }) {
    if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_PATH) throw new Error('Legacy fixtures require the isolated test database.');
    const file = path.resolve(__dirname, '../.tmp', `audit_legacy_${randomUUID()}.db`);
    const source = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
    const tables = source.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' AND name != 'ResultEvidenceEvent'").all();
    const indexes = source.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL AND tbl_name != 'ResultEvidenceEvent'").all();
    source.close();
    const sampleId = randomUUID(), workItemId = randomUUID();
    const db = new Database(file);
    try {
        db.pragma('foreign_keys = ON');
        for (const table of tables) db.exec(['Sample', 'WorkItem'].includes(table.name)
            ? table.sql.replace(/,\s*"(?:holdPriorStatus|legacyStatus)"\s+TEXT(?=\s*[,)])/g, '') : table.sql);
        for (const index of indexes) db.exec(index.sql);
        const now = Date.now();
        db.prepare('INSERT INTO Sample (id, originalId, status, assignedLab, dryingStatus, preparationStatus, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)')
            .run(sampleId, sampleId, 'APPROVED', labId, 'DONE', 'DONE', now, now);
        db.prepare('INSERT INTO WorkItem (id, sampleId, analysis, status, assignedLab, result, history, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)')
            .run(workItemId, sampleId, analysis, 'PENDING', labId, '6.2', '[]', now, now);
        for (const name of ['20261005000000_workflow_state_evidence', '20261005000100_workflow_state_guards']) {
            db.exec(fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations', name, 'migration.sql'), 'utf8'));
        }
    } finally { db.close(); }
    const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
    await client.lab.create({ data: { id: labId, code: labId, name: 'Isolated legacy test laboratory', country: 'TEST' } });
    return { client, sampleId, workItemId, async close() {
        await client.$disconnect();
        const owned = path.resolve(__dirname, '../.tmp');
        if (path.dirname(file) !== owned || !path.basename(file).startsWith('audit_legacy_')) throw new Error('Invalid legacy fixture path.');
        for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${file}${suffix}`, { force: true });
    } };
}

// Redirect only the existing route's database dependency. Every query and write
// still executes against real Prisma/SQLite with the actual release triggers.
function useLegacyRouteDatabase(prisma, client) {
    jest.spyOn(prisma, '$transaction').mockImplementation((...args) => client.$transaction(...args));
    const methods = {
        sample: ['findUnique', 'create', 'update', 'updateMany'],
        workItem: ['findUnique', 'findMany', 'create', 'update', 'updateMany'],
        result: ['findUnique', 'findMany', 'create', 'update'],
        reviewDecision: ['create', 'findMany', 'count'],
        auditLog: ['create', 'findMany', 'findFirst', 'count'],
        submission: ['create', 'findUnique', 'update']
    };
    for (const [model, names] of Object.entries(methods)) for (const name of names) {
        jest.spyOn(prisma[model], name).mockImplementation(args => client[model][name](args));
    }
}

module.exports = { createLegacyClosureDatabase, useLegacyRouteDatabase };
