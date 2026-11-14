const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { JSDOM } = require('jsdom');
const React = require('../../../client/node_modules/react');
const esbuild = require('../../../client/node_modules/esbuild');
const { localeTranslator } = require('../helpers/clientTranslation');
const { registry } = require('../../config/policyRegistry');
const locales = ['en', 'fr', 'pt', 'es', 'es-419'];
const code = esbuild.transformSync(fs.readFileSync(path.resolve(__dirname, '../../../client/src/pages/Inventory.jsx'), 'utf8'), { loader: 'jsx', format: 'cjs' }).code;
const actor = { username: 'tech-a', role: 'LAB_TECHNICIAN', labId: 'lab-a' };
const makeItem = (id, itemType, extra = {}) => ({ id, itemType, labId: 'lab-a', name: id, unitOfMeasure: 'mL', isActive: true,
    totalStock: 0, usableStock: 0, lotCount: 0, availableLotCount: 0, ...extra });
const reagent = makeItem('reagent', 'REAGENT'), standard = makeItem('standard', 'STANDARD'), chemical = makeItem('chemical', 'CHEMICAL');
const parents = [
    { id: 'parent-a', labId: 'lab-a', lotNumber: 'PARENT-A', item: { name: 'Stock solution' }, status: 'AVAILABLE' },
    { id: 'parent-b', labId: 'lab-b', lotNumber: 'PARENT-B', item: { name: 'Other laboratory stock' }, status: 'AVAILABLE' }
];
const child = { id: 'child', lotNumber: 'CHILD', status: 'QUARANTINED', currentQuantity: 4, unitOfMeasure: 'mL', preparedBy: actor.username,
    traceabilityNotes: 'Parent lots: PARENT-A (parent-a)', transactions: [{ actionType: 'RECEIVE', reasonCode: 'TECHNICIAN_PREPARATION_QUARANTINED' }] };
let dom, root, axios, t;
const flush = async callback => React.act(async () => { await callback?.(); await new Promise(resolve => setImmediate(resolve)); });
const button = (label, within = document) => {
    const result = [...within.querySelectorAll('button')].find(node => node.textContent.trim() === label);
    expect(result).toBeDefined(); return result;
};
const click = async node => { expect(node).toBeDefined(); await flush(() => node.click()); };
const change = async (node, value) => {
    expect(node).toBeDefined();
    await flush(() => {
        const prototype = node.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value);
        node.dispatchEvent(new window.Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    });
};
const modal = () => [...document.querySelectorAll('h3')].find(node => [t('preparedLots.addLot'), t('inventory.dialogs.receiveStock')].includes(node.textContent.trim()))?.closest('div.fixed');
const closeModal = async () => click([...modal().querySelectorAll('button')].find(node => node.getAttribute('aria-label') === t('common.close')));
const fillLot = async (number = 'NEW-LOT', quantity = '2.5') => {
    await change(modal().querySelector('input[aria-label]'), number);
    await change(modal().querySelector('input[type="number"]'), quantity);
};
async function mount(locale = 'en', { permissions = ['PREPARE_INVENTORY_LOT', 'CONSUME_INVENTORY'], lots = [child], parentFailure = false } = {}) {
    t = localeTranslator(locale);
    dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
    global.window = dom.window; global.document = dom.window.document; global.navigator = dom.window.navigator;
    global.IS_REACT_ACT_ENVIRONMENT = true;
    axios = {
        get: jest.fn(async url => {
            if (url === '/api/inventory/items') return { data: [reagent, standard, chemical, makeItem('inactive', 'REAGENT', { isActive: false })] };
            if (url === '/api/inventory/locations') return { data: [] };
            if (url === '/api/inventory/alerts') return { data: { counts: {}, alerts: [] } };
            if (url === '/api/inventory/lots') { if (parentFailure) throw Error('Synthetic parent-list failure'); return { data: parents }; }
            if (url === '/api/inventory/items/' + reagent.id) return { data: { ...reagent, lots } };
            throw Error('Unexpected prepared-lot GET: ' + url);
        }),
        post: jest.fn(async () => ({ data: { id: 'new-lot', status: 'QUARANTINED' } }))
    };
    const module = { exports: {} };
    vm.runInNewContext(code, { module, exports: module.exports, console, Date, require: name => {
        if (name === 'react') return React;
        if (name === 'axios') return axios;
        if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
        if (name.includes('LanguageContext')) return { useLanguage: () => ({ t, language: locale }) };
        if (name.includes('AuthContext')) return { useAuth: () => ({ user: actor, hasPermission: permission => permissions.includes(permission) }) };
        if (name.includes('DialogContext')) return { useDialog: () => ({ showDialog: jest.fn() }) };
        if (name.endsWith('InfoTooltip')) return { default: () => null };
        throw Error('Unexpected prepared-lot UI dependency: ' + name);
    } });
    root = require('../../../client/node_modules/react-dom/client').createRoot(document.getElementById('root'));
    await flush(() => root.render(React.createElement(module.exports.default)));
}
afterEach(async () => {
    if (root) await flush(() => root.unmount());
    dom?.window.close(); root = null; dom = null;
    delete global.window; delete global.document; delete global.navigator; delete global.IS_REACT_ACT_ENVIRONMENT;
});

test.each(locales)('%s: technician lot preparation renders a fixed actor and submits only selected same-lab parents', async locale => {
    await mount(locale); await click(document.querySelector('[data-testid="add-lot-reagent"]'));
    expect(modal()).toBeDefined();
    const preparer = modal().querySelector('[data-testid="prepared-lot-actor"]');
    expect(preparer.value).toBe(actor.username); expect(preparer.readOnly).toBe(true);
    expect(modal().querySelector('[data-testid="prepared-lot-parent-parent-a"]')).not.toBeNull();
    expect(modal().querySelector('[data-testid="prepared-lot-parent-parent-b"]')).toBeNull();
    expect(axios.get).toHaveBeenCalledWith('/api/inventory/lots', { params: { status: 'ALL' } });
    expect(modal().textContent).toContain(t('preparedLots.parentHelp'));
    await fillLot(); await click(modal().querySelector('[data-testid="prepared-lot-parent-parent-a"]'));
    await click(button(t('common.next') + ' →', modal()));
    expect(modal().textContent).toContain('PARENT-A'); expect(modal().textContent).toContain(actor.username);
    await click(button(t('preparedLots.confirmPreparation'), modal()));
    expect(axios.post).toHaveBeenCalledWith('/api/inventory/lots', { inventoryItemId: reagent.id, lotNumber: 'NEW-LOT', quantity: 2.5,
        expiryDate: '', locationId: '', concentration: '', preparedBy: actor.username, traceabilityNotes: '', parentLotIds: ['parent-a'] });
    expect(modal()).toBeUndefined();
});

test('Add lot appears only on active eligible rows and the picker retains that boundary', async () => {
    await mount();
    expect([...document.querySelectorAll('[data-testid^="add-lot-"]')].map(node => node.dataset.testid)).toEqual(['add-lot-reagent', 'add-lot-standard']);
    expect([...document.querySelectorAll('button')].some(node => node.textContent.trim() === t('inventory.addItem'))).toBe(false);
    await click(document.querySelector('[data-testid="add-lot-standard"]'));
    await click(button('← ' + t('common.back'), modal()));
    expect([...modal().querySelector('select').options].map(node => node.value)).toEqual(['', 'reagent', 'standard']);
});

test('without preparation permission, consumption permission does not expose Add lot', async () => {
    await mount('en', { permissions: ['CONSUME_INVENTORY'] });
    expect(document.querySelector('[data-testid^="add-lot-"]')).toBeNull();
    await click(document.querySelector('tbody tr'));
    expect(document.querySelector('[data-testid="drawer-add-lot"]')).toBeNull();
});

test('server parent errors are translated and reopening clears draft, parents and error', async () => {
    await mount('fr'); await click(document.querySelector('[data-testid="add-lot-reagent"]'));
    await fillLot(); await click(modal().querySelector('[data-testid="prepared-lot-parent-parent-a"]'));
    await click(button(t('common.next') + ' →', modal()));
    axios.post.mockRejectedValueOnce({ response: { data: { code: 'PARENT_LOT_INVALID', error: 'PARENT_LOT_INVALID' } } });
    await click(button(t('preparedLots.confirmPreparation'), modal()));
    expect(modal().querySelector('[role="alert"]').textContent).toBe(t('preparedLots.errors.PARENT_LOT_INVALID'));
    await closeModal(); await click(document.querySelector('[data-testid="add-lot-reagent"]'));
    expect(modal().querySelector('input[aria-label]').value).toBe('');
    expect(modal().querySelector('input[type="number"]').value).toBe('');
    expect(modal().querySelector('[data-testid="prepared-lot-parent-parent-a"]').checked).toBe(false);
    expect(modal().querySelector('[role="alert"]')).toBeNull();
});

test('an unavailable optional parent list reports the problem but still permits preparation without parent ids', async () => {
    await mount('pt', { parentFailure: true }); await click(document.querySelector('[data-testid="add-lot-reagent"]'));
    expect(modal().querySelector('[role="status"]').textContent).toBe(t('preparedLots.parentsUnavailable'));
    await fillLot(); await click(button(t('common.next') + ' →', modal())); await click(button(t('preparedLots.confirmPreparation'), modal()));
    expect(axios.post.mock.calls[0][1]).not.toHaveProperty('parentLotIds');
});

test.each([['policy', child.transactions, 'preparedLots.quarantineByPolicy'], ['later hold', [
    { actionType: 'QUARANTINE', reasonCode: 'QUALITY_HOLD', freeTextReason: 'Check new label' }, ...child.transactions
], 'preparedLots.quarantineReason']])('the drawer explains the %s without granting a technician management controls', async (_name, transactions, key) => {
    await mount('es', { lots: [{ ...child, transactions }] }); await click(document.querySelector('tbody tr'));
    expect(document.querySelector('[data-testid="lot-quarantine-explanation"]').textContent).toBe(t(key, { reason: 'Check new label' }));
    const titles = [...document.querySelectorAll('button')].map(node => node.title);
    for (const action of ['adjust', 'transfer', 'quarantine', 'release', 'dispose', 'consume']) expect(titles).not.toContain(t('inventory.dialogs.actions.' + action));
    expect(document.body.textContent).toContain(actor.username); expect(document.body.textContent).toContain(child.traceabilityNotes);
    await click(document.querySelector('[data-testid="drawer-add-lot"]'));
    expect(modal()).toBeDefined(); expect(modal().querySelector('[data-testid="prepared-lot-actor"]').readOnly).toBe(true);
});

test('the lab-only prepared-lot policy and every new label have complete five-language values and parameters', () => {
    const key = 'inventory.technicianLotsStartQuarantined';
    expect(registry[key]).toMatchObject({ scope: 'LAB', presets: { ISO17025_STRICT: true, BASIC: false, ADVISORY: false } });
    const leaves = (value, prefix = '') => Object.entries(value).flatMap(([name, child]) => child && typeof child === 'object' ? leaves(child, prefix + name + '.') : [[prefix + name, child]]);
    const english = leaves(require('../../../client/src/translations/en.json').preparedLots);
    const parameters = value => [...value.matchAll(/{{(\w+)}}/g)].map(match => match[1]).sort();
    for (const locale of locales) {
        const translate = localeTranslator(locale), entries = leaves(require('../../../client/src/translations/' + locale + '.json').preparedLots);
        expect(entries.map(([name]) => name).sort()).toEqual(english.map(([name]) => name).sort());
        const dictionary = Object.fromEntries(entries);
        for (const [name, value] of english) { expect(dictionary[name].trim()).not.toBe(''); expect(parameters(dictionary[name])).toEqual(parameters(value)); }
        expect(translate(registry[key].description)).not.toBe(registry[key].description);
        expect(translate(registry[key].help)).not.toBe(registry[key].help);
    }
});
