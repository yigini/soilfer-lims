const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { assertOwnedTestDatabase } = require('./testOwnedDatabase');

// Legacy values are inserted into a new schema before its real additive guards
// are installed. Existing constraints are never dropped, disabled or bypassed.
function beforeGuards({ actor, file = path.resolve(__dirname, '../.tmp', `audit_legacy_${randomUUID()}.db`), samples = [], workItems = [], batches = [], preMigrationSnapshot = false }) {
    file = assertOwnedTestDatabase(file, actor);
    if (![samples, workItems, batches].every(Array.isArray)) throw new Error('Legacy fixture rows must be declarative arrays.');
    // Exclusive creation makes a reused file fail before any database is opened.
    fs.closeSync(fs.openSync(file, 'wx'));
    const source = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
    const tables = source.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' AND name != 'ResultEvidenceEvent'").all();
    const indexes = source.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL AND tbl_name != 'ResultEvidenceEvent'").all();
    source.close();
    let db = new Database(file), snapshot = null;
    try {
        db.pragma('foreign_keys = ON');
        for (const table of tables) db.exec(['Sample', 'WorkItem'].includes(table.name)
            ? table.sql.replace(/,\s*"(?:holdPriorStatus|legacyStatus)"\s+TEXT(?=\s*[,)])/g, '') : table.sql);
        for (const index of indexes) db.exec(index.sql);
        if (db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all().length) throw new Error('Legacy fixture must have no release guards before inserting.');
        for (const table of tables) if (db.prepare(`SELECT COUNT(*) AS count FROM "${table.name}"`).get().count !== 0) {
            throw new Error('Legacy fixture must be a fresh schema-only file.');
        }
        for (const [table, rows] of [['Sample', samples], ['Batch', batches], ['WorkItem', workItems]]) {
            const columns = new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map(column => column.name));
            for (const row of rows) {
                const fields = Object.keys(row);
                if (!fields.length || fields.some(field => !columns.has(field) || !/^[A-Za-z][A-Za-z0-9_]*$/.test(field))) {
                    throw new Error('Unknown legacy fixture column.');
                }
                const values = fields.map(field => row[field] instanceof Date ? row[field].getTime() : row[field]);
                db.prepare(`INSERT INTO "${table}" (${fields.map(field => `"${field}"`).join(',')}) VALUES (${fields.map(() => '?').join(',')})`).run(...values);
            }
        }
        if (preMigrationSnapshot) {
            db.close();
            for (const suffix of ['-wal', '-shm', '-journal']) if (fs.existsSync(`${file}${suffix}`)) {
                throw new Error('A pre-migration snapshot requires a closed file without sidecars.');
            }
            const snapshotPath = assertOwnedTestDatabase(`${file}.pre-migration.db`, actor);
            fs.copyFileSync(file, snapshotPath, fs.constants.COPYFILE_EXCL);
            fs.chmodSync(snapshotPath, 0o444);
            snapshot = { path: snapshotPath, sha256: createHash('sha256').update(fs.readFileSync(snapshotPath)).digest('hex') };
            db = new Database(file, { fileMustExist: true });
            db.pragma('foreign_keys = ON');
        }
        for (const name of ['20261005000000_workflow_state_evidence', '20261005000100_workflow_state_guards']) {
            db.exec(fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations', name, 'migration.sql'), 'utf8'));
        }
        const guardSql = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261005000100_workflow_state_guards/migration.sql'), 'utf8');
        const installed = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all().map(row => row.name));
        for (const match of guardSql.matchAll(/CREATE TRIGGER "([^"]+)"/g)) {
            if (!installed.has(match[1])) throw new Error(`Missing release guard ${match[1]}`);
        }
    } finally { if (db.open) db.close(); }
    return { file, preMigrationSnapshot: snapshot };
}

async function createLegacyClosureDatabase({ analysis, labId, samples = [], workItems = [], batches = [], preMigrationSnapshot = false }) {
    const sampleId = randomUUID(), workItemId = randomUUID(), now = Date.now();
    const database = beforeGuards({ actor: 'system:fixture', preMigrationSnapshot, batches, samples: [
        { id: sampleId, originalId: sampleId, status: 'APPROVED', assignedLab: labId, dryingStatus: 'DONE',
            preparationStatus: 'DONE', createdAt: now, updatedAt: now }, ...samples], workItems: [
        { id: workItemId, sampleId, analysis, status: 'PENDING', assignedLab: labId, result: '6.2', history: '[]',
            createdAt: now, updatedAt: now }, ...workItems.map(row => ({ ...row, sampleId: row.sampleId || sampleId }))] });
    const { file } = database;
    const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
    await client.lab.create({ data: { id: labId, code: labId, name: 'Isolated legacy test laboratory', country: 'TEST' } });
    return { client, file, sampleId, workItemId, preMigrationSnapshot: database.preMigrationSnapshot, async close() {
        await client.$disconnect();
        const owned = path.resolve(__dirname, '../.tmp');
        if (path.dirname(file) !== owned || !path.basename(file).startsWith('audit_legacy_')) throw new Error('Invalid legacy fixture path.');
        for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${file}${suffix}`, { force: true });
        if (database.preMigrationSnapshot) {
            const snapshotFile = assertOwnedTestDatabase(database.preMigrationSnapshot.path, 'system:fixture');
            fs.chmodSync(snapshotFile, 0o600);
            fs.rmSync(snapshotFile);
        }
    } };
}

// Redirect only the existing route's database dependency. Every query and write
// still executes against real Prisma/SQLite with the actual release triggers.
function useLegacyRouteDatabase(prisma, client) {
    jest.spyOn(prisma, '$transaction').mockImplementation((...args) => client.$transaction(...args));
    const methods = {
        sample: ['findUnique', 'findMany', 'count', 'create', 'update', 'updateMany'],
        workItem: ['findUnique', 'findMany', 'count', 'create', 'update', 'updateMany'],
        result: ['findUnique', 'findFirst', 'findMany', 'count', 'create', 'update'],
        report: ['findUnique', 'findMany', 'count', 'create'],
        spectralData: ['findUnique', 'findFirst', 'findMany', 'count', 'create', 'update', 'updateMany'],
        reviewDecision: ['create', 'findMany', 'count'],
        auditLog: ['create', 'findMany', 'findFirst', 'count'],
        submission: ['create', 'findUnique', 'update'],
        batch: ['findUnique', 'findMany', 'count', 'create', 'update', 'updateMany'],
        batchQcResult: ['findMany', 'count']
    };
    for (const [model, names] of Object.entries(methods)) for (const name of names) {
        jest.spyOn(prisma[model], name).mockImplementation(args => client[model][name](args));
    }
}

module.exports = { beforeGuards, createLegacyClosureDatabase, useLegacyRouteDatabase };
