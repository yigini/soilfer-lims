const prisma = require('../prisma');
(async () => {
    try {
        // Check a sample of labId values
        const samples = await prisma.sample.findMany({
            take: 10,
            select: { id: true, labId: true, assignedLab: true, projectCode: true, status: true, country: true }
        });
        console.log('=== FIRST 10 SAMPLES ===');
        samples.forEach(s => console.log(`  ${s.id}: labId="${s.labId}" assignedLab="${s.assignedLab}" proj=${s.projectCode} country=${s.country}`));

        // Check distinct labId values
        const distinctLabIds = await prisma.sample.findMany({
            distinct: ['labId'],
            select: { labId: true },
            take: 30
        });
        console.log('\n=== DISTINCT labId VALUES ===');
        distinctLabIds.forEach(r => console.log(`  "${r.labId}"`));

        // Check distinct assignedLab values
        const distinctAssigned = await prisma.sample.findMany({
            distinct: ['assignedLab'],
            select: { assignedLab: true },
            take: 30
        });
        console.log('\n=== DISTINCT assignedLab VALUES ===');
        distinctAssigned.forEach(r => console.log(`  "${r.assignedLab}"`));

        // How many samples have a lab-like labId?
        const realLabs = ['GTM-LAB1', 'HND-LAB1', 'GHA-LAB1', 'KEN-LAB1', 'ZMB-LAB1', 'TUN-LAB1', 'MOZ-LAB1'];
        for (const lab of realLabs) {
            const c = await prisma.sample.count({ where: { OR: [{ labId: lab }, { assignedLab: lab }] } });
            if (c > 0) console.log(`  ${lab}: ${c} samples`);
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
})();
