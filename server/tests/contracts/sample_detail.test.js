const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');

describe('SD-15: Comprehensive Sample Detail End-to-End Contract Suite', () => {
    let superAdminToken, mgrGtmToken, techGtmToken, techHndToken;
    const sampleLabGtmId = 'SMP-SD15-GTM-01';
    const techHndUsername = 'test_lab_technician_labhnd';
    const techGtmUsername = 'test_lab_technician_labgtm';

    beforeAll(async () => {
        superAdminToken = await getAuthToken('SUPER_ADMIN', 'LAB-GTM', ['GTM', 'HND'], ['SOILFER-US']);
        mgrGtmToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']);
        techGtmToken = await getAuthToken('LAB_TECHNICIAN', 'LAB-GTM', ['GTM'], ['SOILFER-US']);
        techHndToken = await getAuthToken('LAB_TECHNICIAN', 'LAB-HND', ['HND'], ['SOILFER-US']);

        // Clean up
        await prisma.result.deleteMany({ where: { sampleId: sampleLabGtmId } });
        await prisma.auditLog.deleteMany({ where: { sampleId: sampleLabGtmId } });
        await prisma.workItem.deleteMany({ where: { sampleId: sampleLabGtmId } });
        await prisma.sample.deleteMany({ where: { id: sampleLabGtmId } });

        // Seed Sample in LAB-GTM
        await prisma.sample.create({
            data: {
                id: sampleLabGtmId,
                originalId: sampleLabGtmId,
                labId: 'LAB-GTM',
                assignedLab: 'LAB-GTM',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'PROCESSING',
                matrix: 'SOIL',
                dryingStatus: 'PENDING',
                preparationStatus: 'PENDING',
                requiredAnalyses: JSON.stringify(['PH_H2O', 'EC_1_5', 'OC'])
            }
        });

        // Seed work items
        await prisma.workItem.createMany({
            data: [
                {
                    id: 'WI-SD15-PH',
                    sampleId: sampleLabGtmId,
                    labId: 'LAB-GTM',
                    assignedLab: 'LAB-GTM',
                    analysis: 'PH_H2O',
                    category: 'Wet Chemistry',
                    status: 'NOT_ASSIGNED'
                },
                {
                    id: 'WI-SD15-EC',
                    sampleId: sampleLabGtmId,
                    labId: 'LAB-GTM',
                    assignedLab: 'LAB-GTM',
                    analysis: 'EC_1_5',
                    category: 'Wet Chemistry',
                    status: 'NOT_ASSIGNED'
                },
                {
                    id: 'WI-SD15-OC',
                    sampleId: sampleLabGtmId,
                    labId: 'LAB-GTM',
                    assignedLab: 'LAB-GTM',
                    analysis: 'OC',
                    category: 'Wet Chemistry',
                    status: 'NOT_ASSIGNED'
                }
            ]
        });
    });

    afterAll(async () => {
        await prisma.result.deleteMany({ where: { sampleId: sampleLabGtmId } });
        await prisma.auditLog.deleteMany({ where: { sampleId: sampleLabGtmId } });
        await prisma.workItem.deleteMany({ where: { sampleId: sampleLabGtmId } });
        await prisma.sample.deleteMany({ where: { id: sampleLabGtmId } });
    });

    describe('1. Cross-Laboratory Assignment Refusal for Every Role (SD-02)', () => {
        test('1.1. Super Admin is blocked with HTTP 403 from assigning a GTM sample to an HND technician', async () => {
            const res = await request(app)
                .post('/api/work/assign')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send({
                    workItemIds: ['WI-SD15-PH'],
                    assignee: techHndUsername
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/Cannot assign to technician in different lab/i);
        });

        test('1.2. Lab Manager is blocked with HTTP 403 from assigning to an out-of-lab technician', async () => {
            const res = await request(app)
                .post('/api/work/assign')
                .set('Authorization', `Bearer ${mgrGtmToken}`)
                .send({
                    workItemIds: ['WI-SD15-PH'],
                    assignee: techHndUsername
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/Cannot assign to technician in different lab/i);
        });

        test('1.3. Valid in-lab assignment succeeds (HTTP 200)', async () => {
            const res = await request(app)
                .post('/api/work/assign')
                .set('Authorization', `Bearer ${mgrGtmToken}`)
                .send({
                    workItemIds: ['WI-SD15-PH', 'WI-SD15-EC'],
                    assignee: techGtmUsername
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const wi = await prisma.workItem.findUnique({ where: { id: 'WI-SD15-PH' } });
            expect(wi.status).toBe('ASSIGNED');
            expect(wi.assignedTo).toBe(techGtmUsername);
        });
    });

    describe('2. Prerequisite Gate on Execution & Result Entry (SD-05)', () => {
        test('2.1. Starting work when preparationStatus !== DONE returns HTTP 412 Precondition Failed', async () => {
            const res = await request(app)
                .post('/api/work/WI-SD15-PH/start')
                .set('Authorization', `Bearer ${techGtmToken}`)
                .send();

            expect(res.status).toBe(412);
            expect(res.body.error).toMatch(/Sample preparation has not been completed/i);
        });

        test('2.2. Entering results when preparationStatus !== DONE returns HTTP 412 Precondition Failed', async () => {
            const res = await request(app)
                .post(`/api/results/${sampleLabGtmId}`)
                .set('Authorization', `Bearer ${techGtmToken}`)
                .send({
                    measurements: [
                        { param: 'PH_H2O', value: '7.1', unit: 'pH_units' }
                    ]
                });

            expect(res.status).toBe(412);
            expect(res.body.error).toMatch(/Sample preparation has not been completed/i);
        });

        test('2.3. Completing preparation unblocks startWork and execution (HTTP 200)', async () => {
            await prisma.sample.update({
                where: { id: sampleLabGtmId },
                data: { preparationStatus: 'DONE' }
            });

            const res = await request(app)
                .post('/api/work/WI-SD15-PH/start')
                .set('Authorization', `Bearer ${techGtmToken}`)
                .send();

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            const wi = await prisma.workItem.findUnique({ where: { id: 'WI-SD15-PH' } });
            expect(wi.status).toBe('IN_PROGRESS');
        });
    });

    describe('3. Three-Way Analysis Reconciliation Engine (SD-03)', () => {
        test('3.1. Removing an unstarted (NOT_ASSIGNED) analysis deletes its row (Branch A)', async () => {
            // Remove OC (which is NOT_ASSIGNED)
            const res = await request(app)
                .put(`/api/samples/${sampleLabGtmId}/analyses`)
                .set('Authorization', `Bearer ${mgrGtmToken}`)
                .send({
                    analyses: ['PH_H2O', 'EC_1_5']
                });

            expect(res.status).toBe(200);
            const deletedRow = await prisma.workItem.findUnique({ where: { id: 'WI-SD15-OC' } });
            expect(deletedRow).toBeNull();
        });

        test('3.2. Removing an in-progress analysis without reason is refused (HTTP 400) (Branch B)', async () => {
            // PH is IN_PROGRESS
            const res = await request(app)
                .put(`/api/samples/${sampleLabGtmId}/analyses`)
                .set('Authorization', `Bearer ${mgrGtmToken}`)
                .send({
                    analyses: ['EC_1_5'] // removing PH
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/reason is required/i);
        });

        test('3.3. Removing an in-progress analysis with reason marks it WAIVED (Branch B)', async () => {
            const res = await request(app)
                .put(`/api/samples/${sampleLabGtmId}/analyses`)
                .set('Authorization', `Bearer ${mgrGtmToken}`)
                .send({
                    analyses: ['EC_1_5'],
                    reason: 'Sample volume insufficient for electrode immersion'
                });

            expect(res.status).toBe(200);
            const waivedItem = await prisma.workItem.findUnique({ where: { id: 'WI-SD15-PH' } });
            expect(waivedItem.status).toBe('WAIVED');
            expect(waivedItem.reanalysisReason).toContain('insufficient');
        });

        test('3.4. Removing an analysis with recorded results is refused with HTTP 409 Conflict (Branch C)', async () => {
            // Record result on EC
            await prisma.result.create({
                data: {
                    id: 'RES-SD15-EC-01',
                    sampleId: sampleLabGtmId,
                    param: 'EC_1_5',
                    value: '1.45',
                    numericValue: 1.45,
                    provenance: 'MEASURED',
                    isCurrent: true
                }
            });

            const res = await request(app)
                .put(`/api/samples/${sampleLabGtmId}/analyses`)
                .set('Authorization', `Bearer ${mgrGtmToken}`)
                .send({
                    analyses: [] // Attempt to remove EC_1_5
                });

            expect(res.status).toBe(409);
            expect(res.body.error).toMatch(/Cannot remove analysis 'EC_1_5'/i);

            // Cleanup result
            await prisma.result.deleteMany({ where: { sampleId: sampleLabGtmId } });
        });
    });

    describe('4. Reason-Required Rejection & Reopening (SD-10)', () => {
        test('4.1. Rejecting work without reason returns HTTP 400', async () => {
            const res = await request(app)
                .post('/api/work/WI-SD15-EC/review')
                .set('Authorization', `Bearer ${mgrGtmToken}`)
                .send({ decision: 'REJECT' });

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/reason is required/i);
        });

        test('4.2. Undoing approval on finished sample without reason returns HTTP 400', async () => {
            const res = await request(app)
                .post(`/api/samples/${sampleLabGtmId}/undo-approve`)
                .set('Authorization', `Bearer ${mgrGtmToken}`)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/reason is required/i);
        });
    });

    describe('5. Gate Back-Fill Refusal on Reopen (SD-08)', () => {
        test('5.1. Undoing approval never fabricates preparation status as DONE', async () => {
            // Set sample to APPROVED with null preparation
            await prisma.sample.update({
                where: { id: sampleLabGtmId },
                data: {
                    status: 'APPROVED',
                    dryingStatus: null,
                    preparationStatus: null
                }
            });

            const res = await request(app)
                .post(`/api/samples/${sampleLabGtmId}/undo-approve`)
                .set('Authorization', `Bearer ${mgrGtmToken}`)
                .send({ reason: 'Contract verification for SD-08 gate preservation' });

            expect(res.status).toBe(200);

            const sample = await prisma.sample.findUnique({ where: { id: sampleLabGtmId } });
            expect(sample.status).toBe('PROCESSING');
            expect(sample.dryingStatus).toBeNull();
            expect(sample.preparationStatus).toBeNull();
        });
    });
});
