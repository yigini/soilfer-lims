const prisma = require('../../prisma');
const crypto = require('crypto');
const workbench = require('../../controllers/workbenchController');
const { validateNumericMethod, validateOperationalTask } = require('../../services/workbenchValidationService');
const { resolveDefaultMethod } = require('../../services/methodResolution');
const workflow = require('../../utils/workflowEngine');
const tag = crypto.randomUUID().slice(0, 8);
const user = { username: `catalogue_tech_${tag}`, role: 'LAB_TECHNICIAN', labId: `LAB_CAT_${tag}` };
const sampleId = `CAT_OP_${tag}`;
const analysis = `CAT_NUM_${tag}`;
const ids = { drying: `CAT_DRY_${tag}`, prep: `CAT_PREP_${tag}`, numeric: `CAT_VALUE_${tag}` };
async function call(handler, body) {
    const res = { code: 200, status(n) { this.code = n; return this; }, json(data) { this.body = data; return this; } };
    await handler({ user, body }, res);
    return res;
}
const entry = (kind, extra) => ({ workItemId: ids[kind], version: 1, ...extra });

describe('Catalogue to operational work and numeric validation', () => {
    beforeAll(async () => {
        await prisma.analysis.create({ data: { code: analysis, name: 'Configured test measurement', status: 'active', units: 'mg/kg', validation: JSON.stringify({ min: 0, max: 10 }) } });
        await prisma.user.create({ data: { id: `CAT_USER_${tag}`, username: user.username, email: `${user.username}@example.test`, password: 'test-only', role: user.role, labId: user.labId } });
        await prisma.sample.create({ data: { id: sampleId, originalId: `FIELD_${tag}`, labId: `S_${tag}`, assignedLab: user.labId, status: 'ACCEPTED', dryingStatus: 'PENDING', preparationStatus: 'PENDING' } });
        for (const [key, code] of [['drying', 'DRYING'], ['prep', 'PREPARATION'], ['numeric', analysis]]) {
            await prisma.workItem.create({ data: { id: ids[key], sampleId, labId: user.labId, assignedLab: user.labId, analysis: code, category: key === 'numeric' ? 'Chemical' : 'Operational Gates', assignedTo: user.username, status: 'ASSIGNED', version: 1 } });
        }
    });
    test('Numeric drafts are blocked before preparation; no Result or draft is written', async () => {
        const response = await call(workbench.batchSave, { draft: true, entries: [entry('numeric', { value: '5' })] });
        expect(response.body.errors[0].code).toBe('EXECUTION_BLOCKED');
        expect(await prisma.workItemDraft.count({ where: { sampleId } })).toBe(0);
        expect(await prisma.result.count({ where: { sampleId } })).toBe(0);
    });
    test('Operational queue resolves human names and checklist editors without catalogue numeric entries', async () => {
        const response = await call(workbench.getQueue, {});
        const group = response.body.groups.find(g => g.analysis === 'DRYING');
        expect(group.analysisName).toBe('Sample drying');
        expect(group.unit).toBeNull();
        expect(group.items[0].editorKind).toBe('OPERATIONAL');
    });
    test('Drying refuses numerical evidence', async () => {
        const response = await call(workbench.batchSave, { draft: false, entries: [entry('drying', { value: '40' })] });
        expect(response.body.errors[0].code).toBe('OPERATIONAL_SCALAR_FORBIDDEN');
    });
    test('Partial checklist saves as draft without opening the drying gate', async () => {
        const response = await call(workbench.batchSave, { draft: true, entries: [entry('drying', { checks: [true, false, false] })] });
        expect(response.body.errors).toBeUndefined();
        expect(JSON.parse((await prisma.workItemDraft.findFirst({ where: { workItemId: ids.drying } })).checks)).toEqual([true, false, false]);
        expect((await prisma.sample.findUnique({ where: { id: sampleId } })).dryingStatus).toBe('PENDING');
    });
    test('Missing confirmations cannot complete drying', async () => {
        const response = await call(workbench.batchSave, { draft: false, entries: [entry('drying', { checks: [true, false, true] })] });
        expect(response.body.saved).toBe(0);
        expect(response.body.errors).toHaveLength(1);
    });
    test('Completing drying saves evidence, clears its draft and opens only drying', async () => {
        const response = await call(workbench.batchSave, { draft: false, entries: [entry('drying', { checks: [true, true, true] })] });
        expect(response.body.errors).toBeUndefined();
        expect(response.body.saved).toBe(1);
        const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
        expect(sample).toMatchObject({ dryingStatus: 'DONE', preparationStatus: 'PENDING' });
        expect(await prisma.result.count({ where: { sampleId } })).toBe(0);
        expect(await prisma.workItemDraft.count({ where: { workItemId: ids.drying } })).toBe(0);
        expect(JSON.parse((await prisma.workItem.findUnique({ where: { id: ids.drying } })).result).checks).toEqual([true, true, true]);
    });
    test('Numeric entry remains blocked until preparation also completes', async () => {
        const blocked = await call(workbench.batchSave, { draft: true, entries: [entry('numeric', { value: '5' })] });
        expect(blocked.body.saved).toBe(0);
        const prepared = await call(workbench.batchSave, { draft: false, entries: [entry('prep', { checks: [true, true, true] })] });
        expect(prepared.body.saved).toBe(1);
        const saved = await call(workbench.batchSave, { draft: true, entries: [entry('numeric', { value: '5' })] });
        expect(saved.body.saved).toBe(1);
    });
    test('Catalogue min/max are enforced at record time without requiring a hidden type field', async () => {
        const response = await call(workbench.batchSave, { draft: false, entries: [entry('numeric', { value: '11' })] });
        expect(response.body.saved).toBe(0);
        expect(response.body.errors[0].code).toBe('OUT_OF_RANGE');
        expect(await prisma.result.count({ where: { sampleId } })).toBe(0);
    });
    test.each(['Infinity', '0x10', '< ', '>Infinity', 'NaN', '5abc'])('Invalid numeric input %s cannot become a result', value => {
        expect(validateNumericMethod(value).isValid).toBe(false);
    });
    test('Boolean-like strings and surplus confirmations are not valid evidence', () => {
        expect(validateOperationalTask(['true', 'true', 'true'], 3).isValid).toBe(false);
        expect(validateOperationalTask([true, true, true, true], 3).isValid).toBe(false);
    });
    test('Ambiguous defaults are reported instead of silently taking the first method', async () => {
        await prisma.methodology.create({ data: { analysisCode: analysis, name: 'Method one', isDefault: true } });
        await prisma.methodology.create({ data: { analysisCode: analysis, name: 'Method two', isDefault: true } });
        await expect(resolveDefaultMethod(analysis, user.labId)).rejects.toThrow('Multiple default');
    });
    test('A display-name-only catalogue update does not remove preparation prerequisites', () => {
        workflow.registerAnalysisConfig(analysis, { name: 'Renamed parameter', prerequisites: null });
        expect(workflow.getAnalysisConfig(analysis)).toMatchObject({ displayName: 'Renamed parameter', prerequisites: ['PREPARATION'] });
    });
});
