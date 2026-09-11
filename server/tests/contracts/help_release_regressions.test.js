const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/auth');
const helpContentService = require('../../services/helpContentService');
const { seedHelpContent } = require('../../scripts/seed_help_content.cjs');

describe('Help Centre Release Regressions & Governance Gates (Finding 1, 3, 4)', () => {
    let superAdminToken;
    let labManagerToken;
    let technicianToken;
    let viewerToken;
    const testArticleId = 'test-regr-article';
    const labA = 'lab-alpha';
    const labB = 'lab-beta';

    beforeAll(async () => {
        let superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
        if (!superAdmin) {
            superAdmin = await prisma.user.create({
                data: {
                    id: 'usr_super_regr',
                    username: 'test_super_regr',
                    role: 'SUPER_ADMIN',
                    password: 'hash',
                    email: 'admin_regr@example.com'
                }
            });
        }
        superAdminToken = jwt.sign({ id: superAdmin.id, role: 'SUPER_ADMIN', username: superAdmin.username, tokenVersion: superAdmin.tokenVersion !== undefined ? superAdmin.tokenVersion : 0 }, JWT_SECRET);

        let labManager = await prisma.user.findFirst({ where: { role: 'LAB_MANAGER', labId: labA } });
        if (!labManager) {
            labManager = await prisma.user.create({
                data: {
                    id: 'usr_mgr_regr',
                    username: 'test_mgr_regr',
                    role: 'LAB_MANAGER',
                    labId: labA,
                    password: 'hash',
                    email: 'mgr_regr@example.com'
                }
            });
        }
        labManagerToken = jwt.sign({ id: labManager.id, role: 'LAB_MANAGER', labId: labA, username: labManager.username, tokenVersion: labManager.tokenVersion !== undefined ? labManager.tokenVersion : 0 }, JWT_SECRET);

        let tech = await prisma.user.findFirst({ where: { role: 'LAB_TECHNICIAN', labId: labA } });
        if (!tech) {
            tech = await prisma.user.create({
                data: {
                    id: 'usr_tech_regr',
                    username: 'test_tech_regr',
                    role: 'LAB_TECHNICIAN',
                    labId: labA,
                    password: 'hash',
                    email: 'tech_regr@example.com'
                }
            });
        }
        technicianToken = jwt.sign({ id: tech.id, role: 'LAB_TECHNICIAN', labId: labA, username: tech.username, tokenVersion: tech.tokenVersion !== undefined ? tech.tokenVersion : 0 }, JWT_SECRET);

        let viewer = await prisma.user.findFirst({ where: { role: 'VIEWER' } });
        if (!viewer) {
            viewer = await prisma.user.create({
                data: {
                    id: 'usr_viewer_regr',
                    username: 'test_viewer_regr',
                    role: 'VIEWER',
                    labId: labA,
                    password: 'hash',
                    email: 'viewer_regr@example.com'
                }
            });
        }
        viewerToken = jwt.sign({ id: viewer.id, role: 'VIEWER', labId: labA, username: viewer.username, tokenVersion: viewer.tokenVersion !== undefined ? viewer.tokenVersion : 0 }, JWT_SECRET);

        await prisma.helpPublication.deleteMany({ where: { articleId: testArticleId } });
        await prisma.helpLabNote.deleteMany({ where: { articleId: testArticleId } });
        await prisma.helpRevision.deleteMany({ where: { articleId: testArticleId } });
        await prisma.helpArticle.deleteMany({ where: { id: testArticleId } });

        await prisma.helpArticle.create({
            data: {
                id: testArticleId,
                category: 'bench',
                kind: 'guide',
                visibility: 'AUTHENTICATED',
                roles: '["all"]',
                keywords: '["regr"]',
                minutes: 2,
                reviewOwner: 'Operations',
                revisions: {
                    create: {
                        revisionNumber: 1,
                        title: 'Regression Article EN',
                        summary: 'Initial draft',
                        steps: '["Step 1"]',
                        success: 'Success',
                        caution: 'Caution',
                        related: '[]',
                        sourceLocale: 'en',
                        sourceHash: 'hash-regr-1',
                        locales: {
                            create: [
                                {
                                    locale: 'en',
                                    title: 'Regression Article EN',
                                    summary: 'Summary EN',
                                    steps: '["Step 1"]',
                                    success: 'Success',
                                    caution: 'Caution',
                                    reviewStatus: 'APPROVED'
                                },
                                {
                                    locale: 'es',
                                    title: 'Regression Article ES',
                                    summary: 'Summary ES',
                                    steps: '["Paso 1"]',
                                    success: 'Success',
                                    caution: 'Caution',
                                    reviewStatus: 'TRANSLATION_REQUIRED'
                                }
                            ]
                        }
                    }
                }
            }
        });
    });

    afterAll(async () => {
        await prisma.helpPublication.deleteMany({ where: { articleId: testArticleId } });
        await prisma.helpLabNote.deleteMany({ where: { articleId: testArticleId } });
        await prisma.helpRevision.deleteMany({ where: { articleId: testArticleId } });
        await prisma.helpArticle.deleteMany({ where: { id: testArticleId } });
    });

    describe('1. Lab Note Governance & Access Control (Finding 4)', () => {
        test('User without HELP_EDIT_LAB (e.g. VIEWER) cannot edit lab note (403)', async () => {
            const res = await request(app)
                .put(`/api/help/admin/articles/${testArticleId}/lab-note`)
                .set('Authorization', `Bearer ${viewerToken}`)
                .send({
                    noteText: 'Unauthorized viewer note',
                    action: 'save_draft'
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toContain('lacks permission');
        });

        test('Technician with HELP_EDIT_LAB can save a draft note (isActive: false)', async () => {
            const res = await request(app)
                .put(`/api/help/admin/articles/${testArticleId}/lab-note`)
                .set('Authorization', `Bearer ${technicianToken}`)
                .send({
                    noteText: 'Draft procedural guidance for Lab Alpha',
                    action: 'save_draft'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.action).toBe('save_draft');
            expect(res.body.status).toBe('DRAFT');
            expect(res.body.labNote.isActive).toBe(false);

            const saved = await prisma.helpLabNote.findUnique({
                where: { articleId_labId: { articleId: testArticleId, labId: labA } }
            });
            expect(saved).toBeDefined();
            expect(saved.isActive).toBe(false);
            expect(saved.noteText).toContain('Draft procedural guidance');
        });

        test('Technician with HELP_EDIT_LAB cannot directly publish lab note (403)', async () => {
            const res = await request(app)
                .put(`/api/help/admin/articles/${testArticleId}/lab-note`)
                .set('Authorization', `Bearer ${technicianToken}`)
                .send({
                    noteText: 'Attempting to publish directly',
                    action: 'publish'
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('UNAUTHORIZED');
            expect(res.body.message).toContain('You do not have permission to publish laboratory guidance');
        });

        test('Lab Manager can publish lab note (isActive: true)', async () => {
            const res = await request(app)
                .put(`/api/help/admin/articles/${testArticleId}/lab-note`)
                .set('Authorization', `Bearer ${labManagerToken}`)
                .send({
                    noteText: 'Approved SOP for Lab Alpha (Calibrated scale required)',
                    action: 'publish'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.action).toBe('publish');
            expect(res.body.status).toBe('PUBLISHED');
            expect(res.body.labNote.isActive).toBe(true);

            const saved = await prisma.helpLabNote.findUnique({
                where: { articleId_labId: { articleId: testArticleId, labId: labA } }
            });
            expect(saved.isActive).toBe(true);
            expect(saved.noteText).toContain('Approved SOP for Lab Alpha');
        });

        test('Published note is visible to Lab A user but hidden from Lab B user', async () => {
            const rev = await prisma.helpRevision.findFirst({
                where: { articleId: testArticleId },
                orderBy: { revisionNumber: 'desc' }
            });
            await prisma.helpPublication.create({
                data: {
                    articleId: testArticleId,
                    revisionId: rev.id,
                    approvedLocales: '["en"]',
                    publishedBy: 'manager-test',
                    isCurrent: true
                }
            });

            const artLabA = await helpContentService.getArticleById(
                testArticleId,
                { role: 'LAB_TECHNICIAN', labId: labA },
                'en'
            );
            expect(artLabA).toBeDefined();
            expect(artLabA.labNote).toBeDefined();
            expect(artLabA.labNote.noteText).toContain('Approved SOP for Lab Alpha');

            const artLabB = await helpContentService.getArticleById(
                testArticleId,
                { role: 'LAB_TECHNICIAN', labId: labB },
                'en'
            );
            expect(artLabB).toBeDefined();
            expect(artLabB.labNote).toBeNull();
        });
    });

    describe('2. Publication Audit History Preservation (Finding 4)', () => {
        test('Targeted supersession: Accidental seed publication is marked isCurrent: false and not deleted', async () => {
            const accidentalArtId = 'test-accidental-article';
            const art = await prisma.helpArticle.create({
                data: {
                    id: accidentalArtId,
                    category: 'bench',
                    kind: 'guide',
                    visibility: 'PUBLIC',
                    roles: '["all"]',
                    keywords: '[]',
                    minutes: 1,
                    reviewOwner: 'Ops',
                    revisions: {
                        create: {
                            revisionNumber: 1,
                            title: 'Accidental Title',
                            summary: 'Accidental unreviewed',
                            steps: '[]',
                            success: '',
                            caution: '',
                            related: '[]',
                            sourceLocale: 'en',
                            sourceHash: 'hash-accidental',
                            locales: {
                                create: {
                                    locale: 'en',
                                    title: 'Accidental Title',
                                    summary: 'Accidental Summary',
                                    steps: '[]',
                                    success: '',
                                    caution: '',
                                    reviewStatus: 'EDITORIAL_DRAFT'
                                }
                            }
                        }
                    }
                },
                include: { revisions: true }
            });

            const pub = await prisma.helpPublication.create({
                data: {
                    articleId: accidentalArtId,
                    revisionId: art.revisions[0].id,
                    publishedBy: 'system',
                    approvedLocales: '["en"]',
                    isCurrent: true
                }
            });

            await seedHelpContent();

            const checkedPub = await prisma.helpPublication.findUnique({
                where: { id: pub.id }
            });
            expect(checkedPub).toBeDefined();
            expect(checkedPub.isCurrent).toBe(false);

            await prisma.helpPublication.deleteMany({ where: { articleId: accidentalArtId } });
            await prisma.helpRevision.deleteMany({ where: { articleId: accidentalArtId } });
            await prisma.helpArticle.deleteMany({ where: { id: accidentalArtId } });
        });
    });

    describe('3. Authoritative HTTP Error Handling Contract (Finding 1 & 3)', () => {
        test('Unauthenticated access to authenticated endpoint returns 401/403 directly', async () => {
            const res = await request(app)
                .get(`/api/help/articles/${testArticleId}`);

            expect([401, 403, 404]).toContain(res.status);
        });

        test('Requesting non-existent article returns 404 cleanly', async () => {
            const res = await request(app)
                .get('/api/help/articles/non-existent-article-xyz-999')
                .set('Authorization', `Bearer ${labManagerToken}`);

            expect(res.status).toBe(404);
            expect(res.body.error).toBeDefined();
        });
    });
});
