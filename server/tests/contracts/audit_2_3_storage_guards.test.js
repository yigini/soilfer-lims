const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { installReferenceMaterials } = require('../../scripts/install_reference_materials');
const { installQcRules } = require('../../scripts/install_qc_rules');
const files = [];
const ddl = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261006000400_normalized_qc_runs/migration.sql'), 'utf8');
const now = Date.now();
function insert(db, table, data) {
    return db.prepare(`INSERT INTO "${table}" (${Object.keys(data).map(key => `"${key}"`).join(',')}) VALUES (${Object.keys(data).map(() => '?').join(',')})`).run(...Object.values(data));
}
function fixture() {
    const labId = randomUUID(), batchId = randomUUID(), legacyId = randomUUID(), sampleId = randomUUID(), workItemId = randomUUID();
    const a = `A-${randomUUID()}`, b = `B-${randomUUID()}`, user = 'system:fixture';
    const { file } = beforeGuards({ actor: user, schemaVariant: 'PRE_1_3_SAMPLE_CODES',
        relatedRows: { Lab: [{ id: labId, code: labId, name: 'QC storage fixture', country: 'GTM', updatedAt: now }],
            User: [{ id: user, username: user, email: 'fixture@example.test', password: 'hash', role: 'SUPER_ADMIN', updatedAt: now }] },
        samples: [{ id: sampleId, originalId: sampleId, assignedLab: labId, status: 'PROCESSING', updatedAt: now }],
        batches: [{ id: batchId, labId, analysis: a, status: 'OPEN', createdBy: user },
            { id: legacyId, labId, analysis: a, status: 'QC_PASS', createdBy: user, qcResults: '{"blanks":[{"value":0.0123456789}]}',
                workItemIds: '[]', disposition: '{"original":true}', history: '[{"original":"QC_PASS"}]' }],
        workItems: [{ id: workItemId, sampleId, analysis: a, labId, status: 'IN_PROGRESS', batchId, rackPosition: 1, updatedAt: now }] });
    files.push(file);
    const db = new Database(file, { fileMustExist: true });
    db.exec('CREATE TABLE IF NOT EXISTS "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)');
    db.close();
    installReferenceMaterials({ dbPath: file, apply: true });
    installQcRules({ dbPath: file, apply: true });
    const connection = new Database(file, { fileMustExist: true });
    connection.pragma('foreign_keys = ON');
    insert(connection, 'BatchQcResult', { id: randomUUID(), batchId: legacyId, type: 'BLANK', measured: 0.0123456789, status: 'PASS' });
    const before = { legacy: connection.prepare('SELECT * FROM Batch WHERE id=?').get(legacyId),
        typed: connection.prepare('SELECT * FROM BatchQcResult WHERE batchId=? ORDER BY id').all(legacyId) };
    connection.transaction(() => connection.exec(ddl))();
    const methods = [randomUUID(), randomUUID()];
    [a, b].forEach((code, index) => {
        insert(connection, 'Analysis', { code, name: 'Storage fixture analyte' });
        insert(connection, 'Methodology', { id: methods[index], analysisCode: code, name: 'Recorded storage method', updatedAt: now });
        insert(connection, 'BatchAnalyte', { id: randomUUID(), batchId, labId, analysisCode: code, methodologyId: methods[index], status: 'OPEN', provenance: 'NATIVE' });
    });
    return { db: connection, file, labId, batchId, legacyId, sampleId, workItemId, a, b, methods, user, before };
}
function position(f, kind = 'BLANK', extra = {}) {
    const id = randomUUID(), count = f.db.prepare('SELECT COALESCE(MAX(position),0) count FROM BatchPosition WHERE batchId=?').get(f.batchId).count;
    insert(f.db, 'BatchPosition', { id, batchId: f.batchId, position: count + 1, kind, provenance: 'NATIVE', ...extra });
    return id;
}
function start(f) {
    f.db.transaction(() => {
        f.db.prepare('UPDATE Batch SET startedAt=?,analystUsername=?,status=? WHERE id=?').run(now, f.user, 'RUNNING', f.batchId);
        f.db.prepare('UPDATE BatchAnalyte SET criteriaSnapshot=?,policyVersion=0,crmOrdinal=1,status=? WHERE batchId=?').run('{"fixture":"frozen criteria"}', 'IN_RUN', f.batchId);
    })();
}
function measurement(f, positionId, extra = {}) {
    return { id: randomUUID(), batchId: f.batchId, positionId, analysisCode: f.a, replicateNo: 1,
        value: 0.1, rawInput: '0.1', enteredBy: f.user, enteredAt: now, ...extra };
}
function evaluation(f, version = 1, extra = {}) {
    return { id: randomUUID(), batchId: f.batchId, analysisCode: f.a, version, verdict: 'PASS', policyVersion: 0,
        details: JSON.stringify({ criteriaSnapshot: '{"fixture":"frozen criteria"}' }), evaluatedBy: f.user, evaluatedAt: now, ...extra };
}
function reference(f, kind = 'LRM', codes = [f.a, f.b]) {
    const id = randomUUID(), unit = randomUUID();
    insert(f.db, 'Unit', { code: unit, display: 'Fixture unit', quantityKind: 'MASS_FRACTION', updatedAt: now });
    insert(f.db, 'ReferenceMaterial', { id, labId: f.labId, code: id, name: 'Reference fixture', kind, matrix: 'SOIL',
        lotNumber: id, status: 'ACTIVE', createdBy: f.user });
    const values = {};
    codes.forEach((code, i) => {
        const valueId = randomUUID();
        insert(f.db, 'ReferenceValue', { id: valueId, referenceMaterialId: id, analysisCode: code,
            assignedValue: i + 7, unit, valueType: kind === 'CRM' ? 'CERTIFIED' : 'LAB_ASSIGNED', createdBy: f.user });
        values[code] = valueId;
    });
    return { id, values };
}
function binding(f, p, lot, code = f.a, extra = {}) {
    const kind = f.db.prepare('SELECT kind FROM BatchPosition WHERE id=?').get(p).kind;
    return { id: randomUUID(), positionId: p, analysisCode: code, referenceMaterialId: lot.id,
        referenceValueId: kind === 'CCB' ? null : lot.values[code] || null, referenceUse: kind,
        referenceSnapshot: JSON.stringify({ referenceMaterialId: lot.id, referenceValueId: lot.values[code] || null, analysisCode: code }),
        boundBy: f.user, boundAt: now, ...extra };
}
afterAll(() => { for (const file of files) if (fs.existsSync(file)) fs.unlinkSync(file); });

test('additive DDL preserves legacy JSON and typed scientific values, and their freeze guards refuse new writes', () => {
    const f = fixture();
    try {
        const legacy = f.db.prepare('SELECT * FROM Batch WHERE id=?').get(f.legacyId);
        for (const [key, value] of Object.entries(f.before.legacy)) expect(legacy[key]).toEqual(value);
        expect(f.db.prepare('SELECT * FROM BatchQcResult WHERE batchId=? ORDER BY id').all(f.legacyId)).toEqual(f.before.typed);
        expect(() => f.db.prepare('UPDATE Batch SET qcResults=? WHERE id=?').run('{}', f.legacyId)).toThrow('BATCH_LEGACY_EVIDENCE_IMMUTABLE');
        expect(() => f.db.prepare('DELETE FROM BatchQcResult WHERE batchId=?').run(f.legacyId)).toThrow('BATCH_LEGACY_EVIDENCE_IMMUTABLE');
        expect(() => f.db.prepare('UPDATE BatchQcResult SET measured=1 WHERE batchId=?').run(f.legacyId)).toThrow('BATCH_LEGACY_EVIDENCE_IMMUTABLE');
        expect(f.db.pragma('integrity_check', { simple: true })).toBe('ok');
        expect(f.db.pragma('foreign_key_check')).toEqual([]);
    } finally { f.db.close(); }
});

test('native entry and evaluation refuse before start; first start and frozen criteria cannot be cleared on reopen', () => {
    const f = fixture();
    try {
        const p = position(f);
        expect(() => insert(f.db, 'QcMeasurement', measurement(f, p))).toThrow('QC_RUN_NOT_STARTED');
        expect(() => insert(f.db, 'QcEvaluation', evaluation(f))).toThrow('QC_RUN_NOT_STARTED');
        expect(f.db.prepare('SELECT COUNT(*) count FROM QcMeasurement').get().count).toBe(0);
        start(f);
        expect(() => f.db.prepare('UPDATE BatchAnalyte SET criteriaSnapshot=? WHERE batchId=?').run('{}', f.batchId)).toThrow('BATCH_ANALYTE_EVIDENCE_IMMUTABLE');
        expect(() => f.db.prepare('UPDATE Batch SET startedAt=NULL WHERE id=?').run(f.batchId)).toThrow('BATCH_RUN_METADATA_IMMUTABLE');
        f.db.prepare('UPDATE Batch SET status=? WHERE id=?').run('OPEN', f.batchId);
        expect(() => position(f)).toThrow('BATCH_MEMBERSHIP_FROZEN');
        expect(() => f.db.prepare('UPDATE WorkItem SET batchId=NULL WHERE id=?').run(f.workItemId)).toThrow('BATCH_MEMBERSHIP_FROZEN');
    } finally { f.db.close(); }
});

test('one-time measurement supersession and consecutive evaluations preserve both original versions', () => {
    const f = fixture();
    try {
        const p = position(f); start(f);
        const first = measurement(f, p), initial = evaluation(f);
        insert(f.db, 'QcMeasurement', first); insert(f.db, 'QcEvaluation', initial);
        expect(() => f.db.prepare('UPDATE QcMeasurement SET value=2 WHERE id=?').run(first.id)).toThrow('QC_MEASUREMENT_IMMUTABLE');
        const next = measurement(f, p, { value: 0.2, rawInput: '0.2', correctionReason: 'Recorded correction' });
        f.db.transaction(() => {
            f.db.prepare('UPDATE QcMeasurement SET supersededById=? WHERE id=?').run(next.id, first.id);
            insert(f.db, 'QcMeasurement', next);
            insert(f.db, 'QcEvaluation', evaluation(f, 2, { supersedesId: initial.id }));
        })();
        expect(f.db.prepare('SELECT value,supersededById FROM QcMeasurement WHERE id=?').get(first.id)).toEqual({ value: 0.1, supersededById: next.id });
        expect(f.db.prepare('SELECT COUNT(*) count FROM QcMeasurement').get().count).toBe(2);
        expect(f.db.prepare('SELECT version FROM QcEvaluation ORDER BY version').all()).toEqual([{ version: 1 }, { version: 2 }]);
        expect(() => f.db.prepare('UPDATE QcMeasurement SET supersededById=? WHERE id=?').run(randomUUID(), first.id)).toThrow('QC_MEASUREMENT_IMMUTABLE');
        expect(() => f.db.prepare('DELETE FROM QcEvaluation WHERE id=?').run(initial.id)).toThrow('QC_EVALUATION_IMMUTABLE');
        expect(() => insert(f.db, 'QcEvaluation', evaluation(f, 3, { supersedesId: initial.id }))).toThrow('QC_EVALUATION_INVALID');
    } finally { f.db.close(); }
});

test('failed correction rolls supersession back and evaluation cannot substitute later policy criteria', () => {
    const f = fixture();
    try {
        const p = position(f); start(f);
        const original = measurement(f, p); insert(f.db, 'QcMeasurement', original);
        const next = measurement(f, p, { value: 0.2 });
        expect(() => f.db.transaction(() => {
            f.db.prepare('UPDATE QcMeasurement SET supersededById=? WHERE id=?').run(next.id, original.id);
            insert(f.db, 'QcMeasurement', next);
        })()).toThrow('QC_MEASUREMENT_INVALID');
        expect(f.db.prepare('SELECT supersededById FROM QcMeasurement WHERE id=?').get(original.id).supersededById).toBeNull();
        expect(() => insert(f.db, 'QcEvaluation', evaluation(f, 1, { policyVersion: 1 }))).toThrow('QC_EVALUATION_CRITERIA_MISMATCH');
        expect(() => insert(f.db, 'QcEvaluation', evaluation(f, 1, { details: '{}' }))).toThrow('QC_EVALUATION_CRITERIA_MISMATCH');
        expect(f.db.prepare('SELECT COUNT(*) count FROM QcEvaluation').get().count).toBe(0);
    } finally { f.db.close(); }
});

test('native duplicate uses the sample parent and only replicate one; work-item joins cannot point to the duplicate', () => {
    const f = fixture();
    try {
        const parent = position(f, 'SAMPLE', { sampleId: f.sampleId });
        const duplicate = position(f, 'DUPLICATE', { sampleId: f.sampleId, duplicateOfPositionId: parent });
        insert(f.db, 'BatchPositionWorkItem', { id: randomUUID(), positionId: parent, workItemId: f.workItemId, analysisCode: f.a });
        expect(() => insert(f.db, 'BatchPositionWorkItem', { id: randomUUID(), positionId: duplicate, workItemId: f.workItemId, analysisCode: f.a })).toThrow('BATCH_POSITION_WORK_ITEM_INVALID');
        start(f);
        insert(f.db, 'QcMeasurement', measurement(f, parent));
        insert(f.db, 'QcMeasurement', measurement(f, duplicate));
        expect(() => insert(f.db, 'QcMeasurement', measurement(f, duplicate, { replicateNo: 2 }))).toThrow('QC_MEASUREMENT_INVALID');
        expect(f.db.prepare('SELECT COUNT(*) count FROM QcMeasurement').get().count).toBe(2);
    } finally { f.db.close(); }
});

test('legacy unknown start remains null while its retained freeze flag cannot be cleared', () => {
    const f = fixture();
    try {
        const id = randomUUID();
        insert(f.db, 'BatchAnalyte', { id, batchId: f.legacyId, labId: f.labId, analysisCode: f.a, status: 'QC_PASS',
            provenance: 'LEGACY_MIGRATED', legacyMembershipFrozen: 1, legacySource: '{"originalStatus":"QC_PASS"}' });
        f.db.prepare('UPDATE Batch SET status=? WHERE id=?').run('OPEN', f.legacyId);
        expect(f.db.prepare('SELECT startedAt FROM Batch WHERE id=?').get(f.legacyId).startedAt).toBeNull();
        expect(() => f.db.prepare('UPDATE BatchAnalyte SET legacyMembershipFrozen=0 WHERE id=?').run(id)).toThrow('BATCH_ANALYTE_EVIDENCE_IMMUTABLE');
        expect(() => insert(f.db, 'BatchPosition', { id: randomUUID(), batchId: f.legacyId, position: 1, kind: 'CONTROL', provenance: 'LEGACY_MIGRATED' })).toThrow('BATCH_MEMBERSHIP_FROZEN');
        expect(() => position(f, 'CONTROL')).toThrow('BATCH_POSITION_INVALID');
    } finally { f.db.close(); }
});

test('historical snapshot identity is immutable and unavailable to native positions', () => {
    const f = fixture();
    try {
        expect(() => position(f, 'BLANK', { historicalSnapshotSeq: 1 })).toThrow('BATCH_POSITION_INVALID');
        const id = randomUUID();
        insert(f.db, 'BatchPosition', { id, batchId: f.legacyId, position: 1, kind: 'CONTROL', provenance: 'LEGACY_MIGRATED', historicalSnapshotSeq: 7 });
        expect(() => f.db.prepare('UPDATE BatchPosition SET historicalSnapshotSeq=NULL WHERE id=?').run(id)).toThrow('BATCH_POSITION_INVALID');
        expect(f.db.prepare('SELECT historicalSnapshotSeq FROM BatchPosition WHERE id=?').get(id).historicalSnapshotSeq).toBe(7);
    } finally { f.db.close(); }
});

test('one physical reference lot retains separate analyte value snapshots and rejects conflicting current lots', () => {
    const f = fixture();
    try {
        const p = position(f, 'LRM'), lot = reference(f), other = reference(f);
        const first = binding(f, p, lot), second = binding(f, p, lot, f.b);
        insert(f.db, 'BatchPositionReference', first); insert(f.db, 'BatchPositionReference', second);
        expect(first.referenceValueId).not.toBe(second.referenceValueId);
        expect(JSON.parse(first.referenceSnapshot).analysisCode).toBe(f.a);
        expect(JSON.parse(second.referenceSnapshot).analysisCode).toBe(f.b);
        expect(() => insert(f.db, 'BatchPositionReference', binding(f, p, other))).toThrow('REFERENCE_POSITION_LOT_CONFLICT');
        expect(f.db.prepare('SELECT COUNT(*) count FROM BatchPositionReference').get().count).toBe(2);
        expect(() => f.db.prepare('UPDATE BatchPositionReference SET referenceSnapshot=? WHERE id=?').run('{}', first.id)).toThrow('QC_REFERENCE_IMMUTABLE');
        expect(() => f.db.prepare('DELETE FROM BatchPositionReference WHERE id=?').run(first.id)).toThrow('QC_REFERENCE_IMMUTABLE');
    } finally { f.db.close(); }
});

test('a two-analyte lot supersession is atomic and any missing second value leaves both original bindings current', () => {
    const f = fixture();
    try {
        const p = position(f, 'LRM'), initialLot = reference(f), incompleteLot = reference(f, 'LRM', [f.a]);
        const old = [binding(f, p, initialLot), binding(f, p, initialLot, f.b)];
        old.forEach(row => insert(f.db, 'BatchPositionReference', row));
        const replace = lot => {
            const next = [binding(f, p, lot, f.a, { correctionReason: 'Explicit lot correction' }),
                binding(f, p, lot, f.b, { correctionReason: 'Explicit lot correction' })];
            f.db.transaction(() => {
                old.forEach((row, i) => f.db.prepare('UPDATE BatchPositionReference SET supersededById=? WHERE id=?').run(next[i].id, row.id));
                next.forEach(row => insert(f.db, 'BatchPositionReference', row));
            })();
            return next;
        };
        expect(() => replace(incompleteLot)).toThrow('REFERENCE_USE_INCOMPATIBLE');
        expect(f.db.prepare('SELECT id FROM BatchPositionReference WHERE supersededById IS NULL ORDER BY id').all())
            .toEqual(old.map(row => ({ id: row.id })).sort((a, b) => a.id.localeCompare(b.id)));
        expect(f.db.prepare('SELECT COUNT(*) count FROM BatchPositionReference').get().count).toBe(2);
        const next = replace(reference(f));
        expect(f.db.prepare('SELECT COUNT(*) count FROM BatchPositionReference').get().count).toBe(4);
        expect(f.db.prepare('SELECT COUNT(*) count FROM BatchPositionReference WHERE supersededById IS NULL').get().count).toBe(2);
        old.forEach((row, i) => expect(f.db.prepare('SELECT supersededById FROM BatchPositionReference WHERE id=?').get(row.id).supersededById).toBe(next[i].id));
    } finally { f.db.close(); }
});

test('calibration binding keeps its physical use, and CCB may be unbound or traceable to a blank matrix without a value', () => {
    const f = fixture();
    try {
        const ccv = position(f, 'CCV'), ccb = position(f, 'CCB'), lot = reference(f, 'CHECK_STANDARD');
        insert(f.db, 'BatchPositionReference', binding(f, ccv, lot));
        expect(f.db.prepare('SELECT referenceUse FROM BatchPositionReference WHERE positionId=?').get(ccv).referenceUse).toBe('CCV');
        expect(() => insert(f.db, 'BatchPositionReference', binding(f, ccv, lot, f.b, { referenceUse: 'LRM' }))).toThrow('REFERENCE_USE_INCOMPATIBLE');
        start(f);
        insert(f.db, 'QcMeasurement', measurement(f, ccb));
        expect(f.db.prepare('SELECT COUNT(*) count FROM BatchPositionReference WHERE positionId=?').get(ccb).count).toBe(0);
        const blank = reference(f, 'BLANK_MATRIX', []);
        insert(f.db, 'BatchPositionReference', binding(f, ccb, blank));
        expect(f.db.prepare('SELECT referenceValueId FROM BatchPositionReference WHERE positionId=?').get(ccb).referenceValueId).toBeNull();
    } finally { f.db.close(); }
});

test('CRM ordinal uniqueness rolls a concurrent start back and append-only events and dispositions resist overwrites', () => {
    const f = fixture();
    try {
        const otherBatchId = randomUUID();
        insert(f.db, 'Batch', { id: otherBatchId, labId: f.labId, analysis: f.a, status: 'OPEN', createdBy: f.user });
        insert(f.db, 'BatchAnalyte', { id: randomUUID(), batchId: otherBatchId, labId: f.labId, analysisCode: f.a,
            methodologyId: f.methods[0], status: 'OPEN', provenance: 'NATIVE' });
        start(f);
        expect(() => start({ ...f, batchId: otherBatchId })).toThrow('UNIQUE constraint failed');
        expect(f.db.prepare('SELECT status,startedAt FROM Batch WHERE id=?').get(otherBatchId)).toEqual({ status: 'OPEN', startedAt: null });
        const event = { id: randomUUID(), batchId: f.batchId, type: 'REOPENED', payload: '{"reason":"Retained evidence"}', by: f.user, at: now };
        const disposition = { id: randomUUID(), batchId: f.batchId, analysisCode: f.a, decision: 'ACCEPT_WITH_DEVIATION',
            reason: 'Recorded manager decision', decidedBy: f.user, decidedAt: now };
        insert(f.db, 'BatchEvent', event); insert(f.db, 'BatchDisposition', disposition);
        expect(() => f.db.prepare('UPDATE BatchEvent SET payload=? WHERE id=?').run('{}', event.id)).toThrow('BATCH_EVENT_IMMUTABLE');
        expect(() => f.db.prepare('DELETE FROM BatchEvent WHERE id=?').run(event.id)).toThrow('BATCH_EVENT_IMMUTABLE');
        expect(() => f.db.prepare('UPDATE BatchDisposition SET reason=? WHERE id=?').run('changed', disposition.id)).toThrow('BATCH_DISPOSITION_IMMUTABLE');
        expect(() => f.db.prepare('DELETE FROM BatchDisposition WHERE id=?').run(disposition.id)).toThrow('BATCH_DISPOSITION_IMMUTABLE');
    } finally { f.db.close(); }
});
