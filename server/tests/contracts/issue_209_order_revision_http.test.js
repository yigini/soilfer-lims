const { randomUUID } = require('node:crypto'), jwt = require('jsonwebtoken'), request = require('supertest');
const app = require('../../app'), db = require('../../prisma');
const { getAuthToken } = require('../setup');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
let lab, actor, token, codes;
beforeAll(async () => {
    lab = await db.lab.create({ data: { id: randomUUID(), code: randomUUID(), name: 'Owned order HTTP laboratory', country: 'GTM' } });
    token = await getAuthToken('LAB_MANAGER', lab.id); actor = jwt.decode(token);
    await db.user.update({ where: { id: actor.id }, data: { mustChangePassword: false } });
    codes = [1,2].map(() => 'ORDER-' + randomUUID().toUpperCase());
    for (const code of codes) await db.analysis.create({ data: { code, name: 'Owned order analysis' } });
});
async function fixture(status = 'PROCESSING') {
    const sample = await createSampleFixture(db, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: lab.id,
        country: 'GTM', status, requiredAnalyses: JSON.stringify([codes[0]]) } });
    if (status !== 'PROCESSING') return { sample };
    const item = await createWorkItemFixture(db, { data: { id: randomUUID(), sampleId: sample.id, labId: lab.id,
        assignedLab: lab.id, analysis: codes[0], status: 'NOT_ASSIGNED' } });
    await db.$transaction(tx => require('../../services/orderService').createInitialOrder(tx, sample, [codes[0]], actor));
    return { sample, item };
}
const send = (route,id,body,auth=token,key=null) => {
    let pending = request(app)[route === 'analyses' ? 'put' : 'post']('/api/samples/' + id + '/' + route)
        .set('Authorization', 'Bearer ' + auth);
    if (key) pending = pending.set('x-idempotency-key', key);
    return pending.send(body);
};
test.each(['analyses','orders'])('%s HTTP route requires a reason for a changed normalized full target, then saves one ACTIVE order', async route => {
    const { sample } = await fixture(), before = await db.sampleOrderRevision.findMany({ where: { sampleId: sample.id } });
    const refused = await send(route, sample.id, { analyses: codes });
    expect(refused.status).toBe(400); expect(refused.body.code).toBe('TRANSITION_REASON_REQUIRED');
    expect(await db.sampleOrderRevision.findMany({ where: { sampleId: sample.id } })).toEqual(before);
    const accepted = await send(route, sample.id, { analyses: codes.map(code => code.toLowerCase()), reason: 'Reviewed complete target order' });
    expect(accepted.status).toBe(200);
    expect(await db.sampleOrderRevision.count({ where: { sampleId: sample.id, status: 'ACTIVE' } })).toBe(1);
    const current = await db.sampleOrderRevision.findFirst({ where: { sampleId: sample.id, status: 'ACTIVE' }, include: { lines: true } });
    expect(current.lines.map(line => line.analysis).sort()).toEqual([...codes].sort());
    expect(current.lines.every(line => line.workItemId)).toBe(true);
});
test.each(['analyses','orders'])('%s HTTP receipt replays the exact command once and refuses a changed reason', async route => {
    const { sample } = await fixture(), key = randomUUID(), body = { analyses: codes, reason: 'Reviewed exact command' };
    expect((await send(route,sample.id,body,token,key)).status).toBe(200);
    const count = await db.sampleOrderRevision.count({ where: { sampleId: sample.id } });
    expect((await send(route,sample.id,body,token,key)).status).toBe(200);
    expect(await db.sampleOrderRevision.count({ where: { sampleId: sample.id } })).toBe(count);
    const conflict = await send(route,sample.id,{ ...body,reason:'Different command' },token,key);
    expect(conflict.status).toBe(409); expect(conflict.body.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
    expect(await db.sampleOrderRevision.count({ where: { sampleId: sample.id } })).toBe(count);
});
test.each(['APPROVED','ARCHIVED','DISPOSED'])('both HTTP routes preserve the %s amendment boundary', async status => {
    const { sample } = await fixture(status);
    for (const route of ['analyses','orders']) {
        const response = await send(route,sample.id,{ analyses:codes,reason:'Reviewed amended order' });
        expect(response.status).toBe(409); expect(response.body.code).toBe('AMENDMENT_WORKFLOW_REQUIRED');
    }
    expect(await db.sampleOrderRevision.count({ where: { sampleId: sample.id } })).toBe(0);
});
test('both HTTP routes enforce laboratory scope', async () => {
    const { sample } = await fixture(), foreign = await getAuthToken('LAB_MANAGER',randomUUID());
    for (const route of ['analyses','orders']) expect((await send(route,sample.id,{ analyses:codes,reason:'Reviewed order' },foreign)).status).toBe(403);
    expect(await db.sampleOrderRevision.count({ where: { sampleId: sample.id } })).toBe(1);
});
test('initial intake work generation writes one linked order through the shared service', async () => {
    const sample = await createSampleFixture(db, { data: { id:randomUUID(),originalId:randomUUID(),assignedLab:lab.id,country:'GTM',
        status:'PROCESSING',requiredAnalyses:JSON.stringify([codes[0]]) } });
    await db.$transaction(async tx => {
        const service = require('../../services/intakeWorkItemService');
        await service.generate(tx,sample,await service.planForSample(tx,sample),actor);
    });
    const revision = await db.sampleOrderRevision.findFirst({ where:{sampleId:sample.id},include:{lines:true} });
    expect(revision.lines).toHaveLength(1);
    expect(await db.workItem.findUnique({where:{id:revision.lines[0].workItemId}})).toMatchObject({sampleId:sample.id,analysis:codes[0]});
});
test('released removal of unstarted work retains its historical line identifier', async () => {
    const {sample,item} = await fixture(), old = await db.orderLine.findFirst({where:{workItemId:item.id}});
    const response = await send('orders',sample.id,{analyses:[],reason:'Reviewed removal of unstarted work'});
    expect(response.status).toBe(200); expect(await db.workItem.findUnique({where:{id:item.id}})).toBeNull();
    expect(await db.orderLine.findUnique({where:{id:old.id}})).toEqual(old);
});
