const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const React = require('../../../client/node_modules/react');
const esbuild = require('../../../client/node_modules/esbuild');
const { registry } = require('../../config/policyRegistry');
const { FIELD_POLICIES } = require('../../config/qcRuleFields');
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : !node || typeof node !== 'object' ? [] : [node, ...nodes(node.props?.children)];
const text = node => Array.isArray(node) ? node.map(text).join('') : !node || typeof node !== 'object' ? String(node ?? '') : text(node.props?.children);
const t = key => key;
function host(filename, responses, props) {
    const hooks = [], effects = []; let cursor = 0, tree;
    const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
    const react = { ...React,
        useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
            return [hooks[index].value, value => { hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value; }]; },
        useEffect(effect, deps) { const index = cursor++; if (!same(hooks[index]?.deps, deps)) effects.push(effect); hooks[index] = { deps }; },
        useCallback(callback, deps) { const index = cursor++; if (!same(hooks[index]?.deps, deps)) hooks[index] = { deps, value: callback }; return hooks[index].value; }
    };
    const axios = { get: jest.fn(async url => ({ data: { data: responses[url] || [] } })), post: jest.fn().mockResolvedValue({ data: { status: 'QC_PASS', data: { warnings: [] } } }) };
    const module = { exports: {} };
    vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.resolve(__dirname, '../../../client', filename), 'utf8'), { loader: 'jsx', format: 'cjs' }).code,
        { module, exports: module.exports, console, require(name) {
            if (name === 'react') return react;
            if (name === 'axios') return axios;
            if (name.includes('LanguageContext')) return { useLanguage: () => ({ t }) };
            if (name.includes('AnalysisCatalogueContext')) return { useAnalysisNames: () => code => code };
            if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
            if (name === '@lims/number-parse') return require('../../../shared/numberParse');
            if (name === './NumberPreview') return () => null;
            if (name === './NativeRunPanel') return () => null; // These retained contracts exercise the profile-only branch.
            throw new Error(`Unexpected component import ${name}`);
        } });
    return { axios, async render(nextProps) { if (nextProps) props = { ...props, ...nextProps };
        for (let index = 0; index < 6; index++) { cursor = 0; tree = module.exports.default(props); effects.splice(0).forEach(effect => effect()); await new Promise(resolve => setImmediate(resolve)); } return tree; },
        all: () => nodes(tree), find: id => nodes(tree).find(node => node.props?.['data-testid'] === id),
        button: label => nodes(tree).find(node => node.type === 'button' && text(node) === label) };
}
const batch = mode => ({ id: 'qc-fixture', labId: 'fixture', status: 'OPEN', qcMode: mode, numberFormat: { decimal: '.', thousands: null },
    qcRequirements: { BLANK: { required: 0, source: 'NOT_USED' }, DUPLICATE: { required: mode === 'REQUIRED_BLOCKING' ? 4 : 0, source: 'RULE' },
        CONTROL: { required: mode === 'REQUIRED_BLOCKING' ? 2 : 0, source: 'PROFILE' }, LRM: { required: mode === 'REQUIRED_BLOCKING' ? 2 : 0, source: 'RULE' } } });
const modal = mode => host('src/components/workbench/BatchModal.jsx', { '/api/qc/batches': [batch(mode)] }, { isOpen: true, analysisCode: 'PH_H2O', selectedWorkItemIds: [] });
async function primary(view) {
    for (const [id, value] of [['qc-ctrl-exp-input', '7'], ['qc-ctrl-meas-input', '7'], ['qc-dup1-input', '7'], ['qc-dup2-input', '7.1']]) {
        view.find(id).props.onChange({ target: { value } }); await view.render();
    }
}

test('multi-entry form starts empty, collects four duplicates and two controls, and omits unused blank', async () => {
    const view = modal('REQUIRED_BLOCKING'); await view.render();
    view.find('batch-tab-qc').props.onClick(); await view.render();
    expect(view.find('evaluate-qc-btn').props.disabled).toBe(true);
    expect(view.all().filter(node => String(node.props?.['data-testid'] || '').startsWith('qc-extra-')).every(node => node.props.value === '')).toBe(true);
    await primary(view);
    expect(view.find('evaluate-qc-btn').props.disabled).toBe(true);
    for (const input of view.all().filter(node => String(node.props?.['data-testid'] || '').startsWith('qc-extra-'))) {
        input.props.onChange({ target: { value: '7' } }); await view.render();
    }
    expect(view.find('evaluate-qc-btn').props.disabled).toBe(false);
    await view.find('evaluate-qc-btn').props.onClick();
    const payload = view.axios.post.mock.calls[0][1];
    expect(payload.blanks).toEqual([]); expect(payload.duplicates).toHaveLength(4); expect(payload.controls).toHaveLength(2);
    expect(payload.duplicates[0].rawInput).toEqual({ value1: '7', value2: '7.1' });
});

test.each(['ADVISORY', 'OFF'])('%s offers every type but allows only an explicitly entered optional blank', async mode => {
    const view = modal(mode); await view.render(); view.find('batch-tab-qc').props.onClick(); await view.render();
    expect(view.find('evaluate-qc-btn').props.disabled).toBe(true);
    expect(view.find('qc-add-CONTROL')).toBeDefined(); expect(view.find('qc-add-DUPLICATE')).toBeDefined();
    view.find('qc-blank-input').props.onChange({ target: { value: '0' } }); await view.render();
    expect(view.find('evaluate-qc-btn').props.disabled).toBe(false);
    await view.find('evaluate-qc-btn').props.onClick();
    expect(view.axios.post.mock.calls[0][1]).toMatchObject({ blanks: [{ value: 0 }], controls: [], duplicates: [] });
});

test('an extra partial measurement blocks submission until completed or removed', async () => {
    const view = modal('ADVISORY'); await view.render(); view.find('batch-tab-qc').props.onClick(); await view.render();
    view.find('qc-blank-input').props.onChange({ target: { value: '0' } }); await view.render();
    view.find('qc-add-DUPLICATE').props.onClick(); await view.render();
    view.find('qc-extra-DUPLICATE-0-value1').props.onChange({ target: { value: '7' } }); await view.render();
    expect(view.find('evaluate-qc-btn').props.disabled).toBe(true);
    await view.find('evaluate-qc-btn').props.onClick(); expect(view.axios.post).not.toHaveBeenCalled();
    view.button('policies.remove').props.onClick(); await view.render();
    expect(view.find('evaluate-qc-btn').props.disabled).toBe(false);
});

const Editor = () => null;
const ruleData = { expectedVersion: 4, fieldPolicies: FIELD_POLICIES, versions: [], qcRule: {
    deferredFields: ['maxBatchSize'], resolved: Object.fromEntries(Object.entries(FIELD_POLICIES).map(([field, key]) => [field, { value: registry[key].presets.ISO17025_STRICT, source: 'REGISTRY_DEFAULT' }])) } };
const ruleEditor = canEdit => host('src/components/lab/QcRules.jsx', { '/api/qc/rules': ruleData }, { labId: 'fixture', analysisCode: 'PH_H2O', methodologyId: null, registry, canEdit, Editor });
test('rule editor preserves null inheritance, requires reason, and submits expected version; reset is a new revision', async () => {
    const view = ruleEditor(true); await view.render();
    expect(view.all().filter(node => node.type === 'input' && node.props.type === 'checkbox').every(node => node.props.checked)).toBe(true);
    expect(view.button('policies.save').props.disabled).toBe(true);
    view.find('qc-rule-inherit-duplicateAbsMax').props.onChange({ target: { checked: false } }); await view.render();
    const editor = view.all().find(node => node.type === Editor); expect(editor.props.value).toBe('');
    editor.props.onChange(0.3); await view.render();
    view.find('qc-rule-reason').props.onChange({ target: { value: 'Method precision approved' } }); await view.render();
    await view.all().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    expect(view.axios.post).toHaveBeenCalledWith('/api/qc/rules', expect.objectContaining({ expectedVersion: 4, criteria: expect.objectContaining({ duplicateAbsMax: 0.3, blankPerBatch: null }), reason: 'Method precision approved' }));
    await view.render(); view.find('qc-rule-reason').props.onChange({ target: { value: 'Restore defaults' } }); await view.render();
    await view.find('qc-rule-reset').props.onClick();
    expect(view.axios.post.mock.calls.at(-1)[1]).toMatchObject({ reset: true, reason: 'Restore defaults' });
});
test('read-only rule editor exposes resolution and history without save, reset or editable controls', async () => {
    const view = ruleEditor(false); await view.render();
    expect(view.find('qc-rule-editor')).toBeDefined(); expect(view.button('policies.save')).toBeUndefined();
    expect(view.find('qc-rule-reset')).toBeUndefined(); expect(view.all().filter(node => node.type === 'input')).toHaveLength(0);
    expect(view.axios.post).not.toHaveBeenCalled();
});
test.each(['en', 'es', 'es-419', 'fr', 'pt'])('all new messages, errors and policy descriptions exist in both %s locale layers', locale => {
    const client = require(`../../../client/src/translations/${locale}.json`), server = require(`../../locales/${locale}.json`);
    expect(client.qcRules).toEqual(server.qcRules);
    for (const key of Object.values(FIELD_POLICIES)) expect(typeof client.policies.keys[key.replaceAll('.', '_')]).toBe('string');
    for (const key of ['QC_RULE_VERSION_CONFLICT', 'QC_RULE_POLICY_CONFLICT', 'QC_RULE_MODE_UNSUPPORTED', 'QC_RULE_LOQ_MISSING', 'QC_RULE_IMMUTABLE', 'QC_RULE_SCHEMA_MISMATCH']) expect(typeof client.qcRules.errors[key]).toBe('string');
});
