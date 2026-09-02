const prisma = require('../../prisma');
const { transitionSample, TransitionError } = require('../../services/sampleStateService');
const workflow = require('../../workflowContract');

describe('WP-11: Canonical Sample State Transition Authority', () => {
    let testSample;

    beforeEach(async () => {
        const id = `SMP-TR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        testSample = await prisma.sample.create({
            data: {
                id,
                originalId: `ORIG-${id}`,
                status: 'EXPECTED',
                country: 'GTM',
                assignedLab: 'GTM-LAB1'
            }
        });
    });

    afterEach(async () => {
        if (testSample) {
            await prisma.auditLog.deleteMany({ where: { sampleId: testSample.id } }).catch(() => {});
            await prisma.sample.delete({ where: { id: testSample.id } }).catch(() => {});
        }
    });

    test('1. Executes full legal lifecycle path with audit logs', async () => {
        const s1 = await transitionSample(testSample.id, 'RECEIVED', 'tech_user', 'Arrived at reception');
        expect(s1.status).toBe('RECEIVED');

        const s2 = await transitionSample(testSample.id, 'ACCEPTED', 'mgr_user', 'Intake verified');
        expect(s2.status).toBe('ACCEPTED');

        const s3 = await transitionSample(testSample.id, 'PROCESSING', 'tech_user', 'Drying and prep complete');
        expect(s3.status).toBe('PROCESSING');

        const s4 = await transitionSample(testSample.id, 'SUBMITTED_FULL', 'tech_user', 'All benches submitted');
        expect(s4.status).toBe('SUBMITTED_FULL');

        const s5 = await transitionSample(testSample.id, 'APPROVED', 'mgr_user', 'Analytical sign-off');
        expect(s5.status).toBe('APPROVED');

        const s6 = await transitionSample(testSample.id, 'ARCHIVED', 'mgr_user', 'Moved to archive vault');
        expect(s6.status).toBe('ARCHIVED');

        // Verify audit log entries
        const logs = await prisma.auditLog.findMany({
            where: { sampleId: testSample.id },
            orderBy: { timestamp: 'asc' }
        });
        expect(logs.length).toBe(6);
        expect(logs[0].details).toContain('from EXPECTED to RECEIVED');
        expect(logs[5].details).toContain('from APPROVED to ARCHIVED');
    });

    test('2. Allows legal reversions (RECEIVED -> EXPECTED)', async () => {
        await transitionSample(testSample.id, 'RECEIVED', 'tech_user');
        const reverted = await transitionSample(testSample.id, 'EXPECTED', 'tech_user', 'Field barcode correction needed');
        expect(reverted.status).toBe('EXPECTED');
    });

    test('3. Rejects illegal transitions with 409 Conflict', async () => {
        // Direct jump from EXPECTED to APPROVED
        await expect(
            transitionSample(testSample.id, 'APPROVED', 'tech_user')
        ).rejects.toThrow(TransitionError);

        try {
            await transitionSample(testSample.id, 'APPROVED', 'tech_user');
        } catch (e) {
            expect(e.statusCode).toBe(409);
            expect(e.code).toBe('ILLEGAL_STATUS_TRANSITION');
        }
    });

    test('4. Terminal states cannot transition to any other status', async () => {
        // Move to APPROVED then ARCHIVED
        await transitionSample(testSample.id, 'RECEIVED', 'user');
        await transitionSample(testSample.id, 'ACCEPTED', 'user');
        await transitionSample(testSample.id, 'PROCESSING', 'user');
        await transitionSample(testSample.id, 'APPROVED', 'user');
        await transitionSample(testSample.id, 'ARCHIVED', 'user');

        await expect(
            transitionSample(testSample.id, 'PROCESSING', 'user')
        ).rejects.toThrow(TransitionError);
    });

    test('5. Rejects deprecated legacy statuses with 400 Bad Request', async () => {
        for (const legacy of ['ANALYSIS', 'COLLECTED', 'NON_CONFORMING', 'PARTIALLY_COMPLETE']) {
            await expect(
                transitionSample(testSample.id, legacy, 'user')
            ).rejects.toThrow(TransitionError);

            try {
                await transitionSample(testSample.id, legacy, 'user');
            } catch (e) {
                expect(e.statusCode).toBe(400);
                expect(e.code).toBe('ILLEGAL_LEGACY_STATUS');
            }
        }
    });

    test('6. WP-09: Block terminal transitions while work items are live', async () => {
        const sampleController = require('../../controllers/sampleController');
        
        // Advance sample to APPROVED
        await prisma.sample.update({
            where: { id: testSample.id },
            data: { status: 'APPROVED' }
        });

        // Create an active work item
        const activeWi = await prisma.workItem.create({
            data: {
                id: `WI-TEST-${Date.now()}`,
                sampleId: testSample.id,
                analysis: 'PH',
                status: 'IN_PROGRESS'
            }
        });

        const req = {
            params: { id: testSample.id },
            user: { username: 'test_mgr', role: 'LAB_MANAGER', permissions: ['DISPOSE_SAMPLE', 'ARCHIVE_SAMPLE'] },
            body: {}
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        // Attempt disposal while PH is IN_PROGRESS
        await sampleController.disposeSample(req, res);
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: expect.stringContaining('PH (IN_PROGRESS)')
        }));

        // Attempt archive while PH is IN_PROGRESS
        const resArch = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        await sampleController.archiveSample(req, resArch);
        expect(resArch.status).toHaveBeenCalledWith(409);
        expect(resArch.json).toHaveBeenCalledWith(expect.objectContaining({
            error: expect.stringContaining('PH (IN_PROGRESS)')
        }));

        // Cleanup active work item
        await prisma.workItem.delete({ where: { id: activeWi.id } });
    });

    test('7. WP-08: disposeSample creates DISPOSAL work item and leaves sample APPROVED', async () => {
        const sampleController = require('../../controllers/sampleController');
        
        await prisma.sample.update({
            where: { id: testSample.id },
            data: { status: 'APPROVED' }
        });

        const req = {
            params: { id: testSample.id },
            user: { username: 'test_mgr', role: 'LAB_MANAGER', permissions: ['DISPOSE_SAMPLE'] },
            body: { disposalMethod: 'INCINERATION' }
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        await sampleController.disposeSample(req, res);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            status: 'APPROVED',
            message: expect.stringContaining('Disposal task created')
        }));

        // Verify DISPOSAL work item was created
        const dispItem = await prisma.workItem.findFirst({
            where: { sampleId: testSample.id, analysis: 'DISPOSAL' }
        });
        expect(dispItem).not.toBeNull();
        expect(dispItem.status).toBe('PENDING');

        // Verify sample status is STILL APPROVED (2-step workflow)
        const currentSample = await prisma.sample.findUnique({ where: { id: testSample.id } });
        expect(currentSample.status).toBe('APPROVED');

        // Cleanup
        await prisma.workItem.deleteMany({ where: { sampleId: testSample.id } });
    });
});

