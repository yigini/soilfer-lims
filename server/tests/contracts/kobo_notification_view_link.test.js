'use strict';

/**
 * Isolated Contract Test: Kobo Notification Deep Link & Samples View Parameter Lifecycle (Refs #120)
 *
 * Verifies:
 * 1. Kobo sync creates lab manager notification with deep link:
 *    `/samples?view=expected&projects=<PROJECT>&labs=<LAB>`
 * 2. Role-bound manager HTTP request to the notification link route `/api/samples?view=expected&projects=...&labs=...`:
 *    - Returns newly synced field records (status: 'EXPECTED') awaiting reception.
 *    - Excludes them from Active Lab Work (`view=daily`).
 *    - Exposes them in Field Registry (`view=registry`).
 * 3. Parameter lifecycle and backward/forward alias compatibility:
 *    - Canonical `projects` and `labs`
 *    - Singular aliases `project` and `lab`
 *    - Identifier aliases `projectId` and `labId`
 * 4. Cross-lab isolation: Manager B cannot view Manager A's expected arrivals via the scoped link.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createHash } = require('crypto');
const Database = require('better-sqlite3');
const request = require('supertest');
const jwt = require('jsonwebtoken');

// 1. Temporary isolated SQLite fixture database (zero mutation of dev.db or production)
const sourcePath = path.join(__dirname, '../../prisma/dev.db');
const devDbHashBefore = createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kobo-notif-link-test-'));
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

const { JWT_SECRET } = require('../../config/auth');
const prisma = require('../../prisma');
const express = require('express');
const koboService = require('../../services/koboService');

// Mock external Kobo network service
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

const { verifyToken } = require('../../middleware/authMiddleware');
const sampleRoutes = require('../../routes/sampleRoutes');
const koboRoutes = require('../../routes/koboRoutes');

const app = express();
app.use(express.json());
app.use('/api/samples', verifyToken, sampleRoutes);
app.use('/api/kobo', koboRoutes);

describe('Kobo Notification Deep Link & View Parameter Lifecycle (Refs #120)', () => {
    const SUFFIX = 'KNL-' + Date.now();
    let labA, labB;
    let projA, projB;
    let configA;
    let userManagerA, userManagerB;
    let tokenManagerA, tokenManagerB;
    let syncedOriginalId;

    beforeAll(async () => {
        // Setup Labs
        labA = await prisma.lab.create({
            data: { id: 'LAB-A-' + SUFFIX, code: 'LA-' + SUFFIX.slice(-3), name: 'Lab A ' + SUFFIX, country: 'Guatemala', isActive: true }
        });
        labB = await prisma.lab.create({
            data: { id: 'LAB-B-' + SUFFIX, code: 'LB-' + SUFFIX.slice(-3), name: 'Lab B ' + SUFFIX, country: 'Honduras', isActive: true }
        });

        // Setup Projects
        projA = await prisma.project.create({
            data: {
                id: 'PRJ-A-' + SUFFIX,
                code: 'SOILFER-GTM-' + SUFFIX.slice(-3),
                name: 'Soilfer Guatemala Project',
                status: 'ACTIVE',
                projectType: 'KOBO_LINKED',
                labId: labA.id,
                countries: JSON.stringify(['Guatemala']),
                assignedLabIds: JSON.stringify([labA.id])
            }
        });
        await prisma.projectLab.create({
            data: { id: 'PL-A-' + SUFFIX, projectCode: projA.code, labId: labA.id }
        });

        projB = await prisma.project.create({
            data: {
                id: 'PRJ-B-' + SUFFIX,
                code: 'SOILFER-HND-' + SUFFIX.slice(-3),
                name: 'Soilfer Honduras Project',
                status: 'ACTIVE',
                projectType: 'KOBO_LINKED',
                labId: labB.id,
                countries: JSON.stringify(['Honduras']),
                assignedLabIds: JSON.stringify([labB.id])
            }
        });
        await prisma.projectLab.create({
            data: { id: 'PL-B-' + SUFFIX, projectCode: projB.code, labId: labB.id }
        });

        // Setup Kobo configuration for Lab A + Project A
        configA = await prisma.koboConfig.create({
            data: {
                id: 'CFG-A-' + SUFFIX,
                labId: labA.id,
                projectCode: projA.code,
                koboServerUrl: 'https://kobo.fixture.test',
                formId: 'form_asset_1_' + SUFFIX,
                apiToken: 'token_123',
                isActive: true
            }
        });

        // Setup Users (Managers)
        userManagerA = await prisma.user.create({
            data: {
                id: 'usr-mgr-a-' + SUFFIX,
                username: 'mgr_a_' + SUFFIX,
                email: 'mgra@' + SUFFIX + '.test',
                password: 'hash',
                role: 'LAB_MANAGER',
                labId: labA.id,
                countries: JSON.stringify(['Guatemala']),
                projects: JSON.stringify([projA.code]),
                tokenVersion: 1,
                isActive: true
            }
        });
        userManagerB = await prisma.user.create({
            data: {
                id: 'usr-mgr-b-' + SUFFIX,
                username: 'mgr_b_' + SUFFIX,
                email: 'mgrb@' + SUFFIX + '.test',
                password: 'hash',
                role: 'LAB_MANAGER',
                labId: labB.id,
                countries: JSON.stringify(['Honduras']),
                projects: JSON.stringify([projB.code]),
                tokenVersion: 1,
                isActive: true
            }
        });

        tokenManagerA = 'Bearer ' + jwt.sign({
            id: userManagerA.id,
            username: userManagerA.username,
            role: userManagerA.role,
            labId: labA.id,
            countries: ['Guatemala'],
            projects: [projA.code],
            tokenVersion: 1
        }, JWT_SECRET);

        tokenManagerB = 'Bearer ' + jwt.sign({
            id: userManagerB.id,
            username: userManagerB.username,
            role: userManagerB.role,
            labId: labB.id,
            countries: ['Honduras'],
            projects: [projB.code],
            tokenVersion: 1
        }, JWT_SECRET);

        // Pre-create an active, physically received sample in Lab A to verify operational separation
        await prisma.sample.create({
            data: {
                id: 'SMP-ACT-A-' + SUFFIX,
                originalId: 'ORIG-ACT-A-' + SUFFIX,
                projectCode: projA.code,
                projectId: projA.id,
                country: 'GTM',
                countryName: 'Guatemala',
                labId: labA.id,
                assignedLab: labA.id,
                status: 'ACCEPTED',
                receptionDate: new Date()
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
        // Dev database immutability verification
        const devDbHashAfter = createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
        expect(devDbHashAfter).toBe(devDbHashBefore);
    });

    test('1. Syncing Kobo submissions generates manager notification with view=expected and canonical filter params', async () => {
        syncedOriginalId = 'KOBO-FIELD-' + SUFFIX;

        // Mock Kobo submissions
        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: 998811,
                _uuid: 'uuid-' + SUFFIX,
                _submission_time: new Date().toISOString(),
                surveyor_name: 'Field Agent Carlos',
                selected_province: 'Alta Verapaz',
                sampling_succeeded: 'yes',
                sample_id: syncedOriginalId,
                site_id: 'SITE-01'
            }
        ]);

        koboService.transformSubmission.mockReturnValueOnce([{
            original_id: syncedOriginalId,
            site_id: 'SITE-01',
            latitude: 15.48,
            longitude: -90.37
        }]);

        // Trigger sync for Lab A
        const syncRes = await request(app)
            .post(`/api/kobo/sync/${labA.id}`)
            .set('Authorization', tokenManagerA);

        expect(syncRes.status).toBe(200);
        expect(syncRes.body.newSamples).toBe(1);

        // Verify sample created in database with EXPECTED status and null receptionDate
        const sample = await prisma.sample.findUnique({
            where: { originalId: syncedOriginalId }
        });
        expect(sample).not.toBeNull();
        expect(sample.status).toBe('EXPECTED');
        expect(sample.receptionDate).toBeNull();
        expect(sample.assignedLab).toBe(labA.id);
        expect(sample.projectCode).toBe(projA.code);

        // Verify notification was sent to Lab Manager A
        const notif = await prisma.notification.findFirst({
            where: {
                userId: userManagerA.id,
                title: '🌾 New Field Samples Collected'
            },
            orderBy: { createdAt: 'desc' }
        });

        expect(notif).not.toBeNull();
        expect(notif.type).toBe('SUCCESS');
        // Crucial acceptance check: deep link MUST include view=expected and canonical projects & labs params
        expect(notif.link).toBe(`/samples?view=expected&projects=${encodeURIComponent(projA.code)}&labs=${encodeURIComponent(labA.id)}`);
    });

    test('2. Notification deep link parameters open newly synced arrivals in view=expected', async () => {
        // Lab Manager navigates using the exact deep link query parameters from the notification
        const res = await request(app)
            .get(`/api/samples?view=expected&projects=${encodeURIComponent(projA.code)}&labs=${encodeURIComponent(labA.id)}`)
            .set('Authorization', tokenManagerA);

        expect(res.status).toBe(200);
        const data = res.body.data || [];
        expect(data.some(s => s.originalId === syncedOriginalId)).toBe(true);

        // Physically received / active lab samples are excluded from the expected view
        expect(data.some(s => s.id === 'SMP-ACT-A-' + SUFFIX)).toBe(false);
    });

    test('3. Operational view separation: EXPECTED field arrivals are strictly excluded from view=daily', async () => {
        // Daily operational view only returns active lab work (reception completed)
        const dailyRes = await request(app)
            .get('/api/samples?view=daily')
            .set('Authorization', tokenManagerA);

        expect(dailyRes.status).toBe(200);
        const dailyData = dailyRes.body.data || [];
        // Active sample is present
        expect(dailyData.some(s => s.id === 'SMP-ACT-A-' + SUFFIX)).toBe(true);
        // Newly synced EXPECTED field arrival is excluded
        expect(dailyData.some(s => s.originalId === syncedOriginalId)).toBe(false);

        // Registry view returns both
        const regRes = await request(app)
            .get('/api/samples?view=registry')
            .set('Authorization', tokenManagerA);

        expect(regRes.status).toBe(200);
        const regData = regRes.body.data || [];
        expect(regData.some(s => s.id === 'SMP-ACT-A-' + SUFFIX)).toBe(true);
        expect(regData.some(s => s.originalId === syncedOriginalId)).toBe(true);
    });

    test('4. Parameter lifecycle & alias backward/forward compatibility', async () => {
        // Singular aliases: project and lab
        const resSingular = await request(app)
            .get(`/api/samples?view=expected&project=${encodeURIComponent(projA.code)}&lab=${encodeURIComponent(labA.id)}`)
            .set('Authorization', tokenManagerA);

        expect(resSingular.status).toBe(200);
        expect(resSingular.body.data.some(s => s.originalId === syncedOriginalId)).toBe(true);

        // ID aliases: projectId and labId
        const resIds = await request(app)
            .get(`/api/samples?view=expected&projectId=${encodeURIComponent(projA.id)}&labId=${encodeURIComponent(labA.id)}`)
            .set('Authorization', tokenManagerA);

        expect(resIds.status).toBe(200);
        expect(resIds.body.data.some(s => s.originalId === syncedOriginalId)).toBe(true);

        // Scoped filtering: filtering by different project code excludes Lab A arrival
        const resDifferentProject = await request(app)
            .get(`/api/samples?view=expected&projects=${encodeURIComponent(projB.code)}&labs=${encodeURIComponent(labA.id)}`)
            .set('Authorization', tokenManagerA);

        expect(resDifferentProject.status).toBe(200);
        expect(resDifferentProject.body.data.some(s => s.originalId === syncedOriginalId)).toBe(false);
    });

    test('5. Cross-lab isolation: Manager B cannot view Lab A arrivals via notification route', async () => {
        // Manager B attempts to open Lab A notification link
        const res = await request(app)
            .get(`/api/samples?view=expected&projects=${encodeURIComponent(projA.code)}&labs=${encodeURIComponent(labA.id)}`)
            .set('Authorization', tokenManagerB);

        expect(res.status).toBe(200);
        const data = res.body.data || [];
        // Scope guard strictly denies access to other labs' samples
        expect(data.some(s => s.originalId === syncedOriginalId)).toBe(false);
        expect(data.length).toBe(0);
    });
});
