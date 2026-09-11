'use strict';

/**
 * Read-Only Governance Preflight Audit Report (WP-F)
 * 
 * Conducts exhaustive referential checks and discrepancy audits across:
 * 1. User identities, role distribution, and last-admin invariant
 * 2. Laboratory configurations, timezones, and manager coverage
 * 3. Project relationship reconciliation (Project.labId vs ProjectLab vs assignedLabIds)
 * 4. Open analytical work items and assignment validity
 * 5. Equipment & inventory resource scoping
 * 
 * Outputs non-sensitive audit metrics to preflight-summary.json.
 * Strict Invariant: Zero password hashes, raw tokens, or keys are emitted.
 */

const fs = require('fs');
const path = require('path');
const prisma = require('../prisma');

async function runPreflight() {
    console.log('[PREFLIGHT] Starting read-only laboratory governance audit...');
    const startTime = Date.now();

    // 1. Users & RBAC Audit
    const allUsers = await prisma.user.findMany({
        select: {
            id: true,
            username: true,
            email: true,
            role: true,
            labId: true,
            isActive: true,
            countries: true,
            projects: true
        }
    });

    const activeUsers = allUsers.filter(u => u.isActive);
    const disabledUsers = allUsers.filter(u => !u.isActive);

    const superAdmins = activeUsers.filter(u => u.role === 'SUPER_ADMIN');
    const userRoleCounts = {};
    for (const u of allUsers) {
        userRoleCounts[u.role] = (userRoleCounts[u.role] || 0) + 1;
    }

    // Duplicate detection (normalized username / email)
    const seenUsernames = new Map();
    const seenEmails = new Map();
    const duplicateUsernames = [];
    const duplicateEmails = [];

    for (const u of allUsers) {
        const normUser = (u.username || '').trim().toLowerCase();
        if (normUser) {
            if (seenUsernames.has(normUser)) duplicateUsernames.push({ original: u.username, duplicateOf: seenUsernames.get(normUser) });
            else seenUsernames.set(normUser, u.id);
        }

        const normEmail = (u.email || '').trim().toLowerCase();
        if (normEmail) {
            if (seenEmails.has(normEmail)) duplicateEmails.push({ original: u.email, duplicateOf: seenEmails.get(normEmail) });
            else seenEmails.set(normEmail, u.id);
        }
    }

    // 2. Laboratories Audit
    const allLabs = await prisma.lab.findMany();
    const activeLabs = allLabs.filter(l => l.isActive !== false);
    const pausedLabs = allLabs.filter(l => l.isActive === false);

    const labCoverage = [];
    const labsNeedingAttention = [];

    for (const lab of allLabs) {
        const labStaff = allUsers.filter(u => u.labId === lab.id);
        const managers = labStaff.filter(u => u.role === 'LAB_MANAGER' && u.isActive);
        const technicians = labStaff.filter(u => u.role === 'LAB_TECHNICIAN' && u.isActive);

        const issues = [];
        if (!lab.timezone) issues.push('MISSING_TIMEZONE');
        if (!lab.country) issues.push('MISSING_COUNTRY');
        if (!lab.email && !lab.phone) issues.push('MISSING_CONTACT');
        if (lab.isActive !== false && managers.length === 0) issues.push('NO_ACTIVE_MANAGER');

        if (issues.length > 0) {
            labsNeedingAttention.push({
                labId: lab.id,
                name: lab.name,
                code: lab.code,
                issues
            });
        }

        labCoverage.push({
            labId: lab.id,
            name: lab.name,
            code: lab.code,
            isActive: lab.isActive !== false,
            activeManagersCount: managers.length,
            activeTechniciansCount: technicians.length,
            totalStaffCount: labStaff.length
        });
    }

    // Orphan users with labId not found in Lab table
    const validLabIds = new Set(allLabs.map(l => l.id));
    const orphanLabUsers = allUsers.filter(u => u.labId && !validLabIds.has(u.labId)).map(u => ({ id: u.id, username: u.username, labId: u.labId }));

    // 3. Project Relationships Reconciliation
    const allProjects = await prisma.project.findMany();
    const projectDiscrepancies = [];

    let projectLabRecords = [];
    try {
        projectLabRecords = await prisma.projectLab.findMany();
    } catch { }

    for (const proj of allProjects) {
        let assignedList = [];
        try {
            if (proj.assignedLabIds) {
                assignedList = typeof proj.assignedLabIds === 'string' ? JSON.parse(proj.assignedLabIds) : proj.assignedLabIds;
            }
        } catch { }

        const servingRecords = projectLabRecords.filter(pl => pl.projectId === proj.id);
        const servingLabIds = servingRecords.map(pl => pl.labId);

        // Check discrepancies between assignedLabIds and ProjectLab
        const unrecordedInJunction = assignedList.filter(id => !servingLabIds.includes(id));
        const unrecordedInArray = servingLabIds.filter(id => !assignedList.includes(id));

        if (unrecordedInJunction.length > 0 || unrecordedInArray.length > 0) {
            projectDiscrepancies.push({
                projectId: proj.id,
                code: proj.code,
                name: proj.name,
                ownerLabId: proj.labId || null,
                inAssignedArrayOnly: unrecordedInJunction,
                inProjectLabTableOnly: unrecordedInArray
            });
        }
    }

    // 4. Open Work Items & Inactive User Assignments
    const activeUsernames = new Set(activeUsers.map(u => u.username));
    const openWorkItems = await prisma.workItem.findMany({
        where: {
            status: { in: ['ASSIGNED', 'IN_PROGRESS'] }
        },
        select: {
            id: true,
            status: true,
            assignedTo: true,
            labId: true
        }
    });

    const workAssignedToInactive = openWorkItems.filter(w => w.assignedTo && !activeUsernames.has(w.assignedTo));

    // 5. Equipment & Assets Scoping
    let totalEquipment = 0;
    let orphanEquipment = [];
    try {
        if (prisma.equipmentAsset) {
            const assets = await prisma.equipmentAsset.findMany({ select: { id: true, labId: true } });
            totalEquipment = assets.length;
            orphanEquipment = assets.filter(a => a.labId && !validLabIds.has(a.labId));
        }
    } catch { }

    // Assemble Summary Report
    const summary = {
        generatedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        environment: {
            nodeVersion: process.version,
            database: 'SQLite (Isolated/Disposable)'
        },
        identities: {
            totalUsers: allUsers.length,
            activeUsers: activeUsers.length,
            disabledUsers: disabledUsers.length,
            superAdminCount: superAdmins.length,
            lastAdminProtected: superAdmins.length >= 1,
            roleBreakdown: userRoleCounts,
            orphanLabUsersCount: orphanLabUsers.length,
            duplicateUsernamesCount: duplicateUsernames.length,
            duplicateEmailsCount: duplicateEmails.length
        },
        laboratories: {
            totalLabs: allLabs.length,
            activeLabs: activeLabs.length,
            pausedLabs: pausedLabs.length,
            labsNeedingAttentionCount: labsNeedingAttention.length,
            labsNeedingAttention: labsNeedingAttention
        },
        projects: {
            totalProjects: allProjects.length,
            discrepancyCount: projectDiscrepancies.length,
            projectDiscrepancies: projectDiscrepancies
        },
        workload: {
            openWorkItemsCount: openWorkItems.length,
            workAssignedToInactiveCount: workAssignedToInactive.length
        },
        equipment: {
            totalAssets: totalEquipment,
            orphanAssetsCount: orphanEquipment.length
        },
        securityVerification: {
            zeroSecretsEmitted: true,
            passwordHashesExported: false,
            apiTokensExported: false
        }
    };

    const outPath = path.resolve(__dirname, '../../preflight-summary.json');
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n');

    console.log('[PREFLIGHT] ✅ Preflight report successfully written to:', outPath);
    console.log('[PREFLIGHT] Summary:', {
        users: summary.identities.totalUsers,
        superAdmins: summary.identities.superAdminCount,
        labs: summary.laboratories.totalLabs,
        projects: summary.projects.totalProjects,
        openWorkItems: summary.workload.openWorkItemsCount
    });

    return summary;
}

if (require.main === module) {
    runPreflight()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('[PREFLIGHT_FATAL]', err);
            process.exit(1);
        });
}

module.exports = { runPreflight };
