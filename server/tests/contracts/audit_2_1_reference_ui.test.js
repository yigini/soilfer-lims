const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const clientRoot = path.resolve(__dirname, '../../../client');
const React = require(path.join(clientRoot, 'node_modules/react'));
const esbuild = require(path.join(clientRoot, 'node_modules/esbuild'));
const t = key => key;
const material = { id: 'owned-reference', labId: 'owned-lab', code: 'CHECK', name: 'Owned check soil', kind: 'CRM', status: 'ACTIVE',
    lotNumber: 'LOT-A', eligible: true, daysToExpiry: 5, expiryWarning: true, values: [{ id: 'owned-value', analysisCode: 'PH_H2O',
        assignedValue: 7.123456, unit: 'pH', expandedUncertainty: 0.02, coverageFactor: 2.5, valueType: 'CERTIFIED', supersededById: null }] };
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : !node || typeof node !== 'object' ? [] : [node, ...nodes(node.props?.children)];
const content = node => Array.isArray(node) ? node.map(content).join('') : !node || typeof node !== 'object' ? String(node ?? '') : content(node.props?.children);

// Run the actual components and event handlers, with asynchronous hooks and API responses.
function host(file, { canEdit = true, savedControl = null, materials = [material] } = {}) {
    const hooks = [], effects = [];
    let cursor = 0, tree;
    const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => value === b[index]);
    const react = { ...React,
        useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
            return [hooks[index].value, value => { hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value; }]; },
        useEffect(effect, deps) { const index = cursor++; if (!equal(hooks[index]?.deps, deps)) effects.push(effect); hooks[index] = { deps }; },
        useCallback(callback, deps) { const index = cursor++; if (!equal(hooks[index]?.deps, deps)) hooks[index] = { deps, value: callback }; return hooks[index].value; }
    };
    const batch = { id: 'owned-batch', labId: 'owned-lab', status: 'OPEN', profile: 'RACK_40',
        numberFormat: { decimal: '.', thousands: null }, qcResults: JSON.stringify({ controls: savedControl ? [savedControl] : [] }) };
    const axios = { get: jest.fn(async url => ({ data: { data: url === '/api/reference-materials' ? materials : url === '/api/qc/batches' ? [batch] :
        url === '/api/labs' ? [{ id: 'owned-lab', code: 'OWNED', name: 'Owned lab' }] : [] } })),
        post: jest.fn().mockResolvedValue({ data: { data: { ...material, id: 'new-revision' }, status: 'QC_PASS' } }),
        patch: jest.fn().mockResolvedValue({ data: { data: material } }), put: jest.fn() };
    const module = { exports: {} };
    vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.join(clientRoot, file), 'utf8'), { loader: 'jsx', format: 'cjs' }).code,
        { module, exports: module.exports, console, require(name) {
            if (name === 'react') return react;
            if (name === 'axios') return axios;
            if (name.includes('LanguageContext')) return { useLanguage: () => ({ t }) };
            if (name.includes('AuthContext')) return { useAuth: () => ({ user: { labId: 'owned-lab' }, hasPermission: () => canEdit }) };
            if (name.includes('AnalysisCatalogueContext')) return { useAnalysisNames: () => code => code };
            if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
            if (name === '@lims/number-parse') return require('../../../shared/numberParse');
            if (name === './NumberPreview') return () => null;
            if (name === './NativeRunPanel') return () => null; // These retained contracts exercise the profile form.
            throw new Error(`Unexpected reference component dependency: ${name}`);
        } });
    return { axios,
        async render() { for (let round = 0; round < 6; round++) { cursor = 0; tree = module.exports.default({ isOpen: true, analysisCode: 'PH_H2O', selectedWorkItemIds: [] });
            effects.splice(0).forEach(effect => effect()); await new Promise(resolve => setImmediate(resolve)); } return tree; },
        all() { return nodes(tree); },
        find(id) { return nodes(tree).find(node => node.props?.['data-testid'] === id); },
        button(label) { return nodes(tree).find(node => node.type === 'button' && content(node) === label); },
        field(key) { const label = nodes(tree).filter(node => node.type === 'label' && node.props.children?.[0] === `referenceMaterials.${key}`).at(-1);
            return nodes(label).find(node => node.type === 'input' || node.type === 'select'); }
    };
}

test('reference catalogue lists lot expiry and warnings without exposing writes to a read-only user', async () => {
    const view = host('src/components/admin/ReferenceMaterials.jsx', { canEdit: false });
    const tree = await view.render();
    expect(content(tree)).toContain('LOT-A'); expect(content(tree)).toContain('5'); expect(content(tree)).toContain('referenceMaterials.expiryWarning');
    expect(view.button('referenceMaterials.addMaterial')).toBeUndefined();
    view.button('CHECK · Owned check soil').props.onClick(); await view.render();
    expect(content(view.all())).toContain('7.123456'); expect(content(view.all())).toContain('2.5');
    expect(view.button('referenceMaterials.correct')).toBeUndefined(); expect(view.all().filter(node => node.type === 'form')).toHaveLength(0);
    expect(view.axios.get).toHaveBeenCalledTimes(1); expect(view.axios.post).not.toHaveBeenCalled();
});

test('certificate correction requires a reason and posts a new revision while preserving the method and analyte', async () => {
    const view = host('src/components/admin/ReferenceMaterials.jsx'); await view.render();
    view.button('CHECK · Owned check soil').props.onClick(); await view.render();
    view.button('referenceMaterials.correct').props.onClick(); await view.render();
    expect(view.field('analysisCode')).toBeUndefined(); expect(view.field('methodologyId')).toBeUndefined();
    expect(view.field('reason').props.required).toBe(true); expect(view.field('coverageFactor').props.required).toBe(true);
    view.field('assignedValue').props.onChange({ target: { value: '7.25' } }); await view.render();
    view.field('reason').props.onChange({ target: { value: 'Certificate transcription' } }); await view.render();
    await view.all().filter(node => node.type === 'form').at(-1).props.onSubmit({ preventDefault() {} });
    expect(view.axios.post).toHaveBeenCalledWith('/api/reference-materials/owned-reference/values/owned-value/correct', expect.objectContaining({
        analysisCode: 'PH_H2O', methodologyId: '', assignedValue: '7.25', coverageFactor: 2.5, reason: 'Certificate transcription' }));
    expect(material.values[0].assignedValue).toBe(7.123456);
});

test('manual status change requires a reason and uses the audited status endpoint', async () => {
    const view = host('src/components/admin/ReferenceMaterials.jsx'); await view.render();
    view.button('CHECK · Owned check soil').props.onClick(); await view.render();
    expect(view.field('reason').props.required).toBe(true);
    view.field('status').props.onChange({ target: { value: 'QUARANTINED' } }); await view.render();
    view.field('reason').props.onChange({ target: { value: 'Damaged seal' } }); await view.render();
    await view.all().find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
    expect(view.axios.patch).toHaveBeenCalledWith('/api/reference-materials/owned-reference/status', { status: 'QUARANTINED', reason: 'Damaged seal' });
});

async function measurements(view) {
    for (const [id, value] of [['qc-blank-input', '0'], ['qc-ctrl-meas-input', '7.12'], ['qc-dup1-input', '7'], ['qc-dup2-input', '7']]) {
        view.find(id).props.onChange({ target: { value } }); await view.render();
    }
}
test('linked QC requires explicit use, derives expected on the server, and disables ineligible new lots', async () => {
    const view = host('src/components/workbench/BatchModal.jsx', { materials: [material, { ...material, id: 'expired', eligible: false }] });
    await view.render(); view.button('QC Measurements & State').props.onClick(); await view.render();
    expect(nodes(view.find('qc-reference-material')).find(node => node.type === 'option' && node.props.value === 'expired').props.disabled).toBe(true);
    view.find('qc-reference-material').props.onChange({ target: { value: material.id } }); await view.render(); await measurements(view);
    expect(view.find('qc-ctrl-exp-input').props.disabled).toBe(true); expect(view.find('evaluate-qc-btn').props.disabled).toBe(true);
    await view.find('evaluate-qc-btn').props.onClick(); expect(view.axios.post).not.toHaveBeenCalled();
    view.find('qc-reference-use').props.onChange({ target: { value: 'CRM' } }); await view.render();
    expect(view.find('evaluate-qc-btn').props.disabled).toBe(false); await view.find('evaluate-qc-btn').props.onClick();
    const control = view.axios.post.mock.calls[0][1].controls[0];
    expect(control).toEqual({ referenceMaterialId: material.id, referenceUse: 'CRM', measured: 7.12, rawInput: { expected: null, measured: '7.12' } });
    expect(Object.hasOwn(control, 'expected')).toBe(false); expect(Object.hasOwn(control, 'methodologyId')).toBe(false);
});

test('re-evaluation keeps a saved value id and control identity after the placed lot becomes ineligible', async () => {
    const view = host('src/components/workbench/BatchModal.jsx', { materials: [{ ...material, eligible: false }],
        savedControl: { id: 'placed-control', referenceMaterialId: material.id, referenceValueId: 'original-certificate', referenceUse: 'CRM' } });
    await view.render(); view.button('QC Measurements & State').props.onClick(); await view.render(); await measurements(view);
    expect(nodes(view.find('qc-reference-material')).find(node => node.type === 'option' && node.props.value === material.id).props.disabled).toBe(false);
    await view.find('evaluate-qc-btn').props.onClick();
    expect(view.axios.post.mock.calls[0][1].controls[0]).toMatchObject({ id: 'placed-control', referenceValueId: 'original-certificate', referenceUse: 'CRM' });
});

test.each(['en', 'es', 'es-419', 'fr', 'pt'])('reference strings and server rule codes are translated in %s', locale => {
    const client = JSON.parse(fs.readFileSync(path.join(clientRoot, `src/translations/${locale}.json`), 'utf8'));
    const server = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../locales/${locale}.json`), 'utf8'));
    const english = JSON.parse(fs.readFileSync(path.join(clientRoot, 'src/translations/en.json'), 'utf8')).referenceMaterials;
    const keys = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) => typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`]).sort();
    expect(keys(client.referenceMaterials)).toEqual(keys(english)); expect(keys(server.referenceMaterials)).toEqual(keys(english));
    const codes = [...new Set(['referenceMaterialService', 'referencePlacementService'].flatMap(name =>
        [...fs.readFileSync(path.resolve(__dirname, `../../services/${name}.js`), 'utf8').matchAll(/throw error\([\s\S]*?\);/g)]
            .flatMap(match => [...match[0].matchAll(/'(REFERENCE_[A-Z_]+)'/g)].map(code => code[1]))))];
    for (const code of codes) expect(client.referenceMaterials.errors[code]).toEqual(expect.any(String));
    expect(client.policies.keys.referenceMaterials_expiryWarningDays).toEqual(expect.any(String));
    expect(server.policies.keys.referenceMaterials_expiryWarningDays).toEqual(expect.any(String));
});
