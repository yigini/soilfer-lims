jest.mock('../../prisma', () => ({
    workItem: { findMany: jest.fn(), update: jest.fn() },
    sample: { findFirst: jest.fn(), update: jest.fn() },
    lab: { findMany: jest.fn() },
    analysis: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    result: { create: jest.fn() }
}));
jest.mock('../../wsServer', () => ({ broadcastToLab: jest.fn() }));
jest.mock('../../services/analysisService', () => ({ loadAnalyses: jest.fn(async () => [{ code: 'EC', unit: 'STALE-CACHED-UNIT' }]) }));
jest.mock('../../services/workbenchReadinessService', () => ({ evaluateExecutionReadiness: jest.fn(async () => ({
    isReady: true, blockers: [], reasons: [], warnings: ['Inspect the extraction']
})) }));
jest.mock('../../services/workbenchValueValidationService', () => ({ validateNumericEntry: jest.fn(async () => ({
    isValid: true, flags: ['OUTSIDE_TYPICAL']
})) }));
jest.mock('../../services/policyService', () => ({ calcTemplate: jest.fn(async () => null) }));
jest.mock('../../services/resultWriteService', () => ({ resolveResultRunContext: jest.fn(async () => ({ equipmentId: null })) }));

const db = require('../../prisma');
const controller = require('../../controllers/workbenchController');
const actor = { username: 'synthetic-technician', role: 'LAB_TECHNICIAN', labId: 'LAB-A' };
const response = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const item = (id, patch = {}) => ({ id, sampleId: 'sample-' + id, analysis: 'EC', assignedLab: 'LAB-A', labId: 'LAB-A',
    assignedTo: actor.username, status: 'ASSIGNED', version: 1, rackPosition: 7, sample: { id: 'sample-' + id, labId: 'LAB-A', assignedLab: 'LAB-A',
        labSampleCode: 'LAB-26-001A', originalId: 'FIELD-A' }, ...patch });

beforeEach(() => {
    jest.clearAllMocks();
    db.lab.findMany.mockResolvedValue([{ id: 'LAB-A', code: 'LABA' }]);
    db.sample.findFirst.mockResolvedValue(null);
    db.analysis.findUnique.mockResolvedValue({ units: 'dS/m', unitCode: 'dS_m' });
});

test('completion display uses stored issued sample code, stored position and server unit; preview does not mutate data', async () => {
    const work = item('w1');
    const before = JSON.stringify(work);
    db.workItem.findMany.mockResolvedValue([work]);
    const res = response();
    await controller.previewCompletion({ user: actor, body: { entries: [{ workItemId: 'w1', value: '0', unit: 'FORGED', rackPosition: 999, labSampleCode: 'FORGED' }] } }, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].included[0]).toMatchObject({ labSampleCode: 'LAB-26-001A',
        sampleDisplayId: 'LAB-26-001A', rackPosition: 7, displayUnit: 'dS/m', value: '0',
        warnings: ['Inspect the extraction'], validation: { flags: ['OUTSIDE_TYPICAL'] } });
    expect(JSON.stringify(work)).toBe(before);
    expect(db.workItem.update).not.toHaveBeenCalled();
    expect(db.sample.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(db.result.create).not.toHaveBeenCalled();
});

test('a laboratory identifier without an issued code remains explicitly unissued', async () => {
    const work = item('unissued'); work.sample.labSampleCode = null;
    db.workItem.findMany.mockResolvedValue([work]);
    const res = response();
    await controller.previewCompletion({ user: actor, body: { entries: [{ workItemId: work.id, value: '1' }] } }, res);
    expect(res.json.mock.calls[0][0].included[0]).toMatchObject({ labSampleCode: null, sampleDisplayId: null });
});

test('foreign work is denied before returning issued-code or position display metadata', async () => {
    const foreign = item('foreign', { labId: 'LAB-B', assignedLab: 'LAB-B' });
    db.workItem.findMany.mockResolvedValue([foreign]);
    const res = response();
    await controller.previewCompletion({ user: actor, body: { entries: [{ workItemId: foreign.id, value: '1' }] } }, res);
    const data = res.json.mock.calls[0][0];
    expect(data.included).toEqual([]);
    expect(data.excluded[0].blockers).toContain('OUT_OF_SCOPE');
    expect(data.excluded[0]).not.toHaveProperty('labSampleCode');
    expect(data.excluded[0]).not.toHaveProperty('rackPosition');
});
