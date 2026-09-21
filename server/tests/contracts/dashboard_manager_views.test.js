const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const prisma = require('../../prisma');

describe('Dashboard, Manager Task List & Field Registry Separation (#120)', () => {
    let tokenManagerA, tokenManagerB, labAId, labBId;
    let sampleActiveA, sampleExpectedA, sampleBatchQCA, sampleResolvedQCA;

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
        // Expected field registration must be excluded from daily lab queue
        expect(data.some(s => s.id === sampleExpectedA.id)).toBe(false);
    });

    test('2. GET /api/samples?view=expected returns field arrivals awaiting intake', async () => {
        const res = await request(app)
            .get('/api/samples?view=expected')
            .set('Authorization', `Bearer ${tokenManagerA}`);

        expect(res.status).toBe(200);
        const data = res.body.data;
        // Expected field registration must be present
        expect(data.some(s => s.id === sampleExpectedA.id)).toBe(true);
        // Active received sample must be excluded
        expect(data.some(s => s.id === sampleActiveA.id)).toBe(false);
        // All samples must have status EXPECTED
        for (const s of data) {
            expect(s.status).toBe('EXPECTED');
        }
    });

    test('3. GET /api/samples?view=registry returns the full field registry without omitting records', async () => {
        const res = await request(app)
            .get('/api/samples?view=registry')
            .set('Authorization', `Bearer ${tokenManagerA}`);

        expect(res.status).toBe(200);
        const data = res.body.data;
        // Both active and expected records are present in full field registry
        expect(data.some(s => s.id === sampleActiveA.id)).toBe(true);
        expect(data.some(s => s.id === sampleExpectedA.id)).toBe(true);
    });

    test('4. Response provides reconciled view counts in views and facets.views', async () => {
        const res = await request(app)
            .get('/api/samples?view=daily')
            .set('Authorization', `Bearer ${tokenManagerA}`);

        expect(res.status).toBe(200);
        expect(res.body.views).toBeDefined();
        expect(res.body.facets.views).toBeDefined();

        const { daily, expected, registry } = res.body.views;
        expect(daily).toBeGreaterThanOrEqual(1);
        expect(expected).toBeGreaterThanOrEqual(1);
        expect(registry).toBeGreaterThanOrEqual(daily + expected);
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
        const res = await request(app)
            .get('/api/samples?view=daily&status=EXPECTED')
            .set('Authorization', `Bearer ${tokenManagerA}`);

        expect(res.status).toBe(200);
        const data = res.body.data;
        expect(data.some(s => s.id === sampleExpectedA.id)).toBe(true);
        expect(data.some(s => s.id === sampleActiveA.id)).toBe(false);
    });
});
