/**
 * Issue #103: Discrepancy Report & Reconciliation Correctness Tests
 *
 * Verifies:
 * 1. An explicit owner lab with zero ProjectLab junction rows is flagged as OWNER_LAB_NOT_IN_JUNCTION.
 * 2. An explicit owner lab with a matching ProjectLab junction row has no owner discrepancy.
 * 3. resolveProjectLabs correctly resolves OWNER and PRIMARY roles.
 */
'use strict';

const prisma = require('../../prisma');
const projectMembershipService = require('../../services/projectMembershipService');

describe('Issue #103: Discrepancy Report and Reconciliation Correctness', () => {
    let testPrefix;
    let ownerLab, servicingLab;
    let zeroJunctionProject, reconciledProject;

    beforeAll(async () => {
        testPrefix = 'I103-' + Date.now();

        ownerLab = await prisma.lab.create({
            data: {
                id: 'LAB-OWNER-' + testPrefix,
                code: 'LO-' + testPrefix,
                name: 'Owner Lab ' + testPrefix,
                country: 'Guatemala',
                timezone: 'America/Guatemala',
                isActive: true
            }
        });

        servicingLab = await prisma.lab.create({
            data: {
                id: 'LAB-SVC-' + testPrefix,
                code: 'LS-' + testPrefix,
                name: 'Servicing Lab ' + testPrefix,
                country: 'Guatemala',
                timezone: 'America/Guatemala',
                isActive: true
            }
        });

        // 1. Project with explicit owner lab but ZERO junction rows
        zeroJunctionProject = await prisma.project.create({
            data: {
                id: 'PROJ-ZERO-' + testPrefix,
                code: 'ZERO-' + testPrefix,
                name: 'Zero Junction Project ' + testPrefix,
                labId: ownerLab.id,
                status: 'ACTIVE'
            }
        });

        // 2. Project with explicit owner and PRIMARY junction rows matching legacy JSON
        reconciledProject = await prisma.project.create({
            data: {
                id: 'PROJ-REC-' + testPrefix,
                code: 'REC-' + testPrefix,
                name: 'Reconciled Project ' + testPrefix,
                labId: ownerLab.id,
                assignedLabIds: JSON.stringify([servicingLab.id]),
                status: 'ACTIVE'
            }
        });

        await prisma.projectLab.create({
            data: {
                id: 'pl-owner-' + testPrefix,
                projectCode: reconciledProject.code,
                labId: ownerLab.id,
                role: 'OWNER'
            }
        });

        await prisma.projectLab.create({
            data: {
                id: 'pl-svc-' + testPrefix,
                projectCode: reconciledProject.code,
                labId: servicingLab.id,
                role: 'PRIMARY'
            }
        });
    });

    afterAll(async () => {
        await prisma.projectLab.deleteMany({
            where: { projectCode: { in: [zeroJunctionProject.code, reconciledProject.code] } }
        });
        await prisma.project.deleteMany({
            where: { id: { in: [zeroJunctionProject.id, reconciledProject.id] } }
        });
        await prisma.lab.deleteMany({
            where: { id: { in: [ownerLab.id, servicingLab.id] } }
        });
    });

    test('getDiscrepancyReport flags OWNER_LAB_NOT_IN_JUNCTION when junction rows are zero', async () => {
        const report = await projectMembershipService.getDiscrepancyReport();
        const disc = report.discrepancies.find(d => d.projectCode === zeroJunctionProject.code);

        expect(disc).toBeDefined();
        expect(disc.ownerLabId).toBe(ownerLab.id);
        expect(disc.junctionLabIds).toEqual([]);

        const ownerIssue = disc.issues.find(i => i.type === 'OWNER_LAB_NOT_IN_JUNCTION');
        expect(ownerIssue).toBeDefined();
        expect(ownerIssue.ownerLabId).toBe(ownerLab.id);
        expect(ownerIssue.detail).toContain(ownerLab.id);
    });

    test('getDiscrepancyReport does not flag OWNER_LAB_NOT_IN_JUNCTION when owner junction row exists', async () => {
        const report = await projectMembershipService.getDiscrepancyReport();
        const disc = report.discrepancies.find(d => d.projectCode === reconciledProject.code);

        expect(disc).toBeUndefined();
    });

    test('resolveProjectLabs correctly includes both OWNER and PRIMARY roles without errors', async () => {
        const resolved = await projectMembershipService.resolveProjectLabs(reconciledProject);
        expect(resolved.ownerLabId).toBe(ownerLab.id);
        expect(resolved.servicingLabIds).toContain(servicingLab.id);
        expect(resolved.allMemberLabIds).toContain(ownerLab.id);
        expect(resolved.allMemberLabIds).toContain(servicingLab.id);
        expect(resolved.isOwner(ownerLab.id)).toBe(true);
        expect(resolved.isServicing(servicingLab.id)).toBe(true);
    });
});
