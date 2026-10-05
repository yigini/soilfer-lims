const { createResultFixture } = require('../../services/resultWriteService');
const request = require('supertest');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken, ensureTestLab } = require('../setup');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { createLegacyClosureDatabase, useLegacyRouteDatabase } = require('../helpers/legacyWorkflowDatabase');

const labId = 'LAB-SPECTRAL-STATE-179';
let token, equipmentId;
const databases = [];
beforeAll(async () => {
    await ensureTestLab(labId, 'TEST'); token = await getAuthToken('LAB_MANAGER', labId);
    equipmentId = randomUUID();
    await prisma.equipmentAsset.create({ data: { id: equipmentId, labId, assetType: 'SPECTROMETER', name: 'Spectral audit fixture',
        status: 'IN_SERVICE', criticality: 'HIGH' } });
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => { for (const database of databases) await database.close(); });
const post = (path, body) => request(app).post(path).set('Authorization', `Bearer ${token}`).send(body);
const remove = (id, body = { reason: 'Repeat acquisition after handling error' }) => request(app).delete(`/api/spectral/${id}`)
    .set('Authorization', `Bearer ${token}`).send(body);

async function fixture({ status = 'COMPLETED', parentStatus = 'PROCESSING' } = {}) {
    const sampleData = { id: randomUUID(), originalId: randomUUID(), assignedLab: labId, status: parentStatus,
        receptionDate: new Date(), dryingStatus: 'DONE', preparationStatus: 'DONE' };
    const itemData = { id: randomUUID(), sampleId: sampleData.id, analysis: 'SPEC_MIR', assignedLab: labId, status,
        result: 'Retained prior spectrum summary', completedAt: status === 'COMPLETED' ? new Date('2026-10-01T12:00:00Z') : null,
        history: '[{"status":"ASSIGNED","note":"Retained earlier assignment"}]' };
    let db = prisma, sample, item;
    if (status === 'CANCELLED') {
        const now = Date.now();
        const database = await createLegacyClosureDatabase({ analysis: 'ARCHIVING', labId,
            samples: [{ ...sampleData, createdAt: now, updatedAt: now }],
            workItems: [{ ...itemData, createdAt: now, updatedAt: now }] });
        databases.push(database); db = database.client; useLegacyRouteDatabase(prisma, db);
        sample = await db.sample.findUnique({ where: { id: sampleData.id } });
        item = await db.workItem.findUnique({ where: { id: itemData.id } });
    } else {
        sample = await createSampleFixture(db, { data: sampleData });
        item = await createWorkItemFixture(db, { data: itemData });
    }
    const result = await createResultFixture(db, { data: { id: randomUUID(), sampleId: sample.id, param: 'PH_H2O',
        value: '6.27', numericValue: 6.27, unit: 'pH', flags: '["RETAINED_SCIENTIFIC_FLAG"]' } });
    const scan = await db.spectralData.create({ data: { id: randomUUID(), sampleId: sample.id, workItemId: item.id,
        labId, filename: `${randomUUID()}.csv`, modality: 'MIR', quantity: 'ABSORBANCE', qcStatus: 'PASS',
        status: 'VALIDATED', isCurrent: true, metadata: '{"retainedMetadata":true}' } });
    return { db, sample, item, result, scan };
}
async function snapshot(f) {
    return { sample: await f.db.sample.findUnique({ where: { id: f.sample.id } }),
        items: await f.db.workItem.findMany({ where: { sampleId: f.sample.id }, orderBy: { id: 'asc' } }),
        scans: await f.db.spectralData.findMany({ where: { sampleId: f.sample.id }, orderBy: { id: 'asc' } }),
        results: await f.db.result.findMany({ where: { sampleId: f.sample.id }, orderBy: { id: 'asc' } }),
        decisions: await f.db.reviewDecision.findMany({ where: { sampleId: f.sample.id } }),
        audits: await f.db.auditLog.findMany({ where: { sampleId: f.sample.id }, orderBy: { id: 'asc' } }) };
}
const link = (f, body = {}) => post('/api/spectral/link-task', { scanId: f.scan.id, workItemId: f.item.id, ...body });
const review = (f, body = {}) => post(`/api/spectral/${f.scan.id}/review`, { action: 'APPROVE', ...body });

function prepareAcquisition(mode, fixtures) {
    const scans = fixtures.map(f => ({ id: randomUUID(), filename: `${randomUUID()}.csv`, sampleId: f.sample.id,
        targetWorkItemId: f.item.id, equipmentId, modality: 'MIR', quantity: 'ABSORBANCE', qcStatus: 'PASS',
        sha256: randomUUID(), wavelengths: [4000, 3600, 3200, 2800, 2400, 2000, 1600, 1200, 800, 400],
        values: [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.3, 0.2, 0.1] }));
    if (mode === 'upload') return { scans, send: body => post('/api/spectral/batch', { scans, ...body }) };
    const manifestId = `audit-spectral-179-${randomUUID()}`;
    const directory = path.resolve(__dirname, '../../uploads/staging', manifestId);
    fs.mkdirSync(directory);
    for (const scan of scans) fs.writeFileSync(path.join(directory, scan.filename), 'wavelength,absorbance\n4000,0.1\n400,0.1', { flag: 'wx' });
    fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ equipmentId,
        expiresAt: new Date(Date.now() + 60000).toISOString(), items: scans }), { flag: 'wx' });
    return { scans, manifestId, manifestPath: path.join(directory, 'manifest.json'),
        send: body => post('/api/spectral/batch/commit', { manifestId, ...body }) };
}
async function acquire(mode, fixtures, body = {}) {
    return prepareAcquisition(mode, fixtures).send(body);
}
function allTables() {
    const db = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
    try {
        return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
            .map(({ name }) => ({ name, rows: db.prepare(`SELECT * FROM "${name.replace(/"/g, '""')}"`).all()
                .map(row => JSON.stringify(row, (_, value) => typeof value === 'bigint' ? `${value}n` : value)).sort() }));
    } finally { db.close(); }
}

test('link on COMPLETED without a supplied reopen reason refuses with zero changes', async () => {
    const f = await fixture(), before = await snapshot(f);
    const response = await link(f);
    expect(response.status).toBe(409); expect(response.body.code).toBe('WORKITEM_REOPEN_REQUIRED');
    expect(await snapshot(f)).toEqual(before);
});

test('reasoned link atomically reopens and completes work, snapshots prior evidence and preserves Results', async () => {
    const f = await fixture(), before = await snapshot(f), reason = 'Acquisition correction requested by manager';
    const response = await link(f, { reopenReason: reason });
    expect(response.status).toBe(200); expect(response.body.workItemStatus).toBe('COMPLETED');
    const after = await snapshot(f), item = after.items[0];
    expect(after.sample).toEqual(before.sample); expect(after.results).toEqual(before.results);
    expect(item.version).toBe(f.item.version + 2);
    expect(JSON.parse(item.history)).toEqual([JSON.parse(f.item.history)[0],
        expect.objectContaining({ action: 'SPECTRAL_WORK_REOPENED', status: 'IN_PROGRESS', reason,
            priorResult: f.item.result, priorCompletedAt: f.item.completedAt.toISOString() }),
        expect.objectContaining({ action: 'SPECTRAL_WORK_COMPLETED', status: 'COMPLETED' })]);
    const audit = after.audits.find(row => row.action === 'SPECTRAL_WORK_REOPENED');
    expect(JSON.parse(audit.details)).toMatchObject({ reason, priorResult: f.item.result, priorCompletedAt: f.item.completedAt.toISOString() });
    expect(after.audits).toHaveLength(before.audits.length + 3);
});

test('trash on COMPLETED preserves the summary, clears only completion time and audits its prior identity', async () => {
    const f = await fixture(), before = await snapshot(f), reason = 'Wrong sample preparation used for acquisition';
    const response = await remove(f.scan.id, { reason });
    expect(response.status).toBe(200);
    const after = await snapshot(f), item = after.items[0];
    expect(item).toMatchObject({ status: 'IN_PROGRESS', result: f.item.result, completedAt: null, version: f.item.version + 1 });
    expect(after.results).toEqual(before.results); expect(after.sample).toEqual(before.sample);
    expect(after.scans[0]).toMatchObject({ status: 'DELETED', isCurrent: true, workItemId: f.item.id });
    expect(JSON.parse(after.scans[0].metadata)).toMatchObject({ retainedMetadata: true, _deletedPreviousStatus: 'VALIDATED', _deletedReason: reason });
    const entry = JSON.parse(item.history).at(-1);
    expect(entry).toMatchObject({ reason, priorResult: f.item.result, priorCompletedAt: f.item.completedAt.toISOString() });
    expect(JSON.parse(after.audits.find(row => row.action === 'SPECTRAL_WORK_REOPENED').details)).toEqual(entry);
    expect(after.audits).toHaveLength(before.audits.length + 2);
});

test('trash on IN_PROGRESS changes no work item state, version, history or summary', async () => {
    const f = await fixture({ status: 'IN_PROGRESS' }), before = await snapshot(f);
    expect((await remove(f.scan.id)).status).toBe(200);
    const after = await snapshot(f);
    expect(after.items).toEqual(before.items); expect(after.results).toEqual(before.results); expect(after.sample).toEqual(before.sample);
    expect(after.scans[0].status).toBe('DELETED'); expect(after.audits).toHaveLength(before.audits.length + 1);
});

test.each(['single', 'batch'])('%s trash requires a supplied reason and writes no records', async mode => {
    const f = await fixture(), before = await snapshot(f);
    const response = mode === 'single' ? await remove(f.scan.id, {}) : await post('/api/spectral/batch-delete', { ids: [f.scan.id] });
    expect(response.status).toBe(422); expect(response.body.code).toBe('SPECTRAL_TRASH_REASON_REQUIRED');
    expect(await snapshot(f)).toEqual(before);
});

test.each(['SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED', 'ON_HOLD', 'AWAITING_VERIFICATION'].flatMap(status => ['link', 'trash'].map(mode => [status, mode])))
    ('%s work refuses spectral %s with zero changes', async (status, mode) => {
        const f = await fixture({ status }), before = await snapshot(f);
        const response = mode === 'link' ? await link(f, { reopenReason: 'Correction request' }) : await remove(f.scan.id);
        expect(response.status).toBe(409); expect(response.body.code).toBe('WORKITEM_STATE_CONFLICT');
        expect(await snapshot(f)).toEqual(before);
    });

test.each(['APPROVED', 'ARCHIVED', 'DISPOSED', 'CANCELLED', 'RECEIVED_REJECTED'].flatMap(status => ['link', 'trash'].map(mode => [status, mode])))
    ('%s parent refuses spectral %s with zero changes', async (parentStatus, mode) => {
        const f = await fixture({ parentStatus }), before = await snapshot(f);
        const response = mode === 'link' ? await link(f, { reopenReason: 'Correction request' }) : await remove(f.scan.id);
        expect(response.status).toBe(409);
        expect(response.body.code).toBe(parentStatus === 'APPROVED' ? 'AMENDMENT_WORKFLOW_REQUIRED'
            : parentStatus === 'RECEIVED_REJECTED' ? 'SAMPLE_REJECTED' : 'SAMPLE_CLOSED');
        expect(await snapshot(f)).toEqual(before);
    });

test('mixed batch trash commits the good scan and changes no rows for the refused scan', async () => {
    const good = await fixture(), blocked = await fixture({ status: 'SUBMITTED' }), before = await snapshot(blocked);
    const response = await post('/api/spectral/batch-delete', { ids: [good.scan.id, blocked.scan.id], reason: 'Acquisition correction' });
    expect(response.status).toBe(200); expect(response.body.results).toMatchObject({ succeeded: 1, failed: 1,
        errors: [{ id: blocked.scan.id, code: 'WORKITEM_STATE_CONFLICT' }] });
    expect((await snapshot(good)).scans[0].status).toBe('DELETED'); expect(await snapshot(blocked)).toEqual(before);
});

test('late spectral audit failure rolls back scan trash, reopening, history and all audits', async () => {
    const f = await fixture(), before = await snapshot(f), transaction = prisma.$transaction.bind(prisma);
    jest.spyOn(prisma, '$transaction').mockImplementation(callback => transaction(tx => callback({ ...tx,
        auditLog: { ...tx.auditLog, create: args => {
            if (args.data.action === 'SPECTRA_TRASH') throw new Error('Injected spectral audit failure');
            return tx.auditLog.create(args);
        } } })));
    expect((await remove(f.scan.id)).status).toBe(500); expect(await snapshot(f)).toEqual(before);
});

test('a concurrent work item version change loses the reopening CAS and rolls back every write', async () => {
    const f = await fixture(), before = await snapshot(f), transaction = prisma.$transaction.bind(prisma);
    let reads = 0;
    jest.spyOn(prisma, '$transaction').mockImplementation(callback => transaction(tx => callback({ ...tx,
        workItem: { ...tx.workItem, findUnique: async args => {
            const row = await tx.workItem.findUnique(args);
            if (args.where.id === f.item.id && ++reads === 2) {
                await tx.workItem.update({ where: { id: f.item.id }, data: { version: { increment: 1 } } });
            }
            return row;
        } } })));
    const response = await remove(f.scan.id);
    expect(response.status).toBe(409); expect(response.body.code).toBe('WORKITEM_STATE_CHANGED');
    expect(await snapshot(f)).toEqual(before);
});

test('fresh parent scope is checked inside the trash transaction and a refusal changes no rows', async () => {
    const f = await fixture(), before = await snapshot(f), transaction = prisma.$transaction.bind(prisma);
    jest.spyOn(prisma, '$transaction').mockImplementation(callback => transaction(async tx => {
        await tx.sample.update({ where: { id: f.sample.id }, data: { assignedLab: 'OTHER-LAB' } });
        return callback(tx);
    }));
    const response = await remove(f.scan.id);
    expect(response.status).toBe(403); expect(response.body.code).toBe('ACCESS_DENIED_LAB');
    expect(await snapshot(f)).toEqual(before);
});

test('a present incomplete preparation item overrides legacy DONE flags and refuses spectral changes', async () => {
    const f = await fixture();
    await createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId: f.sample.id, analysis: 'PREPARATION', assignedLab: labId, status: 'IN_PROGRESS' } });
    const before = await snapshot(f), response = await link(f, { reopenReason: 'Correction request' });
    expect(response.status).toBe(409); expect(response.body.code).toBe('GATE_STATE_MISMATCH');
    expect(await snapshot(f)).toEqual(before);
});

test.each(['upload', 'commit'])('%s on COMPLETED without a reason refuses the scan and changes no rows', async mode => {
    const f = await fixture(), before = await snapshot(f), response = await acquire(mode, [f]);
    expect(response.status).toBe(409); expect(response.body).toMatchObject({ code: 'WORKITEM_REOPEN_REQUIRED',
        details: { affected: [expect.objectContaining({ workItemId: f.item.id })] } });
    expect(await snapshot(f)).toEqual(before);
});

test.each(['upload', 'commit'])('%s with a reason reopens, adds and completes atomically without changing Results', async mode => {
    const f = await fixture(), before = await snapshot(f), reason = 'Additional acquisition required';
    const response = await acquire(mode, [f], { reopenReason: reason });
    expect(response.status).toBe(200); expect((mode === 'upload' ? response.body.results : response.body)).toMatchObject({ success: 1, failed: 0 });
    const after = await snapshot(f);
    expect(after.scans).toHaveLength(2); expect(after.items[0]).toMatchObject({ status: 'COMPLETED', version: f.item.version + 2 });
    expect(after.results).toEqual(before.results); expect(after.sample).toEqual(before.sample);
    expect(JSON.parse(after.items[0].history).at(-2)).toMatchObject({ reason, priorResult: f.item.result,
        priorCompletedAt: f.item.completedAt.toISOString() });
    expect(after.audits).toHaveLength(before.audits.length + 3);
    if (mode === 'upload') expect(after.scans.find(scan => scan.id === f.scan.id)).toMatchObject({ isCurrent: false });
});

test.each(['upload', 'commit'])('%s preflight preserves every table and staged bytes; the same request resends without duplicates', async mode => {
    const ready = await fixture({ status: 'ASSIGNED' }), first = await fixture(), second = await fixture();
    const request = prepareAcquisition(mode, [ready, first, second]);
    const before = allTables(), stagedBefore = request.manifestPath && fs.readFileSync(request.manifestPath);
    const response = await request.send({});
    expect(response.status).toBe(409); expect(response.body.code).toBe('WORKITEM_REOPEN_REQUIRED');
    expect(response.body.details.affected.map(entry => entry.workItemId).sort()).toEqual([first.item.id, second.item.id].sort());
    expect(allTables()).toEqual(before);
    if (stagedBefore) expect(fs.readFileSync(request.manifestPath)).toEqual(stagedBefore);
    const resent = await request.send({ reopenReason: 'Same batch acquisition correction' });
    expect(resent.status).toBe(200); expect((mode === 'upload' ? resent.body.results : resent.body)).toMatchObject({ success: 3, failed: 0 });
    for (const f of [ready, first, second]) {
        const after = await snapshot(f);
        expect(after.scans).toHaveLength(2);
        expect(after.results).toEqual([f.result]);
        expect(after.audits.filter(row => row.action === 'SPECTRAL_WORK_REOPENED')).toHaveLength(f === ready ? 0 : 1);
    }
});

test.each(['saved', 'interrupted'])('partial staged commit preserves the manifest and skips committed entries when its receipt is %s', async receiptMode => {
    const ready = await fixture({ status: 'ASSIGNED' }), raced = await fixture();
    const batch = prepareAcquisition('commit', [ready, raced]);
    const state = require('../../services/spectralWorkItemStateService'), prepare = state.prepareItem;
    // Simulate a concurrent completion immediately after the read-only preflight.
    jest.spyOn(state, 'prepareItem').mockImplementation((tx, expected, sampleId, actor, options) =>
        options?.preflight && expected?.id === raced.item.id ? Promise.resolve(expected) : prepare(tx, expected, sampleId, actor, options));
    if (receiptMode === 'interrupted') {
        const rename = fs.renameSync;
        jest.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
            if (to === batch.manifestPath) throw new Error('Injected interrupted receipt save');
            return rename(from, to);
        });
    }
    const first = await batch.send({ idempotencyKey: `partial-${batch.manifestId}` });
    expect(first.status).toBe(200); expect(first.body).toMatchObject({ success: 1, failed: 1, complete: false,
        errors: [expect.objectContaining({ code: 'WORKITEM_REOPEN_REQUIRED' })] });
    expect(fs.existsSync(batch.manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(batch.manifestPath));
    if (receiptMode === 'saved') expect(Object.keys(manifest.committedEntries)).toEqual([batch.scans[0].id]);
    const readyBefore = await snapshot(ready), racedBefore = await snapshot(raced);
    jest.restoreAllMocks();
    const retry = await batch.send({ idempotencyKey: `partial-${batch.manifestId}`, reopenReason: 'Concurrent completion reviewed' });
    expect(retry.status).toBe(200); expect(retry.body).toMatchObject({ success: 2, failed: 0, complete: true });
    expect(retry.body.committedScans.map(scan => scan.id)).toContain(first.body.committedScans[0].id);
    expect(new Set(retry.body.committedScans.map(scan => scan.id)).size).toBe(2);
    expect(await snapshot(ready)).toEqual(readyBefore);
    expect((await snapshot(raced)).scans).toHaveLength(racedBefore.scans.length + 1);
    expect(fs.existsSync(batch.manifestPath)).toBe(false);
    const after = allTables();
    const cached = await batch.send({ idempotencyKey: `partial-${batch.manifestId}` });
    expect(cached.body).toEqual(retry.body); expect(allTables()).toEqual(after);
});

test('SKIP and terminal parse failures settle a staged commit with retained per-entry receipts', async () => {
    const committed = await fixture({ status: 'ASSIGNED' }), skipped = await fixture({ status: 'ASSIGNED' }), invalid = await fixture({ status: 'ASSIGNED' });
    const batch = prepareAcquisition('commit', [committed, skipped, invalid]);
    const manifest = JSON.parse(fs.readFileSync(batch.manifestPath));
    manifest.items[2].parseError = 'Invalid spectral axis';
    fs.writeFileSync(batch.manifestPath, JSON.stringify(manifest));
    const beforeSkipped = await snapshot(skipped), beforeInvalid = await snapshot(invalid);
    const payload = { idempotencyKey: `settled-${batch.manifestId}`, decisions: { [batch.scans[1].id]: { decision: 'SKIP' } } };
    const response = await batch.send(payload);
    expect(response.status).toBe(200); expect(response.body).toMatchObject({ complete: true, success: 1, skipped: 1, failed: 1,
        errors: [expect.objectContaining({ filename: batch.scans[2].filename, error: 'Invalid spectral axis', terminal: true })] });
    expect(response.body.settledEntries).toEqual([
        { id: batch.scans[1].id, filename: batch.scans[1].filename, status: 'SKIPPED' },
        { id: batch.scans[2].id, filename: batch.scans[2].filename, status: 'PARSE_ERROR', error: 'Invalid spectral axis' }
    ]);
    expect(fs.existsSync(batch.manifestPath)).toBe(false);
    expect(await snapshot(skipped)).toEqual(beforeSkipped); expect(await snapshot(invalid)).toEqual(beforeInvalid);
    const beforeReplay = allTables();
    expect((await batch.send(payload)).body).toEqual(response.body); expect(allTables()).toEqual(beforeReplay);
});

test('settled SKIP and parse receipts survive a partial manifest and merge without replay on retry', async () => {
    const ready = await fixture({ status: 'ASSIGNED' }), raced = await fixture(), skipped = await fixture({ status: 'ASSIGNED' });
    const batch = prepareAcquisition('commit', [ready, raced, skipped]);
    const manifest = JSON.parse(fs.readFileSync(batch.manifestPath));
    manifest.items.push({ id: 'terminal-parse-entry', filename: 'invalid.csv', parseError: 'Unparseable file' });
    fs.writeFileSync(batch.manifestPath, JSON.stringify(manifest));
    const state = require('../../services/spectralWorkItemStateService'), prepare = state.prepareItem;
    jest.spyOn(state, 'prepareItem').mockImplementation((tx, expected, sampleId, actor, options) =>
        options?.preflight && expected?.id === raced.item.id ? Promise.resolve(expected) : prepare(tx, expected, sampleId, actor, options));
    const payload = { decisions: { [batch.scans[2].id]: { decision: 'SKIP' } } };
    const first = await batch.send(payload);
    expect(first.body).toMatchObject({ complete: false, success: 1, failed: 2, skipped: 1 });
    const partial = JSON.parse(fs.readFileSync(batch.manifestPath));
    expect(Object.keys(partial.settledEntries).sort()).toEqual([batch.scans[2].id, 'terminal-parse-entry'].sort());
    const readyBefore = await snapshot(ready), skippedBefore = await snapshot(skipped);
    jest.restoreAllMocks();
    const retry = await batch.send({ ...payload, reopenReason: 'Concurrent completion reviewed' });
    expect(retry.body).toMatchObject({ complete: true, success: 2, failed: 1, skipped: 1,
        errors: [expect.objectContaining({ filename: 'invalid.csv', terminal: true })] });
    expect(retry.body.settledEntries).toEqual(first.body.settledEntries);
    expect(await snapshot(ready)).toEqual(readyBefore); expect(await snapshot(skipped)).toEqual(skippedBefore);
    expect((await snapshot(raced)).scans).toHaveLength(2); expect(fs.existsSync(batch.manifestPath)).toBe(false);
});

test.each(['upload', 'commit'])('%s uses the trimmed entry reason when the request reason is only whitespace', async mode => {
    const f = await fixture(), batch = prepareAcquisition(mode, [f]);
    batch.scans[0].reopenReason = '  Reviewed acquisition correction  ';
    const response = await batch.send({ reopenReason: '   ', decisions: { [batch.scans[0].id]: { reopenReason: batch.scans[0].reopenReason } } });
    expect(response.status).toBe(200); expect((mode === 'upload' ? response.body.results : response.body)).toMatchObject({ success: 1, failed: 0 });
    expect(JSON.parse((await snapshot(f)).items[0].history).at(-2).reason).toBe('Reviewed acquisition correction');
});

test.each(['SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED', 'ON_HOLD', 'AWAITING_VERIFICATION', 'NOT_ASSIGNED']
    .flatMap(status => ['upload', 'commit'].map(mode => [status, mode])))
    ('%s work refuses %s acquisition with zero changes', async (status, mode) => {
        const f = await fixture({ status }), before = await snapshot(f);
        const response = await acquire(mode, [f], { reopenReason: 'Acquisition correction' });
        expect(response.status).toBe(200); expect((mode === 'upload' ? response.body.results : response.body)).toMatchObject({ success: 0, failed: 1,
            errors: [expect.objectContaining({ code: 'WORKITEM_STATE_CONFLICT' })] });
        expect(await snapshot(f)).toEqual(before);
    });

test.each(['APPROVED', 'ARCHIVED', 'DISPOSED', 'CANCELLED', 'RECEIVED_REJECTED']
    .flatMap(parentStatus => ['upload', 'commit'].map(mode => [parentStatus, mode])))
    ('%s parent refuses %s acquisition without changing scans, work, Results or audits', async (parentStatus, mode) => {
        const f = await fixture({ parentStatus }), before = await snapshot(f);
        const response = await acquire(mode, [f], { reopenReason: 'Acquisition correction' });
        expect(response.status).toBe(200); expect((mode === 'upload' ? response.body.results : response.body)).toMatchObject({ success: 0, failed: 1,
            errors: [expect.objectContaining({ code: parentStatus === 'APPROVED' ? 'AMENDMENT_WORKFLOW_REQUIRED'
                : parentStatus === 'RECEIVED_REJECTED' ? 'SAMPLE_REJECTED' : 'SAMPLE_CLOSED' })] });
        expect(await snapshot(f)).toEqual(before);
    });

test.each(['upload', 'commit'])('%s mixed acquisition commits ready work and writes nothing for a blocked item', async mode => {
    const good = await fixture({ status: 'ASSIGNED' }), blocked = await fixture({ status: 'SUBMITTED' }), before = await snapshot(blocked);
    const response = await acquire(mode, [good, blocked]);
    expect(response.status).toBe(200); expect((mode === 'upload' ? response.body.results : response.body)).toMatchObject({ success: 1, failed: 1,
        errors: [expect.objectContaining({ code: 'WORKITEM_STATE_CONFLICT' })] });
    expect((await snapshot(good)).items[0].status).toBe('COMPLETED'); expect(await snapshot(blocked)).toEqual(before);
});

test.each(['upload', 'commit'])('%s late audit failure rolls back new scans, supersession and both item transitions', async mode => {
    const f = await fixture(), before = await snapshot(f), transaction = prisma.$transaction.bind(prisma);
    jest.spyOn(prisma, '$transaction').mockImplementation(callback => transaction(tx => callback({ ...tx,
        auditLog: { ...tx.auditLog, create: args => {
            if (args.data.entity === 'SPECTRA') throw new Error('Injected acquisition audit failure');
            return tx.auditLog.create(args);
        } } })));
    const response = await acquire(mode, [f], { reopenReason: 'Acquisition correction' });
    expect(response.status).toBe(200); expect((mode === 'upload' ? response.body.results : response.body)).toMatchObject({ success: 0, failed: 1 });
    expect(await snapshot(f)).toEqual(before);
});

test.each(['APPROVE', 'REJECT', 'UNDO'])('count-stable %s review preserves completed work and commits only the scan audit', async action => {
    const f = await fixture();
    if (action !== 'APPROVE') {
        f.scan = await f.db.spectralData.update({ where: { id: f.scan.id }, data: { qcStatus: 'FAIL', ...(action === 'UNDO' && { status: 'REJECTED' }) } });
    }
    const before = await snapshot(f), response = await review(f, { action });
    expect(response.status).toBe(200);
    const after = await snapshot(f);
    expect(after.items).toEqual(before.items); expect(after.sample).toEqual(before.sample); expect(after.results).toEqual(before.results);
    expect(after.audits).toHaveLength(before.audits.length + 1);
});

test.each(['REJECT', 'UNDO'])('count-changing %s review on COMPLETED requires a reason and changes no rows', async action => {
    const f = await fixture();
    if (action === 'UNDO') f.scan = await f.db.spectralData.update({ where: { id: f.scan.id }, data: { status: 'REJECTED' } });
    const before = await snapshot(f), response = await review(f, { action });
    expect(response.status).toBe(409); expect(response.body.code).toBe('WORKITEM_REOPEN_REQUIRED');
    expect(await snapshot(f)).toEqual(before);
});

test('reasoned rejection of the sole counted scan leaves work in progress and preserves the earlier summary', async () => {
    const f = await fixture(), before = await snapshot(f), reason = 'Scan was acquired with wrong sample geometry';
    const response = await review(f, { action: 'REJECT', reopenReason: reason });
    expect(response.status).toBe(200);
    const after = await snapshot(f);
    expect(after.items[0]).toMatchObject({ status: 'IN_PROGRESS', completedAt: null, result: f.item.result, version: f.item.version + 1 });
    expect(after.scans[0].status).toBe('REJECTED'); expect(after.results).toEqual(before.results);
    expect(JSON.parse(after.items[0].history).at(-1)).toMatchObject({ reason, priorResult: f.item.result,
        priorCompletedAt: f.item.completedAt.toISOString() });
    expect(after.audits).toHaveLength(before.audits.length + 2);
});

test.each(['REJECT', 'UNDO'])('reasoned %s review recompletes only when current linked non-failed evidence remains', async action => {
    const f = await fixture(), reason = 'Scan review correction';
    if (action === 'UNDO') f.scan = await f.db.spectralData.update({ where: { id: f.scan.id }, data: { status: 'REJECTED' } });
    else await f.db.spectralData.create({ data: { id: randomUUID(), sampleId: f.sample.id, workItemId: f.item.id, labId,
        filename: 'retained-valid-replicate.csv', modality: 'MIR', qcStatus: 'PASS', status: 'APPROVED', isCurrent: true } });
    const before = await snapshot(f), response = await review(f, { action, reopenReason: reason });
    expect(response.status).toBe(200);
    const after = await snapshot(f);
    expect(after.items[0]).toMatchObject({ status: 'COMPLETED', version: f.item.version + 2 });
    expect(JSON.parse(after.items[0].history).at(-2)).toMatchObject({ reason, priorResult: f.item.result });
    expect(after.results).toEqual(before.results); expect(after.audits).toHaveLength(before.audits.length + 3);
});

test('approval of an unlinked scan creates no inferred association and completes no matching work', async () => {
    const f = await fixture({ status: 'ASSIGNED' });
    f.scan = await f.db.spectralData.update({ where: { id: f.scan.id }, data: { workItemId: null } });
    const before = await snapshot(f), response = await review(f);
    expect(response.status).toBe(200);
    const after = await snapshot(f);
    expect(after.scans[0]).toMatchObject({ status: 'APPROVED', workItemId: null });
    expect(after.items).toEqual(before.items); expect(after.results).toEqual(before.results);
    expect(after.audits).toHaveLength(before.audits.length + 1);
});

test('QC-FAIL scan approval does not satisfy completion or create Result values', async () => {
    const f = await fixture({ status: 'ASSIGNED' });
    f.scan = await f.db.spectralData.update({ where: { id: f.scan.id }, data: { qcStatus: 'FAIL' } });
    const before = await snapshot(f), response = await review(f);
    expect(response.status).toBe(200);
    const after = await snapshot(f);
    expect(after.scans[0]).toMatchObject({ status: 'APPROVED', qcStatus: 'FAIL' });
    expect(after.items).toEqual(before.items); expect(after.results).toEqual(before.results);
});

test.each(['SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED', 'ON_HOLD', 'AWAITING_VERIFICATION'])
    ('%s bound work refuses scan review with zero changes', async status => {
        const f = await fixture({ status }), before = await snapshot(f), response = await review(f);
        expect(response.status).toBe(409); expect(response.body.code).toBe('WORKITEM_STATE_CONFLICT');
        expect(await snapshot(f)).toEqual(before);
    });

test.each(['APPROVED', 'ARCHIVED', 'DISPOSED', 'CANCELLED', 'RECEIVED_REJECTED'])
    ('%s parent refuses scan review with zero changes', async parentStatus => {
        const f = await fixture({ parentStatus }), before = await snapshot(f), response = await review(f);
        expect(response.status).toBe(409); expect(response.body.code).toBe(parentStatus === 'APPROVED' ? 'AMENDMENT_WORKFLOW_REQUIRED'
            : parentStatus === 'RECEIVED_REJECTED' ? 'SAMPLE_REJECTED' : 'SAMPLE_CLOSED');
        expect(await snapshot(f)).toEqual(before);
    });

test('mixed batch review preflight refuses before any writes and a reasoned resend commits each scan once', async () => {
    const good = await fixture(), blocked = await fixture(), before = await snapshot(blocked);
    // REJECT is count-stable for a QC-FAIL scan and removes evidence for PASS.
    await good.db.spectralData.update({ where: { id: good.scan.id }, data: { qcStatus: 'FAIL' } });
    const tablesBefore = allTables(), payload = { ids: [good.scan.id, blocked.scan.id], action: 'REJECT' };
    const response = await post('/api/spectral/batch-review', payload);
    expect(response.status).toBe(409); expect(response.body).toMatchObject({ code: 'WORKITEM_REOPEN_REQUIRED',
        details: { affected: [expect.objectContaining({ id: blocked.scan.id, workItemId: blocked.item.id })] } });
    expect(allTables()).toEqual(tablesBefore); expect(await snapshot(blocked)).toEqual(before);
    const resend = await post('/api/spectral/batch-review', { ...payload, reopenReason: 'Review correction' });
    expect(resend.status).toBe(200); expect(resend.body.results).toMatchObject({ succeeded: 2, failed: 0 });
    expect((await snapshot(good)).scans[0].status).toBe('REJECTED');
    const after = await snapshot(blocked);
    expect(after.scans).toHaveLength(1); expect(after.scans[0].status).toBe('REJECTED');
    expect(after.results).toEqual(before.results);
    expect(after.audits.filter(row => row.action === 'SPECTRAL_WORK_REOPENED')).toHaveLength(1);
});

test('late scan review audit failure rolls back review, reopening and recompletion together', async () => {
    const f = await fixture();
    f.scan = await f.db.spectralData.update({ where: { id: f.scan.id }, data: { status: 'REJECTED' } });
    const before = await snapshot(f), transaction = prisma.$transaction.bind(prisma);
    jest.spyOn(prisma, '$transaction').mockImplementation(callback => transaction(tx => callback({ ...tx,
        auditLog: { ...tx.auditLog, create: args => {
            if (args.data.entity === 'SPECTRA') throw new Error('Injected review audit failure');
            return tx.auditLog.create(args);
        } } })));
    const response = await review(f, { action: 'UNDO', reopenReason: 'Scan review correction' });
    expect(response.status).toBe(500); expect(await snapshot(f)).toEqual(before);
});

test.each(['SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED', 'ON_HOLD', 'AWAITING_VERIFICATION'])
    ('relinking cannot remove evidence from a %s source item even if its new target is ready', async status => {
        const f = await fixture({ status });
        const target = await createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: f.sample.id, analysis: 'SPEC_MIR',
            assignedLab: labId, status: 'ASSIGNED', duplicateOf: f.item.id } });
        const before = await snapshot(f), response = await post('/api/spectral/link-task', {
            scanId: f.scan.id, workItemId: target.id, reopenReason: 'Acquisition association correction' });
        expect(response.status).toBe(409); expect(response.body.code).toBe('WORKITEM_STATE_CONFLICT');
        expect(await snapshot(f)).toEqual(before);
    });

test.each(['link', 'supersede'])('%s of another COMPLETED item evidence requires a reason and writes no rows', async mode => {
    const f = await fixture();
    const target = await createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId: f.sample.id, analysis: 'SPEC_MIR',
        assignedLab: labId, status: 'ASSIGNED', duplicateOf: f.item.id } });
    const before = await snapshot(f), response = mode === 'link' ? await post('/api/spectral/link-task', {
        scanId: f.scan.id, workItemId: target.id }) : await acquire('upload', [{ ...f, item: target }]);
    expect(response.status).toBe(409); expect(response.body.code).toBe('WORKITEM_REOPEN_REQUIRED');
    expect(await snapshot(f)).toEqual(before);
});

test.each(['link', 'supersede'])('reasoned %s preserves the previous item summary and completes only its new evidence owner', async mode => {
    const f = await fixture();
    const target = await createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId: f.sample.id, analysis: 'SPEC_MIR',
        assignedLab: labId, status: 'ASSIGNED', duplicateOf: f.item.id } });
    const before = await snapshot(f), reason = 'Acquisition association correction';
    const response = mode === 'link' ? await post('/api/spectral/link-task', { scanId: f.scan.id, workItemId: target.id, reopenReason: reason })
        : await acquire('upload', [{ ...f, item: target }], { reopenReason: reason });
    expect(response.status).toBe(200);
    if (mode === 'supersede') expect(response.body.results).toMatchObject({ success: 1, failed: 0 });
    const after = await snapshot(f), previous = after.items.find(item => item.id === f.item.id);
    expect(previous).toMatchObject({ status: 'IN_PROGRESS', result: f.item.result, completedAt: null, version: f.item.version + 1 });
    expect(JSON.parse(previous.history).at(-1)).toMatchObject({ reason, priorResult: f.item.result, priorCompletedAt: f.item.completedAt.toISOString() });
    expect(after.items.find(item => item.id === target.id).status).toBe('COMPLETED');
    expect(after.results).toEqual(before.results); expect(after.sample).toEqual(before.sample);
});
