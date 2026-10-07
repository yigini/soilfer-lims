const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { installReferenceMaterials } = require('../../scripts/install_reference_materials');
const { installQcRules } = require('../../scripts/install_qc_rules');
const { installQcRuns, assertQcRunStartupReady, parseArguments } = require('../../scripts/install_qc_runs');
const { loadQcRunMigrationSource } = require('../../services/qcRunMigrationSource');
const { inventoryLegacyQcRuns } = require('../../services/qcRunBackfillPlan');
const { scanSource } = require('../helpers/workflowWriteScanner');
const files = [], hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const recordedAt = '2026-09-20T09:15:00.000Z';
function insert(db, table, row) {
    db.prepare(`INSERT INTO "${table}" (${Object.keys(row).map(key => `"${key}"`).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row));
}
function fixture({ qcResults = null, history = null, status = 'OPEN', disposition = null, membership = false, fresh = false } = {}) {
    const labId = randomUUID(), batchId = randomUUID(), sampleId = randomUUID(), workItemId = randomUUID(), analysis = `Q-${randomUUID()}`;
    const username = `fixture-${randomUUID()}`, now = Date.now();
    const { file } = beforeGuards({ actor: 'system:fixture', schemaVariant: 'PRE_1_3_SAMPLE_CODES',
        relatedRows: { Lab: [{ id: labId, code: labId, name: 'QC import fixture', country: 'GTM', updatedAt: now }],
            User: [{ id: randomUUID(), username, email: `${username}@example.test`, password: 'hash', role: 'LAB_MANAGER', updatedAt: now }] },
        samples: membership ? [{ id: sampleId, originalId: sampleId, assignedLab: labId, status: 'PROCESSING', updatedAt: now }] : [],
        batches: [{ id: batchId, labId, analysis, status, createdBy: username, instrument: 'Legacy free text', qcResults, history, disposition,
            workItemIds: membership ? JSON.stringify([workItemId]) : '[]' }],
        workItems: membership ? [{ id: workItemId, sampleId, analysis, labId, status: 'IN_PROGRESS', batchId, rackPosition: 5, updatedAt: now }] : [] });
    files.push(file);
    const db = new Database(file, { fileMustExist: true });
    db.exec('CREATE TABLE IF NOT EXISTS "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)');
    db.close();
    installReferenceMaterials({ dbPath: file, apply: true });
    installQcRules({ dbPath: file, apply: true });
    if (fresh) {
        const connection = new Database(file), source = loadQcRunMigrationSource();
        try { connection.exec(source.schemaSql); } finally { connection.close(); }
    }
    return { file, labId, batchId, sampleId, workItemId, analysis, username };
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
afterAll(() => { for (const file of files) if (fs.existsSync(file)) fs.unlinkSync(file); });

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
    const f = fixture({ membership: true, status: 'QC_FAIL' }), connection = new Database(f.file);
    const acceptedId = 'accepted-attempt', completedId = 'completed-attempt', firstCreated = Date.parse('2026-09-19T09:00:00Z');
    try {
        connection.prepare('UPDATE WorkItem SET status=?,createdAt=? WHERE id=?').run('SUBMITTED', firstCreated, f.workItemId);
        for (const [id, status, createdAt] of [[acceptedId, 'ACCEPTED', firstCreated + 1], [completedId, 'COMPLETED', firstCreated + 2]]) {
            insert(connection, 'WorkItem', { id, sampleId: f.sampleId, analysis: f.analysis, labId: f.labId, batchId: f.batchId,
                duplicateOf: f.workItemId, rackPosition: 5, status, createdAt, updatedAt: createdAt });
        }
    } finally { connection.close(); }
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

test.each(['receipt', 'measurement'])('%s failure rolls back the entire reviewed import and DDL', fault => {
    const f = fixture({ fresh: fault === 'measurement', qcResults: JSON.stringify(evaluated({ duplicates: [{ value1: 7, value2: 7.01, status: 'PASS' }] })) }), db = new Database(f.file);
    try {
        if (fault === 'receipt') db.exec('CREATE TRIGGER qc186_receipt_fault BEFORE INSERT ON _schema_migrations WHEN NEW.id=\'186_normalized_qc_runs\' BEGIN SELECT RAISE(ABORT,\'OWNED_QC_RECEIPT_FAULT\'); END;');
        else db.exec('CREATE TRIGGER qc186_measurement_fault BEFORE INSERT ON QcMeasurement WHEN NEW.replicateNo=2 BEGIN SELECT RAISE(ABORT,\'OWNED_QC_MEASUREMENT_FAULT\'); END;');
    } finally { db.close(); }
    const before = state(f.file), digest = hash(f.file);
    expect(() => apply(f)).toThrow(fault === 'receipt' ? 'OWNED_QC_RECEIPT_FAULT' : 'OWNED_QC_MEASUREMENT_FAULT');
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
    for (const segment of ['sql', 'schemaSql', 'guardsSql']) expect(scanSource(header + `db.exec(source.${segment})`, 'scripts/qc-run-probe.js')).toEqual([]);
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
