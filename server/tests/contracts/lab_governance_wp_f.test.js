'use strict';

/**
 * Work Package F (WP-F) Contract Tests:
 * Connected Services Scoping, Integration Keys, and Preflight Migration Audits
 * 
 * Verifies:
 * 1. Kobo Standalone Config Scoping (LG-13, LG-25):
 *    - Lab managers cannot read, edit, or trigger sync for foreign lab configurations
 *    - Global sync-all is strictly forbidden for non-super-admins
 * 2. SIS API Key Administration & Scoping (LG-28):
 *    - Key creation strictly requires explicit non-empty lab scope
 *    - Rejects omitted or empty labs array to prevent consumer denial
 *    - Validates target lab existence before issuance
 *    - Creation and revocation are audited
 * 3. Read-only Preflight Governance Report:
 *    - Executes non-destructively and validates zero-secrets invariant
 */

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/auth');
const { runPreflight } = require('../../scripts/preflight_governance_report');

describe('WP-F: Connected Services & Integration Governance', () => {
    const SUFFIX = 'WPF-' + Date.now();

    let labA, labB;
    let superAdmin, managerA, managerB;
    let tokenSA, tokenMgrA, tokenMgrB;

    beforeAll(async () => {
        // Create 2 test labs
        labA = await prisma.lab.create({
            data: {
                id: 'lab-wpf-A-' + SUFFIX,
                code: 'FA-' + Date.now().toString().slice(-4),
                name: 'Connected Lab A ' + SUFFIX,
                country: 'Guatemala',
                timezone: 'America/Guatemala',
                isActive: true
            }
        });

        labB = await prisma.lab.create({
            data: {
                id: 'lab-wpf-B-' + SUFFIX,
                code: 'FB-' + Date.now().toString().slice(-4),
                name: 'Connected Lab B ' + SUFFIX,
                country: 'Guatemala',
                timezone: 'America/Guatemala',
                isActive: true
            }
        });

        // Create users
        superAdmin = await prisma.user.create({
            data: {
                id: 'usr-sa-wpf-' + SUFFIX,
                username: 'sa_wpf_' + SUFFIX,
                email: ('sa_wpf_' + SUFFIX + '@test.org').toLowerCase(),
                name: 'Super Admin WPF',
                password: 'hash',
                role: 'SUPER_ADMIN',
                isActive: true,
                tokenVersion: 1
            }
        });

        managerA = await prisma.user.create({
            data: {
                id: 'usr-mgrA-wpf-' + SUFFIX,
                username: 'mgrA_wpf_' + SUFFIX,
                email: ('mgrA_wpf_' + SUFFIX + '@test.org').toLowerCase(),
                name: 'Manager Lab A WPF',
                password: 'hash',
                role: 'LAB_MANAGER',
                labId: labA.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        managerB = await prisma.user.create({
            data: {
                id: 'usr-mgrB-wpf-' + SUFFIX,
                username: 'mgrB_wpf_' + SUFFIX,
                email: ('mgrB_wpf_' + SUFFIX + '@test.org').toLowerCase(),
                name: 'Manager Lab B WPF',
                password: 'hash',
                role: 'LAB_MANAGER',
                labId: labB.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        // Seed a Kobo config for Lab A
        await prisma.koboConfig.create({
            data: {
                labId: labA.id,
                koboServerUrl: 'https://kf.kobotoolbox.org',
                formId: 'form-wpf-a',
                apiToken: 'secret_token_lab_a_1234',
                isActive: true
            }
        });

        tokenSA = jwt.sign({ id: superAdmin.id, role: superAdmin.role, username: superAdmin.username, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenMgrA = jwt.sign({ id: managerA.id, role: managerA.role, username: managerA.username, labId: managerA.labId, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
        tokenMgrB = jwt.sign({ id: managerB.id, role: managerB.role, username: managerB.username, labId: managerB.labId, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '1h' });
    });

    afterAll(async () => {
        try {
            await prisma.koboConfig.deleteMany({ where: { labId: { in: [labA.id, labB.id] } } }).catch(() => {});
            await prisma.apiKey.deleteMany({ where: { createdBy: superAdmin.username } }).catch(() => {});
            await prisma.user.deleteMany({ where: { id: { in: [superAdmin.id, managerA.id, managerB.id] } } }).catch(() => {});
            await prisma.lab.deleteMany({ where: { id: { in: [labA.id, labB.id] } } }).catch(() => {});
        } catch {}
    });

    // ──────────────────────────────────────────────────────────
    // 1. Kobo Standalone Scoping (LG-13, LG-25)
    // ──────────────────────────────────────────────────────────

    describe('1. Kobo Integration Target-Lab Scope Enforcement', () => {
        test('Manager A can read Kobo configuration for own lab', async () => {
            const res = await request(app)
                .get(`/api/kobo/config/${labA.id}`)
                .set('Authorization', `Bearer ${tokenMgrA}`);

            expect(res.status).toBe(200);
            expect(res.body.configured).toBe(true);
            expect(res.body.apiToken).toContain('••••••••');
        });

        test('Manager B is rejected when attempting to read Lab A Kobo configuration', async () => {
            const res = await request(app)
                .get(`/api/kobo/config/${labA.id}`)
                .set('Authorization', `Bearer ${tokenMgrB}`);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('TARGET_OUTSIDE_SCOPE');
        });

        test('Manager B is rejected when attempting to update Lab A Kobo configuration', async () => {
            const res = await request(app)
                .put(`/api/kobo/config/${labA.id}`)
                .set('Authorization', `Bearer ${tokenMgrB}`)
                .send({
                    formId: 'hacked-form',
                    apiToken: 'hacked-token'
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('TARGET_OUTSIDE_SCOPE');
        });

        test('Manager B is rejected when attempting to trigger sync for Lab A', async () => {
            const res = await request(app)
                .post(`/api/kobo/sync/${labA.id}`)
                .set('Authorization', `Bearer ${tokenMgrB}`);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('TARGET_OUTSIDE_SCOPE');
        });

        test('Manager A is rejected when attempting to trigger global sync-all', async () => {
            const res = await request(app)
                .post('/api/kobo/sync-all')
                .set('Authorization', `Bearer ${tokenMgrA}`);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('FORBIDDEN');
            expect(res.body.message).toContain('restricted to Super Administrators');
        });

        test('Listing Kobo configs scopes output: Manager A only receives Lab A config', async () => {
            const res = await request(app)
                .get('/api/kobo/configs')
                .set('Authorization', `Bearer ${tokenMgrA}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.every(c => c.labId === labA.id)).toBe(true);
        });
    });

    // ──────────────────────────────────────────────────────────
    // 2. SIS API Key Administration & Validation (LG-28)
    // ──────────────────────────────────────────────────────────

    describe('2. SIS API Key Administration (LG-28)', () => {
        test('Creating an SIS API key without explicit labs scope is rejected with 400', async () => {
            const res = await request(app)
                .post('/api/v1/sis/keys')
                .set('Authorization', `Bearer ${tokenSA}`)
                .send({
                    name: 'Test Empty Scope Key',
                    role: 'NSIS_CONSUMER'
                    // labs omitted
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('INVALID_LAB_SCOPE');
        });

        test('Creating an SIS API key with empty labs array [] is rejected with 400', async () => {
            const res = await request(app)
                .post('/api/v1/sis/keys')
                .set('Authorization', `Bearer ${tokenSA}`)
                .send({
                    name: 'Test Empty Array Key',
                    role: 'NSIS_CONSUMER',
                    labs: []
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('INVALID_LAB_SCOPE');
        });

        test('Creating an SIS API key with nonexistent lab ID is rejected with 400', async () => {
            const res = await request(app)
                .post('/api/v1/sis/keys')
                .set('Authorization', `Bearer ${tokenSA}`)
                .send({
                    name: 'Test Nonexistent Lab Key',
                    role: 'NSIS_CONSUMER',
                    labs: ['DOES-NOT-EXIST-LAB']
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('INVALID_LAB_ID');
        });

        test('Creating an SIS API key with valid lab scope succeeds and audits creation', async () => {
            const res = await request(app)
                .post('/api/v1/sis/keys')
                .set('Authorization', `Bearer ${tokenSA}`)
                .send({
                    name: 'National GIS Ingestion Key ' + SUFFIX,
                    role: 'NSIS_CONSUMER',
                    labs: [labA.id]
                });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            expect(res.body.apiKey).toMatch(/^slims_live_/);
            expect(res.body.keyInfo.labs).toEqual([labA.id]);

            // Verify audit log exists
            const audit = await prisma.auditLog.findFirst({
                where: {
                    entity: 'SIS_API_KEY',
                    action: 'SIS_KEY_CREATED',
                    entityId: res.body.keyInfo.id
                }
            });
            expect(audit).not.toBeNull();

            // Revoking the key succeeds and audits revocation
            const revokeRes = await request(app)
                .delete(`/api/v1/sis/keys/${res.body.keyInfo.id}`)
                .set('Authorization', `Bearer ${tokenSA}`);

            expect(revokeRes.status).toBe(200);

            const revokeAudit = await prisma.auditLog.findFirst({
                where: {
                    entity: 'SIS_API_KEY',
                    action: 'SIS_KEY_REVOKED',
                    entityId: res.body.keyInfo.id
                }
            });
            expect(revokeAudit).not.toBeNull();
        });

        test('Non-super-admin cannot create or list SIS API keys', async () => {
            const listRes = await request(app)
                .get('/api/v1/sis/keys')
                .set('Authorization', `Bearer ${tokenMgrA}`);

            expect(listRes.status).toBe(403);

            const createRes = await request(app)
                .post('/api/v1/sis/keys')
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    name: 'Unauthorized Key',
                    labs: [labA.id]
                });

            expect(createRes.status).toBe(403);
        });
    });

    // ──────────────────────────────────────────────────────────
    // 3. Read-Only Governance Preflight Audit
    // ──────────────────────────────────────────────────────────

    describe('3. Read-Only Governance Preflight Verification', () => {
        test('runPreflight executes cleanly and guarantees zero secret leakage', async () => {
            const summary = await runPreflight();

            expect(summary).toBeDefined();
            expect(summary.identities.totalUsers).toBeGreaterThan(0);
            expect(summary.identities.superAdminCount).toBeGreaterThanOrEqual(1);
            expect(summary.identities.lastAdminProtected).toBe(true);
            expect(summary.laboratories.totalLabs).toBeGreaterThan(0);
            expect(summary.securityVerification.zeroSecretsEmitted).toBe(true);
            expect(summary.securityVerification.passwordHashesExported).toBe(false);
            expect(summary.securityVerification.apiTokensExported).toBe(false);
        });
    });
});
