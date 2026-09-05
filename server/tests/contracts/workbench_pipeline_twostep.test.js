const prisma = require('../../prisma');
const workbenchController = require('../../controllers/workbenchController');

describe('Workbench Two-Step Record & Submit Pipeline (Phase 4)', () => {
    let testSampleId;
    let testWorkItemId1;
    let testWorkItemId2;
    const testUser = { username: 'tech_marcos_p4', role: 'LAB_TECHNICIAN', labId: 'LAB-DEFAULT' };

    beforeAll(async () => {
        testSampleId = `SMP-P4-${Date.now()}`;
        testWorkItemId1 = `WI-P4-1-${Date.now()}`;
        testWorkItemId2 = `WI-P4-2-${Date.now()}`;

        // Ensure user exists
        await prisma.user.upsert({
            where: { username: testUser.username },
            update: {},
            create: {
                id: `USR-${testUser.username}`,
                username: testUser.username,
                email: `${testUser.username}@example.com`,
                password: 'hash',
                role: testUser.role,
                labId: testUser.labId
            }
        });

        // Ensure analyses exist
        await prisma.analysis.upsert({
            where: { code: 'PH' },
            update: {},
            create: { code: 'PH', name: 'pH', units: 'pH_units' }
        });
        await prisma.analysis.upsert({
            where: { code: 'EC' },
            update: {},
            create: { code: 'EC', name: 'Electrical Conductivity', units: 'dS/m' }
        });

        // Create sample
        await prisma.sample.create({
            data: {
                id: testSampleId,
                originalId: `ORIG-${testSampleId}`,
                status: 'PROCESSING',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                labId: 'LAB-DEFAULT',
                assignedLab: 'LAB-DEFAULT'
            }
        });

        // Create work items
        await prisma.workItem.create({
            data: {
                id: testWorkItemId1,
                sampleId: testSampleId,
                labId: 'LAB-DEFAULT',
                analysis: 'PH',
                assignedTo: testUser.username,
                status: 'ASSIGNED',
                version: 1
            }
        });
        await prisma.workItem.create({
            data: {
                id: testWorkItemId2,
                sampleId: testSampleId,
                labId: 'LAB-DEFAULT',
                analysis: 'EC',
                assignedTo: testUser.username,
                status: 'ASSIGNED',
                version: 1
            }
        });
    });

    afterAll(async () => {
        await prisma.submission.deleteMany({ where: { sampleId: testSampleId } });
        await prisma.result.deleteMany({ where: { sampleId: testSampleId } });
        await prisma.workItemDraft.deleteMany({ where: { sampleId: testSampleId } });
        await prisma.workItem.deleteMany({ where: { sampleId: testSampleId } });
        await prisma.sample.deleteMany({ where: { id: testSampleId } });
        await prisma.auditLog.deleteMany({ where: { sampleId: testSampleId } });
    });

    test('1. previewCompletion separates eligible items from invalid ones', async () => {
        const req = {
            user: testUser,
            body: {
                entries: [
                    { workItemId: testWorkItemId1, value: '6.75', version: 1 },
                    { workItemId: testWorkItemId2, value: 'invalid-number', version: 1 }
                ]
            }
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await workbenchController.previewCompletion(req, res);
        expect(res.json).toHaveBeenCalled();
        const data = res.json.mock.calls[0][0];

        expect(data.eligibleCount).toBe(1);
        expect(data.blockedCount).toBe(1);
        expect(data.included[0].workItemId).toBe(testWorkItemId1);
        expect(data.excluded[0].workItemId).toBe(testWorkItemId2);
        expect(data.excluded[0].blockers).toContain('INVALID_FORMAT');
    });

    test('2. commitCompletion records determinations, completes items and returns receipt', async () => {
        const req = {
            user: testUser,
            body: {
                entries: [
                    { workItemId: testWorkItemId1, value: '6.75', version: 1, basis: 'AIR_DRY' },
                    { workItemId: testWorkItemId2, value: '1.45', version: 1, basis: 'AIR_DRY' }
                ]
            }
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await workbenchController.commitCompletion(req, res);
        expect(res.json).toHaveBeenCalled();
        const data = res.json.mock.calls[0][0];

        expect(data.success).toBe(true);
        expect(data.saved).toBe(2);
        expect(data.receipt).toBeDefined();
        expect(data.receipt.type).toBe('RECORD');
        expect(data.receipt.count).toBe(2);

        // Verify items completed in DB
        const items = await prisma.workItem.findMany({
            where: { id: { in: [testWorkItemId1, testWorkItemId2] } }
        });
        expect(items.every(i => i.status === 'COMPLETED')).toBe(true);
    });

    test('3. previewSubmissions bundles completed items by sample', async () => {
        const req = {
            user: testUser,
            body: { sampleIds: [testSampleId] }
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await workbenchController.previewSubmissions(req, res);
        expect(res.json).toHaveBeenCalled();
        const data = res.json.mock.calls[0][0];

        expect(data.totalEligibleSamples).toBe(1);
        const sampleBundle = data.eligibleSamples[0];
        expect(sampleBundle.sampleId).toBe(testSampleId);
        expect(sampleBundle.completedCount).toBe(2);
        expect(sampleBundle.submissionType).toBe('FULL');
    });

    test('4. commitSubmissions creates Submission and transitions items to SUBMITTED', async () => {
        const req = {
            user: testUser,
            body: {
                sampleIds: [testSampleId],
                note: 'Batch 1 completed determinations ready for review'
            }
        };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await workbenchController.commitSubmissions(req, res);
        expect(res.json).toHaveBeenCalled();
        const data = res.json.mock.calls[0][0];

        expect(data.success).toBe(true);
        expect(data.receipt).toBeDefined();
        expect(data.receipt.type).toBe('SUBMISSION');
        expect(data.receipt.sampleCount).toBe(1);

        // Verify Submission in DB
        const sub = await prisma.submission.findFirst({
            where: { sampleId: testSampleId }
        });
        expect(sub).not.toBeNull();
        expect(sub.status).toBe('PENDING_REVIEW');
        expect(sub.type).toBe('FULL');

        // Verify work items are SUBMITTED
        const items = await prisma.workItem.findMany({
            where: { id: { in: [testWorkItemId1, testWorkItemId2] } }
        });
        expect(items.every(i => i.status === 'SUBMITTED')).toBe(true);
        expect(items.every(i => i.submissionId === sub.id)).toBe(true);

        // Verify Sample status is SUBMITTED
        const smp = await prisma.sample.findUnique({ where: { id: testSampleId } });
        expect(smp.status).toBe('SUBMITTED');
    });

    test('5. getReceipts returns recent activity receipts', async () => {
        const req = { user: testUser };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

        await workbenchController.getReceipts(req, res);
        expect(res.json).toHaveBeenCalled();
        const data = res.json.mock.calls[0][0];

        expect(data.receipts).toBeDefined();
        expect(data.receipts.length).toBeGreaterThan(0);
        const subReceipt = data.receipts.find(r => r.action === 'WORKBENCH_SUBMIT');
        expect(subReceipt).toBeDefined();
        expect(subReceipt.sampleId).toBe(testSampleId);
    });
});
