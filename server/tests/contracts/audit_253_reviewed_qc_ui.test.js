const { mountUi, nativeHost, nativeFixture } = require('../helpers/qcWorksheetUi');

const correction = { id: 'correction-event', analysisCode: 'A', previousVerdict: 'FAIL', previousEvaluationId: 'failed-evaluation',
    evaluationId: 'replacement-evaluation', reviewer: { username: 'reviewer' }, observationAuthors: [{ username: 'analyst' }],
    reason: 'Transposed digits', sourceReference: 'Worksheet W-17, line 4', replacementEvaluation: { verdict: 'PASS' },
    originalEvaluation: { verdict: 'FAIL', details: { evaluation: { blanks: [{ value: 9.123456789, maxAllowed: 0.05, status: 'FAIL' }] } } },
    replacements: [{ original: { id: 'old-reading', positionId: 'blank', replicateNo: 1, rawInput: '9.123456789' },
        replacement: { id: 'new-reading', rawInput: '0.0123456789' } }] };
function batch() {
    const value = nativeFixture({ duplicates: 0, controls: 0 });
    value.status = 'QC_FAIL'; value.reviewedTranscriptionCorrectionEnabled = true;
    value.analytes[0].status = 'QC_FAIL'; value.analytes[0].measurements = [{ id: 'old-reading', positionId: 'blank', replicateNo: 1, value: 9.123456789, rawInput: '9.123456789' }];
    return value;
}
function correctionUi(patch = {}, axios) {
    return mountUi('components/qc/ReviewedQcCorrection.jsx', { batch: batch(), token: 'review-token', canReview: true,
        t: key => key, onSubmitted: jest.fn(), ...patch }, { axios });
}
test('review form starts with no replacement, requires source and reason, and submits only selected observation ids', async () => {
    const view = correctionUi(); await view.render();
    expect(view.find('reviewed-qc-value-old-reading').props.value).toBe(''); expect(view.find('reviewed-qc-submit').props.disabled).toBe(true);
    view.find('reviewed-qc-value-old-reading').props.onChange({ target: { value: '0.0123456789' } }); await view.render();
    view.find('reviewed-qc-reason').props.onChange({ target: { value: ' Transposed digits ' } }); await view.render();
    expect(view.find('reviewed-qc-submit').props.disabled).toBe(true);
    view.find('reviewed-qc-source').props.onChange({ target: { value: ' Worksheet W-17, line 4 ' } }); await view.render();
    expect(view.find('reviewed-qc-submit').props.disabled).toBe(false);
    await view.find('reviewed-qc-correction').props.onSubmit({ preventDefault: jest.fn() }); await view.render();
    expect(view.axios.post).toHaveBeenCalledWith('/api/qc/batches/worksheet-run/corrections', {
        mode: 'REVIEWED_TRANSCRIPTION', analysisCode: 'A', corrections: [{ positionId: 'blank', replicateNo: 1, rawInput: '0.0123456789' }],
        reason: 'Transposed digits', sourceReference: 'Worksheet W-17, line 4'
    }, { headers: { Authorization: 'Bearer review-token' } });
    expect(view.props.onSubmitted).toHaveBeenCalledTimes(1); expect(view.find('reviewed-qc-value-old-reading').props.value).toBe('');
});
test.each(['off', 'permission', 'closed', 'disposition', 'accepted'])('%s state exposes no reviewed correction submission', async state => {
    const data = batch(), patch = { batch: data };
    if (state === 'off') data.reviewedTranscriptionCorrectionEnabled = false;
    if (state === 'permission') patch.canReview = false;
    if (state === 'closed') data.status = 'CLOSED';
    if (state === 'disposition') data.analytes[0].disposition = { canonicalDecision: 'REJECT' };
    if (state === 'accepted') data.analytes[0].status = 'QC_PASS';
    const view = correctionUi(patch); await view.render(); expect(view.find('reviewed-qc-correction')).toBeUndefined(); expect(view.axios.post).not.toHaveBeenCalled();
});
test('a server refusal retains the source and correction draft without a success callback', async () => {
    const axios = { post: jest.fn(async () => { throw { response: { data: { error: 'Second person required' } } }; }) };
    const view = correctionUi({}, axios); await view.render();
    for (const [id, value] of [['reviewed-qc-value-old-reading', '0.01'], ['reviewed-qc-reason', 'Entry error'], ['reviewed-qc-source', 'Source line 4']]) {
        view.find(id).props.onChange({ target: { value } }); await view.render();
    }
    await view.find('reviewed-qc-correction').props.onSubmit({ preventDefault: jest.fn() }); await view.render();
    expect(view.text()).toContain('Second person required'); expect(view.find('reviewed-qc-value-old-reading').props.value).toBe('0.01');
    expect(view.find('reviewed-qc-source').props.value).toBe('Source line 4'); expect(view.props.onSubmitted).not.toHaveBeenCalled();
});
test('stored QC history and active native worksheet display the original failed record and reviewer disclosure', async () => {
    const data = batch(); data.reviewedCorrections = [correction]; data.analytes[0].reviewedCorrections = [correction];
    const history = mountUi('components/workbench/QcRunHistory.jsx', { batch: data }); await history.render();
    for (const value of ['failed-evaluation', 'FAIL', 'replacement-evaluation', 'PASS', 'reviewer', 'analyst', 'Transposed digits', 'Worksheet W-17', '9.123456789', '0.0123456789']) expect(history.text()).toContain(value);
    const native = nativeHost(data); await native.render(); expect(native.find('native-reviewed-qc-history')).toBeDefined();
    for (const value of ['failed-evaluation', 'replacement-evaluation', 'reviewer', 'Worksheet W-17', '9.123456789']) expect(native.text()).toContain(value);
});
test('reviewed correction translations are complete and match between client and server for all five locales', () => {
    const expected = Object.keys(require('../../locales/en.json').qcReviewedCorrection).sort();
    for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
        const server = require(`../../locales/${locale}.json`).qcReviewedCorrection, client = require(`../../../client/src/translations/${locale}.json`).qcReviewedCorrection;
        expect(Object.keys(server).sort()).toEqual(expected); expect(client).toEqual(server);
        expect(Object.values(server).every(text => typeof text === 'string' && text.trim())).toBe(true);
    }
});
