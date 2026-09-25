'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createHash } = require('crypto');
const Database = require('better-sqlite3');

// 1. Ensure 100% database isolation with temporary fixture DB
const sourcePath = path.join(__dirname, '../../prisma/dev.db');
const devDbHashBefore = createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kobo-dup-test-'));
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
process.env.JWT_SECRET = 'test-secret-kobo-dup-provenance';

const prisma = require('../../prisma');
const koboService = require('../../services/koboService');
const koboController = require('../../controllers/koboController');

// Mock external Kobo service calls
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

describe('Kobo Duplicate Provenance & Expected Arrivals Contracts (Issue #146)', () => {
    const SUFFIX = 'DUP-' + Date.now();
    let labGHA;
    let projUS;
    let configGHA;

    beforeAll(async () => {
        labGHA = await prisma.lab.create({
            data: {
                id: 'GHA-LAB1-' + SUFFIX,
                code: 'GHA-' + SUFFIX.slice(-3),
                name: 'SoilFER Ghana Lab ' + SUFFIX,
                country: 'Ghana',
                isActive: true
            }
        });

        projUS = await prisma.project.create({
            data: {
                id: 'PROJ-US-' + SUFFIX,
                code: 'SOILFER-US-' + SUFFIX,
                name: 'SoilFER US Program ' + SUFFIX,
                status: 'ACTIVE',
                projectType: 'KOBO_LINKED',
                labId: labGHA.id
            }
        });

        await prisma.projectLab.create({
            data: {
                id: 'PL-GHA-' + SUFFIX,
                projectCode: projUS.code,
                labId: labGHA.id,
                role: 'PRIMARY',
                priority: 1
            }
        });

        configGHA = await prisma.koboConfig.create({
            data: {
                id: 'CFG-GHA-' + SUFFIX,
                labId: labGHA.id,
                projectCode: projUS.code,
                koboServerUrl: 'https://kf.kobotoolbox.fixture.test',
                formId: 'form_gha_' + SUFFIX,
                apiToken: 'token_gha_fixture',
                isActive: true,
                syncIntervalMins: 15
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

        const devDbHashAfter = createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
        expect(devDbHashAfter).toBe(devDbHashBefore);
    });

    beforeEach(() => {
        koboService.fetchSubmissions.mockReset();
        koboService.transformSubmission.mockReset();
        koboService.findValue.mockImplementation((obj, keys) => {
            for (const k of keys) {
                if (obj && obj[k] !== undefined) return obj[k];
            }
            return null;
        });
    });

    test('1. Intra-submission duplicate barcodes are admitted safely without unique constraint crash, preserving duplicate depth provenance in metadata and AuditLog', async () => {
        const subId = 40109;
        const subUuid = 'uuid-40109-' + SUFFIX;
        const sharedBarcode = 'GHA0288-3-1C-T-' + SUFFIX;

        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: subId,
                _uuid: subUuid,
                _submission_time: '2026-09-20T20:48:20',
                surveyor_name: 'kc101_gyeboah',
                _attachments: [{ filename: 'label_photo.jpg', download_url: 'https://test/label_photo.jpg' }]
            }
        ]);

        // Transform returns two samples sharing the same barcode string (D1 and D2)
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: sharedBarcode,
                depth: 'D1',
                site_id: 'GHA0288-3-1C',
                lat: 10.176,
                lng: -1.266,
                collected_at: '2026-09-19',
                kobo_submission_id: subId
            },
            {
                original_id: sharedBarcode,
                depth: 'D2',
                site_id: 'GHA0288-3-1C',
                lat: 10.176,
                lng: -1.266,
                collected_at: '2026-09-19',
                kobo_submission_id: subId
            }
        ]);

        const result = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');

        expect(result.newSamples).toBe(1);
        expect(result.skipped).toBe(1);
        expect(result.lastSubmissionId).toBe(String(subId));

        // Verify admitted sample
        const sample = await prisma.sample.findUnique({
            where: { originalId: sharedBarcode }
        });
        expect(sample).toBeDefined();
        expect(sample.status).toBe('EXPECTED');
        expect(sample.receptionDate).toBeNull();
        expect(sample.assignedLab).toBe(labGHA.id);
        expect(sample.projectCode).toBe(projUS.code);

        const meta = JSON.parse(sample.metadata);
        expect(meta.kobo_id).toBe(subId);
        expect(meta.intraSubDuplicates).toBeDefined();
        expect(meta.intraSubDuplicates.length).toBe(1);
        expect(meta.intraSubDuplicates[0].depth).toBe('D2');
        expect(meta.intraSubDuplicates[0].reason).toBe('INTRA_SUBMISSION_DUPLICATE_BARCODE');

        // Verify AuditLog entries
        const auditLogs = await prisma.auditLog.findMany({
            where: { entityId: sample.id }
        });
        const actions = auditLogs.map(a => a.action);
        expect(actions).toContain('CREATE_KOBO_SYNC');
        expect(actions).toContain('KOBO_INTRA_SUBMISSION_DUPLICATE');
    });

    test('2. Cross-submission duplicate barcode preserves conflicting field provenance and audit trail without discarding differences', async () => {
        const sub1Id = 40181;
        const sub2Id = 40182;
        const targetBarcode = 'GHA0922-2-1G-T-' + SUFFIX;

        // First submission creates sample
        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: sub1Id,
                _uuid: 'uuid-40181-' + SUFFIX,
                _submission_time: '2026-09-22T06:00:48',
                surveyor_name: 'jackson_gyamfi',
                _attachments: [{ filename: 'sub1_photo.jpg' }]
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: targetBarcode,
                depth: 'D1',
                site_id: 'GHA0922-2-1G',
                lat: 10.73885,
                lng: -1.75433,
                collected_at: '2026-09-20',
                kobo_submission_id: sub1Id
            }
        ]);

        const res1 = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(res1.newSamples).toBe(1);
        expect(res1.lastSubmissionId).toBe(String(sub1Id));

        // Second submission repeats the same barcode 2 seconds later with different GPS and photos
        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: sub2Id,
                _uuid: 'uuid-40182-' + SUFFIX,
                _submission_time: '2026-09-22T06:00:50',
                surveyor_name: 'jackson_gyamfi',
                _attachments: [{ filename: 'sub2_conflicting_photo.jpg' }]
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: targetBarcode,
                depth: 'D1',
                site_id: 'GHA0922-2-1G',
                lat: 10.73803, // Conflicting location (~800m away)
                lng: -1.74706,
                collected_at: '2026-09-20',
                kobo_submission_id: sub2Id
            }
        ]);

        const res2 = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(res2.newSamples).toBe(0);
        expect(res2.skipped).toBe(1);
        expect(res2.lastSubmissionId).toBe(String(sub2Id)); // Cursor advanced past audited record

        // Verify existing sample has conflicting provenance preserved
        const sampleAfter = await prisma.sample.findUnique({
            where: { originalId: targetBarcode }
        });
        const metaAfter = JSON.parse(sampleAfter.metadata);
        expect(metaAfter.kobo_id).toBe(sub1Id);
        expect(metaAfter.conflictingSubmissions).toBeDefined();
        expect(metaAfter.conflictingSubmissions.length).toBe(1);
        expect(metaAfter.conflictingSubmissions[0].kobo_id).toBe(sub2Id);
        expect(metaAfter.conflictingSubmissions[0].lat).toBe(10.73803);
        expect(metaAfter.conflictingSubmissions[0].lng).toBe(-1.74706);
        expect(metaAfter.conflictingSubmissions[0].surveyor).toBe('jackson_gyamfi');

        // Verify AuditLog has KOBO_CONFLICTING_PROVENANCE
        const auditLogs = await prisma.auditLog.findMany({
            where: { entityId: sampleAfter.id }
        });
        const actions = auditLogs.map(a => a.action);
        expect(actions).toContain('CREATE_KOBO_SYNC');
        expect(actions).toContain('KOBO_CONFLICTING_PROVENANCE');
    });

    test('3. Empty submission response updates lastSyncAt to prevent rapid polling spinning', async () => {
        const timeBefore = new Date(Date.now() - 3600000);
        await prisma.koboConfig.update({
            where: { id: configGHA.id },
            data: { lastSyncAt: timeBefore }
        });

        koboService.fetchSubmissions.mockResolvedValueOnce([]);

        const result = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(result.newSamples).toBe(0);
        expect(result.skipped).toBe(0);
        expect(result.message).toBe('No new submissions');

        const updatedConfig = await prisma.koboConfig.findUnique({
            where: { id: configGHA.id }
        });
        expect(new Date(updatedConfig.lastSyncAt).getTime()).toBeGreaterThan(timeBefore.getTime());
    });

    test('4. Full idempotency on repeat sync with identical submissions', async () => {
        const subId = 40500;
        const barcode = 'GHA-IDEMP-' + SUFFIX;

        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: subId,
                _uuid: 'uuid-40500-' + SUFFIX,
                _submission_time: '2026-09-24T12:00:00',
                _attachments: []
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: barcode,
                depth: 'D1',
                site_id: 'GHA-SITE-1',
                lat: 8.5,
                lng: -1.5,
                collected_at: '2026-09-24',
                kobo_submission_id: subId
            }
        ]);

        const pass1 = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(pass1.newSamples).toBe(1);

        // Repeat identical submission
        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: subId,
                _uuid: 'uuid-40500-' + SUFFIX,
                _submission_time: '2026-09-24T12:00:00',
                _attachments: []
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: barcode,
                depth: 'D1',
                site_id: 'GHA-SITE-1',
                lat: 8.5,
                lng: -1.5,
                collected_at: '2026-09-24',
                kobo_submission_id: subId
            }
        ]);

        const pass2 = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(pass2.newSamples).toBe(0);
        expect(pass2.skipped).toBe(1);

        // Sample count for this ID remains exactly 1
        const count = await prisma.sample.count({
            where: { originalId: barcode }
        });
        expect(count).toBe(1);
    });
});
