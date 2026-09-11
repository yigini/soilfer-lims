'use strict';

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');

describe('Mobile Offline Work & Idempotent Synchronization Contracts', () => {
    let techToken;
    let managerToken;
    let testSample;
    let testDryingItem;
    let testAnalyticalItem;
    const testDeviceId = 'test_dev_mobile_001';

    beforeAll(async () => {
        const secret = process.env.JWT_SECRET || 'test_secret';

        // Generate tech token
        techToken = jwt.sign(
            { id: 'tech_sync_user', username: 'tech_sync_user', role: 'LAB_TECHNICIAN', labId: 'LAB-TEST-SYNC' },
            secret,
            { expiresIn: '1h' }
        );

        // Generate manager token
        managerToken = jwt.sign(
            { id: 'mgr_sync_user', username: 'mgr_sync_user', role: 'LAB_MANAGER', labId: 'LAB-TEST-SYNC' },
            secret,
            { expiresIn: '1h' }
        );

        // Ensure test users exist
        for (const u of [
            { username: 'tech_sync_user', role: 'LAB_TECHNICIAN', labId: 'LAB-TEST-SYNC' },
            { username: 'mgr_sync_user', role: 'LAB_MANAGER', labId: 'LAB-TEST-SYNC' }
        ]) {
            await prisma.user.upsert({
                where: { username: u.username },
                update: {},
                create: {
                    id: u.username,
                    username: u.username,
                    email: `${u.username}@example.com`,
                    password: 'hash',
                    role: u.role,
                    labId: u.labId
                }
            });
        }

        // Create test sample and work items
        testSample = await prisma.sample.create({
            data: {
                id: 'SMP-SYNC-TEST-001',
                originalId: 'ORIG-SYNC-TEST-001',
                labId: 'LAB-TEST-SYNC',
                assignedLab: 'LAB-TEST-SYNC',
                status: 'ACCEPTED',
                receptionDate: new Date(),
                dryingStatus: 'PENDING',
                preparationStatus: 'DONE'
            }
        });

        testDryingItem = await prisma.workItem.create({
            data: {
                id: 'WI-SYNC-DRY-001',
                sampleId: testSample.id,
                labId: 'LAB-TEST-SYNC',
                analysis: 'DRYING',
                category: 'Operational Gates',
                status: 'ASSIGNED',
                assignedTo: 'tech_sync_user',
                version: 1
            }
        });

        testAnalyticalItem = await prisma.workItem.create({
            data: {
                id: 'WI-SYNC-PH-001',
                sampleId: testSample.id,
                labId: 'LAB-TEST-SYNC',
                analysis: 'PH_H2O',
                category: 'Chemical Analysis',
                status: 'ASSIGNED',
                assignedTo: 'tech_sync_user',
                version: 1
            }
        });
    });

    afterAll(async () => {
        // Clean up test data
        try {
            await prisma.commandReceipt.deleteMany({
                where: {
                    OR: [
                        { idempotencyKey: { startsWith: 'op_test_' } },
                        { actor: 'tech_sync_user' }
                    ]
                }
            });
            await prisma.workAttempt.deleteMany({
                where: { sampleId: testSample.id }
            });
            await prisma.workItem.deleteMany({
                where: { sampleId: testSample.id }
            });
            await prisma.sample.deleteMany({
                where: { id: { in: [testSample.id, 'SMP-NEW-SYNC-001'] } }
            });
        } catch (e) {
            // Ignore cleanup errors
        }
    });

    describe('1. Health & Sync Status', () => {
        test('GET /api/sync/status returns 200 with serverTime and protocolVersion', async () => {
            const res = await request(app).get('/api/sync/status');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
            expect(res.body.protocolVersion).toBe(1);
            expect(res.body.serverTime).toBeDefined();
        });
    });

    describe('2. Device Enrollment & Work Pack Preparation', () => {
        test('POST /api/offline/devices/enroll acknowledges device registration', async () => {
            const res = await request(app)
                .post('/api/offline/devices/enroll')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    deviceId: testDeviceId,
                    platform: 'android_tablet',
                    appVersion: '1.4.0'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.deviceId).toBe(testDeviceId);
            expect(res.body.leaseDurationHours).toBe(12);
        });

        test('POST /api/offline/packs/prepare creates a scoped work pack manifest', async () => {
            const res = await request(app)
                .post('/api/offline/packs/prepare')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    deviceId: testDeviceId,
                    labId: 'LAB-TEST-SYNC',
                    sampleIds: [testSample.id]
                });

            expect(res.status).toBe(200);
            expect(res.body.packId).toBeDefined();
            expect(res.body.leaseDurationHours).toBe(12);
            expect(res.body.expiresAt).toBeDefined();
            expect(res.body.samples).toBeInstanceOf(Array);
            expect(res.body.workItems).toBeInstanceOf(Array);
        });
    });

    describe('3. Batch Command Processing & Idempotency', () => {
        test('CONFIRM_OPERATION: atomically applies checklist and returns APPLIED', async () => {
            const opId = 'op_test_confirm_dry_001';
            const res = await request(app)
                .post('/api/sync/operations')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    protocolVersion: 1,
                    deviceId: testDeviceId,
                    operations: [{
                        operationId: opId,
                        type: 'CONFIRM_OPERATION',
                        target: { workItemId: testDryingItem.id },
                        baseVersion: 1,
                        capturedAtLocal: new Date().toISOString(),
                        payload: {
                            checklist: [true, true, true],
                            observations: 'Sample dry after 24h at 40C'
                        }
                    }]
                });

            expect(res.status).toBe(200);
            expect(res.body.receipts).toHaveLength(1);
            const receipt = res.body.receipts[0];
            expect(receipt.operationId).toBe(opId);
            expect(receipt.status).toBe('APPLIED');
        });

        test('CONFIRM_OPERATION: duplicate submission with same ID returns DUPLICATE_APPLIED', async () => {
            const opId = 'op_test_confirm_dry_001';
            const res = await request(app)
                .post('/api/sync/operations')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    protocolVersion: 1,
                    deviceId: testDeviceId,
                    operations: [{
                        operationId: opId,
                        type: 'CONFIRM_OPERATION',
                        target: { workItemId: testDryingItem.id },
                        baseVersion: 1,
                        capturedAtLocal: new Date().toISOString(),
                        payload: {
                            checklist: [true, true, true],
                            observations: 'Sample dry after 24h at 40C'
                        }
                    }]
                });

            expect(res.status).toBe(200);
            expect(res.body.receipts).toHaveLength(1);
            const receipt = res.body.receipts[0];
            expect(receipt.operationId).toBe(opId);
            expect(receipt.status).toBe('DUPLICATE_APPLIED');
        });

        test('COMPLETE_WORK: validates determination and updates WorkItem status', async () => {
            const opId = 'op_test_complete_ph_001';
            const res = await request(app)
                .post('/api/sync/operations')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    protocolVersion: 1,
                    deviceId: testDeviceId,
                    operations: [{
                        operationId: opId,
                        type: 'COMPLETE_WORK',
                        target: { workItemId: testAnalyticalItem.id },
                        baseVersion: 1,
                        capturedAtLocal: new Date().toISOString(),
                        payload: {
                            value: '6.85'
                        }
                    }]
                });

            expect(res.status).toBe(200);
            expect(res.body.receipts).toHaveLength(1);
            const receipt = res.body.receipts[0];
            expect(receipt.operationId).toBe(opId);
            expect(receipt.status).toBe('APPLIED');

            // Verify work item updated in DB
            const updated = await prisma.workItem.findUnique({
                where: { id: testAnalyticalItem.id }
            });
            expect(updated.status).toBe('COMPLETED');
            expect(updated.result).toBe('6.85');
        });

        test('CONFLICT: Reused idempotency key with different target returns CONFLICT', async () => {
            const opId = 'op_test_complete_ph_001'; // Reusing opId from previous test
            const res = await request(app)
                .post('/api/sync/operations')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    protocolVersion: 1,
                    deviceId: testDeviceId,
                    operations: [{
                        operationId: opId,
                        type: 'COMPLETE_WORK',
                        target: { workItemId: 'WI-DIFFERENT-TARGET' },
                        baseVersion: 1,
                        capturedAtLocal: new Date().toISOString(),
                        payload: {
                            value: '7.20'
                        }
                    }]
                });

            expect(res.status).toBe(200);
            expect(res.body.receipts).toHaveLength(1);
            const receipt = res.body.receipts[0];
            expect(receipt.operationId).toBe(opId);
            expect(receipt.status).toBe('CONFLICT');
        });
    });
});
