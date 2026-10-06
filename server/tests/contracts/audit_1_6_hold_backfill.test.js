const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { installSampleHolds } = require('../../scripts/install_sample_holds');
const { backfillSampleHolds, isoTimestamp, parseArguments } = require('../../scripts/backfill_sample_holds');
const { ACTIVE, COMPAT, isHeldSqlite } = require('../../services/sampleHoldService');
const files = [];
const now = new Date('2026-10-06T10:00:00Z');
const digest = value => createHash('sha256').update(value).digest('hex');
const marker = (extra = {}) => JSON.stringify({ untouched: { value: 'kept' }, provenanceHold: {
    status: ACTIVE, reason: 'REVISED_FIELD_EVIDENCE: original evidence', updatedAt: '2026-10-02T12:00:00Z', ...extra } });

function fixture(inputs = [{}]) {
    const samples = inputs.map(input => { const id = randomUUID(); return { id, originalId: id, status: 'EXPECTED',
        assignedLab: 'HOLD-BACKFILL-TEST', createdAt: new Date('2026-10-01T12:00:00Z'), updatedAt: new Date('2026-10-02T12:00:00Z'),
        metadata: marker(), ...input }; });
    const { file } = beforeGuards({ actor: 'system:fixture', samples });
    files.push(file);
    installSampleHolds({ dbPath: file, apply: true });
    withDb(file, db => db.prepare('INSERT INTO User (id,username,email,password,role,labId,isActive,updatedAt) VALUES (?,?,?,?,?,?,?,?)')
        .run(randomUUID(), 'backfill-operator', 'backfill-operator@fixture.test', 'fixture-password', 'LAB_MANAGER', 'HOLD-BACKFILL-TEST', 1, now.toISOString()));
    return { file, samples };
}
function withDb(file, callback) {
    const db = new Database(file, { fileMustExist: true });
    try { db.pragma('foreign_keys=ON'); return callback(db); } finally { db.close(); }
}
function state(file) {
    return withDb(file, db => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
        .map(({ name }) => ({ name, rows: db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all() })));
}
function audit(file, sampleId, timestamp, performedBy) {
    withDb(file, db => db.prepare('INSERT INTO AuditLog (id,entity,entityId,action,sampleId,timestamp,performedBy) VALUES (?,?,?,?,?,?,?)')
        .run(randomUUID(), 'SAMPLE', sampleId, 'KOBO_CONFLICTING_PROVENANCE', sampleId, timestamp, performedBy));
}
const dry = (file, extra = {}) => backfillSampleHolds({ dbPath: file, now, ...extra });
const apply = (file, plan, extra = {}) => backfillSampleHolds({ dbPath: file, now, apply: true, operator: 'backfill-operator', planSha256: plan.fingerprint, ...extra });
function mapping(file, plan) {
    const mappingPath = path.join(path.dirname(file), `hold_mapping_${randomUUID()}.json`);
    const bytes = JSON.stringify({ rows: plan.rows.filter(row => row.refusals.length).map(row => ({ sampleId: row.sampleId,
        fingerprint: row.fingerprint, raisedAt: '2026-10-02T12:00:00Z', raisedBy: 'system:kobo-sync',
        holdReason: 'Reviewed legacy provenance: original evidence retained', reviewer: 'reviewed-fixture-manager',
        reviewReason: 'Reviewed immutable field evidence for this mapping' })) });
    fs.writeFileSync(mappingPath, bytes); files.push(mappingPath);
    return { mappingPath, reviewedMappingSha256: digest(bytes) };
}
afterAll(() => { for (const file of files) if (fs.existsSync(file)) fs.unlinkSync(file); });

test('dry run maps earliest conflict audit verbatim and metadata plus mirror to one upper-bound hold without writes', () => {
    const mirror = JSON.stringify({ provenanceHold: { value: ACTIVE, source: 'KOBO', lastUpdatedAt: '2026-10-02T12:00:00Z', lastUpdatedBy: 'SYNC' } });
    const { file, samples } = fixture([{}, { fieldMetadata: mirror }]);
    audit(file, samples[0].id, '2026-10-03T12:00:00Z', 'later-original-actor');
    audit(file, samples[0].id, '2026-10-02T09:00:00Z', 'verbatim-conflict-actor');
    const before = state(file), hash = digest(fs.readFileSync(file));
    const plan = dry(file);
    expect(plan).toMatchObject({ mode: 'DRY_RUN', totalChanges: 0, markerCount: 2, proposedCount: 2, refusedCount: 0, upperBoundCount: 1 });
    expect(plan.rows.find(row => row.sampleId === samples[0].id)).toMatchObject({ triggeringUser: 'verbatim-conflict-actor',
        proposed: { raisedAt: '2026-10-02T09:00:00.000Z', raisedBy: 'system:kobo-sync', attributionSource: 'KOBO_CONFLICT_AUDIT' } });
    expect(plan.rows.find(row => row.sampleId === samples[1].id).proposed).toMatchObject({ raisedBy: 'system:kobo-sync', attributionSource: 'LEGACY_HOLD_UPDATED_AT', compatMarker: COMPAT });
    expect(state(file)).toEqual(before); expect(digest(fs.readFileSync(file))).toBe(hash);
    expect(apply(file, plan)).toMatchObject({ mode: 'APPLIED', backfillCount: 2, auditRowsAdded: 2, originalMetadataRowsChanged: 0, oldAuditRowsChanged: 0 });
    const after = state(file);
    const backfilled = after.find(row => row.name === 'AuditLog').rows.filter(row => row.action === 'HOLD_BACKFILLED');
    expect(backfilled.every(row => row.performedBy === 'backfill-operator')).toBe(true);
    expect(JSON.parse(backfilled.find(row => row.sampleId === samples[0].id).details).triggeringUser).toBe('verbatim-conflict-actor');
    expect(JSON.parse(after.find(row => row.name === '_schema_migrations').rows.find(row => row.id.startsWith('183_hold_backfill:')).details).operator).toBe('backfill-operator');
    for (const table of before) {
        if (table.name === 'SampleHold') expect(after.find(row => row.name === table.name).rows).toHaveLength(2);
        else if (table.name === 'AuditLog' || table.name === '_schema_migrations') {
            const rows = after.find(row => row.name === table.name).rows;
            expect(rows.slice(0, table.rows.length)).toEqual(table.rows);
        } else expect(after.find(row => row.name === table.name)).toEqual(table);
    }
    const appliedHash = digest(fs.readFileSync(file));
    expect(apply(file, dry(file))).toMatchObject({ mode: 'NO_OP', backfillCount: 0, totalChanges: 0 });
    expect(digest(fs.readFileSync(file))).toBe(appliedHash);
});

test.each([undefined, 'invalid', '2026-02-30T12:00:00Z', '2026-10-07T12:00:00Z', '2026-09-29T12:00:00Z'])
('missing or invalid timestamp %s refuses the whole plan with byte-identical database', updatedAt => {
    const { file } = fixture([{}, { metadata: marker({ updatedAt }) }]);
    const before = state(file), hash = digest(fs.readFileSync(file)), plan = dry(file);
    expect(plan.proposedCount).toBe(1); expect(plan.refusedCount).toBe(1);
    expect(() => apply(file, plan)).toThrow(expect.objectContaining({ code: 'HOLD_BACKFILL_MAPPING_REQUIRED' }));
    expect(state(file)).toEqual(before); expect(digest(fs.readFileSync(file))).toBe(hash);
});

test('wrapper-only and each malformed shape require reviewed fingerprints and retain every original byte after backfill', () => {
    const wrapper = JSON.stringify({ provenanceHold: { value: ACTIVE, source: 'KOBO', lastUpdatedBy: 'SYNC' } });
    const { file, samples } = fixture([{ metadata: '{ "unrelated": 1.2300 }', fieldMetadata: wrapper },
        { metadata: '{unparseable' }, { metadata: '["non-object root"]' }, { metadata: '{"provenanceHold":"non-object marker"}' }]);
    const before = state(file), initial = dry(file);
    expect(initial).toMatchObject({ markerCount: 4, refusedCount: 4, metadataRepairNeededCount: 3 });
    const review = mapping(file, initial), plan = dry(file, review);
    expect(plan).toMatchObject({ refusedCount: 0, proposedCount: 4, metadataRepairNeededCount: 3 });
    expect(apply(file, plan, review)).toMatchObject({ backfillCount: 4, metadataRepairNeededCount: 3 });
    const after = state(file);
    expect(after.find(row => row.name === 'Sample')).toEqual(before.find(row => row.name === 'Sample'));
    withDb(file, db => {
        const rows = db.prepare('SELECT * FROM SampleHold').all();
        expect(rows).toHaveLength(4);
        expect(rows.every(row => row.attributionSource === 'REVIEWED_MAPPING' && row.compatMarker === COMPAT)).toBe(true);
        for (const sample of samples) expect(isHeldSqlite(db, db.prepare('SELECT * FROM Sample WHERE id=?').get(sample.id))).toBe(true);
        const receipt = JSON.parse(db.prepare("SELECT details FROM _schema_migrations WHERE id LIKE '183_hold_backfill:%'").get().details);
        expect(receipt.metadataRepairNeededCount).toBe(3);
    });
    const applied = state(file), hash = digest(fs.readFileSync(file));
    expect(apply(file, dry(file, review), review)).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
    expect(state(file)).toEqual(applied); expect(digest(fs.readFileSync(file))).toBe(hash);
});

test('stale plan, stale reviewed bytes and changed marker fingerprints all refuse with zero writes', () => {
    const { file, samples } = fixture([{ metadata: marker({ reason: 'UNKNOWN_PRODUCER' }) }]);
    const initial = dry(file), review = mapping(file, initial), plan = dry(file, review);
    const before = state(file);
    expect(() => apply(file, { fingerprint: '0'.repeat(64) }, review)).toThrow(expect.objectContaining({ code: 'HOLD_BACKFILL_PLAN_STALE' }));
    expect(state(file)).toEqual(before);
    fs.appendFileSync(review.mappingPath, ' ');
    expect(() => dry(file, review)).toThrow(expect.objectContaining({ code: 'HOLD_MAPPING_SHA_MISMATCH' }));
    expect(state(file)).toEqual(before);
    const reviewedMappingSha256 = digest(fs.readFileSync(review.mappingPath));
    withDb(file, db => db.prepare('UPDATE Sample SET metadata=? WHERE id=?').run(marker({ reason: 'CHANGED_UNKNOWN_PRODUCER' }), samples[0].id));
    const changed = state(file);
    expect(() => apply(file, plan, { ...review, reviewedMappingSha256 })).toThrow(expect.objectContaining({ code: 'HOLD_MAPPING_STALE' }));
    expect(state(file)).toEqual(changed);
});

test('an audit insertion failure rolls back every hold, audit and migration marker', () => {
    const { file } = fixture([{}, {}]);
    withDb(file, db => db.exec("CREATE TRIGGER fixture_hold_audit_failure BEFORE INSERT ON AuditLog WHEN NEW.action='HOLD_BACKFILLED' BEGIN SELECT RAISE(ABORT,'Synthetic backfill audit failure'); END"));
    const plan = dry(file), before = state(file);
    expect(() => apply(file, plan)).toThrow('Synthetic backfill audit failure');
    expect(state(file)).toEqual(before);
});

test('active markers with only resolved bound holds remain held, and their diagnostics do not refuse unrelated valid rows', () => {
    const { file, samples } = fixture();
    const plan = dry(file); apply(file, plan);
    withDb(file, db => db.prepare('UPDATE SampleHold SET resolvedAt=?,resolvedBy=?,resolution=? WHERE sampleId=?')
        .run(now.toISOString(), 'reviewed-fixture-manager', 'Synthetic inconsistent marker fixture', samples[0].id));
    const inventory = dry(file);
    expect(inventory.rows[0]).toMatchObject({ action: 'ALREADY_BACKFILLED', refusals: [], diagnostics: ['HOLD_MARKER_INCONSISTENT'] });
    expect(inventory.alreadyBackfilledInconsistentCount).toBe(1);
    const before = state(file);
    expect(apply(file, inventory)).toMatchObject({ mode: 'NO_OP', totalChanges: 0, alreadyBackfilledInconsistentCount: 1 });
    expect(state(file)).toEqual(before);
    withDb(file, db => expect(isHeldSqlite(db, db.prepare('SELECT * FROM Sample WHERE id=?').get(samples[0].id))).toBe(true));
});

test.each(['{unparseable', '[]', 'null'])('unreadable fieldMetadata root %s without a marker is a repair diagnostic, never an invented Kobo hold', fieldMetadata => {
    const { file, samples } = fixture([{ metadata: '{}', fieldMetadata }, {}]);
    const before = state(file), plan = dry(file);
    expect(plan).toMatchObject({ proposedCount: 1, refusedCount: 0, metadataRepairNeededCount: 1 });
    expect(plan.rows.find(row => row.sampleId === samples[0].id)).toMatchObject({ action: 'METADATA_REPAIR_NEEDED',
        diagnostics: ['HOLD_MARKER_INVALID'], refusals: [], proposed: null });
    expect(apply(file, plan)).toMatchObject({ backfillCount: 1, metadataRepairNeededCount: 1 });
    withDb(file, db => {
        expect(db.prepare('SELECT count(*) n FROM SampleHold WHERE sampleId=?').get(samples[0].id).n).toBe(0);
        expect(isHeldSqlite(db, db.prepare('SELECT * FROM Sample WHERE id=?').get(samples[0].id))).toBe(true);
    });
    expect(state(file).find(row => row.name === 'Sample')).toEqual(before.find(row => row.name === 'Sample'));
});

test.each([
    [null, null, 'BACKFILL_OPERATOR_INVALID'], ['missing-user', null, 'BACKFILL_OPERATOR_INVALID'],
    ['system:kobo-sync', null, 'BACKFILL_OPERATOR_INVALID'], ['service:backfill', null, 'BACKFILL_OPERATOR_INVALID'],
    ['backfill-operator', { isActive: 0 }, 'BACKFILL_OPERATOR_INVALID'],
    ['backfill-operator', { role: 'SAMPLE_RECEPTION' }, 'BACKFILL_OPERATOR_FORBIDDEN'],
    ['backfill-operator', { labId: 'OUTSIDE-LAB' }, 'BACKFILL_OPERATOR_OUT_OF_SCOPE']
])('apply refuses operator %s with %p using %s and zero writes', (operator, changes, code) => {
    const { file } = fixture();
    if (changes) withDb(file, db => { for (const [key, value] of Object.entries(changes)) db.prepare(`UPDATE User SET "${key}"=? WHERE username='backfill-operator'`).run(value); });
    const plan = dry(file), before = state(file), bytes = digest(fs.readFileSync(file));
    expect(() => apply(file, plan, { operator })).toThrow(expect.objectContaining({ code }));
    expect(state(file)).toEqual(before); expect(digest(fs.readFileSync(file))).toBe(bytes);
});

test('CLI modes and ISO-8601 validation reject ambiguous input', () => {
    expect(() => parseArguments(['--apply', '--dry-run'])).toThrow(expect.objectContaining({ code: 'HOLD_BACKFILL_ARGUMENT_INVALID' }));
    expect(() => parseArguments(['--mapping'])).toThrow(expect.objectContaining({ code: 'HOLD_BACKFILL_ARGUMENT_INVALID' }));
    expect(isoTimestamp('2026-02-30T12:00:00Z')).toBeNull();
    expect(isoTimestamp('2026-10-02T12:00:00+02:00')).toBe('2026-10-02T10:00:00.000Z');
});
