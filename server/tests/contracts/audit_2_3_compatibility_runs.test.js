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
const { correctCompatibilityMeasurements } = require('../../services/qcCompatibilityCorrectionService');
const { QC_RUN_INCLUDE, batchApiView, readQcRun } = require('../../services/qcRunViewService');
const { changeRunMembers } = require('../../services/qcRunMembershipService');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { dispositionBatch } = require('../../services/qcDispositionStateService');
const { createResultFixture } = require('../../services/resultWriteService');
const policies = require('../../services/policyService');
const request = require('supertest');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const owned = [];
const input = (blank = 0.0123456789) => ({ blanks: [{ value: blank }], controls: [{ expected: 7.123456789, measured: 7.123456780 }],
    duplicates: [{ value1: 2.123456789, value2: 2.123456780 }, { value1: 2.123456789, value2: 2.123456780 }] });

async function fixture({ migrated = false, sampleMember = false, finalClear = false, legacyRepeat = false, multiAnalyte = false } = {}) {
    const labId = randomUUID(), analysisCode = randomUUID(), username = 'system:fixture', batchId = randomUUID();
    const sampleId = randomUUID(), workItemId = randomUUID(), secondCode = randomUUID(), secondItemId = randomUUID();
    const members = sampleMember ? [{ id: workItemId, sampleId, labId, analysis: analysisCode, batchId, rackPosition: 3,
        status: legacyRepeat ? 'REPEAT_REQUIRED' : 'IN_PROGRESS', updatedAt: Date.now() },
        ...(multiAnalyte ? [{ id: secondItemId, sampleId, labId, analysis: secondCode, batchId, rackPosition: 3, status: 'IN_PROGRESS', updatedAt: Date.now() }] : [])] : [];
    const historical = beforeGuards({ actor: username, schemaVariant: 'PRE_1_3_SAMPLE_CODES',
        samples: sampleMember ? [{ id: sampleId, originalId: sampleId, assignedLab: labId, status: 'PROCESSING', updatedAt: Date.now() }] : [],
        workItems: members,
        batches: migrated ? [{ id: batchId, labId, analysis: analysisCode, status: legacyRepeat ? 'QC_FAIL' : 'OPEN', createdBy: username,
            ...(legacyRepeat && { disposition: JSON.stringify({ decision: 'REJECT_REANALYSIS', reason: 'Recorded repeat required', by: username, at: '2026-09-20T09:00:00Z' }) }),
            qcResults: JSON.stringify(legacyRepeat ? { ...input(10), overallStatus: 'QC_FAIL' } : { blanks: [], controls: [], duplicates: [] }), workItemIds: JSON.stringify(members.map(row => row.id)),
            history: JSON.stringify([{ status: 'OPEN', changedBy: username, timestamp: new Date().toISOString() },
                ...(finalClear ? [{ action: 'QC_EVIDENCE_SNAPSHOT', seq: 1, snapshot: { status: 'QC_PASS',
                    qcResults: JSON.stringify({ ...input(), overallStatus: 'QC_PASS' }), qcItems: [], disposition: null,
                    workItemIds: sampleMember ? [workItemId] : [] } }] : [])]), profile: 'RACK_40' }] : [],
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
    require('../../scripts/install_qc_gate_scope').installQcGateScope({ dbPath: record.file, apply: true });
    require('../../scripts/install_proficiency_evidence').installProficiencyEvidence({ dbPath: record.file, apply: true });
    require('../../scripts/install_nonconformity_reports').installNonconformityReports({ dbPath: record.file, apply: true });
    require('../../scripts/install_batch_reagent_lots').installBatchReagentLots({ dbPath: record.file, apply: true });
    require('../../scripts/install_result_equipment_evidence').installResultEquipmentEvidence({ dbPath: record.file, apply: true });
    const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${record.file}` }) }); record.db = db;
    const actor = { id: username, username, role: 'LAB_MANAGER', labId }, f = { db, file: record.file, actor, labId, analysisCode };
    await db.analysis.create({ data: { code: analysisCode, name: 'Compatibility fixture analysis' } });
    if (multiAnalyte) await db.analysis.create({ data: { code: secondCode, name: 'Second compatibility fixture analysis' } });
    const batch = migrated ? batchApiView(await db.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE }))
        : await createProfileRun(db, actor, { analysis: analysisCode, profile: 'RACK_40' });
    return { ...f, batch, secondCode };
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

async function unbatchedMember(f) {
    const sampleId = randomUUID();
    await createSampleFixture(f.db, { data: { id: sampleId, originalId: sampleId, assignedLab: f.labId, status: 'PROCESSING' } });
    return createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId, labId: f.labId, assignedLab: f.labId,
        analysis: f.analysisCode, status: 'ASSIGNED' } });
}

test.each([null, 'REPEAT_BATCH', 'REJECT'])('a migrated sibling status change preserves failed/dispositioned evidence and result flags (%s)', async decision => {
    const f = await fixture({ migrated: true, sampleMember: true, multiAnalyte: true });
    expect(f.batch.analytes.map(row => row.provenance)).toEqual(['LEGACY_MIGRATED', 'LEGACY_MIGRATED']);
    const parentFor = code => f.batch.positions.find(row => row.kind === 'SAMPLE' && row.workItems.some(link => link.analysisCode === code));
    const parent = parentFor(f.analysisCode);
    const payload = (code, blank) => ({ ...input(blank), analysisCode: code,
        duplicates: input().duplicates.map(row => ({ ...row, duplicateOfPositionId: parentFor(code).id })) });
    const failedResult = await createResultFixture(f.db, { data: { id: randomUUID(), sampleId: parent.sampleId,
        param: f.analysisCode, batchId: f.batch.id, value: '2.123456789', numericValue: 2.123456789, isValid: true, flags: '[]' } });
    await createResultFixture(f.db, { data: { ...failedResult, id: randomUUID(), param: f.secondCode } });
    await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, payload(f.analysisCode, 100));
    if (decision) await dispositionBatch(f.batch.id, decision, 'Reviewed failed analyte requires a new run', f.actor, f.db, { analysisCode: f.analysisCode });
    const retained = async () => ({ analyte: await f.db.batchAnalyte.findFirst({ where: { batchId: f.batch.id, analysisCode: f.analysisCode } }),
        measurements: await f.db.qcMeasurement.findMany({ where: { analysisCode: f.analysisCode }, orderBy: { id: 'asc' } }),
        evaluations: await f.db.qcEvaluation.findMany({ where: { analysisCode: f.analysisCode }, orderBy: { id: 'asc' } }),
        dispositions: await f.db.batchDisposition.findMany({ where: { analysisCode: f.analysisCode } }),
        result: await f.db.result.findUnique({ where: { id: failedResult.id } }),
        work: await f.db.workItem.findMany({ where: { batchId: f.batch.id, analysis: f.analysisCode } }) });
    const before = await retained(), lockedStatus = decision === 'REJECT' ? 'REJECTED' : decision ? 'REPEAT_ORDERED' : 'QC_FAIL';
    expect(before.analyte.status).toBe(lockedStatus);
    expect(before.result.isValid).toBe(false);
    await f.db.user.update({ where: { username: f.actor.username }, data: { role: 'LAB_TECHNICIAN', labId: f.labId } });
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const auth = { Authorization: `Bearer ${token}` };
        for (const status of ['RUNNING', 'OPEN', 'RUNNING']) {
            const response = await request(app).put(`/api/qc/batches/${f.batch.id}`).set(auth).send({ status, analysisCode: f.secondCode });
            expect(response.status).toBe(200); expect(response.body.status).toBe('QC_FAIL');
            expect(response.body.batch.analytes.find(row => row.analysisCode === f.secondCode).status).toBe(status === 'OPEN' ? 'OPEN' : 'IN_RUN');
            expect(await retained()).toEqual(before);
            const snapshot = await evidence(f.db);
            const refused = await request(app).put(`/api/qc/batches/${f.batch.id}`).set(auth).send({ status: 'OPEN', analysisCode: f.analysisCode });
            expect(refused.status).toBe(409); expect(refused.body.code).toBe('QC_BATCH_LOCKED');
            expect(await evidence(f.db)).toEqual(snapshot);
            const entry = await request(app).post(`/api/qc/batches/${f.batch.id}/evaluate`).set(auth).send(payload(f.analysisCode, 0.0123456789));
            expect(entry.status).toBe(409); expect(entry.body.code).toBe('QC_BATCH_LOCKED');
            expect(await evidence(f.db)).toEqual(snapshot);
        }
        const passed = await request(app).post(`/api/qc/batches/${f.batch.id}/evaluate`).set(auth).send(payload(f.secondCode, 0.0123456789));
        expect(passed.status).toBe(200); expect(passed.body.status).toBe('QC_FAIL');
        expect(passed.body.batch.analytes.find(row => row.analysisCode === f.secondCode).status).toBe('QC_PASS');
        expect(await retained()).toEqual(before);
    });
});

test.each(['PROFILE', 'NATIVE'])('a migrated REJECT_REANALYSIS item joins a new %s run while preserving its old evidence and membership', async targetKind => {
    const f = await fixture({ migrated: true, sampleMember: true, legacyRepeat: true });
    const old = await f.db.batch.findUnique({ where: { id: f.batch.id }, include: QC_RUN_INCLUDE });
    const workItemId = f.batch.workItems[0].id;
    expect(old.analytes[0].status).toBe('REPEAT_ORDERED');
    let next;
    if (targetKind === 'NATIVE') {
        await f.db.unit.create({ data: { code: 'fixture-unit', display: 'Fixture unit', quantityKind: 'MASS_FRACTION', factorToBase: 1 } });
        await f.db.analysis.update({ where: { code: f.analysisCode }, data: { unitCode: 'fixture-unit' } });
        const method = await f.db.methodology.create({ data: { analysisCode: f.analysisCode, name: 'Repeat run selected method' } });
        const lot = await f.db.referenceMaterial.create({ data: { id: randomUUID(), labId: f.labId, code: randomUUID(), name: 'Repeat lot',
            kind: 'LRM', matrix: 'SOIL', lotNumber: 'repeat', status: 'ACTIVE', createdBy: f.actor.username } });
        await f.db.referenceValue.create({ data: { id: randomUUID(), referenceMaterialId: lot.id, analysisCode: f.analysisCode,
            assignedValue: 7.123456789, unit: 'fixture-unit', valueType: 'LAB_ASSIGNED', createdBy: f.actor.username } });
        next = await buildNativeRun(f.db, f.actor, { workItemIds: [workItemId], analyses: [{ analysisCode: f.analysisCode,
            methodologyId: method.id, references: [{ positionKind: 'LRM', referenceMaterialLotId: lot.id }] }], seed: 'migrated-repeat' });
        next = await startNativeRun(f.db, next.id, f.actor);
    } else {
        const target = await createProfileRun(f.db, f.actor, { analysis: f.analysisCode, profile: 'RACK_40' });
        next = (await changeRunMembers(f.db, target.id, f.actor, { workItemIds: [workItemId] })).batch;
    }
    expect(next.workItemIds).toEqual([workItemId]);
    expect(next.events.filter(row => row.type === 'MEMBER_REPEATED').map(row => JSON.parse(row.payload)))
        .toEqual([{ fromBatchId: old.id, workItemId, analysisCode: f.analysisCode }]);
    const retained = await f.db.batch.findUnique({ where: { id: old.id }, include: QC_RUN_INCLUDE });
    for (const key of ['measurements', 'evaluations', 'dispositions', 'analytes']) expect(retained[key]).toEqual(old[key]);
    expect(retained.events.filter(row => old.events.some(event => event.id === row.id))).toEqual(old.events);
    const appended = retained.events.filter(row => !old.events.some(event => event.id === row.id));
    expect(appended).toHaveLength(1); expect(appended[0].type).toBe('QC_EVIDENCE_SNAPSHOT');
    expect(JSON.parse(appended[0].payload).historyEntry.changes).toEqual([expect.objectContaining({
        entity: 'WorkItem', id: workItemId, before: expect.objectContaining({ batchId: old.id }),
        after: expect.objectContaining({ batchId: next.id }) })]);
    expect(retained.positions.map(row => ({ ...row, workItems: row.workItems.map(({ workItem, ...link }) => link) })))
        .toEqual(old.positions.map(row => ({ ...row, workItems: row.workItems.map(({ workItem, ...link }) => link) })));
    const historical = await readQcRun(f.db, old.id, f.actor);
    expect(historical.workItemIds).toEqual([workItemId]);
    expect(historical.workItems[0]).toMatchObject({ id: workItemId, currentBatchId: next.id, rackPosition: 3 });
    expect((await f.db.workItem.findUnique({ where: { id: workItemId } })).batchId).toBe(next.id);
});

test('a migrated never-run OPEN batch with main default empty QC arrays still accepts and removes real items', async () => {
    const f = await fixture({ migrated: true }), item = await unbatchedMember(f);
    const original = await f.db.batch.findUnique({ where: { id: f.batch.id } });
    expect(f.batch.analytes[0].legacyMembershipFrozen).toBe(false);
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const auth = { Authorization: `Bearer ${token}` }, route = `/api/qc/batches/${f.batch.id}/items`;
        const added = await request(app).post(route).set(auth).send({ workItemIds: [item.id] });
        expect(added.status).toBe(200); expect(await f.db.batchPositionWorkItem.count()).toBe(1);
        const removed = await request(app).delete(route).set(auth).send({ workItemIds: [item.id] });
        expect(removed.status).toBe(200); expect(await f.db.batchPositionWorkItem.count()).toBe(0);
    });
    const retained = await f.db.batch.findUnique({ where: { id: f.batch.id } });
    for (const key of ['qcResults', 'history', 'disposition', 'workItemIds']) expect(retained[key]).toBe(original[key]);
});

test('a migrated final-clear round retains historical evidence and refuses a real item add with zero writes', async () => {
    const f = await fixture({ migrated: true, finalClear: true }), item = await unbatchedMember(f);
    expect(f.batch.analytes[0].legacyMembershipFrozen).toBe(true);
    expect(f.batch.analytes[0].evaluation.verdict).toBe('INCOMPLETE');
    expect(await f.db.qcEvaluation.count()).toBe(2);
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const before = await evidence(f.db);
        const refused = await request(app).post(`/api/qc/batches/${f.batch.id}/items`).set({ Authorization: `Bearer ${token}` })
            .send({ workItemIds: [item.id] });
        expect(refused.status).toBe(409); expect(refused.body.code).toBe('BATCH_MEMBERSHIP_FROZEN');
        expect(await evidence(f.db)).toEqual(before);
    });
});

test.each([false, true])('first RUNNING transition freezes compatibility membership permanently (migrated=%s)', async migrated => {
    const f = await fixture({ migrated }), item = await unbatchedMember(f);
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const auth = { Authorization: `Bearer ${token}` }, route = `/api/qc/batches/${f.batch.id}`;
        const started = await request(app).put(route).set(auth).send({ status: 'RUNNING' });
        expect(started.status).toBe(200);
        const firstStart = (await f.db.batch.findUnique({ where: { id: f.batch.id } })).startedAt;
        expect(firstStart).toBeInstanceOf(Date);
        expect((await request(app).put(route).set(auth).send({ status: 'RUNNING' })).status).toBe(200);
        expect((await f.db.batch.findUnique({ where: { id: f.batch.id } })).startedAt).toEqual(firstStart);
        expect((await request(app).put(route).set(auth).send({ status: 'OPEN' })).status).toBe(200);
        const before = await evidence(f.db);
        const refused = await request(app).post(`${route}/items`).set(auth).send({ workItemIds: [item.id] });
        expect(refused.status).toBe(409); expect(refused.body.code).toBe('BATCH_MEMBERSHIP_FROZEN');
        expect(await evidence(f.db)).toEqual(before);
    });
});

test('manual QC_FAIL contradicting a passing evaluation is refused rather than acknowledged as a no-op', async () => {
    const f = await fixture(); await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, input());
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const before = await evidence(f.db);
        const refused = await request(app).put(`/api/qc/batches/${f.batch.id}`).set({ Authorization: `Bearer ${token}` }).send({ status: 'QC_FAIL' });
        expect(refused.status).toBe(400); expect(refused.body.code).toBe('QC_RULE_VIOLATION');
        expect(await evidence(f.db)).toEqual(before);
    });
});

test('actual compatibility PUT and evaluate routes retain pass/reopen/resubmit cycles, missing-value refusals and manager authority', async () => {
    const f = await fixture();
    await f.db.user.update({ where: { id: f.actor.id }, data: { role: 'LAB_MANAGER', labId: f.labId } });
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const auth = { Authorization: `Bearer ${token}` }, id = f.batch.id;
        const before = await evidence(f.db);
        for (const route of ['put', 'post']) {
            const response = route === 'put' ? await request(app).put(`/api/qc/batches/${id}`).set(auth).send({ ...input(), controls: [{ expected: 7, measured: null }] })
                : await request(app).post(`/api/qc/batches/${id}/evaluate`).set(auth).send({ ...input(), controls: [{ expected: 7, measured: null }] });
            expect(response.status).toBe(400); expect(response.body.code).toBe('QC_VALUES_MISSING');
            expect(response.body.missingTypes).toContain('CONTROL'); expect(await evidence(f.db)).toEqual(before);
        }
        const first = await request(app).post(`/api/qc/batches/${id}/evaluate`).set(auth).send(input());
        expect(first.status).toBe(200); expect(first.body.status).toBe('QC_PASS');
        const oldMeasurements = await f.db.qcMeasurement.findMany({ orderBy: { id: 'asc' } });
        await f.db.user.update({ where: { id: f.actor.id }, data: { role: 'LAB_TECHNICIAN' } });
        const accepted = await evidence(f.db);
        const denied = await request(app).put(`/api/qc/batches/${id}`).set(auth).send({ status: 'OPEN', reason: 'Only a manager can reopen' });
        expect(denied.status).toBe(403); expect(denied.body.code).toBe('QC_REOPEN_PERMISSION_REQUIRED'); expect(await evidence(f.db)).toEqual(accepted);
        await f.db.user.update({ where: { id: f.actor.id }, data: { role: 'LAB_MANAGER' } });
        for (const [index, route] of ['put', 'post'].entries()) {
            const reopened = await request(app).put(`/api/qc/batches/${id}`).set(auth).send({ status: 'OPEN', reason: 'Reviewed repeat of compatibility QC' });
            expect(reopened.status).toBe(200); expect(reopened.body.status).toBe('OPEN'); expect(reopened.body.batch.qcResults).toBeNull();
            const response = route === 'put' ? await request(app).put(`/api/qc/batches/${id}`).set(auth).send(input(0.0223456789 + index * 0.01))
                : await request(app).post(`/api/qc/batches/${id}/evaluate`).set(auth).send(input(0.0223456789 + index * 0.01));
            expect(response.status).toBe(200); expect(response.body.status).toBe('QC_PASS');
        }
        const evaluations = await f.db.qcEvaluation.findMany({ orderBy: { version: 'asc' } });
        expect(evaluations).toHaveLength(3); expect(evaluations[1].supersedesId).toBe(evaluations[0].id); expect(evaluations[2].supersedesId).toBe(evaluations[1].id);
        expect(evaluations.slice(1).every(row => JSON.parse(row.details).reopenEventId)).toBe(true);
        for (const row of oldMeasurements) expect(await f.db.qcMeasurement.findUnique({ where: { id: row.id } })).toEqual(row);
        const detail = await request(app).get(`/api/qc/batches/${id}`).set(auth);
        expect(detail.status).toBe(200); expect(detail.body.data.qcResults.blanks).toHaveLength(1); expect(detail.body.data.qcResults.blanks[0].value).toBe(0.0323456789);
        const raw = await f.db.batch.findUnique({ where: { id } });
        for (const key of ['qcResults', 'workItemIds', 'disposition', 'history']) expect(raw[key]).toBeNull();
        expect(await f.db.batchQcResult.count()).toBe(0);
    });
});

test('actual unresolved profile membership retains reserved-slot, explicit rack and removal behavior using real SAMPLE joins', async () => {
    const f = await fixture();
    await f.db.user.update({ where: { id: f.actor.id }, data: { role: 'LAB_MANAGER', labId: f.labId } });
    const ids = [];
    for (let index = 0; index < 2; index++) {
        const sampleId = randomUUID();
        await createSampleFixture(f.db, { data: { id: sampleId, originalId: sampleId, assignedLab: f.labId, status: 'PROCESSING' } });
        const item = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId, labId: f.labId, assignedLab: f.labId, analysis: f.analysisCode, status: 'ASSIGNED' } }); ids.push(item.id);
    }
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const auth = { Authorization: `Bearer ${token}` }, id = f.batch.id;
        const available = Array.from({ length: f.batch.runProfile.capacity }, (_, index) => index + 1).filter(position => !f.batch.runProfile.qcSlots.some(slot => slot.position === position));
        const before = await evidence(f.db);
        const reserved = await request(app).post(`/api/qc/batches/${id}/items`).set(auth).send({ workItemIds: [ids[0]], rackPositions: { [ids[0]]: f.batch.runProfile.qcSlots[0].position } });
        expect(reserved.status).toBe(400); expect(reserved.body.code).toBe('QC_RACK_POSITION_RESERVED'); expect(await evidence(f.db)).toEqual(before);
        const duplicate = await request(app).post(`/api/qc/batches/${id}/items`).set(auth).send({ workItemIds: ids, rackPositions: { [ids[0]]: available[0], [ids[1]]: available[0] } });
        expect(duplicate.status).toBe(400); expect(duplicate.body.code).toBe('QC_RACK_POSITION_DUPLICATE'); expect(await evidence(f.db)).toEqual(before);
        const added = await request(app).post(`/api/qc/batches/${id}/items`).set(auth).send({ workItemIds: ids, rackPositions: { [ids[0]]: available[0], [ids[1]]: available[1] } });
        expect(added.status).toBe(200); expect(added.body.positions).toEqual({ [ids[0]]: available[0], [ids[1]]: available[1] });
        expect(added.body.batch.analytes[0].provenance).toBe('PROFILE_ONLY'); expect(await f.db.batchPositionWorkItem.count()).toBe(2);
        const removed = await request(app).delete(`/api/qc/batches/${id}/items`).set(auth).send({ workItemIds: [ids[0]] });
        expect(removed.status).toBe(200); expect(removed.body.remaining).toBe(1); expect(await f.db.batchPositionWorkItem.count()).toBe(1);
        expect(await f.db.workItem.findUnique({ where: { id: ids[0] } })).toMatchObject({ batchId: null, rackPosition: null });
        expect(await f.db.workItem.findUnique({ where: { id: ids[1] } })).toMatchObject({ batchId: id, rackPosition: available[1] });
        const raw = await f.db.batch.findUnique({ where: { id } }); expect(raw.workItemIds).toBeNull();
        const detail = await request(app).get(`/api/qc/batches/${id}`).set(auth); expect(JSON.parse(detail.body.data.workItemIds)).toEqual([ids[1]]);
    });
});

test('normalized reads resolve the actor laboratory code while refusing another laboratory scope', async () => {
    const f = await fixture(), actor = { ...f.actor, labId: `CODE-${f.labId}` };
    expect((await readQcRun(f.db, f.batch.id, actor)).id).toBe(f.batch.id);
    await expect(readQcRun(f.db, f.batch.id, { ...actor, labId: 'OUTSIDE-FIXTURE-LAB' })).rejects.toMatchObject({ statusCode: 403 });
});

test.each([false, true])('actual reasoned compatibility corrections retain both evaluations, supersede once and keep the full round (migrated=%s)', async migrated => {
    const f = await fixture({ migrated });
    await f.db.user.update({ where: { id: f.actor.id }, data: { role: 'LAB_MANAGER', labId: f.labId } });
    const first = await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, input()), legacy = await f.db.batch.findUnique({ where: { id: f.batch.id } });
    const oldRows = await f.db.qcMeasurement.findMany(), firstEval = first.batch.analytes[0].evaluation;
    const blank = first.batch.qcResults.blanks[0], pair = first.batch.qcResults.duplicates[0];
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const auth = { Authorization: `Bearer ${token}` }, route = `/api/qc/batches/${f.batch.id}/corrections`;
        const before = await evidence(f.db);
        for (const [body, code] of [[{ corrections: [{ positionId: blank.id, value: 0.02 }] }, 'QC_CORRECTION_REASON_REQUIRED'],
            [{ reason: 'Reviewed transcription', corrections: [{ positionId: blank.id, value: null }] }, 'QC_VALUES_MISSING'],
            [{ reason: 'Reviewed transcription', corrections: [{ positionId: 'foreign-position', value: 0.02 }] }, 'QC_MEASUREMENT_NOT_FOUND']]) {
            const refused = await request(app).post(route).set(auth).send(body);
            expect(refused.status).toBe(code === 'QC_MEASUREMENT_NOT_FOUND' ? 404 : 400); expect(refused.body.code).toBe(code);
            expect(await evidence(f.db)).toEqual(before);
        }
        const reason = 'Reviewed original worksheet transcription';
        const corrected = await request(app).post(route).set(auth).send({ reason, corrections: [
            { positionId: blank.id, replicateNo: 1, rawInput: '0.0223456789' },
            { positionId: pair.id, replicateNo: 2, rawInput: '2.124456789' }] });
        expect(corrected.status).toBe(200); expect(corrected.body.status).toBe('QC_PASS');
        expect(corrected.body.batch.qcResults.blanks[0]).toMatchObject({ id: blank.id, value: 0.0223456789, rawInput: { value: '0.0223456789' } });
        expect(corrected.body.batch.qcResults.duplicates).toHaveLength(2); expect(corrected.body.batch.qcResults.controls).toHaveLength(1);
        expect(corrected.body.batch.qcResults.duplicates[0]).toMatchObject({ id: pair.id, value1: 2.123456789, value2: 2.124456789 });
        const newRows = await f.db.qcMeasurement.findMany({ where: { correctionReason: reason } }); expect(newRows).toHaveLength(2);
        for (const old of oldRows) {
            const next = newRows.find(row => row.positionId === old.positionId && row.replicateNo === old.replicateNo);
            expect(await f.db.qcMeasurement.findUnique({ where: { id: old.id } })).toEqual({ ...old, supersededById: next?.id || old.supersededById });
        }
        expect(await f.db.qcEvaluation.findUnique({ where: { id: firstEval.id } })).toEqual(firstEval);
        const latest = await f.db.qcEvaluation.findFirst({ orderBy: { version: 'desc' } });
        expect(latest).toMatchObject({ version: firstEval.version + 1, supersedesId: firstEval.id });
        expect(JSON.parse(latest.details)).toMatchObject({ entryMode: 'CORRECTION', compatibility: true, correctionReason: reason });
        const second = await request(app).post(route).set(auth).send({ reason: 'Second worksheet review', corrections: [{ positionId: blank.id, value: 0.0323456789 }] });
        expect(second.status).toBe(200); expect(second.body.batch.qcResults.blanks[0].value).toBe(0.0323456789);
        const raw = await f.db.batch.findUnique({ where: { id: f.batch.id } });
        for (const key of ['qcResults', 'disposition', 'history', 'workItemIds']) expect(raw[key]).toBe(legacy[key]);
        expect(await f.db.batchQcResult.count()).toBe(0); expect(await f.db.qcEvaluation.count()).toBe(migrated ? 4 : 3);
    });
});

test('compatibility correction resolves the round after a reopen, refuses earlier round ids, and rolls back a late insert fault', async () => {
    const f = await fixture(), first = await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, input());
    await reopenCompatibilityRun(f.db, f.batch.id, f.actor, 'Review the existing observation before correction');
    const corrected = await correctCompatibilityMeasurements(f.db, f.batch.id, f.actor, { reason: 'Correct reopened original', corrections: [{ positionId: first.batch.qcResults.blanks[0].id, value: 0.0223456789 }] });
    expect(corrected.batch.qcResults.blanks[0].value).toBe(0.0223456789);
    expect(JSON.parse(corrected.batch.analytes[0].evaluation.details).reopenEventId).toBeTruthy();
    await reopenCompatibilityRun(f.db, f.batch.id, f.actor, 'Start another ordinary complete round');
    const next = await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, input(0.0323456789)), before = await evidence(f.db);
    await expect(correctCompatibilityMeasurements(f.db, f.batch.id, f.actor, { reason: 'Wrong round', corrections: [{ positionId: first.batch.qcResults.blanks[0].id, value: 0.04 }] }))
        .rejects.toMatchObject({ statusCode: 404, code: 'QC_MEASUREMENT_NOT_FOUND' });
    expect(await evidence(f.db)).toEqual(before);
    await expect(correctCompatibilityMeasurements(f.db, f.batch.id, { ...f.actor, labId: 'OUTSIDE-LAB' }, { reason: 'Foreign scope', corrections: [{ positionId: next.batch.qcResults.blanks[0].id, value: 0.04 }] }))
        .rejects.toMatchObject({ statusCode: 403 }); expect(await evidence(f.db)).toEqual(before);
    await f.db.$executeRawUnsafe(`CREATE TRIGGER "fixture_compatibility_correction_fault" BEFORE INSERT ON "QcEvaluation" BEGIN SELECT RAISE(ABORT, 'fixture late insert fault'); END`);
    await expect(correctCompatibilityMeasurements(f.db, f.batch.id, f.actor, { reason: 'Late fault must roll back', corrections: [{ positionId: next.batch.qcResults.blanks[0].id, value: 0.04 }] })).rejects.toThrow();
    expect(await evidence(f.db)).toEqual(before);
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
    expect(snapshots).toHaveLength(3); expect(snapshots.map(row => row.seq)).toEqual(migrated ? [1, 2, 3] : [2, 3, 4]);
    if (!migrated) expect(second.batch.history.find(row => row.action === 'CREATE')).toMatchObject({ kind: 'QC_EVIDENCE_SNAPSHOT', seq: 1 });
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
    const thirdEvaluation = third.batch.analytes[0].evaluation;
    const fourth = await writeCompatibilityMeasurements(f.db, f.batch.id, f.actor, pair(2.125456789));
    expect(JSON.parse(fourth.batch.analytes[0].evaluation.details).reopenEventId).toBeNull();
    const fourthParent = await f.db.qcMeasurement.findFirst({ where: { positionId: parent.id, supersededById: null } });
    expect(JSON.parse(fourthParent.legacySource).reopenEventId).toBeNull();
    expect(await f.db.qcEvaluation.findUnique({ where: { id: thirdEvaluation.id } })).toEqual(thirdEvaluation);
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
