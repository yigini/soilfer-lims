const crypto = require('crypto');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const policy = require('../../services/policyService');
const { getAuthToken, ensureTestLab } = require('../setup');
const { selectReportedValue } = require('../../services/reportedValueService');
// Keep random, unique identifiers while excluding the numeric sentinel values
// used below to detect leaked analytical data in the entire response payload.
const id = prefix => `${prefix}-${crypto.randomUUID().replace(/\d/g, digit => String.fromCharCode(103 + Number(digit)))}`;
const labId = 'LAB-AUDIT-010';
const scalar = cell => cell && typeof cell === 'object' ? cell.value : cell;

describe('Audit 0.10: current results in exports and working grid', () => {
    let token;
    beforeAll(async () => { await ensureTestLab(labId, 'GTM'); token = await getAuthToken('LAB_MANAGER', labId); });
    afterEach(() => jest.restoreAllMocks());
    test('fixture metadata cannot contain excluded analytical-value sentinels', () => {
        jest.spyOn(crypto, 'randomUUID').mockReturnValue('77778888-9999-4777-8888-999977778888');
        expect(id('SMP-010')).not.toMatch(/7777|8888|9999/);
    });
    async function fixture({ status = 'APPROVED', receptionDate, projectCode = id('PROJ-010').toUpperCase(), assignedLab = labId } = {}) {
        const sampleId = id('SMP-010');
        const sample = await prisma.sample.create({ data: { id: sampleId, originalId: sampleId, labId: sampleId,
            assignedLab, status, projectCode, receptionDate: receptionDate ? new Date(receptionDate) : new Date(), requiredAnalyses: '["SOC"]' } });
        const item = await prisma.workItem.create({ data: { id: id('WI-010'), sampleId, analysis: 'SOC', status: 'ACCEPTED', result: '9999' } });
        return { sample, item, projectCode };
    }
    async function result(f, value, data = {}) {
        return prisma.result.create({ data: { id: id('R-010'), sampleId: f.sample.id, param: 'SOC', value: String(value), unit: 'g/kg',
            isCurrent: true, isValid: true, ...data } });
    }
    const exportData = (project, auth = token) => request(app).post('/api/exports/data').set('Authorization', `Bearer ${auth}`).send({ type: 'WET_CHEM', project });
    const grid = (query, auth = token) => request(app).get('/api/data-results').set('Authorization', `Bearer ${auth}`).query(query);
    test('superseded, invalid and cached WorkItem values never appear; the grid shows each valid current replicate', async () => {
        const f = await fixture();
        await result(f, 7777, { isCurrent: false }); await result(f, 8888, { isValid: false });
        const first = await result(f, 10, { replicateNo: 1 }), second = await result(f, 20, { replicateNo: 2 });
        const exported = await exportData(f.projectCode);
        expect(exported.status).toBe(200);
        expect(exported.body.data[0]).toMatchObject({ SOC: 15, soc_as_measured: '', soc_unit: 'g/kg', soc_normalized: 15,
            soc_controlled_unit: 'g/kg', soc_n: 2, soc_flag: 'MEAN_UNCHECKED' });
        expect(exported.body.meta.headerNotes).toContain('Replicates: arithmetic mean of current valid replicates; repeatability (r) check not yet applied.');
        const view = await grid({ project: f.projectCode });
        expect(view.status).toBe(200); expect(view.body.data).toHaveLength(2);
        expect(view.body.data.map(row => scalar(row.SOC)).sort((a, b) => a - b)).toEqual([10, 20]);
        expect(view.body.data.map(row => row.resultId)).toEqual(expect.arrayContaining([first.id, second.id]));
        expect(view.body.data.map(row => row.sampleId)).toEqual([f.sample.id, f.sample.id]);
        expect(new Set(view.body.data.map(row => row.id)).size).toBe(2);
        expect(view.body.data.map(row => row.replicateNo).sort()).toEqual([1, 2]);
        expect(JSON.stringify([exported.body.data, view.body.data])).not.toMatch(/7777|8888|9999/);
        expect(await prisma.result.count({ where: { sampleId: f.sample.id } })).toBe(4);
    });
    test('numeric replicates normalize before averaging and no single as-measured value is invented', async () => {
        const f = await fixture(); await result(f, 1, { unit: '%' }); await result(f, 20);
        const response = await exportData(f.projectCode);
        expect(response.status).toBe(200); expect(response.body.data[0]).toMatchObject({ SOC: 15, soc_as_measured: '', soc_unit: 'g/kg', soc_n: 2, soc_flag: 'MEAN_UNCHECKED' });
    });
    test.each(['methodology', 'unit', 'qualified'])('ambiguous %s groups are blank and flagged; other samples still export and audit records the count', async kind => {
        const good = await fixture(), bad = await fixture({ projectCode: good.projectCode });
        await result(good, 42);
        await result(bad, 10, { methodologyId: kind === 'methodology' ? 'method-a' : null });
        await result(bad, kind === 'qualified' ? '<0.1' : 20, { methodologyId: kind === 'methodology' ? 'method-b' : null, unit: kind === 'unit' ? 'mg/L' : 'g/kg' });
        const response = await exportData(good.projectCode);
        expect(response.status).toBe(200);
        expect(response.body.data.find(row => row['Sample ID'] === bad.sample.id)).toMatchObject({ SOC: '', soc_as_measured: '', soc_normalized: '', soc_n: 0, soc_flag: 'REPLICATES_AMBIGUOUS' });
        expect(response.body.data.find(row => row['Sample ID'] === good.sample.id)).toMatchObject({ SOC: 42, soc_n: 1, soc_flag: '' });
        expect(response.body.meta.ambiguousCellCount).toBe(1);
        const audit = await prisma.auditLog.findFirst({ where: { entity: 'EXPORT', entityId: response.body.meta.exportId } });
        expect(audit.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        expect(audit.entityId).toBe(response.body.meta.exportId);
        expect(JSON.parse(audit.details).ambiguousCellCount).toBe(1);
    });
    test('single qualified and legacy null-validity results keep their exact value', async () => {
        const f = await fixture(); await result(f, '<0.1', { isValid: null });
        const response = await exportData(f.projectCode);
        expect(response.status).toBe(200); expect(response.body.data[0]).toMatchObject({ SOC: '<0.1', soc_as_measured: '<0.1', soc_normalized: '<0.1', soc_n: 1, soc_flag: '' });
        expect(scalar((await grid({ project: f.projectCode })).body.data[0].SOC)).toBe('<0.1');
    });
    test('archived approved samples remain exportable without enabling unapproved exports', async () => {
        const f = await fixture({ status: 'ARCHIVED' }); await result(f, 18);
        const response = await exportData(f.projectCode);
        expect(response.status).toBe(200); expect(response.body.data).toHaveLength(1); expect(response.body.data[0].SOC).toBe(18);
    });
    test('LATEST_VALID uses the policy-selected newest current row and reads lab/method context', async () => {
        const f = await fixture(); await result(f, 10, { createdAt: new Date('2020-01-01'), methodologyId: 'same-method' });
        await result(f, 20, { createdAt: new Date('2021-01-01'), methodologyId: 'same-method' });
        const original = policy.get;
        const lookup = jest.spyOn(policy, 'get').mockImplementation((lab, key, context) => key === 'results.reportedValueRule' ? 'LATEST_VALID' : original(lab, key, context));
        const response = await exportData(f.projectCode);
        expect(response.status).toBe(200); expect(response.body.data[0]).toMatchObject({ SOC: 20, soc_n: 1, soc_flag: '', soc_as_measured: 20 });
        expect(lookup).toHaveBeenCalledWith(labId, 'results.reportedValueRule', {
            analysisCode: 'SOC', methodologyId: 'same-method',
            snapshot: expect.objectContaining({ labId, version: 0, values: expect.objectContaining({ 'results.reportedValueRule': 'MEAN_IF_WITHIN_R' }) })
        });
    });
    test('an unknown reported-value policy fails closed without writing an export audit', async () => {
        const f = await fixture(); await result(f, 10);
        const before = await prisma.auditLog.count();
        const original = policy.get;
        jest.spyOn(policy, 'get').mockImplementation((lab, key, context) => key === 'results.reportedValueRule' ? 'UNKNOWN' : original(lab, key, context));
        const response = await exportData(f.projectCode);
        expect(response.status).toBe(409); expect(response.body.code).toBe('RESULT_POLICY_UNRESOLVED');
        expect(await prisma.auditLog.count()).toBe(before);
    });
    test.each([
        [{ startDate: '2026-01-02T00:00:00Z', endDate: '2026-01-02T23:59:59Z' }, [2]],
        [{ startDate: '2026-01-02T00:00:00Z' }, [2, 3]],
        [{ endDate: '2026-01-02T23:59:59Z' }, [1, 2]]
    ])('date bounds are merged and each bound works alone (%s)', async (bounds, expected) => {
        const projectCode = id('PROJ-010-DATES').toUpperCase();
        for (const day of [1, 2, 3]) { const f = await fixture({ projectCode, receptionDate: `2026-01-0${day}T12:00:00Z` }); await result(f, day); }
        const response = await grid({ project: projectCode, ...bounds });
        expect(response.status).toBe(200); expect(response.body.data.map(row => scalar(row.SOC)).sort()).toEqual(expected);
    });
    test('scope filters cannot expose another lab in either working view or WET_CHEM export', async () => {
        const f = await fixture({ assignedLab: 'OTHER-LAB-010' }); await result(f, 10);
        expect((await exportData(f.projectCode)).body.data).toEqual([]);
        expect((await grid({ project: f.projectCode })).body.data).toEqual([]);
        const external = await getAuthToken('EXTERNAL_VIEWER', labId, ['GTM'], [f.projectCode]);
        expect((await grid({ project: f.projectCode }, external)).status).toBe(403);
    });
    test('a supplied repeatability limit controls agreement; unavailable r is explicitly unchecked', () => {
        const rows = [10, 12].map((value, index) => ({ id: String(index), param: 'SOC', value: String(value), unit: 'g/kg', isCurrent: true, isValid: true }));
        expect(selectReportedValue(rows, 'MEAN_IF_WITHIN_R', { repeatabilityLimit: 2 })).toMatchObject({ value: 11, flag: '', replicateCount: 2 });
        expect(selectReportedValue(rows, 'MEAN_IF_WITHIN_R', { repeatabilityLimit: 1 })).toMatchObject({ value: '', flag: 'REPLICATES_AMBIGUOUS', replicateCount: 0 });
        expect(selectReportedValue(rows, 'MEAN_IF_WITHIN_R')).toMatchObject({ value: 11, flag: 'MEAN_UNCHECKED' });
    });
});
