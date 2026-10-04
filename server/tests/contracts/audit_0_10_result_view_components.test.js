const fs = require('fs');
const path = require('path');
const vm = require('vm');
const esbuild = require('../../../client/node_modules/esbuild');
const React = require('../../../client/node_modules/react');

function elements(tree, predicate) {
    if (Array.isArray(tree)) return tree.flatMap(node => elements(node, predicate));
    if (!tree || typeof tree !== 'object') return [];
    return [...(predicate(tree) ? [tree] : []), ...elements(tree.props?.children, predicate)];
}

// Exercise real JSX and callbacks with persistent hook state; providers and
// child visualizations are boundaries, so no browser or database is modified.
function harness(relativePath, { initialStates = {}, axios = {}, browser = {} } = {}) {
    const states = [], Link = () => null;
    let cursor = 0;
    const hooks = { ...React,
        useState(initial) {
            const index = cursor++;
            if (!(index in states)) states[index] = Object.prototype.hasOwnProperty.call(initialStates, index)
                ? initialStates[index] : typeof initial === 'function' ? initial() : initial;
            return [states[index], update => { states[index] = typeof update === 'function' ? update(states[index]) : update; }];
        },
        useEffect: () => {}, useCallback: fn => fn, useRef: initial => ({ current: initial })
    };
    const filename = path.resolve(__dirname, '../../../client/src', relativePath), module = { exports: {} };
    const source = esbuild.transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs' }).code;
    vm.runInNewContext(source, { module, exports: module.exports, console, Blob, ...browser,
        require: name => {
            if (name === 'react') return hooks;
            if (name === 'axios') return axios;
            if (name === 'react-router-dom') return { Link };
            if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
            if (name.includes('AuthContext')) return { useAuth: () => ({ user: { role: 'LAB_MANAGER' }, token: 'test' }) };
            if (name.includes('LanguageContext')) return { useLanguage: () => ({ t: (_, fallback) => fallback }) };
            if (name.includes('DialogContext')) return { useDialog: () => ({ showDialog() {} }) };
            if (name.includes('NotificationContext')) return { useNotifications: () => ({ subscribeToEvent() {} }) };
            if (name === 'xlsx') return {};
            return () => null;
        }
    });
    return { Link, render(props = {}) { cursor = 0; return module.exports.default(props); } };
}

describe('Audit 0.10: downloaded header and replicate navigation', () => {
    test('the actual CSV download includes the selection warning before unchanged column names and values', async () => {
        const note = 'Replicates: arithmetic mean of current valid replicates; repeatability (r) check not yet applied.';
        let downloaded;
        const link = { setAttribute: jest.fn(), click: jest.fn() };
        const response = { success: true, columns: ['Sample ID', 'SOC', 'soc_n', 'soc_flag'],
            data: [{ 'Sample ID': 'sample-a', SOC: 15, soc_n: 2, soc_flag: 'MEAN_UNCHECKED' }],
            meta: { exportId: 'EXP-010', recordCount: 1, headerNotes: [note] } };
        const axios = { post: jest.fn().mockResolvedValue({ data: response }) };
        const h = harness('components/common/ExportModal.jsx', { axios,
            browser: { URL: { createObjectURL: blob => { downloaded = blob; return 'blob:test'; } },
                document: { createElement: () => link, body: { appendChild() {}, removeChild() {} } } } });
        const props = { isOpen: true, currentFilters: {} };
        const generate = elements(h.render(props), node => node.type === 'button' && [].concat(node.props.children).some(child => typeof child === 'string' && child.trim() === 'Generate Export'))[0];
        await generate.props.onClick();
        const download = elements(h.render(props), node => node.type === 'button' && [].concat(node.props.children).some(child => typeof child === 'string' && child.trim() === 'Download CSV'))[0];
        download.props.onClick();
        expect(await downloaded.text()).toBe(`# ${note}\nSample ID,SOC,soc_n,soc_flag\nsample-a,15,2,MEAN_UNCHECKED`);
        expect(link.click).toHaveBeenCalledTimes(1);
        expect(link.setAttribute).toHaveBeenCalledWith('download', 'EXP-010_LIST.csv');
    });
    test('separate replicate rows retain distinct keys while sample and spectrum links use the sample identifier', async () => {
        const rows = [1, 2].map(replicateNo => ({ id: `sample-a:result-${replicateNo}`, sampleId: 'sample-a',
            labId: 'LAB-A', originalId: 'ORIGINAL-A', replicateNo, SOC: replicateNo * 10, SPEC_MIR: 'Spectrum Uploaded' }));
        const columns = [{ key: 'labId', label: 'Lab ID' }, { key: 'replicateNo', label: 'Replicate' },
            { key: 'SOC', label: 'SOC', isResult: true }, { key: 'SPEC_MIR', label: 'MIR', isResult: true }];
        const axios = { get: jest.fn().mockResolvedValue({ data: { data: [] } }) };
        const h = harness('pages/DataResults.jsx', { initialStates: { 0: rows, 1: columns, 2: false }, axios });
        const tree = h.render();
        expect(elements(tree, node => node.type === 'tr' && String(node.key).startsWith('sample-a:')).map(node => node.key)).toEqual(rows.map(row => row.id));
        expect(elements(tree, node => node.type === h.Link).map(node => node.props.to)).toEqual(['/samples/sample-a', '/samples/sample-a']);
        expect(elements(tree, node => node.type === 'td' && node.props.children === 2)).toHaveLength(1);
        const spectra = elements(tree, node => node.type === 'div' && node.props.onClick &&
            elements(node, el => el.props?.text === 'View Spectrum').length);
        expect(spectra).toHaveLength(2);
        await spectra[1].props.onClick();
        expect(axios.get).toHaveBeenCalledWith('/api/spectral', { params: { sampleId: 'sample-a', search: 'sample-a', modality: 'MIR' } });
    });
});
