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

// Reference-entry cases migrated under #188 comment 6052289128; catalogue cases remain unchanged.
const { nativeHost, nativeFixture, enter } = require('../helpers/qcWorksheetUi');
function boundRun() {
    const batch = nativeFixture(); const control = batch.positions.find(row => row.id === 'control-0'); control.kind = 'CRM';
    control.references = [{ id: 'placed-control', analysisCode: 'A', referenceMaterialId: material.id, referenceValueId: 'original-certificate',
        referenceUse: 'CRM', referenceSnapshot: { code: 'ORIGINAL-CERT', lotNumber: 'LOT-A', expected: 7.123456, referenceValueId: 'original-certificate' } }];
    batch.analytes[0].entryEvidence = [{ positionId: 'control-0', expected: 7.123456, limits: { crmAbsWindow: 0.023456789 }, status: null }];
    return batch;
}
test('native control use, expected and limits come from the server; setup disables ineligible lots', async () => {
    const view = nativeHost(boundRun(), { referenceMaterials: [material, { ...material, id: 'expired', eligible: false }] }); await view.render();
    expect(nodes(view.find('native-lot-control-0')).find(node => node.type === 'option' && node.props.value === 'expired').props.disabled).toBe(true);
    expect(content(view.find('native-reference-control-0'))).toContain('CRM');
    expect(content(view.find('native-reference-control-0'))).toContain('ORIGINAL-CERT');
    expect(content(view.find('native-evidence-control-0'))).toContain('7.123456'); expect(content(view.find('native-evidence-control-0'))).toContain('0.023456789');
    expect(nodes(view.find('native-evidence-control-0')).some(node => ['input', 'select', 'textarea'].includes(node.type))).toBe(false);
    await enter(view, { blank: '0', 'control-0': '7.12', 'parent-0': '7', 'duplicate-0': '7' }); await view.find('native-qc-evaluate').props.onClick();
    expect(view.axios.post).toHaveBeenCalledTimes(1);
    const payload = view.axios.post.mock.calls[0][1]; expect(payload.references).toEqual([]);
    expect(payload.measurements.find(row => row.positionId === 'control-0')).toEqual({ positionId: 'control-0', replicateNo: 1, rawInput: '7.12' });
    for (const row of payload.measurements) expect(Object.keys(row).sort()).toEqual(['positionId', 'rawInput', 'replicateNo']);
});
test('re-entry preserves the original bound certificate when the placed lot is ineligible and posts no binding fields', async () => {
    const batch = boundRun(), before = JSON.stringify(batch.positions.find(row => row.id === 'control-0').references);
    const view = nativeHost(batch, { referenceMaterials: [{ ...material, eligible: false, code: 'LIVE-CHANGED', values: [{ assignedValue: 999 }] }] });
    await view.render();
    expect(nodes(view.find('native-lot-control-0')).find(node => node.type === 'option' && node.props.value === material.id).props.disabled).toBe(true);
    expect(content(view.find('native-reference-control-0'))).toContain('ORIGINAL-CERT'); expect(content(view.find('native-evidence-control-0'))).toContain('7.123456');
    await enter(view, { blank: '0', 'control-0': '7.12', 'parent-0': '7', 'duplicate-0': '7' }); await view.find('native-qc-evaluate').props.onClick();
    const payload = view.axios.post.mock.calls[0][1]; expect(payload.references).toEqual([]);
    expect(payload.measurements.every(row => Object.keys(row).sort().join(',') === 'positionId,rawInput,replicateNo')).toBe(true);
    expect(JSON.stringify(batch.positions.find(row => row.id === 'control-0').references)).toBe(before);
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
