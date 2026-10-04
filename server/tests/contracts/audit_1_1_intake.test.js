const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const intake = require('../../services/intakeService');
const batches = require('../../services/consignmentIntakeService');
const work = require('../../services/intakeWorkItemService');
const { getAuthToken } = require('../setup');
const uid = () => crypto.randomUUID();
const checklist = { container: 'PASS', label: 'PASS', quantity: 'PASS', condition: 'PASS', coc: 'PASS' };

describe('Audit 1.1: one atomic intake service', () => {
    let lab, actor, token, analysis, method;
    beforeAll(async () => {
        lab = await prisma.lab.create({ data: { id: uid(), code: `A11${uid().slice(0, 8)}`, name: 'Shared intake contract lab', country: 'GTM', timezone: 'Europe/Rome' } });
        token = await getAuthToken('LAB_MANAGER', lab.id);
        actor = jwt.decode(token);
        await prisma.user.update({ where: { username: actor.username }, data: { mustChangePassword: false } });
        analysis = await prisma.analysis.create({ data: { code: `A11_${uid()}`, name: 'Intake contract analysis', status: 'active', sampleMassRequired: 25 } });
        method = await prisma.methodology.create({ data: { id: uid(), analysisCode: analysis.code, name: 'Intake contract default', labId: lab.id, isDefault: true } });
    });
    afterEach(() => jest.restoreAllMocks());
    const input = overrides => ({ originalId: `A11-${uid()}`, isWalkIn: true, decision: 'ACCEPTED', checklist, receivedMass: 250,
        requiredAnalyses: [analysis.code + ' ', analysis.code], ...overrides });
    const post = (url, body) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body);
    const single = body => post('/api/reception/intake', body);
    const batch = (samples, rest = {}) => post('/api/reception/consignments', { samples, ...rest });
    const counts = () => Promise.all([prisma.sample.count(), prisma.workItem.count(), prisma.sampleOrderRevision.count(), prisma.orderLine.count(), prisma.auditLog.count(), prisma.consignment.count(), prisma.labSequence.count()]);
    async function evidence(sampleId) {
        const items = await prisma.workItem.findMany({ where: { sampleId, duplicateOf: null }, orderBy: { analysis: 'asc' }, select: { analysis: true, category: true, status: true, methodologyId: true, labId: true, assignedLab: true } });
        const revisions = await prisma.sampleOrderRevision.findMany({ where: { sampleId }, include: { lines: { orderBy: { analysis: 'asc' } } } });
        const lines = revisions.flatMap(revision => revision.lines.map(line => ({ analysis: line.analysis, methodologyId: line.methodologyId, status: line.status })));
        const audit = await prisma.auditLog.findMany({ where: { sampleId }, orderBy: [{ action: 'asc' }, { analysisCode: 'asc' }], select: { action: true, analysisCode: true, performedBy: true } });
        return { items, revisions: revisions.map(row => ({ version: row.version, status: row.status })), lines, audit };
    }
    test('single and batch acceptance produce identical normalised work, methods, order lines and per-sample audits', async () => {
        const one = await single(input()), many = await batch([input()]);
        expect(one.status).toBe(200); expect(many.status).toBe(201);
        const left = await evidence(one.body.id), right = await evidence(many.body.samples[0].id);
        expect(right).toEqual(left);
        expect(left.items.map(item => item.analysis)).toEqual([analysis.code, 'DRYING', 'PREPARATION'].sort());
        expect(left.items.find(item => item.analysis === analysis.code).methodologyId).toBe(method.id);
        expect(left.revisions).toEqual([{ version: 1, status: 'ACTIVE' }]);
        expect(left.lines).toEqual([{ analysis: analysis.code, methodologyId: method.id, status: 'ACTIVE' }]);
        expect(many.body.consignment.expectedCount).toBeNull();
        expect(many.body.consignment.discrepancy).toEqual({ status: 'NOT_DECLARED', difference: null });
    });
    test.each(['work', 'order', 'audit'])('a downstream %s failure rolls back sample, code, work, orders and audits', async stage => {
        const before = await counts(), body = input();
        await expect(prisma.$transaction(tx => {
            const faulty = new Proxy(tx, { get(target, property) {
                const model = stage === 'work' ? 'workItem' : stage === 'order' ? 'sampleOrderRevision' : 'auditLog';
                if (property === model) return new Proxy(target[property], { get(delegate, operation) {
                    if (operation === 'create') return async () => { throw new Error(`synthetic ${stage} failure`); };
                    return delegate[operation];
                } });
                return target[property];
            } });
            return intake.acceptSample(faulty, { body, user: actor });
        })).rejects.toThrow(`synthetic ${stage} failure`);
        expect(await counts()).toEqual(before);
        expect(await prisma.sample.findFirst({ where: { originalId: body.originalId } })).toBeNull();
    });
    test.each([
        [{ checklist: { container: 'PASS' } }, 'INCOMPLETE_COMPLIANCE_CHECKLIST'],
        [{ requiredAnalyses: ['unknown-analysis'] }, null],
        [{ receivedMass: 1 }, 'MASS_DEFICIT'],
        [{ custodyHandoverAt: 'not-a-date' }, 'INTAKE_CUSTODY_INVALID'],
        [{ receivedMassUnit: 'kg' }, 'SAMPLE_MASS_UNIT_UNSUPPORTED']
    ])('failed validation never creates an orphan or consumes a sequence (%p)', async (overrides, code) => {
        const before = await counts(), body = input(overrides), response = await single(body);
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
        if (code) expect(response.body.code || response.body.error).toBe(code);
        expect(await counts()).toEqual(before);
        expect(await prisma.sample.findFirst({ where: { originalId: body.originalId } })).toBeNull();
    });
    test('a failure on an existing sample keeps its state and every old field intact', async () => {
        const sample = await prisma.sample.create({ data: { id: uid(), originalId: uid(), assignedLab: lab.id, status: 'RECEIVED', receivedMass: 250, history: '[]', metadata: '{"untouched":true}' } });
        const original = work.generate;
        jest.spyOn(work, 'generate').mockImplementation(async () => { throw new Error('synthetic gate failure'); });
        const before = await counts(), result = await single(input({ originalId: sample.originalId }));
        expect(result.status).toBe(500);
        expect(await prisma.sample.findUnique({ where: { id: sample.id } })).toEqual(sample);
        expect(await counts()).toEqual(before);
        expect(original).toBeInstanceOf(Function);
    });
    test('default batch mode returns all row errors and writes nothing, including counters', async () => {
        const before = await counts(), response = await batch([input(), input({ checklist: {} }), input({ requiredAnalyses: ['unknown'] })]);
        expect(response.status).toBe(422); expect(response.body.errors).toHaveLength(2);
        expect(response.body.errors.map(error => error.row)).toEqual([2, 3]);
        expect(await counts()).toEqual(before);
    });
    test('partial mode commits passing rows, returns failures, and records one failed-row-count audit', async () => {
        const response = await batch([input(), input({ checklist: {} })], { allowPartial: true });
        expect(response.status).toBe(201); expect(response.body.samples).toHaveLength(1); expect(response.body.errors).toHaveLength(1);
        const audits = await prisma.auditLog.findMany({ where: { entityId: response.body.consignment.id, action: 'CONSIGNMENT_BATCH_RECEIVED' } });
        expect(audits).toHaveLength(1); expect(JSON.parse(audits[0].details).failedRowCount).toBe(1);
    });
    test('all-failed partial mode has no empty consignment, audit or consumed number', async () => {
        const before = await counts(), response = await batch([input({ checklist: {} })], { allowPartial: true });
        expect(response.status).toBe(422); expect(response.body.code).toBe('CONSIGNMENT_ALL_ROWS_FAILED');
        expect(response.body.errors).toHaveLength(1); expect(await counts()).toEqual(before);
    });
    test('partial mode rolls back a runtime-failed row while committing another row', async () => {
        const bad = input(), good = input(), original = work.generate;
        jest.spyOn(work, 'generate').mockImplementation((tx, sample, plan) => sample.originalId === bad.originalId ? Promise.reject(new Error('synthetic row failure')) : original(tx, sample, plan));
        const response = await batch([bad, good], { allowPartial: true });
        expect(response.status).toBe(201); expect(response.body.samples).toHaveLength(1); expect(response.body.errors[0].row).toBe(1);
        expect(await prisma.sample.findFirst({ where: { originalId: bad.originalId } })).toBeNull();
        expect(response.body.samples[0].originalId).toBe(good.originalId);
    });
    test.each([0, -1, 1.5, '2', null])('invalid supplied expectedCount %p is refused before any writes', async value => {
        const before = await counts(), response = await batch([input()], { consignment: { expectedCount: value } });
        expect(response.status).toBe(422); expect(response.body.code).toBe('CONSIGNMENT_EXPECTED_COUNT_INVALID'); expect(await counts()).toEqual(before);
    });
    test('rejected receipt resubmission must be explicit and reuses the same acceptance service', async () => {
        const body = input({ decision: 'REJECTED', ncReason: 'Damaged package' }), rejected = await single(body);
        expect(rejected.status).toBe(200); expect(rejected.body.status).toBe('RECEIVED_REJECTED');
        const before = await counts();
        expect((await single({ ...body, decision: 'ACCEPTED' })).status).toBe(403); expect(await counts()).toEqual(before);
        const accepted = await single({ ...body, decision: 'ACCEPTED', isResubmission: true });
        expect(accepted.status).toBe(200); expect(accepted.body.status).toBe('ACCEPTED');
        expect(await prisma.sample.findUnique({ where: { id: accepted.body.id } })).toMatchObject({ isResubmission: true, rejectionReason: null });
        expect((await evidence(accepted.body.id)).revisions).toHaveLength(1);
    });
    test('walk-in arrival without checklist preserves RECEIVED and creates no code, work or order', async () => {
        const beforeSequence = await prisma.labSequence.count({ where: { labId: lab.id } });
        const response = await post('/api/samples/walkin', { submitter: 'Contract submitter', analyses: [analysis.code], receivedMass: 250 });
        expect(response.status).toBe(201); expect(response.body.sample).toMatchObject({ status: 'RECEIVED', labSampleCode: null, labId: null });
        const arrived = response.body.sample, details = await evidence(arrived.id);
        expect(details.items).toEqual([]); expect(details.revisions).toEqual([]); expect(details.lines).toEqual([]); expect(details.audit).toHaveLength(1);
        expect(await prisma.labSequence.count({ where: { labId: lab.id } })).toBe(beforeSequence);
        const before = await counts(), incomplete = await post(`/api/samples/${arrived.id}/accept`, { checklist: {} });
        expect(incomplete.status).toBe(400); expect(await counts()).toEqual(before);
        const accepted = await post(`/api/samples/${arrived.id}/accept`, { checklist });
        expect(accepted.status).toBe(200); expect(accepted.body.status).toBe('ACCEPTED'); expect(accepted.body.labSampleCode).toBeTruthy();
        expect((await evidence(arrived.id)).items).toHaveLength(3);
    });
    test('arrival records an open provenance hold and custody; the hold blocks acceptance without writes', async () => {
        const hold = { status: 'AMBIGUOUS_PROVENANCE_HOLD', reason: 'Identity review required' };
        const sample = await prisma.sample.create({ data: { id: uid(), originalId: uid(), assignedLab: lab.id, status: 'EXPECTED', metadata: JSON.stringify({ provenanceHold: hold }), history: '[]' } });
        const arrived = await post(`/api/samples/${sample.id}/receive`, {});
        expect(arrived.status).toBe(200); expect(arrived.body.status).toBe('RECEIVED');
        const audits = await prisma.auditLog.findMany({ where: { sampleId: sample.id } });
        expect(audits).toHaveLength(1); expect(JSON.parse(audits[0].details).provenanceHold).toEqual(hold);
        const before = await counts(), denied = await post(`/api/samples/${sample.id}/accept`, { checklist });
        expect(denied.status).toBe(409); expect(denied.body.code).toBe('AMBIGUOUS_PROVENANCE_HOLD'); expect(await counts()).toEqual(before);
    });
    test('generic status PUT cannot bypass acceptance validation or create work', async () => {
        const sample = await prisma.sample.create({ data: { id: uid(), originalId: uid(), assignedLab: lab.id, status: 'RECEIVED' } });
        const before = await counts(), response = await request(app).put(`/api/samples/${sample.id}/status`).set('Authorization', `Bearer ${token}`).send({ status: 'ACCEPTED' });
        expect(response.status).toBe(400); expect(response.body.code).toBe('DIRECT_TRANSITION_PROHIBITED'); expect(await counts()).toEqual(before);
    });
    test('unknown discrepancy never reports a match, even for zero received rows', () => {
        expect(batches.discrepancy(null, 0)).toEqual({ status: 'NOT_DECLARED', difference: null });
        expect(batches.discrepancy(2, 2)).toEqual({ status: 'MATCH', difference: 0 });
    });
    test('arrival stores an observed zero mass as zero without applying sufficiency or generating work', async () => {
        const response = await post('/api/samples/walkin', { submitter: 'Zero mass observation', receivedMass: 0, receivedMassUnit: 'g', analyses: [analysis.code] });
        expect(response.status).toBe(201); expect(response.body.sample).toMatchObject({ status: 'RECEIVED', receivedMass: 0, labSampleCode: null });
        const sample = await prisma.sample.findUnique({ where: { id: response.body.sample.id } });
        expect(sample.receivedMass).toBe(0);
        expect((await evidence(sample.id)).items).toEqual([]);
        const before = await counts(), denied = await post(`/api/samples/${sample.id}/accept`, { checklist });
        expect(denied.status).toBe(400); expect(denied.body.error).toBe('MASS_DEFICIT'); expect(await counts()).toEqual(before);
        const accepted = await post(`/api/samples/${sample.id}/accept`, { checklist, massWarningAcknowledged: true });
        expect(accepted.status).toBe(200); expect(accepted.body.receivedMass).toBe(0);
    });
});
