const qcGate = require('../../services/qcGateService');

const modes = ['REQUIRED_BLOCKING', 'REQUIRED_WARN', 'ADVISORY', 'OFF'];
const acknowledged = { reason: 'Reviewed calibration evidence', auditLogId: 'durable-ack' };

test.each(modes)('QC gate decisions in %s follow the pinned acceptance/publication table', mode => {
    const gate = value => ({ value, mode, required: true, modeSource: 'LIVE', batchIds: ['run'], evaluationId: 'evaluation', dispositionId: null });
    expect(qcGate.decision(gate('PASS')).allowed).toBe(true);
    expect(qcGate.decision(gate('REPEAT'))).toMatchObject({ allowed: false, code: 'QC_GATE_REPEAT_ORDERED' });
    const advisory = ['ADVISORY', 'OFF'].includes(mode);
    expect(qcGate.decision(gate('WARN'))).toMatchObject({ allowed: advisory, acknowledgementRequired: !advisory });
    expect(qcGate.decision(gate('WARN'), { acknowledgement: acknowledged }).allowed).toBe(true);
    expect(qcGate.decision(gate('FAIL')).allowed).toBe(advisory);
    expect(qcGate.decision(gate('FAIL'), { acknowledgement: acknowledged }).allowed).toBe(mode !== 'REQUIRED_BLOCKING');
    expect(qcGate.decision({ ...gate('FAIL'), acceptedWithDeviation: true }).allowed).toBe(true);
    for (const value of ['NO_BATCH', 'NOT_EVALUATED']) {
        expect(qcGate.decision(gate(value)).allowed).toBe(advisory);
        expect(qcGate.decision(gate(value), { acknowledgement: acknowledged }).allowed).toBe(mode !== 'REQUIRED_BLOCKING');
        expect(qcGate.decision({ ...gate(value), required: false }).allowed).toBe(true);
    }
    if (!advisory) {
        expect(qcGate.decision(gate('WARN'), { acknowledgement: { reason: '   ' } }).code).toBe('QC_ACKNOWLEDGEMENT_REQUIRED');
        expect(qcGate.decision(gate('WARN'), { acknowledgement: { reason: 'Reviewed' }, publication: true }).allowed).toBe(false);
        expect(qcGate.decision(gate('WARN'), { acknowledgement: acknowledged, publication: true }).allowed).toBe(true);
    }
});

function fixture() {
    const result = { id: 'result', sampleId: 'sample', param: 'A', batchId: 'run' };
    const item = { id: 'item', sampleId: 'sample', analysis: 'A', batchId: 'run' };
    const batch = { id: 'run', analysis: 'A', status: 'QC_PASS', startedAt: null, events: [], dispositions: [], positions: [], measurements: [],
        analytes: [{ id: 'analyte', analysisCode: 'A', status: 'QC_PASS', provenance: 'LEGACY_MIGRATED' }],
        evaluations: [{ id: 'evaluation', analysisCode: 'A', version: 1, verdict: 'PASS', details: '{}' }] };
    const options = { mode: 'REQUIRED_BLOCKING', modeSource: 'LIVE', required: true };
    return { result, item, batch, options, gate() { return qcGate.gateFromEvidence(result, [item], [batch], options); } };
}

test('OPEN/RUNNING and reopened evaluations are NOT_EVALUATED despite retained pass evidence', () => {
    for (const status of ['OPEN', 'IN_RUN', 'QC_PENDING']) {
        const f = fixture(); f.batch.evaluations = []; f.batch.analytes[0].status = status;
        expect(f.gate().value).toBe('NOT_EVALUATED');
        expect(qcGate.decision(f.gate()).code).toBe('QC_GATE_NOT_EVALUATED');
    }
    const f = fixture();
    f.batch.events.push({ type: 'REOPENED', at: new Date(), payload: JSON.stringify({ analysisCodes: ['A'], previousEvaluationIds: ['evaluation'] }) });
    expect(f.gate().value).toBe('NOT_EVALUATED');
    expect(f.batch.evaluations[0].verdict).toBe('PASS');
});

test('analyte verdicts are independent and missing batch membership never produces PASS', () => {
    const f = fixture();
    f.batch.status = 'QC_FAIL'; f.batch.analytes.push({ analysisCode: 'B', status: 'QC_FAIL' });
    expect(f.gate()).toMatchObject({ value: 'PASS', evaluationId: 'evaluation' });
    f.item.analysis = f.result.param = 'missing';
    expect(f.gate()).toMatchObject({ value: 'NOT_EVALUATED', error: 'QC_ANALYSIS_NOT_IN_RUN' });
    expect(qcGate.decision(f.gate()).allowed).toBe(false);
});

test('required NO_BATCH fails while a method waiver allows it', () => {
    const f = fixture(); f.result.batchId = f.item.batchId = null;
    expect(f.gate().value).toBe('NO_BATCH');
    expect(qcGate.decision(f.gate()).code).toBe('QC_GATE_NO_BATCH');
    f.options.required = false;
    expect(qcGate.decision(f.gate()).allowed).toBe(true);
});

test('a gate reader error fails closed with stable evidence and no writes', async () => {
    const db = { sample: { findUnique: jest.fn().mockRejectedValue(Error('read failed')) }, auditLog: { create: jest.fn() } };
    const gate = await qcGate.forResult({ id: 'result', sampleId: 'sample', batchId: 'run' }, { db });
    expect(gate).toMatchObject({ value: 'NOT_EVALUATED', required: true, modeSource: 'ERROR', batchIds: ['run'] });
    expect(qcGate.decision(gate)).toMatchObject({ allowed: false, code: 'QC_GATE_NOT_EVALUATED' });
    expect(db.auditLog.create).not.toHaveBeenCalled();
});
