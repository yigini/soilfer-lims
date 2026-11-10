'use strict';

const prisma = require('../../prisma');
const {
    seedDemoLab,
    DEMO_LAB_ID,
    DEMO_LAB_NAME,
    DEMO_PROJECT_CODE
} = require('../../scripts/seed_demo_lab.cjs');

describe('Practice-Lab Seed Script (Demo Soil Lab)', () => {
    jest.setTimeout(120000);

    test('refuses to run unless DEMO_SEED=1 is set', async () => {
        await expect(
            seedDemoLab({
                env: { ...process.env, DEMO_SEED: undefined, NODE_ENV: 'test' },
                silent: true
            })
        ).rejects.toMatchObject({ code: 'DEMO_SEED_REQUIRED' });
    });

    test('refuses to run when NODE_ENV=production', async () => {
        await expect(
            seedDemoLab({
                env: { ...process.env, DEMO_SEED: '1', NODE_ENV: 'production' },
                silent: true
            })
        ).rejects.toMatchObject({ code: 'DEMO_SEED_PRODUCTION_REFUSED' });
    });

    test('seeds Demo Soil Lab through real workflow transitions and refuses a second run', async () => {
        const summary = await seedDemoLab({
            env: { ...process.env, DEMO_SEED: '1', NODE_ENV: 'test' },
            silent: true
        });

        expect(summary.labId).toBe(DEMO_LAB_ID);
        expect(summary.labName).toBe(DEMO_LAB_NAME);
        expect(summary.projectCode).toBe(DEMO_PROJECT_CODE);

        // 1. Facility & policies
        const lab = await prisma.lab.findUnique({ where: { id: DEMO_LAB_ID } });
        expect(lab).toBeTruthy();
        expect(lab.name).toBe(DEMO_LAB_NAME);
        expect(lab.isActive).toBe(true);

        const labPolicy = await prisma.labPolicy.findUnique({ where: { labId: DEMO_LAB_ID } });
        expect(labPolicy?.presetCode).toBe('ISO17025_STRICT');
        const activeOverrides = await prisma.labPolicyOverride.count({
            where: { labId: DEMO_LAB_ID, revokedAt: null }
        });
        expect(activeOverrides).toBeGreaterThanOrEqual(4);

        // 2. Accounts, @example.test emails, bench PINs, and pending invite
        const demoUsers = await prisma.user.findMany({
            where: { labId: DEMO_LAB_ID, isActive: true }
        });
        expect(demoUsers).toHaveLength(7);
        const superUser = await prisma.user.findUnique({ where: { username: 'superadmin' } });
        expect(superUser?.isActive).toBe(true);

        for (const u of [...demoUsers, superUser]) {
            expect(u.email).toMatch(/@example\.test$/);
        }

        const benchPins = await prisma.userBenchCredential.count({
            where: { userId: { in: demoUsers.filter(u => u.role === 'LAB_TECHNICIAN').map(u => u.id) } }
        });
        expect(benchPins).toBe(2);

        const pendingInvites = await prisma.staffInvitation.findMany({
            where: { labId: DEMO_LAB_ID, isConsumed: false, isRevoked: false }
        });
        expect(pendingInvites).toHaveLength(1);
        expect(pendingInvites[0].email).toBe('tech3@example.test');

        // 3. Packages, instruments, inventory, reference materials, control charts & blank history
        const groups = await prisma.analysisGroup.findMany({
            where: { id: { in: ['DEMO_ROUTINE_FERTILITY', 'DEMO_FULL_SOIL_HEALTH'] } }
        });
        expect(groups).toHaveLength(2);

        const instruments = await prisma.equipmentAsset.findMany({
            where: { labId: DEMO_LAB_ID }
        });
        expect(instruments).toHaveLength(3);

        const importTemplates = await prisma.importTemplate.findMany({
            where: { labId: DEMO_LAB_ID }
        });
        expect(importTemplates).toHaveLength(1);

        const inventoryItems = await prisma.inventoryItem.findMany({
            where: { labId: DEMO_LAB_ID }
        });
        expect(inventoryItems).toHaveLength(3);

        const refMaterials = await prisma.referenceMaterial.findMany({
            where: { labId: DEMO_LAB_ID, status: 'ACTIVE' }
        });
        expect(refMaterials).toHaveLength(2);
        expect(refMaterials.map(r => r.code).sort()).toEqual(['CRM-SOIL-01', 'LRM-DEMO-01']);

        const approvedLimitSets = await prisma.controlLimitSet.findMany({
            where: { labId: DEMO_LAB_ID, analysisCode: 'P_OLSEN', status: 'APPROVED' }
        });
        expect(approvedLimitSets).toHaveLength(1);
        expect(approvedLimitSets[0].n).toBe(12);

        // Verify >= 15 LRM measurements and >= 10 BLANK measurements on Olsen P batches
        const olsenBatches = await prisma.batch.findMany({
            where: { labId: DEMO_LAB_ID, analysis: 'P_OLSEN' },
            include: { positions: true, measurements: true }
        });
        const lrmPositionIds = new Set(
            olsenBatches.flatMap(b => b.positions.filter(p => p.kind === 'LRM').map(p => p.id))
        );
        const blankPositionIds = new Set(
            olsenBatches.flatMap(b => b.positions.filter(p => p.kind === 'BLANK').map(p => p.id))
        );
        const olsenMeasurements = olsenBatches.flatMap(b => b.measurements.filter(m => !m.supersededById));
        expect(olsenMeasurements.filter(m => lrmPositionIds.has(m.positionId)).length).toBeGreaterThanOrEqual(15);
        expect(olsenMeasurements.filter(m => blankPositionIds.has(m.positionId)).length).toBeGreaterThanOrEqual(10);

        // 4. Samples across every workflow stage (3 expected + 1 draft + 15 demo samples = 19 total)
        const project = await prisma.project.findFirst({ where: { code: DEMO_PROJECT_CODE } });
        expect(project).toBeTruthy();

        const projectSamples = await prisma.sample.findMany({
            where: { projectId: project.id },
            orderBy: { originalId: 'asc' }
        });
        expect(projectSamples).toHaveLength(19);

        const expectedRows = projectSamples.filter(s => s.status === 'EXPECTED');
        const draftRows = projectSamples.filter(s => s.status === 'DRAFT');
        const rejectedRows = projectSamples.filter(s => s.status === 'RECEIVED_REJECTED');
        expect(expectedRows).toHaveLength(3);
        expect(draftRows).toHaveLength(1);
        expect(rejectedRows).toHaveLength(1);

        const demo1to14 = projectSamples.filter(s =>
            /^FIELD-2026-0(0[1-9]|1[0-4])$/.test(s.originalId)
        );
        expect(demo1to14).toHaveLength(14);
        expect(demo1to14.map(s => s.labSampleCode)).toEqual(
            Array.from({ length: 14 }, (_, i) => `DEMO-26-${String(i + 1).padStart(4, '0')}`)
        );

        const byCode = Object.fromEntries(demo1to14.map(s => [s.labSampleCode, s]));

        // Sample 1: Accepted, waiting for drying, label printed once
        expect(byCode['DEMO-26-0001'].status).toBe('ACCEPTED');
        expect(byCode['DEMO-26-0001'].dryingStatus).toBe('PENDING');
        const s1Prints = await prisma.labelPrintEvent.count({
            where: { sampleId: byCode['DEMO-26-0001'].id }
        });
        expect(s1Prints).toBe(1);

        // Sample 3 & 4: Drying DONE, Preparation PENDING
        expect(byCode['DEMO-26-0003'].dryingStatus).toBe('DONE');
        expect(byCode['DEMO-26-0003'].preparationStatus).toBe('PENDING');
        expect(byCode['DEMO-26-0004'].dryingStatus).toBe('DONE');
        expect(byCode['DEMO-26-0004'].preparationStatus).toBe('PENDING');

        // Sample 5: Prepared + sub-sample containers + unassigned analytical items
        expect(byCode['DEMO-26-0005'].status).toBe('PROCESSING');
        const s5Containers = await prisma.sampleContainer.count({
            where: { sampleId: byCode['DEMO-26-0005'].id }
        });
        expect(s5Containers).toBeGreaterThanOrEqual(2);
        const s5Unassigned = await prisma.workItem.count({
            where: {
                sampleId: byCode['DEMO-26-0005'].id,
                assignedTo: null,
                analysis: { notIn: ['DRYING', 'PREPARATION'] }
            }
        });
        expect(s5Unassigned).toBe(5);

        // Sample 9: Returned Soil pH Try #1 + reassigned open Try #2 in tech1 Workbench
        const s9Ph = await prisma.workItem.findFirst({
            where: { sampleId: byCode['DEMO-26-0009'].id, analysis: 'PH_H2O' }
        });
        expect(s9Ph.status).toBe('ASSIGNED');
        const s9Attempts = await prisma.workAttempt.findMany({
            where: { workItemId: s9Ph.id },
            orderBy: { attemptNo: 'asc' }
        });
        expect(s9Attempts).toHaveLength(2);
        expect(s9Attempts[1].status).toBe('OPEN');

        // Sample 10: Submitted in Review Submissions with 2 Soil pH tries
        expect(byCode['DEMO-26-0010'].status).toBe('SUBMITTED_FULL');
        const s10Ph = await prisma.workItem.findFirst({
            where: { sampleId: byCode['DEMO-26-0010'].id, analysis: 'PH_H2O' }
        });
        const s10Attempts = await prisma.workAttempt.count({
            where: { workItemId: s10Ph.id }
        });
        expect(s10Attempts).toBe(2);

        // Sample 11: Failed Olsen P batch awaiting manager decision
        const failedAnalytes = await prisma.batchAnalyte.findMany({
            where: { labId: DEMO_LAB_ID, analysisCode: 'P_OLSEN', status: 'QC_FAIL' }
        });
        expect(failedAnalytes).toHaveLength(1);

        // Sample 12: All analytical tests ACCEPTED (ready in Final Approvals)
        const s12Analytical = await prisma.workItem.findMany({
            where: {
                sampleId: byCode['DEMO-26-0012'].id,
                analysis: { notIn: ['DRYING', 'PREPARATION'] }
            }
        });
        expect(s12Analytical.length).toBe(10);
        expect(s12Analytical.every(w => w.status === 'ACCEPTED')).toBe(true);

        // Sample 13 & 14: Reports (1 SUPERSEDED, 1 PUBLISHED, 1 WITHDRAWN), 1 share link, 1 PENDING amendment
        const s13Reports = await prisma.report.findMany({
            where: { sampleId: byCode['DEMO-26-0013'].id },
            orderBy: { version: 'asc' }
        });
        expect(s13Reports.map(r => r.status)).toEqual(['SUPERSEDED', 'PUBLISHED']);
        const shareLinks = await prisma.reportShareLink.count({
            where: { reportId: s13Reports[1].id, isRevoked: false }
        });
        expect(shareLinks).toBe(1);
        const pendingAmendments = await prisma.sampleAmendment.count({
            where: { sampleId: byCode['DEMO-26-0013'].id, status: 'PENDING' }
        });
        expect(pendingAmendments).toBe(1);

        const s14Reports = await prisma.report.findMany({
            where: { sampleId: byCode['DEMO-26-0014'].id }
        });
        expect(s14Reports.map(r => r.status)).toEqual(['WITHDRAWN']);

        // 5. Problem records (1 OPEN + 1 CLOSED) & Proficiency Testing rounds (1 SATISFACTORY + 1 QUESTIONABLE)
        const ncrs = await prisma.nonconformityReport.findMany({
            where: { labId: DEMO_LAB_ID }
        });
        expect(ncrs.map(r => r.status).sort()).toEqual(['CLOSED', 'OPEN']);

        const ptRounds = await prisma.proficiencyRound.findMany({
            where: { labId: DEMO_LAB_ID, deletedAt: null }
        });
        expect(ptRounds.map(r => r.outcome).sort()).toEqual(['QUESTIONABLE', 'SATISFACTORY']);

        // 6. Audit trail populated by real workflow transitions
        const auditCount = await prisma.auditLog.count();
        expect(auditCount).toBeGreaterThan(50);

        // 7. Second run on the same database refuses cleanly
        await expect(
            seedDemoLab({
                env: { ...process.env, DEMO_SEED: '1', NODE_ENV: 'test' },
                silent: true
            })
        ).rejects.toMatchObject({ code: 'DEMO_LAB_ALREADY_EXISTS' });
    });
});
