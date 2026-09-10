const helpContentService = require('../../services/helpContentService');
const prisma = require('../../prisma');

describe('Help Lab Isolation & Security Enforcement Tests', () => {
    const testArticleId = 'start-shift';
    const labA = 'test-lab-alpha';
    const labB = 'test-lab-beta';

    beforeAll(async () => {
        // Ensure clean state and active publications for published-only reader tests
        await prisma.helpPublication.deleteMany({
            where: { articleId: { in: [testArticleId, 'bench-drying'] } }
        });

        for (const artId of [testArticleId, 'bench-drying']) {
            const rev = await prisma.helpRevision.findFirst({
                where: { articleId: artId },
                orderBy: { revisionNumber: 'desc' }
            });
            if (rev) {
                await prisma.helpPublication.create({
                    data: {
                        articleId: artId,
                        revisionId: rev.id,
                        publishedBy: 'system-test',
                        approvedLocales: '["en"]',
                        isCurrent: true
                    }
                });
            }
        }

        // Create a lab note for Lab A
        await prisma.helpLabNote.upsert({
            where: {
                articleId_labId: {
                    articleId: testArticleId,
                    labId: labA
                }
            },
            update: {
                noteText: 'Confidential SOP procedure for Lab Alpha only',
                authorId: 'manager-a',
                isActive: true
            },
            create: {
                articleId: testArticleId,
                labId: labA,
                noteText: 'Confidential SOP procedure for Lab Alpha only',
                authorId: 'manager-a',
                isActive: true
            }
        });
    });

    afterAll(async () => {
        // Clean up test lab note and test publications
        await prisma.helpLabNote.deleteMany({
            where: { labId: labA }
        });
        await prisma.helpPublication.deleteMany({
            where: { articleId: { in: [testArticleId, 'bench-drying'] } }
        });
    });

    test('Lab A user sees Lab A note on article', async () => {
        const article = await helpContentService.getArticleById(
            testArticleId,
            { role: 'LAB_TECHNICIAN', labId: labA },
            'en'
        );
        expect(article).toBeDefined();
        expect(article.labNote).toBeDefined();
        expect(article.labNote.noteText).toBe('Confidential SOP procedure for Lab Alpha only');
    });

    test('Lab B user NEVER sees Lab A note on article', async () => {
        const article = await helpContentService.getArticleById(
            testArticleId,
            { role: 'LAB_TECHNICIAN', labId: labB },
            'en'
        );
        expect(article).toBeDefined();
        expect(article.labNote).toBeNull();
    });

    test('Unauthenticated user NEVER sees Lab A note', async () => {
        const article = await helpContentService.getArticleById(
            testArticleId,
            null,
            'en'
        );
        expect(article).toBeDefined();
        expect(article.labNote).toBeNull();
    });

    test('Unauthenticated user cannot access AUTHENTICATED articles', async () => {
        // Find an authenticated article (e.g. bench-drying or review-results)
        const article = await helpContentService.getArticleById(
            'bench-drying',
            null, // unauthenticated
            'en'
        );
        expect(article).toBeNull();
    });

    test('Authenticated user CAN access AUTHENTICATED articles', async () => {
        const article = await helpContentService.getArticleById(
            'bench-drying',
            { role: 'LAB_TECHNICIAN', labId: labA },
            'en'
        );
        expect(article).toBeDefined();
        expect(article.id).toBe('bench-drying');
    });
});
