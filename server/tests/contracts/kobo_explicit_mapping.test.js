'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createHash } = require('crypto');
const Database = require('better-sqlite3');

// 1. Ensure 100% database isolation with temporary fixture DB
const sourcePath = path.join(__dirname, '../../prisma/dev.db');
const devDbHashBefore = createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kobo-mapping-test-'));
const fixtureDbPath = path.join(tmpDir, 'fixture.db');

const sourceDb = new Database(sourcePath, { readonly: true, fileMustExist: true });
const ddl = sourceDb.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND type IN ('table','index') ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END").all();
sourceDb.close();

const fixtureDb = new Database(fixtureDbPath);
fixtureDb.pragma('foreign_keys=OFF');
for (const row of ddl) {
    fixtureDb.exec(row.sql);
}
fixtureDb.close();

process.env.DATABASE_PATH = fixtureDbPath;
process.env.DATABASE_URL = 'file:' + fixtureDbPath;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-kobo-explicit-mapping';

const prisma = require('../../prisma');
const express = require('express');
const jwt = require('jsonwebtoken');
const koboService = require('../../services/koboService');

// Mock external Kobo service calls - zero network calls
jest.mock('../../services/koboService', () => ({
    fetchSubmissions: jest.fn(),
    transformSubmission: jest.fn(),
    findValue: jest.fn((obj, keys) => {
        for (const k of keys) {
            if (obj && obj[k] !== undefined) return obj[k];
        }
        return null;
    })
}));

const projectRoutes = require('../../routes/projectRoutes');
const koboRoutes = require('../../routes/koboRoutes');

const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);
app.use('/api/kobo', koboRoutes);

describe('K01: Kobo Explicit Destination & Mapping Invariant Tests', () => {
    const SUFFIX = 'K01-' + Date.now();
    let labA, labB, labC;
    let proj1, proj2, projPaused;
    let configA1, configA2, configB1;
    let tokenAdmin, tokenLabA, tokenLabB, tokenLabC;

    beforeAll(async () => {
        // Setup 3 labs
        labA = await prisma.lab.create({
            data: { id: 'LAB-A-' + SUFFIX, code: 'LA-' + SUFFIX.slice(-3), name: 'Lab A ' + SUFFIX, country: 'Guatemala', isActive: true }
        });
        labB = await prisma.lab.create({
            data: { id: 'LAB-B-' + SUFFIX, code: 'LB-' + SUFFIX.slice(-3), name: 'Lab B ' + SUFFIX, country: 'Honduras', isActive: true }
        });
        labC = await prisma.lab.create({
            data: { id: 'LAB-C-' + SUFFIX, code: 'LC-' + SUFFIX.slice(-3), name: 'Lab C ' + SUFFIX, country: 'El Salvador', isActive: true }
        });

        // Setup users
        const adminUser = await prisma.user.create({
            data: { id: 'usr-adm-' + SUFFIX, username: 'adm_' + SUFFIX, email: 'adm@' + SUFFIX + '.test', password: 'h', role: 'SUPER_ADMIN', tokenVersion: 1 }
        });
        const userA = await prisma.user.create({
            data: { id: 'usr-a-' + SUFFIX, username: 'user_a_' + SUFFIX, email: 'a@' + SUFFIX + '.test', password: 'h', role: 'LAB_MANAGER', labId: labA.id, tokenVersion: 1 }
        });
        const userB = await prisma.user.create({
            data: { id: 'usr-b-' + SUFFIX, username: 'user_b_' + SUFFIX, email: 'b@' + SUFFIX + '.test', password: 'h', role: 'LAB_MANAGER', labId: labB.id, tokenVersion: 1 }
        });
        const userC = await prisma.user.create({
            data: { id: 'usr-c-' + SUFFIX, username: 'user_c_' + SUFFIX, email: 'c@' + SUFFIX + '.test', password: 'h', role: 'LAB_MANAGER', labId: labC.id, tokenVersion: 1 }
        });

        tokenAdmin = 'Bearer ' + jwt.sign({ id: adminUser.id, username: adminUser.username, role: adminUser.role, tokenVersion: 1 }, process.env.JWT_SECRET);
        tokenLabA = 'Bearer ' + jwt.sign({ id: userA.id, username: userA.username, role: userA.role, labId: labA.id, tokenVersion: 1 }, process.env.JWT_SECRET);
        tokenLabB = 'Bearer ' + jwt.sign({ id: userB.id, username: userB.username, role: userB.role, labId: labB.id, tokenVersion: 1 }, process.env.JWT_SECRET);
        tokenLabC = 'Bearer ' + jwt.sign({ id: userC.id, username: userC.username, role: userC.role, labId: labC.id, tokenVersion: 1 }, process.env.JWT_SECRET);

        // Projects
        proj1 = await prisma.project.create({
            data: {
                id: 'PROJ-1-' + SUFFIX,
                code: 'PROJ-1-' + SUFFIX,
                name: 'Project 1 ' + SUFFIX,
                status: 'ACTIVE',
                projectType: 'KOBO_LINKED',
                labId: labA.id
            }
        });
        // Associate labB to proj1
        await prisma.projectLab.create({
            data: { id: 'PL-1-' + SUFFIX, projectCode: proj1.code, labId: labB.id }
        });

        proj2 = await prisma.project.create({
            data: {
                id: 'PROJ-2-' + SUFFIX,
                code: 'PROJ-2-' + SUFFIX,
                name: 'Project 2 ' + SUFFIX,
                status: 'ACTIVE',
                projectType: 'KOBO_LINKED',
                labId: labA.id
            }
        });

        projPaused = await prisma.project.create({
            data: {
                id: 'PROJ-PAUSED-' + SUFFIX,
                code: 'PROJ-PAUSED-' + SUFFIX,
                name: 'Project Paused ' + SUFFIX,
                status: 'PAUSED',
                projectType: 'KOBO_LINKED',
                labId: labA.id
            }
        });

        // Kobo configurations:
        // Lab A has 2 active configs for PROJ-1 (e.g. 2 different field survey assets)
        configA1 = await prisma.koboConfig.create({
            data: {
                id: 'CFG-A1-' + SUFFIX,
                labId: labA.id,
                projectCode: proj1.code,
                koboServerUrl: 'https://kobo.fixture.test',
                formId: 'form_asset_1_' + SUFFIX,
                apiToken: 'token_123',
                isActive: true
            }
        });

        configA2 = await prisma.koboConfig.create({
            data: {
                id: 'CFG-A2-' + SUFFIX,
                labId: labA.id,
                projectCode: proj2.code,
                koboServerUrl: 'https://kobo.fixture.test',
                formId: 'form_asset_2_' + SUFFIX,
                apiToken: 'token_456',
                isActive: true
            }
        });

        // Lab B has 1 config for PROJ-1
        configB1 = await prisma.koboConfig.create({
            data: {
                id: 'CFG-B1-' + SUFFIX,
                labId: labB.id,
                projectCode: proj1.code,
                koboServerUrl: 'https://kobo.fixture.test',
                formId: 'form_b1_' + SUFFIX,
                apiToken: 'token_789',
                isActive: true
            }
        });
    });

    afterAll(async () => {
        await prisma.$disconnect();
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (e) {
            // ignore cleanup errors
        }

        // Verify dev.db was never modified
        const devDbHashAfter = createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
        expect(devDbHashAfter).toBe(devDbHashBefore);
    });

    const request = require('supertest');

    describe('1. Disambiguation in syncLab (POST /api/kobo/sync/:labId)', () => {
        it('rejects with 400 AMBIGUOUS_CONFIG_TARGET when laboratory has multiple active configs without explicit configId or projectCode', async () => {
            const res = await request(app)
                .post(`/api/kobo/sync/${labA.id}`)
                .set('Authorization', tokenAdmin);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('AMBIGUOUS_CONFIG_TARGET');
            expect(res.body.message).toContain('Explicit configId or projectCode is required');
        });

        it('resolves cleanly when explicit configId is specified for multi-asset lab', async () => {
            koboService.fetchSubmissions.mockResolvedValueOnce([]);

            const res = await request(app)
                .post(`/api/kobo/sync/${labA.id}?configId=${configA1.id}`)
                .set('Authorization', tokenAdmin);

            expect(res.status).toBe(200);
            expect(res.body.newSamples).toBe(0);
            expect(res.body.skipped).toBe(0);
            expect(res.body.message).toBe('No new submissions');
        });

        it('resolves cleanly when laboratory has exactly one active configuration', async () => {
            koboService.fetchSubmissions.mockResolvedValueOnce([]);

            const res = await request(app)
                .post(`/api/kobo/sync/${labB.id}`)
                .set('Authorization', tokenAdmin);

            expect(res.status).toBe(200);
            expect(res.body.newSamples).toBe(0);
            expect(res.body.skipped).toBe(0);
            expect(res.body.message).toBe('No new submissions');
        });
    });

    describe('2. Elimination of lab.projectLabs[0] Fallback in syncLabSubmissions', () => {
        it('throws explicit error and aborts import when config.projectCode is missing, even if lab has project assignments', async () => {
            // Create config without projectCode for labB (which has proj1 in projectLabs)
            const unmappedConfig = await prisma.koboConfig.create({
                data: {
                    id: 'CFG-UNMAPPED-' + SUFFIX,
                    labId: labB.id,
                    projectCode: null, // absent project mapping
                    koboServerUrl: 'https://kobo.fixture.test',
                    formId: 'form_unmapped_' + SUFFIX,
                    apiToken: 'token_unmapped',
                    isActive: true
                }
            });

            koboService.fetchSubmissions.mockResolvedValueOnce([
                { _id: 101, _uuid: 'u-101', 'sample_id': 'UNMAPPED-01' }
            ]);

            const res = await request(app)
                .post(`/api/kobo/sync/${labB.id}?configId=${unmappedConfig.id}`)
                .set('Authorization', tokenAdmin);

            // Must NOT guess lab.projectLabs[0]
            expect(res.status).toBe(500);
            expect(res.body.error).toContain('lacks an explicit project mapping (projectCode). First-project fallback is disallowed.');

            // Verify no sample was created
            const sample = await prisma.sample.findFirst({ where: { originalId: 'UNMAPPED-01' } });
            expect(sample).toBeNull();
        });
    });

    describe('3. Elimination of configs[0] Fallback in getProjectKoboConfig (GET /api/projects/:id/kobo-config)', () => {
        it('returns ambiguous: true for global admin when multiple configurations exist across labs without explicit disambiguation', async () => {
            const res = await request(app)
                .get(`/api/projects/${proj1.id}/kobo-config`)
                .set('Authorization', tokenAdmin);

            expect(res.status).toBe(200);
            expect(res.body.configured).toBe(false);
            expect(res.body.ambiguous).toBe(true);
            expect(res.body.message).toContain('Multiple Kobo configurations exist for this project across participating laboratories');
        });

        it('resolves unambiguously for lab manager whose laboratory has a configuration for the project', async () => {
            const res = await request(app)
                .get(`/api/projects/${proj1.id}/kobo-config`)
                .set('Authorization', tokenLabA);

            expect(res.status).toBe(200);
            expect(res.body.configured).toBe(true);
            expect(res.body.koboFormId).toBe(configA1.formId);
        });

        it('resolves unambiguously for second participating laboratory manager', async () => {
            const res = await request(app)
                .get(`/api/projects/${proj1.id}/kobo-config`)
                .set('Authorization', tokenLabB);

            expect(res.status).toBe(200);
            expect(res.body.configured).toBe(true);
            expect(res.body.koboFormId).toBe(configB1.formId);
        });

        it('returns 403 Access Denied when non-member laboratory attempts to access project kobo config', async () => {
            const res = await request(app)
                .get(`/api/projects/${proj2.id}/kobo-config`)
                .set('Authorization', tokenLabC);

            expect(res.status).toBe(403);
            expect(res.body.error).toContain('Access denied');
        });

        it('returns configured: false when authorized participating laboratory has no Kobo configuration', async () => {
            // Add labC as a member of proj1
            await prisma.projectLab.create({
                data: { id: 'PL-C1-' + SUFFIX, projectCode: proj1.code, labId: labC.id }
            });

            const res = await request(app)
                .get(`/api/projects/${proj1.id}/kobo-config`)
                .set('Authorization', tokenLabC);

            expect(res.status).toBe(200);
            expect(res.body.configured).toBe(false);
            expect(res.body.message).toContain('No Kobo configuration found for your laboratory scope');
        });

        it('resolves unambiguously for global admin when explicit configId query parameter is provided', async () => {
            const res = await request(app)
                .get(`/api/projects/${proj1.id}/kobo-config?configId=${configA1.id}`)
                .set('Authorization', tokenAdmin);

            expect(res.status).toBe(200);
            expect(res.body.configured).toBe(true);
            expect(res.body.koboFormId).toBe(configA1.formId);
        });

        it('resolves unambiguously for global admin when explicit labId query parameter is provided', async () => {
            const res = await request(app)
                .get(`/api/projects/${proj1.id}/kobo-config?labId=${labB.id}`)
                .set('Authorization', tokenAdmin);

            expect(res.status).toBe(200);
            expect(res.body.configured).toBe(true);
            expect(res.body.koboFormId).toBe(configB1.formId);
        });
    });

    describe('4. Admissions & Membership Commit-Time Protection in Kobo Sync', () => {
        it('truthfully skips intake when project admissions are paused', async () => {
            const pausedConfig = await prisma.koboConfig.create({
                data: {
                    id: 'CFG-PAUSED-' + SUFFIX,
                    labId: labA.id,
                    projectCode: projPaused.code,
                    koboServerUrl: 'https://kobo.fixture.test',
                    formId: 'form_paused_' + SUFFIX,
                    apiToken: 'token_paused',
                    isActive: true
                }
            });

            koboService.fetchSubmissions.mockResolvedValueOnce([
                { _id: 201, _uuid: 'u-201' },
                { _id: 202, _uuid: 'u-202' }
            ]);

            const res = await request(app)
                .post(`/api/kobo/sync/${labA.id}?configId=${pausedConfig.id}`)
                .set('Authorization', tokenAdmin);

            expect(res.status).toBe(200);
            expect(res.body.newSamples).toBe(0);
            expect(res.body.skipped).toBe(2);
            expect(res.body.message).toContain('admissions paused');
        });

        it('rejects sync when servicing lab is not an authorized member of the project', async () => {
            // Lab C is not authorized for proj2 (only Lab A is)
            const unauthorizedConfig = await prisma.koboConfig.create({
                data: {
                    id: 'CFG-UNAUTH-' + SUFFIX,
                    labId: labC.id,
                    projectCode: proj2.code,
                    koboServerUrl: 'https://kobo.fixture.test',
                    formId: 'form_unauth_' + SUFFIX,
                    apiToken: 'token_unauth',
                    isActive: true
                }
            });

            koboService.fetchSubmissions.mockResolvedValueOnce([
                { _id: 301, _uuid: 'u-301' }
            ]);

            const res = await request(app)
                .post(`/api/kobo/sync/${labC.id}?configId=${unauthorizedConfig.id}`)
                .set('Authorization', tokenAdmin);

            expect(res.status).toBe(500);
            expect(res.body.error).toContain('is not an authorized servicing laboratory for project');
        });
    });
});
