const { evaluateDuplicate, evaluateBatchQc } = require('../../services/qcService');
const { resolveDuplicatePolicy } = require('../../services/duplicateQcPolicyService');
const policyService = require('../../services/policyService');
const prisma = require('../../prisma');
const { randomUUID } = require('crypto');
const id = prefix => `${prefix}-${randomUUID()}`;

describe('Audit 0.15: independent duplicate numeric criteria', () => {
    test.each([[-1, 1], [0, 0], [-1, -1], [0, 1], [1, 0]])('%s / %s cannot pass', (value1, value2) => {
        expect(evaluateDuplicate({ value1, value2 })).toMatchObject({ status: 'INVALID', rpd: null, criterion: 'INVALID_NONPOSITIVE' });
    });
    test('positive near-LOQ pair passes on absolute difference, retaining its LOQ provenance', () => {
        const result = evaluateDuplicate({ value1: .02, value2: .05 }, { loq: .1, loqSource: 'METHODOLOGY', methodologyId: 'method' });
        expect(result).toMatchObject({ status: 'PASS', criterion: 'ABSOLUTE_DIFFERENCE', loq: .1, loqSource: 'METHODOLOGY', methodologyId: 'method', rpd: null });
        expect(result.absoluteDifference).toBeCloseTo(.03);
    });
    test('near-LOQ pair fails when its absolute difference exceeds LOQ', () => {
        expect(evaluateDuplicate({ value1: .02, value2: .15 }, { loq: .1 })).toMatchObject({ status: 'FAIL', criterion: 'ABSOLUTE_DIFFERENCE' });
    });
    test('both readings at 5 LOQ use RPD, including the exact boundary', () => {
        expect(evaluateDuplicate({ value1: .5, value2: .5 }, { loq: .1 })).toMatchObject({ status: 'PASS', criterion: 'RPD', rpd: 0 });
        expect(evaluateDuplicate({ value1: .5, value2: .6 }, { loq: .1 })).toMatchObject({ status: 'FAIL', criterion: 'RPD' });
    });
    test('no LOQ falls back to RPD with an auditable note', () => {
        expect(evaluateDuplicate({ value1: .02, value2: .05 })).toMatchObject({ status: 'FAIL', criterion: 'RPD', notes: ['NO_LOQ'] });
        expect(evaluateDuplicate({ value1: 7, value2: 7 }).details).toContain('NO_LOQ');
    });
    test('an invalid duplicate contributes a QC_FAIL verdict, never a batch pass', () => {
        expect(evaluateBatchQc({ duplicates: [{ value1: -1, value2: 1 }] })).toMatchObject({ overallStatus: 'QC_FAIL', summary: { failed: 1, passed: 0 } });
    });
});

describe('Audit 0.15: real batch method and analysis evidence', () => {
    async function fixture({ analysisLoq = .2, validation = '{"loq":0.3}', methods = [] } = {}) {
        const analysis = id('ANALYSIS015'), batchId = id('B015');
        await prisma.analysis.create({ data: { code: analysis, name: 'Duplicate LOQ fixture', loq: analysisLoq, validation } });
        const batch = await prisma.batch.create({ data: { id: batchId, analysis, labId: 'LAB-AUDIT-015', status: 'OPEN', createdBy: 'fixture' } });
        const recorded = [];
        for (const loq of methods) {
            const methodId = id('METHOD015'), sampleId = id('S015');
            await prisma.methodology.create({ data: { id: methodId, analysisCode: analysis, name: 'Recorded fixture method', loq } });
            await prisma.sample.create({ data: { id: sampleId, originalId: sampleId, assignedLab: batch.labId, status: 'PROCESSING' } });
            await prisma.workItem.create({ data: { id: id('WI015'), sampleId, analysis, assignedLab: batch.labId, batchId, methodologyId: methodId, status: 'COMPLETED' } });
            recorded.push({ methodId, sampleId });
        }
        return { batch, recorded };
    }
    test('current Result selects its recorded methodology rather than the cached work item', async () => {
        const { batch, recorded: [cached] } = await fixture({ methods: [.9] });
        const actualId = id('ACTUAL015');
        await prisma.methodology.create({ data: { id: actualId, analysisCode: batch.analysis, name: 'Actually recorded', loq: .1 } });
        await prisma.result.create({ data: { id: id('R015'), sampleId: cached.sampleId, batchId: batch.id, param: batch.analysis, methodologyId: actualId, value: '.02', numericValue: .02, isCurrent: true } });
        const policy = await resolveDuplicatePolicy(batch, prisma);
        expect(policy).toMatchObject({ loq: .1, loqSource: 'METHODOLOGY', methodologyId: actualId });
        expect(evaluateDuplicate({ value1: .02, value2: .05 }, policy).status).toBe('PASS');
    });
    test('analysis fallback is used with no method recorded even if an isDefault method exists', async () => {
        const { batch } = await fixture({ analysisLoq: .1 });
        await prisma.methodology.create({ data: { id: id('DEFAULT015'), analysisCode: batch.analysis, name: 'Unused catalogue default', isDefault: true, loq: 999 } });
        const policy = await resolveDuplicatePolicy(batch, prisma);
        expect(policy).toMatchObject({ loq: .1, loqSource: 'ANALYSIS', methodologyId: null });
        expect(evaluateDuplicate({ value1: .02, value2: .05 }, policy).criterion).toBe('ABSOLUTE_DIFFERENCE');
    });
    test('analysis validation is the final known limit source', async () => {
        const { batch } = await fixture({ analysisLoq: null, validation: '{"loq":0.1}' });
        expect(await resolveDuplicatePolicy(batch, prisma)).toMatchObject({ loq: .1, loqSource: 'ANALYSIS_VALIDATION' });
    });
    test('real mixed-method membership is recorded as NO_LOQ / METHOD_AMBIGUOUS', async () => {
        const { batch } = await fixture({ methods: [.1, .2] });
        const policy = await resolveDuplicatePolicy(batch, prisma);
        expect(policy).toMatchObject({ loq: null, loqSource: null, noLoqReason: 'METHOD_AMBIGUOUS' });
        expect(evaluateDuplicate({ value1: .02, value2: .05 }, policy)).toMatchObject({ status: 'FAIL', criterion: 'RPD', notes: ['NO_LOQ', 'METHOD_AMBIGUOUS'] });
    });
});

describe('Audit 0.15: recorded methodology resolution', () => {
    const batch = { id: 'batch', labId: 'lab', analysis: 'analysis' };
    function db({ members = [], results = [], methodLoq = null, analysisLoq = null, validation = null } = {}) {
        return { analysis: { findUnique: jest.fn().mockResolvedValue({ loq: analysisLoq, validation }) },
            workItem: { findMany: jest.fn().mockResolvedValue(members) }, result: { findMany: jest.fn().mockResolvedValue(results) },
            methodology: { findUnique: jest.fn().mockResolvedValue({ loq: methodLoq }) } };
    }
    afterEach(() => jest.restoreAllMocks());
    test('actual current Result methodology wins over its cached WorkItem and generic limits', async () => {
        const fixture = db({ members: [{ sampleId: 'sample', methodologyId: 'cached' }], results: [{ sampleId: 'sample', methodologyId: 'recorded' }], methodLoq: .1, analysisLoq: .2, validation: '{"loq":0.3}' });
        const result = await resolveDuplicatePolicy(batch, fixture);
        expect(result).toMatchObject({ loq: .1, loqSource: 'METHODOLOGY', methodologyId: 'recorded' });
        expect(fixture.methodology.findUnique).toHaveBeenCalledWith({ where: { id: 'recorded' }, select: { loq: true } });
        expect(fixture.result.findMany.mock.calls[0][0].where).toEqual({ batchId: 'batch', param: 'analysis', isCurrent: true, sampleId: { in: ['sample'] } });
    });
    test('recorded WorkItem methodology is the fallback when no current Result records a method', async () => {
        expect(await resolveDuplicatePolicy(batch, db({ members: [{ sampleId: 'sample', methodologyId: 'method' }], methodLoq: .1 }))).toMatchObject({ loq: .1, loqSource: 'METHODOLOGY', methodologyId: 'method' });
    });
    test.each([[.2, '{"loq":0.3}', .2, 'ANALYSIS'], [null, '{"loq":0.3}', .3, 'ANALYSIS_VALIDATION']])('analysis fallback %s / %s is used without guessing a default method', async (analysisLoq, validation, loq, loqSource) => {
        const fixture = db({ analysisLoq, validation });
        expect(await resolveDuplicatePolicy(batch, fixture)).toMatchObject({ loq, loqSource, methodologyId: null });
        expect(fixture.methodology.findUnique).not.toHaveBeenCalled();
    });
    test('mixed recorded methodologies do not choose a common or default limit', async () => {
        const fixture = db({ members: [{ sampleId: 'one', methodologyId: 'a' }, { sampleId: 'two', methodologyId: 'b' }], analysisLoq: .1 });
        const policy = await resolveDuplicatePolicy(batch, fixture);
        expect(policy).toMatchObject({ loq: null, loqSource: null, methodologyId: null, noLoqReason: 'METHOD_AMBIGUOUS' });
        expect(evaluateDuplicate({ value1: 7, value2: 7 }, policy).notes).toEqual(['NO_LOQ', 'METHOD_AMBIGUOUS']);
    });
    test('policy reads carry lab, analysis, actual methodology and transaction context', async () => {
        const original = policyService.get, spy = jest.spyOn(policyService, 'get').mockImplementation(original);
        const fixture = db({ members: [{ sampleId: 'sample', methodologyId: 'method' }], methodLoq: .1 });
        await resolveDuplicatePolicy(batch, fixture);
        expect(spy).toHaveBeenCalledWith('lab', 'qc.duplicateNearLoqMultiplier', { analysisCode: 'analysis', methodologyId: 'method', db: fixture });
        expect(spy).toHaveBeenCalledWith('lab', 'qc.duplicateMaxRpd', { analysisCode: 'analysis', methodologyId: 'method', db: fixture });
    });
});
