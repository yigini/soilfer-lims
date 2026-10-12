const { gateRecords } = require('../helpers/preparationRecords');
const { ensureTestLab } = require('../setup');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { setFixtureQcRequirement } = require('../helpers/qcPolicyFixture');
const { generateToken } = require('../setup');
const { usersDb, workItemsDb, samplesDb, submissionsDb } = require('../../db');

describe('8.1 Section D: Submission Rules', () => {
    let mgrToken, techToken;
    let techUsername;
    let sampleId;
    let phItemId, condItemId;

    beforeAll(async () => {
        await ensureTestLab('LAB-SUB', 'SUB');
        const suffix = Date.now();
        techUsername = `tech_sub_${suffix}`;
        const mgr = usersDb.create({ username: `mgr_sub_${suffix}`, role: 'LAB_MANAGER', labId: 'LAB-SUB', countries: ['SUB'] });
        const tech = usersDb.create({ username: techUsername, role: 'LAB_TECHNICIAN', labId: 'LAB-SUB' });

        mgrToken = generateToken(mgr);
        await setFixtureQcRequirement(prisma, mgrToken, 'LAB-SUB');
        techToken = generateToken(tech);
    });

    test('Setup: Create Sample and WorkItems', async () => {
        const createRes = await request(app)
            .post('/api/samples/walkin')
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ submitter: 'Sub Tester', analyses: ['PH_H2O', 'EC'], countryCode: 'SUB' });

        expect(createRes.status).toBe(201);
        sampleId = createRes.body.sample.id;

        await request(app)
            .post(`/api/samples/${sampleId}/accept`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ analyses: ['PH_H2O', 'EC'], checklist: { items: Object.fromEntries(['container', 'label', 'quantity', 'condition', 'coc'].map(key => [key, { status: 'PASS' }])) } });

        const itemsRes = await request(app)
            .get('/api/work')
            .set('Authorization', `Bearer ${mgrToken}`)
            .query({ sampleId });

        const ph = itemsRes.body.data.find(i => i.analysis === 'PH_H2O');
        const cond = itemsRes.body.data.find(i => i.analysis === 'EC');

        expect(ph).toBeDefined();
        phItemId = ph.id;
        condItemId = cond.id;

        // Assign using explicit username
        await request(app)
            .post('/api/work/assign')
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ workItemIds: [phItemId, condItemId], assignee: techUsername });

        // Gates
        const dRes = await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrToken}`).send({ phase: 'DRYING', status: 'DONE', checklist: [true, true, true], records: gateRecords('DRYING') });
        if (dRes.status !== 200) console.log('DEBUG Drying Gate Failure:', dRes.body);
        expect(dRes.status).toBe(200);

        const pRes = await request(app).put(`/api/samples/${sampleId}/phase`).set('Authorization', `Bearer ${mgrToken}`).send({ phase: 'PREPARATION', status: 'DONE', checklist: [true, true, true] });
        if (pRes.status !== 200) console.log('DEBUG Prep Gate Failure:', pRes.body);
        expect(pRes.status).toBe(200);
    });

    test('Scenario 1: Tech can Submit Partial (PH)', async () => {
        const completeRes = await request(app)
            .post('/api/workbench/batch-save')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ draft: false, entries: [{ workItemId: phItemId, value: '7.0' }] });
        expect(completeRes.status).toBe(200);
        expect((await prisma.result.findFirst({ where: { sampleId, param: 'PH_H2O', isCurrent: true } })).value).toBe('7.0');

        const beforeFull = {
            sample: await prisma.sample.findUnique({ where: { id: sampleId } }),
            items: await prisma.workItem.findMany({ where: { sampleId }, orderBy: { id: 'asc' } }),
            submissions: await prisma.submission.findMany({ where: { sampleId } }),
            audits: await prisma.auditLog.findMany({ where: { sampleId }, orderBy: { id: 'asc' } })
        };
        const incomplete = await request(app).post('/api/submissions').set('Authorization', `Bearer ${techToken}`)
            .send({ sampleId, type: 'FULL', workItemIds: [phItemId] });
        expect(incomplete.status).toBe(409);
        expect(incomplete.body).toMatchObject({ code: 'SUBMISSION_NOT_FULL', details: {
            blocking: [{ workItemId: condItemId, analysis: 'EC', status: 'ASSIGNED' }]
        } });
        expect({
            sample: await prisma.sample.findUnique({ where: { id: sampleId } }),
            items: await prisma.workItem.findMany({ where: { sampleId }, orderBy: { id: 'asc' } }),
            submissions: await prisma.submission.findMany({ where: { sampleId } }),
            audits: await prisma.auditLog.findMany({ where: { sampleId }, orderBy: { id: 'asc' } })
        }).toEqual(beforeFull);

        const subRes = await request(app)
            .post('/api/submissions')
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                sampleId,
                type: 'PARTIAL',
                workItemIds: [phItemId]
            });

        expect(subRes.status).toBe(201);
        expect(subRes.body.submission.status).toBe('PENDING_REVIEW');
    });

    test('Scenario 2: Previously submitted work counts toward a full submission', async () => {
        const completeRes = await request(app)
            .post('/api/workbench/batch-save')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ draft: false, entries: [{ workItemId: condItemId, value: '5.0' }] });
        if (completeRes.status !== 200) console.log('DEBUG Scenario 2 Complete Failure:', completeRes.body);
        expect(completeRes.status).toBe(200);
        expect((await prisma.result.findFirst({ where: { sampleId, param: 'EC', isCurrent: true } })).value).toBe('5.0');

        const subRes = await request(app)
            .post('/api/submissions')
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                sampleId,
                type: 'FULL',
                workItemIds: [condItemId]
            });

        expect(subRes.status).toBe(201);
        expect(subRes.body.submission.type).toBe('FULL');
        expect(await prisma.sample.findUnique({ where: { id: sampleId } })).toMatchObject({ status: 'SUBMITTED_FULL' });
    });

    test('Scenario 3: Manager accepts Submission (PH)', async () => {
        const listRes = await request(app)
            .get('/api/submissions')
            .set('Authorization', `Bearer ${mgrToken}`)
            .query({ sampleId });

        const partialSub = listRes.body.find(s => s.type === 'PARTIAL');
        expect(partialSub).toBeDefined();
        const subId = partialSub.id;

        const reviewRes = await request(app)
            .post(`/api/submissions/${subId}/review`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                decisions: [{ workItemId: phItemId, decision: 'ACCEPT' }]
            });

        expect(reviewRes.status).toBe(200);
    });

    test('Scenario 4: Rejection (COND)', async () => {
        // Scenario 2 already submitted EC. Request its repeat from that reviewed
        // membership without manufacturing a second submission of the same item.
        expect(await prisma.workItem.findUnique({ where: { id: condItemId } })).toMatchObject({ status: 'SUBMITTED' });
        // Request a repeat before re-entry; completed measurements are sealed
        // by the canonical workbench rather than overwritten through status.
        const returned = await request(app).post(`/api/work/${condItemId}/review`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({ status: 'REANALYSIS_REQUIRED', reasonCode:'CONFIRMATION', reason: 'Repeat conductivity before final submission' });
        expect(returned.status).toBe(200);
        const prior = await prisma.result.findFirst({ where: { sampleId, param: 'EC', isCurrent: true } });
        expect(prior.value).toBe('5.0');
        const completeRes = await request(app)
            .post('/api/workbench/batch-save')
            .set('Authorization', `Bearer ${techToken}`)
            .send({ draft: false, entries: [{ workItemId: condItemId, value: '5.1' }] });
        expect(completeRes.status).toBe(200);
        expect((await prisma.result.findFirst({ where: { sampleId, param: 'EC', isCurrent: true } })).value).toBe('5.1');
        const superseded = await prisma.result.findUnique({ where: { id: prior.id } });
        expect(superseded.value).toBe('5.0');
        expect(superseded.isCurrent).toBe(false);

        const subRes = await request(app)
            .post('/api/submissions')
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                sampleId,
                type: 'PARTIAL',
                workItemIds: [condItemId]
            });
        if (subRes.status !== 201) console.log('DEBUG Scenario 4:', subRes.body);
        expect(subRes.status).toBe(201);
        const subId = subRes.body.submission.id;

        const reviewRes = await request(app)
            .post(`/api/submissions/${subId}/review`)
            .set('Authorization', `Bearer ${mgrToken}`)
            .send({
                decisions: [{ workItemId: condItemId, decision: 'REJECT_REANALYSIS', reasonCode:'REVIEW_OUTLIER', reason: 'Value too high' }]
            });

        expect(reviewRes.status).toBe(200);

        const cond = workItemsDb.findById(condItemId);
        expect(cond.status).toBe('REPEAT_REQUIRED');
    });
});
