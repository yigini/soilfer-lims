'use strict';

/**
 * Project Governance Retry Recovery & Preview Contract Verification (C01, C02, A12, A14)
 *
 * Verifies:
 * - C01: Lost response recovery: Server commits, response lost, client retries with same key -> exactly 1 mutation/audit/receipt, cached outcome returned.
 * - C01: Operation receipt lookup: GET /api/projects/:id/operations/:key returns recorded receipt.
 * - C01: Form payload change on reused key rejected with 409 collision.
 * - C01: Archive idempotency key and revision header enforcement; stale revision rejected with 409.
 * - C02: Mixed manifest preview-to-commit: duplicate/collision rows detected, valid subset signed in previewToken, commit succeeds for valid subset.
 * - C02: Stale preview token rejected with 409 PREVIEW_STALE_REVISION even when caller provides a fresh If-Match header.
 */

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');

describe('Project Governance Retry Recovery & Preview Contracts (C01, C02)', () => {
    const SUFFIX = 'GOV-' + Date.now();
    let labA, labB;
    let userOwner, userForeign;
    let tokenOwner, tokenForeign;
    let testProject;

    const signToken = (user) => {
        return jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
                labId: user.labId,
                tokenVersion: user.tokenVersion || 1
            },
            process.env.JWT_SECRET || 'soilfer-secret-key',
            { expiresIn: '1h' }
        );
    };

    beforeAll(async () => {
        labA = await prisma.lab.create({
            data: { id: 'LAB-A-' + SUFFIX, code: 'LA-' + SUFFIX.slice(-4), name: 'Gov Lab A ' + SUFFIX, country: 'Guatemala' }
        });
        labB = await prisma.lab.create({
            data: { id: 'LAB-B-' + SUFFIX, code: 'LB-' + SUFFIX.slice(-4), name: 'Gov Lab B ' + SUFFIX, country: 'Guatemala' }
        });

        userOwner = await prisma.user.create({
            data: { id: 'usr-owner-' + SUFFIX, username: 'owner_' + SUFFIX, email: 'owner@' + SUFFIX + '.test', password: 'hash', role: 'LAB_MANAGER', labId: labA.id, tokenVersion: 1 }
        });
        userForeign = await prisma.user.create({
            data: { id: 'usr-foreign-' + SUFFIX, username: 'foreign_' + SUFFIX, email: 'foreign@' + SUFFIX + '.test', password: 'hash', role: 'LAB_MANAGER', labId: labB.id, tokenVersion: 1 }
        });

        tokenOwner = signToken(userOwner);
        tokenForeign = signToken(userForeign);

        testProject = await prisma.project.create({
            data: {
                id: 'PROJ-GOV-' + SUFFIX,
                code: 'PROJ-GOV-' + SUFFIX,
                name: 'Gov Project ' + SUFFIX,
                status: 'ACTIVE',
                labId: labA.id,
                expectedSampleCount: 50
            }
        });

        await prisma.projectLab.create({
            data: { id: 'pl-gov-a-' + SUFFIX, projectCode: testProject.code, labId: labA.id, role: 'OWNER' }
        });
    });

    afterAll(async () => {
        await prisma.commandReceipt.deleteMany({
            where: { targetResource: { in: [`Project:${testProject.id}`, `Project:${testProject.code}`] } }
        }).catch(() => {});
        await prisma.sample.deleteMany({
            where: { projectId: testProject.id }
        }).catch(() => {});
        await prisma.auditLog.deleteMany({
            where: { entityId: testProject.id }
        }).catch(() => {});
        await prisma.projectLab.deleteMany({
            where: { projectCode: testProject.code }
        }).catch(() => {});
        await prisma.project.deleteMany({
            where: { id: testProject.id }
        }).catch(() => {});
        await prisma.user.deleteMany({
            where: { id: { in: [userOwner.id, userForeign.id] } }
        }).catch(() => {});
        await prisma.lab.deleteMany({
            where: { id: { in: [labA.id, labB.id] } }
        }).catch(() => {});
    });

    describe('C01: Real UI Retry Recovery & Receipt Resolution', () => {
        it('first execution commits, retry with same key returns cached receipt with exactly 1 audit & 1 receipt', async () => {
            const idempKey = 'key-retry-test-' + Date.now();
            const currentProj = await prisma.project.findUnique({ where: { id: testProject.id } });
            const revHeader = String(currentProj.updatedAt.getTime());

            // First attempt: succeeds
            const res1 = await request(app)
                .put(`/api/projects/${testProject.id}`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .set('x-idempotency-key', idempKey)
                .set('if-match', revHeader)
                .send({ name: 'Updated Gov Name ' + SUFFIX });

            expect(res1.status).toBe(200);

            const auditsAfterFirst = await prisma.auditLog.count({
                where: { entityId: testProject.id, action: 'PROJECT_UPDATED' }
            });
            const receiptsAfterFirst = await prisma.commandReceipt.count({
                where: { idempotencyKey: idempKey }
            });
            expect(receiptsAfterFirst).toBe(1);

            // Client simulated lost response: resolves receipt via GET /api/projects/:id/operations/:key
            const receiptLookup = await request(app)
                .get(`/api/projects/${testProject.id}/operations/${idempKey}`)
                .set('Authorization', `Bearer ${tokenOwner}`);

            expect(receiptLookup.status).toBe(200);
            expect(receiptLookup.body.status).toBe('success');
            expect(receiptLookup.body.receipt.idempotencyKey).toBe(idempKey);
            expect(receiptLookup.body.receipt.commandType).toBe('PROJECT_UPDATE');

            // Client retry: executes PUT again with same idempotency key
            const res2 = await request(app)
                .put(`/api/projects/${testProject.id}`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .set('x-idempotency-key', idempKey)
                .send({ name: 'Updated Gov Name ' + SUFFIX });

            expect(res2.status).toBe(200);

            // Verify exactly 1 audit log and 1 receipt exist (no double mutation)
            const auditsAfterRetry = await prisma.auditLog.count({
                where: { entityId: testProject.id, action: 'PROJECT_UPDATED' }
            });
            const receiptsAfterRetry = await prisma.commandReceipt.count({
                where: { idempotencyKey: idempKey }
            });
            expect(auditsAfterRetry).toBe(auditsAfterFirst);
            expect(receiptsAfterRetry).toBe(1);
        });

        it('changed form payload reusing a pending/completed key is rejected with 409 collision', async () => {
            const idempKey = 'key-collision-' + Date.now();
            const currentProj = await prisma.project.findUnique({ where: { id: testProject.id } });

            const res1 = await request(app)
                .put(`/api/projects/${testProject.id}`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .set('x-idempotency-key', idempKey)
                .set('if-match', String(currentProj.updatedAt.getTime()))
                .send({ name: 'Original Command Name' });

            expect(res1.status).toBe(200);

            // Send different payload with same key
            const res2 = await request(app)
                .put(`/api/projects/${testProject.id}`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .set('x-idempotency-key', idempKey)
                .send({ name: 'Altered Changed Name' });

            expect(res2.status).toBe(409);
            expect(res2.body.error).toContain('differing command parameters');
        });

        it('stale revision on PUT returns 409 STALE_REVISION', async () => {
            const staleRev = String(Date.now() - 3600000);
            const res = await request(app)
                .put(`/api/projects/${testProject.id}`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .set('if-match', staleRev)
                .send({ name: 'Stale Attempt' });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('STALE_REVISION');
        });

        it('archiveProject supports idempotency replay, receipt lookup, and rejects stale revision', async () => {
            // Create a clean project with zero expected samples for archival
            const cleanProject = await prisma.project.create({
                data: {
                    id: 'PROJ-ARCH-' + SUFFIX,
                    code: 'PROJ-ARCH-' + SUFFIX,
                    name: 'Archival Ready Project',
                    status: 'ACTIVE',
                    labId: labA.id,
                    expectedSampleCount: 0
                }
            });
            await prisma.projectLab.create({
                data: { id: 'pl-arch-' + SUFFIX, projectCode: cleanProject.code, labId: labA.id, role: 'OWNER' }
            });

            const archKey = 'arch-key-' + Date.now();
            const rev = String(cleanProject.updatedAt.getTime());

            // 1. Archive with stale revision rejected
            const staleArchRes = await request(app)
                .post(`/api/projects/${cleanProject.id}/archive`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .set('if-match', '99999')
                .send({ reason: 'Stale archive attempt' });

            expect(staleArchRes.status).toBe(409);
            expect(staleArchRes.body.code).toBe('STALE_REVISION');

            // 2. Archive with correct revision and idempotency key
            const archRes1 = await request(app)
                .post(`/api/projects/${cleanProject.id}/archive`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .set('x-idempotency-key', archKey)
                .set('if-match', rev)
                .send({ reason: 'Legitimate archival season end' });

            expect(archRes1.status).toBe(200);
            expect(archRes1.body.messageCode).toBe('PROJECT_ARCHIVED');

            const archAudits1 = await prisma.auditLog.count({
                where: { entityId: cleanProject.id, action: 'ARCHIVE' }
            });
            expect(archAudits1).toBe(1);

            // 3. Receipt lookup
            const receiptRes = await request(app)
                .get(`/api/projects/${cleanProject.id}/operations/${archKey}`)
                .set('Authorization', `Bearer ${tokenOwner}`);

            expect(receiptRes.status).toBe(200);
            expect(receiptRes.body.receipt.commandType).toBe('PROJECT_ARCHIVE');

            // 4. Lost response retry with same key returns cached receipt
            const archRes2 = await request(app)
                .post(`/api/projects/${cleanProject.id}/archive`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .set('x-idempotency-key', archKey)
                .send({ reason: 'Legitimate archival season end' });

            expect(archRes2.status).toBe(200);
            expect(archRes2.body.messageCode).toBe('PROJECT_ARCHIVED');

            const archAudits2 = await prisma.auditLog.count({
                where: { entityId: cleanProject.id, action: 'ARCHIVE' }
            });
            expect(archAudits2).toBe(1); // Exactly 1 audit log!

            // 5. Differing reason with same key rejected with 409 collision
            const archCollisionRes = await request(app)
                .post(`/api/projects/${cleanProject.id}/archive`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .set('x-idempotency-key', archKey)
                .send({ reason: 'Completely different reason replaying old key' });

            expect(archCollisionRes.status).toBe(409);
            expect(archCollisionRes.body.error).toContain('differing command parameters');

            // Clean up
            await prisma.commandReceipt.deleteMany({ where: { idempotencyKey: archKey } }).catch(() => {});
            await prisma.auditLog.deleteMany({ where: { entityId: cleanProject.id } }).catch(() => {});
            await prisma.projectLab.deleteMany({ where: { projectCode: cleanProject.code } }).catch(() => {});
            await prisma.project.delete({ where: { id: cleanProject.id } }).catch(() => {});
        });
    });

    describe('C02: Preview/Commit Agreement & Stale Revision Binding', () => {
        it('mixed manifest (existing + new) signs validSampleIds and commits valid rows cleanly', async () => {
            // Seed 1 existing sample in DB
            const existingSid = 'SMP-EXIST-' + SUFFIX;
            await prisma.sample.create({
                data: {
                    id: existingSid,
                    originalId: existingSid,
                    projectId: testProject.id,
                    projectCode: testProject.code,
                    labId: labA.id,
                    assignedLab: labA.id,
                    status: 'RECEIVED'
                }
            });

            const newSid1 = 'SMP-NEW-1-' + SUFFIX;
            const newSid2 = 'SMP-NEW-2-' + SUFFIX;

            // Run preview with a mix of existing ID, batch duplicate, and new IDs
            const previewRes = await request(app)
                .post(`/api/projects/${testProject.id}/imports/preview`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .send({
                    sampleIds: [existingSid, newSid1, newSid2, newSid1] // existing + duplicates + new
                });

            expect(previewRes.status).toBe(200);
            expect(previewRes.body.conflictCount).toBe(1); // existingSid
            expect(previewRes.body.errorCount).toBe(1); // in-batch duplicate newSid1
            expect(previewRes.body.validCount).toBe(2);
            expect(previewRes.body.validSampleIds).toEqual([newSid1, newSid2]);
            expect(previewRes.body.previewToken).toBeDefined();

            const token = previewRes.body.previewToken;
            const validIds = previewRes.body.validSampleIds;

            // Commit valid rows as the UI does
            const commitRes = await request(app)
                .post(`/api/projects/${testProject.id}/manifest`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .send({
                    sampleIds: validIds,
                    previewToken: token,
                    targetLabId: labA.id
                });

            expect(commitRes.status).toBe(200);
            expect(commitRes.body.messageCode).toBe('MANIFEST_PROCESSED');
            expect(commitRes.body.data.count).toBe(2);

            // Verify both new samples were registered in DB
            const registered = await prisma.sample.findMany({
                where: { id: { in: [newSid1, newSid2] } }
            });
            expect(registered).toHaveLength(2);
        });

        it('stale preview token is rejected with 409 PREVIEW_STALE_REVISION even when fresh If-Match header is passed', async () => {
            const candidate = ['SMP-STALE-PREV-' + SUFFIX];

            // 1. Generate preview at current revision
            const prevRes = await request(app)
                .post(`/api/projects/${testProject.id}/imports/preview`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .send({ sampleIds: candidate });

            expect(prevRes.status).toBe(200);
            const stalePreviewToken = prevRes.body.previewToken;
            expect(stalePreviewToken).toBeDefined();

            // 2. Mutate project to advance project.updatedAt revision
            await new Promise(r => setTimeout(r, 20)); // Ensure timestamp difference
            const bumpRes = await request(app)
                .put(`/api/projects/${testProject.id}`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .send({ description: 'Bumped project revision ' + Date.now() });

            expect(bumpRes.status).toBe(200);
            const freshProj = await prisma.project.findUnique({ where: { id: testProject.id } });
            const freshRevHeader = String(freshProj.updatedAt.getTime());

            // 3. Attempt to commit using stale preview token from step 1 with the fresh If-Match header from step 2
            const commitRes = await request(app)
                .post(`/api/projects/${testProject.id}/manifest`)
                .set('Authorization', `Bearer ${tokenOwner}`)
                .set('if-match', freshRevHeader)
                .send({
                    sampleIds: candidate,
                    previewToken: stalePreviewToken,
                    targetLabId: labA.id
                });

            expect(commitRes.status).toBe(409);
            expect(commitRes.body.code).toBe('PREVIEW_STALE_REVISION');
            expect(commitRes.body.message).toContain('obsolete project revision');

            // Verify sample was NOT registered
            const sampleCheck = await prisma.sample.findUnique({ where: { id: candidate[0] } });
            expect(sampleCheck).toBeNull();
        });
    });
});
