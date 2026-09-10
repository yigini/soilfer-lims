const helpContentService = require('../../services/helpContentService');
const prisma = require('../../prisma');

describe('Help Content Service Contract Tests', () => {
    test('getTopics returns 12 categories with article counts in authorized preview', async () => {
        const topics = await helpContentService.getTopics({ role: 'SUPER_ADMIN', labId: 'lab-1' }, 'en', true);
        expect(Array.isArray(topics)).toBe(true);
        expect(topics.length).toBe(12);
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
        const rev = await prisma.helpRevision.findFirst({
            where: { articleId: 'start-shift' },
            orderBy: { revisionNumber: 'desc' }
        });
        await prisma.helpLocaleRevision.updateMany({
            where: { revisionId: rev.id, locale: 'fr' },
            data: { reviewStatus: 'TRANSLATION_REQUIRED' }
        });

        try {
            const article = await helpContentService.getArticleById('start-shift', { role: 'SUPER_ADMIN' }, 'fr', true);
            expect(article).toBeDefined();
            expect(article.isFallback).toBe(true);
            expect(article.localeNotice).toMatch(/anglais/i);
        } finally {
            await prisma.helpLocaleRevision.updateMany({
                where: { revisionId: rev.id, locale: 'fr' },
                data: { reviewStatus: 'APPROVED' }
            });
        }
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

    test('getArticleById returns rich v2 blocks for bench-batch and prep-drying', async () => {
        const batchArticle = await helpContentService.getArticleById('bench-batch', { role: 'SUPER_ADMIN' }, 'en', true);
        expect(batchArticle).toBeDefined();
        expect(batchArticle.id).toBe('bench-batch');
        expect(Array.isArray(batchArticle.steps)).toBe(true);
        expect(batchArticle.steps.length).toBeGreaterThan(0);
        expect(batchArticle.quick).toBeDefined();
        expect(Array.isArray(batchArticle.sections)).toBe(true);
        expect(batchArticle.sections.length).toBeGreaterThan(0);
        expect(batchArticle.nextActor).toMatch(/manager|reviewer/i);

        const dryingArticle = await helpContentService.getArticleById('prep-drying', { role: 'SUPER_ADMIN' }, 'en', true);
        expect(dryingArticle).toBeDefined();
        expect(dryingArticle.id).toBe('prep-drying');
        expect(Array.isArray(dryingArticle.steps)).toBe(true);
        expect(dryingArticle.quick).toMatch(/Confirm Complete/i);
        expect(dryingArticle.sections.length).toBeGreaterThan(0);
    });

    test('getArticleById resolves legacy article ID via alias', async () => {
        const legacyRun = await helpContentService.getArticleById('bench-run', { role: 'SUPER_ADMIN' }, 'en', true);
        expect(legacyRun).toBeDefined();
        expect(legacyRun.steps.length).toBeGreaterThan(0);
    });

    test('getFaqs returns problem symptoms across topics', async () => {
        const faqs = await helpContentService.getFaqs({ locale: 'en' });
        expect(Array.isArray(faqs)).toBe(true);
        expect(faqs.length).toBeGreaterThan(0);
        const dryingFaq = faqs.find(f => f.articleId === 'prep-drying');
        expect(dryingFaq).toBeDefined();
        expect(dryingFaq.question).toBeDefined();
        expect(dryingFaq.action).toBeDefined();
    });
});
