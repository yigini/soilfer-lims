/**
 * Contract Tests: Reception Route Smoke & Static Asset Integrity (#113, #114, #117)
 *
 * Verifies:
 * 1. GET /reception returns 200 OK and serves client index.html SPA entry point.
 * 2. GET /reception?mode=WALK_IN returns 200 OK and serves client SPA entry point.
 * 3. Client build bundle for Reception page exists in dist/assets and contains no syntax errors.
 * 4. Referenced script and stylesheet assets resolve with HTTP 200 without 404 or 500 errors.
 * 5. Isolated Reception parent component mount with WALK_IN mode completes without runtime crash.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const vm = require('vm');
const esbuild = require('../../../client/node_modules/esbuild');
const React = require('../../../client/node_modules/react');
const ReactDOMServer = require('../../../client/node_modules/react-dom/server');

describe('Reception Route Smoke & Static Asset Verification (#113, #114, #117)', () => {
    let app;
    const clientDist = path.resolve(__dirname, '../../../client/dist');
    const hasDist = fs.existsSync(clientDist) && fs.existsSync(path.join(clientDist, 'index.html'));

    beforeAll(() => {
        // Ensure static client serving is active without activating background schedulers
        process.env.SERVE_CLIENT = 'true';
        app = require('../../app');
    });

    afterAll(async () => {
        delete process.env.SERVE_CLIENT;
        try {
            const prisma = require('../../prisma');
            await prisma.$disconnect();
        } catch (_) {}
    });

    test('1. Release Prerequisite: client production build (client/dist) must exist', () => {
        expect(hasDist).toBe(true);
        expect(fs.existsSync(path.join(clientDist, 'index.html'))).toBe(true);
    });

    test('2. GET /reception returns HTTP 200 and text/html SPA shell', async () => {
        expect(hasDist).toBe(true);
        const res = await request(app).get('/reception');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/html/);
        expect(res.text).toContain('<div id="root">');
    });

    test('3. GET /reception?mode=WALK_IN returns HTTP 200 and text/html SPA shell', async () => {
        expect(hasDist).toBe(true);
        const res = await request(app).get('/reception?mode=WALK_IN');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/html/);
        expect(res.text).toContain('<div id="root">');
    });

    test('4. Client dist bundle contains compiled Reception page asset', () => {
        expect(hasDist).toBe(true);
        const assetsDir = path.join(clientDist, 'assets');
        expect(fs.existsSync(assetsDir)).toBe(true);

        const files = fs.readdirSync(assetsDir);
        const receptionBundle = files.find(f => f.startsWith('Reception-') && f.endsWith('.js'));
        expect(receptionBundle).toBeDefined();

        const bundleContent = fs.readFileSync(path.join(assetsDir, receptionBundle), 'utf8');
        expect(bundleContent.length).toBeGreaterThan(1000);
        // Ensure the bundle is parseable JavaScript
        expect(() => {
            const result = esbuild.transformSync(bundleContent, { loader: 'js' });
            expect(result.code.length).toBeGreaterThan(0);
        }).not.toThrow();
    });

    test('5. Referenced entry assets in index.html are served with HTTP 200', async () => {
        expect(hasDist).toBe(true);
        const indexHtml = fs.readFileSync(path.join(clientDist, 'index.html'), 'utf8');
        // Extract script src
        const scriptMatch = indexHtml.match(/src="([^"]+)"/);
        expect(scriptMatch).toBeTruthy();
        const scriptPath = scriptMatch[1];

        const scriptRes = await request(app).get(scriptPath);
        expect(scriptRes.status).toBe(200);
        expect(scriptRes.headers['content-type']).toMatch(/javascript/);

        // Extract css href
        const cssMatch = indexHtml.match(/href="([^"]+\.css)"/);
        if (cssMatch) {
            const cssPath = cssMatch[1];
            const cssRes = await request(app).get(cssPath);
            expect(cssRes.status).toBe(200);
            expect(cssRes.headers['content-type']).toMatch(/css/);
        }
    });

    test('6. Isolated Reception parent render with WALK_IN mode completes without runtime crash', () => {
        const componentPath = path.resolve(__dirname, '../../../client/src/pages/Reception.jsx');
        const source = fs.readFileSync(componentPath, 'utf8');
        const transformed = esbuild.transformSync(source, { loader: 'jsx', format: 'cjs', target: 'es2022' });

        const reactReserved = new Set([
            'propTypes', 'PropTypes', 'defaultProps', 'getDefaultProps', 'contextTypes', 'childContextTypes',
            'getDerivedStateFromProps', 'getDerivedStateFromError', '_context'
        ]);

        const createMockComponent = (name) => {
            return (props) => React.createElement('div', { 'data-mock': name }, props && props.children ? props.children : null);
        };

        function createMockModule(name) {
            const defaultExport = createMockComponent(name || 'mockComponent');
            const handler = {
                get: (target, prop) => {
                    if (prop === '__esModule') return false;
                    if (prop === 'default') return defaultExport;
                    if (reactReserved.has(prop)) return undefined;
                    if (typeof prop === 'string') {
                        return createMockComponent(prop);
                    }
                    return undefined;
                }
            };
            return new Proxy(defaultExport, handler);
        }

        const runContext = {
            module: { exports: {} },
            exports: {},
            require: (mod) => {
                if (mod === 'react') return React;
                if (mod === 'react-router-dom') return {
                    useLocation: () => ({ search: '?mode=WALK_IN', pathname: '/reception' })
                };
                if (mod.includes('AnalysisCatalogueContext')) return { useAnalysisNames: () => (n) => n };
                if (mod.includes('AuthContext')) return {
                    useAuth: () => ({
                        user: { id: 'u-tech-1', username: 'tech1', role: 'SAMPLE_RECEPTION', labId: 'LAB-TEST-01' },
                        token: 'mock-token'
                    })
                };
                if (mod.includes('DialogContext')) return { useDialog: () => ({ showDialog: () => {} }) };
                if (mod.includes('LanguageContext')) return { useLanguage: () => ({ t: (k, d) => d || k }) };
                if (mod === 'axios') return {
                    get: () => Promise.resolve({ data: [] }),
                    post: () => Promise.resolve({ data: {} })
                };
                if (mod.includes('mapConfig')) {
                    const mapConfigSource = fs.readFileSync(path.resolve(__dirname, '../../../client/src/utils/mapConfig.js'), 'utf8');
                    const mapConfigTransformed = esbuild.transformSync(mapConfigSource, { loader: 'js', format: 'cjs' });
                    const mapMod = { exports: {} };
                    vm.runInNewContext(mapConfigTransformed.code, { module: mapMod, exports: mapMod.exports, parseFloat, isNaN, Array });
                    return mapMod.exports;
                }
                return createMockModule(mod);
            },
            console,
            localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
            window: { addEventListener: () => {}, removeEventListener: () => {} }
        };

        vm.runInNewContext(transformed.code, runContext);
        const Reception = runContext.module.exports.default || runContext.module.exports;

        const html = ReactDOMServer.renderToString(React.createElement(Reception));
        expect(typeof html).toBe('string');
        expect(html).toContain('Reception Console');
    });
});
