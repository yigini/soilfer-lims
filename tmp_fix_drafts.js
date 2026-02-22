// Temporary script to find and fix corrupted project drafts on production
const prisma = require('./server/prisma');

async function main() {
    const drafts = await prisma.sample.findMany({
        where: { status: 'DRAFT' },
        select: { id: true, originalId: true, projectId: true, projectCode: true, assignedLab: true }
    });

    console.log('Current DRAFT samples:');
    console.log(JSON.stringify(drafts, null, 2));

    // Find project drafts that should be reverted
    const projectDrafts = drafts.filter(d => d.projectId || d.projectCode);
    console.log(`\nProject drafts to revert: ${projectDrafts.length}`);

    for (const d of projectDrafts) {
        console.log(`  Reverting ${d.id} (${d.originalId}) -> EXPECTED`);
        await prisma.sample.update({
            where: { id: d.id },
            data: {
                status: 'EXPECTED',
                receptionData: null,
                requiredAnalyses: null,
                analysisGroupIds: null,
                history: JSON.stringify([{
                    status: 'REVERT_TO_EXPECTED',
                    changedBy: 'SYSTEM_FIX',
                    timestamp: new Date(),
                    note: 'Auto-reverted: project sample was incorrectly set to DRAFT.'
                }])
            }
        });
    }

    console.log('Done.');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
