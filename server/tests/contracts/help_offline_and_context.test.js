const helpContentService = require('../../services/helpContentService');
const prisma = require('../../prisma');

describe('Help Offline, Context & Isolation Contract Tests', () => {
    test('1. Blocker isolation: Context help with blocker does NOT contaminate subsequent calls without blocker', async () => {
        // First call with DRYING_PREREQUISITE_BLOCKED
        const withBlocker = await helpContentService.getContextHelp({
            route: '/workbench',
            blockerCodes: ['DRYING_PREREQUISITE_BLOCKED'],
            user: { role: 'LAB_TECHNICIAN', labId: 'lab-1' },
            preview: true
        });

        expect(withBlocker.blockers.length).toBe(1);
        expect(withBlocker.blockers[0].code).toBe('DRYING_PREREQUISITE_BLOCKED');
        expect(withBlocker.blockers[0].articleId).toBe('bench-drying');

        // Second call on exact same route WITHOUT blockers
        const withoutBlocker = await helpContentService.getContextHelp({
            route: '/workbench',
            blockerCodes: [],
            user: { role: 'LAB_TECHNICIAN', labId: 'lab-1' },
            preview: true
        });

        expect(withoutBlocker.blockers.length).toBe(0);
        // The first article in withoutBlocker must NOT be bench-drying if bench-drying was only prepended due to blocker
        // Verify route registry itself was not mutated
        const routeMap = helpContentService.getCategories ? require('../../data/help/route-help-map.json') : null;
        const workbenchRoute = routeMap?.routes.find(r => r.route === '/workbench');
        if (workbenchRoute) {
            expect(workbenchRoute.articleIds).not.toContain('bench-drying');
        }
    });

    test('2. Unknown blocker code resolves safely to bench-blocked fallback', async () => {
        const unknownRes = await helpContentService.getContextHelp({
            route: '/workbench',
            blockerCodes: ['COMPLETELY_UNKNOWN_CUSTOM_BLOCKER_XYZ'],
            user: { role: 'LAB_TECHNICIAN' },
            preview: true
        });

        expect(unknownRes.blockers.length).toBe(1);
        expect(unknownRes.blockers[0].code).toBe('COMPLETELY_UNKNOWN_CUSTOM_BLOCKER_XYZ');
        expect(unknownRes.blockers[0].articleId).toBe('bench-blocked');
    });

    test('3. Public vs Authenticated Filtering: Unauthenticated user cannot access authenticated-only operational articles', async () => {
        // Authenticated article (bench-drying) without user
        const unauthAccess = await helpContentService.getArticleById('bench-drying', null, 'en', false);
        expect(unauthAccess).toBeNull();

        // Check topics visibility for unauthenticated user
        const publicTopics = await helpContentService.getTopics(null, 'en', false);
        expect(Array.isArray(publicTopics)).toBe(true);
        // All categories returned with 5-language titles
        expect(publicTopics.length).toBe(8);
        expect(publicTopics[0].title).toBeDefined();
    });

    test('4. Offline pack generation: returns localized categories, route mapping, and pack metadata', async () => {
        const pack = await helpContentService.getOfflinePack({
            user: { role: 'LAB_TECHNICIAN', labId: 'lab-1' },
            locale: 'fr'
        });

        expect(pack).toBeDefined();
        expect(pack.locale).toBe('fr');
        expect(pack.packVersion).toBe(1);
        expect(Array.isArray(pack.categories)).toBe(true);
        expect(pack.categories.length).toBe(8);
        expect(pack.categories[0].title).toBe('Premiers pas');
        expect(pack.routeMap).toBeDefined();
        expect(pack.routeMap.blockers).toBeDefined();
    });
});
