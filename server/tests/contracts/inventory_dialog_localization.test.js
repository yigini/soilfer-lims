const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { JSDOM } = require('jsdom');
const React = require('../../../client/node_modules/react');
const esbuild = require('../../../client/node_modules/esbuild');
const { localeTranslator } = require('../helpers/clientTranslation');
const locales = ['en', 'fr', 'pt', 'es', 'es-419'];
const packs = Object.fromEntries(locales.map(locale => [locale, require('../../../client/src/translations/' + locale + '.json')]));
const source = fs.readFileSync(path.resolve(__dirname, '../../../client/src/pages/Inventory.jsx'), 'utf8');
const code = esbuild.transformSync(source, { loader: 'jsx', format: 'cjs' }).code;
const item = { id: 'demo-item', name: 'Demo buffer', itemType: 'REAGENT', unitOfMeasure: 'mL', isActive: true,
    totalStock: 20, usableStock: 20, lotCount: 2, availableLotCount: 1, nearestExpiry: '2099-01-01' };
const lot = { id: 'demo-lot', lotNumber: 'DEMO-LOT', status: 'AVAILABLE', currentQuantity: 20, unitOfMeasure: 'mL', expiryDate: '2099-01-01' };

let dom, root, axios, t;
const flush = async callback => React.act(async () => { await callback?.(); await new Promise(resolve => setImmediate(resolve)); });
const button = (text, within = document) => {
    const found = [...within.querySelectorAll('button')].find(node => node.textContent.trim() === text);
    expect(found).toBeDefined(); return found;
};
const click = async node => { expect(node).toBeDefined(); await flush(() => node.click()); };
const change = async (node, value) => {
    expect(node).toBeDefined();
    await flush(() => {
        const prototype = node.tagName === 'SELECT' ? window.HTMLSelectElement.prototype :
            node.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value);
        node.dispatchEvent(new window.Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    });
};
const modal = () => [...document.querySelectorAll('div.fixed')].find(node => node.querySelector('h3'));
const createFields = () => [...modal().querySelectorAll('input')];
const defaultForm = { name: '', itemType: 'REAGENT', unitOfMeasure: 'mL', shortCode: '', grade: '', hazardClass: '', reorderPoint: 0 };
async function mount(locale = 'en', canManage = true) {
    t = localeTranslator(locale);
    dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
    global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
    global.IS_REACT_ACT_ENVIRONMENT = true;
    axios = {
        get: jest.fn(async url => {
            if (url === '/api/inventory/items') return { data: [item, { ...item, id: 'inactive-item', name: 'Inactive buffer', isActive: false }] };
            if (url === '/api/inventory/locations') return { data: [{ id: 'demo-shelf', name: 'Demo shelf' }] };
            if (url === '/api/inventory/alerts') return { data: { counts: { total: 0 }, alerts: [] } };
            if (url.startsWith('/api/inventory/fefo/')) return { data: [lot] };
            if (url === '/api/inventory/items/' + item.id) return { data: { ...item, lots: [lot,
                { ...lot, id: 'quarantined-lot', lotNumber: 'QUARANTINED-LOT', status: 'QUARANTINED' }] } };
            throw Error('Unexpected inventory GET: ' + url);
        }),
        post: jest.fn(async () => ({ data: {} }))
    };
    const module = { exports: {} };
    vm.runInNewContext(code, { module, exports: module.exports, console, Date, require: name => {
        if (name === 'react') return React;
        if (name === 'axios') return axios;
        if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
        if (name.includes('LanguageContext')) return { useLanguage: () => ({ t, language: locale }) };
        if (name.includes('AuthContext')) return { useAuth: () => ({ user: { role: 'LAB_MANAGER' },
            hasPermission: permission => permission === 'MANAGE_INVENTORY' ? canManage : true }) };
        if (name.includes('DialogContext')) return { useDialog: () => ({ showDialog: jest.fn() }) };
        if (name.endsWith('InfoTooltip')) return { default: () => null };
        throw Error('Unexpected inventory dependency: ' + name);
    } });
    root = require('../../../client/node_modules/react-dom/client').createRoot(document.getElementById('root'));
    await flush(() => root.render(React.createElement(module.exports.default)));
}
afterEach(async () => {
    if (root) await flush(() => root.unmount());
    dom?.window.close(); root = null; dom = null;
    delete global.window; delete global.document; delete global.navigator; delete global.IS_REACT_ACT_ENVIRONMENT;
});
const fillCreate = async () => {
    const inputs = createFields(), selects = modal().querySelectorAll('select');
    for (const [index, value] of ['Demo item', 'DEMO-CODE', 'AR', 'Demo hazard', '9'].entries()) await change(inputs[index], value);
    await change(selects[0], 'STANDARD'); await change(selects[1], 'box');
};
const expectCreateDefaults = () => {
    expect(createFields().map(node => node.value)).toEqual(['', '', '', '', '0']);
    expect([...modal().querySelectorAll('select')].map(node => node.value)).toEqual(['REAGENT', 'mL']);
};

test.each(['cancel', 'create', 'error'])('Add Item reopens empty after %s without retaining an error or draft', async closeBy => {
    await mount();
    await click(button(t('inventory.addItem'))); await fillCreate();
    if (closeBy === 'create') {
        await click(button('Create Item', modal()));
        expect(axios.post).toHaveBeenCalledWith('/api/inventory/items',
            { ...defaultForm, name: 'Demo item', itemType: 'STANDARD', unitOfMeasure: 'box', shortCode: 'DEMO-CODE', grade: 'AR', hazardClass: 'Demo hazard', reorderPoint: 9 });
    } else {
        if (closeBy === 'error') {
            axios.post.mockRejectedValueOnce({ response: { data: { error: 'Demo server validation message' } } });
            await click(button('Create Item', modal()));
            expect(modal().textContent).toContain('Demo server validation message');
        }
        await click(button(t('common.cancel'), modal()));
    }
    expect(modal()).toBeUndefined();
    await click(button(t('inventory.addItem')));
    expectCreateDefaults();
    expect(modal().textContent).not.toContain('Demo server validation message');
    expect(axios.post).toHaveBeenCalledTimes(closeBy === 'cancel' ? 0 : 1);
});

test('inventory dialog keys and interpolation parameters match in all five packs', () => {
    const leaves = (value, prefix = '') => Object.entries(value).flatMap(([key, child]) =>
        child && typeof child === 'object' ? leaves(child, prefix + key + '.') : [[prefix + key, child]]);
    expect(packs.en.inventory.dialogs).toBeDefined();
    const english = leaves(packs.en.inventory.dialogs);
    const parameters = value => [...value.matchAll(/{{(\w+)}}/g)].map(match => match[1]).sort();
    for (const locale of locales) {
        const entries = leaves(packs[locale].inventory.dialogs);
        expect(entries.map(([key]) => key).sort()).toEqual(english.map(([key]) => key).sort());
        const dictionary = Object.fromEntries(entries);
        for (const [key, value] of english) {
            expect(typeof dictionary[key]).toBe('string'); expect(dictionary[key].trim()).not.toBe('');
            expect(parameters(dictionary[key])).toEqual(parameters(value));
        }
    }
});

test.each(locales)('%s: Add Item uses the selected language and preserves every enum and wire value', async locale => {
    await mount(locale); await click(button(t('inventory.addItem')));
    expect(modal().querySelector('h3').textContent.trim()).toBe(t('inventory.addItem'));
    expect(createFields()[0].placeholder).toBe(t('inventory.itemName') + ' *');
    const types = modal().querySelectorAll('select')[0], units = modal().querySelectorAll('select')[1];
    expect([...types.options].map(option => option.value)).toEqual(['REAGENT', 'CHEMICAL', 'CONSUMABLE', 'STANDARD', 'CRM', 'CONTAINER', 'OTHER']);
    expect([...types.options].map(option => option.textContent)).toEqual([...types.options].map(option => t('inventory.dialogs.itemTypes.' + option.value)));
    expect([...units.options].map(option => option.value)).toEqual(['g', 'mg', 'kg', 'mL', 'L', 'µL', 'pcs', 'box']);
    await change(createFields()[0], 'Demo buffer');
    axios.post.mockRejectedValueOnce({});
    await click(button(t('inventory.dialogs.createItem'), modal()));
    expect(modal().textContent).toContain(t('inventory.dialogs.createFailed'));
    expect(axios.post).toHaveBeenLastCalledWith('/api/inventory/items', { ...defaultForm, name: 'Demo buffer' });
});

test.each(locales)('%s: Receive Stock renders all three steps and sends the unchanged receipt payload', async locale => {
    await mount(locale); await click(button(t('inventory.dialogs.receiveStock')));
    expect(modal().textContent).toContain(t('inventory.dialogs.step', { step: 1, total: 3 }));
    const select = modal().querySelector('select');
    expect([...select.options].map(option => option.value)).toEqual(['', item.id]);
    await change(select, item.id); await click(button(t('common.next') + ' →', modal()));
    expect(modal().textContent).toContain(t('inventory.lotNumber'));
    expect(modal().textContent).toContain(t('inventory.expiryDate'));
    await change(modal().querySelector('input:not([type])'), 'DEMO-RECEIVED');
    await change(modal().querySelector('input[type="number"]'), '7.5');
    await click(button(t('common.next') + ' →', modal()));
    expect(modal().textContent).toContain(t('inventory.dialogs.confirmReceipt'));
    expect(modal().textContent).toContain('DEMO-RECEIVED');
    expect(modal().textContent).toContain('7.5 mL');
    await click(button(t('inventory.dialogs.confirmReceipt'), modal()));
    expect(axios.post).toHaveBeenCalledWith('/api/inventory/lots', { inventoryItemId: item.id, lotNumber: 'DEMO-RECEIVED',
        quantity: 7.5, expiryDate: '', locationId: '', concentration: '', preparedBy: '', traceabilityNotes: '' });
    expect(modal()).toBeUndefined();
    await click(button(t('inventory.dialogs.receiveStock')));
    expect(modal().querySelector('select').value).toBe('');
    expect(modal().textContent).toContain(t('inventory.dialogs.step', { step: 1, total: 3 }));
});

test.each(locales)('%s: Quick Consume renders its own translated scope and preserves the consume payload', async locale => {
    await mount(locale);
    await click([...document.querySelectorAll('button')].find(node => node.title === t('inventory.dialogs.quickConsume') + ' (FEFO)'));
    expect(modal().textContent).toContain(t('inventory.dialogs.autoSelectedLot'));
    expect(modal().textContent).toContain(t('inventory.dialogs.amountToUse', { unit: 'mL' }));
    await change(modal().querySelector('input[type="number"]'), '2.5');
    axios.post.mockRejectedValueOnce({});
    await click(button(t('common.confirm'), modal()));
    expect(modal().textContent).toContain(t('inventory.dialogs.consumeFailed'));
    await click(button(t('common.confirm'), modal()));
    expect(axios.post).toHaveBeenLastCalledWith('/api/inventory/lots/' + lot.id + '/consume', { quantity: 2.5, reason: undefined });
});

test.each(['fr', 'pt'].flatMap(locale => ['consume', 'adjust', 'transfer', 'quarantine', 'release', 'dispose'].map(action => [locale, action])))(
    '%s: %s lot dialog renders translated labels and retains the action contract', async (locale, action) => {
        await mount(locale); await click(document.querySelector('tbody tr'));
        await click([...document.querySelectorAll('button')].find(node => node.title === t('inventory.dialogs.actions.' + action)));
        const panel = document.querySelector('h4.capitalize').parentElement;
        expect(panel.textContent).toContain(t('inventory.dialogs.actionTitles.' + action));
        const id = action === 'release' ? 'quarantined-lot' : lot.id;
        let payload = {};
        if (action === 'consume' || action === 'adjust') {
            await change(panel.querySelector('input[type="number"]'), '2.5');
            payload = action === 'consume' ? { quantity: 2.5, reason: undefined } : { delta: 2.5, reason: 'Demo reason' };
        }
        if (['adjust', 'quarantine', 'dispose'].includes(action)) {
            expect(panel.textContent).toContain(t('inventory.dialogs.reason'));
            await change(panel.querySelector('textarea'), 'Demo reason');
            if (action !== 'adjust') payload = { reason: 'Demo reason' };
        }
        if (action === 'transfer') { await change(panel.querySelector('select'), 'demo-shelf'); payload = { locationId: 'demo-shelf' }; }
        if (action === 'release') payload = { reason: '' };
        await click(button(t('common.confirm'), panel));
        expect(axios.post).toHaveBeenCalledWith('/api/inventory/lots/' + id + '/' + action, payload);
    }
);

test('users without MANAGE_INVENTORY still cannot open create, receive or management dialogs', async () => {
    await mount('fr', false);
    expect([...document.querySelectorAll('button')].some(node => node.textContent === t('inventory.addItem'))).toBe(false);
    expect([...document.querySelectorAll('button')].some(node => node.textContent === t('inventory.dialogs.receiveStock'))).toBe(false);
    await click(document.querySelector('tbody tr'));
    const titles = [...document.querySelectorAll('button')].map(node => node.title);
    for (const action of ['adjust', 'transfer', 'quarantine', 'release', 'dispose'])
        expect(titles).not.toContain(t('inventory.dialogs.actions.' + action));
    expect(titles).toContain(t('inventory.dialogs.actions.consume'));
    expect(axios.post).not.toHaveBeenCalled();
});
