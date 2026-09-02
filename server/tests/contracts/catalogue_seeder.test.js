const prisma = require('../../prisma');
const { seedCatalogue } = require('../../seeds/catalogue');

describe('WP-19: Analysis Catalogue Seeder Contract', () => {
    test('1. A clean database seeds all 214 standard analyses', async () => {
        const result = await seedCatalogue({ forceClean: true });

        expect(result.isCleanDb).toBe(true);
        expect(result.seededCount).toBe(214);
        expect(result.changesApplied).toBe(true);

        const totalAnalyses = await prisma.analysis.count();
        expect(totalAnalyses).toBeGreaterThanOrEqual(214);
    });

    test('2. A database with existing analyses produces a match report and changes nothing without confirmation', async () => {
        const result = await seedCatalogue({ confirmMatches: false });

        expect(result.changesApplied).toBe(false);
        expect(result.seededCount).toBe(0);
        expect(result.matchReport).toBeDefined();
        expect(result.matchReport.matchedCount).toBeGreaterThan(0);
        expect(result.matchReport.matched[0].status).toBe('PROPOSED_PAIRING');
    });

    test('3. Local hand-created analyses are preserved with isGlobal: false upon confirmed merge', async () => {
        const customCode = `LOCAL_CUSTOM_${Date.now()}`;
        await prisma.analysis.create({
            data: {
                code: customCode,
                name: 'Custom Uncatalogued Field Parameter',
                units: 'mg/kg',
                isGlobal: true // starts as global
            }
        });

        // Run seed with confirmation
        const result = await seedCatalogue({ confirmMatches: true });

        expect(result.changesApplied).toBe(true);
        expect(result.matchReport.localUnmatched.some(u => u.code === customCode)).toBe(true);

        // Verify that customCode is preserved and marked isGlobal: false
        const local = await prisma.analysis.findUnique({
            where: { code: customCode }
        });
        expect(local).toBeDefined();
        expect(local.isGlobal).toBe(false);
    });

    test('4. Environmental module parameters ship disabled (status: inactive)', async () => {
        const envAnalyses = await prisma.analysis.findMany({
            where: { module: 'ENVIRONMENTAL' }
        });

        expect(envAnalyses.length).toBeGreaterThan(0);
        for (const ea of envAnalyses) {
            expect(ea.status).toBe('inactive');
        }
    });
});
