const request = require('supertest');
const app = require('../../app');
const { generateToken } = require('../setup');
const { usersDb, workItemsDb, samplesDb } = require('../../db');

describe('8.1 Section C: Assignment Rules', () => {
    let mgrTokenA, mgrTokenB;
    let techTokenA, techTokenB;
    let sampleIdA, workItemIdA;

    beforeAll(async () => {
        const suffix = Date.now();
        const mgrA = usersDb.create({ username: `mgr_a_${suffix}`, role: 'LAB_MANAGER', labId: 'LAB-GTM', countries: ['GTM'] });
        const mgrB = usersDb.create({ username: `mgr_b_${suffix}`, role: 'LAB_MANAGER', labId: 'LAB-HND', countries: ['HND'] });
        const techA = usersDb.create({ username: `tech_a_${suffix}`, role: 'LAB_TECHNICIAN', labId: 'LAB-GTM' });
        const techB = usersDb.create({ username: `tech_b_${suffix}`, role: 'LAB_TECHNICIAN', labId: 'LAB-HND' });

        this.techUsernameA = `tech_a_${suffix}`;
        this.techUsernameB = `tech_b_${suffix}`;

        mgrTokenA = generateToken(mgrA);
        mgrTokenB = generateToken(mgrB);
        techTokenA = generateToken(techA);
        techTokenB = generateToken(techB);
    });

    test('Setup: Create Sample A in LAB-GTM', async () => {
        const createRes = await request(app)
            .post('/api/samples/walkin')
            .set('Authorization', `Bearer ${mgrTokenA}`)
            .send({ submitter: 'GTM Submitter', analyses: ['PH_H2O'], countryCode: 'GTM' });

        expect(createRes.status).toBe(201);
        sampleIdA = createRes.body.sample.id;

        const acceptRes = await request(app)
            .post(`/api/samples/${sampleIdA}/accept`)
            .set('Authorization', `Bearer ${mgrTokenA}`)
            .send({ analyses: ['PH_H2O'] });

        expect(acceptRes.status).toBe(200);
        const item = acceptRes.body.workItems.find(i => i.analysis === 'PH_H2O');
        expect(item).toBeDefined();
        workItemIdA = item.id;

        const sample = samplesDb.findById(sampleIdA);
        expect(sample.assignedLab).toBe('LAB-GTM');
    });

    test('Manager A can list items for their lab', async () => {
        const res = await request(app)
            .get('/api/work')
            .set('Authorization', `Bearer ${mgrTokenA}`)
            .query({ sampleId: sampleIdA });

        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
        expect(res.body.data.find(i => i.id === workItemIdA)).toBeDefined();
    });

    test('Manager B CANNOT see items for different lab (Empty List)', async () => {
        const res = await request(app)
            .get('/api/work')
            .set('Authorization', `Bearer ${mgrTokenB}`)
            .query({ sampleId: sampleIdA });

        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(0);
    });

    test('Manager A can assign item to Tech A (Same Lab)', async () => {
        const res = await request(app)
            .post('/api/work/assign')
            .set('Authorization', `Bearer ${mgrTokenA}`)
            .send({
                workItemIds: [workItemIdA],
                assignee: this.techUsernameA
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.assigned).toBe(1);
    });

    test('Manager A CANNOT assign item to Tech B (Cross-Lab)', async () => {
        const res = await request(app)
            .post('/api/work/assign')
            .set('Authorization', `Bearer ${mgrTokenA}`)
            .send({
                workItemIds: [workItemIdA],
                assignee: this.techUsernameB
            });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/technician in different lab/);
    });

    test('Technician Visibility', async () => {
        const resA = await request(app)
            .get('/api/work')
            .set('Authorization', `Bearer ${techTokenA}`)
            .query({ sampleId: sampleIdA });

        expect(resA.status).toBe(200);
        expect(Array.isArray(resA.body.data)).toBe(true);
        expect(resA.body.data.find(i => i.id === workItemIdA)).toBeDefined();

        // Tech B (unassigned) should NOT see it
        const resB = await request(app)
            .get('/api/work')
            .set('Authorization', `Bearer ${techTokenB}`)
            .query({ sampleId: sampleIdA });

        expect(resB.status).toBe(200);
        expect(resB.body.data.find(i => i.id === workItemIdA)).toBeUndefined();
    });
});
