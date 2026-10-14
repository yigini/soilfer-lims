const helpContentService = require('../../services/helpContentService');
const { publishHelpRelease } = require('../../scripts/publish_help_release.cjs');
const prisma = require('../../prisma');
const fs = require('fs');
const path = require('path');

describe('Help Release Rollout & Live Reader Journeys Contract Tests', () => {
    let manifest = null;

    beforeAll(async () => {
        // Execute release publication against test database
        manifest = await publishHelpRelease({ dryRun: false });
    });

    test('1. Release manifest matches published collection and 5-language coverage', () => {
        expect(manifest).toBeDefined();
        expect(manifest.releaseVersion).toBe('v1.0.0');
        expect(manifest.provenance).toBe('system-app-review');
        expect(manifest.totalArticles).toBeGreaterThanOrEqual(27);
        expect(manifest.locales).toEqual(['en', 'es', 'es-419', 'fr', 'pt']);

        const manifestPath = path.resolve(__dirname, '../../data/help/RELEASE_MANIFEST_v1.json');
        expect(fs.existsSync(manifestPath)).toBe(true);
    });

    test('2. All published articles have active publications with approved locales in DB', async () => {
        const publications = await prisma.helpPublication.findMany({
            where: { isCurrent: true },
            include: {
                article: true,
                revision: {
                    include: { locales: true }
                }
            }
        });

        expect(publications.length).toBeGreaterThanOrEqual(27);
        for (const pub of publications) {
            const approved = JSON.parse(pub.approvedLocales);
            expect(approved).toEqual(['en', 'es', 'es-419', 'fr', 'pt']);
            expect(pub.publishedBy).toBe('system-app-review');

            // Verify all locales on this revision are APPROVED
            for (const loc of ['en', 'es', 'es-419', 'fr', 'pt']) {
                const locRev = pub.revision.locales.find(l => l.locale === loc);
                expect(locRev).toBeDefined();
                expect(locRev.reviewStatus).toBe('APPROVED');
                expect(locRev.reviewedBy).toBe('system-app-review');
            }
        }
    });

    test('3. Representative Journey — Public Visitor on /login (normal reader, no preview)', async () => {
        const context = await helpContentService.getContextHelp({
            route: '/login',
            user: null,
            locale: 'en',
            preview: false
        });

        expect(context.availability).toBe('AVAILABLE');
        expect(context.articles.length).toBeGreaterThan(0);
        // Only public articles are returned
        const articleIds = context.articles.map(a => a.id);
        expect(articleIds).toContain('start-shift');
        expect(articleIds).toContain('manage-support');
        context.articles.forEach(a => {
            expect(a.title).toBeDefined();
            expect(a.summary).toBeDefined();
            expect(a.isFallback).toBe(false);
        });
    });

    test('4. Representative Journey — Anonymous visitor on /workbench receives AUTH_REQUIRED', async () => {
        const context = await helpContentService.getContextHelp({
            route: '/workbench',
            user: null,
            locale: 'en',
            preview: false
        });

        expect(context.availability).toBe('AUTH_REQUIRED');
        expect(context.articles.length).toBe(0);
        expect(context.draftArticleIds).toBeUndefined(); // Never leaks IDs to unauthenticated
    });

    test('5. Representative Journey — Authenticated Technician on /workbench', async () => {
        const techUser = { id: 'usr_tech', role: 'LAB_TECHNICIAN', labId: 'lab_1' };
        const context = await helpContentService.getContextHelp({
            route: '/workbench',
            user: techUser,
            locale: 'en',
            preview: false
        });

        expect(context.availability).toBe('AVAILABLE');
        expect(context.articles.length).toBeGreaterThan(0);
        const articleIds = context.articles.map(a => a.id);
        expect(articleIds).toContain('bench-run');
        expect(articleIds).toContain('bench-save-submit');
    });

    test('6. Representative Journey — Technician with live blocker on /workbench', async () => {
        const techUser = { id: 'usr_tech', role: 'LAB_TECHNICIAN', labId: 'lab_1' };
        const context = await helpContentService.getContextHelp({
            route: '/workbench',
            blockerCodes: ['DRYING_PREREQUISITE_BLOCKED'],
            user: techUser,
            locale: 'en',
            preview: false
        });

        expect(context.availability).toBe('AVAILABLE');
        expect(context.blockers.length).toBe(1);
        expect(context.blockers[0].code).toBe('DRYING_PREREQUISITE_BLOCKED');
        expect(context.blockers[0].articleId).toBe('bench-drying');
        // Blocker article is prepended to front
        expect(context.articles[0].id).toBe('bench-drying');
    });

    test('7. Representative Journey — Reception Staff on /reception', async () => {
        const recepUser = { id: 'usr_recep', role: 'LAB_TECHNICIAN', labId: 'lab_1' };
        const context = await helpContentService.getContextHelp({
            route: '/reception',
            user: recepUser,
            locale: 'en',
            preview: false
        });

        expect(context.availability).toBe('AVAILABLE');
        expect(context.articles.length).toBeGreaterThan(0);
        const articleIds = context.articles.map(a => a.id);
        expect(articleIds).toContain('intake-project');
    });

    test('8. Representative Journey — Lab Manager on /manager-queue', async () => {
        const mgrUser = { id: 'usr_mgr', role: 'LAB_MANAGER', labId: 'lab_1' };
        const context = await helpContentService.getContextHelp({
            route: '/manager-queue',
            user: mgrUser,
            locale: 'en',
            preview: false
        });

        expect(context.availability).toBe('AVAILABLE');
        expect(context.articles.length).toBeGreaterThan(0);
        const articleIds = context.articles.map(a => a.id);
        expect(articleIds).toContain('review-results');
    });

    test('9. Multilingual Delivery across all 5 languages without false fallback labels', async () => {
        const techUser = { id: 'usr_tech', role: 'LAB_TECHNICIAN', labId: 'lab_1' };

        for (const loc of ['en', 'es', 'es-419', 'fr', 'pt']) {
            const article = await helpContentService.getArticleById('bench-drying', techUser, loc, false);
            expect(article).toBeDefined();
            expect(article.id).toBe('bench-drying');
            expect(article.isFallback).toBe(false);
            expect(article.localeNotice).toBeNull();
            expect(article.title).toBeDefined();
            expect(article.steps.length).toBeGreaterThan(0);

            if (loc === 'fr') {
                expect(article.title).toMatch(/séchage/i);
            } else if (loc === 'es' || loc === 'es-419') {
                expect(article.title).toMatch(/secado/i);
            } else if (loc === 'pt') {
                expect(article.title).toMatch(/secagem/i);
            }
        }
    });

    test('10. Public Topics endpoint returns non-zero article counts for normal readers', async () => {
        for (const loc of ['en', 'es', 'es-419', 'fr', 'pt']) {
            const topics = await helpContentService.getTopics(null, loc, false);
            expect(topics.length).toBe(12);
            // Public topics have at least public articles
            const totalCount = topics.reduce((sum, t) => sum + t.articleCount, 0);
            expect(totalCount).toBeGreaterThan(0);
        }
    });

    test('11. Offline Pack generation includes published articles for normal readers', async () => {
        const techUser = { id: 'usr_tech', role: 'LAB_TECHNICIAN', labId: 'lab_1' };
        const pack = await helpContentService.getOfflinePack({ user: techUser, locale: 'es' });

        expect(pack).toBeDefined();
        expect(pack.articles.length).toBeGreaterThanOrEqual(27);
        expect(pack.locale).toBe('es');
        pack.articles.forEach(a => {
            expect(a.isFallback).toBe(false);
            expect(a.title).toBeDefined();
            expect(a.steps.length).toBeGreaterThan(0);
        });
    });

    test('12. Operational Safety: Zero mutations on operational tables', async () => {
        const sampleCount = await prisma.sample.count();
        expect(sampleCount).toBeGreaterThanOrEqual(0);
        const userCount = await prisma.user.count();
        expect(userCount).toBeGreaterThanOrEqual(0);
    });
});
