const prisma = require('../../prisma');
const workbenchController = require('../../controllers/workbenchController');
const draftService = require('../../services/draftService');
const { assembleReport } = require('../../services/reportAssembly');

describe('Workbench Draft Integrity Contract (P0)', () => {
    let testSampleId;
    let testWorkItemId1;
    let testWorkItemId2;
    const testUser = { username: 'tech_marcos', role: 'LAB_TECHNICIAN', labId: 'LAB-DEFAULT' };

    beforeAll(async () => {
        testSampleId = `SMP-DRAFT-TEST-${Date.now()}`;
        testWorkItemId1 = `WI-DRAFT-1-${Date.now()}`;
        testWorkItemId2 = `WI-DRAFT-2-${Date.now()}`;

        // Ensure test user exists
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

        // Ensure analysis exists
        await prisma.analysis.upsert({
            where: { code: 'PH' },
            update: {},
            create: {
                code: 'PH',
                name: 'pH (1:2.5 H2O)',
                units: 'pH_units',
                methodCitation: 'ISO 10390'
            }
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

        // Create work items assigned to tech_marcos
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
                analysis: 'PH',
                assignedTo: testUser.username,
                status: 'ASSIGNED',
                version: 1
            }
        });
    });

    afterAll(async () => {
        await prisma.workItemDraft.deleteMany({ where: { sampleId: testSampleId } });
        await prisma.result.deleteMany({ where: { sampleId: testSampleId } });
        await prisma.workItem.deleteMany({ where: { sampleId: testSampleId } });
        await prisma.sample.deleteMany({ where: { id: testSampleId } });
    });

    test('1. Saving draft writes strictly to WorkItemDraft and produces 0 Result rows', async () => {
        const req = {
            user: testUser,
            body: {
                draft: true,
                entries: [
                    {
                        workItemId: testWorkItemId1,
                        value: '6.55',
                        version: 1,
                        basis: 'AIR_DRY',
                        replicateNo: 1
                    }
                ]
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await workbenchController.batchSave(req, res);
        expect(res.json).toHaveBeenCalled();
        const responseData = res.json.mock.calls[0][0];
        expect(responseData.success).toBe(true);
        expect(responseData.draft).toBe(true);

        // Verify WorkItemDraft row exists
        const draftRow = await prisma.workItemDraft.findUnique({
            where: { workItemId: testWorkItemId1 }
        });
        expect(draftRow).not.toBeNull();
        expect(draftRow.value).toBe('6.55');
        expect(draftRow.userId).toBe(testUser.username);

        // Verify ZERO Result rows exist for this sample
        const resultCount = await prisma.result.count({
            where: { sampleId: testSampleId }
        });
        expect(resultCount).toBe(0);

        // Verify WorkItem status is IN_PROGRESS but completedAt remains null
        const wi = await prisma.workItem.findUnique({ where: { id: testWorkItemId1 } });
        expect(wi.status).toBe('IN_PROGRESS');
        expect(wi.completedAt).toBeNull();
    });

    test('2. Downstream reports completely exclude WorkItemDraft data', async () => {
        // Test sample has an active draft with value 6.55, but 0 Result rows
        const { content } = await assembleReport(testSampleId, { username: 'admin' });
        const allItems = (content.resultGroups || []).flatMap(g => g.items || []);
        const phItem = allItems.find(i => i.param === 'PH');
        expect(phItem).toBeUndefined();
    });

    test('3. Discarding a draft purges draft record and reverts WorkItem to ASSIGNED', async () => {
        const req = {
            user: testUser,
            params: { workItemId: testWorkItemId1 }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await workbenchController.discardDraft(req, res);
        expect(res.json).toHaveBeenCalled();
        const resData = res.json.mock.calls[0][0];
        expect(resData.success).toBe(true);
        expect(resData.receipt).toBeDefined();
        expect(resData.receipt.workItemId).toBe(testWorkItemId1);

        // Verify draft deleted
        const draftRow = await prisma.workItemDraft.findUnique({
            where: { workItemId: testWorkItemId1 }
        });
        expect(draftRow).toBeNull();

        // Verify WorkItem reverted to ASSIGNED
        const wi = await prisma.workItem.findUnique({ where: { id: testWorkItemId1 } });
        expect(wi.status).toBe('ASSIGNED');

        // Verify still ZERO Result rows
        const resultCount = await prisma.result.count({
            where: { sampleId: testSampleId }
        });
        expect(resultCount).toBe(0);
    });

    test('4. Conflict resolution: server value compare and override retention', async () => {
        // Save initial draft
        await draftService.saveDraft(testUser, {
            workItemId: testWorkItemId2,
            sampleId: testSampleId,
            analysis: 'PH',
            value: '5.80',
            baseVersion: 1
        });

        // Simulate server modification by bumping workItem version & setting result
        await prisma.workItem.update({
            where: { id: testWorkItemId2 },
            data: { version: 2, result: '7.10' }
        });

        // Save draft with outdated baseVersion (1 < 2)
        const updatedDraft = await draftService.saveDraft(testUser, {
            workItemId: testWorkItemId2,
            sampleId: testSampleId,
            analysis: 'PH',
            value: '5.85',
            baseVersion: 1
        });
        expect(updatedDraft.conflictValue).toBe('7.10');

        // Resolve conflict using KEEP_LOCAL without reason fails
        await expect(
            draftService.resolveConflict(testUser, testWorkItemId2, { resolution: 'KEEP_LOCAL', reason: '' })
        ).rejects.toThrow(/mandatory reason is required/);

        // Resolve conflict with KEEP_LOCAL and valid reason
        const resolved = await draftService.resolveConflict(testUser, testWorkItemId2, {
            resolution: 'KEEP_LOCAL',
            reason: 'Instrument re-calibrated and local reading re-verified'
        });
        expect(resolved.success).toBe(true);
        expect(resolved.draft.conflictValue).toBeNull();
        expect(resolved.draft.notes).toContain('Retained local draft');
    });

    test('5. Non-draft batchSave records determinations into Result and purges draft', async () => {
        const req = {
            user: testUser,
            body: {
                draft: false,
                entries: [
                    {
                        workItemId: testWorkItemId2,
                        value: '7.25',
                        version: 2,
                        basis: 'AIR_DRY',
                        replicateNo: 1
                    }
                ]
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await workbenchController.batchSave(req, res);
        expect(res.json).toHaveBeenCalled();

        // Verify Result row was created
        const resultRow = await prisma.result.findFirst({
            where: { sampleId: testSampleId, param: 'PH', isCurrent: true }
        });
        expect(resultRow).not.toBeNull();
        expect(resultRow.value).toBe('7.25');
        expect(resultRow.replicateNo).toBe(1);

        // Verify WorkItemDraft was purged
        const draftRow = await prisma.workItemDraft.findUnique({
            where: { workItemId: testWorkItemId2 }
        });
        expect(draftRow).toBeNull();

        // Verify WorkItem is completed
        const wi = await prisma.workItem.findUnique({ where: { id: testWorkItemId2 } });
        expect(wi.status).toBe('COMPLETED');
        expect(wi.completedAt).not.toBeNull();
    });

    test('6. Replicate 2 does not overwrite Replicate 1 in Result table', async () => {
        // Record Replicate 2 for the same parameter
        const req = {
            user: testUser,
            body: {
                draft: false,
                entries: [
                    {
                        workItemId: testWorkItemId1,
                        value: '7.30',
                        version: 1,
                        basis: 'AIR_DRY',
                        replicateNo: 2
                    }
                ]
            }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await workbenchController.batchSave(req, res);

        const currentResults = await prisma.result.findMany({
            where: { sampleId: testSampleId, param: 'PH', isCurrent: true },
            orderBy: { replicateNo: 'asc' }
        });

        expect(currentResults.length).toBe(2);
        expect(currentResults[0].replicateNo).toBe(1);
        expect(currentResults[0].value).toBe('7.25');
        expect(currentResults[1].replicateNo).toBe(2);
        expect(currentResults[1].value).toBe('7.30');
    });
});
