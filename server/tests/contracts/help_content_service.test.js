const helpContentService = require('../../services/helpContentService');
const prisma = require('../../prisma');

describe('Help Content Service Contract Tests', () => {
    test('getTopics returns 8 categories with article counts in authorized preview', async () => {
        const topics = await helpContentService.getTopics({ role: 'SUPER_ADMIN', labId: 'lab-1' }, 'en', true);
        expect(Array.isArray(topics)).toBe(true);
        expect(topics.length).toBe(8);
        const startTopic = topics.find(t => t.id === 'start');
        expect(startTopic).toBeDefined();
        expect(startTopic.articleCount).toBeGreaterThan(0);
    });

    test('getArticles filters by role and category in authorized preview', async () => {
        const articles = await helpContentService.getArticles({
            category: 'bench',
            role: 'technician',
            user: { role: 'SUPER_ADMIN', labId: 'lab-1' },
            locale: 'en',
            preview: true
        });
        expect(Array.isArray(articles)).toBe(true);
        expect(articles.length).toBeGreaterThan(0);
        articles.forEach(a => {
            expect(a.category).toBe('bench');
            expect(a.title).toBeDefined();
            expect(a.summary).toBeDefined();
        });
    });

    test('getArticleById returns article details and steps for draft article in preview', async () => {
        const article = await helpContentService.getArticleById('start-shift', { role: 'SUPER_ADMIN' }, 'en', true);
        expect(article).toBeDefined();
        expect(article.id).toBe('start-shift');
        expect(Array.isArray(article.steps)).toBe(true);
        expect(article.steps.length).toBeGreaterThan(0);
        expect(article.isFallback).toBe(false);
    });

    test('getArticleById returns explicit fallback notice for unreviewed translation', async () => {
        const article = await helpContentService.getArticleById('start-shift', { role: 'SUPER_ADMIN' }, 'fr', true);
        expect(article).toBeDefined();
        expect(article.isFallback).toBe(true);
        expect(article.localeNotice).toMatch(/anglais/i);
    });

    test('searchHelp finds spectra article by MIR keyword in preview', async () => {
        const result = await helpContentService.searchHelp({
            query: 'MIR',
            user: { role: 'SUPER_ADMIN' },
            locale: 'en',
            preview: true
        });
        expect(result.total).toBeGreaterThan(0);
        const hasSpectra = result.results.some(r => r.id === 'bench-spectra');
        expect(hasSpectra).toBe(true);
    });

    test('searchHelp handles search queries safely with special characters', async () => {
        const result = await helpContentService.searchHelp({
            query: '<script>alert(1)</script>',
            user: { role: 'SUPER_ADMIN' },
            locale: 'en',
            preview: true
        });
        expect(result).toBeDefined();
        expect(Array.isArray(result.results)).toBe(true);
    });

    test('recordFeedback stores feedback without mutating article', async () => {
        const feedback = await helpContentService.recordFeedback({
            articleId: 'start-shift',
            locale: 'en',
            useful: true,
            comment: 'Very helpful shift preparation guide.',
            category: 'start',
            user: { id: 'test-user-1' }
        });

        expect(feedback).toBeDefined();
        expect(feedback.id).toBeDefined();
        expect(feedback.useful).toBe(true);

        const saved = await prisma.helpFeedback.findUnique({
            where: { id: feedback.id }
        });
        expect(saved).toBeDefined();
        expect(saved.articleId).toBe('start-shift');
        expect(saved.comment).toBe('Very helpful shift preparation guide.');

        // Clean up feedback
        await prisma.helpFeedback.delete({ where: { id: feedback.id } });
    });
});
