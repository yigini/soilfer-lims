const { randomUUID } = require('node:crypto');
const prisma = require('../../prisma');
const samples = require('../../services/sampleStateService');
const work = require('../../services/workItemStateService');
const gates = require('../../services/gateEvidenceService');
const workflow = require('../../workflowContract');
const sampleController = require('../../controllers/sampleController');
const engine = require('../../utils/workflowEngine');
const catalogue = require('../../services/analysisService');
const workbench = require('../../controllers/workbenchController');
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

async function catalogueFixture(prerequisiteStatus) {
    const row = await fixture('DRYING'), code = `CAT_${randomUUID()}`, prerequisite = `PREREQ_${randomUUID()}`;
    await prisma.analysis.create({ data: { code: prerequisite, name: 'Catalogue predecessor' } });
    await prisma.analysis.create({ data: { code, name: 'Catalogue dependent', prerequisites: JSON.stringify(['PREPARATION', prerequisite]) } });
    catalogue.invalidateCache();
    const item = await work.createWorkItem({ id: randomUUID(), sampleId: row.sample.id, assignedLab: labId,
        analysis: code, status: 'ASSIGNED', assignedTo: actor.username }, 'system:fixture', { context: 'fixture' });
    if (prerequisiteStatus) await work.createWorkItem({ id: randomUUID(), sampleId: row.sample.id, assignedLab: labId,
        analysis: prerequisite, status: prerequisiteStatus }, 'system:fixture', { context: 'fixture' });
    return { ...row, item, code, prerequisite };
}
test('a cold catalogue blocks a missing non-gate prerequisite before any workflow write', async () => {
    const row = await catalogueFixture(), before = await snapshot(row.sample.id);
    expect(engine.DYNAMIC_CONFIGS[row.code]).toBeUndefined();
    await expect(work.transitionWorkItem(row.item.id, 'IN_PROGRESS', actor)).rejects.toMatchObject({ statusCode: 409,
        code: 'ANALYSIS_PREREQUISITE_BLOCKED', details: { blockedBy: row.prerequisite } });
    expect(await snapshot(row.sample.id)).toEqual(before);
    expect(engine.DYNAMIC_CONFIGS[row.code]).toBeUndefined();
});
test.each(['COMPLETED', 'SUBMITTED', 'ACCEPTED', 'WAIVED'])('a present %s catalogue prerequisite permits execution on cold load', async status => {
    const row = await catalogueFixture(status);
    expect(await work.transitionWorkItem(row.item.id, 'IN_PROGRESS', actor)).toMatchObject({ status: 'IN_PROGRESS' });
});
test('a transaction uses its catalogue edit immediately without leaking an uncommitted definition', async () => {
    const row = await catalogueFixture('COMPLETED');
    const original = await engine.withCatalogue(prisma, () => engine.getAnalysisConfig(row.code));
    const before = await snapshot(row.sample.id);
    await expect(prisma.$transaction(async tx => {
        await tx.analysis.update({ where: { code: row.code }, data: { prerequisites: JSON.stringify(['MISSING_NEW_PREREQUISITE']) } });
        await work.transitionWorkItem(row.item.id, 'IN_PROGRESS', actor, null, {}, tx);
    })).rejects.toMatchObject({ code: 'ANALYSIS_PREREQUISITE_BLOCKED', details: { blockedBy: 'MISSING_NEW_PREREQUISITE' } });
    expect(await snapshot(row.sample.id)).toEqual(before);
    expect(await engine.withCatalogue(prisma, () => engine.getAnalysisConfig(row.code))).toEqual(original);
    expect(JSON.parse((await prisma.analysis.findUnique({ where: { code: row.code } })).prerequisites)).toEqual(['PREPARATION', row.prerequisite]);
});
test('map and workbench queue load catalogue blockers without persisting a derived state', async () => {
    const row = await catalogueFixture(), before = await snapshot(row.sample.id);
    const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
    const map = response();
    await sampleController.getMapState({ user: actor, params: { id: row.sample.id }, query: {} }, map);
    expect(map.statusCode).toBe(200);
    expect(map.body.blockerGraph).toEqual(expect.arrayContaining([expect.objectContaining({
        workItemId: row.item.id, blockedBy: row.prerequisite
    })]));
    const queue = response();
    await workbench.getQueue({ user: actor, query: { workItemId: row.item.id } }, queue);
    expect(queue.statusCode).toBe(200);
    const queued = queue.body.groups.flatMap(group => group.items).find(item => item.id === row.item.id);
    expect(queued.readiness.isReady).toBe(false);
    expect(queued.readiness.blockers).toContain('ANALYSIS_PREREQUISITE_BLOCKED');
    expect(await snapshot(row.sample.id)).toEqual(before);
});
