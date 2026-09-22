const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const prisma = require('../../prisma');

describe('Issue #123: Workbench Search & Multi-Field Query Contract', () => {
    let techAToken, techBToken;
    const labAId = 'LAB-SEARCH-A';
    const labBId = 'LAB-SEARCH-B';

    let sampleA1, sampleA2, sampleB;
    let workItemA1, workItemA2, workItemB;

    beforeAll(async () => {
        techAToken = await getAuthToken('LAB_TECHNICIAN', labAId, ['GTM'], ['ENTER_RESULTS']);
        techBToken = await getAuthToken('LAB_TECHNICIAN', labBId, ['GTM'], ['ENTER_RESULTS']);

        const techAUsername = 'test_lab_technician_labsearcha';
        const techBUsername = 'test_lab_technician_labsearchb';

        // Ensure analyses exist
        await prisma.analysis.upsert({
            where: { code: 'SOC' },
            update: { name: 'Soil Organic Carbon', units: 'g/kg', status: 'active' },
            create: { code: 'SOC', name: 'Soil Organic Carbon', units: 'g/kg', status: 'active' }
        });
        await prisma.analysis.upsert({
            where: { code: 'PH' },
            update: { name: 'Soil pH in Water', units: 'pH units', status: 'active' },
            create: { code: 'PH', name: 'Soil pH in Water', units: 'pH units', status: 'active' }
        });

        const ts = Date.now();

        // Sample A1 (SOC analysis)
        sampleA1 = await prisma.sample.create({
            data: {
                id: `SMP-SRCH-A1-${ts}`,
                labId: `LAB-SRCH-001-${ts}`,
                originalId: `FIELD-SRCH-001-${ts}`,
                assignedLab: labAId,
                status: 'ACCEPTED',
                projectCode: 'GTM-PRJ-01'
            }
        });

        // Sample A2 (PH analysis)
        sampleA2 = await prisma.sample.create({
            data: {
                id: `SMP-SRCH-A2-${ts}`,
                labId: `LAB-SRCH-002-${ts}`,
                originalId: `FIELD-SRCH-002-${ts}`,
                assignedLab: labAId,
                status: 'ACCEPTED',
                projectCode: 'GTM-PRJ-02'
            }
        });

        // Sample B (in Lab B, also SOC analysis)
        sampleB = await prisma.sample.create({
            data: {
                id: `SMP-SRCH-B-${ts}`,
                labId: `LAB-SRCH-B-${ts}`,
                originalId: `FIELD-SRCH-B-${ts}`,
                assignedLab: labBId,
                status: 'ACCEPTED',
                projectCode: 'GTM-PRJ-01'
            }
        });

        // Work items
        workItemA1 = await prisma.workItem.create({
            data: {
                id: `WI-SRCH-A1-${ts}`,
                sampleId: sampleA1.id,
                analysis: 'SOC',
                status: 'ASSIGNED',
                assignedTo: techAUsername,
                labId: labAId,
                version: 1
            }
        });

        workItemA2 = await prisma.workItem.create({
            data: {
                id: `WI-SRCH-A2-${ts}`,
                sampleId: sampleA2.id,
                analysis: 'PH',
                status: 'ASSIGNED',
                assignedTo: techAUsername,
                labId: labAId,
                version: 1
            }
        });

        workItemB = await prisma.workItem.create({
            data: {
                id: `WI-SRCH-B-${ts}`,
                sampleId: sampleB.id,
                analysis: 'SOC',
                status: 'ASSIGNED',
                assignedTo: techBUsername,
                labId: labBId,
                version: 1
            }
        });
    });

    test('1. Search by canonical sample UUID returns matching item in Lab A queue', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({ search: sampleA1.id });

        expect(res.status).toBe(200);
        const allItems = res.body.groups.flatMap(g => g.items);
        expect(allItems.length).toBe(1);
        expect(allItems[0].id).toBe(workItemA1.id);
        expect(allItems[0].sampleId).toBe(sampleA1.id);
    });

    test('2. Search by labId returns matching work item', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({ search: sampleA2.labId });

        expect(res.status).toBe(200);
        const allItems = res.body.groups.flatMap(g => g.items);
        expect(allItems.length).toBe(1);
        expect(allItems[0].id).toBe(workItemA2.id);
        expect(allItems[0].sampleDisplayId).toBe(sampleA2.labId);
    });

    test('3. Search by original field ID returns matching work item', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({ search: sampleA1.originalId });

        expect(res.status).toBe(200);
        const allItems = res.body.groups.flatMap(g => g.items);
        expect(allItems.length).toBe(1);
        expect(allItems[0].id).toBe(workItemA1.id);
        expect(allItems[0].originalId).toBe(sampleA1.originalId);
    });

    test('4. Search by analysis code (e.g. PH) filters work items to that method', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({ search: 'PH' });

        expect(res.status).toBe(200);
        const allItems = res.body.groups.flatMap(g => g.items);
        expect(allItems.length).toBe(1);
        expect(allItems[0].analysis).toBe('PH');
    });

    test('5. Search by analysis display name (e.g. "Soil Organic Carbon") resolves to SOC work items', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({ search: 'Soil Organic Carbon' });

        expect(res.status).toBe(200);
        const allItems = res.body.groups.flatMap(g => g.items);
        expect(allItems.length).toBe(1);
        expect(allItems[0].analysis).toBe('SOC');
        expect(allItems[0].id).toBe(workItemA1.id);
    });

    test('6. Non-matching search returns empty array with honest state', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({ search: 'NON_EXISTENT_QUERY_XYZ' });

        expect(res.status).toBe(200);
        expect(res.body.groups).toEqual([]);
        expect(res.body.stats.totalItems).toBe(0);
    });

    test('7. Clearing search (empty search param) restores full authorized queue', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({ search: '' });

        expect(res.status).toBe(200);
        const allItems = res.body.groups.flatMap(g => g.items);
        expect(allItems.length).toBe(2);
        const ids = allItems.map(i => i.id);
        expect(ids).toContain(workItemA1.id);
        expect(ids).toContain(workItemA2.id);
    });

    test('8. Cross-lab search isolation: searching for a shared term excludes items from other laboratories', async () => {
        // Both lab A and lab B have SOC analysis and project GTM-PRJ-01
        const resA = await request(app)
            .get('/api/workbench/queue')
            .set('Authorization', `Bearer ${techAToken}`)
            .query({ search: 'GTM-PRJ-01' });

        expect(resA.status).toBe(200);
        const allItemsA = resA.body.groups.flatMap(g => g.items);
        expect(allItemsA.length).toBe(1);
        expect(allItemsA[0].id).toBe(workItemA1.id);
        // Lab B's work item must NOT be present
        expect(allItemsA.some(i => i.id === workItemB.id)).toBe(false);
    });
});
