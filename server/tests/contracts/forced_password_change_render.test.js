const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const React = require('../../../client/node_modules/react');
const { renderToString } = require('../../../client/node_modules/react-dom/server');
const esbuild = require('../../../client/node_modules/esbuild');
const root = path.resolve(__dirname, '../../../client/src');

// Execute the production guard, Layout, modal, providers and their mobile
// consumers. Network/storage services and unrelated page content are boundaries.
function guardFixture(user) {
    const cache = new Map();
    const real = new Set(['App.jsx', 'context/SyncContext.jsx', 'context/HelpContext.jsx',
        'components/ForcePasswordChangeModal.jsx', 'lib/passwordPolicy.js',
        'components/mobile/MobileHeader.jsx', 'components/mobile/SyncStatusBadge.jsx',
        'components/mobile/MobileMoreSheet.jsx', 'components/mobile/SyncCentreModal.jsx']);
    const Empty = () => null;
    const boundary = new Proxy({ __esModule: true, default: Empty }, { get: (target, key) => target[key] ?? Empty });
    const auth = { user, hasPermission: permission => permission === 'ALLOWED', logout: jest.fn() };
    const location = { pathname: '/', search: '' };
    const Link = ({ children, to }) => React.createElement('a', { href: to }, children);
    function load(relative) {
        if (cache.has(relative)) return cache.get(relative);
        const module = { exports: {} }; cache.set(relative, module.exports);
        let source = fs.readFileSync(path.join(root, relative), 'utf8');
        // Expose the real private guard only in this VM, with no test export in app code.
        if (relative === 'App.jsx') source += '\nexport { RequireAuth };';
        vm.runInNewContext(esbuild.transformSync(source, { loader: relative.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs' }).code, {
            module, exports: module.exports, console, setTimeout, clearTimeout,
            localStorage: { getItem: () => null }, navigator: { onLine: true },
            require(name) {
                if (name === 'react') return React;
                if (name === 'react-router-dom') return { Link, useLocation: () => location,
                    useNavigate: () => jest.fn(), Navigate: ({ to }) => React.createElement('span', { 'data-redirect': to }) };
                if (name === 'lucide-react') return new Proxy({}, { get: () => Empty });
                if (name === 'clsx') return (...values) => values.filter(Boolean).join(' ');
                if (name.endsWith('AuthContext')) return { useAuth: () => auth };
                if (name.endsWith('LanguageContext')) return { useLanguage: () => ({ t: (key, fallback) => fallback ?? key }) };
                if (name.endsWith('ThemeContext')) return { useTheme: () => ({ theme: {}, darkMode: false }) };
                if (name.endsWith('DialogContext')) return { useDialog: () => ({ showDialog: jest.fn() }) };
                if (name.endsWith('NotificationContext')) return {
                    NotificationProvider: ({ children }) => children,
                    useNotifications: () => ({ unreadCount: 0 })
                };
                if (name.endsWith('navigationConfig')) return { buildNavItems: () => [], isNavItemActive: () => false };
                if (name.startsWith('.')) {
                    let resolved = path.relative(root, path.resolve(root, path.dirname(relative), name)).replaceAll('\\', '/');
                    if (!path.extname(resolved)) resolved += fs.existsSync(path.join(root, resolved + '.jsx')) ? '.jsx' : '.js';
                    if (real.has(resolved)) return load(resolved);
                }
                return boundary;
            }
        }, { filename: relative });
        cache.set(relative, module.exports); return module.exports;
    }
    const { RequireAuth } = load('App.jsx');
    function ContextPage() {
        const sync = load('context/SyncContext.jsx').useSync();
        const help = load('context/HelpContext.jsx').useHelp();
        return React.createElement('p', null, sync.syncStatus + ':' + help.currentPath);
    }
    return { render: (child = React.createElement(ContextPage), props = {}) =>
        renderToString(React.createElement(RequireAuth, props, child)) };
}

test.each(['SUPER_ADMIN', 'LAB_TECHNICIAN'])('%s can render the real forced-change modal and both provider consumers', role => {
    const fixture = guardFixture({ id: 'local-user', username: 'local-user', role, mustChangePassword: true });
    const html = fixture.render();
    expect(html).toContain('Security Update Required');
    expect(html).toContain('Enter temp password');
    expect((html.match(/type="password"/g) || []).length).toBe(3);
    expect(html).toContain('Sync status: Synced');
    expect(html).toContain('idle:/');
    expect(html).toContain('blur-sm pointer-events-none');
});

test('the forced-change shell handles a lazy routed page while keeping its modal usable', () => {
    const fixture = guardFixture({ username: 'admin', role: 'SUPER_ADMIN', mustChangePassword: true });
    const PendingPage = React.lazy(() => new Promise(() => {}));
    const html = fixture.render(React.createElement(PendingPage));
    expect(html).toContain('Security Update Required');
    expect(html).toContain('Loading View...');
});

test('the normal branch retains its providers and the existing permission redirect', () => {
    const fixture = guardFixture({ username: 'staff', role: 'LAB_TECHNICIAN', mustChangePassword: false });
    expect(fixture.render()).toContain('idle:/');
    expect(fixture.render(undefined, { permission: 'DENIED' })).toContain('data-redirect="/"');
    expect(fixture.render()).not.toContain('Security Update Required');
});

test('anonymous users still go to login', () => {
    expect(guardFixture(null).render()).toContain('data-redirect="/login"');
});
