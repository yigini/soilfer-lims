const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/auth');

describe('Help Publication & Governance Security Contract Tests', () => {
    let superAdminToken;
    let labManagerToken;
    let technicianToken;
    let testArticleId = 'test-gov-article';

    let testUsers = [];
    const SUFFIX = 'HELPGOV-' + Date.now();

    beforeAll(async () => {
        // Create dedicated isolated test users with tokenVersion: 1
        const superAdmin = await prisma.user.create({
            data: {
                id: 'usr-sa-' + SUFFIX,
                username: 'sa_' + SUFFIX,
                role: 'SUPER_ADMIN',
                password: 'hash',
                email: 'sa_' + SUFFIX + '@example.com',
                tokenVersion: 1,
                isActive: true
            }
        });
        testUsers.push(superAdmin.id);
        superAdminToken = jwt.sign({ id: superAdmin.id, role: 'SUPER_ADMIN', tokenVersion: 1 }, JWT_SECRET);

        const labManager = await prisma.user.create({
            data: {
                id: 'usr-mgr-' + SUFFIX,
                username: 'mgr_' + SUFFIX,
                role: 'LAB_MANAGER',
                labId: 'lab-1',
                password: 'hash',
                email: 'mgr_' + SUFFIX + '@example.com',
                tokenVersion: 1,
                isActive: true
            }
        });
        testUsers.push(labManager.id);
        labManagerToken = jwt.sign({ id: labManager.id, role: 'LAB_MANAGER', tokenVersion: 1 }, JWT_SECRET);

        const tech = await prisma.user.create({
            data: {
                id: 'usr-tech-' + SUFFIX,
                username: 'tech_' + SUFFIX,
                role: 'LAB_TECHNICIAN',
                labId: 'lab-1',
                password: 'hash',
                email: 'tech_' + SUFFIX + '@example.com',
                tokenVersion: 1,
                isActive: true
            }
        });
        testUsers.push(tech.id);
        technicianToken = jwt.sign({ id: tech.id, role: 'LAB_TECHNICIAN', tokenVersion: 1 }, JWT_SECRET);

        // Clean up any test article
        await prisma.helpPublication.deleteMany({ where: { articleId: testArticleId } });
        await prisma.helpRevision.deleteMany({ where: { articleId: testArticleId } });
        await prisma.helpArticle.deleteMany({ where: { id: testArticleId } });

        // Create test article with draft revision 1
        await prisma.helpArticle.create({
            data: {
                id: testArticleId,
                category: 'bench',
                kind: 'guide',
                roles: '["all"]',
                keywords: '["test"]',
                visibility: 'AUTHENTICATED',
                revisions: {
                    create: {
                        revisionNumber: 1,
                        title: 'Test Article Title',
                        summary: 'Test summary',
                        steps: '["Step 1", "Step 2"]',
                        success: 'Success text',
                        caution: 'Caution text',
                        related: '[]',
                        sourceLocale: 'en',
                        sourceHash: 'test-hash-1',
                        changeReason: 'Initial test draft',
                        authorId: superAdmin.username,
                        locales: {
                            create: [
                                { locale: 'en', title: 'Test EN', summary: 'Summary EN', steps: '["Step 1"]', success: 'S', caution: 'C', reviewStatus: 'EDITORIAL_DRAFT' },
                                { locale: 'es', title: 'Test ES', summary: 'Summary ES', steps: '["Paso 1"]', success: 'S', caution: 'C', reviewStatus: 'TRANSLATION_REQUIRED' }
                            ]
                        }
                    }
                }
            }
        });
    });

    afterAll(async () => {
        await prisma.helpPublication.deleteMany({ where: { articleId: testArticleId } });
        await prisma.helpRevision.deleteMany({ where: { articleId: testArticleId } });
        await prisma.helpArticle.deleteMany({ where: { id: testArticleId } });
        if (testUsers.length > 0) {
            await prisma.user.deleteMany({ where: { id: { in: testUsers } } }).catch(() => {});
        }
    });

    test('1. Negative Gate: Publishing unreviewed revision is rejected with 422', async () => {
        const res = await request(app)
            .post(`/api/help/admin/articles/${testArticleId}/publish`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                revisionNumber: 1,
                approvedLocales: ['en']
            });

        expect(res.status).toBe(422);
        expect(res.body.error).toBe('UNREVIEWED_DRAFT_PUBLICATION_REJECTED');
        expect(res.body.status).toBe('EDITORIAL_DRAFT');
    });

    test('2. Negative Gate: Publishing with unapproved or missing locale is rejected with 422', async () => {
        const res = await request(app)
            .post(`/api/help/admin/articles/${testArticleId}/publish`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                revisionNumber: 1,
                approvedLocales: ['es']
            });

        expect(res.status).toBe(422);
        expect(res.body.error).toBe('UNREVIEWED_DRAFT_PUBLICATION_REJECTED');
        expect(res.body.status).toBe('TRANSLATION_REQUIRED');
    });

    test('3. Negative Gate: Non-super-admin / non-publisher cannot approve revisions (403)', async () => {
        const res = await request(app)
            .post(`/api/help/admin/articles/${testArticleId}/approve`)
            .set('Authorization', `Bearer ${technicianToken}`)
            .send({
                revisionNumber: 1,
                locale: 'en'
            });

        expect(res.status).toBe(403);
    });

    test('4. Dedicated Review & Approval Workflow: Request review transitions status to IN_REVIEW', async () => {
        const reqRes = await request(app)
            .post(`/api/help/admin/articles/${testArticleId}/request-review`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                revisionNumber: 1,
                locales: ['en', 'es']
            });

        expect(reqRes.status).toBe(200);
        expect(reqRes.body.success).toBe(true);

        const rev = await prisma.helpRevision.findFirst({
            where: { articleId: testArticleId, revisionNumber: 1 },
            include: { locales: true }
        });

        const enLoc = rev.locales.find(l => l.locale === 'en');
        const esLoc = rev.locales.find(l => l.locale === 'es');
        expect(enLoc.reviewStatus).toBe('IN_REVIEW');
        expect(esLoc.reviewStatus).toBe('IN_REVIEW');
    });

    test('5. Approval and Atomic Publication: After approval, publication succeeds atomically', async () => {
        // Approve en and es
        const appResEn = await request(app)
            .post(`/api/help/admin/articles/${testArticleId}/approve`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ revisionNumber: 1, locale: 'en' });
        expect(appResEn.status).toBe(200);

        const appResEs = await request(app)
            .post(`/api/help/admin/articles/${testArticleId}/approve`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ revisionNumber: 1, locale: 'es' });
        expect(appResEs.status).toBe(200);

        // Now publish with both approved locales
        const pubRes = await request(app)
            .post(`/api/help/admin/articles/${testArticleId}/publish`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                revisionNumber: 1,
                approvedLocales: ['en', 'es']
            });

        expect(pubRes.status).toBe(200);
        expect(pubRes.body.success).toBe(true);

        // Verify active publication exists in database
        const activePub = await prisma.helpPublication.findFirst({
            where: { articleId: testArticleId, isCurrent: true }
        });
        expect(activePub).toBeDefined();
        expect(JSON.parse(activePub.approvedLocales)).toEqual(['en', 'es']);
    });

    test('6. Immutability Gate: Once published, editing revision 1 returns 409 Conflict', async () => {
        const editRes = await request(app)
            .put(`/api/help/admin/articles/${testArticleId}/revisions/1/locales/en`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                title: 'Mutated Title',
                summary: 'Mutated summary'
            });

        expect(editRes.status).toBe(409);
        expect(editRes.body.error).toBe('IMMUTABLE_PUBLISHED_REVISION');
    });

    test('7. New Revision Workflow: Creating revision 2 creates a new draft without mutating published revision 1', async () => {
        const createRev2 = await request(app)
            .post(`/api/help/admin/articles/${testArticleId}/revisions`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                expectedRevisionNumber: 1,
                title: 'Updated Revision 2 Title',
                summary: 'Revision 2 summary',
                steps: ['New step 1', 'New step 2'],
                changeReason: 'Version 2 upgrade'
            });

        expect(createRev2.status).toBe(200);
        expect(createRev2.body.revisionNumber).toBe(2);

        // Verify revision 1 is still intact and current publication still points to revision 1
        const activePub = await prisma.helpPublication.findFirst({
            where: { articleId: testArticleId, isCurrent: true },
            include: { revision: true }
        });
        expect(activePub.revision.revisionNumber).toBe(1);

        // Verify revision 2 locales start as unreviewed drafts
        const rev2 = await prisma.helpRevision.findFirst({
            where: { articleId: testArticleId, revisionNumber: 2 },
            include: { locales: true }
        });
        const rev2En = rev2.locales.find(l => l.locale === 'en');
        const rev2Es = rev2.locales.find(l => l.locale === 'es');
        expect(rev2En.reviewStatus).toBe('EDITORIAL_DRAFT');
        expect(rev2Es.reviewStatus).toBe('TRANSLATION_REQUIRED');
    });

    test('8. Concurrency Gate: Publication with mismatched expectedRevisionNumber returns 409 Conflict', async () => {
        const conflictRes = await request(app)
            .post(`/api/help/admin/articles/${testArticleId}/publish`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({
                revisionNumber: 1,
                expectedRevisionNumber: 999, // Intentional conflict
                approvedLocales: ['en', 'es']
            });

        expect(conflictRes.status).toBe(409);
        expect(conflictRes.body.error).toBe('CONCURRENCY_CONFLICT');
    });
});
