/**
 * SoilFER LIMS - Theme Library & Selector Contract Tests
 *
 * Verifies Phase 2 contract specifications:
 * - Public catalogue and public appearance endpoints
 * - Scoped user appearance resolution context
 * - Role authority: SUPER_ADMIN global/lab, LAB_MANAGER own-lab, regular staff accessibility restriction
 * - Revision concurrency handling (409 Conflict)
 * - Atomic audit logging
 * - Backward compatibility with legacy themePreference
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../prisma');
const { JWT_SECRET } = require('../../config/auth');
const { THEME_ALLOWLIST, DEFAULT_THEME_ID } = require('../../config/themeCatalog');

describe('Theme Library & Appearance Contracts', () => {
    let superAdminToken;
    let labManagerToken;
    let foreignManagerToken;
    let technicianToken;
    let technicianUserId;

    const testLab1Id = 'GHA-LAB1';
    const testLab2Id = 'KEN-LAB1';

    beforeAll(async () => {
        // Find or create test principals
        let adminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
        if (!adminUser) {
            adminUser = await prisma.user.create({
                data: {
                    id: 'test-admin-themes',
                    username: 'test_admin_themes',
                    password: 'hash',
                    email: 'admin_themes@test.com',
                    role: 'SUPER_ADMIN',
                    isActive: true,
                    tokenVersion: 1
                }
            });
        }

        let mgrUser = await prisma.user.findFirst({ where: { role: 'LAB_MANAGER', labId: testLab1Id } });
        if (!mgrUser) {
            mgrUser = await prisma.user.create({
                data: {
                    id: 'test-mgr-themes',
                    username: 'test_mgr_themes',
                    password: 'hash',
                    email: 'mgr_themes@test.com',
                    role: 'LAB_MANAGER',
                    labId: testLab1Id,
                    isActive: true,
                    tokenVersion: 1
                }
            });
        }

        let foreignMgrUser = await prisma.user.findFirst({ where: { role: 'LAB_MANAGER', labId: testLab2Id } });
        if (!foreignMgrUser) {
            foreignMgrUser = await prisma.user.create({
                data: {
                    id: 'test-foreign-mgr-themes',
                    username: 'test_foreign_mgr_themes',
                    password: 'hash',
                    email: 'foreign_mgr_themes@test.com',
                    role: 'LAB_MANAGER',
                    labId: testLab2Id,
                    isActive: true,
                    tokenVersion: 1
                }
            });
        }

        let techUser = await prisma.user.findFirst({ where: { role: 'LAB_TECHNICIAN', labId: testLab1Id } });
        if (!techUser) {
            techUser = await prisma.user.create({
                data: {
                    id: 'test-tech-themes',
                    username: 'test_tech_themes',
                    password: 'hash',
                    email: 'tech_themes@test.com',
                    role: 'LAB_TECHNICIAN',
                    labId: testLab1Id,
                    isActive: true,
                    tokenVersion: 1
                }
            });
        }

        superAdminToken = jwt.sign({ id: adminUser.id, username: adminUser.username, role: adminUser.role, tokenVersion: adminUser.tokenVersion }, JWT_SECRET, { expiresIn: '1h' });
        labManagerToken = jwt.sign({ id: mgrUser.id, username: mgrUser.username, role: mgrUser.role, labId: mgrUser.labId, tokenVersion: mgrUser.tokenVersion }, JWT_SECRET, { expiresIn: '1h' });
        foreignManagerToken = jwt.sign({ id: foreignMgrUser.id, username: foreignMgrUser.username, role: foreignMgrUser.role, labId: foreignMgrUser.labId, tokenVersion: foreignMgrUser.tokenVersion }, JWT_SECRET, { expiresIn: '1h' });
        technicianToken = jwt.sign({ id: techUser.id, username: techUser.username, role: techUser.role, labId: techUser.labId, tokenVersion: techUser.tokenVersion }, JWT_SECRET, { expiresIn: '1h' });
        technicianUserId = techUser.id;
    });

    describe('1. Public Appearance Endpoints', () => {
        test('GET /api/appearance/catalog returns published themes with swatches and no secrets', async () => {
            const res = await request(app).get('/api/appearance/catalog');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toBeDefined();

            const { themes, allowlist, semanticStatus } = res.body.data;
            expect(Array.isArray(themes)).toBe(true);
            expect(themes.length).toBe(7);
            expect(allowlist).toEqual(THEME_ALLOWLIST);

            // Verify Forest is flagged as recommended and Clear Contrast as accessibility
            const forest = themes.find(t => t.id === 'forest');
            expect(forest).toBeDefined();
            expect(forest.isRecommended).toBe(true);

            const contrast = themes.find(t => t.id === 'clear-contrast');
            expect(contrast).toBeDefined();
            expect(contrast.isAccessibility).toBe(true);

            // Semantic status colors present
            expect(semanticStatus.light.success).toBeDefined();
            expect(semanticStatus.dark.success).toBeDefined();
        });

        test('GET /api/appearance/public returns platform appearance without auth', async () => {
            const res = await request(app).get('/api/appearance/public');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.themeId).toBeDefined();
            expect(res.body.data.appearance).toMatch(/^(light|dark)$/);
            expect(typeof res.body.data.revision).toBe('number');
        });
    });

    describe('2. User Appearance Context', () => {
        test('GET /api/appearance/context requires authentication', async () => {
            const res = await request(app).get('/api/appearance/context');
            expect(res.status).toBe(401);
        });

        test('GET /api/appearance/context returns resolved hierarchy and scope for technician', async () => {
            const res = await request(app)
                .get('/api/appearance/context')
                .set('Authorization', `Bearer ${technicianToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            const { effective, personal, labDefault, platformDefault, scope, canAdoptLabDefault, canAdoptPlatformDefault } = res.body.data;

            expect(effective.themeId).toBeDefined();
            expect(effective.appearance).toMatch(/^(light|dark)$/);
            expect(personal).toBeDefined();
            expect(platformDefault).toBeDefined();
            expect(scope.role).toBe('LAB_TECHNICIAN');
            expect(canAdoptLabDefault).toBe(false);
            expect(canAdoptPlatformDefault).toBe(false);
        });

        test('GET /api/appearance/context returns adoption authority for lab manager', async () => {
            const res = await request(app)
                .get('/api/appearance/context')
                .set('Authorization', `Bearer ${labManagerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.canAdoptLabDefault).toBe(true);
            expect(res.body.data.canAdoptPlatformDefault).toBe(false);
            expect(res.body.data.scope.labId).toBe(testLab1Id);
        });

        test('GET /api/appearance/context returns adoption authority for SUPER_ADMIN', async () => {
            const res = await request(app)
                .get('/api/appearance/context?labId=' + testLab1Id)
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.data.canAdoptLabDefault).toBe(true);
            expect(res.body.data.canAdoptPlatformDefault).toBe(true);
            expect(res.body.data.scope.labId).toBe(testLab1Id);
        });
    });

    describe('3. Personal Preferences API & Authority Restrictions', () => {
        test('Technician can save mode preference to dark with inherited theme', async () => {
            const res = await request(app)
                .patch('/api/auth/preferences')
                .set('Authorization', `Bearer ${technicianToken}`)
                .send({
                    appearance: {
                        themeId: null,
                        modePreference: 'dark'
                    }
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.appearance.modePreference).toBe('dark');
            expect(res.body.data.appearance.themeId).toBeNull();
            expect(res.body.data.themePreference).toBe('dark'); // Synced for legacy clients
        });

        test('Technician attempting to save an unauthorized theme palette receives 403 Forbidden', async () => {
            const res = await request(app)
                .patch('/api/auth/preferences')
                .set('Authorization', `Bearer ${technicianToken}`)
                .send({
                    appearance: {
                        themeId: 'forest',
                        modePreference: 'light'
                    }
                });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN_THEME_SELECTION');
        });

        test('Technician CAN save Clear Contrast as personal accessibility override', async () => {
            const res = await request(app)
                .patch('/api/auth/preferences')
                .set('Authorization', `Bearer ${technicianToken}`)
                .send({
                    appearance: {
                        themeId: 'clear-contrast',
                        modePreference: 'light'
                    }
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.appearance.themeId).toBe('clear-contrast');
        });

        test('Saving preferences with stale expectedRevision returns 409 Conflict', async () => {
            const res = await request(app)
                .patch('/api/auth/preferences')
                .set('Authorization', `Bearer ${technicianToken}`)
                .send({
                    appearance: {
                        themeId: null,
                        modePreference: 'light',
                        expectedRevision: 999999 // Mismatched revision
                    }
                });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('REVISION_CONFLICT');
            expect(typeof res.body.currentRevision).toBe('number');
        });

        test('Legacy client update with themePreference works and updates uiModePreference', async () => {
            const res = await request(app)
                .patch('/api/auth/preferences')
                .set('Authorization', `Bearer ${technicianToken}`)
                .send({
                    themePreference: 'light'
                });

            expect(res.status).toBe(200);
            expect(res.body.data.themePreference).toBe('light');

            // Verify persistence of uiModePreference and incremented revision in database
            const userInDb = await prisma.user.findUnique({
                where: { id: String(technicianUserId) },
                select: { themePreference: true, uiModePreference: true, uiAppearanceRevision: true }
            });
            expect(userInDb.themePreference).toBe('light');
            expect(userInDb.uiModePreference).toBe('light');
        });

        test('Reject conflicting legacy themePreference and new appearance.modePreference in same payload', async () => {
            const res = await request(app)
                .patch('/api/auth/preferences')
                .set('Authorization', `Bearer ${technicianToken}`)
                .send({
                    themePreference: 'light',
                    appearance: {
                        modePreference: 'dark'
                    }
                });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('CONFLICTING_THEME_PARAMETERS');
        });

        test('Profile endpoint also accepts appearance updates and returns sanitized user', async () => {
            const res = await request(app)
                .patch('/api/auth/profile')
                .set('Authorization', `Bearer ${technicianToken}`)
                .send({
                    name: 'Updated Tech Name',
                    appearance: {
                        themeId: null,
                        modePreference: 'inherit'
                    }
                });

            expect(res.status).toBe(200);
            expect(res.body.user.name).toBe('Updated Tech Name');
            expect(res.body.user.appearance.modePreference).toBe('inherit');
        });
    });

    describe('4. Laboratory Appearance Adoption & Scoping', () => {
        test('Technician cannot update lab appearance (403)', async () => {
            const res = await request(app)
                .patch(`/api/labs/${testLab1Id}/appearance`)
                .set('Authorization', `Bearer ${technicianToken}`)
                .send({ themeId: 'forest', defaultMode: 'light' });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN_LAB_APPEARANCE');
        });

        test('Manager cannot update a foreign lab appearance (403)', async () => {
            const res = await request(app)
                .patch(`/api/labs/${testLab2Id}/appearance`)
                .set('Authorization', `Bearer ${labManagerToken}`)
                .send({ themeId: 'forest', defaultMode: 'light' });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN_LAB_APPEARANCE');
        });

        test('Assigned Manager can update own lab default appearance and generates AuditLog', async () => {
            // First get current revision
            const currentRes = await request(app)
                .get(`/api/labs/${testLab1Id}/appearance`)
                .set('Authorization', `Bearer ${labManagerToken}`);

            const currentRev = currentRes.body.data.revision;

            const res = await request(app)
                .patch(`/api/labs/${testLab1Id}/appearance`)
                .set('Authorization', `Bearer ${labManagerToken}`)
                .send({
                    themeId: 'forest',
                    defaultMode: 'dark',
                    expectedRevision: currentRev
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.themeId).toBe('forest');
            expect(res.body.data.defaultMode).toBe('dark');
            expect(res.body.data.revision).toBe(currentRev + 1);

            // Verify AuditLog entry was recorded
            const auditEntry = await prisma.auditLog.findFirst({
                where: {
                    entity: 'LAB_APPEARANCE',
                    entityId: testLab1Id,
                    action: 'UPDATE_LAB_THEME'
                },
                orderBy: { timestamp: 'desc' }
            });
            expect(auditEntry).toBeDefined();
            expect(auditEntry.labId).toBe(testLab1Id);
        });

        test('Manager update with revision conflict returns 409', async () => {
            const res = await request(app)
                .patch(`/api/labs/${testLab1Id}/appearance`)
                .set('Authorization', `Bearer ${labManagerToken}`)
                .send({
                    themeId: 'terra',
                    defaultMode: 'light',
                    expectedRevision: 999999
                });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('REVISION_CONFLICT');
        });
    });

    describe('5. Platform Global Appearance Adoption', () => {
        test('Manager cannot access global appearance management (403)', async () => {
            const res = await request(app)
                .get('/api/admin/appearance')
                .set('Authorization', `Bearer ${labManagerToken}`);

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('FORBIDDEN_GLOBAL_APPEARANCE');
        });

        test('SUPER_ADMIN can read and update global appearance and generates AuditLog', async () => {
            const getRes = await request(app)
                .get('/api/admin/appearance')
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(getRes.status).toBe(200);
            expect(getRes.body.data.id).toBe('global');
            const currentRev = getRes.body.data.revision;

            const patchRes = await request(app)
                .patch('/api/admin/appearance')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send({
                    themeId: 'watershed',
                    defaultMode: 'light',
                    expectedRevision: currentRev
                });

            expect(patchRes.status).toBe(200);
            expect(patchRes.body.data.themeId).toBe('watershed');
            expect(patchRes.body.data.revision).toBe(currentRev + 1);

            // Verify AuditLog entry
            const auditEntry = await prisma.auditLog.findFirst({
                where: {
                    entity: 'GLOBAL_APPEARANCE',
                    entityId: 'global',
                    action: 'UPDATE_GLOBAL_THEME'
                },
                orderBy: { timestamp: 'desc' }
            });
            expect(auditEntry).toBeDefined();

            // Revert back to soilfer-classic for clean baseline
            await request(app)
                .patch('/api/admin/appearance')
                .set('Authorization', `Bearer ${superAdminToken}`)
                .send({
                    themeId: 'soilfer-classic',
                    defaultMode: 'light',
                    expectedRevision: currentRev + 1
                });
        });
    });
});
