const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const controller = require('../../controllers/workItemController');
const { getAuthToken } = require('../setup');

describe('Audit 1.1: duplicate references and atomic analysis reconciliation', () => {
    let token;
    const samples = [];
    beforeAll(async () => { token = await getAuthToken('LAB_MANAGER', 'LAB-GTM', ['GTM'], ['SOILFER-US']); });
    afterEach(() => jest.restoreAllMocks());
    afterAll(async () => {
        const where = { sampleId: { in: samples } };
        await prisma.workItem.deleteMany({ where: { ...where, duplicateOf: { not: null } } });
        await prisma.workItem.deleteMany({ where });
        await prisma.orderLine.deleteMany({ where: { revision: { sampleId: { in: samples } } } });
        await prisma.sampleOrderRevision.deleteMany({ where });
        await prisma.auditLog.deleteMany({ where });
        await prisma.sample.deleteMany({ where: { id: { in: samples } } });
    });

    async function fixture(duplicateStatus) {
        const id = `audit11-reconcile-${crypto.randomUUID()}`; samples.push(id);
        const sample = await createSampleFixture(prisma, { data: { id, originalId: id, labId: 'LAB-GTM', assignedLab: 'LAB-GTM',
            status: 'PROCESSING', matrix: 'SOIL', country: 'GTM', projectCode: 'SOILFER-US',
            requiredAnalyses: JSON.stringify(['PH_H2O', 'SOC', 'CEC']) } });
        for (const analysis of ['CEC', 'SOC', 'PH_H2O']) {
            await createWorkItemFixture(prisma, { data: { id: `${id}-${analysis}`, sampleId: id, labId: 'LAB-GTM', assignedLab: 'LAB-GTM', analysis, status: 'NOT_ASSIGNED' } });
        }
        if (duplicateStatus) {
            await createWorkItemFixture(prisma, { data: { id: `${id}-duplicate`, sampleId: id, labId: 'LAB-GTM', assignedLab: 'LAB-GTM',
                analysis: 'SOC', status: duplicateStatus, duplicateOf: `${id}-SOC`, history: '[{"note":"Original duplicate retained"}]' } });
        }
        return sample;
    }
    async function snapshot(id) {
        return {
            sample: await prisma.sample.findUnique({ where: { id } }),
            work: await prisma.workItem.findMany({ where: { sampleId: id }, orderBy: { id: 'asc' } }),
            audits: await prisma.auditLog.findMany({ where: { OR: [{ sampleId: id }, { entityId: id }] }, orderBy: { id: 'asc' } }),
            orders: await prisma.sampleOrderRevision.findMany({ where: { sampleId: id }, include: { lines: true }, orderBy: { id: 'asc' } })
        };
    }
    test.each([
        ['analyses', 'put', 'NOT_ASSIGNED'],
        ['orders', 'post', 'NOT_ASSIGNED'],
        ['analyses', 'put', 'WAIVED'],
        ['orders', 'post', 'WAIVED']
    ])('%s refuses removal with a %s duplicate before any writes (%s)', async (route, method, duplicateStatus) => {
        const sample = await fixture(duplicateStatus), before = await snapshot(sample.id);
        const response = await request(app)[method](`/api/samples/${sample.id}/${route}`)
            .set('Authorization', `Bearer ${token}`).send({ analyses: ['PH_H2O'], reason: 'Manager requested fewer analyses' });
        expect(response.status).toBe(409);
        expect(response.body.code).toBe('WORKITEM_DUPLICATES_PRESENT');
        expect(await snapshot(sample.id)).toEqual(before);
    });
    test('an unrelated unstarted analysis can still be removed while the duplicate group is retained', async () => {
        const sample = await fixture('NOT_ASSIGNED');
        const before = await prisma.workItem.findMany({ where: { sampleId: sample.id, analysis: 'SOC' }, orderBy: { id: 'asc' } });
        const response = await request(app).put(`/api/samples/${sample.id}/analyses`)
            .set('Authorization', `Bearer ${token}`).send({ analyses: ['PH_H2O', 'SOC'] });
        expect(response.status).toBe(200); expect(response.body.removed).toEqual(['CEC']);
        expect(await prisma.workItem.findMany({ where: { sampleId: sample.id, analysis: 'SOC' }, orderBy: { id: 'asc' } })).toEqual(before);
    });
    test('a remaining FK failure after an earlier deletion returns 409 and rolls back rows and audits', async () => {
        const sample = await fixture(), before = await snapshot(sample.id);
        const transact = prisma.$transaction.bind(prisma);
        jest.spyOn(prisma, '$transaction').mockImplementationOnce(callback => transact(async tx => {
            let deletes = 0;
            return callback({ ...tx, workItem: { ...tx.workItem, delete: async args => {
                if (++deletes === 2) throw Object.assign(new Error('Referenced row'), { code: 'P2003' });
                return tx.workItem.delete(args);
            } } });
        }));
        expect(await controller.reconcileWorkItemsForSample(sample, ['PH_H2O'], { username: 'manager', role: 'LAB_MANAGER', labId: 'LAB-GTM' }, 'Reviewed removal'))
            .toMatchObject({ conflict: true, status: 409, code: 'WORKITEM_REFERENCE_CONFLICT' });
        expect(await snapshot(sample.id)).toEqual(before);
    });
    test('an audit failure rolls back the preceding deletion instead of partially reconciling', async () => {
        const sample = await fixture(), before = await snapshot(sample.id);
        const transact = prisma.$transaction.bind(prisma);
        jest.spyOn(prisma, '$transaction').mockImplementationOnce(callback => transact(tx => callback({ ...tx,
            auditLog: { ...tx.auditLog, create: async () => { throw new Error('Injected reconciliation audit failure'); } } })));
        await expect(controller.reconcileWorkItemsForSample(sample, ['PH_H2O'], { username: 'manager', role: 'LAB_MANAGER', labId: 'LAB-GTM' }, 'Reviewed removal'))
            .rejects.toThrow('Injected reconciliation audit failure');
        expect(await snapshot(sample.id)).toEqual(before);
    });
    test('cold catalogue lookups during additions stay inside the reconciliation transaction', async () => {
        const sample = await fixture();
        await prisma.workItem.delete({ where: { id: `${sample.id}-CEC` } });
        require('../../services/analysisService').invalidateCache();
        jest.spyOn(prisma.analysis, 'findMany').mockImplementation(() => { throw new Error('Catalogue read escaped the transaction'); });
        const outcome = await controller.reconcileWorkItemsForSample(sample, ['PH_H2O', 'SOC', 'CEC'], { username: 'manager', role: 'LAB_MANAGER', labId: 'LAB-GTM' }, 'Add requested analysis');
        expect(outcome).toMatchObject({ conflict: false, added: ['CEC'] });
        expect(await prisma.workItem.findUnique({ where: { id: `${sample.id}-CEC` } })).toBeNull();
        expect(await prisma.workItem.count({ where: { sampleId: sample.id, analysis: 'CEC' } })).toBe(1);
    });
});
