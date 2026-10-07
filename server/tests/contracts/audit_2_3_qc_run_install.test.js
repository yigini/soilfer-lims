const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { installReferenceMaterials } = require('../../scripts/install_reference_materials');
const { installQcRules } = require('../../scripts/install_qc_rules');
const { installQcRuns, assertQcRunStartupReady, parseArguments } = require('../../scripts/install_qc_runs');
const { loadQcRunMigrationSource } = require('../../services/qcRunMigrationSource');
const { classifyQcRunSchema } = require('../../services/qcRunSchemaService');
const { inventoryLegacyQcRuns } = require('../../services/qcRunBackfillPlan');
const { scanSource } = require('../helpers/workflowWriteScanner');
const files = [], hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const recordedAt = '2026-09-20T09:15:00.000Z';
function insert(db, table, row) {
    db.prepare(`INSERT INTO "${table}" (${Object.keys(row).map(key => `"${key}"`).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row));
}
function fixture({ qcResults = null, history = null, status = 'OPEN', disposition = null, membership = false, fresh = false, multipleAttempts = false, result = false } = {}) {
    const labId = randomUUID(), batchId = randomUUID(), sampleId = randomUUID(), workItemId = randomUUID(), analysis = `Q-${randomUUID()}`;
    const username = `fixture-${randomUUID()}`, now = Date.now(), resultId = randomUUID();
    const legacyDisposition = typeof disposition === 'function' ? disposition(username) : disposition;
    const firstCreated = Date.parse('2026-09-19T09:00:00Z');
    const attempts = multipleAttempts ? [['accepted-attempt', 'ACCEPTED', firstCreated + 1], ['completed-attempt', 'COMPLETED', firstCreated + 2]]
        .map(([id, status, createdAt]) => ({ id, sampleId, analysis, labId, batchId, duplicateOf: workItemId, rackPosition: 5, status, createdAt, updatedAt: createdAt })) : [];
    // Multiple attempts need the already-migrated duplicateOf column. The
    // schema-only fixture still leaves QC guards/receipt to the real installer.
    const { file } = beforeGuards({ actor: 'system:fixture', schemaVariant: multipleAttempts ? null : 'PRE_1_3_SAMPLE_CODES',
        relatedRows: { Lab: [{ id: labId, code: labId, name: 'QC import fixture', country: 'GTM', updatedAt: now }],
            User: [{ id: randomUUID(), username, email: `${username}@example.test`, password: 'hash', role: 'LAB_MANAGER', updatedAt: now }],
            Result: result ? [{ id: resultId, sampleId, param: analysis, batchId, value: '7.123456789', numericValue: 7.123456789,
                flags: '[]', isValid: 1, updatedAt: now }] : [] },
        samples: membership ? [{ id: sampleId, originalId: sampleId, assignedLab: labId, status: 'PROCESSING', updatedAt: now }] : [],
        batches: [{ id: batchId, labId, analysis, status, createdBy: username, instrument: 'Legacy free text', qcResults, history, disposition: legacyDisposition,
            workItemIds: membership ? JSON.stringify([workItemId]) : '[]' }],
        workItems: membership ? [{ id: workItemId, sampleId, analysis, labId, status: multipleAttempts ? 'SUBMITTED' : 'IN_PROGRESS',
            batchId, rackPosition: 5, updatedAt: now, ...(multipleAttempts && { createdAt: firstCreated }) }, ...attempts] : [] });
    files.push(file);
    const db = new Database(file, { fileMustExist: true });
    db.exec('CREATE TABLE IF NOT EXISTS "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)');
    db.close();
    installReferenceMaterials({ dbPath: file, apply: true });
    installQcRules({ dbPath: file, apply: true });
    if (fresh) {
        const connection = new Database(file), source = loadQcRunMigrationSource();
        try { connection.exec(source.schemaSql); } finally { connection.close(); }
        if (fresh === 'prisma') beforeGuards({ actor: 'system:fixture', file, qcBootstrap: 'FRESH_NONDEFERRED' });
    }
    return { file, labId, batchId, sampleId, workItemId, analysis, username, resultId };
}
function state(file) {
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try { return { objects: db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all(),
        tables: db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => ({ name,
            columns: db.prepare(`PRAGMA table_xinfo("${name}")`).all(), fks: db.prepare(`PRAGMA foreign_key_list("${name}")`).all(),
            rows: db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all() })) }; }
    finally { db.close(); }
}
function apply(f) {
    const plan = installQcRuns({ dbPath: f.file });
    return installQcRuns({ dbPath: f.file, apply: true, planSha256: plan.backfillFingerprint });
}
function evaluated(extra = {}) { return { blanks: [], duplicates: [], controls: [], overallStatus: 'QC_PASS',
    summary: { evaluatedAt: recordedAt }, ...extra }; }
function snapshot(seq, qcResults, qcItems = []) {
    return { action: 'QC_EVIDENCE_SNAPSHOT', seq, reason: 'Recorded legacy change', snapshot: {
        qcResults, qcItems, status: 'QC_PASS', disposition: null, workItemIds: [],
        actor: { username: 'later-replacement-actor' }, timestamp: '2026-09-21T10:00:00.000Z' } };
}
function expectOriginalEvidence(reader, before) {
    for (const table of before.tables.filter(row => ['Batch', 'Sample', 'WorkItem', 'Result', 'BatchQcResult', 'AuditLog', 'User'].includes(row.name))) {
        expect(reader.prepare(`SELECT ${table.columns.map(row => `"${row.name}"`).join(',')} FROM "${table.name}" ORDER BY rowid`).all()).toEqual(table.rows);
    }
}
afterAll(() => { for (const file of files) if (fs.existsSync(file)) { fs.chmodSync(file, 0o600); fs.unlinkSync(file); } });

test('fresh Prisma DDL installs deferred FKs once and records its empty-table bootstrap (Linux exercises actual db push)', () => {
    const file = assertOwnedTestDatabase(path.resolve(__dirname, '../.tmp', `audit_prisma_qc_${randomUUID()}.db`), 'system:fixture');
    files.push(file);
    beforeGuards({ actor: 'system:fixture', file, qcBootstrap: 'CREATE_PRISMA' });
    const connection = new Database(file);
    try {
        connection.exec('CREATE TABLE "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)');
        for (const table of ['QcMeasurement', 'BatchPositionReference']) expect(connection.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(table).sql)
            .not.toContain('DEFERRABLE INITIALLY DEFERRED');
    } finally { connection.close(); }
    installReferenceMaterials({ dbPath: file, apply: true }); installQcRules({ dbPath: file, apply: true });
    const before = state(file), digest = hash(file), plan = installQcRuns({ dbPath: file });
    expect(plan).toMatchObject({ classification: 'FRESH_PRISMA', bootstrapRebuild: ['QcMeasurement', 'BatchPositionReference'], totalChanges: 0 });
    expect(hash(file)).toBe(digest); expect(state(file)).toEqual(before);
    const outcome = installQcRuns({ dbPath: file, apply: true });
    expect(outcome).toMatchObject({ classification: 'COMPLETE', bootstrapRebuild: ['QcMeasurement', 'BatchPositionReference'], backfillCount: 0 });
    const reader = new Database(file, { readonly: true });
    try {
        for (const table of ['QcMeasurement', 'BatchPositionReference']) expect(reader.prepare('SELECT sql FROM sqlite_master WHERE name=?').get(table).sql)
            .toContain('DEFERRABLE INITIALLY DEFERRED');
        expect(JSON.parse(reader.prepare('SELECT details FROM _schema_migrations WHERE id=?').get('186_normalized_qc_runs').details).bootstrapRebuild)
            .toEqual(['QcMeasurement', 'BatchPositionReference']);
        for (const table of before.tables.filter(row => !['QcMeasurement', 'BatchPositionReference', '_schema_migrations'].includes(row.name))) {
            expect(reader.prepare(`SELECT * FROM "${table.name}" ORDER BY rowid`).all()).toEqual(table.rows);
            expect(reader.prepare('PRAGMA table_xinfo("' + table.name + '")').all()).toEqual(table.columns);
            expect(reader.prepare('PRAGMA foreign_key_list("' + table.name + '")').all()).toEqual(table.fks);
        }
        expect(reader.pragma('integrity_check', { simple: true })).toBe('ok'); expect(reader.pragma('foreign_key_check')).toEqual([]);
    } finally { reader.close(); }
    const applied = hash(file);
    expect(installQcRuns({ dbPath: file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0, bootstrapRebuild: ['QcMeasurement', 'BatchPositionReference'] });
    expect(assertQcRunStartupReady(file).totalChanges).toBe(0); expect(hash(file)).toBe(applied);
}, 30000);

test.each(['BatchAnalyte', 'BatchPosition', 'BatchPositionWorkItem', 'BatchPositionReference', 'QcMeasurement', 'QcEvaluation', 'BatchDisposition', 'BatchEvent'])
('fresh Prisma bootstrap refuses a seeded %s row without changing any bytes, schema or evidence', table => {
    const f = fixture({ fresh: 'prisma', membership: true }), db = new Database(f.file), p = randomUUID();
    try {
        if (table === 'BatchAnalyte') insert(db, table, { id: randomUUID(), batchId: f.batchId, labId: f.labId, analysisCode: f.analysis, provenance: 'PROFILE_ONLY', status: 'OPEN' });
        if (['BatchPosition', 'BatchPositionWorkItem', 'BatchPositionReference', 'QcMeasurement'].includes(table)) insert(db, 'BatchPosition', { id: p, batchId: f.batchId, position: 1,
            kind: table === 'BatchPositionWorkItem' ? 'SAMPLE' : table === 'BatchPositionReference' ? 'LRM' : 'BLANK',
            sampleId: table === 'BatchPositionWorkItem' ? f.sampleId : null, provenance: 'PROFILE_ONLY' });
        if (table === 'BatchPositionWorkItem') insert(db, table, { id: randomUUID(), positionId: p, workItemId: f.workItemId, analysisCode: f.analysis });
        if (table === 'BatchPositionReference') {
            const lot = randomUUID(); insert(db, 'ReferenceMaterial', { id: lot, labId: f.labId, code: lot, name: 'Bootstrap refusal fixture', kind: 'LRM', matrix: 'SOIL', lotNumber: lot, status: 'ACTIVE', createdBy: f.username });
            insert(db, table, { id: randomUUID(), positionId: p, analysisCode: f.analysis, referenceMaterialId: lot, referenceUse: 'LRM', referenceSnapshot: '{}' });
        }
        if (table === 'QcMeasurement') insert(db, table, { id: randomUUID(), batchId: f.batchId, positionId: p, analysisCode: f.analysis, replicateNo: 1, value: .1, rawInput: '0.1' });
        if (table === 'QcEvaluation') insert(db, table, { id: randomUUID(), batchId: f.batchId, analysisCode: f.analysis, version: 1, verdict: 'INCOMPLETE', details: '{}' });
        if (table === 'BatchDisposition') insert(db, table, { id: randomUUID(), batchId: f.batchId, analysisCode: f.analysis, decision: 'REPEAT_BATCH', reason: 'Bootstrap refusal fixture' });
        if (table === 'BatchEvent') insert(db, table, { id: randomUUID(), batchId: f.batchId, type: 'RUN_BUILT', payload: '{}' });
    } finally { db.close(); }
    const before = state(f.file), digest = hash(f.file);
    for (const apply of [false, true]) expect(() => installQcRuns({ dbPath: f.file, apply })).toThrow(expect.objectContaining({ code: 'QC_RUN_INTEGRITY_REFUSED' }));
    expect(hash(f.file)).toBe(digest); expect(state(f.file)).toEqual(before);
});

test.each(['column', 'index', 'other column', 'other index', 'trigger', 'complete', 'late failure'])('fresh Prisma bootstrap refuses %s and preserves the exact original file', fault => {
    const f = fixture({ fresh: 'prisma' }), db = new Database(f.file);
    try {
        if (fault === 'column') db.exec('ALTER TABLE "QcMeasurement" ADD COLUMN foreignColumn TEXT');
        if (fault === 'index') db.exec('CREATE INDEX "foreign_qc_index" ON "QcMeasurement"("rawInput")');
        if (fault === 'other column') db.exec('ALTER TABLE "BatchEvent" ADD COLUMN foreignColumn TEXT');
        if (fault === 'other index') db.exec('CREATE INDEX "foreign_qc_event_index" ON "BatchEvent"("payload")');
        if (fault === 'trigger') db.exec('CREATE TRIGGER "foreign_qc_trigger" BEFORE INSERT ON "QcMeasurement" BEGIN SELECT 1; END');
        if (fault === 'late failure') db.exec("CREATE TRIGGER reject_qc_receipt BEFORE INSERT ON _schema_migrations WHEN NEW.id='186_normalized_qc_runs' BEGIN SELECT RAISE(ABORT,'injected QC receipt failure'); END");
    } finally { db.close(); }
    if (fault === 'complete') {
        apply(f); beforeGuards({ actor: 'system:fixture', file: f.file, qcBootstrap: 'COMPLETE_NONDEFERRED' });
    }
    const before = state(f.file), digest = hash(f.file);
    const reviewed = fault === 'late failure' ? installQcRuns({ dbPath: f.file }).backfillFingerprint : null;
    expect(() => installQcRuns({ dbPath: f.file, apply: true, planSha256: reviewed }))
        .toThrow(fault === 'late failure' ? 'injected QC receipt failure' : expect.objectContaining({ code: 'QC_RUN_SCHEMA_MISMATCH' }));
    expect(hash(f.file)).toBe(digest); expect(state(f.file)).toEqual(before);
});

test.each(['QcMeasurement', 'BatchPositionReference'])('the %s oracle exception requires exactly its deferred self-FK and refuses other DDL changes', table => {
    const f = fixture(), source = loadQcRunMigrationSource(), reader = new Database(f.file, { readonly: true });
    const clause = `CONSTRAINT "${table}_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "${table}" ("id") ON DELETE RESTRICT ON UPDATE CASCADE`;
    try {
        expect(classifyQcRunSchema(reader, source).classification).toBe('PRE_186');
        expect(() => classifyQcRunSchema(reader, { ...source, sql: source.sql.replace(`${clause} DEFERRABLE INITIALLY DEFERRED`, clause) }))
            .toThrow(expect.objectContaining({ code: 'QC_RUN_SOURCE_MISMATCH' }));
        const alteredOracle = { ...source.freshTables, [table]: source.freshTables[table].replace('ON DELETE RESTRICT ON UPDATE CASCADE', 'ON DELETE CASCADE ON UPDATE CASCADE') };
        expect(() => classifyQcRunSchema(reader, { ...source, freshTables: alteredOracle })).toThrow(expect.objectContaining({ code: 'QC_RUN_SOURCE_MISMATCH' }));
        const foreignSuffix = source.sql.replace('REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE',
            'REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED');
        expect(() => classifyQcRunSchema(reader, { ...source, sql: foreignSuffix })).toThrow(expect.objectContaining({ code: 'QC_RUN_SOURCE_MISMATCH' }));
    } finally { reader.close(); }
});

test.each([false, true])('an empty pinned historical QC inventory with no duplicateOf column imports only its receipt, retaining orphan audit refusal=%s', orphan => {
    const historical = beforeGuards({ actor: 'system:fixture', schemaVariant: 'PRE_1_3_SAMPLE_CODES', preMigrationSnapshot: true });
    const source = historical.preMigrationSnapshot.path, originalHash = hash(source);
    files.push(historical.file, source);
    const file = assertOwnedTestDatabase(path.resolve(__dirname, '../.tmp', `audit_empty_qc_${randomUUID()}.db`), 'system:fixture');
    fs.copyFileSync(source, file, fs.constants.COPYFILE_EXCL); fs.chmodSync(file, 0o600); files.push(file);
    const db = new Database(file);
    try {
        expect(db.prepare('PRAGMA table_info("WorkItem")').all().some(row => row.name === 'duplicateOf')).toBe(false);
        db.exec('CREATE TABLE IF NOT EXISTS "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)');
        if (orphan) insert(db, 'AuditLog', { id: randomUUID(), entity: 'BATCH', entityId: 'absent-batch', action: 'QC_EVIDENCE_SNAPSHOT',
            performedBy: 'recorded raw actor', timestamp: recordedAt, details: JSON.stringify(snapshot(1, evaluated())) });
    } finally { db.close(); }
    installReferenceMaterials({ dbPath: file, apply: true }); installQcRules({ dbPath: file, apply: true });
    const before = state(file), digest = hash(file), dry = installQcRuns({ dbPath: file });
    expect(dry.backfillCount).toBe(0);
    expect(dry.backfillCounts).toMatchObject({ batches: 0, samplePositions: 0, measurements: 0 });
    expect(hash(file)).toBe(digest);
    if (orphan) {
        expect(dry.refusals).toEqual([expect.objectContaining({ code: 'QC_LEGACY_BATCH_UNRESOLVED' })]);
        expect(() => installQcRuns({ dbPath: file, apply: true })).toThrow(expect.objectContaining({ code: 'QC_RUN_BACKFILL_REFUSED' }));
        expect(hash(file)).toBe(digest); expect(state(file)).toEqual(before);
    } else {
        expect(dry.refusals).toEqual([]);
        expect(installQcRuns({ dbPath: file, apply: true })).toMatchObject({ mode: 'APPLIED', backfillCount: 0, totalChanges: 1 });
        const reader = new Database(file, { readonly: true });
        try { expectOriginalEvidence(reader, before); } finally { reader.close(); }
        const installed = hash(file);
        expect(installQcRuns({ dbPath: file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
        expect(assertQcRunStartupReady(file)).toMatchObject({ classification: 'COMPLETE', totalChanges: 0 });
        expect(hash(file)).toBe(installed);
    }
    expect(hash(source)).toBe(originalHash);
});

test.each([false, true])('additive install on fresh=%s preserves every old field and object; dry-run/repeat/startup change zero bytes', fresh => {
    const value = 0.012345678912345, f = fixture({ fresh, membership: true, status: 'QC_PASS', qcResults: JSON.stringify(evaluated({ blanks: [{ value, status: 'PASS' }] })) });
    const db = new Database(f.file);
    try { insert(db, 'BatchQcResult', { id: randomUUID(), batchId: f.batchId, type: 'BLANK', measured: value, status: 'PASS' }); }
    finally { db.close(); }
    const before = state(f.file), digest = hash(f.file), plan = installQcRuns({ dbPath: f.file });
    expect(plan).toMatchObject({ mode: 'DRY_RUN', totalChanges: 0, classification: fresh ? 'FRESH_PRISMA' : 'PRE_186',
        backfillCounts: { batches: 1, analytes: 1, samplePositions: 1, qcPositions: 1, measurements: 1, evaluations: 1, typedRows: 1, unresolvedMethods: 1 } });
    expect(hash(f.file)).toBe(digest);
    expect(() => assertQcRunStartupReady(f.file)).toThrow(expect.objectContaining({ code: 'QC_RUN_NOT_INSTALLED' }));
    expect(hash(f.file)).toBe(digest);
    expect(() => installQcRuns({ dbPath: f.file, apply: true })).toThrow(expect.objectContaining({ code: 'QC_RUN_PLAN_STALE' }));
    expect(hash(f.file)).toBe(digest);
    const outcome = apply(f);
    expect(outcome).toMatchObject({ mode: 'APPLIED', classification: 'COMPLETE', backfillCount: 7 });
    const reader = new Database(f.file, { readonly: true, fileMustExist: true });
    try {
        for (const table of before.tables) {
            const columns = table.columns.map(row => `"${row.name}"`).join(',');
            const query = `SELECT ${columns} FROM "${table.name}" ${table.name === '_schema_migrations' ? "WHERE id<>'186_normalized_qc_runs'" : ''} ORDER BY rowid`;
            if (!Object.hasOwn(loadQcRunMigrationSource().freshTables, table.name)) expect(reader.prepare(query).all()).toEqual(table.rows);
            if (table.name !== 'Batch') {
                expect(reader.prepare(`PRAGMA table_xinfo("${table.name}")`).all()).toEqual(table.columns);
                expect(reader.prepare(`PRAGMA foreign_key_list("${table.name}")`).all()).toEqual(table.fks);
            }
        }
        for (const old of before.objects.filter(row => row.name !== 'Batch')) expect(reader.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type=? AND name=?').get(old.type, old.name)).toEqual(old);
        expect(reader.prepare('SELECT value,rawInput,enteredBy,enteredAt,supersededById FROM QcMeasurement').all()).toEqual([{ value, rawInput: null, enteredBy: null, enteredAt: null, supersededById: null }]);
        expect(reader.prepare('SELECT startedAt,completedAt,instrumentId,analystUsername FROM Batch').get()).toEqual({ startedAt: null, completedAt: null, instrumentId: null, analystUsername: null });
        expect(reader.prepare('SELECT position,sampleId FROM BatchPosition WHERE kind=\'SAMPLE\'').get()).toEqual({ position: 5, sampleId: f.sampleId });
        expect(reader.pragma('integrity_check', { simple: true })).toBe('ok'); expect(reader.pragma('foreign_key_check')).toEqual([]);
    } finally { reader.close(); }
    const installed = state(f.file), installedHash = hash(f.file);
    expect(installQcRuns({ dbPath: f.file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0, backfillCount: 0 });
    expect(assertQcRunStartupReady(f.file)).toMatchObject({ classification: 'COMPLETE', totalChanges: 0 });
    expect(state(f.file)).toEqual(installed); expect(hash(f.file)).toBe(installedHash);
});

test('legacy attempts keep separate current membership in creation order with unchanged statuses and a dry-run group count', () => {
    const f = fixture({ membership: true, status: 'QC_FAIL', multipleAttempts: true });
    const acceptedId = 'accepted-attempt', completedId = 'completed-attempt';
    const before = state(f.file), digest = hash(f.file), dry = installQcRuns({ dbPath: f.file });
    expect(dry.refusals).toEqual([]);
    expect(dry.backfillCounts).toMatchObject({ samplePositions: 3, multiAttemptMembershipGroups: 1 });
    expect(hash(f.file)).toBe(digest);
    installQcRuns({ dbPath: f.file, apply: true, planSha256: dry.backfillFingerprint });
    const reader = new Database(f.file, { readonly: true });
    try {
        const positions = reader.prepare('SELECT p.*,j.workItemId,j.analysisCode FROM BatchPosition p JOIN BatchPositionWorkItem j ON j.positionId=p.id ORDER BY p.position').all();
        expect(positions.map(row => row.workItemId)).toEqual([f.workItemId, acceptedId, completedId]);
        expect(positions.map(row => row.position)).toEqual([5, 6, 7]);
        for (const [index, row] of positions.entries()) {
            expect(row).toMatchObject({ kind: 'SAMPLE', sampleId: f.sampleId, analysisCode: f.analysis, historicalSnapshotSeq: null, provenance: 'LEGACY_MIGRATED' });
            expect(JSON.parse(row.legacySource)).toMatchObject({ workItemId: [f.workItemId, acceptedId, completedId][index],
                workItemStatusAtImport: ['SUBMITTED', 'ACCEPTED', 'COMPLETED'][index], duplicateOfWorkItemId: index ? f.workItemId : null });
        }
        for (const table of before.tables.filter(row => ['Batch','WorkItem','BatchQcResult','AuditLog'].includes(row.name))) {
            expect(reader.prepare(`SELECT ${table.columns.map(row => `"${row.name}"`).join(',')} FROM "${table.name}" ORDER BY rowid`).all()).toEqual(table.rows);
        }
        expect(reader.pragma('foreign_key_check')).toEqual([]);
        expect(reader.pragma('integrity_check', { simple: true })).toBe('ok');
    } finally { reader.close(); }
});

test('reviewed REJECT_REANALYSIS imports a repeat with exact field provenance and no new work or analytical changes', () => {
    const reason = '  Repeat the recorded batch.\nKeep the original reason.  ';
    const disposition = JSON.stringify({ decision: 'REJECT_REANALYSIS', reason, by: 'retired raw actor', at: recordedAt }, null, 2);
    const f = fixture({ status: 'QC_FAIL', disposition, membership: true, result: true,
        qcResults: JSON.stringify(evaluated({ overallStatus: 'QC_FAIL', blanks: [{ value: 3.141592653589793, status: 'FAIL' }] })) });
    const before = state(f.file), digest = hash(f.file), dry = installQcRuns({ dbPath: f.file });
    expect(dry.refusals).toEqual([]);
    expect(dry.backfillCounts).toMatchObject({ legacyDispositionMapped: { REJECT_REANALYSIS: 1, ACCEPT_OPAQUE: 0 },
        dispositionAttribution: { AUDIT_LOG: 0, BATCH_DISPOSITION_FIELD: 1 } });
    expect(hash(f.file)).toBe(digest);
    apply(f);
    const reader = new Database(f.file, { readonly: true });
    try {
        const decision = reader.prepare('SELECT * FROM BatchDisposition').get();
        expect(decision).toMatchObject({ decision: 'REPEAT_BATCH', reason, decidedBy: 'retired raw actor', decidedAt: Date.parse(recordedAt) });
        expect(JSON.parse(decision.legacySource)).toMatchObject({ rawDecision: 'REJECT_REANALYSIS', payload: disposition,
            auditLogId: null, seq: null, attributionSource: 'BATCH_DISPOSITION_FIELD', actor: 'retired raw actor', actorUsername: null, timestamp: recordedAt });
        expect(reader.prepare('SELECT status FROM BatchAnalyte').get().status).toBe('REPEAT_ORDERED');
        expectOriginalEvidence(reader, before);
        expect(reader.pragma('foreign_key_check')).toEqual([]);
    } finally { reader.close(); }
});

test('reviewed ACCEPT on passing QC adds opaque evidence only, preserving source bytes, results and users', () => {
    const reason = '  Passing historical round accepted as recorded.  ';
    const disposition = '{ "decision": "ACCEPT", "reason": ' + JSON.stringify(reason) + ', "by": "departed analyst", "at": ' + JSON.stringify(recordedAt) + ' }';
    const f = fixture({ status: 'QC_PASS', disposition, membership: true, result: true,
        qcResults: JSON.stringify(evaluated({ blanks: [{ value: 0.0123456789, status: 'PASS' }] })) });
    const before = state(f.file), digest = hash(f.file), dry = installQcRuns({ dbPath: f.file });
    expect(dry.refusals).toEqual([]);
    expect(dry.backfillCounts).toMatchObject({ legacyDispositionMapped: { REJECT_REANALYSIS: 0, ACCEPT_OPAQUE: 1 },
        dispositionAttribution: { AUDIT_LOG: 0, BATCH_DISPOSITION_FIELD: 1 } });
    expect(hash(f.file)).toBe(digest);
    apply(f);
    const reader = new Database(f.file, { readonly: true });
    try {
        expect(reader.prepare('SELECT * FROM BatchDisposition').all()).toEqual([]);
        const events = reader.prepare("SELECT * FROM BatchEvent WHERE type='LEGACY_DISPOSITION'").all();
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ by: 'departed analyst', at: Date.parse(recordedAt) });
        expect(JSON.parse(events[0].payload)).toMatchObject({ rawDecision: 'ACCEPT', reason, payload: disposition,
            auditLogId: null, seq: null, attributionSource: 'BATCH_DISPOSITION_FIELD', actor: 'departed analyst', actorUsername: null, timestamp: recordedAt });
        expect(reader.prepare('SELECT status FROM BatchAnalyte').get().status).toBe('QC_PASS');
        expect(reader.prepare('SELECT flags,isValid FROM Result WHERE id=?').get(f.resultId)).toEqual({ flags: '[]', isValid: 1 });
        expectOriginalEvidence(reader, before);
    } finally { reader.close(); }
});

test('field attribution resolves an existing username exactly without creating an actor', () => {
    const f = fixture({ status: 'QC_PASS', disposition: username => JSON.stringify({ decision: 'ACCEPT', reason: 'Recorded pass', by: username, at: recordedAt }),
        qcResults: JSON.stringify(evaluated({ blanks: [{ value: 0.01, status: 'PASS' }] })) });
    const before = state(f.file);
    apply(f);
    const reader = new Database(f.file, { readonly: true });
    try {
        const event = reader.prepare("SELECT * FROM BatchEvent WHERE type='LEGACY_DISPOSITION'").get();
        expect(JSON.parse(event.payload)).toMatchObject({ actor: f.username, actorUsername: f.username });
        expectOriginalEvidence(reader, before);
    } finally { reader.close(); }
});

test('legacy texture aliases retain raw membership codes while sharing the recorded batch analyte and QC', () => {
    const f = fixture({ membership: true, status: 'QC_PASS', qcResults: JSON.stringify(evaluated({ blanks: [{ value: 0.0123456789, status: 'PASS' }] })) });
    const secondId = randomUUID(), methodId = randomUUID(), connection = new Database(f.file);
    try {
        insert(connection, 'Analysis', { code: 'TEXTURE', name: 'Recorded texture method' });
        insert(connection, 'Methodology', { id: methodId, analysisCode: 'TEXTURE', name: 'Recorded alias method', updatedAt: Date.now() });
        connection.prepare('UPDATE Batch SET analysis=? WHERE id=?').run('pSA', f.batchId);
        connection.prepare('UPDATE WorkItem SET analysis=?,methodologyId=?,createdAt=? WHERE id=?').run('TEXTURE', methodId, Date.parse(recordedAt), f.workItemId);
        insert(connection, 'WorkItem', { id: secondId, sampleId: f.sampleId, analysis: 'PSA', methodologyId: methodId, labId: f.labId,
            batchId: f.batchId, rackPosition: 8, status: 'IN_PROGRESS', createdAt: Date.parse(recordedAt) + 1000, updatedAt: Date.now() });
    } finally { connection.close(); }
    const before = state(f.file), dry = installQcRuns({ dbPath: f.file });
    expect(dry.refusals).toEqual([]);
    expect(dry.backfillCounts).toMatchObject({ analytes: 1, samplePositions: 2, measurements: 1, evaluations: 1, unresolvedMethods: 0, TEXTURE_ALIAS_MERGED: 2 });
    expect(dry.diagnostics).toContainEqual(expect.objectContaining({ code: 'TEXTURE_ALIAS_MERGED' }));
    apply(f);
    const reader = new Database(f.file, { readonly: true });
    try {
        const analytes = reader.prepare('SELECT * FROM BatchAnalyte').all();
        expect(analytes).toEqual([expect.objectContaining({ analysisCode: 'pSA', methodologyId: methodId, methodResolution: 'RESOLVED_LEGACY' })]);
        const positions = reader.prepare('SELECT * FROM BatchPosition ORDER BY position').all().map(position => ({ ...position,
            workItems: reader.prepare('SELECT * FROM BatchPositionWorkItem WHERE positionId=?').all(position.id), references: [] }));
        expect(positions.filter(row => row.kind === 'SAMPLE').map(row => JSON.parse(row.legacySource)))
            .toEqual(['TEXTURE', 'PSA'].map(workItemAnalysis => expect.objectContaining({ textureAlias: true, batchAnalysis: 'pSA', workItemAnalysis })));
        expect(positions.flatMap(row => row.workItems).map(row => row.analysisCode)).toEqual(['TEXTURE', 'PSA']);
        const evidence = require('../../services/qcRunViewService').currentAnalyteEvidence({ analysis: 'pSA', analytes, positions,
            measurements: reader.prepare('SELECT * FROM QcMeasurement').all(), evaluations: reader.prepare('SELECT * FROM QcEvaluation').all(), events: [], dispositions: [] }, 'pSA');
        expect(evidence.result).toBe('PASS');
        expect(evidence.positions.filter(row => row.kind === 'SAMPLE')).toHaveLength(2);
        expect(evidence.qcResults.blanks[0].value).toBe(0.0123456789);
        expectOriginalEvidence(reader, before);
    } finally { reader.close(); }
});

test.each([null, 'unparseable original time'])('field disposition retains raw missing/invalid time %s without assigning import time', at => {
    const disposition = JSON.stringify({ decision: 'ACCEPT', reason: 'Original reason', by: 'raw actor', ...(at !== null && { at }) });
    const f = fixture({ status: 'QC_PASS', disposition, qcResults: JSON.stringify(evaluated({ blanks: [{ value: 0.01, status: 'PASS' }] })) });
    apply(f);
    const reader = new Database(f.file, { readonly: true });
    try {
        const event = reader.prepare("SELECT * FROM BatchEvent WHERE type='LEGACY_DISPOSITION'").get();
        expect(event.at).toBeNull();
        expect(JSON.parse(event.payload)).toMatchObject({ payload: disposition, timestamp: at });
    } finally { reader.close(); }
});

test.each([['ACCEPT', 'QC_FAIL'], ['UNREVIEWED_DECISION', 'QC_PASS']])('%s on %s refuses dry-run/apply without a byte change', (decision, status) => {
    const f = fixture({ status, disposition: JSON.stringify({ decision, reason: 'Retained original', by: 'raw actor', at: recordedAt }),
        membership: true, result: true, qcResults: JSON.stringify(evaluated({ overallStatus: status, blanks: [{ value: 0.01, status: status === 'QC_PASS' ? 'PASS' : 'FAIL' }] })) });
    const before = state(f.file), digest = hash(f.file), dry = installQcRuns({ dbPath: f.file });
    expect(dry.refusals).toEqual([expect.objectContaining({ code: 'QC_LEGACY_DISPOSITION_UNRESOLVED' })]);
    expect(() => installQcRuns({ dbPath: f.file, apply: true, planSha256: dry.backfillFingerprint })).toThrow(expect.objectContaining({ code: 'QC_RUN_BACKFILL_REFUSED' }));
    expect(state(f.file)).toEqual(before); expect(hash(f.file)).toBe(digest);
});

test('a matching AuditLog disposition wins conflicts while both original sources remain unchanged', () => {
    const reason = '  Exact audit reason.  ';
    const disposition = JSON.stringify({ decision: 'ACCEPT', reason, by: 'field actor', at: 'bad field time' }, null, 2);
    const f = fixture({ status: 'QC_PASS', disposition, membership: true, result: true,
        qcResults: JSON.stringify(evaluated({ blanks: [{ value: 0.01, status: 'PASS' }] })) });
    const auditId = randomUUID(), db = new Database(f.file);
    try { insert(db, 'AuditLog', { id: auditId, entity: 'QC_BATCH', entityId: f.batchId, action: 'QC_DISPOSITION',
        performedBy: f.username, timestamp: recordedAt, details: `QC batch disposition recorded: ACCEPT. Reason: ${reason}` }); }
    finally { db.close(); }
    const before = state(f.file), dry = installQcRuns({ dbPath: f.file });
    expect(dry.refusals).toEqual([]);
    expect(dry.backfillCounts).toMatchObject({ dispositionAttribution: { AUDIT_LOG: 1, BATCH_DISPOSITION_FIELD: 0 }, dispositionAttributionConflicts: 1 });
    expect(dry.diagnostics).toContainEqual(expect.objectContaining({ code: 'DISPOSITION_ATTRIBUTION_CONFLICT' }));
    apply(f);
    const reader = new Database(f.file, { readonly: true });
    try {
        const event = reader.prepare("SELECT * FROM BatchEvent WHERE type='LEGACY_DISPOSITION'").get();
        expect(event).toMatchObject({ by: f.username, at: Date.parse(recordedAt) });
        expect(JSON.parse(event.payload)).toMatchObject({ rawDecision: 'ACCEPT', payload: disposition, reason,
            auditLogId: auditId, seq: null, attributionSource: 'AUDIT_LOG', actor: f.username, actorUsername: f.username, timestamp: recordedAt });
        expectOriginalEvidence(reader, before);
    } finally { reader.close(); }
});

test.each([0, 1, 2])('snapshot attribution uses decision provenance with %s matching QC_DISPOSITION rows', auditCount => {
    const event = snapshot(3, evaluated({ blanks: [{ value: 0.01, status: 'PASS' }] }));
    event.snapshot.disposition = { decision: 'ACCEPT', reason: 'Original historical acceptance', by: 'original decision actor', at: recordedAt };
    const f = fixture({ history: JSON.stringify([event]) }), auditId = randomUUID(), db = new Database(f.file);
    try {
        insert(db, 'AuditLog', { id: auditId, entity: 'BATCH', entityId: f.batchId, action: 'QC_EVIDENCE_SNAPSHOT',
            performedBy: 'later snapshot actor', timestamp: '2026-09-21T10:00:00.000Z', details: JSON.stringify(event) });
        for (let index = 0; index < auditCount; index++) insert(db, 'AuditLog', { id: `${auditId}-${index}`, entity: 'QC_BATCH', entityId: f.batchId,
            action: 'QC_DISPOSITION', performedBy: 'original decision actor', timestamp: recordedAt, details: JSON.stringify(event.snapshot.disposition) });
    }
    finally { db.close(); }
    const before = state(f.file);
    const digest = hash(f.file), dry = installQcRuns({ dbPath: f.file });
    if (auditCount === 2) {
        expect(dry.refusals).toEqual([expect.objectContaining({ code: 'QC_LEGACY_DISPOSITION_UNRESOLVED' })]);
        expect(() => apply(f)).toThrow(expect.objectContaining({ code: 'QC_RUN_BACKFILL_REFUSED' }));
        expect(state(f.file)).toEqual(before); expect(hash(f.file)).toBe(digest); return;
    }
    expect(dry.refusals).toEqual([]);
    apply(f);
    const reader = new Database(f.file, { readonly: true });
    try {
        const disposition = reader.prepare("SELECT * FROM BatchEvent WHERE type='LEGACY_DISPOSITION'").get();
        expect(disposition).toMatchObject({ by: 'original decision actor', at: Date.parse(recordedAt) });
        expect(JSON.parse(disposition.payload)).toMatchObject({ auditLogId: auditCount ? `${auditId}-0` : null, seq: 3, actor: 'original decision actor',
            attributionSource: auditCount ? 'AUDIT_LOG' : 'SNAPSHOT_DISPOSITION_FIELD', timestamp: recordedAt,
            replacedBy: 'later snapshot actor', replacedAt: '2026-09-21T10:00:00.000Z', snapshotAuditRow: { id: auditId } });
        expectOriginalEvidence(reader, before);
    } finally { reader.close(); }
});

test('ambiguous matching disposition audits refuse rather than falling back to the Batch field', () => {
    const f = fixture({ status: 'QC_PASS', disposition: JSON.stringify({ decision: 'ACCEPT', reason: 'Recorded field', by: 'field actor', at: recordedAt }),
        qcResults: JSON.stringify(evaluated({ blanks: [{ value: 0.01, status: 'PASS' }] })) });
    const db = new Database(f.file);
    try { for (let index = 0; index < 2; index++) insert(db, 'AuditLog', { id: randomUUID(), entity: 'QC_BATCH', entityId: f.batchId, action: 'QC_DISPOSITION',
        performedBy: f.username, timestamp: recordedAt, details: 'QC batch disposition recorded: ACCEPT. Reason: Recorded field' }); }
    finally { db.close(); }
    const digest = hash(f.file), dry = installQcRuns({ dbPath: f.file });
    expect(dry.refusals).toEqual([expect.objectContaining({ code: 'QC_LEGACY_DISPOSITION_UNRESOLVED', source: expect.objectContaining({ reason: 'AUDIT_ATTRIBUTION_UNRESOLVED' }) })]);
    expect(() => installQcRuns({ dbPath: f.file, apply: true, planSha256: dry.backfillFingerprint })).toThrow(expect.objectContaining({ code: 'QC_RUN_BACKFILL_REFUSED' }));
    expect(hash(f.file)).toBe(digest);
});

test('three snapshots with different counts and a final clear import exact isolated versions, AuditLog authority and empty current evidence', () => {
    const events = [snapshot(2, evaluated({ blanks: [{ value: 0.0000000123456789, status: 'PASS' }], duplicates: [{ value1: 7.123456789, value2: 7.123456780, status: 'PASS' }] })),
        snapshot(4, evaluated({ blanks: [{ value: 0.01, status: 'PASS' }, { value: -0.02, status: 'PASS' }], controls: [{ expected: 5, measured: 5.0123456789, status: 'PASS' }] })),
        snapshot(8, evaluated({ duplicates: [{ value1: 9.123456789, value2: 9.123456788, status: 'PASS' }] }))];
    const history = JSON.parse(JSON.stringify(events)); history[1].snapshot.qcResults.blanks[0].value = 999;
    history.push({ status: 'OPEN', changedBy: 'recorded-reopen-actor', timestamp: recordedAt });
    const f = fixture({ history: JSON.stringify(history) }), db = new Database(f.file);
    try { for (const event of events) insert(db, 'AuditLog', { id: randomUUID(), entity: 'BATCH', entityId: f.batchId,
        action: 'QC_EVIDENCE_SNAPSHOT', performedBy: 'recorded-audit-actor', timestamp: recordedAt, details: JSON.stringify(event) }); }
    finally { db.close(); }
    const before = state(f.file), dry = installQcRuns({ dbPath: f.file });
    expect(dry.backfillCounts).toMatchObject({ historicalSnapshots: 3, evaluations: 4, currentEvaluations: 1, measurements: 8, qcPositions: 6, historyAuditConflicts: 1 });
    apply(f);
    const reader = new Database(f.file);
    try {
        const evaluations = reader.prepare('SELECT * FROM QcEvaluation ORDER BY version').all();
        expect(evaluations.map(row => row.version)).toEqual([1, 2, 3, 4]);
        for (const [index, row] of evaluations.entries()) {
            expect(row.supersedesId).toBe(index ? evaluations[index - 1].id : null);
            const details = JSON.parse(row.details);
            const linked = details.measurementIds.map(id => reader.prepare('SELECT q.*,p.historicalSnapshotSeq FROM QcMeasurement q JOIN BatchPosition p ON p.id=q.positionId WHERE q.id=?').get(id));
            expect(linked.map(q => q.historicalSnapshotSeq)).toEqual(Array(linked.length).fill([2, 4, 8, null][index]));
            expect(row.evaluatedBy).toBeNull(); // Replacement actor is not a historical analyst.
        }
        expect(evaluations[3]).toMatchObject({ verdict: 'INCOMPLETE' });
        expect(JSON.parse(evaluations[3].details)).toMatchObject({ reason: 'LEGACY_CLEARED', measurementIds: [], positionIds: [] });
        expect(reader.prepare('SELECT kind FROM BatchPosition WHERE historicalSnapshotSeq IS NULL').all()).toEqual([]);
        expect(reader.prepare('SELECT value FROM QcMeasurement ORDER BY value').all().map(row => row.value)).toEqual([-0.02, 0.0000000123456789, 0.01, 5.0123456789, 7.123456780, 7.123456789, 9.123456788, 9.123456789]);
        expect(reader.prepare('SELECT supersededById FROM QcMeasurement').all().every(row => row.supersededById === null)).toBe(true);
        expect(reader.prepare('SELECT status,legacyMembershipFrozen FROM BatchAnalyte').get()).toEqual({ status: 'QC_PENDING', legacyMembershipFrozen: 1 });
        expect(reader.prepare('SELECT COUNT(*) n FROM BatchEvent WHERE type=\'REOPENED\'').get().n).toBe(1);
        const legacyTables = before.tables.filter(table => ['Batch', 'BatchQcResult', 'AuditLog'].includes(table.name));
        for (const table of legacyTables) expect(reader.prepare(`SELECT ${table.columns.map(row => `"${row.name}"`).join(',')} FROM "${table.name}" ORDER BY rowid`).all()).toEqual(table.rows);
        expect(() => reader.prepare('UPDATE BatchAnalyte SET legacyMembershipFrozen=0').run()).toThrow('BATCH_ANALYTE_EVIDENCE_IMMUTABLE');
    } finally { reader.close(); }
});

test('censored JSON wins over lossy typed rows; raw strings, null numeric values, limits and complete typed source are retained', () => {
    const entry = { value1: null, value2: null, rawInput: { value1: '<0.5', value2: '<LOQ' }, loq: 0.2,
        censoringLimits: [{ qualifier: '<', limit: 0.5, literalLoq: false }, { qualifier: '<', limit: 0.2, literalLoq: true }], status: 'PASS', criterion: 'CENSORED_PAIR' };
    const f = fixture({ status: 'QC_PASS', qcResults: JSON.stringify(evaluated({ duplicates: [entry] })) }), db = new Database(f.file);
    const typed = { id: randomUUID(), batchId: f.batchId, type: 'DUPLICATE', value1: null, value2: null, status: 'FAIL', details: '{"lossy":true}' };
    try { insert(db, 'BatchQcResult', typed); } finally { db.close(); }
    expect(installQcRuns({ dbPath: f.file }).backfillCounts).toMatchObject({ typedJsonConflicts: 1, measurements: 2, typedFallbackEntries: 0 });
    apply(f);
    const reader = new Database(f.file);
    try {
        const observations = reader.prepare('SELECT * FROM QcMeasurement ORDER BY replicateNo').all();
        expect(observations).toEqual([expect.objectContaining({ value: null, rawInput: '<0.5', censoring: '<', censoringLimit: 0.5 }),
            expect.objectContaining({ value: null, rawInput: '<LOQ', censoring: '<', censoringLimit: 0.2 })]);
        for (const row of observations) expect(JSON.parse(row.legacySource)).toMatchObject({ valueSource: 'QC_RESULTS_JSON', typedRow: typed, entry });
        expect(reader.prepare('SELECT verdict FROM QcEvaluation').get().verdict).toBe('PASS');
    } finally { reader.close(); }
});

test('unparseable or absent JSON imports typed values unchanged with explicit fallback and preserves the unparseable bytes', () => {
    const f = fixture({ status: 'QC_FAIL', qcResults: '{bad-json' }), db = new Database(f.file);
    const typed = { id: randomUUID(), batchId: f.batchId, type: 'DUPLICATE', value1: 1.123456789, value2: -2.987654321, status: 'FAIL' };
    try { insert(db, 'BatchQcResult', typed); } finally { db.close(); }
    expect(installQcRuns({ dbPath: f.file }).backfillCounts).toMatchObject({ malformedQcResults: 1, typedFallbackEntries: 1, measurements: 2 });
    apply(f);
    const reader = new Database(f.file);
    try {
        expect(reader.prepare('SELECT value FROM QcMeasurement ORDER BY replicateNo').all()).toEqual([{ value: typed.value1 }, { value: typed.value2 }]);
        expect(JSON.parse(reader.prepare('SELECT legacySource FROM QcMeasurement LIMIT 1').get().legacySource).valueSource).toBe('TYPED_ROW');
        expect(reader.prepare('SELECT qcResults FROM Batch').get().qcResults).toBe('{bad-json');
    } finally { reader.close(); }
});

test('typed UUID ordering cannot manufacture conflicts or replace the authoritative JSON slot order', () => {
    const f = fixture({ status: 'QC_PASS', qcResults: JSON.stringify(evaluated({ blanks: [{ id: 'json-first', value: 0.02, status: 'PASS' }, { id: 'json-second', value: 0.01, status: 'PASS' }] })) });
    const db = new Database(f.file);
    try {
        insert(db, 'BatchQcResult', { id: 'typed-a', batchId: f.batchId, type: 'BLANK', measured: 0.01, status: 'PASS' });
        insert(db, 'BatchQcResult', { id: 'typed-z', batchId: f.batchId, type: 'BLANK', measured: 0.02, status: 'PASS' });
    } finally { db.close(); }
    expect(installQcRuns({ dbPath: f.file }).backfillCounts.typedJsonConflicts).toBe(0);
    apply(f);
    const reader = new Database(f.file);
    try {
        const observations = reader.prepare('SELECT q.value,q.legacySource FROM QcMeasurement q JOIN BatchPosition p ON p.id=q.positionId ORDER BY p.position').all();
        expect(observations.map(row => row.value)).toEqual([0.02, 0.01]);
        expect(observations.map(row => JSON.parse(row.legacySource).sourceRowId)).toEqual(['json-first', 'json-second']);
        expect(observations.map(row => JSON.parse(row.legacySource).typedRow.id)).toEqual(['typed-z', 'typed-a']);
    } finally { reader.close(); }
});

test('a canonical censored JSON string is kept as a null measurement with its limit, never coerced to a measured number', () => {
    const f = fixture({ status: 'QC_PASS', qcResults: JSON.stringify(evaluated({ duplicates: [{ value1: '<0.5', value2: '<LOQ', loq: 0.3, status: 'PASS' }] })) });
    apply(f);
    const reader = new Database(f.file);
    try {
        expect(reader.prepare('SELECT value,rawInput,censoring,censoringLimit FROM QcMeasurement ORDER BY replicateNo').all()).toEqual([
            { value: null, rawInput: null, censoring: '<', censoringLimit: 0.5 }, { value: null, rawInput: null, censoring: '<', censoringLimit: 0.3 }]);
        expect(JSON.parse(reader.prepare('SELECT legacySource FROM QcMeasurement WHERE replicateNo=1').get().legacySource).originalValue).toBe('<0.5');
    } finally { reader.close(); }
});

test('legacy method, instrument and analyst are set only from exact existing evidence and never receive a guessed start time', () => {
    const f = fixture({ membership: true, status: 'RUNNING' }), db = new Database(f.file), methodId = randomUUID(), assetId = randomUUID();
    try {
        insert(db, 'Analysis', { code: f.analysis, name: 'Recorded analysis' });
        insert(db, 'Methodology', { id: methodId, analysisCode: f.analysis, name: 'Recorded method', updatedAt: Date.now() });
        insert(db, 'EquipmentAsset', { id: assetId, labId: f.labId, assetType: 'OTHER', name: 'Legacy free text', status: 'IN_SERVICE', criticality: 'IMPORTANT', updatedAt: Date.now() });
        db.prepare('UPDATE WorkItem SET methodologyId=? WHERE id=?').run(methodId, f.workItemId);
        db.prepare('UPDATE Batch SET history=? WHERE id=?').run(JSON.stringify([{ status: 'RUNNING', changedBy: f.username, timestamp: recordedAt }]), f.batchId);
    } finally { db.close(); }
    expect(installQcRuns({ dbPath: f.file }).backfillCounts).toMatchObject({ unresolvedMethods: 0, unresolvedAnalysts: 0, unresolvedInstruments: 0 });
    apply(f);
    const reader = new Database(f.file);
    try {
        expect(reader.prepare('SELECT methodologyId,crmOrdinal,policyVersion,criteriaSnapshot FROM BatchAnalyte').get()).toEqual({ methodologyId: methodId, crmOrdinal: null, policyVersion: null, criteriaSnapshot: null });
        expect(reader.prepare('SELECT analystUsername,instrumentId,startedAt FROM Batch').get()).toEqual({ analystUsername: f.username, instrumentId: assetId, startedAt: null });
    } finally { reader.close(); }
});

test.each(['partial', 'marker', 'tampered'])('%s schema or receipt refuses with unchanged database bytes', variant => {
    const f = fixture(); if (variant === 'tampered') apply(f);
    const db = new Database(f.file);
    try {
        if (variant === 'partial') db.exec('ALTER TABLE Batch ADD COLUMN startedAt DATETIME');
        if (variant === 'marker') db.prepare('INSERT INTO _schema_migrations(id,details) VALUES (?,?)').run('186_normalized_qc_runs', '{}');
        if (variant === 'tampered') db.prepare('UPDATE _schema_migrations SET details=? WHERE id=?').run('{}', '186_normalized_qc_runs');
    } finally { db.close(); }
    const before = state(f.file), digest = hash(f.file);
    expect(() => installQcRuns({ dbPath: f.file, apply: true })).toThrow(expect.objectContaining({ code: 'QC_RUN_SCHEMA_MISMATCH' }));
    expect(() => assertQcRunStartupReady(f.file)).toThrow(expect.objectContaining({ code: 'QC_RUN_SCHEMA_MISMATCH' }));
    expect(state(f.file)).toEqual(before); expect(hash(f.file)).toBe(digest);
});

test.each(['negative', 'fractional', 'missing', 'extra', 'array', 'flat-negative'])('a %s disposition count receipt is refused by repeat install and startup without writes', variant => {
    const f = fixture(); apply(f);
    const db = new Database(f.file);
    try {
        const receipt = JSON.parse(db.prepare("SELECT details FROM _schema_migrations WHERE id='186_normalized_qc_runs'").get().details);
        if (variant === 'negative') receipt.backfillCounts.legacyDispositionMapped.ACCEPT_OPAQUE = -1;
        if (variant === 'fractional') receipt.backfillCounts.dispositionAttribution.AUDIT_LOG = 0.5;
        if (variant === 'missing') delete receipt.backfillCounts.dispositionAttribution.BATCH_DISPOSITION_FIELD;
        if (variant === 'extra') receipt.backfillCounts.legacyDispositionMapped.UNREVIEWED = 0;
        if (variant === 'array') receipt.backfillCounts.legacyDispositionMapped = [0, 0];
        if (variant === 'flat-negative') receipt.backfillCounts.measurements = -1;
        db.prepare("UPDATE _schema_migrations SET details=? WHERE id='186_normalized_qc_runs'").run(JSON.stringify(receipt));
    } finally { db.close(); }
    const before = state(f.file), digest = hash(f.file);
    expect(() => installQcRuns({ dbPath: f.file, apply: true })).toThrow(expect.objectContaining({ code: 'QC_RUN_SCHEMA_MISMATCH' }));
    expect(() => assertQcRunStartupReady(f.file)).toThrow(expect.objectContaining({ code: 'QC_RUN_SCHEMA_MISMATCH' }));
    expect(state(f.file)).toEqual(before); expect(hash(f.file)).toBe(digest);
});

test.each(['receipt', 'measurement'])('%s failure rolls back the entire reviewed import and DDL', fault => {
    const f = fixture({ fresh: fault === 'measurement', qcResults: JSON.stringify(evaluated({ duplicates: [{ value1: 7, value2: 7.01, status: 'PASS' }] })) }), db = new Database(f.file);
    try {
        if (fault === 'receipt') db.exec('CREATE TRIGGER qc186_receipt_fault BEFORE INSERT ON _schema_migrations WHEN NEW.id=\'186_normalized_qc_runs\' BEGIN SELECT RAISE(ABORT,\'OWNED_QC_RECEIPT_FAULT\'); END;');
    } finally { db.close(); }
    const before = state(f.file), digest = hash(f.file);
    const originalPrepare = Database.prototype.prepare;
    const injected = fault === 'measurement' ? jest.spyOn(Database.prototype, 'prepare').mockImplementation(function (sql) {
        const statement = originalPrepare.call(this, sql);
        if (!sql.startsWith('INSERT INTO "QcMeasurement"')) return statement;
        return { run(row) { if (row.replicateNo === 2) throw Error('OWNED_QC_MEASUREMENT_FAULT'); return statement.run(row); } };
    }) : null;
    try { expect(() => apply(f)).toThrow(fault === 'receipt' ? 'OWNED_QC_RECEIPT_FAULT' : 'OWNED_QC_MEASUREMENT_FAULT'); }
    finally { injected?.mockRestore(); }
    expect(state(f.file)).toEqual(before); expect(hash(f.file)).toBe(digest);
});

test('a stale fingerprint and malformed history refuse without writes; migration inventory is deterministic', () => {
    const f = fixture(), first = installQcRuns({ dbPath: f.file }), db = new Database(f.file);
    try { db.prepare('UPDATE Batch SET notes=?').run('Concurrent legacy change'); } finally { db.close(); }
    const digest = hash(f.file);
    expect(() => installQcRuns({ dbPath: f.file, apply: true, planSha256: first.backfillFingerprint })).toThrow(expect.objectContaining({ code: 'QC_RUN_PLAN_STALE' }));
    expect(hash(f.file)).toBe(digest);
    const malformed = fixture({ history: '{bad' }), malformedHash = hash(malformed.file), plan = installQcRuns({ dbPath: malformed.file });
    expect(plan.refusals).toEqual([expect.objectContaining({ code: 'QC_LEGACY_HISTORY_INVALID' })]);
    expect(() => installQcRuns({ dbPath: malformed.file, apply: true, planSha256: plan.backfillFingerprint })).toThrow(expect.objectContaining({ code: 'QC_RUN_BACKFILL_REFUSED' }));
    expect(hash(malformed.file)).toBe(malformedHash);
    const reader = new Database(f.file, { readonly: true });
    try { expect(inventoryLegacyQcRuns(reader)).toEqual(inventoryLegacyQcRuns(reader)); } finally { reader.close(); }
});

test('the closed normalized-QC loader resolves only digest-bound segments and refuses aliasing, mutation or a shadow loader', () => {
    const source = loadQcRunMigrationSource();
    expect(source.sql).toBe(source.schemaSql + source.guardsSql);
    const header = "const {loadQcRunMigrationSource}=require('../services/qcRunMigrationSource');const source=loadQcRunMigrationSource();";
    for (const segment of ['sql', 'schemaSql', 'guardsSql', 'bootstrapSql']) expect(scanSource(header + `db.exec(source.${segment})`, 'scripts/qc-run-probe.js')).toEqual([]);
    for (const code of ['const alias=source;db.exec(alias.sql)', 'source.schemaSql=input;db.exec(source.schemaSql)', 'delete source.guardsSql;db.exec(source.guardsSql)', 'source.freshTables.BatchPosition=input;db.exec(source.sql)']) {
        expect(scanSource(header + code, 'scripts/qc-run-probe.js')).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'UNRESOLVED_WORKFLOW_SQL' })]));
    }
    expect(scanSource('function loadQcRunMigrationSource(){return {sql:input}};const source=loadQcRunMigrationSource();db.exec(source.sql)', 'scripts/qc-run-probe.js')).toHaveLength(1);
    expect(scanSource("const {loadQcRunMigrationSource}=require('../services/qcRunMigrationSource');db.exec(loadQcRunMigrationSource().schemaSql)", 'scripts/qc-run-probe.js')).toHaveLength(1);
    expect(scanSource(fs.readFileSync(path.resolve(__dirname, '../../scripts/install_qc_runs.js'), 'utf8'), 'scripts/install_qc_runs.js')).toEqual([]);
});

test('CLI defaults to dry-run and refuses repeated, conflicting or invalid arguments', () => {
    expect(parseArguments(['--db', 'owned.db']).apply).toBe(false);
    expect(parseArguments(['--apply', '--plan-sha256', 'a'.repeat(64)]).planSha256).toBe('a'.repeat(64));
    for (const args of [['--apply', '--dry-run'], ['--db'], ['--apply', '--apply'], ['--unknown'], ['--plan-sha256', 'invalid']]) expect(() => parseArguments(args)).toThrow(expect.objectContaining({ code: 'QC_RUN_ARGUMENT_INVALID' }));
});
