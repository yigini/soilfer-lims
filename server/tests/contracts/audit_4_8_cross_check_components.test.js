const { mountUi } = require('../helpers/qcWorksheetUi');
const translations = locale => require('../../../client/src/translations/' + locale + '.json');
const translate = locale => (key, paramsOrFallback) => {
    const text = key.split('.').reduce((value, part) => value?.[part], translations(locale));
    return text === undefined ? typeof paramsOrFallback === 'string' ? paramsOrFallback : key
        : typeof paramsOrFallback === 'object' ? text.replace(/\{\{(\w+)\}\}/g, (_, name) => paramsOrFallback[name]) : text;
};
const evaluation = (patch = {}) => ({ ruleCode: 'BASES_CEC', outcome: 'FLAGGED', reasonCode: null, severity: 'ADVISORY',
    flagCode: 'CROSS_CHECK_BASES_GT_CEC', inputs: { values: [{ analysisCode: 'EXCH_CA', value: 13, unit: 'cmol(+)/kg',
        basis: 'AIR_DRY', censoring: 'NONE', resultIds: ['result-ca'], selectionId: 'selection-ca' }], missing: [], lowerBound: false },
    thresholds: { policyVersion: 4, 'crossCheck.basesCecFactor': 1.1 }, ...patch });
const data = () => ({ current: { policyVersion: 4, evaluations: [evaluation()] },
    atSubmission: [evaluation({ id: 'frozen', evaluatedBy: 'analyst', evaluatedAt: '2026-10-10T00:00:00Z' })],
    selectionErrors: [], existingTextureGate: { texture: { isValid: true }, isBlocking: false } });
function mount({ locale = 'en', response = data(), props = {}, axios } = {}) {
    return mountUi('components/sample/CrossCheckPanel.jsx', { sampleId: 'sample-a', reviewVersion: 1, token: 'review-token',
        t: translate(locale), canReview: true, ...props }, { axios: axios || { get: jest.fn(async () => ({ data: response })) } });
}
test.each(['en','es','es-419','fr','pt'])('%s review shows the translated 1.3 × CEC flag, current and frozen source evidence, without writes', async locale => {
    const view = mount({ locale }); await view.render();
    const text = translations(locale).crossCheck;
    for (const expected of [text.title, text.advisory, text.current, text.atSubmission, text.flags.CROSS_CHECK_BASES_GT_CEC,
        'result-ca', 'selection-ca', 'analyst', translations(locale).policies.keys.crossCheck_basesCecFactor]) expect(view.text()).toContain(expected);
    expect(view.find('cross-check-BASES_CEC-current')).toBeDefined();
    expect(view.find('cross-check-BASES_CEC-frozen')).toBeDefined();
    expect(view.axios.get).toHaveBeenCalledWith('/api/results/sample-a/cross-checks', { headers: { Authorization: 'Bearer review-token' } });
});
test('before selection the panel displays only stored submission checks; a legacy sample without evidence is disclosed', async () => {
    const response = data(); response.current = null; response.atSubmission = [];
    const view = mount({ response }); await view.render();
    expect(view.text()).toContain(translations('en').crossCheck.beforeSelection);
    expect(view.text()).toContain(translations('en').crossCheck.noSubmission);
    expect(view.text()).not.toContain(translations('en').crossCheck.current);
});
test.each(Object.keys(translations('en').crossCheck.reasons))('%s is shown as a localized not-evaluated reason', async reasonCode => {
    const response = data(); response.current.evaluations = [evaluation({ outcome: 'NOT_EVALUATED', flagCode: null, reasonCode })];
    const view = mount({ response }); await view.render();
    expect(view.text()).toContain(translations('en').crossCheck.reasons[reasonCode]);
});
test('missing Na is disclosed as a lower bound, and the advisory texture pass is shown alongside the existing blocking gate', async () => {
    const response = data(); response.current.evaluations = [evaluation({ ruleCode: 'TEXTURE_CLOSURE', outcome: 'PASS', flagCode: null }),
        evaluation({ inputs: { values: [], missing: ['EXCH_NA'], lowerBound: true } })];
    response.existingTextureGate.isBlocking = true;
    const view = mount({ response }); await view.render();
    expect(view.text()).toContain(translations('en').crossCheck.lowerBound);
    expect(view.text()).toContain('EXCH_NA');
    expect(view.find('cross-check-existing-gate').props.children).toEqual(expect.arrayContaining([translations('en').crossCheck.gateBlocks]));
    expect(view.find('cross-check-TEXTURE_CLOSURE-current')).toBeDefined();
});
test('permission loss and sample changes discard previous and late responses; unauthorized users never fetch', async () => {
    let resolve;
    const axios = { get: jest.fn(() => new Promise(done => { resolve = done; })) }, view = mount({ axios });
    await view.render();
    view.props.canReview = false; await view.render();
    resolve({ data: data() }); await view.render();
    expect(await view.render()).toBeNull(); expect(axios.get).toHaveBeenCalledTimes(1);
    const denied = mount({ props: { canReview: false } }); await denied.render();
    expect(denied.axios.get).not.toHaveBeenCalled();
});
test('a late response for the old sample cannot replace the new sample; reload retries a translated refusal', async () => {
    let oldResolve;
    const axios = { get: jest.fn().mockImplementationOnce(() => new Promise(done => { oldResolve = done; }))
        .mockRejectedValueOnce({ response: { data: { code: 'ACCESS_DENIED_LAB' } } }).mockResolvedValue({ data: data() }) };
    const view = mount({ axios }); await view.render(); view.props.sampleId = 'sample-b'; await view.render();
    oldResolve({ data: data() }); await view.render();
    expect(view.text()).toContain(translations('en').crossCheck.errors.ACCESS_DENIED_LAB);
    expect(view.text()).not.toContain('result-ca');
    view.find('cross-check-reload').props.onClick(); await view.render();
    expect(axios.get).toHaveBeenLastCalledWith('/api/results/sample-b/cross-checks', { headers: { Authorization: 'Bearer review-token' } });
    expect(view.text()).toContain('result-ca');
});
test('all five client/server catalogues cover every outcome, rule, flag and refusal reason', () => {
    for (const locale of ['en','es','es-419','fr','pt']) {
        const client = translations(locale).crossCheck, server = require('../../locales/' + locale + '.json').crossCheck;
        expect(client).toEqual(server);
        for (const group of ['rules','outcomes','flags','reasons','errors']) {
            expect(Object.keys(client[group])).toEqual(Object.keys(translations('en').crossCheck[group]));
            for (const message of Object.values(client[group])) expect(message).toEqual(expect.stringMatching(/\S/));
        }
    }
});
