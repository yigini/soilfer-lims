/**
 * Database Cleanup Script
 * ========================
 * Purges non-SoilFER data and resets to clean state.
 * 
 * KEEPS:
 *   - SoilFER projects (SOILFER-US, SOILFER-JPN) and their EXPECTED samples
 *   - Core system users (admin, viewer, master, country lab staff with IDs 100-703)
 *   - Country-specific technicians (tech_gtm through tech_moz)
 *   - marco user
 *   - Labs configuration (not touched)
 *   - Analysis definitions (not touched)
 * 
 * DELETES:
 *   - All non-SoilFER projects (TURSAP, TEST, PORT, etc.)
 *   - All non-EXPECTED SoilFER samples (ACCEPTED, RECEIVED, etc.) + their work items
 *   - All orphan/null-project samples
 *   - All RESTORE:* samples
 *   - All work items, results, audit logs
 *   - All notifications, messages
 *   - All test/auto-generated users (LAB-GOLD, LAB-RED, LAB-BLUE, etc.)
 *   - TURSAP, PORT users
 * 
 * Usage: node server/scripts/cleanup-data.js [--dry-run]
 *        Defaults to DRY RUN. Pass --execute to actually delete.
 */
const prisma = require('../prisma');

const SOILFER_PROJECT_IDS = ['SoilFER-USA', 'SoilFER-JPN'];

// Core users to keep (by ID pattern)
const KEEP_USER_IDS = new Set([
    '1770311018064', // admin
    '2',             // viewer
    '3',             // master
    '100', '101', '102', '103', // GTM
    '200', '201', '202', '203', // HND
    '300', '301', '302', '303', // GHA
    '400', '401', '402', '403', // KEN
    '500', '501', '502', '503', // ZMB
    '600', '601', '602', '603', // TUN
    '700', '701', '702', '703', // MOZ
    '1769913479193', // marco
    '1770306693397', // tech_gtm
    '1770306693262', // tech_hnd
    '1770306692909', // tech_gha
    '1770306692837', // tech_ken
    '1770306692931', // tech_zmb
    '1770306692870', // tech_tun
    '1770306692544', // tech_moz
]);

(async () => {
    const isDryRun = !process.argv.includes('--execute');
    console.log(isDryRun ? '🔍 DRY RUN MODE (pass --execute to apply)' : '🚨 EXECUTE MODE — Changes will be applied!');
    console.log('');

    try {
        // ──────────── 1. Identify non-SoilFER projects ────────────
        const allProjects = await prisma.project.findMany({ select: { id: true, code: true, name: true, status: true } });
        const projectsToDelete = allProjects.filter(p => !SOILFER_PROJECT_IDS.includes(p.id));
        console.log(`=== PROJECTS TO DELETE (${projectsToDelete.length}) ===`);
        projectsToDelete.forEach(p => console.log(`  [${p.status}] ${p.code} "${p.name}" id=${p.id}`));
        const projectIdsToDelete = projectsToDelete.map(p => p.id);

        // ──────────── 2. Identify samples to delete ────────────
        // a) All samples from non-SoilFER projects
        const nonSoilferSamples = await prisma.sample.findMany({
            where: {
                OR: [
                    { projectCode: { in: projectIdsToDelete.map(id => allProjects.find(p => p.id === id)?.code).filter(Boolean) } },
                    { projectCode: { not: { in: ['SOILFER-US', 'SOILFER-JPN'] } } },
                    { projectCode: null },
                ]
            },
            select: { id: true, status: true, projectCode: true }
        });

        // b) SoilFER samples that are NOT EXPECTED (e.g. ACCEPTED, RECEIVED, etc.)
        const nonExpectedSoilfer = await prisma.sample.findMany({
            where: {
                projectCode: { in: ['SOILFER-US', 'SOILFER-JPN'] },
                status: { not: 'EXPECTED' }
            },
            select: { id: true, status: true, projectCode: true }
        });

        const samplesToDelete = [...nonSoilferSamples, ...nonExpectedSoilfer];
        // Deduplicate by ID
        const sampleIdSet = new Set();
        const uniqueSamplesToDelete = samplesToDelete.filter(s => {
            if (sampleIdSet.has(s.id)) return false;
            sampleIdSet.add(s.id);
            return true;
        });

        console.log(`\n=== SAMPLES TO DELETE (${uniqueSamplesToDelete.length}) ===`);
        const byProj = {};
        uniqueSamplesToDelete.forEach(s => { const k = `${s.projectCode || 'null'}|${s.status}`; byProj[k] = (byProj[k] || 0) + 1; });
        Object.entries(byProj).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`));

        const sampleIdsToDelete = [...sampleIdSet];

        // ──────────── 3. Count work items to delete ────────────
        const workItemsToDelete = await prisma.workItem.count();
        console.log(`\n=== WORK ITEMS TO DELETE: ALL ${workItemsToDelete} ===`);

        // ──────────── 4. Identify users to delete ────────────
        const allUsers = await prisma.user.findMany({ select: { id: true, username: true, name: true, role: true, labId: true } });
        const usersToDelete = allUsers.filter(u => !KEEP_USER_IDS.has(String(u.id)));
        console.log(`\n=== USERS TO DELETE (${usersToDelete.length}) ===`);
        usersToDelete.forEach(u => console.log(`  [${u.role}] ${u.username} "${u.name}" lab=${u.labId}`));

        const usersToKeep = allUsers.filter(u => KEEP_USER_IDS.has(String(u.id)));
        console.log(`\n=== USERS TO KEEP (${usersToKeep.length}) ===`);
        usersToKeep.forEach(u => console.log(`  [${u.role}] ${u.username} "${u.name}" lab=${u.labId}`));

        // ──────────── 5. Count other data to delete ────────────
        const resultCount = await prisma.result.count();
        const auditCount = await prisma.auditLog.count();
        const notifCount = await prisma.notification.count();
        const msgCount = await prisma.message.count();
        console.log(`\n=== OTHER DATA TO DELETE ===`);
        console.log(`  Results: ${resultCount}`);
        console.log(`  Audit logs: ${auditCount}`);
        console.log(`  Notifications: ${notifCount}`);
        console.log(`  Messages: ${msgCount}`);

        // ──────────── 6. EXECUTE if not dry run ────────────
        if (isDryRun) {
            console.log('\n⏸️  DRY RUN — no changes made. Run with --execute to apply.');
            await prisma.$disconnect();
            return;
        }

        console.log('\n🚨 EXECUTING CLEANUP...');

        // Delete in dependency order (foreign keys)
        // Step A: Work items first (depend on samples)
        const equipUseCount = await prisma.workItemEquipmentUse.deleteMany({});
        console.log(`  ✓ Deleted ${equipUseCount.count} equipment usage records`);

        const wiDel = await prisma.workItem.deleteMany({});
        console.log(`  ✓ Deleted ${wiDel.count} work items`);

        // Step B: Results
        const resDel = await prisma.result.deleteMany({});
        console.log(`  ✓ Deleted ${resDel.count} results`);

        // Step C: Spectral data for samples being deleted
        try {
            const specDel = await prisma.spectralData.deleteMany({
                where: { labId: { in: sampleIdsToDelete } }
            });
            console.log(`  ✓ Deleted ${specDel.count} spectral data records`);
        } catch (e) { /* table might not exist */ }

        // Step D: Audit logs
        const auditDel = await prisma.auditLog.deleteMany({});
        console.log(`  ✓ Deleted ${auditDel.count} audit logs`);

        // Step E: Notifications & Messages
        const notifDel = await prisma.notification.deleteMany({});
        console.log(`  ✓ Deleted ${notifDel.count} notifications`);

        const msgDel = await prisma.message.deleteMany({});
        console.log(`  ✓ Deleted ${msgDel.count} messages`);

        // Step F: Delete orphan samples (non-SoilFER + non-EXPECTED SoilFER)
        if (sampleIdsToDelete.length > 0) {
            // Batch delete in chunks to avoid SQLite limits
            const chunkSize = 500;
            let deletedSamples = 0;
            for (let i = 0; i < sampleIdsToDelete.length; i += chunkSize) {
                const chunk = sampleIdsToDelete.slice(i, i + chunkSize);
                const del = await prisma.sample.deleteMany({ where: { id: { in: chunk } } });
                deletedSamples += del.count;
            }
            console.log(`  ✓ Deleted ${deletedSamples} samples`);
        }

        // Step G: Reset SoilFER sample statuses - make sure they're all EXPECTED
        const resetSoilfer = await prisma.sample.updateMany({
            where: { projectCode: { in: ['SOILFER-US', 'SOILFER-JPN'] } },
            data: {
                status: 'EXPECTED',
                dryingStatus: 'PENDING',
                preparationStatus: 'PENDING',
                assignedLab: null
            }
        });
        console.log(`  ✓ Reset ${resetSoilfer.count} SoilFER samples to EXPECTED`);

        // Step H: Delete non-SoilFER projects
        if (projectIdsToDelete.length > 0) {
            // Delete project-lab associations first
            try {
                const plDel = await prisma.projectLab.deleteMany({
                    where: { projectId: { in: projectIdsToDelete } }
                });
                console.log(`  ✓ Deleted ${plDel.count} project-lab associations`);
            } catch (e) { /* might not exist */ }

            const projDel = await prisma.project.deleteMany({
                where: { id: { in: projectIdsToDelete } }
            });
            console.log(`  ✓ Deleted ${projDel.count} projects`);
        }

        // Step I: Delete test users
        const userIdsToDelete = usersToDelete.map(u => u.id);
        if (userIdsToDelete.length > 0) {
            const userDel = await prisma.user.deleteMany({
                where: { id: { in: userIdsToDelete.map(String) } }
            });
            console.log(`  ✓ Deleted ${userDel.count} test users`);
        }

        console.log('\n✅ CLEANUP COMPLETE');

        // Quick post-cleanup stats
        const postProjects = await prisma.project.count();
        const postSamples = await prisma.sample.count();
        const postWorkItems = await prisma.workItem.count();
        const postUsers = await prisma.user.count();
        console.log(`\n=== POST-CLEANUP STATS ===`);
        console.log(`  Projects: ${postProjects}`);
        console.log(`  Samples: ${postSamples}`);
        console.log(`  Work Items: ${postWorkItems}`);
        console.log(`  Users: ${postUsers}`);

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await prisma.$disconnect();
    }
})();
