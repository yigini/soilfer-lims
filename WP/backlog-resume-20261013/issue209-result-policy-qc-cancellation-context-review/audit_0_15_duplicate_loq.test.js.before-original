const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { createLegacyClosureDatabase, useLegacyRouteDatabase } = require('../helpers/legacyWorkflowDatabase');
const { evaluateDuplicate, evaluateBatchQc } = require('../../services/qcService');
const { resolveDuplicatePolicy } = require('../../services/duplicateQcPolicyService');
const policyService = require('../../services/policyService');
const prisma = require('../../prisma');
const { randomUUID } = require('crypto');
const id = prefix => `${prefix}-${randomUUID()}`;
const { parseDuplicateObservation } = require('../../../shared/numberParse');
const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const format = { decimal: '.', thousands: null };

describe('Audit 0.15: censored observations use the shared number parser', () => {
    test.each(['<0,05', '< 0.05', '<=0.05', '≤0.05', '<LOQ', ' <loq '])('%s is an explicit below-limit observation', raw => {
        expect(parseDuplicateObservation(raw, format)).toMatchObject({ valid: true, censored: 'BELOW', rawInput: raw });
    });
    test.each(['>100', '>=100', '≥100'])('%s is an above-range observation, never a finite measurement', raw => {
        expect(parseDuplicateObservation(raw, format)).toMatchObject({ valid: true, censored: 'ABOVE' });
    });
    test.each(['', '?0.1', '<bad', '<1,234'])('invalid or ambiguous %s is not an observation', raw => {
        expect(parseDuplicateObservation(raw, format).valid).toBe(false);
    });
    test.each([
        ['<LOQ', '<0.05', 'PASS', 'CENSORED_PAIR'],
        ['<0.1', '0.05', 'INVALID', 'CENSORED_MISMATCH'],
        ['>100', '100', 'INVALID', 'CENSORED_ABOVE_RANGE'],
        ['<0.1', '>100', 'INVALID', 'CENSORED_ABOVE_RANGE']
    ])('%s and %s produce %s', (value1, value2, status, criterion) => {
        expect(evaluateDuplicate({ value1, value2 }, { loq: .1 })).toMatchObject({ status, criterion, rpd: null });
    });
    test('different below-limit censoring values both remain null measured values with their limits recorded', () => {
        expect(evaluateDuplicate({ value1: '<0.1', value2: '≤0.2' })).toMatchObject({ status: 'PASS', value1: null, value2: null,
            notes: expect.arrayContaining(['NO_LOQ', 'CENSORED_PAIR', 'CENSORING_LIMITS_DIFFER']),
            censoringLimits: [{ qualifier: '<', limit: .1, literalLoq: false }, { qualifier: '<=', limit: .2, literalLoq: false }] });
    });
});

describe('Audit 0.15: both HTTP evaluation paths preserve LOQ and raw censoring evidence', () => {
    const labId = 'LAB-AUDIT-015';
    let token;
    const historicalFixtures = [];
    beforeAll(async () => {
        token = await getAuthToken('LAB_TECHNICIAN', labId);
        await prisma.lab.upsert({ where: { id: labId }, update: { settings: '{}' }, create: { id: labId, code: labId, name: labId, country: 'GTM', settings: '{}' } });
    });
    afterEach(async () => {
        jest.restoreAllMocks();
        for (const historical of historicalFixtures.splice(0)) await historical.close();
        await prisma.lab.update({ where: { id: labId }, data: { settings: '{}' } });
        if (await prisma.labPolicy.findUnique({ where: { labId } })) await policyService.change({ role: 'SUPER_ADMIN', username: 'FIXTURE', isActive: true }, labId,
            { reason: 'Reset number-format fixture', changes: [{ key: 'numbers.decimalSeparator', value: '.' }, { key: 'numbers.thousandsSeparator', value: null }] });
    });
    async function fixture({ methodLoqs = [.1], analysisLoq = .2, legacyPrior = false } = {}) {
        if (legacyPrior) {
            // Historical typed QC must be seeded before the real release
            // installer freezes it. Never bypass the current DB's guards.
            const user = await prisma.user.findUnique({ where: { id: require('jsonwebtoken').decode(token).id } });
            const historical = await createLegacyClosureDatabase({ analysis: 'QC-015-HISTORICAL', labId });
            historicalFixtures.push(historical);
            await historical.client.user.create({ data: user });
            useLegacyRouteDatabase(prisma, historical.client, { allModels: true });
        }
        const analysis = id('HTTP-A015'), batchId = id('HTTP-B015');
        await prisma.analysis.create({ data: { code: analysis, name: analysis, loq: analysisLoq } });
        const batch = await prisma.batch.create({ data: { id: batchId, analysis, labId, profile: 'RACK_40', status: 'OPEN', createdBy: 'fixture',
            ...(legacyPrior && { qcResults: '{"prior":"retained"}', history: '[{"prior":"retained"}]' }) } });
        const methods = [];
        for (const loq of methodLoqs) {
            const methodId = id('HTTP-M015'), sampleId = id('HTTP-S015');
            await prisma.methodology.create({ data: { id: methodId, analysisCode: analysis, name: methodId, loq } });
            await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, assignedLab: labId, status: 'PROCESSING' } });
            await createWorkItemFixture(prisma, { data: { id: id('HTTP-W015'), sampleId, analysis, assignedLab: labId, batchId, methodologyId: methodId, status: 'COMPLETED' } });
            methods.push(methodId);
        }
        // The two recorded duplicate pairs use two actual SAMPLE parents.
        // Retain the original method set so every LOQ-resolution assertion holds.
        if (methods.length === 1) {
            const sampleId = id('HTTP-S015');
            await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, assignedLab: labId, status: 'PROCESSING' } });
            await createWorkItemFixture(prisma, { data: { id: id('HTTP-W015'), sampleId, analysis, assignedLab: labId, batchId, methodologyId: methods[0], status: 'COMPLETED' } });
        }
        if (legacyPrior) {
            await prisma.batchQcResult.create({ data: { id: id('PRIOR-QC015'), batchId: batch.id, type: 'BLANK', label: 'Prior QC', measured: .01, status: 'PASS', details: '{"prior":"retained"}' } });
            await prisma.auditLog.create({ data: { id: id('PRIOR-AUDIT015'), entity: 'BATCH', entityId: batch.id, action: 'PRIOR_QC', details: '{"prior":"retained"}', performedBy: 'fixture', labId } });
        }
        await require('../helpers/normalizedQcFixture').normalizeLegacyQcFixture(prisma, batchId);
        return { batch, methods };
    }
    const payload = (value1, value2) => ({ blanks: [{ value: '0' }], controls: [{ expected: '7', measured: '7' }], duplicates: [{ value1, value2 }, { value1: 7, value2: 7 }] });
    const evaluate = async (batch, data, route = 'post') => {
        const parents = await prisma.batchPosition.findMany({ where: { batchId: batch.id, kind: 'SAMPLE' }, orderBy: { position: 'asc' } });
        if (parents.length) data.duplicates = data.duplicates.map((row, index) => ({ ...row, duplicateOfPositionId: parents[index % parents.length].id }));
        return request(app)[route](`/api/qc/batches/${batch.id}${route === 'post' ? '/evaluate' : ''}`)
            .set('Authorization', `Bearer ${token}`).send(data);
    };
    const duplicate = async batch => {
        const normalized = await prisma.batch.findUnique({ where: { id: batch.id }, include: require('../../services/qcRunViewService').QC_RUN_INCLUDE });
        const typed = require('../../services/qcRunViewService').batchApiView(normalized).qcItems.find(row => row.type === 'DUPLICATE');
        return { typed, details: JSON.parse(typed.details) };
    };
    test.each(['post', 'put'])('%s resolves the recorded methodology LOQ and persists all decision evidence', async route => {
        const { batch, methods: [methodologyId] } = await fixture();
        const response = await evaluate(batch, payload('0,02', '0,05'), route);
        expect({ status: response.status, body: response.body }).toMatchObject({ status: 200 });
        const { typed, details } = await duplicate(batch);
        expect(typed).toMatchObject({ status: 'PASS', value1: .02, value2: .05, rpd: null });
        expect(details).toMatchObject({ loq: .1, loqSource: 'METHODOLOGY', methodologyId, criterion: 'ABSOLUTE_DIFFERENCE', rawInput: { value1: '0,02', value2: '0,05' } });
        expect((await prisma.batch.findUnique({ where: { id: batch.id } })).status).toBe('QC_PASS');
    });
    test.each([
        ['<LOQ', '<0.05', 'PASS', 'CENSORED_PAIR'],
        [' <loq', '≤0,05 ', 'PASS', 'CENSORED_PAIR'],
        ['<0.1', '<0.2', 'PASS', 'CENSORED_PAIR'],
        ['<0.1', '0.05', 'INVALID', 'CENSORED_MISMATCH'],
        ['>100', '100', 'INVALID', 'CENSORED_ABOVE_RANGE'],
        [-1, 1, 'INVALID', 'INVALID_NONPOSITIVE']
    ])('%s / %s records %s without replacing censored limits with measured values', async (value1, value2, status, criterion) => {
        const { batch } = await fixture();
        expect((await evaluate(batch, payload(value1, value2))).status).toBe(200);
        const { typed, details } = await duplicate(batch);
        expect(typed.status).toBe(status); expect(details.criterion).toBe(criterion);
        expect(details.rawInput).toEqual({ value1: String(value1), value2: String(value2) });
        if (String(value1).trim().startsWith('<') || String(value1).startsWith('>')) expect(typed.value1).toBeNull();
        if (String(value2).trim().startsWith('<') || String(value2).trim().startsWith('≤')) expect(typed.value2).toBeNull();
        expect((await prisma.batch.findUnique({ where: { id: batch.id } })).status).toBe(status === 'PASS' ? 'QC_PASS' : 'QC_FAIL');
    });
    test('one analysis fallback is authoritative and mixed methods are audited as NO_LOQ without rejection', async () => {
        const fallback = await fixture({ methodLoqs: [], analysisLoq: .1 });
        expect((await evaluate(fallback.batch, payload(.02, .05))).status).toBe(200);
        expect((await duplicate(fallback.batch)).details).toMatchObject({ loq: .1, loqSource: 'ANALYSIS', methodologyId: null });
        const mixed = await fixture({ methodLoqs: [.1, .2] });
        expect((await evaluate(mixed.batch, payload(7, 7))).status).toBe(200);
        expect((await duplicate(mixed.batch)).details).toMatchObject({ loq: null, notes: ['NO_LOQ', 'METHOD_AMBIGUOUS'], criterion: 'RPD' });
    });
    test('raw localized censoring syntax is reparsed once with its lab format, never with a canonical grouping separator', async () => {
        await prisma.lab.update({ where: { id: labId }, data: { settings: '{"decimalSeparator":",","thousandsSeparator":"."}' } });
        await policyService.change({ role: 'SUPER_ADMIN', username: 'FIXTURE', isActive: true }, labId, { reason: 'Localized number-format fixture',
            changes: [{ key: 'numbers.decimalSeparator', value: ',' }, { key: 'numbers.thousandsSeparator', value: '.' }] });
        const { batch } = await fixture();
        const data = payload('<1.234', '<1.234');
        data.duplicates[0].rawInput = { value1: ' <1,234 ', value2: '<1,234' };
        expect((await evaluate(batch, data)).status).toBe(200);
        const { details } = await duplicate(batch);
        expect(details.censoringLimits.map(observation => observation.limit)).toEqual([1.234, 1.234]);
        expect(details.rawInput).toEqual(data.duplicates[0].rawInput);
    });
    test('an invalid nonpositive pair flags analytical results without deleting or changing their measured values', async () => {
        const { batch } = await fixture();
        const member = await prisma.workItem.findFirst({ where: { batchId: batch.id } });
        const row = await createExecutionResultFixture(prisma, { data: { id: id('HTTP-R015'), sampleId: member.sampleId, batchId: batch.id,
            param: batch.analysis, methodologyId: member.methodologyId, value: '42', numericValue: 42, rawInput: '42', isValid: true, isCurrent: true } });
        expect((await evaluate(batch, payload(-1, 1))).status).toBe(200);
        const after = await prisma.result.findUnique({ where: { id: row.id } });
        expect(after).toMatchObject({ value: '42', numericValue: 42, rawInput: '42', isCurrent: true, isValid: false });
        expect(JSON.parse(after.flags)).toContain('QC_BATCH_FAILED');
        expect(await prisma.result.count({ where: { batchId: batch.id } })).toBe(1);
        expect(await prisma.auditLog.count({ where: { entityId: batch.id } })).toBeGreaterThan(0);
    });
    test.each(['<0.1', '<LOQ'])('censored blank %s remains missing and leaves stored evidence untouched', async value => {
        const { batch } = await fixture(); const before = await prisma.batch.findUnique({ where: { id: batch.id } });
        const data = payload(7, 7); data.blanks[0].value = value;
        const response = await evaluate(batch, data);
        expect(response.status).toBe(400);
        if (value === '<LOQ') expect(response.body).toMatchObject({ code: 'QC_VALUES_MISSING', missingTypes: ['BLANK'] });
        else expect(response.body.code).toBe('INVALID_NUMBER');
        expect(await prisma.batch.findUnique({ where: { id: batch.id } })).toEqual(before);
        expect(await prisma.batchQcResult.count({ where: { batchId: batch.id } })).toBe(0);
        expect(await prisma.auditLog.count({ where: { entityId: batch.id } })).toBe(0);
    });
    test.each([
        ['post', 'blanks', 'value', '<0.01'], ['put', 'blanks', 'value', '<0.01'],
        ['post', 'controls', 'measured', '<5'], ['put', 'controls', 'measured', '<5'],
        ['post', 'controls', 'expected', '≤7'], ['put', 'controls', 'expected', '≤7']
    ])('%s qualified %s.%s %s is rejected before QC, status, history or audit writes', async (route, collection, field, value) => {
        const { batch } = await fixture({ legacyPrior: true });
        const before = await prisma.batch.findUnique({ where: { id: batch.id } });
        const beforeRows = await prisma.batchQcResult.findMany({ where: { batchId: batch.id }, orderBy: { id: 'asc' } });
        const beforeAudit = await prisma.auditLog.findMany({ where: { entityId: batch.id }, orderBy: { id: 'asc' } });
        const data = payload(7, 7); data[collection][0][field] = value;
        const response = await evaluate(batch, data, route);
        expect(response.status).toBe(400); expect(response.body.code).toBe('INVALID_NUMBER');
        expect(await prisma.batch.findUnique({ where: { id: batch.id } })).toEqual(before);
        expect(await prisma.batchQcResult.findMany({ where: { batchId: batch.id }, orderBy: { id: 'asc' } })).toEqual(beforeRows);
        expect(await prisma.auditLog.findMany({ where: { entityId: batch.id }, orderBy: { id: 'asc' } })).toEqual(beforeAudit);
    });
    test.each([null, '', '<LOQjunk', '?0.1', '6 ,42'])('missing, malformed or unknown duplicate %s is refused as missing with no writes', async value => {
        const { batch } = await fixture(); const before = await prisma.batch.findUnique({ where: { id: batch.id } });
        const response = await evaluate(batch, payload(value, 7));
        expect(response.status).toBe(400); expect(response.body).toMatchObject({ code: 'QC_VALUES_MISSING', missingTypes: ['DUPLICATE'] });
        expect(await prisma.batch.findUnique({ where: { id: batch.id } })).toEqual(before);
        expect(await prisma.batchQcResult.count({ where: { batchId: batch.id } })).toBe(0);
        expect(await prisma.auditLog.count({ where: { entityId: batch.id } })).toBe(0);
    });
    test('ambiguous duplicate syntax retains the shared typed refusal without changing evidence', async () => {
        const { batch } = await fixture(); const before = await prisma.batch.findUnique({ where: { id: batch.id } });
        const response = await evaluate(batch, payload('<1,234', 7));
        expect(response.status).toBe(400); expect(response.body.code).toBe('AMBIGUOUS_NUMBER');
        expect(await prisma.batch.findUnique({ where: { id: batch.id } })).toEqual(before);
        expect(await prisma.batchQcResult.count({ where: { batchId: batch.id } })).toBe(0);
        expect(await prisma.auditLog.count({ where: { entityId: batch.id } })).toBe(0);
    });
});

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
            await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, assignedLab: batch.labId, status: 'PROCESSING' } });
            await createWorkItemFixture(prisma, { data: { id: id('WI015'), sampleId, analysis, assignedLab: batch.labId, batchId, methodologyId: methodId, status: 'COMPLETED' } });
            recorded.push({ methodId, sampleId });
        }
        return { batch, recorded };
    }
    test('current Result selects its recorded methodology rather than the cached work item', async () => {
        const { batch, recorded: [cached] } = await fixture({ methods: [.9] });
        const actualId = id('ACTUAL015');
        await prisma.methodology.create({ data: { id: actualId, analysisCode: batch.analysis, name: 'Actually recorded', loq: .1 } });
        await createExecutionResultFixture(prisma, { data: { id: id('R015'), sampleId: cached.sampleId, batchId: batch.id, param: batch.analysis, methodologyId: actualId, value: '.02', numericValue: .02, isCurrent: true } });
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
        return { lab: { findUnique: jest.fn().mockResolvedValue(null) },
            analysis: { findUnique: jest.fn().mockResolvedValue({ loq: analysisLoq, validation }) },
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
