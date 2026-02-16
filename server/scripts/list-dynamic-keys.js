require('dotenv').config();
const prisma = require('../prisma');

async function main() {
    const keys = {};

    // 1. Analyses
    const analyses = await prisma.analysis.findMany({ select: { code: true, name: true, description: true } });
    analyses.forEach(a => {
        keys[`dynamic.analysis.${a.code}.name`] = a.name;
        if (a.description) keys[`dynamic.analysis.${a.code}.description`] = a.description;
    });

    // 2. Operational Gates
    const gates = await prisma.operationalGate.findMany({ select: { code: true, name: true } });
    gates.forEach(g => {
        keys[`dynamic.gate.${g.code}.name`] = g.name;
    });

    // 3. Analysis Categories
    const categories = await prisma.analysisCategory.findMany({ select: { id: true, name: true } });
    categories.forEach(c => {
        keys[`dynamic.category.${c.id}.name`] = c.name;
    });

    // 4. Equipment Types
    const equipmentTypes = await prisma.equipmentAsset.findMany({
        distinct: ['assetType'],
        select: { assetType: true }
    });
    equipmentTypes.forEach(e => {
        keys[`dynamic.equipmentType.${e.assetType}.label`] = e.assetType;
    });

    // 5. Analysis Statuses (hardcoded)
    const statuses = ['EXPECTED', 'RECEIVED', 'ACCEPTED', 'PROCESSING', 'DONE', 'FAILED', 'ARCHIVED'];
    statuses.forEach(s => {
        keys[`dynamic.status.${s}.label`] = s;
    });

    console.log(JSON.stringify(keys, null, 2));
    console.log(`\nTotal dynamic keys: ${Object.keys(keys).length}`);

    // Also check existing Language records
    const languages = await prisma.language.findMany();
    console.log('\nLanguage records in DB:');
    languages.forEach(l => {
        const overrideCount = l.translations ? Object.keys(JSON.parse(l.translations)).length : 0;
        console.log(`  ${l.code} (${l.name}) - default: ${l.isDefault} - overrides: ${overrideCount}`);
    });
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
