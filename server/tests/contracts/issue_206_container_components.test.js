const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const esbuild = require('../../../client/node_modules/esbuild'), React = require('../../../client/node_modules/react');
const root = path.resolve(__dirname, '../../../client/src');
const english = JSON.parse(fs.readFileSync(path.join(root, 'translations/en.json'), 'utf8'));
const t = key => key.split('.').reduce((value, part) => value?.[part], english) ?? key;
function render(file, props, values = [], dependencies = {}) {
    let cursor = 0; const effects = [], setters = [];
    const hooks = { ...React, useCallback: value => value, useEffect: effect => effects.push(effect), useState: initial => {
        const index = cursor++, setter = jest.fn(value => { values[index] = value; }); setters[index] = setter;
        return [index in values ? values[index] : initial, setter];
    } };
    const module = { exports: {} };
    vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.join(root, file), 'utf8'), { loader: 'jsx', format: 'cjs' }).code,
        { React: hooks, module, exports: module.exports, document: { body: {} }, window: { print: jest.fn() }, require: name => {
            if (name === 'react') return hooks;
            if (name.includes('LanguageContext')) return { useLanguage: () => ({ t }) };
            if (name.includes('AuthContext')) return { useAuth: () => ({ hasPermission: () => false }) };
            if (name in dependencies) return dependencies[name];
            if (name === 'axios') return { get: jest.fn(), post: jest.fn() };
            if (name === './ContainerLabelDialog') return () => null;
            throw Error('Unmocked container dependency ' + name);
        } });
    return { tree: module.exports.default(props), effects, setters };
}
function elements(tree, predicate) {
    if (Array.isArray(tree)) return tree.flatMap(child => elements(child, predicate));
    if (!tree?.props) return [];
    return [...(predicate(tree) ? [tree] : []), ...elements(tree.props.children, predicate)];
}
test('sample detail renders the physical hierarchy and the linked attempt without implying a legacy backfill', () => {
    const rows = [{ id: 'bulk', parentId: null, kind: 'BULK', code: 'C-BULK', createdBy: 'operator', createdAt: '2026-10-13T09:00:00Z', status: 'ACTIVE' },
        { id: 'fine', parentId: 'bulk', kind: 'FINE_EARTH', code: 'C-FINE', createdBy: 'operator', createdAt: '2026-10-13T09:01:00Z', status: 'ACTIVE' },
        { id: 'aliquot', parentId: 'fine', kind: 'ALIQUOT', code: 'C-ALIQUOT', createdBy: 'operator', createdAt: '2026-10-13T09:02:00Z', status: 'ACTIVE' }];
    const { tree } = render('components/sample/SampleContainersPanel.jsx', { sampleId: 'sample', attempts: [{ id: 'attempt-new', attemptNo: 2, aliquotId: 'aliquot' }, { id: 'legacy', attemptNo: 1 }] }, [rows]);
    const nodes = elements(tree, row => row.type === 'li');
    expect(nodes.map(row => row.key)).toEqual(['bulk', 'fine', 'aliquot']);
    expect(elements(nodes[0], row => row.type === 'li').length).toBe(3);
    const text = JSON.stringify(tree);
    expect(text).toContain('attempt-new'); expect(text).not.toContain('legacy');
    expect(elements(tree, row => row.type === 'button').map(row => row.props.children)).toEqual(Array(3).fill('Print container label'));
});
test('aliquot selector never lists bulk or disposed material and emits the explicit chosen identity', async () => {
    const get = jest.fn().mockResolvedValue({ data: { containers: [{ id: 'new', kind: 'ALIQUOT', status: 'ACTIVE', code: 'C-NEW' },
        { id: 'old', kind: 'ALIQUOT', status: 'DISPOSED' }, { id: 'bulk', kind: 'BULK', status: 'ACTIVE' }] } });
    const onChange = jest.fn();
    const view = render('components/sample/AliquotSelect.jsx', { sampleId: 'sample/id', onChange }, [[], false], { axios: { get } });
    view.effects[0](); await Promise.resolve(); await Promise.resolve();
    expect(get).toHaveBeenCalledWith('/api/samples/sample%2Fid/containers');
    const rows = view.setters[0].mock.calls.at(-1)[0]; expect(rows.map(row => row.id)).toEqual(['new']);
    const { tree } = render('components/sample/AliquotSelect.jsx', { sampleId: 'sample/id', onChange }, [rows, false]);
    const select = elements(tree, row => row.type === 'select')[0];
    expect(elements(select, row => row.type === 'option').map(row => row.props.value)).toEqual(['', 'new']);
    select.props.onChange({ target: { value: 'new' } }); expect(onChange).toHaveBeenCalledWith('new');
    select.props.onChange({ target: { value: '' } }); expect(onChange).toHaveBeenLastCalledWith(null);
});
test('offline label QR encodes the issued container code and the printed card identifies its parent sample', async () => {
    const toDataURL = jest.fn().mockResolvedValue('data:image/png;base64,fixture');
    const props = { container: { code: 'C-ISSUED-7', kind: 'ALIQUOT', massG: 10 }, sampleCode: 'SAMPLE-8', onClose: jest.fn() };
    const dependencies = { qrcode: { toDataURL }, 'react-dom': { createPortal: child => child } };
    const view = render('components/sample/ContainerLabelDialog.jsx', props, ['', false], dependencies);
    view.effects[0](); await Promise.resolve();
    expect(toDataURL).toHaveBeenCalledWith('C-ISSUED-7', { width: 240, margin: 1 });
    const { tree } = render('components/sample/ContainerLabelDialog.jsx', props, ['data:image/png;base64,fixture', false], dependencies);
    expect(JSON.stringify(tree)).toContain('SAMPLE-8');
    const print = elements(tree, row => row.type === 'button' && row.props.children === 'Print container label')[0];
    expect(print.props.disabled).toBe(false);
    expect(elements(tree, row => row.type === 'img').every(row => row.props.alt === 'C-ISSUED-7')).toBe(true);
});
test.each(['en', 'es', 'es-419', 'fr', 'pt'])('container labels, kinds and policy keys are present in both %s catalogues', locale => {
    for (const directory of [root + '/translations', path.resolve(__dirname, '../../locales')]) {
        const catalogue = JSON.parse(fs.readFileSync(path.join(directory, locale + '.json'), 'utf8'));
        for (const key of Object.keys(english.containers)) expect(catalogue.containers[key]).toBeTruthy();
        for (const kind of require('../../services/sampleContainerService').KINDS) expect(catalogue.containers.kinds[kind].trim()).not.toBe('');
        expect(catalogue.policies.keys.container_codeFormat.trim()).not.toBe('');
        expect(catalogue.policies.keys.container_sequenceReset.trim()).not.toBe('');
    }
});
