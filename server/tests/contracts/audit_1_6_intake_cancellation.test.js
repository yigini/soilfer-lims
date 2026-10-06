const { randomUUID, createHash } = require('node:crypto');
const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');
const Database = require('better-sqlite3');
const prisma = require('../../prisma');
const work = require('../../services/workItemStateService');
const { transitionSample } = require('../../services/sampleStateService');
const holds = require('../../services/sampleHoldService');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { createResultFixture } = require('../../services/resultWriteService');
const { getAuthToken } = require('../setup');
const { scanSource } = require('../helpers/workflowWriteScanner');
const labId = `CANCEL-LAB-${randomUUID()}`;
let actor;

beforeAll(async () => {
    await prisma.lab.create({ data: { id: labId, code: labId, name: 'Intake cancellation laboratory', country: 'GTM' } });
    actor = jwt.decode(await getAuthToken('LAB_MANAGER', labId));
});
async function fixture(status = 'NOT_ASSIGNED', sampleStatus = 'ACCEPTED', analysis = 'EC') {
    const id = randomUUID();
    const sample = await createSampleFixture(prisma, { data: { id, originalId: id, assignedLab: labId,
        status: sampleStatus, requiredAnalyses: JSON.stringify([analysis]), dryingStatus: 'PENDING', preparationStatus: 'PENDING' } });
    const item = await createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId: id, analysis, status,
        assignedLab: labId, assignedTo: actor.username, assignedBy: actor.username, assignedAt: new Date(), history: '[]' } });
    return { sample, item };
}
function snapshot() {
    const db = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
    try { return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => {
        const rows = db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all().map(row => JSON.stringify(row)).sort();
        return { name, count: rows.length, hash: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
    }); } finally { db.close(); }
}

test.each(['NOT_ASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'].flatMap(state => ['undo', 'reject'].map(action => [state, action])))
    ('%s work is retained with complete cancellation provenance on intake %s', async (state, action) => {
        const f = await fixture(state, action === 'undo' ? 'ACCEPTED' : 'RECEIVED');
        const method = action === 'undo' ? work.cancelForIntakeUndo : work.cancelForIntakeRejection;
        const cancelled = await prisma.$transaction(tx => method(tx, { sampleId: f.sample.id, actor, reason: 'Custody facts require intake correction' }));
        expect(cancelled).toHaveLength(1);
        expect(cancelled[0]).toEqual({ ...f.item, status: 'CANCELLED', version: f.item.version + 1, updatedAt: expect.any(Date),
            cancellationCode: action === 'undo' ? 'INTAKE_UNDONE' : 'INTAKE_REJECTED',
            cancellationReason: 'Custody facts require intake correction', cancelledBy: actor.username, cancelledAt: expect.any(Date) });
        expect(await prisma.auditLog.count({ where: { entityId: f.item.id, action: action === 'undo' ? 'cancelForIntakeUndo' : 'cancelForIntakeRejection' } })).toBe(1);
    });

test.each(['COMPLETED', 'SUBMITTED', 'ACCEPTED', 'REPEAT_REQUIRED', 'REANALYSIS_REQUIRED', 'AWAITING_VERIFICATION', 'WAIVED'])
    ('%s work blocks the entire intake undo without any writes', async state => {
        const f = await fixture(state), before = snapshot();
        await expect(prisma.$transaction(tx => work.cancelForIntakeUndo(tx, { sampleId: f.sample.id, actor, reason: 'Reviewed correction' })))
            .rejects.toMatchObject({ statusCode: 409, code: 'INTAKE_UNDO_HAS_WORK', details: { blockingItemIds: [f.item.id] } });
        expect(snapshot()).toEqual(before);
    });

test.each(['result', 'scan', 'attempt', 'draft', 'evidence-event'])('%s evidence blocks cancellation of every item in a sample', async evidence => {
    const f = await fixture('IN_PROGRESS');
    const unstarted = await createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId: f.sample.id,
        analysis: 'SOC', status: 'NOT_ASSIGNED', assignedLab: labId } });
    if (['result', 'evidence-event'].includes(evidence)) {
        const result = await createResultFixture(prisma, { data: { id: randomUUID(), sampleId: f.sample.id, param: f.item.analysis, value: '1.2', numericValue: 1.2 } });
        if (evidence === 'evidence-event') await prisma.resultEvidenceEvent.create({ data: { id: randomUUID(), resultId: result.id,
            sampleId: f.sample.id, eventType: 'PREP_REVERTED', gate: 'PREPARATION', reason: 'Reverted preparation evidence', actor: actor.username } });
    }
    if (evidence === 'scan') await prisma.spectralData.create({ data: { id: randomUUID(), sampleId: f.sample.id, workItemId: f.item.id, modality: 'MIR', filename: 'custody-spectrum.csv', sourceFile: '/test/spectrum.csv' } });
    if (evidence === 'attempt') await prisma.workAttempt.create({ data: { id: randomUUID(), workItemId: f.item.id, author: actor.username } });
    if (evidence === 'draft') await prisma.workItemDraft.create({ data: { id: randomUUID(), workItemId: f.item.id,
        sampleId: f.sample.id, analysis: f.item.analysis, userId: actor.username, value: '1.2' } });
    const before = snapshot();
    await expect(prisma.$transaction(tx => work.cancelForIntakeUndo(tx, { sampleId: f.sample.id, actor, reason: 'Correction' })))
        .rejects.toMatchObject({ statusCode: 409, code: 'INTAKE_UNDO_HAS_WORK', details: { blockingItemIds: expect.arrayContaining([f.item.id]) } });
    expect(snapshot()).toEqual(before);
    expect((await prisma.workItem.findUnique({ where: { id: unstarted.id } })).status).toBe('NOT_ASSIGNED');
});

test('generic cancellation and reactivation cannot forge the private intake action', async () => {
    const f = await fixture(), before = snapshot();
    for (const options of [{}, { action: 'cancelForIntakeUndo' }, { action: 'cancelForIntakeUndo', intakeAction: 'authorized intake work action' }]) {
        await expect(work.transitionWorkItem(f.item.id, 'CANCELLED', actor, 'Correction', {}, null, options))
            .rejects.toMatchObject({ statusCode: 409, code: 'WORKITEM_CANCEL_ACTION_REQUIRED' });
        expect(snapshot()).toEqual(before);
    }
    await prisma.$transaction(tx => work.cancelForIntakeUndo(tx, { sampleId: f.sample.id, actor, reason: 'Correction' }));
    const cancelled = snapshot();
    await expect(work.transitionWorkItem(f.item.id, 'NOT_ASSIGNED', actor, 'Manual recovery'))
        .rejects.toMatchObject({ statusCode: 409, code: 'WORKITEM_REACTIVATION_ACTION_REQUIRED' });
    expect(snapshot()).toEqual(cancelled);
});

test('legal sample re-acceptance reuses cancelled work, retains its cancellation history and leaves dropped analyses cancelled', async () => {
    const f = await fixture('ASSIGNED');
    const dropped = await createWorkItemFixture(prisma, { data: { id: randomUUID(), sampleId: f.sample.id, analysis: 'SOC', status: 'NOT_ASSIGNED', assignedLab: labId } });
    await prisma.$transaction(async tx => {
        await work.cancelForIntakeUndo(tx, { sampleId: f.sample.id, actor, reason: 'Reconcile physical intake' });
        await transitionSample(f.sample.id, 'RECEIVED', actor, 'Intake undone', {}, tx);
    });
    const cancelled = await prisma.workItem.findUnique({ where: { id: f.item.id } });
    await transitionSample(f.sample.id, 'ACCEPTED', actor, 'Reviewed custody and re-accepted');
    expect(await prisma.workItem.findUnique({ where: { id: f.item.id } })).toMatchObject({ status: 'NOT_ASSIGNED', assignedTo: null,
        assignedBy: null, assignedAt: null, completedAt: null, cancellationCode: cancelled.cancellationCode,
        cancellationReason: cancelled.cancellationReason, cancelledBy: cancelled.cancelledBy, cancelledAt: cancelled.cancelledAt });
    expect((await prisma.workItem.findUnique({ where: { id: dropped.id } })).status).toBe('CANCELLED');
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: f.item.id, action: 'reactivateCancelledIntakeWork' } });
    expect(JSON.parse(audit.details)).toMatchObject({ reason: 'Reviewed custody and re-accepted', cancellation: { code: 'INTAKE_UNDONE', reason: 'Reconcile physical intake' } });
});

test('legacy cancelled keys refuse re-acceptance with a stable item id and zero writes', async () => {
    const f = await fixture('CANCELLED', 'RECEIVED'), before = snapshot();
    await expect(transitionSample(f.sample.id, 'ACCEPTED', actor, 'Review requested analyses'))
        .rejects.toMatchObject({ statusCode: 409, code: 'WORKITEM_LEGACY_CANCELLED_CONFLICT', details: { workItemId: f.item.id } });
    expect(snapshot()).toEqual(before);
});

test.each(['EXPECTED', 'RECEIVED', 'RECEIVED_REJECTED', 'ARCHIVED'])('%s samples cannot receive assignments', async status => {
    const f = await fixture('NOT_ASSIGNED', status), before = snapshot();
    await expect(work.transitionWorkItem(f.item.id, 'ASSIGNED', actor)).rejects.toMatchObject({ statusCode: 409, code: 'SAMPLE_NOT_ASSIGNABLE' });
    expect(snapshot()).toEqual(before);
});

test('a held sample cannot be accepted or assigned; resolution restores eligibility', async () => {
    const f = await fixture('NOT_ASSIGNED', 'RECEIVED');
    const hold = await prisma.$transaction(tx => holds.raiseHold(tx, { sampleId: f.sample.id, type: 'CUSTODY', reason: 'Confirm custody', actor }));
    const before = snapshot();
    await expect(transitionSample(f.sample.id, 'ACCEPTED', actor, 'Accept')).rejects.toMatchObject({ statusCode: 409, code: 'SAMPLE_HELD' });
    expect(snapshot()).toEqual(before);
    await prisma.$transaction(tx => holds.resolveHold(tx, { sampleId: f.sample.id, holdId: hold.id, reason: 'Custody verified', actor }));
    await transitionSample(f.sample.id, 'ACCEPTED', actor, 'Custody verified and accepted');
    const secondHold = await prisma.$transaction(tx => holds.raiseHold(tx, { sampleId: f.sample.id, type: 'CLIENT_QUERY', reason: 'Client confirmation', actor }));
    const assignedBefore = snapshot();
    await expect(work.transitionWorkItem(f.item.id, 'ASSIGNED', actor)).rejects.toMatchObject({ statusCode: 409, code: 'SAMPLE_HELD' });
    expect(snapshot()).toEqual(assignedBefore);
    await prisma.$transaction(tx => holds.resolveHold(tx, { sampleId: f.sample.id, holdId: secondHold.id, reason: 'Client confirmed', actor }));
    expect((await work.transitionWorkItem(f.item.id, 'ASSIGNED', actor)).status).toBe('ASSIGNED');
});

test('the scanner confines reactivation to the central sample re-acceptance transaction', () => {
    const source = "require('./workItemStateService').reactivateCancelledIntakeWork(tx, options)";
    expect(scanSource(source, 'controllers/canary.js')).toEqual([expect.objectContaining({ code: 'INTAKE_REACTIVATION_CALLER_FORBIDDEN' })]);
    expect(scanSource(source, 'services/sampleStateService.js')).toEqual([]);
});

test('undo-intake HTTP route refuses analytical evidence with 409 and no table writes', async () => {
    const f = await fixture('IN_PROGRESS');
    await createResultFixture(prisma, { data: { id: randomUUID(), sampleId: f.sample.id, param: f.item.analysis, value: '1.2', numericValue: 1.2 } });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = actor; next(); });
    app.use('/api/samples', require('../../routes/sampleRoutes'));
    const before = snapshot();
    const response = await request(app).post(`/api/samples/${f.sample.id}/undo-intake`).send({ reason: 'Evidence must be preserved' });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'ACTIVE_WORK_IN_PROGRESS', details: { blockingItemIds: [f.item.id] } });
    expect(snapshot()).toEqual(before);
});
