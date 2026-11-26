const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const React = require('../../../client/node_modules/react');
const { transformSync } = require('../../../client/node_modules/esbuild');
const english = require('../../../client/src/translations/en.json');

const user = { role: 'SUPER_ADMIN' };
const rows = ['ACCEPTED', 'RECEIVED'].map(status => ({ id: status, originalId: status, status }));
const searchParams = new URLSearchParams();
const sampleSources = path.resolve(__dirname, '../../../client/src');

function loadClient(file, imports) {
    const filename = path.join(sampleSources, file);
    const { code } = transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs' });
    const module = { exports: {} };
    new Function('module', 'exports', 'require', code)(module, module.exports, name => {
        if (name.endsWith('.json')) return require(path.resolve(path.dirname(filename), name));
        return imports[name] || (() => null);
    });
    return module.exports.default;
}

describe('Samples deletion eligibility', () => {
    let dom, root, api, showDialog, t;
    const byRow = status => document.querySelector(`tr[aria-label="Sample ${status}"]`);
    const click = element => React.act(async () => element.click());
    const deleteButton = status => byRow(status).querySelector('[aria-label="Delete sample"]');

    beforeEach(async () => {
        jest.useFakeTimers();
        dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost/samples' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.IS_REACT_ACT_ENVIRONMENT = true;
        window.confirm = jest.fn(() => true);
        api = {
            get: jest.fn().mockResolvedValue({ data: { data: rows, meta: { page: 1, limit: 50, total: 2, pages: 1 } } }),
            post: jest.fn().mockResolvedValue({ data: {} }),
            delete: jest.fn()
        };
        showDialog = jest.fn();
        t = jest.fn((key, fallback) => key.split('.').reduce((value, part) => value?.[part], english)
            ?? (typeof fallback === 'string' ? fallback : key));
        const imports = {
            react: React,
            axios: api,
            'lucide-react': new Proxy({}, { get: () => () => null }),
            'react-router-dom': { useNavigate: () => jest.fn(), useSearchParams: () => [searchParams, jest.fn()] }
        };
        const useAuth = () => ({ user, token: 'test', hasPermission: () => false });
        const useLanguage = () => ({ t });
        const table = loadClient('components/samples/SamplesTable.jsx', {
            ...imports,
            '../../context/AuthContext': { useAuth },
            '../../context/LanguageContext': { useLanguage },
            '../../context/AnalysisCatalogueContext': { useAnalysisNames: () => value => value }
        });
        const Samples = loadClient('pages/Samples.jsx', {
            ...imports,
            '../context/AuthContext': { useAuth },
            '../context/LanguageContext': { useLanguage },
            '../context/DialogContext': { useDialog: () => ({ showDialog }) },
            '../components/samples/SamplesTable': table
        });
        root = require('../../../client/node_modules/react-dom/client').createRoot(document.getElementById('root'));
        await React.act(async () => root.render(React.createElement(Samples)));
    });

    afterEach(async () => {
        await React.act(async () => root.unmount());
        dom.window.close();
        delete global.window;
        delete global.document;
        delete global.IS_REACT_ACT_ENVIRONMENT;
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('disables Delete with Undo intake guidance for ACCEPTED and enables it for RECEIVED', () => {
        expect(deleteButton('ACCEPTED').disabled).toBe(true);
        expect(deleteButton('ACCEPTED').closest('[title]').title).toBe(english.samples.deleteUseUndoIntake);
        expect(deleteButton('RECEIVED').disabled).toBe(false);
    });

    test('only sends selected samples in deletable statuses to batch delete', async () => {
        const bulkButton = () => [...document.querySelectorAll('button')]
            .find(button => button.textContent === english.samples.batchDelete);
        await click(byRow('ACCEPTED').querySelector('input[type="checkbox"]'));
        expect(bulkButton().disabled).toBe(true);
        await click(byRow('RECEIVED').querySelector('input[type="checkbox"]'));
        expect(bulkButton().disabled).toBe(false);
        await click(bulkButton());
        expect(t).toHaveBeenCalledWith('samples.batchDeleteConfirm', { count: 1 });
        expect(api.post).toHaveBeenCalledWith('/api/samples/batch-delete', { ids: ['RECEIVED'] }, expect.any(Object));
    });

    test('shows a server message if a sample becomes ineligible before the undo window ends', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        const message = 'Cannot discard a sample in ACCEPTED status.';
        api.delete.mockRejectedValue({ response: { data: { error: 'ILLEGAL_STATUS_TRANSITION', message } } });
        await click(deleteButton('RECEIVED'));
        await click([...document.querySelectorAll('button')].find(button => button.textContent === english.common.delete));
        await React.act(async () => jest.advanceTimersByTimeAsync(10_000));
        expect(api.delete).toHaveBeenCalledWith('/api/samples/RECEIVED', expect.any(Object));
        expect(showDialog).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', message }));
    });
});
