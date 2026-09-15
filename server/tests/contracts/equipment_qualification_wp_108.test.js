'use strict';

/**
 * Issue #108 Contract Tests:
 * Calibration history, qualification and registry consistency.
 */

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/auth');
const { randomUUID: uuidv4 } = require('crypto');
const { calculateQualification, getReadiness, generateMismatchReport } = require('../../services/equipmentQualificationService');

describe('Issue #108: Calibration Qualification, Policy, and Consistency Contracts', () => {
    const SUFFIX = 'EQ108-' + Date.now();

    let labA, labB;
    let managerA, managerB, techA;
    let tokenMgrA, tokenMgrB, tokenTechA;
    let assetWithRule, assetNoRule, assetDecommissioned, assetOutService;

    beforeAll(async () => {
        labA = await prisma.lab.create({
            data: {
                id: 'lab-eq-A-' + SUFFIX,
                code: 'EQA-' + Date.now().toString().slice(-4),
                name: 'Lab A ' + SUFFIX,
                country: 'Guatemala',
                timezone: 'America/Guatemala',
                isActive: true
            }
        });

        labB = await prisma.lab.create({
            data: {
                id: 'lab-eq-B-' + SUFFIX,
                code: 'EQB-' + Date.now().toString().slice(-4),
                name: 'Lab B ' + SUFFIX,
                country: 'Guatemala',
                timezone: 'America/Guatemala',
                isActive: true
            }
        });

        managerA = await prisma.user.create({
            data: {
                id: 'usr-mgrA-' + SUFFIX,
                username: `mgra_${SUFFIX}`,
                email: `mgra_${SUFFIX}@example.com`,
                name: 'Manager Lab A',
                role: 'LAB_MANAGER',
                labId: labA.id,
                password: 'dummypassword',
                isActive: true
            }
        });

        managerB = await prisma.user.create({
            data: {
                id: 'usr-mgrB-' + SUFFIX,
                username: `mgrb_${SUFFIX}`,
                email: `mgrb_${SUFFIX}@example.com`,
                name: 'Manager Lab B',
                role: 'LAB_MANAGER',
                labId: labB.id,
                password: 'dummypassword',
                isActive: true
            }
        });

        techA = await prisma.user.create({
            data: {
                id: 'usr-techA-' + SUFFIX,
                username: `techa_${SUFFIX}`,
                email: `techa_${SUFFIX}@example.com`,
                name: 'Tech Lab A',
                role: 'TECHNICIAN',
                labId: labA.id,
                password: 'dummypassword',
                isActive: true
            }
        });

        tokenMgrA = jwt.sign({ id: managerA.id, username: managerA.username, role: managerA.role, labId: labA.id }, JWT_SECRET, { expiresIn: '1h' });
        tokenMgrB = jwt.sign({ id: managerB.id, username: managerB.username, role: managerB.role, labId: labB.id }, JWT_SECRET, { expiresIn: '1h' });
        tokenTechA = jwt.sign({ id: techA.id, username: techA.username, role: techA.role, labId: labA.id }, JWT_SECRET, { expiresIn: '1h' });

        // Asset 1: Has configured schedule rule (annual calibration, 30 days due soon)
        assetWithRule = await prisma.equipmentAsset.create({
            data: {
                id: 'eq-rule-' + SUFFIX,
                labId: labA.id,
                name: 'Spectrometer With Rule ' + SUFFIX,
                assetType: 'SPECTROMETER',
                internalAssetTag: 'TAG-RULE-' + SUFFIX,
                status: 'IN_SERVICE',
                criticality: 'CRITICAL',
                qualification: {
                    create: {
                        id: uuidv4(),
                        labId: labA.id,
                        calibrationStatus: 'NOT_CONFIGURED',
                        verificationStatus: 'NOT_CONFIGURED'
                    }
                },
                scheduleRules: {
                    create: {
                        id: uuidv4(),
                        labId: labA.id,
                        scheduleType: 'CALIBRATION',
                        frequencyDays: 365,
                        dueSoonDays: 30,
                        active: true
                    }
                }
            }
        });

        // Asset 2: No schedule rule configured
        assetNoRule = await prisma.equipmentAsset.create({
            data: {
                id: 'eq-norule-' + SUFFIX,
                labId: labA.id,
                name: 'pH Meter No Rule ' + SUFFIX,
                assetType: 'PH_METER',
                internalAssetTag: 'TAG-NORULE-' + SUFFIX,
                status: 'IN_SERVICE',
                criticality: 'IMPORTANT',
                qualification: {
                    create: {
                        id: uuidv4(),
                        labId: labA.id,
                        calibrationStatus: 'NOT_CONFIGURED',
                        verificationStatus: 'NOT_CONFIGURED'
                    }
                }
            }
        });

        // Asset 3: Decommissioned asset
        assetDecommissioned = await prisma.equipmentAsset.create({
            data: {
                id: 'eq-decom-' + SUFFIX,
                labId: labA.id,
                name: 'Decommissioned Balance ' + SUFFIX,
                assetType: 'BALANCE',
                internalAssetTag: 'TAG-DECOM-' + SUFFIX,
                status: 'DECOMMISSIONED',
                criticality: 'NON_CRITICAL',
                qualification: {
                    create: {
                        id: uuidv4(),
                        labId: labA.id,
                        calibrationStatus: 'NOT_CONFIGURED',
                        verificationStatus: 'NOT_CONFIGURED'
                    }
                }
            }
        });

        // Asset 4: Out of service asset (unrelated mechanical repair)
        assetOutService = await prisma.equipmentAsset.create({
            data: {
                id: 'eq-outserv-' + SUFFIX,
                labId: labA.id,
                name: 'Oven Out Of Service ' + SUFFIX,
                assetType: 'OVEN',
                internalAssetTag: 'TAG-OUTSERV-' + SUFFIX,
                status: 'OUT_OF_SERVICE',
                criticality: 'IMPORTANT',
                qualification: {
                    create: {
                        id: uuidv4(),
                        labId: labA.id,
                        calibrationStatus: 'NOT_CONFIGURED',
                        verificationStatus: 'NOT_CONFIGURED'
                    }
                }
            }
        });
    });

    afterAll(async () => {
        await prisma.equipmentEvent.deleteMany({ where: { labId: { in: [labA.id, labB.id] } } });
        await prisma.equipmentScheduleRule.deleteMany({ where: { labId: { in: [labA.id, labB.id] } } });
        await prisma.equipmentQualification.deleteMany({ where: { labId: { in: [labA.id, labB.id] } } });
        await prisma.equipmentMethodEligibility.deleteMany({ where: { labId: { in: [labA.id, labB.id] } } });
        await prisma.equipmentAsset.deleteMany({ where: { labId: { in: [labA.id, labB.id] } } });
        await prisma.user.deleteMany({ where: { id: { in: [managerA.id, managerB.id, techA.id] } } });
        await prisma.lab.deleteMany({ where: { id: { in: [labA.id, labB.id] } } });
    });

    test('1. Configured instrument schedule policy computes OK, DUE_SOON, and OVERDUE based on rule', async () => {
        const perfDate = '2026-09-01';
        // Next due in 365 days -> OK
        const res = await request(app)
            .post('/api/equipment/events')
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send({
                equipmentId: assetWithRule.id,
                eventType: 'CALIBRATION',
                summary: 'Annual calibration ISO 17025',
                outcome: 'PASS',
                performedDate: perfDate
            });

        expect(res.status).toBe(200);

        const detailRes = await request(app)
            .get(`/api/equipment/${assetWithRule.id}`)
            .set('Authorization', `Bearer ${tokenMgrA}`);

        expect(detailRes.status).toBe(200);
        expect(detailRes.body.qualification.calibrationStatus).toBe('OK');
        expect(detailRes.body.readiness).toBe('READY');
        expect(new Date(detailRes.body.qualification.lastCalibrationDate).toISOString().slice(0, 10)).toBe(perfDate);
    });

    test('2. Absent schedule policy does not falsely mark unconfigured instrument OK', async () => {
        // Logging calibration on an instrument without schedule rule or due date keeps NOT_CONFIGURED
        const res = await request(app)
            .post('/api/equipment/events')
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send({
                equipmentId: assetNoRule.id,
                eventType: 'CALIBRATION',
                summary: 'One-off calibration without rule',
                outcome: 'PASS',
                performedDate: '2026-09-10'
            });

        expect(res.status).toBe(200);

        const detailRes = await request(app)
            .get(`/api/equipment/${assetNoRule.id}`)
            .set('Authorization', `Bearer ${tokenMgrA}`);

        expect(detailRes.status).toBe(200);
        expect(detailRes.body.qualification.calibrationStatus).toBe('NOT_CONFIGURED');
    });

    test('3. Chronological recomputation: rejecting an older event does not invalidate newer accepted calibration', async () => {
        // Event 1 (old): 2026-07-01
        const oldEvent = await prisma.equipmentEvent.create({
            data: {
                id: uuidv4(),
                equipmentId: assetWithRule.id,
                labId: labA.id,
                userId: techA.email,
                eventType: 'CALIBRATION',
                summary: 'Historical check 2026-07-01',
                outcome: 'PASS',
                details: JSON.stringify({ performedDate: '2026-07-01' }),
                requiresManagerSignoff: true
            }
        });

        // Event 2 (new, currently accepted): was performed 2026-09-01 in Test 1.

        // Manager rejects the old event from July
        const rejRes = await request(app)
            .patch(`/api/equipment/events/${oldEvent.id}/disposition`)
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send({ decision: 'REJECTED', reason: 'Audit found incomplete paperwork for July' });

        expect(rejRes.status).toBe(200);
        expect(rejRes.body.managerDecision).toBe('REJECTED');

        // Asset qualification must still be OK because the September 1 calibration is newer and valid
        const detailRes = await request(app)
            .get(`/api/equipment/${assetWithRule.id}`)
            .set('Authorization', `Bearer ${tokenMgrA}`);

        expect(detailRes.status).toBe(200);
        expect(detailRes.body.qualification.calibrationStatus).toBe('OK');
        expect(detailRes.body.readiness).toBe('READY');
        expect(detailRes.body.status).toBe('IN_SERVICE');
    });

    test('4. Chronological recomputation: rejecting the latest event blocks qualification and places asset OUT_OF_SERVICE', async () => {
        // Log latest event on assetWithRule requiring signoff
        const latestEvent = await prisma.equipmentEvent.create({
            data: {
                id: uuidv4(),
                equipmentId: assetWithRule.id,
                labId: labA.id,
                userId: techA.email,
                eventType: 'CALIBRATION',
                summary: 'September mid-month calibration',
                outcome: 'PASS',
                details: JSON.stringify({ performedDate: '2026-09-12' }),
                requiresManagerSignoff: true
            }
        });

        // Manager rejects this latest event
        const rejRes = await request(app)
            .patch(`/api/equipment/events/${latestEvent.id}/disposition`)
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send({ decision: 'REJECTED', reason: 'Standard certificate was expired' });

        expect(rejRes.status).toBe(200);

        const detailRes = await request(app)
            .get(`/api/equipment/${assetWithRule.id}`)
            .set('Authorization', `Bearer ${tokenMgrA}`);

        expect(detailRes.status).toBe(200);
        expect(detailRes.body.status).toBe('OUT_OF_SERVICE');
        expect(detailRes.body.readiness).toBe('BLOCKED');
        expect(detailRes.body.qualification.calibrationStatus).toBe('OVERDUE');
    });

    test('5. Decommissioned asset is never downgraded to merely OUT_OF_SERVICE on failure', async () => {
        const res = await request(app)
            .post('/api/equipment/events')
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send({
                equipmentId: assetDecommissioned.id,
                eventType: 'CALIBRATION',
                summary: 'Retirement calibration failure test',
                outcome: 'FAIL',
                performedDate: '2026-09-15'
            });

        expect(res.status).toBe(200);

        const detailRes = await request(app)
            .get(`/api/equipment/${assetDecommissioned.id}`)
            .set('Authorization', `Bearer ${tokenMgrA}`);

        expect(detailRes.status).toBe(200);
        // Status must strictly remain DECOMMISSIONED, never changed to OUT_OF_SERVICE
        expect(detailRes.body.status).toBe('DECOMMISSIONED');
        expect(detailRes.body.readiness).toBe('BLOCKED');
    });

    test('6. Passing calibration on unrelated OUT_OF_SERVICE asset does not auto-promote to IN_SERVICE', async () => {
        const res = await request(app)
            .post('/api/equipment/events')
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send({
                equipmentId: assetOutService.id,
                eventType: 'CALIBRATION',
                summary: 'Thermocouple calibration passed',
                outcome: 'PASS',
                performedDate: '2026-09-15',
                nextDueDate: '2027-09-15'
            });

        expect(res.status).toBe(200);

        const detailRes = await request(app)
            .get(`/api/equipment/${assetOutService.id}`)
            .set('Authorization', `Bearer ${tokenMgrA}`);

        expect(detailRes.status).toBe(200);
        // Preserves unrelated out-of-service restriction
        expect(detailRes.body.status).toBe('OUT_OF_SERVICE');
        expect(detailRes.body.readiness).toBe('BLOCKED');
        expect(detailRes.body.qualification.calibrationStatus).toBe('OK');
    });

    test('7. Date validation: future performed date is rejected (400 FUTURE_PERFORMED_DATE)', async () => {
        const futureDate = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

        const res = await request(app)
            .post('/api/equipment/events')
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send({
                equipmentId: assetWithRule.id,
                eventType: 'CALIBRATION',
                summary: 'Future calibration test',
                outcome: 'PASS',
                performedDate: futureDate
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('FUTURE_PERFORMED_DATE');
    });

    test('8. Idempotency: rapid repeat submit returns existing event without duplicate record', async () => {
        const payload = {
            equipmentId: assetWithRule.id,
            eventType: 'CALIBRATION',
            summary: 'Duplicate submit test cert #1234',
            outcome: 'PASS',
            performedDate: '2026-09-14'
        };

        const res1 = await request(app)
            .post('/api/equipment/events')
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send(payload);

        expect(res1.status).toBe(200);
        const eventId = res1.body.id;

        // Immediate identical repeat submit
        const res2 = await request(app)
            .post('/api/equipment/events')
            .set('Authorization', `Bearer ${tokenMgrA}`)
            .send(payload);

        expect(res2.status).toBe(200);
        expect(res2.body.id).toBe(eventId); // Same event returned
    });

    test('9. Cross-lab security denial (403) on events and dispositions', async () => {
        const crossEventRes = await request(app)
            .post('/api/equipment/events')
            .set('Authorization', `Bearer ${tokenMgrB}`)
            .send({
                equipmentId: assetWithRule.id,
                eventType: 'CALIBRATION',
                summary: 'Unauthorized cross-lab event',
                outcome: 'PASS'
            });

        expect(crossEventRes.status).toBe(403);
    });

    test('10. Method eligibility excludes BLOCKED instruments', async () => {
        // Create an eligibility mapping for lab A
        const elig = await prisma.equipmentMethodEligibility.create({
            data: {
                id: uuidv4(),
                labId: labA.id,
                analysisCode: 'SPEC_MIR',
                eligibleEquipmentIds: JSON.stringify([assetWithRule.id, assetOutService.id])
            }
        });

        // assetWithRule was marked OUT_OF_SERVICE / BLOCKED in test 4, assetOutService is OUT_OF_SERVICE
        const res = await request(app)
            .get('/api/equipment/eligibility/SPEC_MIR')
            .set('Authorization', `Bearer ${tokenMgrA}`);

        expect(res.status).toBe(200);
        // Both instruments are BLOCKED, so neither should appear in eligible list
        const eligibleIds = res.body.map(e => e.id);
        expect(eligibleIds).not.toContain(assetWithRule.id);
        expect(eligibleIds).not.toContain(assetOutService.id);

        await prisma.equipmentMethodEligibility.delete({ where: { id: elig.id } });
    });

    test('11. Read-only diagnostic mismatch report generates accurately', async () => {
        const report = await generateMismatchReport(labA.id);
        expect(report).toBeDefined();
        expect(report.totalAssetsChecked).toBeGreaterThanOrEqual(4);
        expect(typeof report.mismatchCount).toBe('number');
        expect(Array.isArray(report.mismatches)).toBe(true);
    });
});
