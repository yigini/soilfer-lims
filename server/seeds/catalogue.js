const fs = require('fs');
const path = require('path');
const prisma = require('../prisma');

/**
 * SoilFER-LIMS Analysis Catalogue Seeder (WP-19)
 * 
 * Ingests 214 standard analyses and ~430 methodologies.
 * Follows strict match-preservation rules:
 * - A clean database directly seeds all 214 analyses.
 * - An existing database produces a match report and changes nothing unless confirmed.
 * - Local unmatched analyses are marked with isGlobal: false.
 * - Environmental module parameters ship disabled (status: 'inactive').
 */
async function seedCatalogue(options = {}) {
    const { confirmMatches = false, forceClean = false } = options;
    const cataloguePath = path.join(__dirname, 'data', 'catalogue.json');

    if (!fs.existsSync(cataloguePath)) {
        throw new Error(`Catalogue data file not found at ${cataloguePath}`);
    }

    const catalogueData = JSON.parse(fs.readFileSync(cataloguePath, 'utf8'));
    const { categories, analyses, methodologies } = catalogueData;

    // Check existing analyses count in the database
    const existingAnalyses = await prisma.analysis.findMany();
    const isCleanDb = existingAnalyses.length === 0 || forceClean;

    console.log(`[Catalogue Seed] Database has ${existingAnalyses.length} existing analyses.`);

    // ── CASE 1: CLEAN DATABASE ──
    if (isCleanDb) {
        console.log(`[Catalogue Seed] Seeding clean database with ${analyses.length} standard analyses...`);

        // 1. Seed categories
        for (const cat of categories) {
            await prisma.analysisCategory.upsert({
                where: { id: cat.id },
                update: { name: cat.name },
                create: { id: cat.id, name: cat.name }
            });
        }

        // 2. Seed analyses
        for (const a of analyses) {
            await prisma.analysis.upsert({
                where: { code: a.code },
                update: {
                    name: a.name,
                    description: a.description,
                    categoryId: a.categoryId,
                    units: a.units,
                    unitCode: a.unitCode,
                    matrix: a.matrix,
                    module: a.module,
                    status: a.status,
                    isGlobal: true,
                    decimalPlaces: a.decimalPlaces,
                    validation: a.validation ? JSON.stringify(a.validation) : null
                },
                create: {
                    code: a.code,
                    name: a.name,
                    description: a.description,
                    categoryId: a.categoryId,
                    units: a.units,
                    unitCode: a.unitCode,
                    matrix: a.matrix,
                    module: a.module,
                    status: a.status,
                    isGlobal: true,
                    decimalPlaces: a.decimalPlaces,
                    validation: a.validation ? JSON.stringify(a.validation) : null
                }
            });
        }

        // 3. Seed methodologies
        for (const m of methodologies) {
            await prisma.methodology.upsert({
                where: { id: m.id },
                update: {
                    name: m.name,
                    standard: m.standard,
                    referenceId: m.referenceId,
                    isDefault: m.isDefault,
                    glosisProcedure: m.glosisProcedure,
                    glosisDefinition: m.glosisDefinition
                },
                create: {
                    id: m.id,
                    analysisCode: m.analysisCode,
                    name: m.name,
                    standard: m.standard,
                    referenceId: m.referenceId,
                    isDefault: m.isDefault,
                    glosisProcedure: m.glosisProcedure,
                    glosisDefinition: m.glosisDefinition
                }
            });
        }

        console.log(`[Catalogue Seed] ✓ Clean seeding complete: ${analyses.length} analyses, ${methodologies.length} methodologies.`);
        return {
            isCleanDb: true,
            seededCount: analyses.length,
            methodologiesCount: methodologies.length,
            changesApplied: true,
            matchReport: null
        };
    }

    // ── CASE 2: EXISTING DATABASE (MATCH REPORT & SAFE MERGE) ──
    const catalogueMap = new Map(analyses.map(a => [a.code.toUpperCase(), a]));
    const existingMap = new Map(existingAnalyses.map(a => [a.code.toUpperCase(), a]));

    const matched = [];
    const newToSeed = [];
    const localUnmatched = [];

    // Check existing analyses against catalogue
    for (const [upperCode, existing] of existingMap.entries()) {
        if (catalogueMap.has(upperCode)) {
            const cat = catalogueMap.get(upperCode);
            matched.push({
                code: existing.code,
                existingName: existing.name,
                catalogueName: cat.name,
                existingMatrix: existing.matrix,
                catalogueMatrix: cat.matrix,
                existingModule: existing.module,
                catalogueModule: cat.module,
                status: 'PROPOSED_PAIRING'
            });
        } else {
            localUnmatched.push({
                code: existing.code,
                name: existing.name,
                status: 'LOCAL_ANALYSIS_UNMATCHED'
            });
        }
    }

    // Identify new catalogue analyses to be added
    for (const [upperCode, cat] of catalogueMap.entries()) {
        if (!existingMap.has(upperCode)) {
            newToSeed.push({
                code: cat.code,
                name: cat.name,
                matrix: cat.matrix,
                module: cat.module,
                status: 'NEW_STANDARD_ANALYSIS'
            });
        }
    }

    const matchReport = {
        totalExisting: existingAnalyses.length,
        totalCatalogue: analyses.length,
        matchedCount: matched.length,
        newToSeedCount: newToSeed.length,
        localUnmatchedCount: localUnmatched.length,
        matched,
        newToSeed,
        localUnmatched
    };

    console.log('\n--- CATALOGUE MATCH REPORT ---');
    console.log(`Existing Analyses in DB: ${existingAnalyses.length}`);
    console.log(`Catalogue Standard Analyses: ${analyses.length}`);
    console.log(`Matched (Proposed Pairings): ${matched.length}`);
    console.log(`New Analyses to Add: ${newToSeed.length}`);
    console.log(`Local Unmatched Analyses: ${localUnmatched.length}`);

    // If confirmation has not been given, change nothing and return the report
    if (!confirmMatches) {
        console.log('[Catalogue Seed] confirmation required: Changes withheld without human confirmation.');
        return {
            isCleanDb: false,
            changesApplied: false,
            seededCount: 0,
            matchReport
        };
    }

    // If confirmed, apply updates safely:
    console.log('[Catalogue Seed] Confirmation received. Applying safe updates...');

    // 1. Mark local unmatched analyses with isGlobal: false
    for (const local of localUnmatched) {
        await prisma.analysis.update({
            where: { code: local.code },
            data: { isGlobal: false }
        });
    }

    // 2. Ensure all categories exist
    for (const cat of categories) {
        await prisma.analysisCategory.upsert({
            where: { id: cat.id },
            update: { name: cat.name },
            create: { id: cat.id, name: cat.name }
        });
    }

    // 3. Seed new analyses from catalogue
    for (const item of newToSeed) {
        const a = catalogueMap.get(item.code.toUpperCase());
        await prisma.analysis.create({
            data: {
                code: a.code,
                name: a.name,
                description: a.description,
                categoryId: a.categoryId,
                units: a.units,
                unitCode: a.unitCode,
                matrix: a.matrix,
                module: a.module,
                status: a.status,
                isGlobal: true,
                decimalPlaces: a.decimalPlaces,
                validation: a.validation ? JSON.stringify(a.validation) : null
            }
        });
    }

    // 4. Update matched analyses without overwriting custom names/descriptions if present
    for (const m of matched) {
        const cat = catalogueMap.get(m.code.toUpperCase());
        await prisma.analysis.update({
            where: { code: m.code },
            data: {
                isGlobal: true,
                matrix: cat.matrix,
                module: cat.module,
                unitCode: cat.unitCode,
                decimalPlaces: cat.decimalPlaces
            }
        });
    }

    // 5. Seed missing methodologies
    for (const m of methodologies) {
        const existingMeth = await prisma.methodology.findUnique({
            where: { id: m.id }
        });
        if (!existingMeth) {
            // Verify that the analysis exists
            const analysisExists = await prisma.analysis.findUnique({
                where: { code: m.analysisCode }
            });
            if (analysisExists) {
                await prisma.methodology.create({
                    data: {
                        id: m.id,
                        analysisCode: m.analysisCode,
                        name: m.name,
                        standard: m.standard,
                        referenceId: m.referenceId,
                        isDefault: m.isDefault,
                        glosisProcedure: m.glosisProcedure,
                        glosisDefinition: m.glosisDefinition
                    }
                });
            }
        }
    }

    console.log('[Catalogue Seed] ✓ Successfully updated database with catalogue standards.');
    return {
        isCleanDb: false,
        changesApplied: true,
        seededCount: newToSeed.length,
        updatedCount: matched.length,
        matchReport
    };
}

if (require.main === module) {
    const confirm = process.argv.includes('--confirm');
    seedCatalogue({ confirmMatches: confirm })
        .then(result => {
            console.log('\nExecution Result Summary:', {
                isCleanDb: result.isCleanDb,
                changesApplied: result.changesApplied,
                seededCount: result.seededCount
            });
            process.exit(0);
        })
        .catch(err => {
            console.error('[Catalogue Seed Error]', err);
            process.exit(1);
        });
}

module.exports = { seedCatalogue };
