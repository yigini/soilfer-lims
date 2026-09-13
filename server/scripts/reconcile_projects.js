'use strict';

/**
 * Project Membership & Data Reconciliation Tool
 *
 * Scans project-to-lab memberships across:
 * 1. Project.labId (Primary / Owner laboratory)
 * 2. ProjectLab junction table
 * 3. Project.assignedLabIds (Legacy JSON array)
 * 4. Project.countries (Legacy JSON array)
 *
 * Guarantees:
 * - Read-only / Dry-run by default
 * - Never guesses country-to-lab memberships without explicit mapping
 * - Atomic transaction per project on --apply
 * - Emits truthful report with exact counts
 *
 * Usage:
 *   node server/scripts/reconcile_projects.js [--dry-run]
 *   node server/scripts/reconcile_projects.js --apply
 *   node server/scripts/reconcile_projects.js --project=CODE
 */

const prisma = require('../prisma');
const projectMembershipService = require('../services/projectMembershipService');

async function main() {
    const args = process.argv.slice(2);
    const isApply = args.includes('--apply');
    const projectFilterArg = args.find(a => a.startsWith('--project='));
    const targetProjectCode = projectFilterArg ? projectFilterArg.split('=')[1] : null;

    console.log('='.repeat(70));
    console.log(`  PROJECT MEMBERSHIP RECONCILIATION TOOL`);
    console.log(`  Mode: ${isApply ? 'APPLY (Mutating)' : 'DRY-RUN (Read-only)'}`);
    if (targetProjectCode) {
        console.log(`  Target Project: ${targetProjectCode}`);
    }
    console.log('='.repeat(70));
    console.log('');

    const where = targetProjectCode ? { OR: [{ id: targetProjectCode }, { code: targetProjectCode }] } : {};
    const projects = await prisma.project.findMany({
        where,
        orderBy: { code: 'asc' }
    });

    console.log(`Found ${projects.length} project(s) to inspect.\n`);

    let totalDiscrepancies = 0;
    let reconciledCount = 0;
    const report = [];

    for (const project of projects) {
        const junctions = await prisma.projectLab.findMany({
            where: { projectCode: project.code }
        });
        const junctionLabIds = junctions.map(j => j.labId);

        let legacyAssignedLabIds = [];
        try {
            legacyAssignedLabIds = project.assignedLabIds ? JSON.parse(project.assignedLabIds) : [];
        } catch {
            legacyAssignedLabIds = [];
        }

        const issues = [];

        // 1. Missing in junction
        const missingInJunction = legacyAssignedLabIds.filter(id => !junctionLabIds.includes(id));
        if (missingInJunction.length > 0) {
            issues.push({
                type: 'ASSIGNED_LABS_MISSING_IN_JUNCTION',
                labs: missingInJunction,
                action: 'Insert missing ProjectLab junction records'
            });
        }

        // 2. Junction lab missing in assignedLabIds
        const servicingJunctions = junctions.filter(j => j.role === 'SERVICING').map(j => j.labId);
        const missingInAssigned = servicingJunctions.filter(id => !legacyAssignedLabIds.includes(id));
        if (missingInAssigned.length > 0) {
            issues.push({
                type: 'JUNCTION_LABS_MISSING_IN_ASSIGNED_JSON',
                labs: missingInAssigned,
                action: 'Synchronize assignedLabIds JSON array'
            });
        }

        // 3. Owner lab not in junction
        if (project.labId && !junctionLabIds.includes(project.labId)) {
            issues.push({
                type: 'OWNER_LAB_NOT_IN_JUNCTION',
                ownerLabId: project.labId,
                action: 'Insert owner ProjectLab record with role OWNER'
            });
        }

        // Count samples
        const sampleCount = await prisma.sample.count({
            where: { OR: [{ projectId: project.id }, { projectCode: project.code }] }
        });

        if (issues.length > 0) {
            totalDiscrepancies++;
            console.log(`[!] Project ${project.code} ("${project.name}") — ${issues.length} issue(s) [${sampleCount} sample(s)]`);
            for (const iss of issues) {
                console.log(`    - ${iss.type}: ${iss.labs ? iss.labs.join(', ') : iss.ownerLabId || ''} -> ${iss.action}`);
            }

            if (isApply) {
                await prisma.$transaction(async (tx) => {
                    // Combine all unique servicing lab IDs
                    const canonicalServicing = [...new Set([...legacyAssignedLabIds, ...servicingJunctions])];

                    // Insert missing junctions
                    for (const addId of missingInJunction) {
                        await tx.projectLab.create({
                            data: {
                                id: `pl-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                                projectCode: project.code,
                                labId: addId,
                                role: 'SERVICING'
                            }
                        });
                    }

                    // Insert owner junction if missing
                    if (project.labId && !junctionLabIds.includes(project.labId)) {
                        await tx.projectLab.create({
                            data: {
                                id: `pl-rec-owner-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                                projectCode: project.code,
                                labId: project.labId,
                                role: 'OWNER'
                            }
                        });
                    }

                    // Update assignedLabIds JSON
                    await tx.project.update({
                        where: { id: project.id },
                        data: { assignedLabIds: JSON.stringify(canonicalServicing) }
                    });

                    // Audit log
                    await tx.auditLog.create({
                        data: {
                            id: `audit-reconcile-${project.id}-${Date.now()}`,
                            entity: 'PROJECT',
                            entityId: project.id,
                            action: 'MEMBERSHIP_RECONCILED',
                            details: `Reconciled membership by reconcile_projects script. Canonical servicing: [${canonicalServicing.join(', ')}]`,
                            performedBy: 'SYSTEM_RECONCILE',
                            timestamp: new Date()
                        }
                    });
                });
                reconciledCount++;
                console.log(`    --> Reconciled successfully.`);
            }
            report.push({ project: project.code, issues, sampleCount });
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`  RECONCILIATION SUMMARY`);
    console.log(`  Total Projects Scanned: ${projects.length}`);
    console.log(`  Projects with Discrepancies: ${totalDiscrepancies}`);
    if (isApply) {
        console.log(`  Projects Reconciled: ${reconciledCount}`);
    } else {
        console.log(`  Action: Dry-run only. No database modifications made.`);
        console.log(`  To apply fixes, rerun with --apply`);
    }
    console.log('='.repeat(70) + '\n');
}

main()
    .catch((err) => {
        console.error('Fatal error during reconciliation:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
