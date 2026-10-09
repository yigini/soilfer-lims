const { sampleReplicatePairView } = require('../../services/sampleReplicateView');
const registry = require('../../config/policyRegistry');
const { resolveSampleReplicateRules } = require('../../services/sampleReplicatePolicyService');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { buildNativeRun, startNativeRun } = require('../../services/qcNativeRunService');
const { randomUUID } = require('node:crypto');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
async function fixture() {
    const f = await qcGateFixture({ criteria: { blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0 } });
    owned.push(f); return f;
}
const context = (f, batchId = null) => ({ labId: f.labId, analysisCode: f.analysisCode, methodologyId: f.method.id, batchId });
async function started(f) {
    await f.setPolicy([{ key: 'results.replicatesRequired', value: 2, analysisCode: f.analysisCode, methodologyId: f.method.id }]);
    const built = await buildNativeRun(f.db, f.actor, f.input);
    return startNativeRun(f.db, built.id, f.actor);
}
const projectStoredSnapshot = (db, edit) => db.$extends({ query: { batchAnalyte: { async findFirst({ args, query }) {
    const record = await query(args);
    return record ? { ...record, criteriaSnapshot: edit(record.criteriaSnapshot) } : record;
} } } });
const policy = { mode: 'RPD', maxRpd: 10, nearLoqMultiplier: 5, absMax: null,
    absMaxBelow5LOQ: null, loq: 0.5, numberFormat: { decimal: '.', thousands: null }, recordedCriteria: true };
const row = (replicateNo, value, extra = {}) => ({ id: `result-${replicateNo}`, attemptId: 'retained-attempt',
    replicateNo, value, rawInput: value, param: 'owned-analysis', unit: 'owned-unit', basis: 'AIR_DRY',
    methodologyId: 'owned-method', equipmentId: 'owned-instrument', ...extra });
const project = (rows, overrides = {}) => sampleReplicatePairView(rows, { requiredCount: 2, source: 'FROZEN', policy, ...overrides });

test('required count defaults to one for all presets, and the registry enforces both integer bounds', () => {
    const definition = registry.definition('results.replicatesRequired');
    expect(Object.values(definition.presets)).toEqual([1, 1, 1]);
    expect(registry.valid('results.replicatesRequired', 1)).toBe(true);
    expect(registry.valid('results.replicatesRequired', 2)).toBe(true);
    for (const value of [null, 0, -1, 3, 1.5, '2']) expect(registry.valid('results.replicatesRequired', value)).toBe(false);
});
test('10.0 and 12.0 at ten percent fail without modifying either retained Result', () => {
    const rows = [row(1, '10.0'), row(2, '12.0')], before = JSON.stringify(rows);
    expect(project(rows)).toMatchObject({ source: 'FROZEN', status: 'FAIL', mean: 11, rpd: 18.18, criterion: 'RPD', limit: 10 });
    expect(JSON.stringify(rows)).toBe(before);
});
test('a passing pair is only a read view, not a reported-value selection', () => {
    const result = project([row(1, '10'), row(2, '10.5')]);
    expect(result).toMatchObject({ status: 'PASS', mean: 10.25, rpd: 4.88 });
    expect(result).not.toHaveProperty('selection');
});
test('missing observations stay pending, and count one leaves the pair unnecessary', () => {
    expect(project([row(1, '10')])).toMatchObject({ status: 'PENDING', mean: null });
    expect(project([row(1, '10'), row(2, '12')], { requiredCount: 1 })).toMatchObject({ status: 'NOT_REQUIRED', mean: null });
});
test.each(['<0.5', '>100', 'not-a-reading'])('%s is not averaged or assigned a guessed verdict', value => {
    expect(project([row(1, value), row(2, '12')])).toMatchObject({ status: 'NOT_EVALUABLE', mean: null, rpd: null });
});
test('near-LOQ pairs reuse the existing absolute-difference criterion', () => {
    expect(project([row(1, '1.1'), row(2, '1.3')])).toMatchObject({ status: 'PASS', criterion: 'ABSOLUTE_DIFFERENCE', rpd: null, limit: 0.5 });
});
test('absolute-mode criteria use the configured limit and never an analysis-name constant', () => {
    expect(project([row(1, '6.4'), row(2, '6.6')], { policy: { ...policy, mode: 'ABS_DIFF', absMax: 0.1 } }))
        .toMatchObject({ status: 'FAIL', criterion: 'ABS_DIFF', limit: 0.1 });
    expect(project([row(1, '6.4'), row(2, '6.6')], { policy: { ...policy, mode: 'ABS_DIFF', absMax: null } }))
        .toMatchObject({ status: 'NOT_EVALUABLE', reason: 'ABS_DIFF_UNSET' });
});
test.each(['attemptId', 'unit', 'basis', 'equipmentId', 'methodologyId'])('different %s refuses a comparable pair', key => {
    expect(project([row(1, '10'), row(2, '12', { [key]: 'different' })]))
        .toMatchObject({ status: 'NOT_EVALUABLE', reason: 'CONTEXT_MISMATCH', mean: null });
});
test('the third retained observation shows its range and leaves the verdict to review', () => {
    expect(project([row(1, '10'), row(2, '12'), row(3, '11')]))
        .toMatchObject({ status: 'REVIEW_REQUIRED', range: 2, mean: null, rpd: null });
});

test('current rules resolve the method-scoped count and configured duplicate keys without reading QC frequency as count', async () => {
    const f = await fixture();
    expect(await resolveSampleReplicateRules(f.db, context(f))).toMatchObject({ requiredCount: 1, source: 'CURRENT', countSource: 'CURRENT' });
    await f.setPolicy([{ key: 'results.replicatesRequired', value: 2, analysisCode: f.analysisCode, methodologyId: f.method.id },
        { key: 'qc.duplicateEvery', value: 0 }, { key: 'qc.duplicateMode', value: 'ABS_DIFF' }, { key: 'qc.duplicateAbsMax', value: 0.2 }]);
    const before = await f.snapshot();
    expect(await resolveSampleReplicateRules(f.db, context(f))).toMatchObject({ requiredCount: 2, source: 'CURRENT',
        policy: { mode: 'ABS_DIFF', absMax: 0.2, loq: f.method.loq, loqSource: 'METHODOLOGY' } });
    expect(await f.snapshot()).toEqual(before);
});

test('a started native run retains its count, duplicate criterion and LOQ despite later policy and method changes', async () => {
    const f = await fixture(), run = await started(f), original = await resolveSampleReplicateRules(f.db, context(f, run.id));
    await f.setPolicy([{ key: 'results.replicatesRequired', value: 1 }, { key: 'results.replicatesRequired', value: 1,
        analysisCode: f.analysisCode, methodologyId: f.method.id }, { key: 'qc.duplicateMaxRpd', value: 99 }]);
    await f.db.methodology.update({ where: { id: f.method.id }, data: { loq: 999 } });
    const before = await f.snapshot(), criteria = (await f.db.batchAnalyte.findFirst({ where: { batchId: run.id } })).criteriaSnapshot;
    expect(original).toMatchObject({ requiredCount: 2, source: 'FROZEN', countSource: 'FROZEN', policy: { maxRpd: 10, loq: f.method.loq } });
    expect(await resolveSampleReplicateRules(f.db, context(f, run.id))).toEqual(original);
    expect(await f.snapshot()).toEqual(before);
    expect((await f.db.batchAnalyte.findFirst({ where: { batchId: run.id } })).criteriaSnapshot).toBe(criteria);
});

test('a historical snapshot without the new count uses the current count while retaining its frozen pair criteria', async () => {
    const f = await fixture(), run = await started(f);
    await f.setPolicy([{ key: 'results.replicatesRequired', value: 1, analysisCode: f.analysisCode, methodologyId: f.method.id }]);
    const before = await f.snapshot(), db = projectStoredSnapshot(f.db, raw => {
        // Read an older stored shape without altering any retained DB snapshot.
        const criteria = JSON.parse(raw); delete criteria.policySnapshot.values['results.replicatesRequired']; return JSON.stringify(criteria);
    });
    expect(await resolveSampleReplicateRules(db, context(f, run.id))).toMatchObject({ requiredCount: 1, countSource: 'CURRENT', source: 'FROZEN' });
    expect(await f.snapshot()).toEqual(before);
});

test('foreign run context refuses with scoped 403 and zero writes', async () => {
    const f = await fixture(), run = await started(f), foreign = randomUUID();
    await f.db.lab.create({ data: { id: foreign, code: foreign, name: 'Owned foreign scope', country: 'TEST' } });
    const before = await f.snapshot();
    await expect(resolveSampleReplicateRules(f.db, { ...context(f, run.id), labId: foreign }))
        .rejects.toMatchObject({ statusCode: 403, code: 'REPLICATE_SCOPE_DENIED' });
    expect(await f.snapshot()).toEqual(before);
});

test('malformed frozen evidence refuses a stable 409 rather than substituting live limits', async () => {
    const f = await fixture(), run = await started(f), before = await f.snapshot();
    await expect(resolveSampleReplicateRules(projectStoredSnapshot(f.db, () => '{invalid'), context(f, run.id)))
        .rejects.toMatchObject({ statusCode: 409, code: 'REPLICATE_CRITERIA_INVALID' });
    expect(await f.snapshot()).toEqual(before);
});
