const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('../../../client/node_modules/esbuild');
const React = require('../../../client/node_modules/react');
const { renderToStaticMarkup } = require('../../../client/node_modules/react-dom/server');
const { JSDOM } = require('jsdom');

jest.mock('../../prisma', () => ({
    systemSetting: { findUnique: jest.fn(), create: jest.fn(), upsert: jest.fn() },
    lab: { findUnique: jest.fn(), update: jest.fn() }
}));
jest.mock('../../services/TranslationService', () => ({}));
const prisma = require('../../prisma');
const publicController = require('../../controllers/publicI18nController');
const adminController = require('../../controllers/adminController');
const { getManualUrl } = require('../../config/publicSupport');
const defaults = require('../../../shared/publicSupport.json');
const originalManualUrl = process.env.MANUAL_URL;

afterEach(() => {
    jest.clearAllMocks();
    if (originalManualUrl === undefined) delete process.env.MANUAL_URL;
    else process.env.MANUAL_URL = originalManualUrl;
});

function response() {
    return { json: jest.fn(), success: jest.fn(), error: jest.fn() };
}

test('an unset Manual URL and missing support contact use the shared launch defaults without writing settings', async () => {
    delete process.env.MANUAL_URL;
    prisma.systemSetting.findUnique.mockResolvedValue(null);
    const res = response();
    await publicController.getPublicBranding({}, res);
    expect(res.json).toHaveBeenCalledWith({ branding: expect.objectContaining({
        manualUrl: 'https://yigini.github.io/soilfer-lims/', contactEmail: 'glosolan@fao.org'
    }) });
    expect(prisma.systemSetting.create).not.toHaveBeenCalled();
    expect(prisma.systemSetting.upsert).not.toHaveBeenCalled();
});

test('public settings preserve a configured contact and unrelated branding while the Manual URL is configurable', async () => {
    process.env.MANUAL_URL = 'https://docs.example.org/soil/';
    prisma.systemSetting.findUnique.mockResolvedValue({ branding: JSON.stringify({
        title: 'Demo Soil Lab', contactEmail: '  local-support@example.org ', logoUrl: '/demo.png'
    }) });
    const res = response();
    await publicController.getPublicBranding({}, res);
    expect(res.json).toHaveBeenCalledWith({ branding: {
        title: 'Demo Soil Lab', contactEmail: 'local-support@example.org', logoUrl: '/demo.png',
        manualUrl: 'https://docs.example.org/soil/'
    } });
});

test.each(['', '  ', 'javascript:alert(1)', 'data:text/html,hello', 'https://user:password@docs.example.org/', 'not a URL'])(
    'an empty or unusable Manual URL is hidden (%s)', value => {
        process.env.MANUAL_URL = value;
        expect(getManualUrl()).toBe('');
    }
);

test('the support default is available even if the public branding lookup fails', async () => {
    delete process.env.MANUAL_URL;
    prisma.systemSetting.findUnique.mockRejectedValueOnce(new Error('synthetic lookup failure'));
    const res = response();
    await publicController.getPublicBranding({}, res);
    expect(res.json).toHaveBeenCalledWith({ branding: expect.objectContaining(defaults) });
});

test('the administrator form receives the same support default as the public app', async () => {
    delete process.env.MANUAL_URL;
    prisma.systemSetting.findUnique.mockResolvedValue({ branding: JSON.stringify({ contactEmail: '' }) });
    const res = response();
    await adminController.getSettings({ user: { role: 'SUPER_ADMIN', labId: null } }, res);
    expect(res.success).toHaveBeenCalledWith('SETTINGS_FETCHED', expect.any(String), null, 200,
        expect.objectContaining({ branding: expect.objectContaining(defaults) }));
});

test('lab-specific settings keep their configured contact and existing scope', async () => {
    delete process.env.MANUAL_URL;
    prisma.lab.findUnique.mockResolvedValue({ branding: JSON.stringify({ contactEmail: 'demo-lab@example.org' }) });
    const res = response();
    await adminController.getSettings({ user: { role: 'LAB_MANAGER', labId: 'DEMO' } }, res);
    expect(prisma.lab.findUnique).toHaveBeenCalledWith({ where: { id: 'DEMO' }, select: { branding: true, settings: true } });
    expect(res.success.mock.calls[0][4].branding.contactEmail).toBe('demo-lab@example.org');
    expect(prisma.lab.update).not.toHaveBeenCalled();
});

function drawer(manualUrl, locale) {
    const filename = path.resolve(__dirname, '../../../client/src/components/help/ContextHelpDrawer.jsx');
    const code = esbuild.transformSync(fs.readFileSync(filename, 'utf8'), { loader: 'jsx', format: 'cjs' }).code;
    const pack = require(`../../../client/src/translations/${locale}.json`);
    const module = { exports: {} };
    const t = (key, fallback) => key.split('.').reduce((v, k) => v?.[k], pack) || fallback || key;
    vm.runInNewContext(code, {
        module, exports: module.exports,
        require(name) {
            if (name === 'react') return React;
            if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
            if (name === 'react-router-dom') return {
                Link: ({ to, children, ...props }) => React.createElement('a', { ...props, href: to }, children),
                useLocation: () => ({ pathname: '/workbench' })
            };
            if (name === '../../context/HelpContext') return { useHelp: () => ({
                isDrawerOpen: true, drawerArticleId: null, activeBlockers: [], closeDrawer() {},
                drillDownArticle() {}, navigateBackInDrawer() {}
            }) };
            if (name === '../../context/LanguageContext') return { useLanguage: () => ({ t, locale }) };
            if (name === '../../context/AuthContext') return { useAuth: () => ({ user: { role: 'LAB_TECHNICIAN' } }) };
            if (name === '../../hooks/useBrandingContact') return { useBrandingLinks: () => ({ manualUrl }) };
            if (name === '../../services/helpClientService') return {};
            if (name === 'clsx') return (...args) => args.filter(Boolean).join(' ');
            throw Error('Unexpected drawer dependency: ' + name);
        }
    }, { filename });
    const html = renderToStaticMarkup(React.createElement(module.exports.default));
    return { document: new JSDOM(html).window.document, pack };
}

test.each(['en', 'fr', 'pt', 'es', 'es-419'])('the %s Help drawer links to the configured Manual in a separate tab', locale => {
    const { document, pack } = drawer('https://docs.example.org/manual/', locale);
    const link = document.querySelector('a[href="https://docs.example.org/manual/"]');
    expect(link).not.toBeNull();
    expect(link.textContent).toBe(pack.help.drawer.manual);
    expect(link.getAttribute('aria-label')).toBe(pack.help.drawer.openManual);
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
    expect(document.querySelector('a[href="/help"]')).not.toBeNull();
});

test.each(['en', 'fr', 'pt', 'es', 'es-419'])('clearing the Manual URL hides its link in %s while retaining Help Centre', locale => {
    const { document, pack } = drawer('', locale);
    expect(document.querySelector(`[aria-label="${pack.help.drawer.openManual}"]`)).toBeNull();
    expect(document.querySelector('a[href="/help"]')).not.toBeNull();
});
