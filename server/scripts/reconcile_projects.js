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
 * Guarantees per Acceptance Criterion A16:
 * - Read-only / Dry-run by default
 * - Never guesses country-to-lab memberships without explicit mapping
 * - Never guesses or automatically expands grants when junction & legacy JSON conflict (ambiguity unresolved)
 * - Atomic transaction per project on --apply
 * - Emits truthful report with exact counts
 * - Idempotent rerun: repeat is a no-op
 *
 * Usage:
 *   node server/scripts/reconcile_projects.js [--dry-run]
 *   node server/scripts/reconcile_projects.js --apply
 *   node server/scripts/reconcile_projects.js --project=CODE
 */

const defaultPrisma = require('../prisma');

async function reconcileProjects({ isApply = false, targetProjectCode = null, client = defaultPrisma } = {}) {
    const where = targetProjectCode ? { OR: [{ id: targetProjectCode }, { code: targetProjectCode }] } : {};
    const projects = await client.project.findMany({
        where,
        orderBy: { code: 'asc' }
    });

    let totalDiscrepancies = 0;
    let reconciledCount = 0;
    let unresolvedCount = 0;
    const report = [];

    for (const project of projects) {
        const junctions = await client.projectLab.findMany({
            where: { projectCode: project.code }
        });
        const junctionLabIds = junctions.map(j => j.labId);

        let legacyAssignedLabIds = [];
        try {
            legacyAssignedLabIds = project.assignedLabIds ? JSON.parse(project.assignedLabIds) : [];
        } catch {
            legacyAssignedLabIds = [];
        }

        let countries = [];
        try {
            countries = project.countries ? JSON.parse(project.countries) : [];
        } catch {
            countries = [];
        }

        const issues = [];
        const servicingJunctions = junctions.filter(j => j.role === 'SERVICING').map(j => j.labId);

        // Check if explicit empty
        const isExplicitEmpty = Array.isArray(legacyAssignedLabIds) && legacyAssignedLabIds.length === 0 && servicingJunctions.length === 0;

        // Check for country-only legacy record
        const isCountryOnly = countries.length > 0 && legacyAssignedLabIds.length === 0 && junctionLabIds.length === 0;
        if (isCountryOnly) {
            issues.push({
                type: 'COUNTRY_ONLY_LEGACY_RECORD',
                countries,
                unresolved: true,
                action: 'Flagged for administrator review. No automatic country-to-lab grant expansion.'
            });
        }

        // Check for owner lab integrity
        if (project.labId) {
            const ownerLab = await client.lab.findUnique({
                where: { id: project.labId },
                select: { id: true, isActive: true }
            });
            if (!ownerLab) {
                issues.push({
                    type: 'MISSING_OWNER_CONFLICT',
                    ownerLabId: project.labId,
                    unresolved: true,
                    action: 'Owner laboratory does not exist in database. Flagged for review.'
                });
            } else if (!ownerLab.isActive) {
                issues.push({
                    type: 'INACTIVE_OWNER_CONFLICT',
                    ownerLabId: project.labId,
                    unresolved: true,
                    action: 'Owner laboratory is inactive. Flagged for review.'
                });
            } else if (!junctionLabIds.includes(project.labId)) {
                issues.push({
                    type: 'OWNER_LAB_NOT_IN_JUNCTION',
                    ownerLabId: project.labId,
                    unresolved: false,
                    action: 'Insert owner ProjectLab record with role OWNER'
                });
            }
        } else {
            issues.push({
                type: 'MISSING_OWNER_CONFLICT',
                unresolved: true,
                action: 'Project has no coordinating owner laboratory. Flagged for review.'
            });
        }

        // Evaluate Servicing Membership: Junction vs Legacy JSON
        const missingInJunction = legacyAssignedLabIds.filter(id => !servicingJunctions.includes(id));
        const missingInAssigned = servicingJunctions.filter(id => !legacyAssignedLabIds.includes(id));

        if (servicingJunctions.length > 0) {
            // Authoritative junction exists
            if (missingInJunction.length > 0 || missingInAssigned.length > 0) {
                // Any mismatch between authoritative junction and legacy JSON is treated as ambiguity conflict
                // Stale superset (e.g. junction has B, legacy has B,C) must NEVER grant C
                issues.push({
                    type: 'UNRESOLVED_AMBIGUITY_CONFLICT',
                    subtype: missingInJunction.length > 0 && missingInAssigned.length === 0 ? 'STALE_SUPERSET_CONFLICT' : 'MEMBERSHIP_MISMATCH_CONFLICT',
                    junctionLabs: servicingJunctions,
                    legacyLabs: legacyAssignedLabIds,
                    missingInJunction,
                    missingInAssigned,
                    unresolved: true,
                    action: 'Ambiguity unresolved. Do not automatically guess or expand grants.'
                });
            }
        } else if (legacyAssignedLabIds.length > 0) {
            // Junction has 0 servicing records; unmigrated legacy project
            // Check if all legacy labs exist and are active
            const targetLabs = await client.lab.findMany({
                where: { id: { in: legacyAssignedLabIds } },
                select: { id: true, isActive: true }
            });
            const foundIds = targetLabs.map(l => l.id);
            const missingLabs = legacyAssignedLabIds.filter(id => !foundIds.includes(id));
            const inactiveLabs = targetLabs.filter(l => !l.isActive).map(l => l.id);

            if (missingLabs.length > 0 || inactiveLabs.length > 0) {
                issues.push({
                    type: 'INACTIVE_OR_MISSING_LAB_CONFLICT',
                    missingLabs,
                    inactiveLabs,
                    unresolved: true,
                    action: 'Cannot grant servicing membership to inactive or non-existent laboratories. Flagged for review.'
                });
            } else {
                issues.push({
                    type: 'UNMIGRATED_LEGACY_SERVICING_LABS',
                    labs: legacyAssignedLabIds,
                    unresolved: false,
                    action: 'Migrate legacy assignedLabIds to ProjectLab junction records'
                });
            }
        }

        // Count samples
        const sampleCount = await client.sample.count({
            where: { OR: [{ projectId: project.id }, { projectCode: project.code }] }
        });

        if (issues.length > 0) {
            totalDiscrepancies++;
            const hasUnresolved = issues.some(i => i.unresolved);
            if (hasUnresolved) {
                unresolvedCount++;
            }

            if (isApply && !hasUnresolved) {
                await client.$transaction(async (tx) => {
                    const unmigratedIssue = issues.find(i => i.type === 'UNMIGRATED_LEGACY_SERVICING_LABS');
                    const labsToCreate = unmigratedIssue ? unmigratedIssue.labs : [];

                    for (const addId of labsToCreate) {
                        await tx.projectLab.create({
                            data: {
                                id: `pl-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                                projectCode: project.code,
                                labId: addId,
                                role: 'SERVICING'
                            }
                        });
                    }

                    const ownerIssue = issues.find(i => i.type === 'OWNER_LAB_NOT_IN_JUNCTION');
                    if (ownerIssue) {
                        await tx.projectLab.create({
                            data: {
                                id: `pl-rec-owner-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                                projectCode: project.code,
                                labId: ownerIssue.ownerLabId,
                                role: 'OWNER'
                            }
                        });
                    }

                    const finalServicing = labsToCreate.length > 0 ? labsToCreate : servicingJunctions;
                    await tx.project.update({
                        where: { id: project.id },
                        data: { assignedLabIds: JSON.stringify(finalServicing) }
                    });

                    await tx.auditLog.create({
                        data: {
                            id: `audit-reconcile-${project.id}-${Date.now()}`,
                            entity: 'PROJECT',
                            entityId: project.id,
                            action: 'MEMBERSHIP_RECONCILED',
                            details: `Reconciled membership by reconcile_projects script. Canonical servicing: [${finalServicing.join(', ')}]`,
                            performedBy: 'SYSTEM_RECONCILE',
                            timestamp: new Date()
                        }
                    });
                });
                reconciledCount++;
            }
            report.push({ project: project.code, issues, sampleCount, hasUnresolved });
        }
    }

    return {
        scannedProjects: projects.length,
        totalDiscrepancies,
        reconciledCount,
        unresolvedCount,
        report
    };
}

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

    const res = await reconcileProjects({ isApply, targetProjectCode });

    console.log(`Found ${res.scannedProjects} project(s) to inspect.\n`);

    for (const r of res.report) {
        console.log(`[!] Project ${r.project} — ${r.issues.length} issue(s) [${r.sampleCount} sample(s)]`);
        for (const iss of r.issues) {
            console.log(`    - ${iss.type}: ${iss.labs ? iss.labs.join(', ') : iss.ownerLabId || iss.detail || ''} -> ${iss.action}`);
        }
        if (isApply && !r.hasUnresolved) {
            console.log(`    --> Reconciled successfully.`);
        } else if (r.hasUnresolved) {
            console.log(`    --> [ATTENTION] Kept unresolved per governance policy.`);
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`  RECONCILIATION SUMMARY`);
    console.log(`  Total Projects Scanned: ${res.scannedProjects}`);
    console.log(`  Projects with Discrepancies: ${res.totalDiscrepancies}`);
    console.log(`  Unresolved Ambiguities/Country-only: ${res.unresolvedCount}`);
    if (isApply) {
        console.log(`  Projects Reconciled: ${res.reconciledCount}`);
    } else {
        console.log(`  Action: Dry-run only. No database modifications made.`);
        console.log(`  To apply unambiguous fixes, rerun with --apply`);
    }
    console.log('='.repeat(70) + '\n');
}

if (require.main === module) {
    main()
        .catch((err) => {
            console.error('Fatal error during reconciliation:', err);
            process.exitCode = 1;
        })
        .finally(async () => {
            await defaultPrisma.$disconnect();
        });
}

module.exports = {
    reconcileProjects,
    main
};
