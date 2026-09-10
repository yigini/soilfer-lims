const helpContentService = require('../../services/helpContentService');
const prisma = require('../../prisma');

describe('Help Content Service Contract Tests', () => {
    test('getTopics returns 8 categories with article counts', async () => {
        const topics = await helpContentService.getTopics({ role: 'LAB_TECHNICIAN', labId: 'lab-1' });
        expect(Array.isArray(topics)).toBe(true);
        expect(topics.length).toBe(8);
        const startTopic = topics.find(t => t.id === 'start');
        expect(startTopic).toBeDefined();
        expect(startTopic.articleCount).toBeGreaterThan(0);
    });

    test('getArticles filters by role and category', async () => {
        const articles = await helpContentService.getArticles({
            category: 'bench',
            role: 'technician',
            user: { role: 'LAB_TECHNICIAN', labId: 'lab-1' },
            locale: 'en'
        });
        expect(Array.isArray(articles)).toBe(true);
        expect(articles.length).toBeGreaterThan(0);
        articles.forEach(a => {
            expect(a.category).toBe('bench');
            expect(a.title).toBeDefined();
            expect(a.summary).toBeDefined();
        });
    });

    test('getArticleById returns article details and steps for approved article', async () => {
        const article = await helpContentService.getArticleById('start-shift', { role: 'LAB_TECHNICIAN' }, 'en');
        expect(article).toBeDefined();
        expect(article.id).toBe('start-shift');
        expect(Array.isArray(article.steps)).toBe(true);
        expect(article.steps.length).toBeGreaterThan(0);
        expect(article.isFallback).toBe(false);
    });

    test('getArticleById returns explicit fallback notice for unreviewed translation', async () => {
        const article = await helpContentService.getArticleById('start-shift', { role: 'LAB_TECHNICIAN' }, 'fr');
        expect(article).toBeDefined();
        expect(article.isFallback).toBe(true);
        expect(article.localeNotice).toMatch(/anglais/i);
    });

    test('searchHelp finds spectra article by MIR keyword', async () => {
        const result = await helpContentService.searchHelp({
            query: 'MIR',
            user: { role: 'LAB_TECHNICIAN' },
            locale: 'en'
        });
        expect(result.total).toBeGreaterThan(0);
        const hasSpectra = result.results.some(r => r.id === 'bench-spectra');
        expect(hasSpectra).toBe(true);
    });

    test('searchHelp handles search queries safely with special characters', async () => {
        const result = await helpContentService.searchHelp({
            query: '<script>alert(1)</script>',
            user: { role: 'LAB_TECHNICIAN' },
            locale: 'en'
        });
        expect(result).toBeDefined();
        expect(result.results).toEqual([]);
    });

    test('getContextHelp maps route /workbench and readiness codes', async () => {
        const context = await helpContentService.getContextHelp({
            route: '/workbench',
            blockerCodes: ['DRYING_PREREQUISITE_BLOCKED', 'UNASSIGNED_TO_USER'],
            user: { role: 'LAB_TECHNICIAN' },
            locale: 'en'
        });
        expect(context.route).toBe('/workbench');
        expect(context.blockers.length).toBe(2);
        expect(context.blockers[0].articleId).toBe('bench-drying');
        expect(context.blockers[1].articleId).toBe('bench-blocked');
        expect(context.articles.length).toBeGreaterThan(0);
    });

    test('recordFeedback stores sanitized feedback', async () => {
        const feedback = await helpContentService.recordFeedback({
            articleId: 'start-shift',
            useful: true,
            comment: 'Very helpful guide <script>',
            user: { id: 'test-user' }
        });
        expect(feedback).toBeDefined();
        expect(feedback.useful).toBe(true);
        expect(feedback.comment).toContain('&lt;script&gt;');
    });

    test('getOfflinePack produces complete scoped bundle', async () => {
        const pack = await helpContentService.getOfflinePack({
            user: { role: 'LAB_TECHNICIAN', labId: 'lab-1' },
            locale: 'en'
        });
        expect(pack.packVersion).toBe(1);
        expect(pack.categories.length).toBe(8);
        expect(pack.articles.length).toBeGreaterThan(0);
        expect(pack.routeMap.blockers).toBeDefined();
    });
});
