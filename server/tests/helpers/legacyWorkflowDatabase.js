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
const PRE13_SHA256 = '7727cd04e0bb7ba7da66e54f49a3a9e53cc64f61be390c9d68efdec3e40284c8';
const PROJECT_SHAPE_SHA256 = '0915342087544cde959571f2d2bc9fc4ecf2825c400cc4ad1f17066fbb121115';
const PROJECT_MIGRATION_SHA256 = '3e63e37f4bce011c6d80efa5329f810ceffb9d5ff96653a406f90d818202e123';
const PROJECT_FK_CORRUPT_SHA256 = 'd7302e4c84d0da5e632256d04f19c1df20f21806949bbb720b5704a569b5f03c';
// #179 pins 5988872290 / 5989464829: the closed, evidenced completion of
// the lagging SQL baseline for the Project and pre-1.3 variants before seeding
// (#179's extension to the latter is pinned in 5989961445).
const BASELINE_COMPLETION = Object.freeze([{ path: '20260930140000_add_sitewide_theme_appearance/migration.sql',
    sha256: 'a682ab8b25fcf561527afea4200005cc60a349f692ab1ce3956d594dd31fdb7f' },
{ path: '20261004033000_add_report_number_lineage/migration.sql',
    sha256: 'b59697f94f28daa5db9590c4d7ebd304e00d941309bc514f44a4abd9c02871b3' }]);
const MIGRATIONS = Object.freeze({
    SAMPLE_CODES: '20261004170000_add_atomic_sample_codes',
    MARKER: '20261004190000_add_workitem_duplicate_marker',
    INDEX: '20261004190100_unique_active_workitem',
    DECLARATION: '20261004190200_add_declared_consignment_count'
});
const MIGRATION_SHA256 = Object.freeze({
    SAMPLE_CODES: 'e52a11bb7fc8dfee678184025dda8e8342cde3896d3b5f1c89b83897702d8ff0',
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
    PROJECT_PRE_TEMPLATE_POLICY: PROJECT_SHAPE_SHA256,
    PROJECT_FK_CORRUPT_SYNTHETIC: PROJECT_FK_CORRUPT_SHA256,
    PRE_1_3_SAMPLE_CODES: PRE13_SHA256
});

// Legacy values are inserted into a new schema before its real additive guards
// are installed. Existing constraints are never dropped, disabled or bypassed.
function beforeGuards(options) {
    // #186 part 20: closed DDL-only probes on an independently owned file.
    // Keep dynamic fixture SQL in this existing test authority, never runtime.
    if (Object.hasOwn(options, 'qcBootstrap')) {
        if (Object.keys(options).length !== 3 || Object.keys(options).some(key => !['actor', 'file', 'qcBootstrap'].includes(key)) ||
            !['CREATE_PRISMA', 'FRESH_NONDEFERRED', 'COMPLETE_NONDEFERRED'].includes(options.qcBootstrap)) throw new Error('Unknown owned QC bootstrap probe.');
        const file = assertOwnedTestDatabase(options.file, options.actor), mode = options.qcBootstrap;
        if (mode === 'CREATE_PRISMA') {
            if (fs.existsSync(file)) throw new Error('Fresh Prisma fixture refuses an existing file.');
            const cli = path.resolve(__dirname, '../../node_modules/prisma/build/index.js'), cwd = path.resolve(__dirname, '../..');
            const execute = args => require('node:child_process').execFileSync(process.execPath, [cli, ...args], { cwd, stdio: 'pipe', encoding: 'utf8' });
            // Linux/CI uses real db push. Windows executes the same fresh DDL
            // emitted by Prisma because its schema engine rejects owned URLs.
            if (process.platform === 'win32') {
                const sql = execute(['migrate', 'diff', '--from-empty', '--to-schema', path.resolve(cwd, 'prisma/schema.prisma'), '--script']);
                const db = new Database(file); try { db.pragma('foreign_keys = ON'); db.exec(sql); } finally { db.close(); }
            } else execute(['db', 'push', '--url', `file:${file}`]);
            return { file };
        }
        const db = new Database(file, { fileMustExist: true }), source = require('../../services/qcRunMigrationSource').loadQcRunMigrationSource();
        try {
            db.pragma('foreign_keys = ON');
            const tables = mode === 'FRESH_NONDEFERRED' ? Object.keys(source.freshTables) : ['QcMeasurement', 'BatchPositionReference'];
            if (tables.some(table => db.prepare(`SELECT count(*) n FROM "${table}"`).get().n)) throw new Error('Owned QC DDL probe requires empty target tables.');
            db.transaction(() => {
                for (const table of ['QcMeasurement', 'BatchPositionReference']) {
                    db.exec(`DROP TABLE "${table}"`); db.exec(source.freshTables[table]);
                    for (const match of (mode === 'COMPLETE_NONDEFERRED' ? source.sql : source.schemaSql).matchAll(new RegExp(`^CREATE (?:UNIQUE )?INDEX "[^"]+" ON "${table}"[\\s\\S]*?;`, 'gm'))) db.exec(match[0]);
                    if (mode === 'COMPLETE_NONDEFERRED') for (const match of source.guardsSql.matchAll(new RegExp(`^CREATE TRIGGER "[^"]+" BEFORE (?:INSERT|UPDATE|DELETE) ON "${table}"[\\s\\S]*?^END;`, 'gm'))) db.exec(match[0]);
                }
            })();
            return { file };
        } finally { db.close(); }
    }
    const allowedOptions = ['actor', 'file', 'samples', 'workItems', 'batches', 'preMigrationSnapshot',
        'schemaVariant', 'markerPending', 'migrationOrder', 'relatedRows', 'installWorkflowStateGuards',
        'reviewedStatusPlan', 'installerStatusRace'];
    if (Object.keys(options).some(key => !allowedOptions.includes(key))) throw new Error('Unknown historical fixture option.');
    const { actor, samples = [], workItems = [], batches = [], preMigrationSnapshot = false,
        schemaVariant = null, markerPending = false, migrationOrder = 'REHEARSAL', relatedRows = {} } = options;
    let { file = path.resolve(__dirname, '../.tmp', `audit_legacy_${randomUUID()}.db`) } = options;
    const useInstaller = Object.hasOwn(options, 'installWorkflowStateGuards');
    if (useInstaller && (options.installWorkflowStateGuards !== true || schemaVariant !== null || markerPending || migrationOrder !== 'REHEARSAL')) {
        throw new Error('The actual workflow installer is allowed only on the default schema-only fixture.');
    }
    // #179 pin 5992733495: the caller supplies the real read-only CLI record.
    // This helper validates that review; it never creates an approval digest.
    const hasReview = Object.hasOwn(options, 'reviewedStatusPlan');
    const hasRace = Object.hasOwn(options, 'installerStatusRace');
    let reviewedPlan;
    if (hasReview) {
        const record = options.reviewedStatusPlan;
        if (!useInstaller || !record || typeof record !== 'object' || Array.isArray(record) ||
            Object.keys(record).length !== 2 || Object.keys(record).some(key => !['plan', 'fingerprint'].includes(key)) ||
            record.plan?.direction !== 'apply') throw new Error('A reviewed status record requires the default actual installer fixture.');
        reviewedPlan = require('../../services/statusMigrationPlan').reviewPlan(record.plan, record.fingerprint);
    }
    if (hasRace) {
        const race = options.installerStatusRace;
        if (!hasReview || !race || typeof race !== 'object' || Array.isArray(race) ||
            Object.keys(race).length !== 2 || Object.keys(race).some(key => !['sampleId', 'updatedAt'].includes(key))) {
            throw new Error('An installer status race requires the reviewed status record and its exact declarative fields.');
        }
        const candidate = reviewedPlan.rows.find(row => row.entity === 'Sample' && row.id === race.sampleId);
        const seeded = Array.isArray(samples) && samples.find(row => row.id === race.sampleId);
        const date = typeof race.updatedAt === 'string' && new Date(race.updatedAt);
        if (!candidate || !seeded || !date || !Number.isFinite(date.getTime()) || date.toISOString() !== race.updatedAt ||
            new Date(seeded.updatedAt).toISOString() === race.updatedAt) {
            throw new Error('The installer race must name a seeded Sample candidate and a different valid ISO timestamp.');
        }
    }
    file = assertOwnedTestDatabase(file, actor);
    if (![samples, workItems, batches].every(Array.isArray)) throw new Error('Legacy fixture rows must be declarative arrays.');
    if (schemaVariant !== null && !Object.hasOwn(VARIANTS, schemaVariant)) throw new Error('Unknown pinned historical schema variant.');
    if (!['REHEARSAL', 'REAL'].includes(migrationOrder) || (markerPending && schemaVariant !== 'PRE_1_1_DUPLICATES')) {
        throw new Error('Unknown historical migration order or pending marker.');
    }
    // #179 pin 5989961445: the sole connection-scoped FK exception is a
    // synthetic, corrupt Parent/Project file containing no workflow objects.
    if (schemaVariant === 'PROJECT_FK_CORRUPT_SYNTHETIC') {
        if (samples.length || workItems.length || batches.length || Object.keys(relatedRows).length || preMigrationSnapshot || markerPending || migrationOrder !== 'REHEARSAL') {
            throw new Error('The corrupt Project variant accepts only its exact literal fixture.');
        }
        const literal = fs.readFileSync(path.resolve(__dirname, 'fixtures/project_fk_corrupt_synthetic.sql'));
        if (createHash('sha256').update(literal).digest('hex') !== PROJECT_FK_CORRUPT_SHA256) throw new Error('Pinned corrupt Project fixture digest mismatch.');
        fs.closeSync(fs.openSync(file, 'wx'));
        const corrupt = new Database(file, { fileMustExist: true });
        try {
            corrupt.pragma('foreign_keys = OFF');
            corrupt.exec(literal.toString('utf8'));
            assert.equal(JSON.stringify(corrupt.pragma('foreign_key_check')),
                JSON.stringify([{ table: 'Project', rowid: 1, parent: 'Parent', fkid: 0 }]));
            assert.equal(corrupt.prepare('SELECT id,parentRef FROM Project WHERE rowid=1').get().id, 'p-1');
            const objects = corrupt.prepare('SELECT type,name,tbl_name FROM sqlite_master ORDER BY type,name').all();
            assert.equal(JSON.stringify(objects), JSON.stringify([
                { type: 'index', name: 'sqlite_autoindex_Parent_1', tbl_name: 'Parent' },
                { type: 'index', name: 'sqlite_autoindex_Project_1', tbl_name: 'Project' },
                { type: 'index', name: 'sqlite_autoindex_Project_2', tbl_name: 'Project' },
                { type: 'table', name: 'Parent', tbl_name: 'Parent' },
                { type: 'table', name: 'Project', tbl_name: 'Project' }
            ]), 'The synthetic corrupt fixture must contain only Parent, Project and their autoindexes.');
        } catch (error) {
            corrupt.close(); fs.rmSync(file, { force: true }); throw error;
        } finally { if (corrupt.open) corrupt.close(); }
        return file;
    }
    const projectVariant = schemaVariant === 'PROJECT_PRE_TEMPLATE_POLICY';
    const sampleCodeVariant = schemaVariant === 'PRE_1_3_SAMPLE_CODES';
    const projectColumns = ['templateId', 'templateVersion', 'policyConfig', 'programmeCode', 'parentProjectId'];
    function assertGeneratedSchemaCompleteness(handle, pendingName = null) {
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
        const expected = pendingName === 'PROJECT_POLICY' ? [{ table: 'Project', fields: projectColumns }]
            : pendingName === 'SAMPLE_CODES' ? [{ table: 'Sample', fields: ['labSampleCode'] },
                { table: 'WorkItem', fields: ['legacyLabId'] }, { table: 'LabSequence', missingTable: true }] : [];
        // #182 adds one nullable scalar absent from each pinned older schema.
        // Require that exact historical gap; all other completeness checks stay.
        if (schemaVariant !== null) {
            const beforeSequence = expected.findIndex(row => row.table === 'LabSequence');
            expected.splice(beforeSequence < 0 ? expected.length : beforeSequence, 0, { table: 'Result', fields: ['attemptId'] });
            // #183 adds exactly these nullable history fields and one table.
            // Literal historical schemas remain unchanged; unexpected gaps fail.
            const cancellationFields = ['cancellationCode', 'cancellationReason', 'cancelledBy', 'cancelledAt'];
            const workGap = expected.find(row => row.table === 'WorkItem');
            if (workGap) workGap.fields.push(...cancellationFields);
            else expected.push({ table: 'WorkItem', fields: cancellationFields });
            expected.push({ table: 'SampleHold', missingTable: true });
            const modelNames = Prisma.dmmf.datamodel.models.map(model => model.dbName || model.name);
            expected.sort((left, right) => modelNames.indexOf(left.table) - modelNames.indexOf(right.table));
            // The captured historical baselines predate exactly the two #184
            // tables and two nullable QC links. They stay genuinely historical.
            expected.push({ table: 'BatchQcResult', fields: ['referenceMaterialId', 'referenceValueId'] },
                { table: 'ReferenceMaterial', missingTable: true }, { table: 'ReferenceValue', missingTable: true },
                { table: 'QcRule', missingTable: true });
            // #186 adds exactly four nullable Batch scalars and eight tables.
            // Preserve the literal pre-audit schemas and account for only these
            // new gaps when checking a freshly generated #186 datamodel.
            const runTables = ['BatchAnalyte', 'BatchPosition', 'BatchPositionWorkItem', 'BatchPositionReference',
                'QcMeasurement', 'QcEvaluation', 'BatchDisposition', 'BatchEvent'];
            const runModels = runTables.filter(table => modelNames.includes(table));
            assert.ok(runModels.length === 0 || runModels.length === runTables.length, 'Generated QC datamodel is partial.');
            if (runModels.length) expected.push({ table: 'Batch', fields: ['instrumentId', 'analystUsername', 'startedAt', 'completedAt'] },
                ...runTables.map(table => ({ table, missingTable: true })));
            const order = Prisma.dmmf.datamodel.models.map(model => model.dbName || model.name);
            expected.sort((left, right) => order.indexOf(left.table) - order.indexOf(right.table));
        }
        assert.equal(JSON.stringify(missing), JSON.stringify(expected),
            'Pinned historical baseline does not match the generated Prisma datamodel.');
    }
    const relatedTables = ['User', 'Lab', 'Consignment', 'Submission', 'Result', 'SpectralData',
        ...(projectVariant ? ['Project', 'Report', 'ReportShareLink', 'AuditLog'] : sampleCodeVariant ? ['AuditLog'] : [])];
    if (!relatedRows || Object.keys(relatedRows).some(table => !relatedTables.includes(table) || !Array.isArray(relatedRows[table]))) {
        throw new Error('Related legacy rows must name an allowed table and declarative array.');
    }
    const pending = schemaVariant === 'PRE_1_1_DUPLICATES' ? [...(markerPending ? ['MARKER'] : []), 'INDEX']
        : projectVariant ? ['PROJECT_POLICY'] : sampleCodeVariant ? ['SAMPLE_CODES'] : schemaVariant ? ['DECLARATION'] : [];
    const outcomes = new Map(pending.map(name => [name, 'PENDING']));
    let unusable = false, closed = false;
    // Exclusive creation makes a reused file fail before any database is opened.
    fs.closeSync(fs.openSync(file, 'wx'));
    let db = new Database(file), snapshot = null;
    try {
        db.pragma('foreign_keys = ON');
        if (schemaVariant) {
            const baseline = fs.readFileSync(path.resolve(__dirname, sampleCodeVariant ? 'fixtures/pre13_full_application_schema.sql' : 'fixtures/pre11_full_application_schema.sql'));
            if (createHash('sha256').update(baseline).digest('hex') !== (sampleCodeVariant ? PRE13_SHA256 : PRE11_SHA256)) throw new Error('Pinned historical schema digest mismatch.');
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
            } else if (!sampleCodeVariant && schemaVariant !== 'PRE_1_1_DUPLICATES') {
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
            if (projectVariant || sampleCodeVariant) {
                assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
                assert.equal(db.prepare('SELECT COUNT(*) AS count FROM User').get().count, 0, 'Baseline completion must precede User seeding.');
                for (const entry of BASELINE_COMPLETION) {
                    const sql = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations', entry.path));
                    if (createHash('sha256').update(sql).digest('hex') !== entry.sha256) throw new Error('Pinned baseline completion digest mismatch.');
                    db.transaction(() => db.exec(sql.toString('utf8')))();
                }
            }
            if (projectVariant) {
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
            // Copy schema-only indexes, leaving every additive release guard
            // and partial index for its actual installer on this new file.
            const indexes = source.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL AND tbl_name != 'ResultEvidenceEvent' AND name NOT IN ('ReferenceValue_current_generic','ReferenceValue_current_method','QcRule_scope_version_unique','BatchAnalyte_crm_ordinal_unique','BatchPositionReference_current_unique','QcMeasurement_current_unique')").all();
            source.close();
            for (const table of tables) db.exec(['Sample', 'WorkItem'].includes(table.name)
                ? table.sql.replace(/,\s*"(?:holdPriorStatus|legacyStatus)"\s+TEXT(?=\s*[,)])/g, '') : table.sql);
            for (const index of indexes) db.exec(index.sql);
        }
        if (db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all().length) throw new Error('Legacy fixture must have no release guards before inserting.');
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
        for (const table of tables) {
            if ((projectVariant || sampleCodeVariant) && table.name === 'GlobalAppearanceSetting') {
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
            ...(projectVariant ? [['Report', relatedRows.Report || []], ['ReportShareLink', relatedRows.ReportShareLink || []], ['AuditLog', relatedRows.AuditLog || []]]
                : sampleCodeVariant ? [['AuditLog', relatedRows.AuditLog || []]] : [])]) {
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
            if (name === 'SAMPLE_CODES' && !sampleCodeVariant) continue;
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
        let installerOutcome;
        if (useInstaller) {
            // #179 pin 5992194809: execute the same child entrypoint as Docker.
            // No unguarded writable file or handle is returned to a caller.
            const oldObjects = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
            const oldTables = oldObjects.filter(object => object.type === 'table').map(({ name }) => ({ name,
                columns: db.prepare(`PRAGMA table_xinfo("${name}")`).all(),
                fks: db.prepare(`PRAGMA foreign_key_list("${name}")`).all(),
                indexes: db.prepare(`PRAGMA index_list("${name}")`).all(),
                rows: db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all() }));
            db.close();
            if (hasRace) {
                const statusScript = path.resolve(__dirname, '../../scripts/migrate_legacy_statuses.js');
                const beforeRace = require('node:child_process').spawnSync(process.execPath, [statusScript, '--db', file], { encoding: 'utf8' });
                assert.equal(beforeRace.status, 0, beforeRace.stderr);
                assert.equal(JSON.parse(beforeRace.stdout).fingerprint, options.reviewedStatusPlan.fingerprint,
                    'The owned seeded file must match the recorded review before the race.');
                db = new Database(file, { fileMustExist: true });
                db.pragma('foreign_keys = ON');
                const race = options.installerStatusRace;
                assert.equal(db.prepare('UPDATE "Sample" SET "updatedAt" = ? WHERE "id" = ?').run(race.updatedAt, race.sampleId).changes, 1);
                for (const table of oldTables) {
                    const retained = db.prepare(`SELECT * FROM "${table.name}" ORDER BY rowid`).all();
                    const expected = table.rows.map(row => table.name === 'Sample' && row.id === race.sampleId
                        ? { ...row, updatedAt: race.updatedAt } : row);
                    assert.equal(JSON.stringify(retained), JSON.stringify(expected), 'The race may change only the candidate timestamp.');
                }
                db.close();
                const afterRace = require('node:child_process').spawnSync(process.execPath, [statusScript, '--db', file], { encoding: 'utf8' });
                assert.equal(afterRace.status, 0, afterRace.stderr);
                assert.notEqual(JSON.parse(afterRace.stdout).fingerprint, options.reviewedStatusPlan.fingerprint,
                    'The race must actually invalidate the reviewed fingerprint.');
            }
            const beforeSha = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
            const child = require('node:child_process').spawnSync(process.execPath,
                [path.resolve(__dirname, '../../scripts/install_workflow_state_guards.js'), '--apply',
                    ...(hasReview ? ['--reviewed-status-sha256', options.reviewedStatusPlan.fingerprint] : [])],
                { env: { ...process.env, DATABASE_PATH: file, DATABASE_URL: `file:${file}` }, encoding: 'utf8' });
            const afterSha = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
            if (child.error || child.status !== 0) {
                assert.equal(afterSha, beforeSha, 'An installer refusal must preserve the owned file bytes.');
                const response = child.stderr && JSON.parse(child.stderr);
                if (hasRace) assert.equal(response?.error, 'WORKFLOW_STATUS_PLAN_STALE');
                throw Object.assign(new Error(response?.message || child.error?.message || 'The real workflow installer refused the fixture.'),
                    { code: response?.error, differences: response?.differences, beforeSha, afterSha, exitStatus: child.status });
            }
            if (hasRace) throw new Error('The actual installer accepted a stale reviewed plan.');
            installerOutcome = JSON.parse(child.stdout);
            assert.equal(installerOutcome.classification, 'PRE_179');
            assert.equal(installerOutcome.mode, 'APPLIED');
            db = new Database(file, { fileMustExist: true });
            db.pragma('foreign_keys = ON');
            if (hasReview) for (const candidate of reviewedPlan.rows) {
                const row = db.prepare(`SELECT status FROM "${candidate.entity}" WHERE id=?`).get(candidate.id);
                assert.equal(row?.status, candidate.from, 'The installer must retain every original legacy status.');
            }
            for (const table of oldTables) {
                const names = table.columns.map(column => `"${column.name}"`).join(',');
                const retained = table.name === '_schema_migrations'
                    ? db.prepare(`SELECT ${names} FROM "_schema_migrations" WHERE id <> ? ORDER BY rowid`).all('179_workflow_state_guards')
                    : db.prepare(`SELECT ${names} FROM "${table.name}" ORDER BY rowid`).all();
                assert.equal(JSON.stringify(retained), JSON.stringify(table.rows), 'Historical row mutation.');
                assert.equal(JSON.stringify(db.prepare(`PRAGMA table_xinfo("${table.name}")`).all().slice(0, table.columns.length)), JSON.stringify(table.columns), 'Historical column mutation.');
                assert.equal(JSON.stringify(db.prepare(`PRAGMA foreign_key_list("${table.name}")`).all()), JSON.stringify(table.fks), 'Historical foreign-key mutation.');
                assert.equal(JSON.stringify(db.prepare(`PRAGMA index_list("${table.name}")`).all()), JSON.stringify(table.indexes), 'Historical index mutation.');
            }
            for (const object of oldObjects) {
                const actual = db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type=? AND name=?').get(object.type, object.name);
                if (object.type === 'table' && ['Sample', 'WorkItem'].includes(object.name)) {
                    const removeAdditions = sql => sql.replace(/,\s*"(?:holdPriorStatus|legacyStatus)"\s+TEXT(?=\s*[,)])/g, '').replace(/\s+/g, ' ').trim();
                    assert.equal(removeAdditions(actual.sql), removeAdditions(object.sql), 'Historical workflow DDL mutation.');
                } else assert.equal(JSON.stringify(actual), JSON.stringify(object), 'Historical DDL mutation.');
            }
            const details = db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get('179_workflow_state_guards');
            const definitions = require('../../services/workflowMigrationSources').SOURCES;
            assert.equal(details.details, JSON.stringify({ evidenceSha256: definitions.evidence.sha256, guardsSha256: definitions.guards.sha256 }));
        } else for (const name of ['20261005000000_workflow_state_evidence', '20261005000100_workflow_state_guards']) {
            db.exec(fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations', name, 'migration.sql'), 'utf8'));
        }
        const guardSql = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261005000100_workflow_state_guards/migration.sql'), 'utf8');
        const installed = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all().map(row => row.name));
        for (const match of guardSql.matchAll(/CREATE TRIGGER "([^"]+)"/g)) {
            if (!installed.has(match[1])) throw new Error(`Missing release guard ${match[1]}`);
        }
        if (useInstaller) for (const match of guardSql.matchAll(/CREATE TRIGGER "([^"]+)"[\s\S]*?END;/g)) {
            assert.equal(db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name=?").get(match[1]).sql,
                match[0].slice(0, -1), 'The installed guard must equal the exact release source.');
        }
        if (projectVariant || sampleCodeVariant) assertGeneratedSchemaCompleteness(db,
            outcomes.get(projectVariant ? 'PROJECT_POLICY' : 'SAMPLE_CODES') === 'PENDING' ? (projectVariant ? 'PROJECT_POLICY' : 'SAMPLE_CODES') : null);
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
                if (migration === 'SAMPLE_CODES') assertGeneratedSchemaCompleteness(handle);
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
