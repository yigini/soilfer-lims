const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const React = require('../../../client/node_modules/react'), esbuild = require('../../../client/node_modules/esbuild');
const { nodes, content } = require('../helpers/qcWorksheetUi');

function host({ allowed = true, hold = false } = {}) {
    const hooks = [], effects = [], requests = [];
    let cursor = 0, tree, props = { batch: { id: 'synthetic-run' }, analysisCode: 'A' };
    const react = { ...React,
        useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = { value: initial }; return [hooks[i].value, value => { hooks[i].value = value; }]; },
        useRef(value) { const i = cursor++; return hooks[i] || (hooks[i] = { current: value }); },
        useEffect(fn, deps) { const i = cursor++; if (!hooks[i]?.deps?.every((value, index) => value === deps[index])) {
            const old = hooks[i]; hooks[i] = { deps }; effects.push(() => { old?.cleanup?.(); hooks[i].cleanup = fn(); });
        } }
    };
    const pdf = () => ({ headers: { 'content-type': 'application/pdf' }, data: new Blob(['synthetic PDF bytes'], { type: 'application/pdf' }) });
    const axios = { get: jest.fn(() => hold ? new Promise((resolve, reject) => requests.push({ resolve, reject })) : Promise.resolve(pdf())) };
    const link = { click: jest.fn(), remove: jest.fn() };
    const document = { createElement: jest.fn(() => link), body: { appendChild: jest.fn() } };
    const URL = { createObjectURL: jest.fn(() => 'blob:synthetic-worksheet'), revokeObjectURL: jest.fn() };
    const module = { exports: {} };
    vm.runInNewContext(esbuild.transformSync(fs.readFileSync(path.resolve(__dirname, '../../../client/src/components/workbench/RunWorksheetDownload.jsx'), 'utf8'), { loader: 'jsx', format: 'cjs' }).code,
        { module, exports: module.exports, AbortController, document, URL, setTimeout: fn => fn(), require(name) {
            if (name === 'react') return react;
            if (name === 'axios') return axios;
            if (name === 'lucide-react') return { FileDown: () => null };
            if (name.includes('LanguageContext')) return { useLanguage: () => ({ t: key => key }) };
            if (name.includes('AuthContext')) return { useAuth: () => ({ hasPermission: () => allowed }) };
            throw Error('Unexpected download import ' + name);
        } });
    return { axios, URL, link, document, requests, pdf,
        async render(next = {}) { props = { ...props, ...next }; for (let i = 0; i < 4; i++) {
            cursor = 0; tree = module.exports.default(props); effects.splice(0).forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve));
        } },
        button: () => nodes(tree).find(node => node.type === 'button'), text: () => content(tree),
        unmount: () => hooks.forEach(hook => hook?.cleanup?.())
    };
}

test('download uses the selected run/analyte and existing authenticated axios, and releases the temporary URL', async () => {
    const view = host(); await view.render();
    await view.button().props.onClick(); await view.render();
    expect(view.axios.get).toHaveBeenCalledWith('/api/workbench/runs/synthetic-run/worksheet.pdf', expect.objectContaining({
        responseType: 'blob', params: { analysisCode: 'A' }, signal: expect.any(AbortSignal)
    }));
    expect(view.link.click).toHaveBeenCalledTimes(1);
    expect(view.link.download).toBe('run-worksheet.pdf');
    expect(view.URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic-worksheet');
    expect(view.link.remove).toHaveBeenCalledTimes(1);
    expect(view.button().props.disabled).toBe(false);
});

test('changing runs aborts the request and a late reply cannot download another run or leave loading stuck', async () => {
    const view = host({ hold: true }); await view.render();
    const pending = view.button().props.onClick();
    view.button().props.onClick();
    expect(view.axios.get).toHaveBeenCalledTimes(1);
    await view.render({ batch: { id: 'new-run' }, analysisCode: 'B' });
    expect(view.axios.get.mock.calls[0][1].signal.aborted).toBe(true);
    view.requests[0].resolve(view.pdf()); await pending; await view.render();
    expect(view.URL.createObjectURL).not.toHaveBeenCalled();
    expect(view.link.click).not.toHaveBeenCalled();
    expect(view.button().props.disabled).toBe(false);
});

test('a JSON error returned as a Blob stays visible and never downloads a file', async () => {
    const view = host(); await view.render();
    view.axios.get.mockRejectedValueOnce({ response: { data: new Blob([JSON.stringify({ code: 'WORKSHEET_ANALYTE_REQUIRED', error: 'Choose the analyte first.' })]) } });
    await view.button().props.onClick(); await view.render();
    expect(view.text()).toContain('Choose the analyte first.');
    expect(view.link.click).not.toHaveBeenCalled();
    expect(view.button().props.disabled).toBe(false);
});

test('an HTML success response is refused as a PDF, and unpermitted actors have no download control', async () => {
    const view = host(); await view.render();
    view.axios.get.mockResolvedValueOnce({ headers: { 'content-type': 'text/html' }, data: new Blob(['not a PDF']) });
    await view.button().props.onClick(); await view.render();
    expect(view.text()).toContain('benchErgonomics.pdfUnexpected');
    expect(view.link.click).not.toHaveBeenCalled();
    const denied = host({ allowed: false }); await denied.render();
    expect(denied.button()).toBeUndefined();
    expect(denied.axios.get).not.toHaveBeenCalled();
});
