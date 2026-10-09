const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const crypto = require('crypto');

describe('Issue #140 Work Package P2: SIS Shared Access & Publication Policy Contracts', () => {
    let testKeyScoped;
    let testKeyUnscoped;
    let sampleApprovedGtm;
    let samplePendingGtm;
    let sampleApprovedHnd;
    let sampleHoldGtm;

    beforeAll(async () => {
        require('../../services/exchangeStateService').getDb();
        const timestamp = Date.now();

        // 1. Approved GTM Sample
        sampleApprovedGtm = await createSampleFixture(prisma, {
            data: {
                id: `test-s-app-gtm-${timestamp}`,
                originalId: `GTM-APPROVED-${timestamp}`,
                labId: `LAB-GTM-APP-${timestamp}`,
                assignedLab: 'GTM-LAB1',
                country: 'GTM',
                projectCode: 'SOILFER-GTM',
                status: 'APPROVED',
                depthTopCm: 0,
                depthBottomCm: 20
            }
        });
        // Pin6060286651: explicit accepted owners and one final attempt per original row.
        await createWorkItemFixture(prisma, { data: { id: `${sampleApprovedGtm.id}-PH_H2O`, sampleId: sampleApprovedGtm.id,
            analysis: 'PH_H2O', assignedLab: sampleApprovedGtm.assignedLab, status: 'ACCEPTED' } });
        for (const data of [
                        {
                            id: `res-app-gtm-${timestamp}`,
                            param: 'PH_H2O',
                            value: '6.8',
                            numericValue: 6.8,
                            unit: 'pH_units',
                            isCurrent: true
                        }
                    ].map(result => ({ ...result, sampleId: sampleApprovedGtm.id }))) await createExecutionResultFixture(prisma, { attemptStatus: 'ACCEPTED', data });
        await require('../setup').ensureTestLab(sampleApprovedGtm.assignedLab,'GTM');
        const reviewer=await require('../setup').getAuthToken('LAB_MANAGER',sampleApprovedGtm.assignedLab);
        await require('../helpers/qcPolicyFixture').setFixtureQcRequirement(prisma,reviewer,sampleApprovedGtm.assignedLab);
        await require('../helpers/reportedSelectionFixture').selectReviewedFixtureItem(prisma,sampleApprovedGtm.id+'-PH_H2O',reviewer);

        // 2. Pending / Unapproved GTM Sample
        samplePendingGtm = await createSampleFixture(prisma, {
            data: {
                id: `test-s-pend-gtm-${timestamp}`,
                originalId: `GTM-PENDING-${timestamp}`,
                labId: `LAB-GTM-PEND-${timestamp}`,
                assignedLab: 'GTM-LAB1',
                country: 'GTM',
                projectCode: 'SOILFER-GTM',
                status: 'PROCESSING',
                depthTopCm: 0,
                depthBottomCm: 20
            }
        });

        // 3. Approved HND Sample (different lab)
        sampleApprovedHnd = await createSampleFixture(prisma, {
            data: {
                id: `test-s-app-hnd-${timestamp}`,
                originalId: `HND-APPROVED-${timestamp}`,
                labId: `LAB-HND-APP-${timestamp}`,
                assignedLab: 'HND-LAB1',
                country: 'HND',
                projectCode: 'SOILFER-HND',
                status: 'APPROVED',
                depthTopCm: 0,
                depthBottomCm: 20
            }
        });

        // 4. Sample on Provenance Hold
        sampleHoldGtm = await createSampleFixture(prisma, {
            data: {
                id: `test-s-hold-gtm-${timestamp}`,
                originalId: `GTM-HOLD-${timestamp}`,
                labId: `LAB-GTM-HOLD-${timestamp}`,
                assignedLab: 'GTM-LAB1',
                country: 'GTM',
                projectCode: 'SOILFER-GTM',
                status: 'ON_HOLD',
                rejectionReason: 'PROVENANCE_HOLD: Conflicting field submissions'
            }
        });

        // API Key strictly scoped to GTM-LAB1
        const rawScoped = `slims_live_scoped_${timestamp}`;
        const hashScoped = crypto.createHash('sha256').update(rawScoped).digest('hex');
        testKeyScoped = await prisma.apiKey.create({
            data: {
                id: `key-scoped-${timestamp}`,
                name: 'GTM National Pipeline',
                keyHash: hashScoped,
                keyPrefix: rawScoped.slice(0, 12),
                role: 'NSIS_CONSUMER',
                labs: JSON.stringify(['GTM-LAB1']),
                countries: JSON.stringify(['GTM']),
                projects: JSON.stringify(['SOILFER-GTM']),
                isActive: true
            }
        });
        testKeyScoped.rawKey = rawScoped;

        // API Key with empty labs (unauthorized / unscoped)
        const rawUnscoped = `slims_live_unscoped_${timestamp}`;
        const hashUnscoped = crypto.createHash('sha256').update(rawUnscoped).digest('hex');
        testKeyUnscoped = await prisma.apiKey.create({
            data: {
                id: `key-unscoped-${timestamp}`,
                name: 'Unscoped Key',
                keyHash: hashUnscoped,
                keyPrefix: rawUnscoped.slice(0, 12),
                role: 'NSIS_CONSUMER',
                labs: JSON.stringify([]),
                isActive: true
            }
        });
        testKeyUnscoped.rawKey = rawUnscoped;
    });

    // Pin6060286651: retain analytical and scope parents until whole-owned-DB teardown.

    test('1. External consumer strictly receives APPROVED samples; excludes PROCESSING and HOLD', async () => {
        const res = await request(app)
            .get('/api/v1/data-exchange/samples')
            .set('X-API-Key', testKeyScoped.rawKey);

        expect(res.status).toBe(200);
        const ids = res.body.data.map(s => s.id);

        expect(ids).toContain(sampleApprovedGtm.originalId);
        expect(ids).not.toContain(samplePendingGtm.originalId);
        expect(ids).not.toContain(sampleHoldGtm.originalId);
    });

    test('2. Requesting status=all or unapproved status does not leak unreleased samples', async () => {
        // Requesting status=all
        const resAll = await request(app)
            .get('/api/v1/data-exchange/samples?status=all')
            .set('X-API-Key', testKeyScoped.rawKey);

        expect(resAll.status).toBe(200);
        const allIds = resAll.body.data.map(s => s.id);
        expect(allIds).not.toContain(samplePendingGtm.originalId);
        expect(allIds).not.toContain(sampleHoldGtm.originalId);

        // Explicitly requesting PROCESSING
        const resProc = await request(app)
            .get('/api/v1/data-exchange/samples?status=PROCESSING')
            .set('X-API-Key', testKeyScoped.rawKey);

        expect(resProc.status).toBe(200);
        expect(resProc.body.data).toHaveLength(0); // Denied
    });

    test('3. Key scoped to GTM-LAB1 cannot view HND-LAB1 approved sample (Lab Isolation)', async () => {
        const res = await request(app)
            .get('/api/v1/data-exchange/samples')
            .set('X-API-Key', testKeyScoped.rawKey);

        expect(res.status).toBe(200);
        const ids = res.body.data.map(s => s.id);
        expect(ids).not.toContain(sampleApprovedHnd.originalId);

        // Direct lookup by ID is rejected with 404 (not disclosing presence in another lab)
        const detailRes = await request(app)
            .get(`/api/v1/data-exchange/samples/${sampleApprovedHnd.originalId}`)
            .set('X-API-Key', testKeyScoped.rawKey);

        expect(detailRes.status).toBe(404);
    });

    test('4. API Key with empty lab scope fails closed (denies all samples)', async () => {
        const res = await request(app)
            .get('/api/v1/data-exchange/samples')
            .set('X-API-Key', testKeyUnscoped.rawKey);

        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(0);
    });

    test('5. /stats metrics are strictly scoped to authorized lab and released status', async () => {
        const res = await request(app)
            .get('/api/v1/data-exchange/stats')
            .set('X-API-Key', testKeyScoped.rawKey);

        expect(res.status).toBe(200);
        const { metrics } = res.body;

        // Registered labs should be exactly 1 (GTM-LAB1), not total labs in DB
        expect(metrics.registeredLabs).toBe(1);
        expect(metrics.completedSamples).toBe(metrics.approvedSamples);
    });
});
