const { analyteGateView } = require('../../services/qcRunGateService');
const { reportingQc, resolveReportingModes } = require('../../services/reportResultGovernance');
const { freezeReportEvidence, describeReportEvidence } = require('../../services/reportTruthfulnessService');
const { checkBatchDisposition } = require('../../services/qcService');
function run() {
    return { id: 'mixed-run', analysis: 'A', status: 'QC_FAIL', positions: [], measurements: [], events: [], dispositions: [],
        analytes: [{ id: 'a', analysisCode: 'A', status: 'QC_PASS' }, { id: 'b', analysisCode: 'B', status: 'QC_FAIL' },
            { id: 'c', analysisCode: 'C', status: 'QC_PASS' }],
        evaluations: ['PASS', 'FAIL', 'NOT_REQUIRED'].map((verdict, index) => ({ id: `e${index}`, analysisCode: ['A', 'B', 'C'][index], version: 1,
            verdict, details: JSON.stringify({ mode: index === 2 ? 'OFF' : 'REQUIRED_BLOCKING' }) })) };
}
const result = code => ({ id: code, sampleId: 'sample', param: code, batchId: 'mixed-run', isCurrent: true, isValid: true });
const item = code => ({ id: `i${code}`, sampleId: 'sample', analysis: code, batchId: 'mixed-run', status: 'ACCEPTED' });

test.each(['NATIVE', 'PROFILE_ONLY', 'LEGACY_MIGRATED'])('a reopened %s round retains its PASS evaluation but cannot report QC within limits', provenance => {
    const batch = run(); batch.status = 'OPEN'; batch.analytes[0].status = 'QC_PENDING'; batch.analytes[0].provenance = provenance;
    if (provenance !== 'NATIVE') batch.evaluations[0].details = JSON.stringify({ legacy: provenance === 'LEGACY_MIGRATED',
        entryMode: provenance === 'PROFILE_ONLY' ? 'LEGACY_RESUBMISSION' : undefined, positionIds: [], measurementIds: [] });
    batch.events.push({ id: 'reopen', type: 'REOPENED', at: new Date(), payload: JSON.stringify({
        analysisCodes: ['A'], previousEvaluationIds: ['e0'], discardCurrentEvidence: provenance !== 'NATIVE' }) });
    expect(analyteGateView(batch, 'A').result).toBeNull();
    expect(batch.evaluations[0].verdict).toBe('PASS');
    const evidence = freezeReportEvidence([result('A')], [item('A')], [batch]);
    expect(evidence.qc.withinLimits).toBe(false);
    expect(evidence.qc.deviations).toEqual([{ analysisCode: 'A', batchId: batch.id, qcStatus: 'QC_PENDING', dispositionReason: null }]);
    for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
        expect(describeReportEvidence(evidence, locale).qcStatement).not.toContain(require(`../../locales/${locale}.json`).resultReports.qcWithinLimits);
    }
});

test('report/review gates use independent analyte verdicts and fail closed for missing membership', () => {
    const batch = run();
    expect(checkBatchDisposition(analyteGateView(batch, 'A')).allowed).toBe(true);
    expect(checkBatchDisposition(analyteGateView(batch, 'B')).allowed).toBe(false);
    expect(checkBatchDisposition(analyteGateView(batch, 'missing')).allowed).toBe(false);
    for (const code of ['A', 'B', 'C']) {
        const gate = reportingQc({}, { results: [result(code)], workItems: [item(code)], qcBatches: [batch], qcModes: { [code]: 'REQUIRED_BLOCKING' } });
        expect(Boolean(gate.blocker)).toBe(code === 'B');
    }
    expect(freezeReportEvidence([result('A')], [item('A')], [batch]).qc.withinLimits).toBe(true);
    expect(freezeReportEvidence([result('B')], [item('B')], [batch]).qc.withinLimits).toBe(false);
});

test.each(['en', 'es', 'es-419', 'fr', 'pt'])('OFF evidence prints its explicit NOT_REQUIRED result in %s without a passing-QC claim', locale => {
    const evidence = freezeReportEvidence([result('C')], [item('C')], [run()]);
    expect(evidence.qc.withinLimits).toBe(false);
    expect(evidence.qc.deviations).toEqual([{ analysisCode: 'C', batchId: 'mixed-run', qcStatus: 'NOT_REQUIRED', dispositionReason: null }]);
    const labels = require(`../../locales/${locale}.json`).resultReports;
    expect(labels.qcNotRequired).toBeTruthy();
    const text = describeReportEvidence(evidence, locale).qcStatement;
    expect(text).toContain(labels.qcNotRequired); expect(text).not.toContain(labels.qcWithinLimits);
});

test('closed deviation acceptance allows the gate but retains failed evidence and its reason in a report', () => {
    const batch = run(); batch.status = 'CLOSED'; batch.analytes[1].status = 'CLOSED';
    batch.dispositions = [{ id: 'd', analysisCode: 'B', decision: 'ACCEPT_WITH_DEVIATION', reason: 'Matrix interference reviewed', decidedBy: 'manager', decidedAt: new Date() }];
    const view = analyteGateView(batch, 'B');
    expect(view.result).toBe('FAIL'); expect(checkBatchDisposition(view)).toMatchObject({ allowed: true, status: 'QC_PASS_WITH_WARNING' });
    const evidence = freezeReportEvidence([result('B')], [item('B')], [batch]);
    expect(evidence.qc.withinLimits).toBe(false); expect(evidence.qc.deviations[0].dispositionReason).toBe('Matrix interference reviewed');
});

test.each([null, '{broken', '{"qcMode":"UNKNOWN"}', '{}'])('a malformed started Native mode %s fails closed without live-policy fallback', async criteriaSnapshot => {
    const batch = run(); batch.startedAt = new Date();
    batch.analytes[0] = { ...batch.analytes[0], provenance: 'NATIVE', criteriaSnapshot };
    const live = jest.spyOn(require('../../services/policyService'), 'get');
    try {
        await expect(resolveReportingModes({ results: [result('A')], workItems: [item('A')] }, [batch]))
            .rejects.toMatchObject({ statusCode: 409, code: 'QC_POLICY_UNRESOLVED' });
        expect(live).not.toHaveBeenCalled();
    } finally { live.mockRestore(); }
});

test('derived texture reporting resolves the frozen mode through its governing PSA analysis', async () => {
    const batch = { id: 'psa', startedAt: new Date(), analytes: [{ analysisCode: 'PSA', provenance: 'NATIVE', criteriaSnapshot: '{"qcMode":"REQUIRED_WARN"}' }] };
    const sample = { results: [{ ...result('SAND'), batchId: 'psa' }], workItems: [{ ...item('PSA'), batchId: 'psa' }] };
    expect(await resolveReportingModes(sample, [batch])).toMatchObject({ qcModes: { SAND: 'REQUIRED_WARN' },
        qcModeEvidence: [{ resultId: 'SAND', effectiveMode: 'REQUIRED_WARN', source: 'FROZEN', contributingBatchIds: ['psa'],
            contributions: [{ analysisCode: 'PSA' }] }] });
});
