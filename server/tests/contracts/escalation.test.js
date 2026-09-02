const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { runEscalationChecks } = require('../../services/escalationService');

describe('SD-14: Work Escalation Service Contract', () => {
    const labId = 'LAB-GTM';
    const sampleId = 'SMP-SD14-TEST-01';
    const wiUnassignedId = 'WI-SD14-UNASSIGNED-01';
    const wiStalledId = 'WI-SD14-STALLED-01';
    let mgrUser;

    beforeAll(async () => {
        // Ensure auth token generated (and user seeded)
        await getAuthToken('LAB_MANAGER', labId, ['GTM'], ['SOILFER-US']);
        const techToken = await getAuthToken('LAB_TECHNICIAN', labId, ['GTM'], ['SOILFER-US']);

        mgrUser = await prisma.user.findFirst({
            where: { role: 'LAB_MANAGER', labId, isActive: true }
        });

        const techUser = await prisma.user.findFirst({
            where: { role: 'LAB_TECHNICIAN', labId, isActive: true }
        });
        const techUsername = techUser?.username || 'test_lab_technician_labgtm';

        // Clean up
        await prisma.notification.deleteMany({ where: { userId: mgrUser.id } });
        await prisma.workItem.deleteMany({ where: { sampleId } });
        await prisma.sample.deleteMany({ where: { id: sampleId } });

        // Create sample in PROCESSING
        await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: sampleId,
                assignedLab: labId,
                labId: labId,
                country: 'GTM',
                projectCode: 'SOILFER-US',
                status: 'PROCESSING',
                matrix: 'SOIL',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            }
        });

        // Create work item that has been NOT_ASSIGNED for 3 days (72h > 48h)
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        await prisma.workItem.create({
            data: {
                id: wiUnassignedId,
                sampleId,
                labId,
                assignedLab: labId,
                analysis: 'PH_H2O',
                category: 'Wet Chemistry',
                status: 'NOT_ASSIGNED',
                createdAt: threeDaysAgo,
                updatedAt: threeDaysAgo
            }
        });

        // Create work item that has been IN_PROGRESS for 4 days (96h > 72h)
        const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
        await prisma.workItem.create({
            data: {
                id: wiStalledId,
                sampleId,
                labId,
                assignedLab: labId,
                analysis: 'EC_1_5',
                category: 'Wet Chemistry',
                status: 'IN_PROGRESS',
                assignedTo: techUsername,
                createdAt: fourDaysAgo,
                updatedAt: fourDaysAgo
            }
        });
    });

    afterAll(async () => {
        await prisma.notification.deleteMany({ where: { userId: mgrUser.id } });
        await prisma.workItem.deleteMany({ where: { sampleId } });
        await prisma.sample.deleteMany({ where: { id: sampleId } });
    });

    test('1. An unassigned work item sitting for >2 days escalates to the manager without opening a page', async () => {
        const result = await runEscalationChecks();
        expect(result.escalatedCount).toBeGreaterThanOrEqual(1);

        const unassignedEscalation = result.unassigned.find(e => e.workItemId === wiUnassignedId && e.userId === mgrUser.id);
        expect(unassignedEscalation).toBeDefined();

        // Verify notification in database
        const notif = await prisma.notification.findFirst({
            where: {
                userId: mgrUser.id,
                link: `/samples/${sampleId}`,
                title: { contains: 'Unassigned' }
            }
        });

        expect(notif).not.toBeNull();
        expect(notif.type).toBe('WARNING');
        expect(notif.message).toContain(sampleId);
        expect(notif.message).toMatch(/unassigned for 3 days/i);
    });

    test('2. Running escalation checks again deduplicates and does not re-notify', async () => {
        const initialCount = await prisma.notification.count({
            where: {
                userId: mgrUser.id,
                link: `/samples/${sampleId}`,
                title: { contains: 'Unassigned' }
            }
        });

        const secondRun = await runEscalationChecks();
        const secondUnassigned = secondRun.unassigned.find(e => e.workItemId === wiUnassignedId && e.userId === mgrUser.id);
        expect(secondUnassigned).toBeUndefined();

        const finalCount = await prisma.notification.count({
            where: {
                userId: mgrUser.id,
                link: `/samples/${sampleId}`,
                title: { contains: 'Unassigned' }
            }
        });

        expect(finalCount).toBe(initialCount);
    });

    test('3. Stalled work (in progress >72 hours) escalates to the manager', async () => {
        const notif = await prisma.notification.findFirst({
            where: {
                userId: mgrUser.id,
                link: `/samples/${sampleId}`,
                title: { contains: 'Stalled' }
            }
        });

        expect(notif).not.toBeNull();
        expect(notif.type).toBe('WARNING');
        expect(notif.message).toMatch(/in progress for 4 days/i);
    });
});
