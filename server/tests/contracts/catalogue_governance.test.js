const crypto = require('crypto');
const prisma = require('../../prisma');
const controller = require('../../controllers/analysisController');
const policy = require('../../services/cataloguePolicy');
const methods = require('../../services/methodResolution');

const suffix = crypto.randomUUID().slice(0, 8);
const lab = `CAT_LAB_${suffix}`, otherLab = `CAT_OTHER_${suffix}`;
const admin = { role: 'SUPER_ADMIN', username: `catalogue_admin_${suffix}` };
const manager = { role: 'LAB_MANAGER', username: `catalogue_manager_${suffix}`, labId: lab };
const code = label => `CAT_${suffix}_${label}`;
const req = (body = {}, params = {}, user = admin, query = {}) => ({ body, params, user, query });
async function invoke(handler, request) {
    const response = { statusCode: 200, body: null, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
    await handler(request, response);
    return response;
}
async function parameter(label, data = {}) {
    return prisma.analysis.create({ data: { code: code(label), name: `Parameter ${label}`, status: 'active', matrix: 'SOIL', ...data } });
}

describe('Catalogue governance and connected selections', () => {
    test.each([
        [{ name: ' ', code: 'X' }, 'name'],
        [{ name: 'Valid name', code: 'INVALID CODE' }, 'code'],
        [{ name: 'Valid name', code: 'X', validation: { min: 20, max: 2 } }, 'Minimum'],
        [{ name: 'Valid name', code: 'X', validation: { min: '2' } }, 'finite'],
        [{ name: 'Valid name', code: 'X', validation: '{broken' }, 'JSON'],
        [{ name: 'Valid name', code: 'X', validation: { decimalPlaces: 1.5 } }, 'integer'],
        [{ name: 'Valid name', code: 'X', matrix: 'UNKNOWN' }, 'matrix'],
        [{ name: 'Valid name', code: 'X', executionOrder: '2x' }, 'integer'],
        [{ name: 'Valid name', code: 'X', prerequisites: '{}' }, 'list'],
        [{ name: 'Valid name', code: 'X', status: 'whatever' }, 'Status']
    ])('Rejects unsafe definition %j', (body, fragment) => expect(policy.validateAnalysisInput(body).error).toContain(fragment));

    test('New parameters start inactive, without fabricated numeric limits or units', async () => {
        const response = await invoke(controller.createAnalysis, req({ code: code('NEW'), name: 'Custom laboratory measurement' }));
        expect(response.statusCode).toBe(200);
        expect(response.body).toMatchObject({ status: 'inactive', units: null, validation: null, orderable: false });
    });
    test('Explicit inactive status and matrix survive create and update', async () => {
        const created = await invoke(controller.createAnalysis, req({ code: code('WATER'), name: 'Dissolved test element', matrix: 'WATER', status: 'inactive' }));
        expect(created.body.matrix).toBe('WATER');
        const updated = await invoke(controller.updateAnalysis, req({ status: 'active', name: 'Dissolved test element — method A' }, { code: code('WATER') }));
        expect(updated.body.orderable).toBe(true);
    });
    test('Shared definitions cannot be silently changed by a lab manager', async () => {
        const a = await parameter('SHARED');
        const res = await invoke(controller.updateAnalysis, req({ name: 'Replacement' }, { code: a.code }, manager));
        expect(res.statusCode).toBe(403);
        expect((await prisma.analysis.findUnique({ where: { code: a.code } })).name).toBe(a.name);
    });
    test('Manager can create and update their own scoped definition', async () => {
        const created = await invoke(controller.createAnalysis, req({ code: code('LOCAL'), name: 'Local measurement' }, {}, manager));
        expect(created.body.labId).toBe(lab);
        const updated = await invoke(controller.updateAnalysis, req({ name: 'Local measurement revised label', status: 'active' }, { code: code('LOCAL') }, manager));
        expect(updated.statusCode).toBe(200);
        expect(updated.body.orderable).toBe(true);
    });
    test('Inactive and unknown selections cannot create new orders; existing selections survive retirement', async () => {
        const a = await parameter('RETIRED', { status: 'inactive' });
        expect((await policy.validateSelection([a.code], { labId: lab })).valid).toBe(false);
        expect((await policy.validateSelection([code('MISSING')], { labId: lab })).valid).toBe(false);
        expect((await policy.validateSelection([a.code], { labId: lab, existing: [a.code] })).valid).toBe(true);
    });
    test('Placeholders and operational gates are not orderable analyses', () => {
        expect(policy.describeAnalysis({ code: 'SPEC_PARAM_38', name: 'Advanced spectral parameter', status: 'active' }).orderable).toBe(false);
        expect(policy.describeAnalysis({ code: 'DRYING', name: 'Sample drying', status: 'active' }).orderable).toBe(false);
    });
    test('Incorrect mass-concentration defaults and uncurated import labels are flagged for correction', () => {
        expect(policy.describeAnalysis({ code: 'pH', name: 'Soil pH', units: 'mg/kg', status: 'active' }).orderable).toBe(false);
        expect(policy.describeAnalysis({ code: 'hydraulicConductivity', name: 'Hydraulic conductivity', units: 'mg/kg', status: 'active' }).orderable).toBe(false);
        expect(policy.describeAnalysis({ code: 'ANY', name: 'ANY Determination', status: 'active' }).orderable).toBe(false);
    });
    test('Duplicate and cross-lab selections are rejected', async () => {
        const a = await parameter('OTHER', { labId: otherLab });
        expect((await policy.validateSelection([a.code], { labId: lab })).valid).toBe(false);
        expect((await policy.validateSelection([a.code, a.code], { labId: otherLab })).valid).toBe(false);
    });
    test('Malformed validation in one legacy record does not make the entire catalogue disappear', async () => {
        const a = await parameter('BROKEN', { validation: '{invalid' });
        const response = await invoke(controller.getAnalyses, req());
        expect(response.statusCode).toBe(200);
        expect(response.body.find(p => p.code === a.code)).toMatchObject({ orderable: false, validation: null });
    });
    test('A new package cannot contain inactive or unknown parameters', async () => {
        const a = await parameter('PACKAGE_INACTIVE', { status: 'inactive' });
        const res = await invoke(controller.createGroup, req({ id: code('PACKAGE'), name: 'Invalid package', analyses: [a.code] }));
        expect(res.statusCode).toBe(400);
        expect(await prisma.analysisGroup.findUnique({ where: { id: code('PACKAGE') } })).toBeNull();
    });
    test('Historical results prevent deletion and unit reinterpretation', async () => {
        const a = await parameter('HISTORY', { units: 'mg/kg' });
        const sample = await prisma.sample.create({ data: { id: code('SAMPLE'), originalId: code('FIELD'), assignedLab: lab, status: 'APPROVED' } });
        await prisma.result.create({ data: { id: code('RESULT'), sampleId: sample.id, param: a.code, value: '12', unit: 'mg/kg' } });
        const deletion = await invoke(controller.deleteAnalysis, req({}, { code: a.code }));
        expect(deletion.statusCode).toBe(409);
        expect(deletion.body.usage.results).toBe(1);
        expect((await invoke(controller.updateAnalysis, req({ units: '%' }, { code: a.code }))).statusCode).toBe(409);
        expect((await invoke(controller.updateAnalysis, req({ name: 'Clear human parameter name', status: 'inactive' }, { code: a.code }))).statusCode).toBe(200);
        expect((await prisma.result.findUnique({ where: { id: code('RESULT') } })).value).toBe('12');
    });
    test('JSON package references and prerequisites prevent deletion', async () => {
        const a = await parameter('JSON_REF');
        await prisma.analysisGroup.create({ data: { id: code('REF_GROUP'), name: 'Referenced package', analyses: JSON.stringify([a.code]) } });
        await parameter('DEP_REF', { prerequisites: JSON.stringify([a.code]) });
        const deletion = await invoke(controller.deleteAnalysis, req({}, { code: a.code }));
        expect(deletion.statusCode).toBe(409);
        expect(deletion.body.usage).toMatchObject({ packages: 1, dependencies: 1 });
    });
    test('Unused definitions can be removed with an audit record', async () => {
        const a = await parameter('UNUSED');
        expect((await invoke(controller.deleteAnalysis, req({}, { code: a.code }))).statusCode).toBe(200);
        expect(await prisma.analysis.findUnique({ where: { code: a.code } })).toBeNull();
        expect(await prisma.auditLog.count({ where: { entityId: a.code, action: 'DELETE' } })).toBe(1);
    });
    test('Method default resolves to this lab, never an unrelated lab', async () => {
        const a = await parameter('METHOD');
        const global = await prisma.methodology.create({ data: { analysisCode: a.code, name: 'Shared procedure', isDefault: true } });
        await prisma.methodology.create({ data: { analysisCode: a.code, name: 'Other laboratory procedure', labId: otherLab, isDefault: true } });
        expect((await methods.resolveDefaultMethod(a.code, lab)).id).toBe(global.id);
        const local = await prisma.methodology.create({ data: { analysisCode: a.code, name: 'Local procedure', labId: lab, isDefault: true } });
        expect((await methods.resolveDefaultMethod(a.code, lab)).id).toBe(local.id);
    });
    test('Mixed valid/invalid defaults request makes no partial changes', async () => {
        const a = await parameter('DEFAULT_A'), b = await parameter('DEFAULT_B');
        const method = await prisma.methodology.create({ data: { analysisCode: a.code, name: 'Procedure A' } });
        const res = await invoke(controller.updateLabMethodDefaults, req({ defaults: [{ analysisCode: a.code, methodologyId: method.id }, { analysisCode: b.code, methodologyId: method.id }] }, { labId: lab }, manager));
        expect(res.statusCode).toBe(400);
        expect(await prisma.labMethodDefault.count({ where: { labId: lab, analysisCode: { in: [a.code, b.code] } } })).toBe(0);
    });
    test('Referenced methods cannot be deleted, including non-FK default references', async () => {
        const a = await parameter('REFERENCED_METHOD');
        const m = await prisma.methodology.create({ data: { analysisCode: a.code, name: 'Preserved method' } });
        await prisma.labMethodDefault.create({ data: { labId: lab, analysisCode: a.code, methodologyId: m.id } });
        const res = await invoke(controller.deleteMethodology, req({}, { id: m.id }));
        expect(res.statusCode).toBe(409);
        expect(res.body.usage.labDefaults).toBe(1);
    });
    test('Cross-lab default configuration cannot be read by another manager', async () => {
        expect((await invoke(controller.getLabMethodDefaults, req({}, { labId: otherLab }, manager))).statusCode).toBe(403);
    });
});
