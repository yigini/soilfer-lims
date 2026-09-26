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
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const koboService = require('../../services/koboService');
const koboController = require('../../controllers/koboController');
const sampleController = require('../../controllers/sampleController');
const sampleWorkspaceService = require('../../services/sampleWorkspaceService');
const receptionRoutes = require('../../routes/receptionRoutes');

const app = express();
app.use(express.json());
app.use('/api/reception', receptionRoutes);

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
    let userReception;
    let tokenReception;

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

        userReception = await prisma.user.create({
            data: {
                id: 'usr-rec-' + SUFFIX,
                username: 'rec_' + SUFFIX,
                email: 'rec@' + SUFFIX + '.test',
                password: 'h',
                role: 'SAMPLE_RECEPTION',
                labId: labGHA.id,
                isActive: true,
                mustChangePassword: false,
                tokenVersion: 1
            }
        });

        tokenReception = 'Bearer ' + jwt.sign({
            id: userReception.id,
            username: userReception.username,
            role: userReception.role,
            labId: labGHA.id,
            tokenVersion: 1
        }, process.env.JWT_SECRET);
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
        expect(meta.provenanceHold).toBeDefined();
        expect(meta.provenanceHold.status).toBe('AMBIGUOUS_PROVENANCE_HOLD');
        expect(sample.rejectionReason).toContain('PROVENANCE_HOLD');
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

        // Sample count for this ID remains exactly 1, with zero metadata/audit/hold mutations
        const sampleAfter = await prisma.sample.findUnique({
            where: { originalId: barcode }
        });
        expect(sampleAfter).toBeDefined();
        expect(sampleAfter.status).toBe('EXPECTED');
        expect(sampleAfter.rejectionReason).toBeNull();

        const metaAfter = JSON.parse(sampleAfter.metadata);
        expect(metaAfter.kobo_id).toBe(subId);
        expect(metaAfter.provenanceHold).toBeUndefined();
        expect(metaAfter.conflictingSubmissions).toBeUndefined();

        const auditsAfter = await prisma.auditLog.findMany({
            where: { entityId: sampleAfter.id }
        });
        expect(auditsAfter.length).toBe(1);
        expect(auditsAfter[0].action).toBe('CREATE_KOBO_SYNC');
    });

    test('5. Foreign sample collision strictly avoids mutation, reports FOREIGN_SCOPE_COLLISION, and halts cursor', async () => {
        const foreignBarcode = 'FOREIGN-BARCODE-' + SUFFIX;
        const foreignSubId = 40600;

        // Create a foreign sample belonging to GTM lab and different project
        const foreignSample = await prisma.sample.create({
            data: {
                id: 'foreign-sample-' + SUFFIX,
                originalId: foreignBarcode,
                assignedLab: 'GTM-LAB1',
                projectCode: 'SOILFER-GTM',
                status: 'EXPECTED',
                metadata: JSON.stringify({ kobo_id: 9999, originalData: 'DO_NOT_TOUCH' }),
                fieldMetadata: JSON.stringify({})
            }
        });

        // Config GHA attempts to sync a submission with this foreign barcode
        const cursorBefore = (await prisma.koboConfig.findUnique({ where: { id: configGHA.id } })).lastSubmissionId;

        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: foreignSubId,
                _uuid: 'uuid-foreign-' + SUFFIX,
                _submission_time: '2026-09-24T14:00:00',
                _attachments: [{ filename: 'foreign_photo.jpg' }]
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: foreignBarcode,
                depth: 'D1',
                site_id: 'FOREIGN-SITE',
                lat: 14.5,
                lng: -90.5,
                collected_at: '2026-09-24',
                kobo_submission_id: foreignSubId
            }
        ]);

        const result = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');

        // Verify foreign sample was NOT mutated
        const foreignSampleAfter = await prisma.sample.findUnique({
            where: { id: foreignSample.id }
        });
        const metaAfter = JSON.parse(foreignSampleAfter.metadata);
        expect(metaAfter.originalData).toBe('DO_NOT_TOUCH');
        expect(metaAfter.conflictingSubmissions).toBeUndefined();

        // Verify no audit log on foreign sample
        const foreignAudits = await prisma.auditLog.findMany({
            where: { entityId: foreignSample.id }
        });
        expect(foreignAudits.length).toBe(0);

        // Verify skip reported
        expect(result.skipped).toBe(1);
        expect(result.skippedReasons).toBeDefined();
        expect(result.skippedReasons.some(r => r.reason.includes('FOREIGN_SCOPE_COLLISION'))).toBe(true);

        // Verify cursor did NOT advance past foreign collision
        const configAfter = await prisma.koboConfig.findUnique({ where: { id: configGHA.id } });
        expect(configAfter.lastSubmissionId).toBe(cursorBefore);
    });

    test('6. Duplicate branch enforces commit gates and rolls back transaction on revoked config', async () => {
        const dupBarcode = 'GATE-TEST-' + SUFFIX;
        const gateSub1 = 40650;
        const gateSub2 = 40651;

        // First submission creates sample
        koboService.fetchSubmissions.mockResolvedValueOnce([
            { _id: gateSub1, _uuid: 'uuid-gate-1-' + SUFFIX, _submission_time: '2026-09-24T15:00:00', _attachments: [] }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            { original_id: dupBarcode, depth: 'D1', site_id: 'GATE-SITE', lat: 8.1, lng: -1.1, collected_at: '2026-09-24', kobo_submission_id: gateSub1 }
        ]);
        const r1 = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(r1.newSamples).toBe(1);

        try {
            // Simulate race condition: config is revoked/deactivated after fetchSubmissions starts
            koboService.fetchSubmissions.mockImplementationOnce(async () => {
                await prisma.koboConfig.update({
                    where: { id: configGHA.id },
                    data: { isActive: false }
                });
                return [
                    { _id: gateSub2, _uuid: 'uuid-gate-2-' + SUFFIX, _submission_time: '2026-09-24T15:05:00', _attachments: [] }
                ];
            });
            koboService.transformSubmission.mockReturnValueOnce([
                { original_id: dupBarcode, depth: 'D1', site_id: 'GATE-SITE', lat: 8.2, lng: -1.2, collected_at: '2026-09-24', kobo_submission_id: gateSub2 }
            ]);

            const r2 = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
            expect(r2.skippedReasons.some(r => r.reason.includes('CONFIG_REVOKED'))).toBe(true);
        } finally {
            // Guarantee restoration of active config for subsequent tests
            await prisma.koboConfig.update({
                where: { id: configGHA.id },
                data: { isActive: true }
            });
        }
    });

    test('7. Conflict replay idempotency: repeating the conflicting submission does not append duplicate entries or duplicate audit rows', async () => {
        const replayBarcode = 'REPLAY-TEST-' + SUFFIX;
        const initialSubId = 40710;
        const conflictSubId = 40711;

        // 1. Initial sample
        koboService.fetchSubmissions.mockResolvedValueOnce([
            { _id: initialSubId, _uuid: 'uuid-40710-' + SUFFIX, _submission_time: '2026-09-24T16:00:00', _attachments: [] }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            { original_id: replayBarcode, depth: 'D1', site_id: 'SITE-R', lat: 6.0, lng: -1.0, collected_at: '2026-09-24', kobo_submission_id: initialSubId }
        ]);
        await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');

        const sample = await prisma.sample.findUnique({ where: { originalId: replayBarcode } });

        // 2. Conflicting submission
        const conflictSub = {
            _id: conflictSubId,
            _uuid: 'uuid-40711-' + SUFFIX,
            _submission_time: '2026-09-24T16:05:00',
            surveyor_name: 'test_surveyor',
            _attachments: [{ filename: 'conflict.jpg', download_url: 'https://test/conflict.jpg' }]
        };
        const conflictSample = {
            original_id: replayBarcode,
            depth: 'D1',
            site_id: 'SITE-R',
            lat: 6.05,
            lng: -1.05,
            collected_at: '2026-09-24',
            kobo_submission_id: conflictSubId
        };

        // First pass of conflict
        koboService.fetchSubmissions.mockResolvedValueOnce([conflictSub]);
        koboService.transformSubmission.mockReturnValueOnce([conflictSample]);
        await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');

        let meta = JSON.parse((await prisma.sample.findUnique({ where: { id: sample.id } })).metadata);
        expect(meta.conflictingSubmissions.length).toBe(1);

        let audits = await prisma.auditLog.findMany({
            where: { entityId: sample.id, action: 'KOBO_CONFLICTING_PROVENANCE' }
        });
        expect(audits.length).toBe(1);

        // Replay same conflict pass
        koboService.fetchSubmissions.mockResolvedValueOnce([conflictSub]);
        koboService.transformSubmission.mockReturnValueOnce([conflictSample]);
        await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');

        meta = JSON.parse((await prisma.sample.findUnique({ where: { id: sample.id } })).metadata);
        expect(meta.conflictingSubmissions.length).toBe(1); // STILL 1, no duplicate append

        audits = await prisma.auditLog.findMany({
            where: { entityId: sample.id, action: 'KOBO_CONFLICTING_PROVENANCE' }
        });
        expect(audits.length).toBe(1); // STILL 1, no duplicate audit row
    });

    test('8. Case-insensitive lookup preserves evidence on lowercase existing record in DB, advancing cursor cleanly', async () => {
        const lowerBarcode = 'gha-case-insens-' + SUFFIX.toLowerCase();
        const upperBarcode = lowerBarcode.toUpperCase();
        const caseSubId = 40720;

        // Insert lowercase sample directly in DB
        const lowerSample = await prisma.sample.create({
            data: {
                id: 'sample-lower-' + SUFFIX,
                originalId: lowerBarcode,
                assignedLab: labGHA.id,
                projectCode: projUS.code,
                status: 'EXPECTED',
                metadata: JSON.stringify({ kobo_id: 1111, initial: 'data' }),
                fieldMetadata: JSON.stringify({})
            }
        });

        // Submission presents uppercase barcode
        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: caseSubId,
                _uuid: 'uuid-case-' + SUFFIX,
                _submission_time: '2026-09-24T17:00:00',
                _attachments: [{ filename: 'casing.jpg', download_url: 'https://test/casing.jpg' }]
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: upperBarcode,
                depth: 'D1',
                site_id: 'SITE-CASE',
                lat: 7.0,
                lng: -2.0,
                collected_at: '2026-09-24',
                kobo_submission_id: caseSubId
            }
        ]);

        const result = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(result.skipped).toBe(1);
        expect(result.lastSubmissionId).toBe(String(caseSubId)); // Cursor advanced!

        // Verify lowercase record in DB received the conflict
        const sampleAfter = await prisma.sample.findUnique({ where: { id: lowerSample.id } });
        const metaAfter = JSON.parse(sampleAfter.metadata);
        expect(metaAfter.conflictingSubmissions).toBeDefined();
        expect(metaAfter.conflictingSubmissions.length).toBe(1);
        expect(metaAfter.conflictingSubmissions[0].kobo_id).toBe(caseSubId);
    });

    test('9. Ambiguous depth identity (D1/D2 duplicate barcode) receives durable hold, blocking downstream physical receipt with 409 AMBIGUOUS_PROVENANCE_HOLD', async () => {
        const ambigBarcode = 'GHA-AMBIG-' + SUFFIX;
        const ambigSubId = 40730;

        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: ambigSubId,
                _uuid: 'uuid-ambig-' + SUFFIX,
                _submission_time: '2026-09-24T18:00:00',
                surveyor_name: 'test_surveyor',
                _attachments: [
                    {
                        filename: 'd1_photo.jpg',
                        download_url: 'https://test/d1_photo.jpg',
                        question_xpath: 'photo_sample_d1'
                    }
                ]
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: ambigBarcode,
                depth: 'D1',
                site_id: 'SITE-AMBIG',
                lat: 9.0,
                lng: -0.5,
                collected_at: '2026-09-24',
                kobo_submission_id: ambigSubId
            },
            {
                original_id: ambigBarcode,
                depth: 'D2',
                site_id: 'SITE-AMBIG',
                lat: 9.0,
                lng: -0.5,
                collected_at: '2026-09-24',
                kobo_submission_id: ambigSubId
            }
        ]);

        const syncRes = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(syncRes.newSamples).toBe(1);
        expect(syncRes.skipped).toBe(1);

        const ambigSample = await prisma.sample.findUnique({ where: { originalId: ambigBarcode } });
        expect(ambigSample).toBeDefined();
        expect(ambigSample.status).toBe('EXPECTED');
        expect(ambigSample.rejectionReason).toContain('PROVENANCE_HOLD');

        const meta = JSON.parse(ambigSample.metadata);
        expect(meta.provenanceHold).toBeDefined();
        expect(meta.provenanceHold.status).toBe('AMBIGUOUS_PROVENANCE_HOLD');
        expect(meta.intraSubDuplicates[0].attachments[0].download_url).toBe('https://test/d1_photo.jpg');

        // Workspace projection check
        const adminUser = { id: 'usr-adm', username: 'admin', role: 'SUPER_ADMIN', labId: labGHA.id };
        const ws = await sampleWorkspaceService.getSampleWorkspace(ambigSample.id, adminUser);
        expect(ws.capabilities.canReceive.allowed).toBe(false);
        expect(ws.capabilities.canReceive.reason).toContain('Ambiguous specimen identity');
        expect(ws.nextAction.action).toBe('RECONCILE_HOLD');
        expect(ws.integrity.issues.some(i => i.code === 'AMBIGUOUS_PROVENANCE_HOLD')).toBe(true);

        // Attempt physical receipt via sampleController.receiveSample: must return 409 AMBIGUOUS_PROVENANCE_HOLD
        const req = {
            params: { id: ambigSample.id },
            user: adminUser,
            body: {}
        };
        let statusCode = null;
        let jsonResponse = null;
        const res = {
            status: jest.fn(code => {
                statusCode = code;
                return res;
            }),
            json: jest.fn(data => {
                jsonResponse = data;
                return res;
            })
        };

        await sampleController.receiveSample(req, res);
        expect(statusCode).toBe(409);
        expect(jsonResponse.code).toBe('AMBIGUOUS_PROVENANCE_HOLD');
        expect(jsonResponse.message).toContain('Ambiguous field specimen identity');

        // In contrast, a normal unambiguous sample receives cleanly
        const normalBarcode = 'GHA-NORMAL-' + SUFFIX;
        const normalSample = await prisma.sample.create({
            data: {
                id: 'normal-sample-' + SUFFIX,
                originalId: normalBarcode,
                assignedLab: labGHA.id,
                projectCode: projUS.code,
                status: 'EXPECTED',
                metadata: JSON.stringify({ kobo_id: 1234 }),
                fieldMetadata: JSON.stringify({})
            }
        });

        const normalReq = {
            params: { id: normalSample.id },
            user: adminUser,
            body: {}
        };
        let normalStatus = null;
        const normalRes = {
            status: jest.fn(code => {
                normalStatus = code;
                return normalRes;
            }),
            json: jest.fn(data => normalRes)
        };
        await sampleController.receiveSample(normalReq, normalRes);
        expect(normalStatus).toBeNull(); // Clean 200 (res.json was called directly without error status)
        const updatedNormal = await prisma.sample.findUnique({ where: { id: normalSample.id } });
        expect(updatedNormal.status).toBe('RECEIVED');
    });

    test('10. Unchanged original primary replay causes zero metadata, audit, or hold changes', async () => {
        const primaryBarcode = 'GHA-PRIM-REPLAY-' + SUFFIX;
        const primarySubId = 40801;

        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: primarySubId,
                _uuid: 'uuid-prim-' + SUFFIX,
                _submission_time: '2026-09-24T19:00:00',
                surveyor_name: 'prim_surveyor',
                _attachments: [{ filename: 'prim.jpg' }]
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: primaryBarcode,
                depth: 'D1',
                site_id: 'SITE-PRIM',
                lat: 5.5,
                lng: -0.2,
                collected_at: '2026-09-24',
                kobo_submission_id: primarySubId
            }
        ]);

        const pass1 = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(pass1.newSamples).toBe(1);

        const sampleBefore = await prisma.sample.findUnique({ where: { originalId: primaryBarcode } });
        expect(sampleBefore.status).toBe('EXPECTED');
        expect(sampleBefore.rejectionReason).toBeNull();
        const metaBefore = JSON.parse(sampleBefore.metadata);
        expect(metaBefore.kobo_id).toBe(primarySubId);
        expect(metaBefore.provenanceHold).toBeUndefined();
        expect(metaBefore.conflictingSubmissions).toBeUndefined();

        const auditsBefore = await prisma.auditLog.findMany({ where: { entityId: sampleBefore.id } });
        expect(auditsBefore.length).toBe(1);
        expect(auditsBefore[0].action).toBe('CREATE_KOBO_SYNC');

        // Replay unchanged original primary submission
        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: primarySubId,
                _uuid: 'uuid-prim-' + SUFFIX,
                _submission_time: '2026-09-24T19:00:00',
                surveyor_name: 'prim_surveyor',
                _attachments: [{ filename: 'prim.jpg' }]
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: primaryBarcode,
                depth: 'D1',
                site_id: 'SITE-PRIM',
                lat: 5.5,
                lng: -0.2,
                collected_at: '2026-09-24',
                kobo_submission_id: primarySubId
            }
        ]);

        const pass2 = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(pass2.newSamples).toBe(0);
        expect(pass2.skipped).toBe(1);

        const sampleAfter = await prisma.sample.findUnique({ where: { originalId: primaryBarcode } });
        expect(sampleAfter.rejectionReason).toBeNull(); // Still null, no false rejection
        const metaAfter = JSON.parse(sampleAfter.metadata);
        expect(metaAfter.provenanceHold).toBeUndefined(); // Still undefined, no false hold
        expect(metaAfter.conflictingSubmissions).toBeUndefined(); // Still undefined, no false conflict
        expect(metaAfter.kobo_id).toBe(primarySubId);

        const auditsAfter = await prisma.auditLog.findMany({ where: { entityId: sampleBefore.id } });
        expect(auditsAfter.length).toBe(1); // Exact same audit count, 0 new audits
    });

    test('11. Cross-form occurrences with same kobo_id and depth are preserved and not silently deduplicated', async () => {
        const xformBarcode = 'GHA-XFORM-' + SUFFIX;
        const sharedSubId = 40850;

        // Existing sample in DB has an occurrence from a DIFFERENT form (source-B/form-B)
        const initialSample = await prisma.sample.create({
            data: {
                id: 'xform-smp-' + SUFFIX,
                originalId: xformBarcode,
                assignedLab: labGHA.id,
                projectCode: projUS.code,
                projectId: projUS.id,
                status: 'EXPECTED',
                metadata: JSON.stringify({
                    kobo_id: 11111,
                    sourceServerUrl: 'https://source-b.test',
                    sourceFormId: 'form-b',
                    depth: 'D1',
                    conflictingSubmissions: [
                        {
                            occurrenceKey: 'https://source-b.test:form-b:' + sharedSubId + ':D1',
                            sourceServerUrl: 'https://source-b.test',
                            sourceFormId: 'form-b',
                            kobo_id: sharedSubId,
                            depth: 'D1'
                        }
                    ]
                })
            }
        });

        // Incoming submission from configGHA (source-A/form-A) has the SAME kobo_id (40850) and depth D1
        // In the flawed logic at 36777ba, alreadyRecorded matched on kobo_id+depth alone,
        // so source-A was silently suppressed and discarded!
        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: sharedSubId,
                _uuid: 'uuid-xform-gha-' + SUFFIX,
                _submission_time: '2026-09-24T20:05:00',
                surveyor_name: 'gha_surveyor',
                _attachments: [{ filename: 'gha_photo.jpg', download_url: 'https://test/gha_photo.jpg' }]
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: xformBarcode,
                depth: 'D1',
                site_id: 'SITE-GHA',
                lat: 6.2,
                lng: -1.2,
                collected_at: '2026-09-24',
                kobo_submission_id: sharedSubId
            }
        ]);

        const pass = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(pass.newSamples).toBe(0);
        expect(pass.skipped).toBe(1);

        // Verify the new form's occurrence was NOT suppressed and was appended to conflictingSubmissions
        const sampleAfter = await prisma.sample.findUnique({ where: { id: initialSample.id } });
        const metaAfter = JSON.parse(sampleAfter.metadata);
        expect(metaAfter.conflictingSubmissions).toBeDefined();
        expect(metaAfter.conflictingSubmissions.length).toBe(2); // Both form-B AND form-A preserved!
        expect(metaAfter.conflictingSubmissions[1].sourceFormId).toBe(configGHA.formId);
        expect(metaAfter.conflictingSubmissions[1].kobo_id).toBe(sharedSubId);

        // Replaying configGHA submission is now idempotent because both server and form match
        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: sharedSubId,
                _uuid: 'uuid-xform-gha-' + SUFFIX,
                _submission_time: '2026-09-24T20:05:00',
                surveyor_name: 'gha_surveyor',
                _attachments: [{ filename: 'gha_photo.jpg', download_url: 'https://test/gha_photo.jpg' }]
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: xformBarcode,
                depth: 'D1',
                site_id: 'SITE-GHA',
                lat: 6.2,
                lng: -1.2,
                collected_at: '2026-09-24',
                kobo_submission_id: sharedSubId
            }
        ]);

        await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        const metaAfterReplay = JSON.parse((await prisma.sample.findUnique({ where: { id: initialSample.id } })).metadata);
        expect(metaAfterReplay.conflictingSubmissions.length).toBe(2); // Still 2, no duplicates on replay
    });

    test('12. Unknown ownership and historical samples (REJECTED/RECEIVED) are protected from mutation', async () => {
        // Subcase A: Sample with unknown ownership (assignedLab: null)
        const unassignedBarcode = 'UNASSIGNED-' + SUFFIX;
        const unassignedSub = 40901;
        const unassignedSample = await prisma.sample.create({
            data: {
                id: 'unassigned-smp-' + SUFFIX,
                originalId: unassignedBarcode,
                assignedLab: null,
                projectCode: null,
                status: 'EXPECTED',
                metadata: JSON.stringify({ kobo_id: 111, unassignedOriginal: true })
            }
        });

        koboService.fetchSubmissions.mockResolvedValueOnce([
            { _id: unassignedSub, _uuid: 'uuid-unassigned-' + SUFFIX, _submission_time: '2026-09-24T21:00:00', _attachments: [] }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            { original_id: unassignedBarcode, depth: 'D1', site_id: 'S-UN', lat: 1.0, lng: 1.0, collected_at: '2026-09-24', kobo_submission_id: unassignedSub }
        ]);

        const resUnassigned = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(resUnassigned.skipped).toBe(1);
        expect(resUnassigned.skippedReasons.some(r => r.reason.includes('FOREIGN_SCOPE_COLLISION'))).toBe(true);

        const unassignedAfter = await prisma.sample.findUnique({ where: { id: unassignedSample.id } });
        expect(JSON.parse(unassignedAfter.metadata).unassignedOriginal).toBe(true);
        expect(JSON.parse(unassignedAfter.metadata).conflictingSubmissions).toBeUndefined();

        // Subcase B: Historical sample (status: REJECTED with existing rejectionReason)
        const rejectedBarcode = 'HIST-REJECTED-' + SUFFIX;
        const rejectedSub = 40902;
        const rejectedSample = await prisma.sample.create({
            data: {
                id: 'rejected-smp-' + SUFFIX,
                originalId: rejectedBarcode,
                assignedLab: labGHA.id,
                projectCode: projUS.code,
                status: 'REJECTED',
                rejectionReason: 'SAMPLE_DAMAGED_IN_TRANSIT',
                metadata: JSON.stringify({ kobo_id: 222, histOriginal: true })
            }
        });

        koboService.fetchSubmissions.mockResolvedValueOnce([
            { _id: rejectedSub, _uuid: 'uuid-rejected-' + SUFFIX, _submission_time: '2026-09-24T21:05:00', _attachments: [] }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            { original_id: rejectedBarcode, depth: 'D1', site_id: 'S-REJ', lat: 2.0, lng: 2.0, collected_at: '2026-09-24', kobo_submission_id: rejectedSub }
        ]);

        const resRejected = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(resRejected.skipped).toBe(1);
        expect(resRejected.skippedReasons.some(r => r.reason.includes('HISTORICAL_SAMPLE_COLLISION'))).toBe(true);

        const rejectedAfter = await prisma.sample.findUnique({ where: { id: rejectedSample.id } });
        expect(rejectedAfter.status).toBe('REJECTED');
        expect(rejectedAfter.rejectionReason).toBe('SAMPLE_DAMAGED_IN_TRANSIT'); // Unoverwritten!
        expect(JSON.parse(rejectedAfter.metadata).conflictingSubmissions).toBeUndefined();
    });

    test('13. Real isolated reception intake and consignment routes block AMBIGUOUS_PROVENANCE_HOLD with HTTP 409, while normal sample succeeds', async () => {
        const heldBarcode = 'INTAKE-HELD-' + SUFFIX;
        const heldSample = await prisma.sample.create({
            data: {
                id: 'intake-held-smp-' + SUFFIX,
                originalId: heldBarcode,
                assignedLab: labGHA.id,
                projectCode: projUS.code,
                projectId: projUS.id,
                status: 'EXPECTED',
                rejectionReason: 'PROVENANCE_HOLD: Conflicting field submissions claimed this barcode',
                metadata: JSON.stringify({
                    kobo_id: 40950,
                    provenanceHold: {
                        status: 'AMBIGUOUS_PROVENANCE_HOLD',
                        reason: 'Multiple field submissions reported differing coordinates'
                    }
                })
            }
        });

        // 1. POST /api/reception/intake on held sample
        const intakeRes = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', tokenReception)
            .send({
                originalId: heldBarcode,
                decision: 'ACCEPTED'
            });

        expect(intakeRes.status).toBe(409);
        expect(intakeRes.body.error).toBe('PROVENANCE_HOLD');
        expect(intakeRes.body.code).toBe('AMBIGUOUS_PROVENANCE_HOLD');
        expect(intakeRes.body.message).toContain('Ambiguous field specimen identity');

        // Sample status must remain EXPECTED, 0 work items created
        const sampleCheck = await prisma.sample.findUnique({ where: { id: heldSample.id } });
        expect(sampleCheck.status).toBe('EXPECTED');
        expect(sampleCheck.receptionDate).toBeNull();

        const workItemsCount = await prisma.workItem.count({ where: { sampleId: heldSample.id } });
        expect(workItemsCount).toBe(0);

        // 2. POST /api/reception/consignments on held sample
        const consignmentRes = await request(app)
            .post('/api/reception/consignments')
            .set('Authorization', tokenReception)
            .send({
                samples: [{ originalId: heldBarcode }],
                consignment: {
                    projectCode: projUS.code,
                    senderName: 'Courier Test'
                }
            });

        expect(consignmentRes.status).toBe(409);
        expect(consignmentRes.body.error).toBe('PROVENANCE_HOLD');
        expect(consignmentRes.body.code).toBe('AMBIGUOUS_PROVENANCE_HOLD');

        // 3. Normal unambiguous sample passes intake
        const normalBarcode = 'INTAKE-NORMAL-' + SUFFIX;
        await prisma.sample.create({
            data: {
                id: 'intake-normal-smp-' + SUFFIX,
                originalId: normalBarcode,
                assignedLab: labGHA.id,
                projectCode: projUS.code,
                projectId: projUS.id,
                status: 'EXPECTED',
                metadata: JSON.stringify({ kobo_id: 40960 })
            }
        });

        const normalIntakeRes = await request(app)
            .post('/api/reception/intake')
            .set('Authorization', tokenReception)
            .send({
                originalId: normalBarcode,
                decision: 'ACCEPTED',
                isDraft: true
            });

        expect(normalIntakeRes.status).toBe(200);
        expect(normalIntakeRes.body.success).toBe(true);
    });

    test('14. SampleWorkspaceService blocks canAcceptIntake when AMBIGUOUS_PROVENANCE_HOLD is active', async () => {
        const heldBarcode = 'WS-HELD-' + SUFFIX;
        const heldSample = await prisma.sample.create({
            data: {
                id: 'ws-held-smp-' + SUFFIX,
                originalId: heldBarcode,
                assignedLab: labGHA.id,
                projectCode: projUS.code,
                projectId: projUS.id,
                status: 'EXPECTED',
                metadata: JSON.stringify({
                    kobo_id: 40970,
                    provenanceHold: {
                        status: 'AMBIGUOUS_PROVENANCE_HOLD',
                        reason: 'Conflicting field surveyor'
                    }
                })
            }
        });

        const recUser = { id: 'usr-rec-test', username: 'rec_user', role: 'SAMPLE_RECEPTION', labId: labGHA.id };
        const wsHeld = await sampleWorkspaceService.getSampleWorkspace(heldSample.id, recUser);
        expect(wsHeld.capabilities.canAcceptIntake.allowed).toBe(false);
        expect(wsHeld.capabilities.canAcceptIntake.reason).toContain('Ambiguous specimen identity');

        // Unambiguous sample has canAcceptIntake allowed
        const normalBarcode = 'WS-NORMAL-' + SUFFIX;
        const normalSample = await prisma.sample.create({
            data: {
                id: 'ws-normal-smp-' + SUFFIX,
                originalId: normalBarcode,
                assignedLab: labGHA.id,
                projectCode: projUS.code,
                projectId: projUS.id,
                status: 'EXPECTED',
                metadata: JSON.stringify({ kobo_id: 40980 })
            }
        });

        const wsNormal = await sampleWorkspaceService.getSampleWorkspace(normalSample.id, recUser);
        expect(wsNormal.capabilities.canAcceptIntake.allowed).toBe(true);
    });

    test('15. Source-B primary record does not suppress source-A submission with same ID and depth (Finding 1)', async () => {
        const crossBarcode = 'GHA-PRIM-XFORM-' + SUFFIX;
        const sharedId = 41001;

        // Existing sample in DB was created by Source B (different form/server) as primary
        await prisma.sample.create({
            data: {
                id: 'smp-b-' + SUFFIX,
                originalId: crossBarcode,
                assignedLab: labGHA.id,
                projectCode: projUS.code,
                projectId: projUS.id,
                status: 'EXPECTED',
                metadata: JSON.stringify({
                    kobo_id: sharedId,
                    kobo_uuid: 'uuid-b-' + SUFFIX,
                    sourceServerUrl: 'https://source-b.test',
                    sourceFormId: 'form-b',
                    depth: 'D1'
                })
            }
        });

        // Incoming submission from configGHA (source-a/form-a) with identical kobo_id 41001 and depth D1
        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: sharedId,
                _uuid: 'uuid-a-' + SUFFIX,
                _submission_time: '2026-09-24T20:00:00',
                surveyor_name: 'surveyor_a',
                _attachments: []
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: crossBarcode,
                depth: 'D1',
                site_id: 'SITE-A',
                lat: 6.1,
                lng: -0.3,
                collected_at: '2026-09-24',
                kobo_submission_id: sharedId
            }
        ]);

        const syncResult = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(syncResult.newSamples).toBe(0);
        expect(syncResult.skipped).toBe(1);

        const updatedSample = await prisma.sample.findUnique({ where: { originalId: crossBarcode } });
        const updatedMeta = JSON.parse(updatedSample.metadata);

        // Must record conflicting submission from source-A, not suppress it
        expect(updatedMeta.conflictingSubmissions).toBeDefined();
        expect(updatedMeta.conflictingSubmissions.length).toBe(1);
        expect(updatedMeta.conflictingSubmissions[0].sourceServerUrl).toBe(configGHA.koboServerUrl);
        expect(updatedMeta.conflictingSubmissions[0].sourceFormId).toBe(configGHA.formId);
        expect(updatedMeta.provenanceHold?.status).toBe('AMBIGUOUS_PROVENANCE_HOLD');

        const audits = await prisma.auditLog.findMany({
            where: { entityId: updatedSample.id, action: 'KOBO_CONFLICTING_PROVENANCE' }
        });
        expect(audits.length).toBe(1);
    });

    test('16. Primary occurrence replayed with changed coordinates or attachments creates revision hold (Finding 2)', async () => {
        const revBarcode = 'GHA-PRIM-REV-' + SUFFIX;
        const subId = 41002;

        // Step 1: Initial admission of primary occurrence
        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: subId,
                _uuid: 'uuid-rev-1-' + SUFFIX,
                _submission_time: '2026-09-24T21:00:00',
                surveyor_name: 'surveyor_prim',
                _attachments: [{ filename: 'initial.jpg', download_url: 'https://source-a.test/initial.jpg' }]
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: revBarcode,
                depth: 'D1',
                site_id: 'SITE-REV-1',
                lat: 5.55,
                lng: -0.22,
                collected_at: '2026-09-24',
                kobo_submission_id: subId
            }
        ]);

        const pass1 = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(pass1.newSamples).toBe(1);

        const sampleInitial = await prisma.sample.findUnique({ where: { originalId: revBarcode } });
        expect(sampleInitial.rejectionReason).toBeNull();
        const metaInitial = JSON.parse(sampleInitial.metadata);
        expect(metaInitial.provenanceHold).toBeUndefined();

        // Step 2: Replay same primary occurrence with changed coordinates and revised photo
        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: subId,
                _uuid: 'uuid-rev-2-' + SUFFIX,
                _submission_time: '2026-09-24T21:30:00',
                surveyor_name: 'surveyor_prim',
                _attachments: [{ filename: 'revised.jpg', download_url: 'https://source-a.test/revised.jpg' }]
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: revBarcode,
                depth: 'D1',
                site_id: 'SITE-REV-2',
                lat: 9.99, // Changed coordinates!
                lng: -1.11,
                collected_at: '2026-09-24',
                kobo_submission_id: subId
            }
        ]);

        const pass2 = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(pass2.newSamples).toBe(0);
        expect(pass2.skipped).toBe(1);

        const sampleRevised = await prisma.sample.findUnique({ where: { originalId: revBarcode } });
        expect(sampleRevised.rejectionReason).toContain('PROVENANCE_HOLD');
        const metaRevised = JSON.parse(sampleRevised.metadata);
        expect(metaRevised.provenanceHold?.status).toBe('AMBIGUOUS_PROVENANCE_HOLD');
        expect(metaRevised.revisions).toBeDefined();
        expect(metaRevised.revisions.length).toBe(1);
        expect(metaRevised.revisions[0].lat).toBe(9.99);

        const audits = await prisma.auditLog.findMany({
            where: { entityId: sampleRevised.id, action: 'KOBO_CONFLICTING_PROVENANCE' }
        });
        expect(audits.length).toBe(1);
    });

    test('17. Conflicting occurrence replayed with changed coordinates preserves revision append-only', async () => {
        const confRevBarcode = 'GHA-CONF-REV-' + SUFFIX;
        const primId = 41010;
        const confId = 41011;

        // Step 1: Initial admission of primary occurrence
        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: primId,
                _uuid: 'uuid-prim-' + SUFFIX,
                _submission_time: '2026-09-24T22:00:00',
                surveyor_name: 'surveyor_p',
                _attachments: []
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: confRevBarcode,
                depth: 'D1',
                site_id: 'SITE-P',
                lat: 5.0,
                lng: -0.1,
                collected_at: '2026-09-24',
                kobo_submission_id: primId
            }
        ]);
        await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');

        // Step 2: Conflicting submission from surveyor B
        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: confId,
                _uuid: 'uuid-conf-1-' + SUFFIX,
                _submission_time: '2026-09-24T22:05:00',
                surveyor_name: 'surveyor_c',
                _attachments: []
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: confRevBarcode,
                depth: 'D1',
                site_id: 'SITE-C1',
                lat: 5.1,
                lng: -0.2,
                collected_at: '2026-09-24',
                kobo_submission_id: confId
            }
        ]);
        await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');

        // Step 3: Replay conflicting submission with revised coordinates
        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: confId,
                _uuid: 'uuid-conf-2-' + SUFFIX,
                _submission_time: '2026-09-24T22:15:00',
                surveyor_name: 'surveyor_c',
                _attachments: []
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: confRevBarcode,
                depth: 'D1',
                site_id: 'SITE-C2',
                lat: 5.9, // Revised conflict coordinates
                lng: -0.8,
                collected_at: '2026-09-24',
                kobo_submission_id: confId
            }
        ]);
        await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');

        const finalSample = await prisma.sample.findUnique({ where: { originalId: confRevBarcode } });
        const finalMeta = JSON.parse(finalSample.metadata);
        expect(finalMeta.conflictingSubmissions.length).toBe(1);
        const conflictRecord = finalMeta.conflictingSubmissions[0];
        expect(conflictRecord.lat).toBe(5.9);
        expect(conflictRecord.revisions).toBeDefined();
        expect(conflictRecord.revisions.length).toBe(1);
        expect(conflictRecord.revisions[0].lat).toBe(5.1);
    });

    test('18. Repeated revised-primary replay with identical revised evidence is idempotent (da8b561 review regression)', async () => {
        const repeatRevBarcode = 'GHA-PRIM-REPEAT-' + SUFFIX;
        const subId = 41020;

        // Step 1: Initial admission of primary occurrence
        koboService.fetchSubmissions.mockResolvedValueOnce([
            {
                _id: subId,
                _uuid: 'uuid-prim-orig-' + SUFFIX,
                _submission_time: '2026-09-24T23:00:00',
                surveyor_name: 'surveyor_prim',
                _attachments: [{ filename: 'orig.jpg', download_url: 'https://test/orig.jpg' }]
            }
        ]);
        koboService.transformSubmission.mockReturnValueOnce([
            {
                original_id: repeatRevBarcode,
                depth: 'D1',
                site_id: 'SITE-PRIM-1',
                lat: 5.5,
                lng: -0.2,
                collected_at: '2026-09-24',
                kobo_submission_id: subId
            }
        ]);
        const pass1 = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(pass1.newSamples).toBe(1);

        // Step 2: Revised primary occurrence (changed coordinates)
        const revisedSub = {
            _id: subId,
            _uuid: 'uuid-prim-rev-' + SUFFIX,
            _submission_time: '2026-09-24T23:30:00',
            surveyor_name: 'surveyor_prim',
            _attachments: [{ filename: 'rev.jpg', download_url: 'https://test/rev.jpg' }]
        };
        const revisedTransform = {
            original_id: repeatRevBarcode,
            depth: 'D1',
            site_id: 'SITE-PRIM-2',
            lat: 6.66,
            lng: -0.99,
            collected_at: '2026-09-24',
            kobo_submission_id: subId
        };

        koboService.fetchSubmissions.mockResolvedValueOnce([revisedSub]);
        koboService.transformSubmission.mockReturnValueOnce([revisedTransform]);

        const pass2 = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(pass2.newSamples).toBe(0);
        expect(pass2.skipped).toBe(1);

        const sampleAfterPass2 = await prisma.sample.findUnique({ where: { originalId: repeatRevBarcode } });
        const metaPass2 = JSON.parse(sampleAfterPass2.metadata);
        expect(metaPass2.revisions?.length).toBe(1);
        expect(metaPass2.conflictingSubmissions?.length).toBe(1);
        expect(metaPass2.provenanceHold?.status).toBe('AMBIGUOUS_PROVENANCE_HOLD');

        const auditsAfterPass2 = await prisma.auditLog.findMany({
            where: { entityId: sampleAfterPass2.id, action: 'KOBO_CONFLICTING_PROVENANCE' }
        });
        expect(auditsAfterPass2.length).toBe(1);

        // Step 3: Replay the EXACT SAME revised submission
        koboService.fetchSubmissions.mockResolvedValueOnce([revisedSub]);
        koboService.transformSubmission.mockReturnValueOnce([revisedTransform]);

        const pass3 = await koboController._syncLabSubmissions(configGHA, 'TEST_SYNC');
        expect(pass3.newSamples).toBe(0);
        expect(pass3.skipped).toBe(1);

        const sampleAfterPass3 = await prisma.sample.findUnique({ where: { originalId: repeatRevBarcode } });
        const metaPass3 = JSON.parse(sampleAfterPass3.metadata);
        // Invariants: zero duplicate revisions, zero duplicate conflict entries, zero duplicate audits
        expect(metaPass3.revisions?.length).toBe(1);
        expect(metaPass3.conflictingSubmissions?.length).toBe(1);

        const auditsAfterPass3 = await prisma.auditLog.findMany({
            where: { entityId: sampleAfterPass3.id, action: 'KOBO_CONFLICTING_PROVENANCE' }
        });
        expect(auditsAfterPass3.length).toBe(1); // STILL 1!
    });
});
