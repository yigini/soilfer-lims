const fs = require('fs');
const path = require('path');
const vm = require('vm');
const clientRoot = path.resolve(__dirname, '../../../client');
const esbuild = require(path.join(clientRoot, 'node_modules/esbuild'));
const React = require(path.join(clientRoot, 'node_modules/react'));

function modalHost() {
    const hooks = [];
    let cursor = 0;
    let pendingEffects = [];
    const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => value === b[i]);
    const react = { ...React,
        useState(initial) {
            const index = cursor++;
            if (!(index in hooks)) hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
            return [hooks[index].value, value => {
                hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value;
            }];
        },
        useEffect(effect, deps) {
            const index = cursor++;
            if (!sameDeps(hooks[index]?.deps, deps)) pendingEffects.push(effect);
            hooks[index] = { deps };
        },
        useCallback(callback, deps) {
            const index = cursor++;
            if (!sameDeps(hooks[index]?.deps, deps)) hooks[index] = { deps, value: callback };
            return hooks[index].value;
        }
    };
    const axios = {
        get: jest.fn().mockResolvedValue({ data: { data: [
            { id: 'fixture-batch', status: 'OPEN', profile: 'RACK_40', numberFormat: { decimal: '.', thousands: null } },
            { id: 'second-batch', status: 'OPEN', profile: 'RACK_40', numberFormat: { decimal: '.', thousands: null } }
        ] } }),
        post: jest.fn().mockResolvedValue({ data: { status: 'QC_PASS' } }),
        put: jest.fn()
    };
    const load = (file, resolve) => {
        const module = { exports: {} };
        vm.runInNewContext(esbuild.transformSync(fs.readFileSync(file, 'utf8'), { loader: 'jsx', format: 'cjs' }).code,
            { module, exports: module.exports, require: resolve, console });
        return module.exports;
    };
    const parser = load(path.join(clientRoot, 'src/utils/messageFormatter.js'), () => ({}));
    const Component = load(path.join(clientRoot, 'src/components/workbench/BatchModal.jsx'), name => {
        if (name === 'react') return react;
        if (name === 'axios') return axios;
        if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
        if (name.includes('AnalysisCatalogueContext')) return { useAnalysisNames: () => code => code };
        if (name.includes('LanguageContext')) return { useLanguage: () => ({ t: key => key }) };
        if (name.includes('messageFormatter')) return parser;
        if (name === '@lims/number-parse') return require('../../../shared/numberParse');
        if (name === './NumberPreview') return () => null;
        if (name === './NativeRunPanel') return () => null; // Native handlers have separate actual-component contracts.
        throw new Error(`Unexpected component dependency: ${name}`);
    }).default;
    let tree;
    const nodes = node => {
        if (Array.isArray(node)) return node.flatMap(nodes);
        if (!node || typeof node !== 'object') return [];
        return [node, ...nodes(node.props?.children)];
    };
    return {
        axios,
        async render(isOpen = true) {
            for (let i = 0; i < 4; i++) {
                cursor = 0;
                tree = Component({ isOpen, analysisCode: 'PH_H2O', selectedWorkItemIds: [] });
                const effects = pendingEffects;
                pendingEffects = [];
                effects.forEach(effect => effect());
                await new Promise(resolve => setImmediate(resolve));
            }
            return tree;
        },
        find(id) { return nodes(tree).find(node => node.props?.['data-testid'] === id); },
        qcTab() { return nodes(tree).find(node => node.type === 'button' && node.props.children === 'QC Measurements & State'); }
    };
}

describe('Audit 0.15: actual BatchModal censored duplicate entry', () => {
    const enter = async (host, first, second, blank = '0') => {
        await host.render(); host.qcTab().props.onClick(); await host.render();
        for (const [field, value] of Object.entries({ 'qc-blank-input': blank, 'qc-ctrl-exp-input': '7', 'qc-ctrl-meas-input': '7', 'qc-dup1-input': first, 'qc-dup2-input': second })) {
            host.find(field).props.onChange({ target: { value } }); await host.render();
        }
    };
    test.each([[' <loq', '≤0,05 '], ['>100', '100'], ['<0.1', '0.05']])('explicit observations %s / %s reach evaluation with exact original input', async (first, second) => {
        const host = modalHost(); await enter(host, first, second);
        expect(host.find('evaluate-qc-btn').props.disabled).toBe(false);
        await host.find('evaluate-qc-btn').props.onClick();
        expect(host.axios.post).toHaveBeenCalledTimes(1);
        expect(host.axios.post.mock.calls[0][1].duplicates[0].rawInput).toEqual({ value1: first, value2: second });
        expect(host.axios.post.mock.calls[0][1].duplicates[0].value1).toBe(first.trim().toLowerCase() === '<loq' ? '<LOQ' : first);
    });
    test.each([['<0.1', '7', '<0.1'], ['<bad', '7', '0'], ['', '7', '0']])('a censored blank or invalid duplicate never submits (%s / %s / %s)', async (first, second, blank) => {
        const host = modalHost(); await enter(host, first, second, blank);
        expect(host.find('evaluate-qc-btn').props.disabled).toBe(true);
        await host.find('evaluate-qc-btn').props.onClick();
        expect(host.axios.post).not.toHaveBeenCalled();
    });
});
