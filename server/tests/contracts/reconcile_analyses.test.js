const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');

describe('SD-03: Work Item Reconciliation on Analysis List Change Contract', () => {
    let mgrGtmToken, techGtmToken;
    const sampleId = 'TEST-SD03-SMP-01';

    beforeAll(async () => {
        mgrGtmToken = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']);
        techGtmToken = await getAuthToken('LAB_TECHNICIAN', 'LAB-GTM', ['GTM'], ['SOILFER-US']);

        // Clean up
        await prisma.result.deleteMany({ where: { sampleId } });
        await prisma.workItem.deleteMany({ where: { sampleId } });
        await prisma.sample.deleteMany({ where: { id: sampleId } });

        // Create sample with initial analyses: PH_H2O, SOC, CEC
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                assignedLab: 'LAB-GTM',
                labId: 'LAB-GTM',
                status: 'PROCESSING',
                matrix: 'SOIL',
                country: 'GTM',
                projectCode: 'SOILFER-US',
                requiredAnalyses: JSON.stringify(['PH_H2O', 'SOC', 'CEC'])
            }
        });

        // Create work items:
        // 1. PH_H2O: NOT_ASSIGNED, no result
        await prisma.workItem.create({
            data: {
                id: 'WI-SD03-PH',
                sampleId,
                labId: 'LAB-GTM',
                assignedLab: 'LAB-GTM',
                analysis: 'PH_H2O',
                status: 'NOT_ASSIGNED'
            }
        });

        // 2. SOC: IN_PROGRESS, no result
        await prisma.workItem.create({
            data: {
                id: 'WI-SD03-SOC',
                sampleId,
                labId: 'LAB-GTM',
                assignedLab: 'LAB-GTM',
                analysis: 'SOC',
                assignedTo: 'test_lab_technician_labgtm',
                status: 'IN_PROGRESS'
            }
        });

        // 3. CEC: COMPLETED, with a result recorded
        await prisma.workItem.create({
            data: {
                id: 'WI-SD03-CEC',
                sampleId,
                labId: 'LAB-GTM',
                assignedLab: 'LAB-GTM',
                analysis: 'CEC',
                assignedTo: 'test_lab_technician_labgtm',
                status: 'COMPLETED',
                result: '18.5 cmol(+)/kg'
            }
        });
        await prisma.result.create({
            data: {
                id: 'RES-SD03-CEC',
                sampleId,
                param: 'CEC',
                value: '18.5',
                numericValue: 18.5,
                unit: 'cmol(+)/kg',
                provenance: 'MEASURED',
                isCurrent: true
            }
        });
    });

    afterAll(async () => {
        await prisma.result.deleteMany({ where: { sampleId } });
        await prisma.workItem.deleteMany({ where: { sampleId } });
        await prisma.sample.deleteMany({ where: { id: sampleId } });
    });

    test('1. Removing an analysis with a recorded result is refused (HTTP 409) naming analysis and result', async () => {
        // Attempt to remove CEC (which has a result) from requiredAnalyses
        const res = await request(app)
            .put(`/api/samples/${sampleId}/analyses`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                analyses: ['PH_H2O', 'SOC'] // CEC dropped
            });

        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/Cannot remove analysis 'CEC'/);
        expect(res.body.error).toMatch(/18.5/);

        // Verify CEC was NOT removed from sample or work items
        const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
        expect(sample.requiredAnalyses).toContain('CEC');

        const wiCec = await prisma.workItem.findUnique({ where: { id: 'WI-SD03-CEC' } });
        expect(wiCec).toBeDefined();
        expect(wiCec.status).toBe('COMPLETED');
    });

    test('2. Removing an in-progress analysis without a reason is rejected (HTTP 400)', async () => {
        // Attempt to drop SOC without reason
        const res = await request(app)
            .put(`/api/samples/${sampleId}/analyses`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                analyses: ['PH_H2O', 'CEC'] // SOC dropped, but no reason given
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/reason is required/i);

        // Verify SOC is still IN_PROGRESS
        const wiSoc = await prisma.workItem.findUnique({ where: { id: 'WI-SD03-SOC' } });
        expect(wiSoc.status).toBe('IN_PROGRESS');
    });

    test('3. Removing an in-progress analysis with a reason marks it WAIVED with audit trail', async () => {
        // Drop SOC with explicit reason
        const res = await request(app)
            .put(`/api/samples/${sampleId}/analyses`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                analyses: ['PH_H2O', 'CEC'],
                reason: 'Insufficient sample mass for SOC determination'
            });

        expect(res.status).toBe(200);
        expect(res.body.waived).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    analysis: 'SOC',
                    reason: 'Insufficient sample mass for SOC determination'
                })
            ])
        );

        // Verify work item is now WAIVED and recorded the reason
        const wiSoc = await prisma.workItem.findUnique({ where: { id: 'WI-SD03-SOC' } });
        expect(wiSoc.status).toBe('WAIVED');
        expect(wiSoc.reanalysisReason).toBe('Insufficient sample mass for SOC determination');
    });

    test('4. Removing an unstarted (NOT_ASSIGNED) analysis deletes its work item row', async () => {
        // Drop PH_H2O (which is NOT_ASSIGNED, no result)
        const res = await request(app)
            .put(`/api/samples/${sampleId}/analyses`)
            .set('Authorization', `Bearer ${mgrGtmToken}`)
            .send({
                analyses: ['CEC'] // PH_H2O dropped
            });

        expect(res.status).toBe(200);
        expect(res.body.removed).toContain('PH_H2O');

        // Verify PH_H2O row is completely deleted
        const wiPh = await prisma.workItem.findUnique({ where: { id: 'WI-SD03-PH' } });
        expect(wiPh).toBeNull();
    });

    test('5. Progress counter immediately matches the reconciled analysis list', async () => {
        // Query sample detail
        const res = await request(app)
            .get(`/api/samples/${sampleId}/detail`)
            .set('Authorization', `Bearer ${mgrGtmToken}`);

        expect(res.status).toBe(200);
        const sample = res.body.sample || res.body.data;
        const workItems = res.body.workItems || [];

        // Active analytical work items (excluding operational gates and waived items)
        const activeAnalytical = workItems.filter(
            w => !['DRYING', 'PREPARATION', 'ARCHIVING', 'DISPOSAL'].includes(w.analysis) && w.status !== 'WAIVED'
        );

        // Only CEC should be active now
        expect(activeAnalytical.length).toBe(1);
        expect(activeAnalytical[0].analysis).toBe('CEC');
        expect(sample.requiredAnalyses).toEqual(['CEC']);
    });
});
