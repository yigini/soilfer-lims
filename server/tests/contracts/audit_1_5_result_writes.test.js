const { randomUUID, createHash } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const prisma = require('../../prisma');
const app = require('../../app');
const writer = require('../../services/resultWriteService');
const sync = require('../../services/syncService');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { getAuthToken } = require('../setup');
const { rejectedGuardWrite } = require('../helpers/rejectedGuardWrite');
const { scanSource } = require('../helpers/workflowWriteScanner');
const labId = `RW-LAB-${randomUUID()}`, code = `RW_${randomUUID().replaceAll('-', '')}`, methodId = randomUUID();
let actor, token, batchId;

beforeAll(async () => {
    await prisma.lab.create({ data: { id: labId, code: labId, name: 'Result authority laboratory', country: 'GTM' } });
    token = await getAuthToken('LAB_MANAGER', labId); actor = jwt.decode(token);
    await prisma.analysis.create({ data: { code, name: 'Controlled result measurement', units: 'g/kg', unitCode: 'g/kg', validation: '{"type":"numeric"}' } });
    await prisma.methodology.create({ data: { id: methodId, analysisCode: code, name: 'Result authority reference method' } });
    batchId = randomUUID();
    await prisma.batch.create({ data: { id: batchId, labId, analysis: code, status: 'OPEN', createdBy: actor.username } });
});

async function fixture({ analysis = code, batch = batchId, equipmentId = null, status = 'PROCESSING', itemStatus = 'IN_PROGRESS' } = {}) {
    const sampleId = randomUUID(), itemId = randomUUID();
    const sample = await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, labId: sampleId, assignedLab: labId,
        status, receptionDate: new Date(), dryingStatus: 'DONE', preparationStatus: 'DONE', requiredAnalyses: JSON.stringify([analysis]) } });
    const item = await createWorkItemFixture(prisma, { data: { id: itemId, sampleId, analysis, assignedLab: labId, labId,
        status: itemStatus, assignedTo: actor.username, batchId: batch, equipmentId,
        methodologyId: analysis === code ? methodId : null, version: 0 } });
    return { sample, item };
}

function snapshot() {
    const db = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
    try {
        return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => {
            const rows = db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all().map(row => JSON.stringify(row)).sort();
            return { name, count: rows.length, sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
        });
    } finally { db.close(); }
}

const measurement = extra => ({ param: code, value: '6,42', methodologyId: methodId, unit: 'g/kg', ...extra });
const apiSave = (sampleId, measurements) => request(app).post(`/api/results/${sampleId}`).set('Authorization', `Bearer ${token}`).send({ measurements });
const importSave = sampleId => request(app).post('/api/import/execute').set('Authorization', `Bearer ${token}`)
    .send({ sampleIdColumn: 'sample', labId,
        columnMappings: [{ column: 'value', analysisCode: code, methodologyId: methodId, unitCode: 'g/kg' }],
        rows: [{ sample: sampleId, value: '6.42' }] });

test('workbench, offline sync, results API and import have a common shape and server batch', async () => {
    const outputs = [];
    for (const source of ['workbench', 'sync', 'api', 'import']) {
        const f = await fixture();
        if (source === 'workbench') {
            const response = await request(app).post('/api/workbench/batch-save').set('Authorization', `Bearer ${token}`)
                .send({ draft: false, entries: [{ workItemId: f.item.id, value: '6,42', version: 0, batchId }] });
            expect(response).toMatchObject({ status: 200, body: { saved: 1 } });
        } else if (source === 'sync') {
            const response = await sync.applySyncOperations(actor, [{ operationId: randomUUID(), type: 'COMPLETE_WORK',
                target: { workItemId: f.item.id }, baseVersion: 0, payload: { value: '6,42', unit: 'g/kg', batchId } }]);
            expect(response.receipts[0]).toMatchObject({ status: 'APPLIED' });
        } else if (source === 'api') {
            expect((await apiSave(f.sample.id, [measurement({ batchId })])).status).toBe(200);
        } else {
            const response = await request(app).post('/api/import/execute').set('Authorization', `Bearer ${token}`)
                .send({ sampleIdColumn: 'sample', labId, columnMappings: [{ column: 'value', analysisCode: code, methodologyId: methodId, unitCode: 'g/kg', batchId }],
                    rows: [{ sample: f.sample.id, value: '6,42' }] });
            expect(response).toMatchObject({ status: 200, body: { importedResults: 1 } });
        }
        const rows = await prisma.result.findMany({ where: { sampleId: f.sample.id } });
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ param: code, value: '6.42', rawInput: '6,42', numericValue: 6.42, unit: 'g/kg',
            flags: '[]', isValid: true, censoring: 'NONE', basis: 'AIR_DRY', methodologyId: methodId, replicateNo: 1,
            isCurrent: true, enteredBy: actor.username, batchId, provenance: source === 'import' ? 'IMPORTED' : 'MEASURED' });
        expect((await prisma.workItem.findUnique({ where: { id: f.item.id } })).result).toBe('6.42');
        const attempts = await prisma.workAttempt.findMany({ where: { workItemId: f.item.id } });
        // #190 pin6056586906 intentionally gives every canonical execution a link.
        expect(attempts).toHaveLength(1);
        expect(rows[0].attemptId).toBe(attempts[0].id);
        expect(attempts[0].workItemId).toBe(f.item.id);
        expect(await prisma.auditLog.count({ where: { entityId: rows[0].id, action: 'RESULT_RECORDED' } })).toBe(1);
        outputs.push(Object.keys(rows[0]).sort());
    }
    expect(outputs.every(keys => JSON.stringify(keys) === JSON.stringify(outputs[0]))).toBe(true);
});

test('unbatched measurement gets an attempt; the orphan historical import remains unlinked', async () => {
    const f = await fixture({ batch: null });
    expect((await apiSave(f.sample.id, [measurement()])).status).toBe(200);
    const measured = await prisma.result.findFirst({ where: { sampleId: f.sample.id } });
    expect(measured).toMatchObject({ batchId: null, attemptId: expect.any(String) });
    const attempts = await prisma.workAttempt.findMany({ where: { workItemId: f.item.id } });
    expect(attempts).toHaveLength(1);
    expect(measured.attemptId).toBe(attempts[0].id);
    const imported = randomUUID();
    const response = await request(app).post('/api/import/execute').set('Authorization', `Bearer ${token}`).send({ sampleIdColumn: 'sample', labId,
        columnMappings: [{ column: 'value', analysisCode: code, methodologyId: methodId, unitCode: 'g/kg' }], rows: [{ sample: imported, value: '<0,5' }] });
    expect(response).toMatchObject({ status: 200, body: { importedResults: 1 } });
    expect(await prisma.result.findFirst({ where: { sampleId: imported } })).toMatchObject({ batchId: null, attemptId: null, provenance: 'IMPORTED',
        value: '<0.5', numericValue: 0.5, censoring: 'BELOW_LOQ', rawInput: '<0,5' });
});

// #190 pin6058155230: runtime import exemptions use the authenticated route on
// the actual COMPLETE schema; the historical factory remains out of this suite.
test.each(['orphan', 'duplicate-child'])('#190 real import route preserves the %s contract and unrelated rows', async kind => {
    expect(require('../../scripts/install_work_attempt_contract')
        .assertWorkAttemptStartupReady(process.env.DATABASE_PATH).classification).toBe('COMPLETE');
    let sample, canonical = null;
    {
        const sampleId = randomUUID();
        sample = await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, labId: sampleId,
            assignedLab: labId, status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE',
            requiredAnalyses: JSON.stringify([code]) } });
        if (kind === 'duplicate-child') {
            const parentAnalysis = `IMPORT_PARENT_${randomUUID().replaceAll('-', '')}`;
            await prisma.analysis.create({ data: { code: parentAnalysis, name: 'Other controlled fixture parameter',
                units: 'g/kg', validation: '{"type":"numeric"}' } });
            const parent = await createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId,
                analysis: parentAnalysis, assignedLab: labId, status: 'IN_PROGRESS' } });
            await createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId, analysis: code,
                assignedLab: labId, status: 'IN_PROGRESS', duplicateOf: parent.id } });
        }
    }
    const before = {
        samples: await prisma.sample.findMany({ orderBy: { id: 'asc' } }),
        items: await prisma.workItem.findMany({ orderBy: { id: 'asc' } }),
        attempts: await prisma.workAttempt.findMany({ orderBy: { id: 'asc' } }),
        results: await prisma.result.findMany({ orderBy: { id: 'asc' } }),
        audits: await prisma.auditLog.findMany({ orderBy: { id: 'asc' } }), tables: snapshot()
    };
    const response = await importSave(sample.id);
    expect(response).toMatchObject({ status: 200, body: { importedSamples: 0, importedResults: 1 } });
    const rows = await prisma.result.findMany({ where: { sampleId: sample.id } });
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row).toMatchObject({ provenance: 'IMPORTED', value: '6.42', rawInput: '6.42' });
    const attempts = await prisma.workAttempt.findMany({ orderBy: { id: 'asc' } });
    const newAttempts = attempts.filter(attempt => !before.attempts.some(old => old.id === attempt.id));
    expect(attempts.filter(attempt => before.attempts.some(old => old.id === attempt.id))).toEqual(before.attempts);
    if (canonical) {
        expect(newAttempts).toHaveLength(1);
        expect(newAttempts[0]).toMatchObject({ id: row.attemptId, workItemId: canonical.id, attemptNo: 10, status: 'RECORDED' });
        const evidence = JSON.parse(newAttempts[0].evidenceData);
        expect(evidence.source).toBe('legacy-import');
        expect(evidence).toMatchObject({ rawValue: '6.42', resultId: row.id, sourceResultIds: [row.id] });
        expect(newAttempts[0].evidenceHash).toBe(createHash('sha256').update(newAttempts[0].evidenceData).digest('hex'));
    } else {
        expect(row.attemptId).toBeNull(); expect(newAttempts).toEqual([]);
    }
    expect(await prisma.sample.findMany({ orderBy: { id: 'asc' } })).toEqual(before.samples);
    const items = await prisma.workItem.findMany({ orderBy: { id: 'asc' } });
    expect(items).toHaveLength(before.items.length);
    expect(items.map(item => canonical && item.id === canonical.id
        ? { ...item, result: canonical.result, updatedAt: canonical.updatedAt } : item)).toEqual(before.items);
    if (canonical) expect(items.find(item => item.id === canonical.id).result).toBe('6.42');
    const allResults = await prisma.result.findMany({ orderBy: { id: 'asc' } });
    expect(allResults.filter(result => result.id !== row.id)).toEqual(before.results);
    const audits = await prisma.auditLog.findMany({ orderBy: { id: 'asc' } });
    expect(audits.filter(audit => before.audits.some(old => old.id === audit.id))).toEqual(before.audits);
    const addedAudits = audits.filter(audit => !before.audits.some(old => old.id === audit.id));
    expect(addedAudits).toHaveLength(2);
    const resultAudit = addedAudits.find(audit => audit.action === 'RESULT_RECORDED');
    expect(resultAudit).toMatchObject({ entity: 'RESULT', entityId: row.id, sampleId: sample.id,
        labId, analysisCode: code, performedBy: actor.username });
    expect(JSON.parse(resultAudit.details)).toMatchObject({ provenance: 'IMPORTED', attemptId: row.attemptId });
    expect(addedAudits.find(audit => audit.action === 'IMPORT_LEGACY_DATA')).toMatchObject({ entity: 'LEGACY_IMPORT',
        performedBy: actor.username, details: 'Imported 0 historical samples and 1 results with provenance IMPORTED' });
    const stableTables = tables => tables.filter(table => !['WorkAttempt', 'Result', 'WorkItem', 'AuditLog'].includes(table.name));
    expect(stableTables(snapshot())).toEqual(stableTables(before.tables));
});

// Pin6070309684 deliberately replaces #190's automatic canonical attempt10
// success. The first execution is real; no unreasoned historical row is seeded.
test('a reasonless canonical historical import refuses and preserves every table exactly',async()=>{
    const f=await fixture({batch:null});
    expect((await apiSave(f.sample.id,[measurement()])).status).toBe(200);
    const before=snapshot(),response=await importSave(f.sample.id);
    expect(response).toMatchObject({status:409,body:{code:'WORK_ATTEMPT_REASON_REQUIRED'}});
    expect(snapshot()).toEqual(before);
});

test.each(['COMPLETED', 'SUBMITTED', 'ACCEPTED', 'WAIVED'])('import refuses sealed %s work with all-table zero changes', async itemStatus => {
    const f = await fixture({ itemStatus }), before = snapshot();
    expect(await importSave(f.sample.id)).toMatchObject({ status: 409, body: { code: 'RESULT_WORKITEM_SEALED' } });
    expect(snapshot()).toEqual(before);
});

test('import cannot bypass an existing work item prerequisite', async () => {
    const f = await fixture();
    await prisma.sample.update({ where: { id: f.sample.id }, data: { preparationStatus: 'PENDING' } });
    const before = snapshot(), response = await importSave(f.sample.id);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('PREPARATION_PREREQUISITE_BLOCKED');
    expect(snapshot()).toEqual(before);
});

test.each([null, 'assigned'])('client batch mismatch (%s) rolls back every table, including earlier entries', async batch => {
    const f = await fixture({ batch: batch === null ? null : batchId }), before = snapshot();
    const response = await apiSave(f.sample.id, [measurement({ replicateNo: 1 }), measurement({ replicateNo: 2, batchId: 'wrong-client-batch' })]);
    expect(response).toMatchObject({ status: 409, body: { code: 'RESULT_BATCH_MISMATCH' } });
    expect(snapshot()).toEqual(before);
});

test('conflicting attempt and work item batches refuse with all-table zero writes', async () => {
    const f = await fixture(), attemptId = randomUUID();
    await prisma.workAttempt.create({ data: { id: attemptId, workItemId: f.item.id, author: actor.username, qcBatchId: 'different-server-batch' } });
    const before = snapshot();
    await expect(prisma.$transaction(tx => writer.writeResult(tx, { sampleId: f.sample.id, workItemId: f.item.id, attemptId, actor, measurement: measurement() })))
        .rejects.toMatchObject({ statusCode: 409, code: 'RESULT_BATCH_CONFLICT' });
    expect(snapshot()).toEqual(before);
});

test.each(['workbench', 'sync', 'import'].flatMap(source => [null, 'assigned'].map(batch => [source, batch])))
    ('%s refuses a client batch mismatch against %s without changing any table', async (source, batch) => {
        const f = await fixture({ batch: batch === null ? null : batchId }), before = snapshot();
        if (source === 'workbench') {
            const response = await request(app).post('/api/workbench/batch-save').set('Authorization', `Bearer ${token}`)
                .send({ draft: false, entries: [{ workItemId: f.item.id, value: '7.5', batchId: 'wrong-client-batch' }] });
            expect(response).toMatchObject({ status: 409, body: { code: 'RESULT_BATCH_MISMATCH' } });
        } else if (source === 'sync') {
            const response = await sync.applySyncOperations(actor, [{ operationId: randomUUID(), type: 'COMPLETE_WORK',
                target: { workItemId: f.item.id }, baseVersion: 0, payload: { value: '7.5', batchId: 'wrong-client-batch' } }]);
            expect(response.receipts[0]).toMatchObject({ status: 'REJECTED', code: 'RESULT_BATCH_MISMATCH' });
        } else {
            const response = await request(app).post('/api/import/execute').set('Authorization', `Bearer ${token}`)
                .send({ sampleIdColumn: 'sample', labId,
                    columnMappings: [{ column: 'value', analysisCode: code, methodologyId: methodId, unitCode: 'g/kg', batchId: 'wrong-client-batch' }],
                    rows: [{ sample: f.sample.id, value: '7.5' }] });
            expect(response).toMatchObject({ status: 409, body: { code: 'RESULT_BATCH_MISMATCH' } });
        }
        expect(snapshot()).toEqual(before);
    });

test('texture creates one derived row per existing attempt, with original source provenance, and retry adds none', async () => {
    const f = await fixture({ analysis: 'TEXTURE' });
    const response = await request(app).post('/api/workbench/batch-save').set('Authorization', `Bearer ${token}`)
        .send({ draft: false, entries: [{ workItemId: f.item.id, values: { sand: '50', silt: '35', clay: '15' }, version: 0 }] });
    expect(response).toMatchObject({ status: 200, body: { saved: 1 } });
    const attempt = await prisma.workAttempt.findFirst({ where: { workItemId: f.item.id } });
    const rows = await prisma.result.findMany({ where: { sampleId: f.sample.id } });
    expect(rows).toHaveLength(4); expect(rows.every(row => row.attemptId === attempt.id && row.batchId === batchId)).toBe(true);
    const texture = rows.find(row => row.param === 'TEXTURE');
    expect(texture).toMatchObject({ provenance: 'DERIVED', enteredBy: actor.username, numericValue: null, isCurrent: true });
    for (const param of ['SAND', 'SILT', 'CLAY']) {
        const fraction = rows.find(row => row.param === param);
        expect(fraction.provenance).toBe('MEASURED'); expect(JSON.parse(texture.flags)).toContain(`SOURCE_${param}_${fraction.id}`);
    }
    const before = snapshot();
    const replay = await prisma.$transaction(tx => writer.deriveTextureResult(tx, { sampleId: f.sample.id, workItemId: f.item.id, attemptId: attempt.id, actor }));
    expect(replay.id).toBe(texture.id); expect(snapshot()).toEqual(before);
});

test('offline CommandReceipt replay reuses its attempt and results with zero writes', async () => {
    const f = await fixture();
    const operation = { operationId: randomUUID(), type: 'COMPLETE_WORK', target: { workItemId: f.item.id }, baseVersion: 0, payload: { value: '8.2' } };
    const first = await sync.applySyncOperations(actor, [operation]); expect(first.receipts[0]).toMatchObject({ status: 'APPLIED' });
    const before = snapshot(), second = await sync.applySyncOperations(actor, [operation]);
    expect(second.receipts[0].status).toBe('DUPLICATE_APPLIED'); expect(snapshot()).toEqual(before);
    expect(await prisma.workAttempt.count({ where: { workItemId: f.item.id } })).toBe(1);
    expect(await prisma.result.count({ where: { sampleId: f.sample.id } })).toBe(1);
});

test('fresh calibration due date overrides a stale OK label and leaves all tables untouched', async () => {
    const equipmentId = randomUUID();
    await prisma.equipmentAsset.create({ data: { id: equipmentId, labId, assetType: 'BALANCE', name: 'Expired qualified balance', status: 'IN_SERVICE', criticality: 'CRITICAL' } });
    await prisma.equipmentQualification.create({ data: { id: randomUUID(), equipmentId, labId, calibrationStatus: 'OK', verificationStatus: 'OK', nextCalibrationDueDate: new Date(Date.now() - 1000) } });
    const f = await fixture({ equipmentId }), before = snapshot();
    const response = await apiSave(f.sample.id, [measurement()]);
    expect(response.status).toBeGreaterThanOrEqual(400); expect(response.status).toBeLessThan(500);
    expect(snapshot()).toEqual(before);
    expect(await importSave(f.sample.id)).toMatchObject({ status: 409, body: { code: 'INSTRUMENT_CALIBRATION_OVERDUE' } });
    expect(snapshot()).toEqual(before);
    await expect(prisma.$transaction(tx => writer.writeResult(tx, { sampleId: f.sample.id, workItemId: f.item.id, actor, measurement: measurement() })))
        .rejects.toMatchObject({ statusCode: 409, code: 'INSTRUMENT_CALIBRATION_OVERDUE' });
    expect(snapshot()).toEqual(before);
});

test('numeric MIR predictions retain PREDICTED provenance', async () => {
    const f = await fixture();
    await prisma.$transaction(tx => writer.writeSpectralPrediction(tx, { sampleId: f.sample.id, actor, measurement: measurement() }));
    expect(await prisma.result.findFirst({ where: { sampleId: f.sample.id } })).toMatchObject({ provenance: 'PREDICTED', numericValue: 6.42 });
});

test.each([
    ['id', 'colliding-result'], ['rawInput', 'invented parser evidence'],
    ['flags', ['MANAGER_OVERRIDE', 'BELOW_LOQ']], ['flags', 'not-an-array'],
    ...['PREDICTED', 'IMPORTED', 'DERIVED'].map(value => ['provenance', value])
])('the results API ignores smuggled %s=%j and preserves the actual parser evidence', async (field, value) => {
    const f = await fixture();
    expect((await apiSave(f.sample.id, [measurement()])).status).toBe(200);
    const previous = await prisma.result.findFirst({ where: { sampleId: f.sample.id } });
    const injected=field==='id' ? previous.id : value;
    // Pins6069938801 /6070309684: retain the injected input, changing only
    // the second save to its explicit same-attempt correction command.
    const response=await request(app).post(`/api/attempts/${previous.attemptId}/corrections`).set('Authorization',`Bearer ${token}`)
        .send({value:'7,42',reason:'TRANSCRIPTION_ERROR',note:'Compared with the instrument record',[field]:injected});
    expect(response.status).toBe(201);
    const current = await prisma.result.findFirst({ where: { sampleId: f.sample.id, isCurrent: true } });
    expect(current).toMatchObject({ value: '7.42', rawInput: '7,42', numericValue: 7.42, flags: '[]', provenance: 'MEASURED', isValid: true });
    expect(current.id).not.toBe(previous.id);
    expect(current[field]).not.toEqual(injected);
    expect(await prisma.result.findUnique({ where: { id: previous.id } }))
        .toEqual({ ...previous, isCurrent: false, supersededBy: current.id, updatedAt: expect.any(Date) });
    expect(await prisma.result.count({ where: { sampleId: f.sample.id } })).toBe(2);
});

test('historical import retains invalid text and out-of-range pH while importing the other cells', async () => {
    const analysis = await prisma.analysis.findUniqueOrThrow({ where: { code: 'PH_H2O' } });
    const method = await prisma.methodology.findFirstOrThrow({ where: { analysisCode: analysis.code, labId: null } });
    const sampleId = randomUUID();
    const response = await request(app).post('/api/import/execute').set('Authorization', `Bearer ${token}`).send({ sampleIdColumn: 'sample', labId,
        columnMappings: [
            { column: 'text', analysisCode: code, methodologyId: methodId, unitCode: 'g/kg' },
            { column: 'ph', analysisCode: analysis.code, methodologyId: method.id, unitCode: analysis.unitCode }
        ], rows: [{ sample: sampleId, text: ' ND ', ph: '100' }, { sample: sampleId, text: 'Loam', ph: '6.42' }] });
    expect(response).toMatchObject({ status: 200, body: { importedSamples: 1, importedResults: 4 } });
    const rows = await prisma.result.findMany({ where: { sampleId } });
    expect(rows).toHaveLength(4);
    expect(rows.every(row => row.provenance === 'IMPORTED' && row.batchId === null && row.attemptId === null)).toBe(true);
    for (const value of [' ND ', 'Loam']) {
        const row = rows.find(row => row.value === value);
        expect(row).toMatchObject({ rawInput: value, numericValue: null, isValid: false });
        expect(JSON.parse(row.flags)).toEqual(expect.arrayContaining(['INVALID_FORMAT', 'IMPORTED_UNVALIDATED']));
    }
    const invalidPh = rows.find(row => row.param === analysis.code && row.value === '100');
    expect(invalidPh).toMatchObject({ rawInput: '100', numericValue: 100, isValid: false });
    expect(JSON.parse(invalidPh.flags)).toEqual(expect.arrayContaining(['ABOVE_MAX', 'IMPORTED_UNVALIDATED']));
    expect(rows.find(row => row.param === analysis.code && row.isCurrent)).toMatchObject({ value: '6.42', isValid: true, flags: '[]' });
    expect(await prisma.auditLog.count({ where: { sampleId, action: 'RESULT_RECORDED' } })).toBe(4);
});

test('offline texture supersedes legacy non-numeric PSA classes, preserves numeric rows, and replays without writes', async () => {
    await prisma.analysis.upsert({ where: { code: 'PSA' }, update: {},
        create: { code: 'PSA', name: 'Legacy particle size analysis', units: '%', validation: '{"type":"texture","tolerance":2}' } });
    const f = await fixture({ analysis: 'PSA' });
    const [oldClass,numeric]=await require('../helpers/workAttemptFixtures').createExecutionResultsFixture(prisma,{data:[
        {id:randomUUID(),sampleId:f.sample.id,param:'PSA',value:'Sandy clay',numericValue:null,rawInput:'historical class',flags:'["HISTORICAL"]',replicateNo:1},
        {id:randomUUID(),sampleId:f.sample.id,param:'PSA',value:'50',numericValue:50,replicateNo:2}]});
    const repeat=await require('../../services/workRepeatService').requestRepeat(prisma,f.item.id,actor,
        {reason:'CONFIRMATION',note:'New fraction execution confirms the retained class'});
    const operation = { operationId: randomUUID(), type: 'COMPLETE_WORK', target: { workItemId: f.item.id }, baseVersion: repeat.workItem.version,
        payload: { values: { sand: '50', silt: '35', clay: '15' }, flags: ['OFFLINE_CAPTURE'] } };
    expect((await sync.applySyncOperations(actor, [operation])).receipts[0]).toMatchObject({ status: 'APPLIED' });
    const texture = await prisma.result.findFirstOrThrow({ where: { sampleId: f.sample.id, param: 'TEXTURE', isCurrent: true } });
    expect(await prisma.result.findUnique({ where: { id: oldClass.id } }))
        .toEqual({ ...oldClass, isCurrent: false, supersededBy: texture.id, updatedAt: expect.any(Date) });
    expect(await prisma.result.findUnique({ where: { id: numeric.id } })).toEqual(numeric);
    expect(JSON.parse(texture.flags)).toContain('OFFLINE_CAPTURE');
    const receipt = await prisma.commandReceipt.findFirstOrThrow({ where: { idempotencyKey: operation.operationId } });
    expect(JSON.parse(receipt.outcome).resultId).toBe(texture.id);
    const before = snapshot();
    expect((await sync.applySyncOperations(actor, [operation])).receipts[0].status).toBe('DUPLICATE_APPLIED');
    expect(snapshot()).toEqual(before);
});

test.each(['derived'])('a generic result writer cannot use %s to bypass sealed work', async source => {
    const f = await fixture({ itemStatus: 'COMPLETED' }), before = snapshot();
    await expect(prisma.$transaction(tx => writer.writeResult(tx, { sampleId: f.sample.id, actor, source, measurement: measurement() })))
        .rejects.toMatchObject({ statusCode: 409, code: 'RESULT_SOURCE_FORBIDDEN' });
    expect(snapshot()).toEqual(before);
});

test.each(['SPEC_MIR', 'DRYING'])('%s summary writes one audit and never enters numerical results, reports or exports', async analysis => {
    const f = await fixture({ analysis, batch: null, status: 'APPROVED', itemStatus: 'ACCEPTED' });
    const text = `Non-numeric ${analysis} evidence`;
    await prisma.$transaction(tx => writer.writeNonMeasurementSummary(tx, f.item, { actor, kind: 'reviewed-evidence', text }));
    expect(await prisma.result.count({ where: { sampleId: f.sample.id } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entityId: f.item.id, action: 'NON_MEASUREMENT_SUMMARY' } })).toBe(1);
    expect((await request(app).get(`/api/results/${f.sample.id}`).set('Authorization', `Bearer ${token}`)).body).toEqual([]);
    const report = await require('../../services/reportAssembly').assembleReport(f.sample.id, actor);
    expect(JSON.stringify(report)).not.toContain(text);
    const exported = await request(app).post('/api/exports/data').set('Authorization', `Bearer ${token}`).send({ type: 'WET_CHEM', lab: labId });
    expect(exported.status).toBe(200); expect(JSON.stringify(exported.body)).not.toContain(text);
});

test('measurement cache-only summary and operational scalar writes are refused without writes', async () => {
    const measurementItem = await fixture(), operational = await fixture({ analysis: 'DRYING', batch: null }), before = snapshot();
    await expect(prisma.$transaction(tx => writer.writeNonMeasurementSummary(tx, measurementItem.item, { actor, kind: 'summary', text: '7.5' })))
        .rejects.toMatchObject({ statusCode: 409, code: 'RESULT_SUMMARY_NOT_ALLOWED' });
    await expect(prisma.$transaction(tx => writer.writeResult(tx, { sampleId: operational.sample.id, workItemId: operational.item.id,
        actor, measurement: { param: 'DRYING', value: '7.5' } }))).rejects.toMatchObject({ statusCode: 409, code: 'OPERATIONAL_SCALAR_FORBIDDEN' });
    expect(snapshot()).toEqual(before);
});

test('attempt insert/update and delete guards preserve every table and map stable 409s', async () => {
    const f = await fixture(), other = await fixture();
    const row = await prisma.$transaction(tx => writer.writeResult(tx, { sampleId: f.sample.id, workItemId: f.item.id, actor, measurement: measurement() }));
    const attemptId=row.attemptId;
    const otherRow = await prisma.$transaction(tx => writer.writeResult(tx,
        { sampleId: other.sample.id, workItemId: other.item.id, actor, measurement: measurement() }));
    const file = path.resolve(__dirname, '../.tmp', `audit_result_link_${randomUUID()}.db`);
    const original = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
    try { await original.backup(file); } finally { original.close(); }
    try {
        for (const [statement, parameters, expectedGuardCode] of [
            ['INSERT INTO "Result" (id,sampleId,param,value,updatedAt,attemptId) VALUES (?,?,?,?,?,?)', [randomUUID(), f.sample.id, code, '5', new Date().toISOString(), 'missing-attempt'], 'RESULT_ATTEMPT_NOT_FOUND'],
            ['INSERT INTO "Result" (id,sampleId,param,value,updatedAt,attemptId) VALUES (?,?,?,?,?,?)', [randomUUID(), other.sample.id, code, '5', new Date().toISOString(), attemptId], 'RESULT_ATTEMPT_SAMPLE_MISMATCH'],
            ['UPDATE "Result" SET attemptId=? WHERE id=?', ['missing-attempt', row.id], 'RESULT_ATTEMPT_NOT_FOUND'],
            ['UPDATE "Result" SET attemptId=? WHERE id=?', [attemptId, otherRow.id], 'RESULT_ATTEMPT_SAMPLE_MISMATCH'],
            ['UPDATE "Result" SET sampleId=? WHERE id=?', [other.sample.id, row.id], 'RESULT_ATTEMPT_SAMPLE_MISMATCH'],
            ['DELETE FROM "WorkAttempt" WHERE id=?', [attemptId], 'RESULT_ATTEMPT_REFERENCED']
        ]) rejectedGuardWrite({ file, actor: 'system:fixture', statement, parameters, expectedGuardCode });
    } finally { fs.unlinkSync(file); }
});

test.each([
    'db.result.create({data:{value:"2"}})', 'const delegate=tx.result;delegate.createMany({data:[]})',
    'db.sample.update({data:{results:{create:{value:"2"}}}})',
    'db.workItem.update({data:{result:"2"}})', 'const key="result";tx.workItem?.update({data:{[key]:"2"}})',
    'db.prepare("UPDATE main.WorkItem SET result = ? WHERE id = ?")', 'db.prepare("INSERT INTO Result (id,value) VALUES (?,?)")'
])('the write inventory catches an unauthorized result/cache writer: %s', source => {
    expect(scanSource(source, 'controllers/result-canary.js')).toHaveLength(1);
});

test.each(['Result_attempt_insert_guard', 'Result_attempt_update_guard', 'WorkAttempt_result_reference_guard'])
    ('the write inventory refuses disabling %s', name => {
        expect(scanSource(`db.exec('DROP TRIGGER "${name}"')`, 'controllers/result-canary.js'))
            .toEqual([expect.objectContaining({ code: 'WORKFLOW_GUARD_DISABLED' })]);
    });

test.each([
    "writer.writeResult(tx,{source:'legacy-import'})",
    "const mode='legacy-import';writer.writeResult(tx,{source:mode})",
    "const key='source';writer.writeResult(tx,{[key]:'legacy-import'})",
    "options.source='legacy-import'"
])('the inventory restricts the historical option to the import entry point: %s', source => {
    expect(scanSource(source, 'controllers/result-canary.js'))
        .toEqual([expect.objectContaining({ code: 'HISTORICAL_IMPORT_CALLER_FORBIDDEN' })]);
    expect(scanSource(source, 'controllers/importController.js')).toEqual([]);
});

test.each([
    "writer.writeResult(tx,{source:'derived'})",
    "const mode='derived';writer.writeResult(tx,{source:mode})",
    "const key='source';writer.writeResult(tx,{[key]:'derived'})",
    "options.source='derived'"
])('the inventory confines the derived option to the two texture functions: %s', source => {
    for (const file of ['controllers/result-canary.js', 'tests/caller.test.js', 'services/resultWriteService.js']) {
        expect(scanSource(source, file)).toEqual([expect.objectContaining({ code: 'DERIVED_RESULT_CALLER_FORBIDDEN' })]);
    }
    for (const name of ['deriveTextureResult', 'writeTextureDetermination']) {
        expect(scanSource(`function ${name}(){${source}}`, 'services/resultWriteService.js')).toEqual([]);
    }
    expect(scanSource(`function writeResult(){${source}}`, 'services/resultWriteService.js'))
        .toEqual([expect.objectContaining({ code: 'DERIVED_RESULT_CALLER_FORBIDDEN' })]);
});

test('the inventory confines sync identity/flags and prediction provenance to internal callers', () => {
    for (const source of ["writer.writeResult(tx,{syncResult:{id:'known',flags:[]}})", "options.syncResult={id:'known'}"]) {
        expect(scanSource(source, 'controllers/result-canary.js')).toEqual([expect.objectContaining({ code: 'SYNC_RESULT_CALLER_FORBIDDEN' })]);
        expect(scanSource(source, 'services/syncService.js')).toEqual([]);
    }
    const prediction = "writer.writeResult(tx,{source:'spectral-prediction'})";
    expect(scanSource(prediction, 'controllers/result-canary.js')).toEqual([expect.objectContaining({ code: 'PREDICTED_RESULT_CALLER_FORBIDDEN' })]);
    expect(scanSource(`function writeSpectralPrediction(){${prediction}}`, 'services/resultWriteService.js')).toEqual([]);
});
