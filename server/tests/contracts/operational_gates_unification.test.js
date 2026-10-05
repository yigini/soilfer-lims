const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const prisma = require('../../prisma');
const sampleController = require('../../controllers/sampleController');
const workflow = require('../../workflowContract');
const operations = require('../../services/operationalConfirmationService');
const { transitionWorkItem } = require('../../services/workItemStateService');
const checklists = require('../../data/operationalChecklists.json');

describe('WP-26: Single Representation for Operational Gates', () => {
    let testSampleId;

    beforeEach(async () => {
        testSampleId = `SMP-GATE-TEST-${Date.now()}`;
        await createSampleFixture(prisma, {
            data: {
                id: testSampleId,
                originalId: `ORIG-${testSampleId}`,
                status: 'ACCEPTED',
                labId: 'LAB-DEFAULT',
                assignedLab: 'LAB-DEFAULT',
                dryingStatus: 'PENDING',
                preparationStatus: 'PENDING',
                requiredAnalyses: JSON.stringify(['PH'])
            }
        });

        // Create gate work items
        await createWorkItemFixture(prisma, {
            data: {
                id: `WI-DRY-${Date.now()}`,
                sampleId: testSampleId,
                analysis: 'DRYING',
                category: 'Operational Gates',
                status: 'NOT_ASSIGNED',
                labId: 'LAB-DEFAULT'
            }
        });
        await createWorkItemFixture(prisma, {
            data: {
                id: `WI-PREP-${Date.now()}`,
                sampleId: testSampleId,
                analysis: 'PREPARATION',
                category: 'Operational Gates',
                status: 'NOT_ASSIGNED',
                labId: 'LAB-DEFAULT'
            }
        });
    });

    afterEach(async () => {
        await prisma.workItem.deleteMany({ where: { sampleId: testSampleId } });
        await prisma.sample.deleteMany({ where: { id: testSampleId } });
    });

    test('1. updatePhaseStatus DONE synchronizes WorkItem to COMPLETED with verified receipt', async () => {
        const req = {
            params: { id: testSampleId },
            body: { phase: 'DRYING', status: 'DONE', checklist: [true, true, true] },
            user: { username: 'test_mgr', role: 'LAB_MANAGER', labId: 'LAB-DEFAULT' }
        };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        await sampleController.updatePhaseStatus(req, res);
        expect(res.json).toHaveBeenCalled();

        const dryWi = await prisma.workItem.findFirst({
            where: { sampleId: testSampleId, analysis: 'DRYING' }
        });
        expect(['COMPLETED', 'ACCEPTED']).toContain(dryWi.status);
        expect(dryWi.result).toContain('REC-OPS-');
    });

    test('2. updatePhaseStatus FAILED synchronizes WorkItem to ON_HOLD', async () => {
        const req = {
            params: { id: testSampleId },
            body: { phase: 'DRYING', status: 'FAILED', reason: 'Sample contaminated with grease' },
            user: { username: 'test_mgr', role: 'LAB_MANAGER', labId: 'LAB-DEFAULT' }
        };
        const res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        await sampleController.updatePhaseStatus(req, res);
        expect(res.json).toHaveBeenCalled();

        const dryWi = await prisma.workItem.findFirst({
            where: { sampleId: testSampleId, analysis: 'DRYING' }
        });
        expect(dryWi.status).toBe('ON_HOLD');
        expect(dryWi.result).toContain('Gate Failed');
    });

    test('3. getSampleDetail derives gate status dynamically from WorkItems', async () => {
        const manager = { username: 'test_mgr', role: 'LAB_MANAGER', labId: 'LAB-DEFAULT' };
        let preparation;
        for (const analysis of ['DRYING', 'PREPARATION']) {
            const item = await prisma.workItem.findFirst({ where: { sampleId: testSampleId, analysis } });
            await operations.confirmOperation({ actor: manager, workItemId: item.id,
                checklist: checklists[analysis].steps.map(() => true) });
            if (analysis === 'PREPARATION') preparation = item;
        }
        for (const status of ['SUBMITTED', 'ACCEPTED']) {
            await transitionWorkItem(preparation.id, status, manager, 'Reviewed operational fixture');
        }

        // Deliberately leave Sample table columns as 'PENDING'
        await prisma.sample.update({
            where: { id: testSampleId },
            data: { dryingStatus: 'PENDING', preparationStatus: 'PENDING' }
        });

        const req = {
            params: { id: testSampleId },
            user: { username: 'test_mgr', role: 'LAB_MANAGER', labId: 'LAB-DEFAULT' }
        };
        let responseData = null;
        const res = {
            json: (data) => { responseData = data; },
            status: jest.fn().mockReturnThis()
        };

        await sampleController.getSampleDetail(req, res);

        expect(responseData).not.toBeNull();
        expect(responseData.sample.dryingStatus).toBe('DONE');
        expect(responseData.sample.preparationStatus).toBe('DONE');
    });
});
