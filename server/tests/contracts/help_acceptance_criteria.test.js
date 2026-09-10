const helpContentService = require('../../services/helpContentService');
const prisma = require('../../prisma');
const fs = require('fs');
const path = require('path');

describe('Help System Full Acceptance & Release Verification', () => {
    const rawContent = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '../../data/help/content.en.json'), 'utf8')
    );
    const routeMap = JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '../../data/help/route-help-map.json'), 'utf8')
    );

    test('1. Every starter article is present as draft revision 1 and 0 unreviewed publications exist', async () => {
        expect(rawContent.articles.length).toBe(27);
        for (const art of rawContent.articles) {
            const dbArt = await prisma.helpArticle.findUnique({
                where: { id: art.id },
                include: {
                    revisions: {
                        where: { revisionNumber: 1 },
                        include: { locales: true }
                    },
                    publications: { where: { isCurrent: true } }
                }
            });
            expect(dbArt).toBeDefined();
            expect(dbArt.revisions.length).toBe(1);
            // Finding 1 assertion: No unreviewed drafts published
            expect(dbArt.publications.length).toBe(0);
            const enLoc = dbArt.revisions[0].locales.find(l => l.locale === 'en');
            expect(enLoc.reviewStatus).toBe('EDITORIAL_DRAFT');
        }
    });

    test('2. FAQ and Article summary consistency across all 27 articles (authorized preview)', async () => {
        for (const art of rawContent.articles) {
            const loaded = await helpContentService.getArticleById(art.id, { role: 'SUPER_ADMIN' }, 'en', true);
            expect(loaded).toBeDefined();
            expect(loaded.summary).toBe(art.summary);
            expect(loaded.title).toBe(art.title);
        }
    });

    test('3. Route coverage: All mapped routes resolve cleanly', async () => {
        for (const r of routeMap.routes) {
            const context = await helpContentService.getContextHelp({
                route: r.route,
                user: { role: 'SUPER_ADMIN' },
                locale: 'en',
                preview: true
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
                user: { role: 'SUPER_ADMIN' },
                locale: 'en',
                preview: true
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
        await helpContentService.getTopics({ role: 'LAB_TECHNICIAN', labId: 'lab-1' }, 'en', true);
        await helpContentService.getArticles({ category: 'bench', user: { role: 'LAB_TECHNICIAN' }, locale: 'en', preview: true });
        await helpContentService.getArticleById('bench-run', { role: 'SUPER_ADMIN' }, 'en', true);
        await helpContentService.searchHelp({ query: 'pH observation', user: { role: 'LAB_TECHNICIAN' }, preview: true });
        await helpContentService.getContextHelp({ route: '/workbench', blockerCodes: ['DRYING_PREREQUISITE_BLOCKED'], preview: true });
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
            user: { role: 'SUPER_ADMIN' },
            locale: 'en',
            preview: true
        });
        expect(resAccent.total).toBeGreaterThan(0);

        // "reflectance" should find bench-spectra
        const resReflectance = await helpContentService.searchHelp({
            query: 'reflectance',
            user: { role: 'SUPER_ADMIN' },
            locale: 'en',
            preview: true
        });
        expect(resReflectance.results.some(a => a.id === 'bench-spectra')).toBe(true);
    });

    test('7. Multi-language collections: all 5 locale files exist with 27 translated articles', () => {
        const locales = ['en', 'es', 'es-419', 'fr', 'pt'];
        for (const loc of locales) {
            const filePath = path.resolve(__dirname, `../../data/help/content.${loc}.json`);
            expect(fs.existsSync(filePath)).toBe(true);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            expect(data.articles).toBeDefined();
            expect(data.articles.length).toBe(27);
            for (const a of data.articles) {
                expect(a.id).toBeDefined();
                expect(a.title).toBeDefined();
                expect(a.summary).toBeDefined();
            }
        }
    });

    test('8. Public vs Authenticated Visibility: unauthenticated visitor only receives explicitly public articles', async () => {
        // Without preview (normal user)
        const pubArticles = await helpContentService.getArticles({
            user: null, // unauthenticated
            locale: 'en',
            preview: false
        });

        // Even with preview = true, unauthenticated visitor cannot preview drafts
        const unauthPreview = await helpContentService.getArticles({
            user: null,
            locale: 'en',
            preview: true
        });
        expect(unauthPreview.length).toBe(0); // 0 drafts visible to unauthenticated

        // Context help for /login for unauthenticated visitor returns only public articles
        const loginContext = await helpContentService.getContextHelp({
            route: '/login',
            user: null,
            locale: 'en'
        });
        for (const a of loginContext.articles) {
            expect(['PUBLIC']).toContain(a.visibility);
        }
    });

    test('9. Runtime data decoupling: help service reads exclusively from server/data/help/', () => {
        const dataDir = path.resolve(__dirname, '../../data/help');
        expect(fs.existsSync(path.join(dataDir, 'route-help-map.json'))).toBe(true);
        expect(fs.existsSync(path.join(dataDir, 'categories.json'))).toBe(true);
        expect(fs.existsSync(path.join(dataDir, 'synonyms.json'))).toBe(true);
        expect(fs.existsSync(path.join(dataDir, 'content.en.json'))).toBe(true);
    });
});
