const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const assert = require('node:assert/strict');
const { PrismaClient, Prisma } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { assertOwnedTestDatabase } = require('./testOwnedDatabase');

// #179 pins 5987778735, 5987866354 and 5987967145. The literal baseline is
// deployed pre-1.1 main eb273f4, byte-identical to c50415b; no schema is invented.
const PRE11_SHA256 = 'ff776730ff70102f018c3a02af76534ada332f2f4484600bde069b45c92f0513';
const PROJECT_SHAPE_SHA256 = '0915342087544cde959571f2d2bc9fc4ecf2825c400cc4ad1f17066fbb121115';
const PROJECT_MIGRATION_SHA256 = '3e63e37f4bce011c6d80efa5329f810ceffb9d5ff96653a406f90d818202e123';
// #179 pins 5988872290 / 5989464829: the closed, evidenced completion of
// the lagging SQL baseline, solely for the Project variant before seeding.
const BASELINE_COMPLETION = Object.freeze([{ path: '20260930140000_add_sitewide_theme_appearance/migration.sql',
    sha256: 'a682ab8b25fcf561527afea4200005cc60a349f692ab1ce3956d594dd31fdb7f' },
{ path: '20261004033000_add_report_number_lineage/migration.sql',
    sha256: 'b59697f94f28daa5db9590c4d7ebd304e00d941309bc514f44a4abd9c02871b3' }]);
const MIGRATIONS = Object.freeze({
    MARKER: '20261004190000_add_workitem_duplicate_marker',
    INDEX: '20261004190100_unique_active_workitem',
    DECLARATION: '20261004190200_add_declared_consignment_count'
});
const MIGRATION_SHA256 = Object.freeze({
    MARKER: '80278c2d318bc47fa92746015ec278a204a7ff08a9e36d24faca0a56ef05fa1e',
    INDEX: 'a6e1cf6a26319954e35f4008bc4d18e904014f086db0e31d88e42948fac6556e',
    DECLARATION: '849f07ae38eafdb05cf702cf55a5c2f549ee19d04b7bf2ad36fca1322ebb673b'
});
const VARIANTS = Object.freeze({
    PRE_1_1_DUPLICATES: null,
    // A: Prisma order/no updatedAt default; B: observed deployed appended custody
    // columns and DEFAULT CURRENT_TIMESTAMP. Both literal shapes are test-owned.
    CONSIGNMENT_PRE_1_1_A: '13b40b8e5a0acd4deb04f238eedb2deb58c5d4b57d48245c0d938deeaffda123',
    CONSIGNMENT_PRE_1_1_B: 'e87950361986185105cb813b9b16226c178f4b65ad590a9e5e96dcb135bb15d6',
    PROJECT_PRE_TEMPLATE_POLICY: PROJECT_SHAPE_SHA256
});

// Legacy values are inserted into a new schema before its real additive guards
// are installed. Existing constraints are never dropped, disabled or bypassed.
function beforeGuards({ actor, file = path.resolve(__dirname, '../.tmp', `audit_legacy_${randomUUID()}.db`), samples = [], workItems = [], batches = [], preMigrationSnapshot = false,
    schemaVariant = null, markerPending = false, migrationOrder = 'REHEARSAL', relatedRows = {} }) {
    file = assertOwnedTestDatabase(file, actor);
    if (![samples, workItems, batches].every(Array.isArray)) throw new Error('Legacy fixture rows must be declarative arrays.');
    if (schemaVariant !== null && !Object.hasOwn(VARIANTS, schemaVariant)) throw new Error('Unknown pinned historical schema variant.');
    if (!['REHEARSAL', 'REAL'].includes(migrationOrder) || (markerPending && schemaVariant !== 'PRE_1_1_DUPLICATES')) {
        throw new Error('Unknown historical migration order or pending marker.');
    }
    const projectVariant = schemaVariant === 'PROJECT_PRE_TEMPLATE_POLICY';
    const projectColumns = ['templateId', 'templateVersion', 'policyConfig', 'programmeCode', 'parentProjectId'];
    function assertGeneratedSchemaCompleteness(handle, projectPending = false) {
        const missing = [];
        for (const model of Prisma.dmmf.datamodel.models) {
            const table = model.dbName || model.name;
            const columns = handle.prepare(`PRAGMA table_info("${table.replace(/"/g, '""')}")`).all().map(row => row.name);
            if (!columns.length) { missing.push({ table, missingTable: true }); continue; }
            const fields = model.fields.filter(field => field.kind !== 'object' && !columns.includes(field.dbName || field.name)).map(field => field.dbName || field.name);
            if (fields.length) missing.push({ table, fields });
        }
        // The one accountable pending migration deliberately lacks exactly five
        // Project columns. After it runs, every current model/column must exist.
        assert.equal(JSON.stringify(missing), JSON.stringify(projectPending ? [{ table: 'Project', fields: projectColumns }] : []),
            'Pinned historical baseline does not match the generated Prisma datamodel.');
    }
    const relatedTables = ['User', 'Lab', 'Consignment', 'Submission', 'Result', 'SpectralData',
        ...(projectVariant ? ['Project', 'Report', 'ReportShareLink', 'AuditLog'] : [])];
    if (!relatedRows || Object.keys(relatedRows).some(table => !relatedTables.includes(table) || !Array.isArray(relatedRows[table]))) {
        throw new Error('Related legacy rows must name an allowed table and declarative array.');
    }
    const pending = schemaVariant === 'PRE_1_1_DUPLICATES' ? [...(markerPending ? ['MARKER'] : []), 'INDEX']
        : projectVariant ? ['PROJECT_POLICY'] : schemaVariant ? ['DECLARATION'] : [];
    const outcomes = new Map(pending.map(name => [name, 'PENDING']));
    let unusable = false, closed = false;
    // Exclusive creation makes a reused file fail before any database is opened.
    fs.closeSync(fs.openSync(file, 'wx'));
    let db = new Database(file), snapshot = null;
    try {
        db.pragma('foreign_keys = ON');
        if (schemaVariant) {
            const baseline = fs.readFileSync(path.resolve(__dirname, 'fixtures/pre11_full_application_schema.sql'));
            if (createHash('sha256').update(baseline).digest('hex') !== PRE11_SHA256) throw new Error('Pinned pre-1.1 schema digest mismatch.');
            let schema = baseline.toString('utf8');
            if (projectVariant) {
                // #179 pins 5988657821 / 5988713306: select the evidenced
                // baseline-minus-five shape before any table or index exists.
                const shape = fs.readFileSync(path.resolve(__dirname, 'fixtures/project_pre_template_policy.sql'));
                if (createHash('sha256').update(shape).digest('hex') !== PROJECT_SHAPE_SHA256) throw new Error('Pinned Project shape digest mismatch.');
                const original = schema.match(/CREATE TABLE "Project" \([\s\S]*?\n\);/);
                if (!original) throw new Error('Pinned baseline lacks Project.');
                const derived = original[0].split('\n').filter(line => !/^    "(?:templateId|templateVersion|policyConfig|programmeCode|parentProjectId)" /.test(line) &&
                    !/^    CONSTRAINT "Project_parentProjectId_fkey" /.test(line)).join('\n').replace('"updatedAt" DATETIME NOT NULL,', '"updatedAt" DATETIME NOT NULL');
                assert.equal(shape.toString('utf8'), derived, 'Project shape must remove only the five policy columns and self-FK.');
                schema = schema.replace(original[0], shape.toString('utf8'));
            } else if (schemaVariant !== 'PRE_1_1_DUPLICATES') {
                const shape = require('./fixtures/consignment_pre11_shapes.json')[schemaVariant];
                if (shape.sha256 !== VARIANTS[schemaVariant] || createHash('sha256').update(shape.ddl).digest('hex') !== VARIANTS[schemaVariant]) {
                    throw new Error('Pinned historical Consignment shape digest mismatch.');
                }
                // Select its literal CREATE before anything exists; never rebuild,
                // drop or disable an already installed table, index or constraint.
                const original = schema.match(/CREATE TABLE "Consignment" \([\s\S]*?\n\);/);
                if (!original) throw new Error('Pinned baseline lacks Consignment.');
                schema = schema.replace(original[0], shape.ddl);
            }
            db.exec(schema);
            if (projectVariant) {
                assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
                assert.equal(db.prepare('SELECT COUNT(*) AS count FROM User').get().count, 0, 'Baseline completion must precede User seeding.');
                for (const entry of BASELINE_COMPLETION) {
                    const sql = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations', entry.path));
                    if (createHash('sha256').update(sql).digest('hex') !== entry.sha256) throw new Error('Pinned baseline completion digest mismatch.');
                    db.transaction(() => db.exec(sql.toString('utf8')))();
                }
                const baselineDb = new Database(':memory:');
                try {
                    baselineDb.pragma('foreign_keys = ON'); baselineDb.exec(baseline.toString('utf8'));
                    const columns = baselineDb.prepare('PRAGMA table_info("Project")').all()
                        .filter(row => !projectColumns.includes(row.name)).map((row, cid) => ({ ...row, cid }));
                    // Native SQLite arrays and Jest callbacks have different
                    // realm prototypes. Compare every PRAGMA scalar unchanged.
                    assert.equal(JSON.stringify(db.prepare('PRAGMA table_info("Project")').all()), JSON.stringify(columns), 'Unpinned Project column drift.');
                    assert.equal(JSON.stringify(db.prepare('PRAGMA index_list("Project")').all()), JSON.stringify(baselineDb.prepare('PRAGMA index_list("Project")').all()), 'Unpinned Project index drift.');
                    assert.equal(JSON.stringify(db.prepare('PRAGMA foreign_key_list("Project")').all()), JSON.stringify(baselineDb.prepare('PRAGMA foreign_key_list("Project")').all()
                        .filter(row => row.from !== 'parentProjectId')), 'Unpinned Project foreign-key drift.');
                } finally { baselineDb.close(); }
            }
        } else {
            const source = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
            const tables = source.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' AND name != 'ResultEvidenceEvent'").all();
            const indexes = source.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL AND tbl_name != 'ResultEvidenceEvent'").all();
            source.close();
            for (const table of tables) db.exec(['Sample', 'WorkItem'].includes(table.name)
                ? table.sql.replace(/,\s*"(?:holdPriorStatus|legacyStatus)"\s+TEXT(?=\s*[,)])/g, '') : table.sql);
            for (const index of indexes) db.exec(index.sql);
        }
        if (db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all().length) throw new Error('Legacy fixture must have no release guards before inserting.');
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        for (const table of tables) {
            if (projectVariant && table.name === 'GlobalAppearanceSetting') {
                // The immutable completion SQL seeds exactly this singleton;
                // every operational table is still empty before legacy seeding.
                assert.equal(JSON.stringify(db.prepare('SELECT id,themeId,defaultMode,revision,updatedBy FROM GlobalAppearanceSetting').all()),
                    JSON.stringify([{ id: 'global', themeId: 'soilfer-classic', defaultMode: 'light', revision: 1, updatedBy: null }]));
            } else if (db.prepare(`SELECT COUNT(*) AS count FROM "${table.name}"`).get().count !== 0) {
                throw new Error('Legacy fixture must be a fresh schema-only file.');
            }
        }
        for (const [table, rows] of [['Lab', relatedRows.Lab || []], ...(projectVariant ? [['Project', relatedRows.Project || []]] : []),
            ['User', relatedRows.User || []], ['Consignment', relatedRows.Consignment || []],
            ['Sample', samples], ['Batch', batches], ['Submission', relatedRows.Submission || []], ['WorkItem', workItems],
            ['Result', relatedRows.Result || []], ['SpectralData', relatedRows.SpectralData || []],
            ...(projectVariant ? [['Report', relatedRows.Report || []], ['ReportShareLink', relatedRows.ReportShareLink || []], ['AuditLog', relatedRows.AuditLog || []]] : [])]) {
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
        if (schemaVariant) for (const [name, directory] of Object.entries(MIGRATIONS)) {
            if (pending.includes(name) && migrationOrder === 'REHEARSAL') continue;
            const sql = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations', directory, 'migration.sql'));
            if (createHash('sha256').update(sql).digest('hex') !== MIGRATION_SHA256[name]) throw new Error(`Pinned ${name} migration digest mismatch.`);
            db.transaction(() => db.exec(sql.toString('utf8')))();
            if (outcomes.has(name)) outcomes.set(name, 'APPLIED');
        }
        function runProjectMigration() {
            const source = fs.readFileSync(path.resolve(__dirname, '../../scripts/migrate_project_templates_and_policy.js'));
            if (createHash('sha256').update(source).digest('hex') !== PROJECT_MIGRATION_SHA256) throw new Error('Pinned Project migration digest mismatch.');
            const result = require('../../scripts/migrate_project_templates_and_policy').migrateProjectTemplatesAndPolicy(file);
            const columns = db.prepare('PRAGMA table_info("Project")').all().map(row => row.name);
            if (!result.success || !result.applied || !projectColumns.every(name => columns.includes(name)) ||
                !db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='Project_parentProjectId_idx'").get() ||
                db.prepare('PRAGMA foreign_key_check("Project")').all().length) throw new Error('The exact Project migration did not complete.');
            return result;
        }
        if (projectVariant && migrationOrder === 'REAL') {
            runProjectMigration(); outcomes.set('PROJECT_POLICY', 'APPLIED');
        }
        for (const name of ['20261005000000_workflow_state_evidence', '20261005000100_workflow_state_guards']) {
            db.exec(fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations', name, 'migration.sql'), 'utf8'));
        }
        const guardSql = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261005000100_workflow_state_guards/migration.sql'), 'utf8');
        const installed = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all().map(row => row.name));
        for (const match of guardSql.matchAll(/CREATE TRIGGER "([^"]+)"/g)) {
            if (!installed.has(match[1])) throw new Error(`Missing release guard ${match[1]}`);
        }
        if (projectVariant) assertGeneratedSchemaCompleteness(db, outcomes.get('PROJECT_POLICY') === 'PENDING');
    } catch (error) {
        if (db.open) db.close();
        // This helper exclusively created the owned file; a failed build cannot
        // leave a reusable rehearsal with missing guards or partial migrations.
        for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(`${file}${suffix}`, { force: true });
        if (snapshot) { fs.chmodSync(snapshot.path, 0o600); fs.rmSync(snapshot.path); }
        throw error;
    } finally { if (db.open) db.close(); }
    return { file, preMigrationSnapshot: snapshot,
        get pendingMigrations() { return [...outcomes].filter(([, outcome]) => outcome === 'PENDING').map(([name]) => name); },
        applyPendingMigration: ({ connection, migration = pending.at(-1), expectedFailure } = {}) => {
            assertOwnedTestDatabase(file, actor);
            if (closed || unusable || outcomes.get(migration) !== 'PENDING') throw new Error('Historical migration is not pending or its rehearsal is unusable.');
            if (migration === 'INDEX' && outcomes.get('MARKER') === 'PENDING') throw new Error('The marker must be applied before the index.');
            if (expectedFailure !== undefined && !(migration === 'INDEX' && expectedFailure === 'SQLITE_CONSTRAINT_UNIQUE')) {
                throw new Error('Only the exact unresolved duplicate-index refusal is pinned.');
            }
            if (migration === 'PROJECT_POLICY') {
                if (connection) throw new Error('The Project migration opens only its own owned path.');
                // Keep the unchanged public runner at the original rehearsal
                // point, with a byte-bound source and observable DDL proof.
                const handle = new Database(file, { readonly: true, fileMustExist: true });
                try {
                    const source = fs.readFileSync(path.resolve(__dirname, '../../scripts/migrate_project_templates_and_policy.js'));
                    if (createHash('sha256').update(source).digest('hex') !== PROJECT_MIGRATION_SHA256) throw new Error('Pinned Project migration digest mismatch.');
                    const result = require('../../scripts/migrate_project_templates_and_policy').migrateProjectTemplatesAndPolicy(file);
                    const columns = handle.prepare('PRAGMA table_info("Project")').all().map(row => row.name);
                    if (!result.success || !result.applied || !projectColumns.every(name => columns.includes(name)) ||
                        !handle.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='Project_parentProjectId_idx'").get() ||
                        handle.prepare('PRAGMA foreign_key_check("Project")').all().length) throw new Error('The exact Project migration did not complete.');
                    assertGeneratedSchemaCompleteness(handle);
                    outcomes.set(migration, 'APPLIED'); return result;
                } finally { handle.close(); }
            }
            const sql = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations', MIGRATIONS[migration], 'migration.sql'));
            if (createHash('sha256').update(sql).digest('hex') !== MIGRATION_SHA256[migration]) throw new Error(`Pinned ${migration} migration digest mismatch.`);
            const handle = connection || new Database(file, { fileMustExist: true });
            try {
                if (path.resolve(handle.name) !== file || !handle.open || handle.readonly) throw new Error('Migration connection must be the owned writable rehearsal.');
                if (!handle.inTransaction) handle.pragma('foreign_keys = ON');
                if (handle.pragma('foreign_keys', { simple: true }) !== 1) throw new Error('Historical migrations require foreign keys ON.');
                try { handle.transaction(() => handle.exec(sql.toString('utf8')))(); }
                catch (error) {
                    if (expectedFailure && error.code === expectedFailure && error.message === 'UNIQUE constraint failed: WorkItem.sampleId, WorkItem.analysis') {
                        if (handle.prepare("SELECT name FROM sqlite_master WHERE name='WorkItem_one_active_per_analysis'").get()) throw new Error('Failed index migration left its index installed.');
                        outcomes.set(migration, 'ASSERTED_FAILURE');
                        unusable = true; // A failed-index file is discarded, never reused.
                    }
                    throw error;
                }
                if (expectedFailure) throw new Error('The expected index failure unexpectedly succeeded.');
                outcomes.set(migration, 'APPLIED');
            } finally { if (!connection) handle.close(); }
        },
        close: () => {
            if (closed) return;
            closed = true;
            try {
                if ([...outcomes.values()].includes('PENDING')) throw new Error('Historical rehearsal has an unaccounted pending migration.');
            } finally {
                assertOwnedTestDatabase(file, actor);
                for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(`${file}${suffix}`, { force: true });
                if (snapshot) { fs.chmodSync(snapshot.path, 0o600); fs.rmSync(snapshot.path); }
            }
        }
    };
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
function useLegacyRouteDatabase(prisma, client, { allModels = false } = {}) {
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
    if (allModels) {
        // Forward database operations only, without fabricating auth, scope,
        // policy or workflow outcomes. Integration tests keep the real routes,
        // services, transactions, SQLite constraints and release guards.
        const names = ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count',
            'aggregate', 'groupBy', 'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'];
        for (const model of Object.keys(client)) {
            if (!model.startsWith('_') && !model.startsWith('$') && typeof client[model]?.findMany === 'function') {
                methods[model] = names.filter(name => typeof client[model][name] === 'function');
            }
        }
        for (const name of ['$queryRaw', '$queryRawUnsafe', '$executeRaw', '$executeRawUnsafe']) {
            jest.spyOn(prisma, name).mockImplementation((...args) => client[name](...args));
        }
    }
    for (const [model, names] of Object.entries(methods)) for (const name of names) {
        jest.spyOn(prisma[model], name).mockImplementation(args => client[model][name](args));
    }
}

module.exports = { beforeGuards, createLegacyClosureDatabase, useLegacyRouteDatabase };
