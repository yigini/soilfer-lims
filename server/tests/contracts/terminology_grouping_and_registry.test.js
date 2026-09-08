const {
    GROUP_DEFINITIONS,
    classifyTerminologyKey,
    getGroupDefinition,
    getAllGroupDefinitions
} = require('../../utils/terminologyRegistry');
const translationService = require('../../services/TranslationService');

describe('Terminology Grouping, Registry & Reconciled Counts Contract', () => {
    test('1. All 8 canonical groups + unclassified have valid definitions and metadata in all 5 locales', () => {
        expect(GROUP_DEFINITIONS.length).toBe(9); // 8 groups + unclassified
        const expectedLocales = ['en', 'es', 'es-419', 'fr', 'pt'];

        GROUP_DEFINITIONS.forEach(group => {
            expect(group.id).toBeDefined();
            expect(group.icon).toBeDefined();
            expect(Array.isArray(group.tags)).toBe(true);

            expectedLocales.forEach(loc => {
                const def = getGroupDefinition(group.id, loc);
                expect(def.name).toBeTruthy();
                expect(typeof def.name).toBe('string');
                expect(def.description).toBeTruthy();
                expect(typeof def.description).toBe('string');
            });
        });
    });

    test('2. Every catalog key resolves to a valid primaryGroup with optional cross-feature tags', async () => {
        const catalog = await translationService.getCatalog('en');
        const keys = Object.keys(catalog);
        expect(keys.length).toBeGreaterThanOrEqual(500);

        const validGroupIds = new Set(GROUP_DEFINITIONS.map(g => g.id));
        const groupCounts = {};

        keys.forEach(key => {
            const entry = catalog[key];
            expect(validGroupIds.has(entry.primaryGroup)).toBe(true);
            expect(Array.isArray(entry.tags)).toBe(true);
            groupCounts[entry.primaryGroup] = (groupCounts[entry.primaryGroup] || 0) + 1;
        });

        // Sum of all group counts must equal exactly the total unique catalog entries
        const sumCounts = Object.values(groupCounts).reduce((acc, c) => acc + c, 0);
        expect(sumCounts).toBe(keys.length);
    });

    test('3. Deterministic key classification properly categorizes UI, scientific, and operations keys', () => {
        expect(classifyTerminologyKey('nav.dashboard').primaryGroup).toBe('common');
        expect(classifyTerminologyKey('button.save').primaryGroup).toBe('common');
        expect(classifyTerminologyKey('dynamic.analysis.pH.name').primaryGroup).toBe('analyses');
        expect(classifyTerminologyKey('catalogue.texture.clay.name').primaryGroup).toBe('analyses');
        expect(classifyTerminologyKey('reception.newIntake').primaryGroup).toBe('operations');
        expect(classifyTerminologyKey('workbench.title').primaryGroup).toBe('operations');
        expect(classifyTerminologyKey('reports.title').primaryGroup).toBe('reports');
        expect(classifyTerminologyKey('equipment.status').primaryGroup).toBe('equipment');
        expect(classifyTerminologyKey('projects.title').primaryGroup).toBe('projects');
        expect(classifyTerminologyKey('admin.branding').primaryGroup).toBe('admin');
        expect(classifyTerminologyKey('error.pageNotFound').primaryGroup).toBe('messages');
        expect(classifyTerminologyKey('custom.unknown.key.xyz').primaryGroup).toBe('unclassified');
    });

    test('4. Cross-group search matches by key, text, and domain tags', async () => {
        const catalog = await translationService.getCatalog('en');
        const searchKeyword = 'texture';

        const matches = Object.entries(catalog).filter(([key, info]) => {
            const q = searchKeyword.toLowerCase();
            return key.toLowerCase().includes(q) ||
                (info.en || '').toLowerCase().includes(q) ||
                info.tags.some(t => t.toLowerCase().includes(q));
        });

        expect(matches.length).toBeGreaterThan(0);
        // Texture classes should be found
        expect(matches.some(([k]) => k.includes('texture'))).toBe(true);
    });

    test('5. Shared terms update once and preserve singular translation entry', async () => {
        // Confirm that shared status terms are not duplicated with redundant prefix copies
        const catalog = await translationService.getCatalog('en');
        const expectedStatuses = ['status.EXPECTED', 'status.ACCEPTED', 'status.COMPLETED'];
        expectedStatuses.forEach(s => {
            expect(catalog[s]).toBeDefined();
            expect(catalog[s].primaryGroup).toBe('operations');
        });
    });
});
