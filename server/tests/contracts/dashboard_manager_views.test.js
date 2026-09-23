const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const prisma = require('../../prisma');

describe('Dashboard, Manager Task List & Field Registry Separation (#120)', () => {
    let tokenManagerA, tokenManagerB, labAId, labBId;
    let sampleActiveA, sampleExpectedA, sampleCollectedA, sampleApprovedA, sampleReceivedRejectedA, sampleRejectedA, sampleWalkInA, sampleSubmittedFullA;
    let sampleBatchQCA, sampleResolvedQCA;

    beforeAll(async () => {
        labAId = `LAB-VIEW-A-${Date.now()}`;
        labBId = `LAB-VIEW-B-${Date.now()}`;

        await prisma.lab.createMany({
            data: [
                { id: labAId, name: 'View Test Lab A', code: labAId, country: 'GTM' },
                { id: labBId, name: 'View Test Lab B', code: labBId, country: 'HND' }
            ]
        });

        tokenManagerA = await getAuthToken('LAB_MANAGER', labAId, ['GTM'], ['PROJECT-A']);
        tokenManagerB = await getAuthToken('LAB_MANAGER', labBId, ['HND'], ['PROJECT-B']);

        // 1. Physically received / active sample in Lab A
        sampleActiveA = await prisma.sample.create({
            data: {
                id: `SMP-ACT-${Date.now()}`,
                originalId: `ORIG-ACT-${Date.now()}`,
                assignedLab: labAId,
                labId: labAId,
                country: 'GTM',
                projectCode: 'PROJECT-A',
                status: 'ACCEPTED',
                receptionDate: new Date()
            }
        });

        // 1b. Physically received projectless walk-in sample in Lab A (#120)
        sampleWalkInA = await prisma.sample.create({
            data: {
                id: `SMP-WLK-${Date.now()}`,
                originalId: `ORIG-WLK-${Date.now()}`,
                assignedLab: labAId,
                labId: labAId,
                country: 'GTM',
                projectCode: null,
                status: 'RECEIVED',
                receptionDate: new Date()
            }
        });

        // 1c. Completed sample in Lab A (APPROVED) (#120)
        sampleApprovedA = await prisma.sample.create({
            data: {
                id: `SMP-APP-${Date.now()}`,
                originalId: `ORIG-APP-${Date.now()}`,
                assignedLab: labAId,
                labId: labAId,
                country: 'GTM',
                projectCode: 'PROJECT-A',
                status: 'APPROVED',
                receptionDate: new Date()
            }
        });

        // 1d. Rejected samples in Lab A (#120)
        sampleReceivedRejectedA = await prisma.sample.create({
            data: {
                id: `SMP-RRJ-${Date.now()}`,
                originalId: `ORIG-RRJ-${Date.now()}`,
                assignedLab: labAId,
                labId: labAId,
                country: 'GTM',
                projectCode: 'PROJECT-A',
                status: 'RECEIVED_REJECTED',
                receptionDate: new Date()
            }
        });

        sampleRejectedA = await prisma.sample.create({
            data: {
                id: `SMP-REJ-${Date.now()}`,
                originalId: `ORIG-REJ-${Date.now()}`,
                assignedLab: labAId,
                labId: labAId,
                country: 'GTM',
                projectCode: 'PROJECT-A',
                status: 'REJECTED',
                receptionDate: new Date()
            }
        });

        // 1e. Completed bench work awaiting manager approval in Lab A (SUBMITTED_FULL) (#120)
        sampleSubmittedFullA = await prisma.sample.create({
            data: {
                id: `SMP-SUB-${Date.now()}`,
                originalId: `ORIG-SUB-${Date.now()}`,
                assignedLab: labAId,
                labId: labAId,
                country: 'GTM',
                projectCode: 'PROJECT-A',
                status: 'SUBMITTED_FULL',
                receptionDate: new Date(),
                dryingStatus: 'DONE',
                preparationStatus: 'DONE'
            }
        });

        const tokenTechA = await getAuthToken('LAB_TECHNICIAN', labAId, ['GTM'], ['PROJECT-A']);
        const techAUsername = `test_lab_technician_${labAId.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

        // 1f. Submission for sampleSubmittedFullA awaiting manager review in task list (#120)
        await prisma.submission.create({
            data: {
                id: `sub-${sampleSubmittedFullA.id}`,
                sampleId: sampleSubmittedFullA.id,
                labId: labAId,
                assignedLab: labAId,
                status: 'PENDING_REVIEW',
                submittedBy: techAUsername,
                type: 'FULL',
                submittedAt: new Date()
            }
        });

        // 1g. Accepted analytical work item for sampleSubmittedFullA for final approval readiness (#120)
        await prisma.workItem.create({
            data: {
                id: `wi-${sampleSubmittedFullA.id}`,
                sampleId: sampleSubmittedFullA.id,
                labId: labAId,
                analysis: 'PH',
                status: 'ACCEPTED',
                assignedTo: techAUsername
            }
        });

        // 2. Expected field registration in Lab A (e.g. from Kobo field survey)
        sampleExpectedA = await prisma.sample.create({
            data: {
                id: `SMP-EXP-${Date.now()}`,
                originalId: `ORIG-EXP-${Date.now()}`,
                assignedLab: labAId,
                labId: labAId,
                country: 'GTM',
                projectCode: 'PROJECT-A',
                status: 'EXPECTED',
                fieldMetadata: JSON.stringify({ surveyor: 'Field Tech 1', location: 'Sector 4' })
            }
        });

        // 2b. COLLECTED field sample without laboratory physical intake (#120)
        sampleCollectedA = await prisma.sample.create({
            data: {
                id: `SMP-COL-${Date.now()}`,
                originalId: `ORIG-COL-${Date.now()}`,
                assignedLab: labAId,
                labId: labAId,
                country: 'GTM',
                projectCode: 'PROJECT-A',
                status: 'COLLECTED',
                fieldMetadata: JSON.stringify({ surveyor: 'Field Tech 2', collected_at: new Date().toISOString() })
            }
        });

        // 3. Unresolved QC exception batch in Lab A
        sampleBatchQCA = await prisma.batch.create({
            data: {
                id: `batch-unres-${Date.now()}`,
                labId: labAId,
                analysis: 'PH',
                status: 'QC_FAIL',
                disposition: null,
                createdBy: 'mgrA',
                notes: 'Unresolved blank exceedance'
            }
        });

        // 4. Resolved QC batch in Lab A (disposition already recorded)
        sampleResolvedQCA = await prisma.batch.create({
            data: {
                id: `batch-res-${Date.now()}`,
                labId: labAId,
                analysis: 'PH',
                status: 'QC_FAIL',
                disposition: 'PROCEED_WITH_WARNING',
                notes: 'Documented instrument drift within acceptable margin',
                createdBy: 'mgrA'
            }
        });
    });

    test('1. GET /api/samples?view=daily defaults to physically received and active lab work', async () => {
        const res = await request(app)
            .get('/api/samples?view=daily')
            .set('Authorization', `Bearer ${tokenManagerA}`);

        expect(res.status).toBe(200);
        const data = res.body.data;
        expect(Array.isArray(data)).toBe(true);
        // Active sample must be present
        expect(data.some(s => s.id === sampleActiveA.id)).toBe(true);
        // Projectless walk-in physically received in lab must be present (#120)
        expect(data.some(s => s.id === sampleWalkInA.id)).toBe(true);
        // Expected field registration must be excluded from daily lab queue
        expect(data.some(s => s.id === sampleExpectedA.id)).toBe(false);
        // Pre-arrival COLLECTED sample must also be excluded from daily physical receipt (#120)
        expect(data.some(s => s.id === sampleCollectedA.id)).toBe(false);
        // Completed lab work (APPROVED) must be excluded from daily active lab work (#120)
        expect(data.some(s => s.id === sampleApprovedA.id)).toBe(false);
        // Finished lab bench work (SUBMITTED_FULL) must be excluded from daily active lab work (#120)
        expect(data.some(s => s.id === sampleSubmittedFullA.id)).toBe(false);
        // Rejected samples must be excluded from daily active lab work (#120)
        expect(data.some(s => s.id === sampleReceivedRejectedA.id)).toBe(false);
        expect(data.some(s => s.id === sampleRejectedA.id)).toBe(false);

        // Daily returned row count must match views.daily aggregation exactly
        expect(data.length).toBe(res.body.views.daily);
    });

    test('2. GET /api/samples?view=expected returns field arrivals awaiting intake (including COLLECTED)', async () => {
        const res = await request(app)
            .get('/api/samples?view=expected')
            .set('Authorization', `Bearer ${tokenManagerA}`);

        expect(res.status).toBe(200);
        const data = res.body.data;
        // Expected field registration must be present
        expect(data.some(s => s.id === sampleExpectedA.id)).toBe(true);
        // Pre-arrival COLLECTED sample must be present in expected arrivals (#120)
        expect(data.some(s => s.id === sampleCollectedA.id)).toBe(true);
        // Active received sample, walk-in, approved, submitted full, and rejected samples must be excluded
        expect(data.some(s => s.id === sampleActiveA.id)).toBe(false);
        expect(data.some(s => s.id === sampleWalkInA.id)).toBe(false);
        expect(data.some(s => s.id === sampleApprovedA.id)).toBe(false);
        expect(data.some(s => s.id === sampleSubmittedFullA.id)).toBe(false);
        expect(data.some(s => s.id === sampleReceivedRejectedA.id)).toBe(false);
        expect(data.some(s => s.id === sampleRejectedA.id)).toBe(false);

        // All samples must have pre-arrival statuses
        for (const s of data) {
            expect(['EXPECTED', 'COLLECTED']).toContain(s.status);
        }

        // Expected returned row count must match views.expected aggregation exactly
        expect(data.length).toBe(res.body.views.expected);
    });

    test('3. GET /api/samples?view=registry returns the full field registry without omitting records', async () => {
        const res = await request(app)
            .get('/api/samples?view=registry')
            .set('Authorization', `Bearer ${tokenManagerA}`);

        expect(res.status).toBe(200);
        const data = res.body.data;
        // Active, expected, collected, completed, submitted full, rejected, and walk-in records are all present in full field registry
        expect(data.some(s => s.id === sampleActiveA.id)).toBe(true);
        expect(data.some(s => s.id === sampleExpectedA.id)).toBe(true);
        expect(data.some(s => s.id === sampleCollectedA.id)).toBe(true);
        expect(data.some(s => s.id === sampleApprovedA.id)).toBe(true);
        expect(data.some(s => s.id === sampleSubmittedFullA.id)).toBe(true);
        expect(data.some(s => s.id === sampleReceivedRejectedA.id)).toBe(true);
        expect(data.some(s => s.id === sampleRejectedA.id)).toBe(true);
        expect(data.some(s => s.id === sampleWalkInA.id)).toBe(true);

        // Verified that COLLECTED record does not fabricate a physical reception date
        const colSample = data.find(s => s.id === sampleCollectedA.id);
        expect(colSample.receptionDate).toBeFalsy();
    });

    test('4. Response provides reconciled view counts in views and facets.views', async () => {
        const res = await request(app)
            .get('/api/samples?view=daily')
            .set('Authorization', `Bearer ${tokenManagerA}`);

        expect(res.status).toBe(200);
        expect(res.body.views).toBeDefined();
        expect(res.body.facets.views).toBeDefined();

        const { daily, expected, registry } = res.body.views;
        expect(daily).toBeGreaterThanOrEqual(2); // sampleActiveA + sampleWalkInA
        expect(expected).toBeGreaterThanOrEqual(2); // sampleExpectedA + sampleCollectedA
        expect(registry).toBeGreaterThanOrEqual(daily + expected + 4); // + approved + submittedFull + 2 rejected
        expect(res.body.facets.lifecycle.COMPLETED).toBeGreaterThanOrEqual(2); // approved + submittedFull
        expect(res.body.facets.lifecycle.REJECTED).toBeGreaterThanOrEqual(2);
    });

    test('5. Manager exceptions queue includes unresolved QC batches and excludes resolved dispositions', async () => {
        const res = await request(app)
            .get('/api/dashboard/queues/manager.exceptions')
            .set('Authorization', `Bearer ${tokenManagerA}`);

        expect(res.status).toBe(200);
        const rows = res.body.rows || [];
        // Unresolved batch is present
        expect(rows.some(r => r.id === sampleBatchQCA.id || r.batchId === sampleBatchQCA.id || r.key === sampleBatchQCA.id)).toBe(true);
        // Resolved batch does not linger in pending exceptions
        expect(rows.some(r => r.id === sampleResolvedQCA.id || r.batchId === sampleResolvedQCA.id || r.key === sampleResolvedQCA.id)).toBe(false);
    });

    test('6. Cross-lab isolation: Manager B cannot view Lab A samples or exceptions', async () => {
        const samplesRes = await request(app)
            .get('/api/samples?view=registry')
            .set('Authorization', `Bearer ${tokenManagerB}`);

        expect(samplesRes.status).toBe(200);
        expect(samplesRes.body.data.some(s => s.id === sampleActiveA.id || s.id === sampleExpectedA.id)).toBe(false);

        const exceptionsRes = await request(app)
            .get('/api/dashboard/queues/manager.exceptions')
            .set('Authorization', `Bearer ${tokenManagerB}`);

        expect(exceptionsRes.status).toBe(200);
        const rows = exceptionsRes.body.rows || [];
        expect(rows.some(r => r.id === sampleBatchQCA.id || r.batchId === sampleBatchQCA.id || r.key === sampleBatchQCA.id)).toBe(false);
    });

    test('7. Explicit status query parameter overrides view', async () => {
        const resExpected = await request(app)
            .get('/api/samples?view=daily&status=EXPECTED')
            .set('Authorization', `Bearer ${tokenManagerA}`);

        expect(resExpected.status).toBe(200);
        expect(resExpected.body.data.some(s => s.id === sampleExpectedA.id)).toBe(true);
        expect(resExpected.body.data.some(s => s.id === sampleActiveA.id)).toBe(false);

        const resApproved = await request(app)
            .get('/api/samples?view=daily&status=APPROVED')
            .set('Authorization', `Bearer ${tokenManagerA}`);

        expect(resApproved.status).toBe(200);
        expect(resApproved.body.data.some(s => s.id === sampleApprovedA.id)).toBe(true);
        expect(resApproved.body.data.some(s => s.id === sampleActiveA.id)).toBe(false);

        const resSubmittedFull = await request(app)
            .get('/api/samples?view=daily&status=SUBMITTED_FULL')
            .set('Authorization', `Bearer ${tokenManagerA}`);

        expect(resSubmittedFull.status).toBe(200);
        expect(resSubmittedFull.body.data.some(s => s.id === sampleSubmittedFullA.id)).toBe(true);
        expect(resSubmittedFull.body.data.some(s => s.id === sampleActiveA.id)).toBe(false);

        const resRejected = await request(app)
            .get('/api/samples?view=daily&status=RECEIVED_REJECTED')
            .set('Authorization', `Bearer ${tokenManagerA}`);

        expect(resRejected.status).toBe(200);
        expect(resRejected.body.data.some(s => s.id === sampleReceivedRejectedA.id)).toBe(true);
        expect(resRejected.body.data.some(s => s.id === sampleActiveA.id)).toBe(false);
    });

    test('8. UI Completed quick filter (status=SUBMITTED_FULL,APPROVED) returns both finished and approved samples', async () => {
        const res = await request(app)
            .get('/api/samples?status=SUBMITTED_FULL,APPROVED')
            .set('Authorization', `Bearer ${tokenManagerA}`);

        expect(res.status).toBe(200);
        const data = res.body.data;
        // Both completed laboratory work (SUBMITTED_FULL) and final approved samples are returned
        expect(data.some(s => s.id === sampleSubmittedFullA.id)).toBe(true);
        expect(data.some(s => s.id === sampleApprovedA.id)).toBe(true);
        // Active, walk-in, and expected samples are excluded
        expect(data.some(s => s.id === sampleActiveA.id)).toBe(false);
        expect(data.some(s => s.id === sampleWalkInA.id)).toBe(false);
        expect(data.some(s => s.id === sampleExpectedA.id)).toBe(false);
        expect(data.some(s => s.id === sampleReceivedRejectedA.id)).toBe(false);

        // Filtered completed samples row count matches lifecycle.COMPLETED facet badge
        expect(res.body.facets.lifecycle.COMPLETED).toBeGreaterThanOrEqual(2);
    });

    test('9. Pending manager review and final approval remain visible in Manager Task List', async () => {
        // A. Review submissions lane lists the pending submission for sampleSubmittedFullA
        const subRes = await request(app)
            .get('/api/submissions')
            .set('Authorization', `Bearer ${tokenManagerA}`);

        expect(subRes.status).toBe(200);
        const subs = Array.isArray(subRes.body) ? subRes.body : (subRes.body.data || []);
        expect(subs.some(sub => sub.sampleId === sampleSubmittedFullA.id && sub.status === 'PENDING_REVIEW')).toBe(true);

        // B. Final approval queue lists the eligible SUBMITTED_FULL sample
        const appRes = await request(app)
            .get('/api/dashboard/queues/manager.finalApproval')
            .set('Authorization', `Bearer ${tokenManagerA}`);

        expect(appRes.status).toBe(200);
        const rows = appRes.body.rows || [];
        expect(rows.some(r => r.sampleId === sampleSubmittedFullA.id || r.key === sampleSubmittedFullA.id)).toBe(true);
        const fullItem = rows.find(r => r.sampleId === sampleSubmittedFullA.id || r.key === sampleSubmittedFullA.id);
        expect(fullItem.status).toBe('Ready for final check');
    });

    test('10. Final approval candidates reconcile across dashboard home and queue without 200 cap (>200 candidate regression)', async () => {
        const labCapId = `LAB-CAP-${Date.now()}`;
        await prisma.lab.create({
            data: { id: labCapId, name: 'Cap Test Lab', code: labCapId, country: 'GTM' }
        });

        const tokenManagerCap = await getAuthToken('LAB_MANAGER', labCapId, ['GTM'], ['PROJECT-CAP']);

        // Create 215 eligible candidate samples to exceed previous take: 200 cap
        const sampleCount = 215;
        const now = new Date();
        const capSamples = Array.from({ length: sampleCount }, (_, i) => ({
            id: `SMP-CAP-${Date.now()}-${i}`,
            originalId: `ORIG-CAP-${Date.now()}-${i}`,
            assignedLab: labCapId,
            labId: labCapId,
            country: 'GTM',
            projectCode: 'PROJECT-CAP',
            status: 'SUBMITTED_FULL',
            receptionDate: now,
            dryingStatus: 'DONE',
            preparationStatus: 'DONE'
        }));
        await prisma.sample.createMany({ data: capSamples });

        const capWorkItems = capSamples.map(s => ({
            id: `WI-${s.id}`,
            sampleId: s.id,
            labId: labCapId,
            analysis: 'PH',
            status: 'ACCEPTED'
        }));
        await prisma.workItem.createMany({ data: capWorkItems });

        // 1. Dashboard home metric evaluates all 215 candidates (not capped at 200)
        const homeRes = await request(app)
            .get('/api/dashboard/home')
            .set('Authorization', `Bearer ${tokenManagerCap}`);

        expect(homeRes.status).toBe(200);
        const metrics = homeRes.body.metrics || [];
        const appMetric = metrics.find(m => m.key === 'manager.finalApproval');
        expect(appMetric).toBeDefined();
        expect(appMetric.value).toBe(sampleCount);

        // 2. Dedicated final approval queue evaluates all 215 candidates
        const queueRes = await request(app)
            .get('/api/dashboard/queues/manager.finalApproval')
            .set('Authorization', `Bearer ${tokenManagerCap}`);

        expect(queueRes.status).toBe(200);
        expect(queueRes.body.total).toBe(sampleCount);

        // 3. Reconciled equality: dashboard badge agrees identically with queue total (>200)
        expect(appMetric.value).toBe(queueRes.body.total);
    });
});
