const fs = require('node:fs');
const { createHash, randomUUID } = require('node:crypto');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const rules = require('../../services/workflowStateRules');
const { installReportedValueSelections } = require('../../scripts/install_reported_value_selections');
const selection = require('../../services/reportedValueSelectionService');
const { loadSelectionContext } = require('../../services/reportedValueSelectionContext');
const owned = [];
afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
async function fixture({ criteria = {}, install = true } = {}) {
    const f = await qcGateFixture({ status: 'ACCEPTED', criteria }); owned.push(f);
    if (install) installReportedValueSelections({ dbPath: f.file, apply: true });
    f.row = await f.result(f.items[0]);
    f.choose = (choice, options) => rules.inTransaction(f.db, tx => selection.appendReportedSelection(tx, f.items[0], f.actor, choice, options));
    f.read = () => rules.inTransaction(f.db, tx => selection.readReportedSelection(tx, f.items[0]));
    f.all = async () => JSON.stringify({ retained: await f.snapshot(),
        attempts: await f.db.workAttempt.findMany({ orderBy: { id: 'asc' } }),
        selections: await f.db.reportedValueSelection.findMany({ orderBy: { id: 'asc' } }) });
    return f;
}

test('dry installation makes zero writes; additive apply retains every existing row, and NO_OP is byte-identical', async () => {
    const f = await fixture({ install: false }), retained = await f.snapshot(), attempts = await f.db.workAttempt.findMany();
    const digest = () => createHash('sha256').update(fs.readFileSync(f.file)).digest('hex');
    const before = digest();
    expect(installReportedValueSelections({ dbPath: f.file })).toMatchObject({ classification: 'PRE_192', mode: 'DRY_RUN', totalChanges: 0 });
    expect(digest()).toBe(before);
    expect(installReportedValueSelections({ dbPath: f.file, apply: true })).toMatchObject({ classification: 'COMPLETE', mode: 'APPLIED', newSelectionCount: 0 });
    expect(await f.snapshot()).toEqual(retained); expect(await f.db.workAttempt.findMany()).toEqual(attempts);
    const installed = digest();
    expect(installReportedValueSelections({ dbPath: f.file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
    expect(digest()).toBe(installed);
});

test('AUTO_SINGLE persists exact source evidence, actor, policy and lineage, then reads that saved value', async () => {
    const f = await fixture(), retained = await f.snapshot(), attempt = await f.db.workAttempt.findUnique({ where: { id: f.row.attemptId } });
    const saved = await f.choose(); expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ analysisCode: f.analysisCode, valueText: f.row.value, unit: 'fixture-unit', rule: 'AUTO_SINGLE',
        selectedBy: f.actor.username, policyRule: 'MEAN_IF_WITHIN_R', supersedesId: null, backfill: false });
    const evidence = JSON.parse(saved[0].evidenceSnapshot);
    expect(evidence.attempts).toContainEqual({ id: attempt.id, status: 'ACCEPTED', evidenceHash: attempt.evidenceHash });
    expect(evidence.results[0]).toMatchObject({ id: f.row.id, value: f.row.value, unit: f.row.unit, censoring: f.row.censoring });
    expect((await f.read()).rows).toEqual(saved);
    const after = await f.snapshot(), unchanged = [0,1,2,3,4,6,7,8];
    expect(unchanged.map(index => after[index])).toEqual(unchanged.map(index => retained[index]));
    expect(after[5]).toHaveLength(retained[5].length + 1);
    expect(await f.db.workAttempt.findUnique({ where: { id: attempt.id } })).toEqual(attempt);
});

test('replacement appends evidence once, and a stale group token refuses with zero writes', async () => {
    const f = await fixture(), first = await f.choose();
    const next = await f.choose({ mode: 'ATTEMPT', attemptIds: [f.row.attemptId], reason: 'Confirmed original determination' }, { expectedGroupId: first[0].selectionGroupId });
    expect(next[0]).toMatchObject({ supersedesId: first[0].id, rule: 'REVIEWER' });
    expect(await f.db.reportedValueSelection.findUnique({ where: { id: first[0].id } })).toEqual(first[0]);
    const before = await f.all();
    await expect(f.choose({ mode: 'NOT_REPORTABLE', reason: 'Old screen request' }, { expectedGroupId: first[0].selectionGroupId }))
        .rejects.toMatchObject({ statusCode: 409, code: 'REPORTED_VALUE_SELECTION_CONFLICT' });
    expect(await f.all()).toBe(before);
});

test.each(['UPDATE', 'DELETE'])('SQL %s of a retained selection refuses and preserves all data', async operation => {
    const f = await fixture(), saved = await f.choose(), before = await f.all();
    const sql = operation === 'UPDATE' ? 'UPDATE "ReportedValueSelection" SET "valueText"=? WHERE "id"=?' : 'DELETE FROM "ReportedValueSelection" WHERE "id"=?';
    await expect(rules.inTransaction(f.db, tx => tx.$executeRawUnsafe(sql, ...(operation === 'UPDATE' ? ['999', saved[0].id] : [saved[0].id]))))
        .rejects.toMatchObject({ statusCode: 409, code: 'REPORTED_VALUE_SELECTION_IMMUTABLE' });
    expect(await f.all()).toBe(before);
});

test('a new QcRule revision does not change the stored r effective when the original was recorded', async () => {
    const f = await fixture({ criteria: { repeatabilityLimit: 1 } });
    const old = await rules.inTransaction(f.db, tx => loadSelectionContext(tx, f.items[0]));
    expect(old.limits[f.row.attemptId]).toMatchObject({ r: 1, source: 'QC_RULE', qcRuleVersion: 1, recordingSource: 'HISTORICAL_CREATED_AT' });
    await require('../../services/qcRuleService').change(f.actor, { labId: f.labId, analysisCode: f.analysisCode,
        methodologyId: f.method.id, expectedVersion: 1, reason: 'Later rule version', criteria: { repeatabilityLimit: 0.5 } }, { db: f.db });
    const now = await rules.inTransaction(f.db, tx => loadSelectionContext(tx, f.items[0]));
    expect(now.limits[f.row.attemptId].qcRuleId).toBe(old.limits[f.row.attemptId].qcRuleId);
    expect(now.limits[f.row.attemptId].r).toBe(1);
    await expect(require('../../services/qcRuleService').change(f.actor, { labId: f.labId, analysisCode: f.analysisCode,
        methodologyId: f.method.id, expectedVersion: 2, effectiveFrom: new Date(Date.now()-60000).toISOString(), reason: 'Forbidden backdate', criteria: { repeatabilityLimit: 9 } }, { db: f.db }))
        .rejects.toMatchObject({ statusCode: 422, code: 'QC_RULE_EFFECTIVE_FROM_INVALID' });
});

test('a foreign reviewer and an invalid explicit choice refuse with zero writes', async () => {
    const f = await fixture(), before = await f.all();
    await expect(rules.inTransaction(f.db, tx => selection.appendReportedSelection(tx, f.items[0],
        { username: 'foreign-reviewer', role: 'LAB_MANAGER', labId: randomUUID() }))).rejects.toMatchObject({ statusCode: 403 });
    await expect(f.choose({ mode: 'ATTEMPT', attemptIds: ['outside-work'] })).rejects.toMatchObject({ statusCode: 409, code: 'REPORTED_VALUE_SELECTION_INVALID' });
    expect(await f.all()).toBe(before);
});

test.each(['attemptIds','resultIds','qcRuleSnapshot','evidenceSnapshot','lineageSnapshot','outputParams'])('malformed %s refuses at the SQL boundary with zero writes', async field => {
    const f = await fixture(), saved = await f.choose(), before = await f.all();
    await expect(rules.inTransaction(f.db, tx => tx.reportedValueSelection.create({ data: { ...saved[0],
        id: randomUUID(), selectionGroupId: randomUUID(), supersedesId: saved[0].id, [field]: '{broken' } })))
        .rejects.toMatchObject({ statusCode: 409, code: 'REPORTED_VALUE_SELECTION_INVALID' });
    expect(await f.all()).toBe(before);
});

test('two concurrent choices of the same displayed group append exactly one replacement', async () => {
    const f = await fixture(), first = await f.choose(), snapshot = await f.snapshot();
    const results = await Promise.allSettled([
        f.choose({ mode: 'NOT_REPORTABLE', reason: 'Insufficient evidence' }, { expectedGroupId: first[0].selectionGroupId }),
        f.choose({ mode: 'ATTEMPT', attemptIds: [f.row.attemptId] }, { expectedGroupId: first[0].selectionGroupId })
    ]);
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(row => row.status === 'rejected').reason).toMatchObject({ statusCode: 409, code: 'REPORTED_VALUE_SELECTION_CONFLICT' });
    expect(await f.db.reportedValueSelection.count()).toBe(2);
    expect(await f.db.reportedValueSelection.findUnique({ where: { id: first[0].id } })).toEqual(first[0]);
    const after = await f.snapshot(), unchanged = [0,1,2,3,4,6,7,8];
    expect(unchanged.map(index => after[index])).toEqual(unchanged.map(index => snapshot[index]));
    expect(after[5]).toHaveLength(snapshot[5].length + 1);
});
