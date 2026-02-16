const prisma = require('../prisma');

(async () => {
    try {
        const projects = await prisma.project.findMany({
            select: {
                id: true, code: true, name: true, status: true,
                _count: { select: { samples: true } }
            }
        });
        console.log('=== PROJECTS ===');
        projects.forEach(p => {
            console.log(`  [${p.status}] ${p.code} - "${p.name}" (${p._count.samples} samples) id=${p.id}`);
        });

        const samples = await prisma.sample.findMany({
            select: { id: true, status: true, projectCode: true, labId: true }
        });
        console.log('\n=== SAMPLES BY PROJECT+STATUS ===');
        const sc = {};
        samples.forEach(s => { const k = `${s.projectCode}|${s.status}`; sc[k] = (sc[k] || 0) + 1; });
        Object.entries(sc).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`));

        const wiCount = await prisma.workItem.count();
        console.log(`\n=== WORK ITEMS: ${wiCount} ===`);

        // Work items by sample projectCode
        const workItems = await prisma.workItem.findMany({
            select: { id: true, sampleId: true, status: true, analysis: true }
        });
        const sampleMap = {};
        samples.forEach(s => sampleMap[s.id] = s.projectCode);
        const wiByProj = {};
        workItems.forEach(wi => {
            const proj = sampleMap[wi.sampleId] || 'UNKNOWN';
            wiByProj[proj] = (wiByProj[proj] || 0) + 1;
        });
        console.log('  By project:');
        Object.entries(wiByProj).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

        const users = await prisma.user.findMany({
            select: { id: true, username: true, name: true, role: true, labId: true, isActive: true }
        });
        console.log('\n=== USERS ===');
        users.forEach(u => console.log(`  [${u.role}] ${u.username} - "${u.name}" lab=${u.labId} active=${u.isActive} id=${u.id}`));

        const rc = await prisma.result.count();
        const ac = await prisma.auditLog.count();
        const nc = await prisma.notification.count();
        const mc = await prisma.message.count();
        console.log(`\n=== COUNTS: results=${rc} audits=${ac} notifs=${nc} msgs=${mc} ===`);

        // Samples with null projectCode
        const nullSamples = samples.filter(s => !s.projectCode);
        if (nullSamples.length > 0) {
            console.log('\n=== NULL-PROJECT SAMPLES ===');
            nullSamples.forEach(s => console.log(`  ${s.id} status=${s.status} lab=${s.labId}`));
        }

        // RESTORE: samples
        const restoreSamples = samples.filter(s => s.projectCode && s.projectCode.startsWith('RESTORE:'));
        if (restoreSamples.length > 0) {
            console.log(`\n=== RESTORE SAMPLES: ${restoreSamples.length} ===`);
            console.log(`  First 5 IDs: ${restoreSamples.slice(0, 5).map(s => s.id).join(', ')}`);
        }

    } catch (err) {
        console.error('Error:', err.message || err);
    } finally {
        await prisma.$disconnect();
    }
})();
