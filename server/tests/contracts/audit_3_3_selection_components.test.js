const { mountUi } = require('../helpers/qcWorksheetUi');
const english = require('../../../client/src/translations/en.json');
const fs = require('node:fs'),vm=require('node:vm'),esbuild=require('../../../client/node_modules/esbuild');
const formatter={exports:{}};
vm.runInNewContext(esbuild.transformSync(fs.readFileSync(require('node:path').resolve(__dirname,'../../../client/src/utils/messageFormatter.js'),'utf8'),
    {loader:'js',format:'cjs'}).code,{module:formatter,exports:formatter.exports,require:name=>require('../../../client/node_modules/'+name),console});
const translate=locale=>(key,paramsOrFallback)=>{
    const catalogue=require('../../../client/src/translations/'+locale+'.json');
    const pattern=key.split('.').reduce((value,part)=>value?.[part],catalogue);
    return pattern==null ? typeof paramsOrFallback==='string'?paramsOrFallback:key :
        formatter.exports.formatMessage(pattern,typeof paramsOrFallback==='object'?paramsOrFallback:{},locale);
};
const t = translate('en');
const output = value => ({ analysisCode: 'PH', valueText: String(value), unit: 'pH' });
function data({ automatic = false, mean = true, status = 'SUBMITTED' } = {}) {
    return { status, current: { groupId: 'old-group', code: null, rows: [] },
        automatic: { choice: automatic ? { outputs: [output(12.6)] } : null, reasons: ['QUESTIONED_ORIGINAL'] },
        mean: mean ? { allowed: true, choice: { outputs: [output(12.3)] } } : { allowed: false, code: 'REPORTED_VALUE_OUTSIDE_LIMIT' },
        attempts: [12.0,12.6].map((value,index) => ({ id: 'attempt-'+index, attemptNo: index+1, eligible: true,
            status: index ? 'SUBMITTED' : 'QUESTIONED', batchId: 'batch-'+index, qcGates: [{ value: 'PASS' }],
            analyst: 'analyst-'+index, recordedAt: '2026-10-09T00:00:00Z', reason: index ? 'REVIEW_OUTLIER' : null, note: index ? 'Compare worksheet row 17' : null,
            results: [{ id: 'result-'+index, param: 'PH', replicateNo: 1, valueText: String(value), unit: 'pH', censoring: 'NONE' }],
            option: { allowed: true, choice: { outputs: [output(value)] } } })) };
}
function mount(patch = {}, response = data(), axios) {
    return mountUi('components/sample/ReportedValueReview.jsx', { itemId: 'work', itemVersion: 1, itemStatus: 'SUBMITTED', token: 'review-token',
        t, canReview: true, onChoice: jest.fn(), onSaved: jest.fn(), ...patch },
        { axios: axios || { get: jest.fn(async () => ({ data: response })), post: jest.fn(async () => ({ data: response.mean })) } });
}

test('review table displays retained original and repeat evidence, and a questioned original requires a choice', async () => {
    const view = mount(); await view.render();
    for (const value of ['12','12.6','batch-0','batch-1','PASS','analyst-0','analyst-1','Questioned','Submitted','Compare worksheet row 17']) expect(view.text()).toContain(value);
    expect(view.props.onChoice).toHaveBeenLastCalledWith({ selection: null, ready: false });
    expect(view.axios.post).not.toHaveBeenCalled();
    view.find('reported-choose-attempt-0').props.onChange(); await view.render();
    expect(view.props.onChoice).toHaveBeenLastCalledWith({ selection: { mode: 'ATTEMPT', attemptIds: ['attempt-0'] }, ready: true });
});

test('passing mean selects complete attempts; not reportable stays incomplete until its independent reason is entered', async () => {
    const view = mount(); await view.render();
    expect(view.find('reported-choose-mean').props.disabled).toBe(false);
    view.find('reported-choose-mean').props.onChange(); await view.render();
    expect(view.props.onChoice).toHaveBeenLastCalledWith({ selection: { mode: 'MEAN', attemptIds: ['attempt-0','attempt-1'] }, ready: true });
    view.find('reported-choose-not-reportable').props.onChange(); await view.render();
    expect(view.props.onChoice).toHaveBeenLastCalledWith({ selection: { mode: 'NOT_REPORTABLE', reason: '' }, ready: false });
    expect(view.find('reported-choice-reason').props.required).toBe(true);
    view.find('reported-choice-reason').props.onChange({ target: { value: '  Insufficient valid evidence  ' } }); await view.render();
    expect(view.props.onChoice).toHaveBeenLastCalledWith({ selection: { mode: 'NOT_REPORTABLE', reason: 'Insufficient valid evidence' }, ready: true });
});

test.each(['REPORTED_VALUE_OUTSIDE_LIMIT','REPORTED_VALUE_CENSORED_MEAN','REPORTED_VALUE_LIMIT_MISSING'])('%s disables mean and displays the refusal', async code => {
    const response = data(); response.mean = { allowed: false, code };
    const view = mount({},response); await view.render();
    expect(view.find('reported-choose-mean').props.disabled).toBe(true);
    expect(view.text()).toContain(english.reportedValue.errors[code]);
});

test('changing mean membership previews only complete selected attempts and a refusal cannot authorize acceptance', async () => {
    const response = data(), axios = { get: jest.fn(async () => ({ data: response })),
        post: jest.fn(async () => { throw { response: { data: { code: 'REPORTED_VALUE_LIMIT_MISSING' } } }; }) };
    const view = mount({},response,axios); await view.render();
    view.find('reported-choose-mean').props.onChange(); await view.render();
    await view.find('reported-mean-member-attempt-0').props.onChange({ target: { checked: false } }); await view.render();
    expect(axios.post).toHaveBeenCalledWith('/api/work/work/reported-value/preview', { mode: 'MEAN', attemptIds: ['attempt-1'] },
        { headers: { Authorization: 'Bearer review-token' } });
    expect(view.props.onChoice).toHaveBeenLastCalledWith({ selection: { mode: 'MEAN', attemptIds: ['attempt-1'] }, ready: false });
    expect(view.find('reported-choose-mean').props.disabled).toBe(true);
});

test('choosing questioned evidence alone or in a mean requires a reason before the selection is ready', async () => {
    const response=data(); response.attempts[0].option.requiresReason=true; response.mean.requiresReason=true;
    const view=mount({},response); await view.render();
    view.find('reported-choose-attempt-0').props.onChange(); await view.render();
    expect(view.props.onChoice).toHaveBeenLastCalledWith({selection:{mode:'ATTEMPT',attemptIds:['attempt-0']},ready:false});
    expect(view.find('reported-choice-reason').props.required).toBe(true);
    view.find('reported-choose-mean').props.onChange(); await view.render();
    expect(view.props.onChoice).toHaveBeenLastCalledWith({selection:{mode:'MEAN',attemptIds:['attempt-0','attempt-1']},ready:false});
    view.find('reported-choice-reason').props.onChange({target:{value:'Compared both worksheet records'}}); await view.render();
    expect(view.props.onChoice).toHaveBeenLastCalledWith({selection:{mode:'MEAN',attemptIds:['attempt-0','attempt-1'],reason:'Compared both worksheet records'},ready:true});
});

test('late evidence after a work-item change cannot enable the new review row', async () => {
    let resolveOld; const axios = { get: jest.fn(url => url.includes('/old/') ? new Promise(resolve => { resolveOld = resolve; }) :
        Promise.resolve({ data: data({ automatic: true }) })), post: jest.fn() };
    const view = mount({ itemId: 'old' },data(),axios); await view.render(); await view.render({ itemId: 'new' });
    expect(view.props.onChoice).toHaveBeenLastCalledWith({ selection: null, ready: true });
    resolveOld({ data: data() }); await view.render();
    expect(view.props.onChoice).toHaveBeenLastCalledWith({ selection: null, ready: true });
    expect(view.find('reported-value-new')).toBeDefined();
});

test('accepted choice sends the displayed group token; a conflict preserves the reason and emits no saved callback', async () => {
    const response = data({ status: 'ACCEPTED' }), axios = { get: jest.fn(async () => ({ data: response })),
        post: jest.fn(async () => { throw { response: { data: { code: 'REPORTED_VALUE_SELECTION_CONFLICT' } } }; }) };
    const view = mount({ itemStatus: 'ACCEPTED' },response,axios); await view.render();
    view.find('reported-choose-not-reportable').props.onChange(); await view.render();
    view.find('reported-choice-reason').props.onChange({ target: { value: 'Missing calibration record' } }); await view.render();
    await view.find('reported-save').props.onClick(); await view.render();
    expect(axios.post).toHaveBeenCalledWith('/api/work/work/reported-value', { expectedGroupId: 'old-group',
        selection: { mode: 'NOT_REPORTABLE', reason: 'Missing calibration record' } }, { headers: { Authorization: 'Bearer review-token' } });
    expect(view.find('reported-choice-reason').props.value).toBe('Missing calibration record');
    expect(view.props.onSaved).not.toHaveBeenCalled(); expect(view.text()).toContain(english.reportedValue.errors.REPORTED_VALUE_SELECTION_CONFLICT);
});

test('non-measurement review remains eligible without a selection, and unauthorized viewers make no preview request', async () => {
    const view = mount({}, { notRequired: true }); await view.render();
    expect(view.props.onChoice).toHaveBeenLastCalledWith({ selection: null, ready: true }); expect(view.find('reported-value-work')).toBeUndefined();
    const denied = mount({ canReview: false }); await denied.render(); expect(denied.axios.get).not.toHaveBeenCalled();
});

test('separate texture offers fraction-derived confirmation and no categorical mean',async()=>{
    const response={...data(),layout:'SEPARATE',derived:{allowed:true,requiresReason:true,
        choice:{mode:'DERIVED',outputs:[{analysisCode:'TEXTURE',valueText:'Sandy Loam'}]}}};
    const view=mount({},response);await view.render();
    expect(view.find('reported-choose-mean')).toBeUndefined();
    view.find('reported-choose-derived').props.onChange();await view.render();
    expect(view.props.onChoice).toHaveBeenLastCalledWith({selection:{mode:'DERIVED'},ready:false});
    view.find('reported-choice-reason').props.onChange({target:{value:'Fraction choices verified'}});await view.render();
    expect(view.props.onChoice).toHaveBeenLastCalledWith({selection:{mode:'DERIVED',reason:'Fraction choices verified'},ready:true});
    expect(view.text()).toContain('Sandy Loam');
});

test.each(['en','es','es-419','fr','pt'])('separate texture displays fraction and selection id through the real %s formatter',async locale=>{
    const response={...data({automatic:true}),layout:'SEPARATE',derived:{allowed:false,code:'REPORTED_VALUE_SELECTION_REQUIRED'}};
    response.automatic.choice={mode:'NOT_REPORTABLE',reason:JSON.stringify({code:'FRACTION_NOT_REPORTABLE',
        fractions:[{analysisCode:'SAND',selectionId:'sand-choice'}]}),outputs:[{analysisCode:'TEXTURE',valueText:''}]};
    const view=mount({t:translate(locale)},response);await view.render();
    expect(view.text()).toContain(translate(locale)('reportedValue.fractionNotReportable',{fraction:'SAND',selectionId:'sand-choice'}));
    expect(view.text()).toContain('SAND');expect(view.text()).toContain('sand-choice');
    expect(view.text()).not.toContain('FRACTION_NOT_REPORTABLE');
});
test.each(['en','es','es-419','fr','pt'])('source and lineage refusals use the %s locale instead of an English API fallback',async locale=>{
    for(const code of ['REPORTED_VALUE_SOURCE_INVALID','REPORTED_VALUE_SOURCE_QC_BLOCKED','REPORTED_VALUE_LINEAGE_INVALID']) {
        const response=data();response.mean={allowed:false,code,error:'English server refusal'};
        const expected=require('../../../client/src/translations/'+locale+'.json').reportedValue.errors[code];
        expect(typeof expected).toBe('string');
        const view=mount({t:translate(locale)},response);await view.render();
        expect(view.text()).toContain(expected);expect(view.text()).not.toContain('English server refusal');
    }
});

test.each(['en','es','es-419','fr','pt'])('reported-value labels, statuses and refusals match both %s catalogues', locale => {
    const client = require(`../../../client/src/translations/${locale}.json`).reportedValue, server = require(`../../locales/${locale}.json`).reportedValue;
    expect(client).toEqual(server); expect(Object.keys(client).sort()).toEqual(Object.keys(english.reportedValue).sort());
    for (const key of ['errors','statuses']) { expect(Object.keys(client[key]).sort()).toEqual(Object.keys(english.reportedValue[key]).sort());
        expect(Object.values(client[key]).every(value => typeof value === 'string' && value.trim())).toBe(true); }
});
