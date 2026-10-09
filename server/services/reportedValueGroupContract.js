const { TransitionError } = require('./workflowStateRules');
const { assertSelectionFresh } = require('./reportedValueSelectionLineage');
function assertSelectionGroupStructure(rows, outputParams) {
    if (!rows.length) throw new TransitionError('Choose a reported value before reporting this test.', 409, 'REPORTED_VALUE_SELECTION_REQUIRED');
    const stale = () => new TransitionError('The reported-value selection group is incomplete or stale.', 409, 'REPORTED_VALUE_STALE');
    const first = rows[0];
    const shared = ['workItemId', 'selectionGroupId', 'mode', 'attemptIds', 'rule', 'policyKey', 'policyVersion', 'policyRule',
        'qcRuleSnapshot', 'evidenceSnapshot', 'lineageSnapshot', 'outputParams', 'reason', 'selectedBy', 'backfill'];
    if (rows.length !== outputParams.length || new Set(rows.map(row => row.analysisCode)).size !== rows.length ||
        outputParams.some(param => !rows.some(row => row.analysisCode === param)) ||
        rows.some(row => shared.some(key => row[key] !== first[key]) || new Date(row.selectedAt).getTime() !== new Date(first.selectedAt).getTime())) throw stale();
    let expected;
    try { expected = JSON.parse(first.outputParams); } catch { throw stale(); }
    if (!Array.isArray(expected) || expected.length !== outputParams.length || new Set(expected).size !== expected.length ||
        expected.some(param => !outputParams.includes(param))) throw stale();
    return rows;
}
function assertReportedSelectionGroup(rows, outputParams, attempts, results) {
    assertSelectionGroupStructure(rows, outputParams);
    assertSelectionFresh(rows[0].lineageSnapshot, attempts, results);
    return rows;
}
module.exports = { assertReportedSelectionGroup, assertSelectionGroupStructure };
