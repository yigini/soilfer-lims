const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { JSDOM } = require('jsdom');
const React = require('../../../client/node_modules/react');
const esbuild = require('../../../client/node_modules/esbuild');
const english = require('../../../client/src/translations/en.json');
const t = (key, fallback) => key.split('.').reduce((value, part) => value?.[part], english) ?? fallback ?? key;
const code = 'LABEL-LAB-26-000001R';
const source = path.resolve(__dirname, '../../../client/src/components/common/LabelPrintDialog.jsx');
let dom, root, axios, qr, print, component, cache;
const descriptor = (overrides = {}) => ({ entity: 'SAMPLE', entityId: 'persisted', sampleId: 'persisted', sampleCode: code,
    code, count: 1, reprint: false, sample: { id: 'persisted', labSampleCode: code, originalId: 'FIELD-1', assignedLab: 'LABEL-LAB' }, ...overrides });
function load(filename) {
    if (cache[filename]) return cache[filename];
    const module = { exports: {} };
    vm.runInNewContext(esbuild.transformSync(fs.readFileSync(filename, 'utf8'), { loader: filename.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs' }).code,
        { module, exports: module.exports, console, window, document, require: name => {
            if (name === 'react') return React;
            if (name === 'react-dom') return require('../../../client/node_modules/react-dom');
            if (name === 'axios') return axios;
            if (name === 'qrcode') return { toDataURL: qr };
            if (name === 'jsbarcode') return require('../../../client/node_modules/jsbarcode');
            if (name.includes('LanguageContext')) return { useLanguage: () => ({ t }) };
            return load(path.resolve(path.dirname(filename), name + (name.endsWith('labelBarcode') ? '.js' : '.jsx')));
        } });
    return cache[filename] = module.exports;
}
beforeEach(() => {
    dom = new JSDOM('<title>Workspace</title><div id="root"></div>', { url: 'http://localhost' });
    global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
    global.IS_REACT_ACT_ENVIRONMENT = true;
    root = require('../../../client/node_modules/react-dom/client').createRoot(document.getElementById('root'));
    qr = jest.fn(async () => 'data:image/png;base64,fixture');
    axios = { get: jest.fn(async () => ({ data: { branding: { title: 'Test lab' } } })),
        post: jest.fn(async url => ({ data: url.endsWith('/preview') ? { labels: [descriptor()] } : { labels: [descriptor()], events: [{ id: 'event' }] } })) };
    print = jest.fn(); window.print = print; cache = {}; component = load(source).default;
});
afterEach(async () => {
    await React.act(async () => root.unmount()); dom.window.close();
    delete global.window; delete global.document; delete global.navigator; delete global.IS_REACT_ACT_ENVIRONMENT;
});
const settle = async () => { for (let index = 0; index < 5; index++) await new Promise(resolve => setImmediate(resolve)); };
async function mount(props = {}) {
    await React.act(async () => { root.render(React.createElement(component, { isOpen: true, onClose: () => {}, sample: { id: 'persisted', labId: 'CLIENT-ALIAS-MUST-NOT-PRINT' }, ...props })); await settle(); });
}
const clickPrint = async () => React.act(async () => { document.querySelector('[data-testid="label-print"]').click(); await settle(); });

test('both barcode payloads use the authoritative issued code; printing waits for its recorded event and then removes printable content', async () => {
    let finish;
    axios.post.mockImplementation(async url => url.endsWith('/preview') ? { data: { labels: [descriptor()] } } : new Promise(resolve => { finish = resolve; }));
    await mount();
    expect(qr).toHaveBeenCalledWith(code, expect.objectContaining({ errorCorrectionLevel: 'M' }));
    const svg = document.querySelector('svg[data-code]');
    expect(svg.dataset.code).toBe(code); expect(svg.querySelectorAll('rect').length).toBeGreaterThan(20);
    expect(document.body.textContent).not.toContain('CLIENT-ALIAS-MUST-NOT-PRINT');
    expect(document.getElementById('label-print-portal')).toBeNull();
    await clickPrint(); expect(print).not.toHaveBeenCalled();
    expect(document.getElementById('label-print-portal')).toBeNull();
    print.mockImplementation(() => {
        const portal = document.getElementById('label-print-portal');
        expect(portal.querySelectorAll('.sample-label-page')).toHaveLength(1);
        expect(portal.querySelector('svg').dataset.code).toBe(code);
        expect(portal.querySelector('img').getAttribute('alt')).toBe(`QR ${code}`);
    });
    await React.act(async () => { finish({ data: { labels: [descriptor()], events: [{ id: 'event' }] } }); await settle(); });
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.getElementById('label-print-portal')).toBeNull();
    expect(document.title).toBe('Workspace');
    expect(document.querySelector('textarea')).not.toBeNull();
    expect(document.querySelector('[data-testid="label-print"]').disabled).toBe(true);
});

test('a reprint blocks auto-print and blank reasons; a reason is sent before printing the aliquot label', async () => {
    const label = descriptor({ entity: 'CONTAINER', entityId: 'aliquot', container: { id: 'aliquot', kind: 'ALIQUOT' }, reprint: true });
    axios.post.mockResolvedValue({ data: { labels: [label], events: [{ id: 'event' }] } });
    await mount({ sample: undefined, container: { id: 'aliquot', sampleId: 'persisted', code: 'UNTRUSTED' }, autoPrint: true });
    expect(print).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Aliquot');
    const button = document.querySelector('[data-testid="label-print"]'); expect(button.disabled).toBe(true);
    const textarea = document.querySelector('textarea');
    await React.act(async () => {
        require('../../../client/node_modules/react-dom/test-utils').Simulate.change(textarea, { target: { value: 'Damaged tube label' } });
    });
    expect(button.disabled).toBe(false);
    await clickPrint();
    expect(axios.post).toHaveBeenLastCalledWith('/api/samples/labels/print', { items: [{ entity: 'CONTAINER', entityId: 'aliquot', count: 1 }], format: 'STANDARD', reason: 'Damaged tube label' });
    expect(print).toHaveBeenCalledTimes(1);
});

test('a refused event creates no printable DOM or browser print, including a concurrent reprint refusal', async () => {
    axios.post.mockImplementation(async url => {
        if (url.endsWith('/preview')) return { data: { labels: [descriptor()] } };
        throw { response: { data: { code: 'LABEL_REPRINT_REASON_REQUIRED' } } };
    });
    await mount(); await clickPrint();
    expect(print).not.toHaveBeenCalled(); expect(document.getElementById('label-print-portal')).toBeNull();
    expect(document.querySelector('[role="alert"]').textContent).toBe(english.labelPrint.errors.LABEL_REPRINT_REASON_REQUIRED);
    expect(document.querySelector('textarea')).not.toBeNull();
});

test('an old recorded request cannot open printing after the dialog has closed and reopened', async () => {
    let finish;
    axios.post.mockImplementation(async url => url.endsWith('/preview') ? { data: { labels: [descriptor()] } } : new Promise(resolve => { finish = resolve; }));
    await mount(); await clickPrint();
    await React.act(async () => { root.render(React.createElement(component, { isOpen: false })); });
    await mount();
    await React.act(async () => { finish({ data: { labels: [descriptor()], events: [{ id: 'old-event' }] } }); await settle(); });
    expect(print).not.toHaveBeenCalled();
    expect(document.getElementById('label-print-portal')).toBeNull();
});

test('a long issued code requires standard stock instead of shrinking compact bars or shortening the identity', async () => {
    await mount();
    const select = document.querySelector('select');
    expect(document.querySelector('[data-testid="label-print"]').disabled).toBe(false);
    await React.act(async () => require('../../../client/node_modules/react-dom/test-utils').Simulate.change(select, { target: { value: 'COMPACT' } }));
    expect(document.querySelector('[data-testid="label-print"]').disabled).toBe(true);
    expect(document.querySelector('[role="alert"]').textContent).toBe(english.labelPrint.tooLong);
    expect(document.querySelector('svg').dataset.code).toBe(code);
    expect(axios.post.mock.calls.every(([url]) => url.endsWith('/preview'))).toBe(true);
});

test('compact sample and container cards both include QR and Code128 with the same issued identity', () => {
    const cards = load(source);
    for (const name of ['StandardLabelCard', 'CompactLabelCard']) {
        const label = descriptor({ container: { id: 'aliquot', kind: 'ALIQUOT' }, sampleCode: 'PARENT-42' });
        const element = React.createElement(cards[name], { sample: { ...label.sample, labelCode: code, container: label.container, sampleCode: label.sampleCode }, qrDataUrl: 'data:image/png;base64,fixture' });
        const html = require('../../../client/node_modules/react-dom/server').renderToStaticMarkup(element);
        expect(html).toContain(`data-code="${code}"`); expect(html).toContain(`alt="QR ${code}"`); expect(html).toContain('Aliquot');
        expect(html).toContain('PARENT-42');
    }
});

test('all label strings and stable refusal texts exist in all five client and server locales', () => {
    for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
        const client = require(`../../../client/src/translations/${locale}.json`).labelPrint;
        const server = require(`../../locales/${locale}.json`).labelPrint;
        expect(Object.keys(client).sort()).toEqual(Object.keys(english.labelPrint).sort());
        expect(Object.keys(client.errors).sort()).toEqual(Object.keys(english.labelPrint.errors).sort());
        expect(server).toEqual(client);
    }
});
