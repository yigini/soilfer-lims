const prisma = require('../../prisma');
const sampleController = require('../../controllers/sampleController');
const workflow = require('../../workflowContract');

describe('WP-26: Single Representation for Operational Gates', () => {
    let testSampleId;

    beforeEach(async () => {
        testSampleId = `SMP-GATE-TEST-${Date.now()}`;
        await prisma.sample.create({
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
        await prisma.workItem.create({
            data: {
                id: `WI-DRY-${Date.now()}`,
                sampleId: testSampleId,
                analysis: 'DRYING',
                category: 'Operational Gates',
                status: 'NOT_ASSIGNED',
                labId: 'LAB-DEFAULT'
            }
        });
        await prisma.workItem.create({
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
        // Explicitly set WorkItems to completed
        await prisma.workItem.updateMany({
            where: { sampleId: testSampleId, analysis: 'DRYING' },
            data: { status: 'COMPLETED' }
        });
        await prisma.workItem.updateMany({
            where: { sampleId: testSampleId, analysis: 'PREPARATION' },
            data: { status: 'ACCEPTED' }
        });

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
