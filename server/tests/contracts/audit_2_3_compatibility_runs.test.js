const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { installReferenceMaterials } = require('../../scripts/install_reference_materials');
const { installResultAttemptLinks } = require('../../scripts/install_result_attempt_links');
const { installSampleHolds } = require('../../scripts/install_sample_holds');
const { installQcRules } = require('../../scripts/install_qc_rules');
const { installQcRuns } = require('../../scripts/install_qc_runs');
const { createProfileRun, writeCompatibilityMeasurements, reopenCompatibilityRun } = require('../../services/qcCompatibilityRunService');
const { QC_RUN_INCLUDE, batchApiView, readQcRun } = require('../../services/qcRunViewService');
const policies = require('../../services/policyService');
const owned = [];
const input = (blank = 0.0123456789) => ({ blanks: [{ value: blank }], controls: [{ expected: 7.123456789, measured: 7.123456780 }],
    duplicates: [{ value1: 2.123456789, value2: 2.123456780 }, { value1: 2.123456789, value2: 2.123456780 }] });

async function fixture({ migrated = false, sampleMember = false } = {}) {
    const labId = randomUUID(), analysisCode = randomUUID(), username = 'system:fixture', batchId = randomUUID();
    const sampleId = randomUUID(), workItemId = randomUUID();
    const historical = beforeGuards({ actor: username, schemaVariant: 'PRE_1_3_SAMPLE_CODES',
        samples: sampleMember ? [{ id: sampleId, originalId: sampleId, assignedLab: labId, status: 'PROCESSING', updatedAt: Date.now() }] : [],
        workItems: sampleMember ? [{ id: workItemId, sampleId, labId, analysis: analysisCode, batchId, rackPosition: 3, status: 'IN_PROGRESS', updatedAt: Date.now() }] : [],
        batches: migrated ? [{ id: batchId, labId, analysis: analysisCode, status: 'OPEN', createdBy: username,
            qcResults: JSON.stringify({ blanks: [], controls: [], duplicates: [] }), workItemIds: JSON.stringify(sampleMember ? [workItemId] : []), history: '[]', profile: 'RACK_40' }] : [],
        relatedRows: { Lab: [{ id: labId, code: `CODE-${labId}`, name: 'Compatibility fixture lab', country: 'TEST', updatedAt: Date.now() }],
            User: [{ id: username, username, email: 'compatibility@example.test', password: 'fixture', role: 'SUPER_ADMIN', updatedAt: Date.now() }] } });
    const record = { file: historical.file, db: null }; owned.push(record);
    historical.applyPendingMigration({ migration: 'SAMPLE_CODES' });
    const connection = new Database(record.file, { fileMustExist: true });
    connection.exec('CREATE TABLE IF NOT EXISTS "_schema_migrations" ("id" TEXT PRIMARY KEY NOT NULL,"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"details" TEXT)');
    connection.close();
    installResultAttemptLinks({ dbPath: record.file, apply: true }); installSampleHolds({ dbPath: record.file, apply: true });
    installReferenceMaterials({ dbPath: record.file, apply: true }); installQcRules({ dbPath: record.file, apply: true });
    const dryRun = installQcRuns({ dbPath: record.file, apply: false });
    installQcRuns({ dbPath: record.file, apply: true, planSha256: dryRun.backfillFingerprint });
    const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${record.file}` }) }); record.db = db;
    const actor = { id: username, username, role: 'LAB_MANAGER', labId }, f = { db, file: record.file, actor, labId, analysisCode };
    await db.analysis.create({ data: { code: analysisCode, name: 'Compatibility fixture analysis' } });
    const batch = migrated ? batchApiView(await db.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE }))
        : await createProfileRun(db, actor, { analysis: analysisCode, profile: 'RACK_40' });
    return { ...f, batch };
}
async function evidence(db) {
    return JSON.parse(JSON.stringify(await Promise.all([db.batch.findMany({ orderBy: { id: 'asc' } }),
        db.batchAnalyte.findMany({ orderBy: { id: 'asc' } }), db.batchPosition.findMany({ orderBy: { id: 'asc' } }),
        db.qcMeasurement.findMany({ orderBy: { id: 'asc' } }), db.qcEvaluation.findMany({ orderBy: { id: 'asc' } }),
        db.batchEvent.findMany({ orderBy: { id: 'asc' } }), db.auditLog.findMany({ orderBy: { id: 'asc' } }), db.batchQcResult.findMany()]))) ;
}
afterAll(async () => {
    for (const { file, db } of owned) {
        if (db) await db.$disconnect();
        if (path.dirname(file) !== path.resolve(__dirname, '../.tmp') || !path.basename(file).startsWith('audit_legacy_')) throw new Error('Compatibility cleanup requires its owned file.');
        for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(`${file}${suffix}`)) fs.unlinkSync(`${file}${suffix}`);
    }
});

test('empty compatibility creation leaves all deprecated JSON null and resolves the laboratory profile', async () => {
    const f = await fixture(), raw = await f.db.batch.findUnique({ where: { id: f.batch.id } });
    expect([raw.qcResults, raw.workItemIds, raw.disposition, raw.history]).toEqual([null, null, null, null]);
    expect(f.batch.analytes[0]).toMatchObject({ provenance: 'PROFILE_ONLY', methodologyId: null, criteriaSnapshot: null, crmOrdinal: null });
    expect(f.batch.runProfile.profileKey).toBe('RACK_40');
    expect(await f.db.qcMeasurement.count()).toBe(0); expect(await f.db.qcEvaluation.count()).toBe(0);
});

test('normalized reads resolve the actor laboratory code while refusing another laboratory scope', async () => {
    const f = await fixture(), actor = { ...f.actor, labId: `CODE-${f.labId}` };
    expect((await readQcRun(f.db, f.batch.id, actor)).id).toBe(f.batch.id);
    await expect(readQcRun(f.db, f.batch.id, { ...actor, labId: 'OUTSIDE-FIXTURE-LAB' })).rejects.toMatchObject({ statusCode: 403 });
});

test.each([false, true])('profile/migrated ordinary resubmission retains every preceding row and isolates the current round (migrated=%s)', async migrated => {
    const f = await fixture({ migrated }), original = await f.db.batch.findUnique({ where: { id: f.batch.id } });
    const first = await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, input());
    expect(first.batch.status).toBe('QC_PASS');
    expect(first.batch.qcResults.blanks[0].value).toBe(0.0123456789);
    const oldMeasurements = await f.db.qcMeasurement.findMany({ orderBy: { id: 'asc' } });
    const oldEvaluations = await f.db.qcEvaluation.findMany({ orderBy: { version: 'asc' } });
    const reopened = await reopenCompatibilityRun(f.db, f.batch.id, f.actor, 'Reviewed instrument service requires a new QC round');
    expect(reopened.batch.status).toBe('OPEN'); expect(reopened.batch.qcResults).toBeNull(); expect(reopened.batch.qcItems).toEqual([]);
    expect(reopened.batch.measurements).toHaveLength(oldMeasurements.length);
    const second = await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, input(0.0223456789));
    for (const row of oldMeasurements) expect(await f.db.qcMeasurement.findUnique({ where: { id: row.id } })).toEqual(row);
    for (const row of oldEvaluations) expect(await f.db.qcEvaluation.findUnique({ where: { id: row.id } })).toEqual(row);
    expect(second.batch.qcResults.blanks).toHaveLength(1); expect(second.batch.qcResults.blanks[0].value).toBe(0.0223456789);
    expect(second.batch.qcResults.blanks[0].positionId).not.toBe(first.batch.qcResults.blanks[0].positionId);
    expect(second.batch.measurements).toHaveLength(oldMeasurements.length * 2);
    const latest = second.batch.analytes[0].evaluation, details = JSON.parse(latest.details);
    expect(latest).toMatchObject({ version: oldEvaluations.at(-1).version + 1, supersedesId: oldEvaluations.at(-1).id, verdict: 'PASS' });
    expect(details).toMatchObject({ entryMode: 'LEGACY_RESUBMISSION', actor: { id: f.actor.id, username: f.actor.username },
        reopenEventId: second.batch.events.find(row => row.type === 'REOPENED').id });
    expect(second.batch.positions.every(row => row.provenance === 'PROFILE_ONLY' && row.historicalSnapshotSeq === null)).toBe(true);
    const raw = await f.db.batch.findUnique({ where: { id: f.batch.id } });
    for (const key of ['qcResults', 'workItemIds', 'disposition', 'history']) expect(raw[key]).toBe(original[key]);
    expect(await f.db.batchQcResult.count()).toBe(0);
    const snapshots = second.batch.history.filter(event => event.action === 'QC_EVIDENCE_SNAPSHOT');
    expect(snapshots).toHaveLength(3); expect(snapshots.map(row => row.seq)).toEqual([1, 2, 3]);
    expect(snapshots[1].snapshot.qcItems).toEqual(JSON.parse(JSON.stringify(first.batch.qcItems)));
    expect((await f.db.auditLog.findMany({ where: { entityId: f.batch.id, action: 'QC_EVIDENCE_SNAPSHOT' }, orderBy: { timestamp: 'asc' } })).map(row => JSON.parse(row.details))).toEqual(snapshots);
});

test('a migrated INCOMPLETE clear can receive an ordinary full submission without inventing a correction or reopen', async () => {
    const f = await fixture({ migrated: true }), result = await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, input());
    expect(result.batch.analytes[0].result).toBe('PASS');
    expect(JSON.parse(result.batch.analytes[0].evaluation.details).reopenEventId).toBeNull();
    expect(result.batch.measurements.every(row => row.correctionReason === null && row.supersededById === null)).toBe(true);
    expect(result.batch.evaluations[0].verdict).toBe('INCOMPLETE'); expect(result.batch.evaluations).toHaveLength(2);
});

test('ordinary resubmission supersedes a changed real SAMPLE reading once and reuses an unchanged parent in the next round', async () => {
    const f = await fixture({ migrated: true, sampleMember: true }), parent = f.batch.positions.find(row => row.kind === 'SAMPLE');
    const pair = value1 => ({ ...input(), duplicates: input().duplicates.map(row => ({ ...row, value1, duplicateOfPositionId: parent.id })) });
    const first = await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, pair(2.123456789));
    const oldParent = await f.db.qcMeasurement.findFirst({ where: { positionId: parent.id } }), firstEval = first.batch.analytes[0].evaluation;
    await reopenCompatibilityRun(f.db, f.batch.id, f.actor, 'Reopen the migrated run for the next full submission');
    const second = await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, pair(2.124456789));
    const next = await f.db.qcMeasurement.findFirst({ where: { positionId: parent.id, supersededById: null } });
    expect(await f.db.qcMeasurement.findUnique({ where: { id: oldParent.id } })).toEqual({ ...oldParent, supersededById: next.id });
    expect(next).toMatchObject({ positionId: parent.id, replicateNo: 1, value: 2.124456789, correctionReason: 'LEGACY_RESUBMISSION' });
    expect(JSON.parse(next.legacySource).reopenEventId).toBe(JSON.parse(second.batch.analytes[0].evaluation.details).reopenEventId);
    expect(second.batch.qcResults.duplicates.every(row => row.duplicateOfPositionId === parent.id && row.value1 === next.value)).toBe(true);
    expect(JSON.parse(second.batch.analytes[0].evaluation.details).measurementIds).toContain(next.id);
    expect(JSON.parse(second.batch.analytes[0].evaluation.details).measurementIds).not.toContain(oldParent.id);
    expect(await f.db.qcEvaluation.findUnique({ where: { id: firstEval.id } })).toEqual(firstEval);
    const count = await f.db.qcMeasurement.count({ where: { positionId: parent.id } });
    await reopenCompatibilityRun(f.db, f.batch.id, f.actor, 'Reopen while retaining an unchanged parent observation');
    const third = await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, pair(2.124456789));
    expect(await f.db.qcMeasurement.count({ where: { positionId: parent.id } })).toBe(count);
    expect(JSON.parse(third.batch.analytes[0].evaluation.details).measurementIds).toContain(next.id);
    expect(await f.db.qcMeasurement.findUnique({ where: { id: next.id } })).toEqual(next);
});

test.each([null, '', true])('a submitted invalid value %s is refused before any snapshot, position, reading or evaluation write', async value => {
    const f = await fixture(), before = await evidence(f.db);
    await expect(writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, { ...input(), blanks: [{ value }] }))
        .rejects.toMatchObject({ statusCode: 400, code: 'QC_VALUES_MISSING' });
    expect(await evidence(f.db)).toEqual(before);
});

test('manager authority and reason are required for reopening, and failed evidence remains locked for every role', async () => {
    const f = await fixture(); await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, input());
    const before = await evidence(f.db);
    await expect(reopenCompatibilityRun(f.db, f.batch.id, { ...f.actor, role: 'LAB_TECHNICIAN' }, 'Reviewed new run'))
        .rejects.toMatchObject({ statusCode: 403, code: 'QC_REOPEN_PERMISSION_REQUIRED' });
    await expect(reopenCompatibilityRun(f.db, f.batch.id, f.actor, ' ')).rejects.toMatchObject({ statusCode: 400, code: 'REASON_REQUIRED' });
    expect(await evidence(f.db)).toEqual(before);
    await reopenCompatibilityRun(f.db, f.batch.id, f.actor, 'Reopen before a new ordinary round');
    const failed = await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, input(100));
    expect(failed.batch.status).toBe('QC_FAIL'); const locked = await evidence(f.db);
    for (const role of ['LAB_TECHNICIAN', 'LAB_MANAGER', 'SUPER_ADMIN']) {
        const actor = { ...f.actor, role };
        await expect(writeCompatibilityMeasurements(f.db, f.batch.id, actor, input())).rejects.toMatchObject({ statusCode: 409, code: 'QC_BATCH_LOCKED' });
        await expect(reopenCompatibilityRun(f.db, f.batch.id, actor, 'Failed evidence cannot reopen')).rejects.toMatchObject({ statusCode: 409, code: 'QC_BATCH_LOCKED' });
        expect(await evidence(f.db)).toEqual(locked);
    }
});

test('a late evaluation insertion failure rolls back the entire submission and both durable snapshot representations', async () => {
    const f = await fixture(), before = await evidence(f.db), connection = new Database(f.file, { fileMustExist: true });
    connection.exec("CREATE TRIGGER qc186_compatibility_abort BEFORE INSERT ON QcEvaluation BEGIN SELECT RAISE(ABORT,'QC186_COMPATIBILITY_ABORT'); END;"); connection.close();
    await expect(writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, input())).rejects.toThrow();
    expect(await evidence(f.db)).toEqual(before);
});

test('compatibility duplicate censoring retains raw input and null numeric observations in the new round', async () => {
    const f = await fixture(), result = await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor,
        { ...input(), duplicates: [{ value1: '<0.123456789', value2: '<0.123456789' }, { value1: '<LOQ', value2: '<LOQ' }] });
    expect(result.batch.status).toBe('QC_PASS');
    expect(result.batch.measurements.filter(row => row.censoring).every(row => row.value === null && row.censoring === '<')).toBe(true);
    expect(result.batch.qcResults.duplicates[0]).toMatchObject({ value1: null, value2: null, criterion: 'CENSORED_PAIR' });
});

test('the next compatibility submission resolves the current lab policy instead of freezing an empty profile method', async () => {
    const f = await fixture(); await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, input());
    await reopenCompatibilityRun(f.db, f.batch.id, f.actor, 'Reviewed policy revision before the next round');
    await policies.change({ ...f.actor, role: 'SUPER_ADMIN' }, f.labId, { reason: 'Reviewed compatibility blank limit',
        changes: [{ key: 'qc.blankMaxAllowed', value: 0.001 }] }, { db: f.db });
    const result = await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, input());
    expect(result.batch.status).toBe('QC_FAIL');
    expect(result.batch.evaluations[0].verdict).toBe('PASS'); expect(result.batch.evaluations[1].verdict).toBe('FAIL');
    expect(result.batch.analytes[0]).toMatchObject({ criteriaSnapshot: null, crmOrdinal: null });
});
