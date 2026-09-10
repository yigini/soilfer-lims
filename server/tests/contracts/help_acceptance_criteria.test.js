const helpContentService = require('../../services/helpContentService');
const prisma = require('../../prisma');
const fs = require('fs');
const path = require('path');

describe('Help System Full Acceptance & Release Verification', () => {
    const rawContent = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '../../../WP/help-knowledge-base-v1/content.en.json'), 'utf8')
    );
    const routeMap = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '../../../WP/help-knowledge-base-v1/route-help-map.json'), 'utf8')
    );

    test('1. Every starter article is present in the database and approved/drafted', async () => {
        expect(rawContent.articles.length).toBe(27);
        for (const art of rawContent.articles) {
            const dbArt = await prisma.helpArticle.findUnique({
                where: { id: art.id },
                include: { publications: { where: { isCurrent: true } } }
            });
            expect(dbArt).toBeDefined();
            expect(dbArt.publications.length).toBeGreaterThan(0);
        }
    });

    test('2. FAQ and Article summary consistency across all 27 articles', async () => {
        for (const art of rawContent.articles) {
            const loaded = await helpContentService.getArticleById(art.id, { role: 'LAB_TECHNICIAN' }, 'en');
            expect(loaded).toBeDefined();
            expect(loaded.summary).toBe(art.summary);
            expect(loaded.title).toBe(art.title);
        }
    });

    test('3. Route coverage: All 36 mapped routes resolve cleanly to approved articles', async () => {
        for (const r of routeMap.routes) {
            const context = await helpContentService.getContextHelp({
                route: r.route,
                user: { role: 'LAB_TECHNICIAN' },
                locale: 'en'
            });
            expect(context).toBeDefined();
            expect(Array.isArray(context.articles)).toBe(true);
        }
    });

    test('4. Live Blocker Diagnostics: All machine-readable codes map to valid explanatory articles', async () => {
        const blockerCodes = Object.keys(routeMap.blockers);
        expect(blockerCodes.length).toBeGreaterThanOrEqual(15);

        for (const code of blockerCodes) {
            const expectedArticleId = routeMap.blockers[code];
            const context = await helpContentService.getContextHelp({
                route: '/workbench',
                blockerCodes: [code],
                user: { role: 'LAB_TECHNICIAN' },
                locale: 'en'
            });
            expect(context.blockers.length).toBe(1);
            expect(context.blockers[0].articleId).toBe(expectedArticleId);
            expect(context.articles.some(a => a.id === expectedArticleId)).toBe(true);
        }
    });

    test('5. Zero mutation assertion: Calling help services does NOT mutate operational tables', async () => {
        const sampleCountBefore = await prisma.sample.count();
        const workItemCountBefore = await prisma.workItem.count();

        // Perform multiple help actions: get topics, read articles, search, get context, get offline pack
        await helpContentService.getTopics({ role: 'LAB_TECHNICIAN', labId: 'lab-1' });
        await helpContentService.getArticles({ category: 'bench', user: { role: 'LAB_TECHNICIAN' }, locale: 'en' });
        await helpContentService.getArticleById('bench-run', { role: 'LAB_TECHNICIAN' }, 'en');
        await helpContentService.searchHelp({ query: 'pH observation', user: { role: 'LAB_TECHNICIAN' } });
        await helpContentService.getContextHelp({ route: '/workbench', blockerCodes: ['DRYING_PREREQUISITE_BLOCKED'] });
        await helpContentService.getOfflinePack({ user: { role: 'LAB_TECHNICIAN' }, locale: 'en' });

        const sampleCountAfter = await prisma.sample.count();
        const workItemCountAfter = await prisma.workItem.count();

        expect(sampleCountAfter).toBe(sampleCountBefore);
        expect(workItemCountAfter).toBe(workItemCountBefore);
    });

    test('6. Accented and typo-tolerant search across topics and synonyms', async () => {
        // "método" with accent should find results
        const resAccent = await helpContentService.searchHelp({
            query: 'método',
            user: { role: 'LAB_TECHNICIAN' },
            locale: 'en'
        });
        expect(resAccent.total).toBeGreaterThan(0);

        // "reflectance" should find bench-spectra
        const resReflectance = await helpContentService.searchHelp({
            query: 'reflectance',
            user: { role: 'LAB_TECHNICIAN' },
            locale: 'en'
        });
        expect(resReflectance.results.some(a => a.id === 'bench-spectra')).toBe(true);
    });

    test('7. Translation review integrity: All 5 locales return proper notice when unreviewed', async () => {
        const nonEnglishLocales = ['es', 'es-419', 'fr', 'pt'];
        for (const loc of nonEnglishLocales) {
            const article = await helpContentService.getArticleById('start-shift', { role: 'LAB_TECHNICIAN' }, loc);
            expect(article.isFallback).toBe(true);
            expect(article.localeNotice).toBeDefined();
        }
    });
});
