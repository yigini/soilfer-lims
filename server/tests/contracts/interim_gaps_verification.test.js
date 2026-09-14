'use strict';

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');
const staffLifecycleService = require('../../services/staffLifecycleService');
const labLifecycleService = require('../../services/labLifecycleService');

describe('Interim Gaps 1, 2, 3 Verification (IR-14, Staff/Lab Review Tokens, Sync Parity & Atomicity)', () => {
    let testPrefix;
    let labA, labB;
    let superAdmin, managerA, techA, techA2, techB, targetStaff;
    let adminToken, techToken, techA2Token;
    let testSample;
    let testAnalyticalItem, testDryingItem, testSpectralItem;

    beforeAll(async () => {
        testPrefix = 'GAP-' + Date.now();
        const secret = process.env.JWT_SECRET || 'secret';

        // 1. Create labs
        labA = await prisma.lab.create({
            data: {
                id: 'LAB-A-' + testPrefix,
                code: 'LA-' + testPrefix,
                name: 'Lab Alpha ' + testPrefix,
                country: 'Guatemala',
                timezone: 'America/Guatemala',
                isActive: true
            }
        });

        labB = await prisma.lab.create({
            data: {
                id: 'LAB-B-' + testPrefix,
                code: 'LB-' + testPrefix,
                name: 'Lab Beta ' + testPrefix,
                country: 'France',
                timezone: 'Europe/Paris',
                isActive: true
            }
        });

        // 2. Create users
        superAdmin = await prisma.user.create({
            data: {
                id: 'admin-' + testPrefix,
                username: 'admin-' + testPrefix,
                email: `admin-${testPrefix}@example.com`,
                password: 'hash',
                role: 'SUPER_ADMIN',
                tokenVersion: 1,
                isActive: true
            }
        });

        managerA = await prisma.user.create({
            data: {
                id: 'mgr-' + testPrefix,
                username: 'mgr-' + testPrefix,
                email: `mgr-${testPrefix}@example.com`,
                password: 'hash',
                role: 'LAB_MANAGER',
                labId: labA.id,
                tokenVersion: 1,
                isActive: true
            }
        });

        techA = await prisma.user.create({
            data: {
                id: 'techA-' + testPrefix,
                username: 'techA-' + testPrefix,
                email: `techA-${testPrefix}@example.com`,
                password: 'hash',
                role: 'LAB_TECHNICIAN',
                labId: labA.id,
                tokenVersion: 1,
                isActive: true
            }
        });

        techA2 = await prisma.user.create({
            data: {
                id: 'techA2-' + testPrefix,
                username: 'techA2-' + testPrefix,
                email: `techA2-${testPrefix}@example.com`,
                password: 'hash',
                role: 'LAB_TECHNICIAN',
                labId: labA.id,
                tokenVersion: 1,
                isActive: true
            }
        });

        techB = await prisma.user.create({
            data: {
                id: 'techB-' + testPrefix,
                username: 'techB-' + testPrefix,
                email: `techB-${testPrefix}@example.com`,
                password: 'hash',
                role: 'LAB_TECHNICIAN',
                labId: labB.id,
                tokenVersion: 1,
                isActive: true
            }
        });

        targetStaff = await prisma.user.create({
            data: {
                id: 'target-' + testPrefix,
                username: 'target-' + testPrefix,
                email: `target-${testPrefix}@example.com`,
                password: 'hash',
                role: 'LAB_TECHNICIAN',
                labId: labA.id,
                tokenVersion: 1,
                isActive: true
            }
        });

        adminToken = jwt.sign(
            { id: superAdmin.id, username: superAdmin.username, role: superAdmin.role, tokenVersion: 1 },
            secret,
            { expiresIn: '1h' }
        );

        techToken = jwt.sign(
            { id: techA.id, username: techA.username, role: techA.role, labId: labA.id, tokenVersion: 1 },
            secret,
            { expiresIn: '1h' }
        );

        techA2Token = jwt.sign(
            { id: techA2.id, username: techA2.username, role: techA2.role, labId: labA.id, tokenVersion: 1 },
            secret,
            { expiresIn: '1h' }
        );

        // 3. Create Sample and WorkItems
        testSample = await prisma.sample.create({
            data: {
                id: 'SMP-' + testPrefix,
                originalId: 'ORIG-' + testPrefix,
                labId: labA.id,
                assignedLab: labA.id,
                status: 'ACCEPTED',
                receptionDate: new Date(),
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            }
        });

        testAnalyticalItem = await prisma.workItem.create({
            data: {
                id: 'WI-ANA-' + testPrefix,
                sampleId: testSample.id,
                labId: labA.id,
                assignedLab: labA.id,
                analysis: 'PH_H2O',
                category: 'Chemical Analysis',
                status: 'ASSIGNED',
                assignedTo: techA.username,
                version: 1
            }
        });

        testDryingItem = await prisma.workItem.create({
            data: {
                id: 'WI-DRY-' + testPrefix,
                sampleId: testSample.id,
                labId: labA.id,
                assignedLab: labA.id,
                analysis: 'DRYING',
                category: 'Operational Gates',
                status: 'ASSIGNED',
                assignedTo: techA.username,
                version: 1
            }
        });

        testSpectralItem = await prisma.workItem.create({
            data: {
                id: 'WI-SPEC-' + testPrefix,
                sampleId: testSample.id,
                labId: labA.id,
                assignedLab: labA.id,
                analysis: 'SPEC_MIR',
                category: 'Spectroscopy',
                status: 'ASSIGNED',
                assignedTo: techA.username,
                version: 1
            }
        });
    });

    afterAll(async () => {
        try {
            await prisma.commandReceipt.deleteMany({
                where: { actor: { in: [techA.username, techA2.username, managerA.username, superAdmin.username] } }
            });
            await prisma.workAttempt.deleteMany({
                where: { workItemId: { in: [testAnalyticalItem.id, testDryingItem.id, testSpectralItem.id] } }
            });
            await prisma.result.deleteMany({
                where: { sampleId: testSample.id }
            });
            await prisma.workItemDraft.deleteMany({
                where: { workItemId: { in: [testAnalyticalItem.id, testDryingItem.id, testSpectralItem.id] } }
            });
            await prisma.workItem.deleteMany({
                where: { sampleId: testSample.id }
            });
            await prisma.sample.deleteMany({
                where: { id: testSample.id }
            });
            await prisma.apiKey.deleteMany({
                where: { name: { contains: testPrefix } }
            });
            await prisma.user.deleteMany({
                where: { id: { in: [superAdmin.id, managerA.id, techA.id, techA2.id, techB.id, targetStaff.id] } }
            });
            await prisma.lab.deleteMany({
                where: { id: { in: [labA.id, labB.id] } }
            });
        } catch (e) {
            // Ignore cleanup errors
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GAP 1: SIS API Key Scoping (IR-14)
    // ─────────────────────────────────────────────────────────────────────────
    describe('Gap 1: Explicit Laboratory Scoping for SIS Integration Keys (IR-14)', () => {
        test('POST /api/v1/data-exchange/keys rejects omitted or empty labs array even if countries provided', async () => {
            // Omitted labs with countries: ['*'] (reproduces R21 rejection)
            const resNoLabs = await request(app)
                .post('/api/v1/data-exchange/keys')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Test Omitted Labs ' + testPrefix,
                    role: 'NSIS_CONSUMER',
                    countries: ['*'],
                    expiresDays: 365
                });

            expect(resNoLabs.status).toBe(400);
            expect(resNoLabs.body.error).toBe('INVALID_LAB_SCOPE');

            // Empty labs array
            const resEmptyLabs = await request(app)
                .post('/api/v1/data-exchange/keys')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Test Empty Labs ' + testPrefix,
                    role: 'NSIS_CONSUMER',
                    labs: [],
                    expiresDays: 365
                });

            expect(resEmptyLabs.status).toBe(400);
            expect(resEmptyLabs.body.error).toBe('INVALID_LAB_SCOPE');
        });

        test('POST /api/v1/data-exchange/keys rejects non-existent laboratory identifier', async () => {
            const resUnknownLab = await request(app)
                .post('/api/v1/data-exchange/keys')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Test Unknown Lab ' + testPrefix,
                    role: 'NSIS_CONSUMER',
                    labs: ['NON_EXISTENT_LAB_XYZ'],
                    expiresDays: 365
                });

            expect(resUnknownLab.status).toBe(400);
            expect(resUnknownLab.body.error).toBe('INVALID_LAB_ID');
        });

        test('POST /api/v1/data-exchange/keys succeeds with real form payload (explicit labs & countries: null)', async () => {
            const res = await request(app)
                .post('/api/v1/data-exchange/keys')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Valid Key ' + testPrefix,
                    role: 'NSIS_CONSUMER',
                    countries: null,
                    labs: [labA.id],
                    expiresDays: 365
                });

            expect(res.status).toBe(200);
            expect(res.body.apiKey).toBeDefined();
            expect(res.body.keyInfo?.labs).toEqual([labA.id]);

            // Query with issued key against data exchange
            const liveKey = res.body.apiKey;

            // Create authorized RELEASED sample in labA
            const releasedSampleA = await prisma.sample.create({
                data: {
                    id: 'SMP-REL-A-' + testPrefix,
                    originalId: 'ORIG-REL-A-' + testPrefix,
                    labId: labA.id,
                    assignedLab: labA.id,
                    status: 'RELEASED'
                }
            });

            // Create a foreign RELEASED sample in labB
            const foreignSample = await prisma.sample.create({
                data: {
                    id: 'SMP-FOREIGN-' + testPrefix,
                    originalId: 'ORIG-FOREIGN-' + testPrefix,
                    labId: labB.id,
                    assignedLab: labB.id,
                    status: 'RELEASED'
                }
            });

            // Scoped key can query /samples and sees only authorized labA released sample
            const samplesRes = await request(app)
                .get('/api/v1/data-exchange/samples')
                .set('x-api-key', liveKey);

            expect(samplesRes.status).toBe(200);
            const returnedIds = (samplesRes.body.data || []).map(s => s.id);
            // Authorized released sample is visible
            expect(returnedIds).toContain(releasedSampleA.originalId || releasedSampleA.id);
            // Foreign lab sample is denied
            expect(returnedIds).not.toContain(foreignSample.originalId || foreignSample.id);
            // Pre-release ACCEPTED sample in authorized lab is denied (SIS release protection preserved)
            expect(returnedIds).not.toContain(testSample.originalId || testSample.id);

            // Explicitly requesting unauthorized lab returns empty
            const unauthQueryRes = await request(app)
                .get(`/api/v1/data-exchange/samples?labId=${labB.id}`)
                .set('x-api-key', liveKey);

            expect(unauthQueryRes.status).toBe(200);
            expect(unauthQueryRes.body.data).toHaveLength(0);

            // Clean up temporary samples
            await prisma.sample.delete({ where: { id: releasedSampleA.id } }).catch(() => {});
            await prisma.sample.delete({ where: { id: foreignSample.id } }).catch(() => {});
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GAP 2: Staff & Lab Lifecycle Review Tokens Binding
    // ─────────────────────────────────────────────────────────────────────────
    describe('Gap 2: Review Token Binding to Normalized Changes and Current Revision', () => {
        test('Staff review token rejects altered changes payload', async () => {
            // Generate valid preview for role: VIEWER
            const preview = await staffLifecycleService.getAccessPreview(
                superAdmin,
                targetStaff.id,
                { role: 'VIEWER' }
            );

            expect(preview.reviewToken).toBeDefined();

            // Attempt to apply different changes (e.g. role: LAB_TECHNICIAN) using that token
            await expect(
                staffLifecycleService.applyAccessChanges(
                    superAdmin,
                    targetStaff.id,
                    {
                        changes: { role: 'LAB_TECHNICIAN' },
                        reviewToken: preview.reviewToken,
                        reason: 'Unauthorized payload change'
                    }
                )
            ).rejects.toThrow();
        });

        test('Staff review token rejects stale tokenVersion (concurrent modification)', async () => {
            const preview = await staffLifecycleService.getAccessPreview(
                superAdmin,
                targetStaff.id,
                { role: 'VIEWER' }
            );

            // Concurrently increment targetStaff's tokenVersion
            await prisma.user.update({
                where: { id: targetStaff.id },
                data: { tokenVersion: { increment: 1 } }
            });

            // Now apply using the stale token
            await expect(
                staffLifecycleService.applyAccessChanges(
                    superAdmin,
                    targetStaff.id,
                    {
                        changes: { role: 'VIEWER' },
                        reviewToken: preview.reviewToken,
                        reason: 'Stale token test'
                    }
                )
            ).rejects.toThrow();
        });

        test('Lab review token rejects altered targetState', async () => {
            const preview = await labLifecycleService.getLifecyclePreview(
                superAdmin,
                labA.id,
                'PAUSED'
            );

            expect(preview.reviewToken).toBeDefined();

            // Try to transition to RETIRED using the PAUSED token
            await expect(
                labLifecycleService.transitionLifecycle(
                    superAdmin,
                    labA.id,
                    {
                        targetState: 'RETIRED',
                        reason: 'Altered target state',
                        reviewToken: preview.reviewToken
                    }
                )
            ).rejects.toThrow();
        });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // GAP 3: SyncService Parity, Atomic Transactions, Canonical Result/WorkAttempt
    // ─────────────────────────────────────────────────────────────────────────
    describe('Gap 3: SyncService Parity, Atomicity, and Canonical Writes', () => {
        test('SAVE_WORK_DRAFT: stores draft and receipt atomically, duplicate returns DUPLICATE_APPLIED', async () => {
            const opId = 'op_draft_' + testPrefix;

            // 1. First save draft
            const res1 = await request(app)
                .post('/api/sync/operations')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    protocolVersion: 1,
                    deviceId: 'dev_test_' + testPrefix,
                    operations: [{
                        operationId: opId,
                        type: 'SAVE_WORK_DRAFT',
                        target: { workItemId: testAnalyticalItem.id },
                        payload: { value: '6.45' }
                    }]
                });

            expect(res1.status).toBe(200);
            expect(res1.body.receipts[0].status).toBe('APPLIED');
            const receiptId1 = res1.body.receipts[0].receiptId;
            expect(receiptId1).toBeDefined();

            // Verify stored receipt uses raw workItemId as targetResource
            const dbReceipt = await prisma.commandReceipt.findUnique({
                where: { idempotencyKey: opId }
            });
            expect(dbReceipt).toBeDefined();
            expect(dbReceipt.targetResource).toBe(testAnalyticalItem.id);
            expect(dbReceipt.id).toBe(receiptId1);

            // 2. Duplicate submission with same opId returns DUPLICATE_APPLIED (no false conflict)
            const res2 = await request(app)
                .post('/api/sync/operations')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    protocolVersion: 1,
                    deviceId: 'dev_test_' + testPrefix,
                    operations: [{
                        operationId: opId,
                        type: 'SAVE_WORK_DRAFT',
                        target: { workItemId: testAnalyticalItem.id },
                        payload: { value: '6.45' }
                    }]
                });

            expect(res2.status).toBe(200);
            expect(res2.body.receipts[0].status).toBe('DUPLICATE_APPLIED');
            expect(res2.body.receipts[0].receiptId).toBe(receiptId1);
        });

        test('COMPLETE_WORK rejects operational gate tasks (DRYING) with scalar value', async () => {
            const res = await request(app)
                .post('/api/sync/operations')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    protocolVersion: 1,
                    deviceId: 'dev_test_' + testPrefix,
                    operations: [{
                        operationId: 'op_gate_rej_' + testPrefix,
                        type: 'COMPLETE_WORK',
                        target: { workItemId: testDryingItem.id },
                        payload: { value: '45.0' }
                    }]
                });

            expect(res.status).toBe(200);
            expect(res.body.receipts[0].status).toBe('REJECTED');
            expect(res.body.receipts[0].code).toBe('OPERATIONAL_GATE_REJECTED');
        });

        test('COMPLETE_WORK rejects spectral tasks (SPEC_MIR) with scalar value', async () => {
            const res = await request(app)
                .post('/api/sync/operations')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    protocolVersion: 1,
                    deviceId: 'dev_test_' + testPrefix,
                    operations: [{
                        operationId: 'op_spectral_rej_' + testPrefix,
                        type: 'COMPLETE_WORK',
                        target: { workItemId: testSpectralItem.id },
                        payload: { value: '1.25' }
                    }]
                });

            expect(res.status).toBe(200);
            expect(res.body.receipts[0].status).toBe('REJECTED');
            expect(res.body.receipts[0].code).toBe('SPECTRAL_SCALAR_REJECTED');
        });

        test('COMPLETE_WORK rejects technician not assigned to work item', async () => {
            // techA2 is in labA, but testAnalyticalItem is assigned to techA
            const res = await request(app)
                .post('/api/sync/operations')
                .set('Authorization', `Bearer ${techA2Token}`)
                .send({
                    protocolVersion: 1,
                    deviceId: 'dev_test_' + testPrefix,
                    operations: [{
                        operationId: 'op_unassigned_' + testPrefix,
                        type: 'COMPLETE_WORK',
                        target: { workItemId: testAnalyticalItem.id },
                        payload: { value: '7.10' }
                    }]
                });

            expect(res.status).toBe(200);
            expect(res.body.receipts[0].status).toBe('REJECTED');
            expect(res.body.receipts[0].code).toBe('NOT_ASSIGNED_TECHNICIAN');
        });

        test('COMPLETE_WORK creates canonical Result and WorkAttempt records in transaction', async () => {
            const opId = 'op_complete_canonical_' + testPrefix;

            const res = await request(app)
                .post('/api/sync/operations')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    protocolVersion: 1,
                    deviceId: 'dev_test_' + testPrefix,
                    operations: [{
                        operationId: opId,
                        type: 'COMPLETE_WORK',
                        target: { workItemId: testAnalyticalItem.id },
                        payload: { value: '6.85', basis: 'AIR_DRY' }
                    }]
                });

            expect(res.status).toBe(200);
            const receipt = res.body.receipts[0];
            expect(receipt.status).toBe('APPLIED');
            expect(receipt.receiptId).toBeDefined();

            // Verify canonical Result record created
            const resultRecord = await prisma.result.findFirst({
                where: { sampleId: testSample.id, param: 'PH_H2O', isCurrent: true }
            });
            expect(resultRecord).toBeDefined();
            expect(resultRecord.value).toBe('6.85');
            expect(resultRecord.numericValue).toBe(6.85);
            expect(resultRecord.enteredBy).toBe(techA.username);

            // Verify canonical WorkAttempt record created
            const attemptRecord = await prisma.workAttempt.findFirst({
                where: { workItemId: testAnalyticalItem.id }
            });
            expect(attemptRecord).toBeDefined();
            expect(attemptRecord.author).toBe(techA.username);
            expect(attemptRecord.status).toBe('RECORDED');

            // Verify WorkItem updated to COMPLETED
            const updatedItem = await prisma.workItem.findUnique({
                where: { id: testAnalyticalItem.id }
            });
            expect(updatedItem.status).toBe('COMPLETED');
            expect(updatedItem.result).toBe('6.85');

            // Verify CommandReceipt stored with persisted receiptId
            const dbReceipt = await prisma.commandReceipt.findUnique({
                where: { idempotencyKey: opId }
            });
            expect(dbReceipt).toBeDefined();
            expect(dbReceipt.id).toBe(receipt.receiptId);
            expect(dbReceipt.targetResource).toBe(testAnalyticalItem.id);
        });
    });
});
