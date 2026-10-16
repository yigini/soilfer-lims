const prisma = require('../prisma');

const LAB_MAPPING = {
    'GTM': 'GTM-LAB1',
    'HND': 'HND-LAB1',
    'GHA': 'GHA-LAB1',
    'KEN': 'KEN-LAB1',
    'ZMB': 'ZMB-LAB1',
    'TUN': 'TUN-LAB1',
    'MOZ': 'MOZ-LAB1',
    'AFG': 'AFG-LAB1',
    'PER': 'PER-LAB1',
    'UGA': 'UGA-LAB1',
    'BGD': 'BGD-LAB1'
};

(async () => {
    const isDryRun = !process.argv.includes('--execute');
    console.log(isDryRun ? '🔍 DRY RUN' : '🚨 EXECUTE MODE');

    try {
        for (const [country, labId] of Object.entries(LAB_MAPPING)) {
            const count = await prisma.sample.count({
                where: { country, labId: null }
            });
            if (count > 0) {
                console.log(`  ${country} → ${labId}: ${count} samples`);
                if (!isDryRun) {
                    const result = await prisma.sample.updateMany({
                        where: { country, labId: null },
                        data: { labId }
                    });
                    console.log(`    ✓ Updated ${result.count}`);
                }
            }
        }

        // Post-update check
        if (!isDryRun) {
            const stillNull = await prisma.sample.count({ where: { labId: null } });
            console.log(`\n=== Samples still with labId=null: ${stillNull} ===`);
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
})();
