const { randomUUID } = require('node:crypto');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const rules = require('../../services/qcRuleService');
const policies = require('../../services/policyService');
const { resolveQcPolicy } = require('../../services/qcPolicyService');
const { evaluateBatchQc, evaluateBlank, evaluateDuplicate, evaluateControl } = require('../../services/qcService');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { getAuthToken } = require('../setup');
const actor = { username: 'system:fixture', role: 'SUPER_ADMIN' };
async function fixture(analysisCode = 'PH_H2O') {
    const labId = `QC-RULE-${randomUUID()}`;
    await prisma.lab.create({ data: { id: labId, code: labId, name: 'QC rule fixture', country: 'GTM' } });
    const method = await prisma.methodology.create({ data: { analysisCode, name: 'Recorded test method' } });
    return { labId, analysisCode, methodologyId: method.id, expectedVersion: 0, reason: 'Approved criterion change' };
}
const save = (target, criteria, extra = {}) => rules.change(actor, { ...target, criteria, ...extra }, { db: prisma });
const resolve = (target, extra = {}) => rules.resolve(target.labId, target.analysisCode, { db: prisma, methodologyId: target.methodologyId, ...extra });
const readings = { blanks: [{ value: 0 }], controls: [{ expected: 7, measured: 7 }], duplicates: [{ value1: 7, value2: 7 }, { value1: 7, value2: 7 }] };

test('shipped pH criterion is absolute 0.2, with blank not used even on a blank-slot profile', async () => {
    const f = await fixture();
    const snapshot = await resolve(f);
    expect(snapshot).toMatchObject({ source: 'DEFAULT_RULE', id: null, version: null, resolved: {
        duplicateMode: { value: 'ABS_DIFF', source: 'SHIPPED_ANALYSIS_DEFAULT' }, duplicateAbsMax: { value: 0.2 }, blankPerBatch: { value: 0 } } });
    const batch = await prisma.batch.create({ data: { id: randomUUID(), labId: f.labId, analysis: f.analysisCode, status: 'OPEN', createdBy: 'system:fixture' } });
    const policy = await resolveQcPolicy(batch, prisma);
    const evaluation = evaluateBatchQc({ controls: readings.controls, duplicates: [{ value1: 7, value2: 7.1 }] }, { policy, runProfile: { qcSlots: [{ type: 'BLANK' }, { type: 'CONTROL' }, { type: 'DUPLICATE' }] } });
    expect(evaluation.overallStatus).toBe('QC_PASS');
    expect(evaluation.duplicates[0]).toMatchObject({ criterion: 'ABS_DIFF', status: 'PASS', absMax: 0.2 });
    expect(evaluation.summary.requirements.BLANK).toMatchObject({ required: 0, found: 0, source: 'NOT_USED' });
    expect(evaluateDuplicate({ value1: 7, value2: 7.3 }, policy.duplicate)).toMatchObject({ criterion: 'ABS_DIFF', status: 'FAIL' });
    expect(evaluateDuplicate({ value1: 7, value2: 7.2 }, policy.duplicate)).toMatchObject({ criterion: 'ABS_DIFF', status: 'PASS' });
    expect(evaluateDuplicate({ value1: 7, value2: 7.20000001 }, policy.duplicate)).toMatchObject({ status: 'FAIL' });
});

test('per-field order is rule > method/analysis policy > shipped > preset, without seeding', async () => {
    const f = await fixture();
    await policies.change(actor, f.labId, { expectedVersion: 0, reason: 'Method criterion', changes: [
        { key: 'qc.duplicateAbsMax', value: 0.3, analysisCode: f.analysisCode, methodologyId: null },
        { key: 'qc.duplicateAbsMax', value: 0.4, analysisCode: f.analysisCode, methodologyId: f.methodologyId },
        { key: 'qc.blankMaxAllowed', value: 0.1 }
    ] }, { db: prisma });
    expect((await resolve(f)).resolved).toMatchObject({ duplicateAbsMax: { value: 0.4, source: 'METHOD_OVERRIDE' }, duplicateMode: { source: 'SHIPPED_ANALYSIS_DEFAULT' }, blankAbsLimit: { value: 0.1, source: 'LAB_OVERRIDE' } });
    expect((await resolve(f, { methodologyId: null })).resolved.duplicateAbsMax).toMatchObject({ value: 0.3, source: 'ANALYSIS_OVERRIDE' });
    const saved = await save(f, { duplicateAbsMax: 0.5 });
    expect(saved.qcRule.resolved.duplicateAbsMax).toEqual({ value: 0.5, source: 'QC_RULE' });
    expect(await prisma.qcRule.count({ where: { labId: f.labId } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entity: 'QC_RULE', entityId: saved.rule.id } })).toBe(1);
});

test('custom/lab-specific analysis names do not acquire shipped criteria', async () => {
    const code = `CUSTOM-PH-${randomUUID()}`;
    await prisma.analysis.create({ data: { code, name: 'pH custom', isGlobal: false } });
    const f = await fixture(code), snapshot = await resolve(f);
    expect(snapshot.resolved.duplicateMode).toMatchObject({ value: 'RPD', source: 'REGISTRY_DEFAULT' });
});

test('exact-method rule wins over generic; mixed-method context uses generic only and records ambiguity', async () => {
    const f = await fixture();
    await save({ ...f, methodologyId: null }, { duplicateAbsMax: 0.6 });
    await save(f, { duplicateAbsMax: 0.4 });
    expect((await resolve(f)).resolved.duplicateAbsMax.value).toBe(0.4);
    const generic = await resolve(f, { noLoqReason: 'METHOD_AMBIGUOUS' });
    expect(generic).toMatchObject({ methodologyId: null, notes: ['METHOD_AMBIGUOUS'], resolved: { duplicateAbsMax: { value: 0.6 } } });
});

test('new versions and reset preserve old immutable rows and previously frozen evidence', async () => {
    const f = await fixture(), first = await save(f, { duplicateAbsMax: 0.4 });
    const frozen = JSON.stringify(first.qcRule), stored = await prisma.qcRule.findUnique({ where: { id: first.rule.id } });
    const second = await save(f, { duplicateAbsMax: 0.5 }, { expectedVersion: 1 });
    expect(second.rule.version).toBe(2);
    expect(await prisma.qcRule.findUnique({ where: { id: first.rule.id } })).toEqual(stored);
    expect(JSON.stringify(first.qcRule)).toBe(frozen);
    const reset = await save(f, {}, { expectedVersion: 2, reset: true });
    expect(reset.rule.version).toBe(3); expect(Object.values(reset.rule.criteria).every(value => value === null)).toBe(true);
    expect(reset.qcRule.resolved.duplicateAbsMax).toMatchObject({ value: 0.2, source: 'SHIPPED_ANALYSIS_DEFAULT' });
    // The SQLite Prisma adapter maps trigger aborts to P2003; direct SQL guard
    // tests assert the trigger's exact stable code as well.
    await expect(prisma.qcRule.update({ where: { id: first.rule.id }, data: { reason: 'overwrite' } })).rejects.toMatchObject({ code: 'P2003' });
    await expect(prisma.qcRule.delete({ where: { id: first.rule.id } })).rejects.toMatchObject({ code: 'P2003' });
    expect(await prisma.qcRule.findUnique({ where: { id: first.rule.id } })).toEqual(stored);
});

test('future effective date stays inactive, backdating rolls back without audit, and version races return 409', async () => {
    const f = await fixture();
    const saved = await save(f, { duplicateAbsMax: 0.8 }, { effectiveFrom: new Date(Date.now() + 60000).toISOString() });
    expect((await resolve(f)).source).toBe('DEFAULT_RULE');
    expect((await resolve(f, { evaluatedAt: saved.rule.effectiveFrom })).version).toBe(1);
    await expect(save(f, {}, { expectedVersion: 1, effectiveFrom: new Date(Date.now() - 60000).toISOString() })).rejects.toMatchObject({ statusCode: 422, code: 'QC_RULE_EFFECTIVE_FROM_INVALID' });
    await expect(save(f, {}, { expectedVersion: 0 })).rejects.toMatchObject({ statusCode: 409, code: 'QC_RULE_VERSION_CONFLICT' });
    expect(await prisma.qcRule.count({ where: { labId: f.labId } })).toBe(1);
});

test.each([{ crmMode: 'EN_SCORE' }, { blankCorrection: 'SUBTRACT_MEAN_BLANK' }])('unsupported mode %j returns 422 with no rule or audit', async criteria => {
    const f = await fixture();
    await expect(save(f, criteria)).rejects.toMatchObject({ statusCode: 422, code: 'QC_RULE_MODE_UNSUPPORTED' });
    expect(await prisma.qcRule.count({ where: { labId: f.labId } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entity: 'QC_RULE', labId: f.labId } })).toBe(0);
});

test('null inheritance still validates effective min/max pairs; reason and scope gates are enforced', async () => {
    const f = await fixture();
    await expect(save(f, { crmRecoveryMin: 120 })).rejects.toMatchObject({ code: 'QC_RULE_VALUE_INVALID' });
    await expect(save(f, {}, { reason: ' ' })).rejects.toMatchObject({ code: 'QC_RULE_REASON_REQUIRED', statusCode: 400 });
    await expect(rules.change({ role: 'LAB_TECHNICIAN', labId: f.labId }, f, { db: prisma })).rejects.toMatchObject({ statusCode: 403 });
    const other = await fixture();
    await expect(rules.change({ username: 'fixture', role: 'LAB_MANAGER', labId: other.labId }, f, { db: prisma })).rejects.toMatchObject({ statusCode: 403, code: 'TARGET_OUTSIDE_SCOPE' });
    expect(await prisma.qcRule.count({ where: { labId: f.labId } })).toBe(0);
});

test('saving LOQ mode without LOQ warns; evaluation fails closed and negative blanks never pass', async () => {
    const code = `NO-LOQ-${randomUUID()}`;
    await prisma.analysis.create({ data: { code, name: 'No LOQ fixture' } });
    const f = await fixture(code), saved = await save(f, { blankLimitMode: 'LT_LOQ' });
    expect(saved.warnings).toEqual([{ code: 'QC_RULE_LOQ_MISSING', notes: [] }]);
    expect(evaluateBlank({ value: 0 }, { mode: 'LT_LOQ', loq: null })).toMatchObject({ status: 'INVALID', criterion: 'NO_LOQ' });
    expect(evaluateBlank({ value: -100 }, { mode: 'LT_LOQ', loq: 1 })).toMatchObject({ status: 'FAIL' });
    expect(evaluateBlank({ value: -0.5 }, { mode: 'LT_HALF_LOQ', loq: 1 })).toMatchObject({ status: 'FAIL' });
    expect(evaluateBlank({ value: -0.49 }, { mode: 'LT_HALF_LOQ', loq: 1 })).toMatchObject({ status: 'PASS' });
});

test('40 work items at frequency 10 require four duplicates; CRM fulfils CONTROL but never LRM', async () => {
    const f = await fixture();
    const batch = await prisma.batch.create({ data: { id: randomUUID(), labId: f.labId, analysis: f.analysisCode, status: 'OPEN', createdBy: 'system:fixture' } });
    await prisma.$transaction(async tx => {
        for (let index = 0; index < 40; index++) {
            const sample = await createSampleFixture(tx, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: f.labId, labId: f.labId, status: 'PROCESSING' } });
            await createWorkItemFixture(tx, { data: { id: randomUUID(), sampleId: sample.id, analysis: f.analysisCode, status: 'IN_PROGRESS', batchId: batch.id, methodologyId: f.methodologyId } });
        }
    }, { timeout: 20000 });
    const policy = await resolveQcPolicy(batch, prisma);
    const profile = { qcSlots: [{ type: 'CONTROL' }, { type: 'DUPLICATE' }] };
    const payload = { controls: [{ expected: 7, measured: 7, referenceUse: 'CRM' }], duplicates: readings.duplicates };
    const failed = evaluateBatchQc(payload, { policy, runProfile: profile });
    expect(failed.overallStatus).toBe('QC_FAIL');
    expect(failed.summary.requirements).toMatchObject({ DUPLICATE: { required: 4, found: 2, source: 'RULE' }, CONTROL: { required: 1, found: 1, source: 'PROFILE' }, LRM: { required: 1, found: 0, source: 'RULE' } });
    expect(failed.summary.missingRequired.map(row => row.type)).toEqual(['DUPLICATE', 'LRM']);
    const passed = evaluateBatchQc({ controls: readings.controls, duplicates: [...readings.duplicates, ...readings.duplicates] }, { policy, runProfile: profile });
    expect(passed.overallStatus).toBe('QC_PASS');
});

test.each(['REQUIRED_WARN', 'ADVISORY', 'OFF'])('%s records missing counts appropriately without failing passing submitted items', async mode => {
    const f = await fixture(), snapshot = await resolve(f);
    const result = evaluateBatchQc({ blanks: [{ value: 0 }] }, { policy: { qcRule: snapshot, qcMode: mode, sampleCount: 40 } });
    expect(result.overallStatus).toBe('QC_PASS');
    if (mode === 'REQUIRED_WARN') {
        expect(result.summary.missingRequired.map(row => row.type)).toEqual(['DUPLICATE', 'LRM']);
        expect(result.summary.warnings).toHaveLength(2);
    } else expect(result.summary.missingRequired).toEqual([]);
});

test('WARN item failures remain visible without failing batch; optional failing entries still count normally', async () => {
    const f = await fixture(), saved = await save(f, { blankPerBatch: 0, duplicateEvery: 0, lrmPerBatch: 0, crmEveryNBatches: 0,
        failAction: { BLANK: 'WARN', DUPLICATE: 'FAIL_BATCH', LRM: 'FAIL_BATCH', CRM: 'FAIL_BATCH' } });
    const result = evaluateBatchQc({ blanks: [{ value: 100 }] }, { policy: { qcRule: saved.qcRule, qcMode: 'REQUIRED_BLOCKING', sampleCount: 40 } });
    expect(result.overallStatus).toBe('QC_PASS'); expect(result.blanks[0].status).toBe('FAIL'); expect(result.summary.warnings).toHaveLength(1);
    const defaults = await resolve({ ...f, methodologyId: null });
    expect(evaluateBatchQc({ blanks: [{ value: 100 }] }, { policy: { qcRule: defaults, qcMode: 'ADVISORY', sampleCount: 0 } }).overallStatus).toBe('QC_FAIL');
});

test('real evaluation freezes selected rule and field sources in summary and every typed row, unchanged by later versions', async () => {
    const f = await fixture();
    const first = await save({ ...f, methodologyId: null }, { duplicateAbsMax: 0.4 });
    const batch = await prisma.batch.create({ data: { id: randomUUID(), labId: f.labId, analysis: f.analysisCode, profile: 'RACK_40', status: 'OPEN', createdBy: 'system:fixture' } });
    const token = await getAuthToken('LAB_MANAGER', f.labId);
    const response = await request(app).post(`/api/qc/batches/${batch.id}/evaluate`).set('Authorization', `Bearer ${token}`).send(readings);
    expect(response.status).toBe(200); expect(response.body.status).toBe('QC_PASS');
    const before = await prisma.batch.findUnique({ where: { id: batch.id } }), rows = await prisma.batchQcResult.findMany({ where: { batchId: batch.id } });
    expect(JSON.parse(before.qcResults).summary.qcRule.id).toBe(first.rule.id);
    for (const row of rows) expect(JSON.parse(row.details).qcRule).toMatchObject({ id: first.rule.id, version: 1, resolved: { duplicateAbsMax: { value: 0.4, source: 'QC_RULE' } } });
    await save({ ...f, methodologyId: null }, { duplicateAbsMax: 0.5 }, { expectedVersion: 1 });
    expect(await prisma.batch.findUnique({ where: { id: batch.id } })).toEqual(before);
    expect(await prisma.batchQcResult.findMany({ where: { batchId: batch.id } })).toEqual(rows);
});

test('concurrent saves with the same expected version permit one rule and one audit only', async () => {
    const f = await fixture();
    const attempts = await Promise.allSettled([save(f, { duplicateAbsMax: 0.3 }), save(f, { duplicateAbsMax: 0.4 })]);
    expect(attempts.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.find(row => row.status === 'rejected').reason).toMatchObject({ statusCode: 409, code: 'QC_RULE_VERSION_CONFLICT' });
    expect(await prisma.qcRule.count({ where: { labId: f.labId } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entity: 'QC_RULE', labId: f.labId } })).toBe(1);
});

test('absolute CRM window and provisional LRM fixed window store the applied criterion and notes', () => {
    expect(evaluateControl({ expected: 7, measured: 7.2, referenceUse: 'CRM' }, { crmMode: 'ABS_WINDOW', crmAbsWindow: 0.2 }))
        .toMatchObject({ criterion: 'ABS_WINDOW', status: 'PASS' });
    expect(evaluateControl({ expected: 7, measured: 7, referenceUse: 'CRM' }, { crmMode: 'ABS_WINDOW', crmAbsWindow: null }))
        .toMatchObject({ criterion: 'RECOVERY', notes: ['ABS_WINDOW_UNSET'] });
    expect(evaluateControl({ expected: 100, measured: 108, referenceUse: 'LRM' }, { lrmMode: 'CONTROL_CHART', lrmWindowPct: 5 }))
        .toMatchObject({ status: 'FAIL', notes: ['PROVISIONAL_NO_CHART'], lrmWindowPct: 5 });
});

test('rule API uses policy permission and lab scope, exposes field resolution, and returns stable validation codes', async () => {
    const f = await fixture();
    const manager = await getAuthToken('LAB_MANAGER', f.labId), technician = await getAuthToken('LAB_TECHNICIAN', f.labId);
    const query = { labId: f.labId, analysisCode: f.analysisCode, methodologyId: f.methodologyId };
    const read = await request(app).get('/api/qc/rules').query(query).set('Authorization', `Bearer ${manager}`);
    expect(read.status).toBe(200); expect(read.body.data).toMatchObject({ expectedVersion: 0, fieldPolicies: { duplicateAbsMax: 'qc.duplicateAbsMax' } });
    const forbidden = await request(app).post('/api/qc/rules').set('Authorization', `Bearer ${technician}`).send(f);
    expect(forbidden.status).toBe(403);
    const saved = await request(app).post('/api/qc/rules').set('Authorization', `Bearer ${manager}`).send({ ...f, criteria: { duplicateAbsMax: 0.3 } });
    expect(saved.status).toBe(201); expect(saved.body.data.rule.approvedBy).toBeDefined();
    const raced = await request(app).post('/api/qc/rules').set('Authorization', `Bearer ${manager}`).send(f);
    expect(raced.status).toBe(409); expect(raced.body.code).toBe('QC_RULE_VERSION_CONFLICT');
});

test.each(['REQUIRED_BLOCKING', 'REQUIRED_WARN', 'ADVISORY', 'OFF'])('real %s API keeps partial input atomic and applies resolved count requirements', async mode => {
    const f = await fixture();
    await policies.change(actor, f.labId, { expectedVersion: 0, reason: 'Input guard mode test', changes: [{ key: 'qc.mode', value: mode }] }, { db: prisma });
    const token = await getAuthToken('LAB_MANAGER', f.labId);
    const batch = await prisma.batch.create({ data: { id: randomUUID(), labId: f.labId, analysis: f.analysisCode, profile: 'RACK_40', status: 'OPEN', createdBy: 'system:fixture' } });
    const state = async () => ({ batch: await prisma.batch.findUnique({ where: { id: batch.id } }),
        typed: await prisma.batchQcResult.findMany({ where: { batchId: batch.id } }), audits: await prisma.auditLog.findMany({ where: { entityId: batch.id } }) });
    const before = await state();
    const evaluate = payload => request(app).post(`/api/qc/batches/${batch.id}/evaluate`).set('Authorization', `Bearer ${token}`).send(payload);
    const partial = await evaluate({ ...readings, duplicates: [{ value1: 7 }] });
    expect(partial.status).toBe(400); expect(partial.body.code).toBe('QC_VALUES_MISSING'); expect(await state()).toEqual(before);
    const malformed = await evaluate({ ...readings, controls: { expected: 7, measured: 7 } });
    expect(malformed.status).toBe(400); expect(malformed.body.code).toBe('QC_VALUES_MISSING'); expect(await state()).toEqual(before);
    const omitted = await evaluate({ blanks: [{ value: 0 }] });
    if (mode === 'REQUIRED_BLOCKING') {
        expect(omitted.status).toBe(400); expect(omitted.body.code).toBe('QC_VALUES_MISSING'); expect(await state()).toEqual(before);
        const insufficient = await evaluate({ controls: readings.controls, duplicates: readings.duplicates.slice(0, 1) });
        expect(insufficient.status).toBe(200); expect(insufficient.body.status).toBe('QC_FAIL');
        expect(insufficient.body.evaluation.summary.missingRequired).toEqual([expect.objectContaining({ type: 'DUPLICATE', required: 2, found: 1 })]);
    } else {
        expect(omitted.status).toBe(200); expect(omitted.body.status).toBe('QC_PASS');
        if (mode === 'REQUIRED_WARN') expect(omitted.body.evaluation.summary.warnings).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'DUPLICATE', required: 2, found: 0 }), expect.objectContaining({ type: 'LRM', required: 1, found: 0 })]));
        else expect(omitted.body.evaluation.summary.missingRequired).toEqual([]);
    }
});

test('malformed rule laboratory references return a stable 422 without creating rules or audits', async () => {
    const f = await fixture(), token = await getAuthToken('LAB_MANAGER', f.labId);
    for (const labId of [null, [], {}]) {
        const response = await request(app).post('/api/qc/rules').set('Authorization', `Bearer ${token}`).send({ ...f, labId });
        expect(response.status).toBe(422); expect(response.body.code).toBe('QC_RULE_SCOPE_INVALID');
    }
    expect(await prisma.qcRule.count({ where: { labId: f.labId } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { entity: 'QC_RULE', labId: f.labId } })).toBe(0);
});
