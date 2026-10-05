const { randomUUID } = require('node:crypto');
const prisma = require('../../prisma');
const samples = require('../../services/sampleStateService');
const work = require('../../services/workItemStateService');
const gates = require('../../services/gateEvidenceService');
const workflow = require('../../workflowContract');
const sampleController = require('../../controllers/sampleController');
const labId = randomUUID();
const actor = { username: `gate-evidence-manager-${randomUUID()}`, role: 'LAB_MANAGER', labId };
beforeAll(async () => {
    await prisma.lab.create({ data: { id: labId, code: labId, name: 'Gate evidence laboratory', country: 'TEST' } });
    await prisma.user.create({ data: { id: actor.username, username: actor.username, role: actor.role, labId,
        email: `${actor.username}@example.test`, password: 'isolated-fixture' } });
});

async function fixture(analysis, flag = 'DONE', gateStatus) {
    const sample = await samples.createSample({ id: randomUUID(), originalId: randomUUID(), assignedLab: labId,
        status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE', [gates.GATE_FIELDS[analysis]]: flag },
    'system:fixture', { context: 'fixture' });
    const item = await work.createWorkItem({ id: randomUUID(), sampleId: sample.id, assignedLab: labId,
        analysis: 'PH', status: 'ASSIGNED', assignedTo: actor.username, history: '[]' }, 'system:fixture', { context: 'fixture' });
    if (gateStatus) await work.createWorkItem({ id: randomUUID(), sampleId: sample.id, assignedLab: labId, analysis,
        status: gateStatus, history: '[]' }, 'system:fixture', { context: 'fixture' });
    return { sample, item };
}
async function snapshot(id) {
    return { sample: await prisma.sample.findUnique({ where: { id } }),
        items: await prisma.workItem.findMany({ where: { sampleId: id }, orderBy: { id: 'asc' } }),
        results: await prisma.result.findMany({ where: { sampleId: id }, orderBy: { id: 'asc' } }),
        audits: await prisma.auditLog.findMany({ where: { sampleId: id }, orderBy: { id: 'asc' } }) };
}
const presentMatrix = ['DRYING', 'PREPARATION'].flatMap(analysis => workflow.WORK_ITEM_STATE_LIST.flatMap(status =>
    ['DONE', 'PENDING'].map(flag => [analysis, status, flag])));
test.each(presentMatrix)('%s WorkItem in %s with %s flag decides execution and refuses conflicts without writes', async (analysis, status, flag) => {
    const row = await fixture(analysis, flag, status), before = await snapshot(row.sample.id);
    const complete = ['COMPLETED', 'ACCEPTED', 'WAIVED'].includes(status);
    if (complete && flag === 'DONE') {
        expect(await work.transitionWorkItem(row.item.id, 'IN_PROGRESS', actor)).toMatchObject({ status: 'IN_PROGRESS' });
    } else {
        const mismatch = complete !== (flag === 'DONE');
        await expect(work.transitionWorkItem(row.item.id, 'IN_PROGRESS', actor)).rejects.toMatchObject({ statusCode: 409,
            code: mismatch ? 'GATE_STATE_MISMATCH' : `${analysis}_PREREQUISITE_BLOCKED` });
        expect(await snapshot(row.sample.id)).toEqual(before);
    }
});

test.each(['DRYING', 'PREPARATION'])('%s flag-only DONE is read as legacy evidence and recorded on the authorized write', async analysis => {
    const row = await fixture(analysis), before = await snapshot(row.sample.id);
    const evidence = await gates.loadGateEvidence(prisma, row.sample);
    expect(evidence).toMatchObject({ satisfied: true, legacyGates: ['DRYING', 'PREPARATION'] });
    expect(await snapshot(row.sample.id)).toEqual(before);
    await work.transitionWorkItem(row.item.id, 'IN_PROGRESS', actor);
    const audit = await prisma.auditLog.findFirst({ where: { entityId: row.item.id, action: 'WORKITEM_STATUS_TRANSITION' } });
    expect(JSON.parse(audit.after)).toMatchObject({ gateEvidence: 'LEGACY_SAMPLE_FLAG', legacyGates: ['DRYING', 'PREPARATION'] });
    expect(await prisma.sample.findUnique({ where: { id: row.sample.id } })).toEqual(before.sample);
    expect(await prisma.workItem.count({ where: { sampleId: row.sample.id } })).toBe(1);
});
test.each(['DRYING', 'PREPARATION'].flatMap(analysis => [null, 'PENDING', 'FAILED', 'IN_PROGRESS'].map(flag => [analysis, flag])))
    ('missing %s WorkItem with %s flag blocks with zero writes', async (analysis, flag) => {
        const row = await fixture(analysis, flag), before = await snapshot(row.sample.id);
        await expect(work.transitionWorkItem(row.item.id, 'IN_PROGRESS', actor)).rejects.toMatchObject({ statusCode: 409,
            code: `${analysis}_PREREQUISITE_BLOCKED` });
        expect(await snapshot(row.sample.id)).toEqual(before);
    });

test('sample-detail GET displays a missing lab fallback without persisting any repair, lifecycle or approval', async () => {
    const row = await fixture('DRYING');
    await prisma.workItem.update({ where: { id: row.item.id }, data: { assignedLab: null, assignedTo: null } });
    const before = await snapshot(row.sample.id);
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await sampleController.getSampleDetail({ user: actor, params: { id: row.sample.id }, query: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.workItems.find(item => item.id === row.item.id)).toMatchObject({ assignedLab: labId, status: 'NOT_ASSIGNED' });
    expect(await snapshot(row.sample.id)).toEqual(before);
});
