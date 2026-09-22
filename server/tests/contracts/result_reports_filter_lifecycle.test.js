'use strict';

/**
 * Contract & Component Regression Test Suite:
 * Result Reports Query/Filter Lifecycle, Discard Stale Responses & Exact Transition (#124 Residual)
 *
 * References:
 * - Live Finding: 7516f0e /result-reports SUPER_ADMIN:
 *   Submit 'GTM26-0002' in All Versions -> 1 matching report.
 *   Click 'Superseded' while that input remains -> unrelated GTM26-0003 superseded v1 appeared; expected zero.
 * - Root Cause:
 *   ResultReports.jsx had fetchReports depending on query/statusFilter and effect fetchReports(1, '', statusFilter)
 *   launching unfiltered requests on keystroke and tab clicks without stale-response guard.
 *
 * Verifies:
 * 1. Component SSR:
 *    - Default props render search bar, 3 tabs (Published active), empty state / loading.
 *    - Custom initialQuery renders input value and clear button.
 *    - Populated initialReports renders report rows, client name, version badge.
 * 2. Mounted Component Query & Filter Lifecycle:
 *    - Mount dispatches exactly 1 search with initial applied query and status.
 *    - Typing into search input updates draft query without dispatching network requests.
 *    - Submitting search dispatches request with trimmed query and sets applied query.
 *    - Clicking 'Superseded' tab strictly preserves applied query ('GTM26-0002'), dispatching
 *      q='GTM26-0002'&status='SUPERSEDED' and NEVER dispatching an unfiltered empty-string query.
 *    - Clicking 'All Versions' tab preserves applied query ('GTM26-0002').
 *    - Clearing search resets draft query and applied query, dispatching q=''.
 *    - Pagination navigation preserves applied query and current status filter.
 * 3. Stale Response Discard & Out-of-Order Resolution:
 *    - Previous in-flight request is aborted via AbortController signal when a new request begins.
 *    - Delayed/reversed responses arriving out of order are dropped and do not overwrite fresher state.
 * 4. Backend Search Contract for GTM26-0002 / GTM26-0003:
 *    - GET /api/reports/search?q=GTM26-0002&status=ALL returns exactly 1 report (GTM26-0002 v1).
 *    - GET /api/reports/search?q=GTM26-0002&status=SUPERSEDED returns exactly 0 reports.
 *    - GET /api/reports/search?status=SUPERSEDED returns superseded reports (including GTM26-0003 v1).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const request = require('supertest');

const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');

const esbuild = require(path.resolve(__dirname, '../../../client/node_modules/esbuild'));
const React = require(path.resolve(__dirname, '../../../client/node_modules/react'));
const ReactDOMServer = require(path.resolve(__dirname, '../../../client/node_modules/react-dom/server'));

// ─── COMPONENT SSR & HARNESS LOADER ───
function loadResultReportsModule(customAxios = null, customReact = null) {
    const componentPath = path.resolve(__dirname, '../../../client/src/pages/ResultReports.jsx');
    const source = fs.readFileSync(componentPath, 'utf8');
    const transformed = esbuild.transformSync(source, { loader: 'jsx', format: 'cjs' });

    const mockLucide = new Proxy({}, {
        get: (target, prop) => (props) => React.createElement('span', { 'data-lucide': String(prop), ...props })
    });
    const mockLanguage = {
        useLanguage: () => ({
            t: (k, fb) => (typeof fb === 'string' ? fb : k),
            language: 'en'
        })
    };
    const mockAuth = {
        useAuth: () => ({
            user: { username: 'super_admin', role: 'SUPER_ADMIN', labId: 'LAB-GTM' },
            token: 'mock-token'
        })
    };
    const mockDialog = {
        useDialog: () => ({ showDialog: jest.fn() })
    };
    const mockRouter = {
        useSearchParams: () => [new URLSearchParams()],
        useNavigate: () => jest.fn(),
        useLocation: () => ({ pathname: '/result-reports', search: '' })
    };

    const moduleObj = { exports: {} };
    const runContext = {
        module: moduleObj,
        exports: moduleObj.exports,
        URLSearchParams,
        AbortController,
        window: {
            addEventListener: () => {},
            removeEventListener: () => {}
        },
        require: (mod) => {
            if (mod === 'react') return customReact || React;
            if (mod === 'lucide-react') return mockLucide;
            if (mod.includes('LanguageContext')) return mockLanguage;
            if (mod.includes('AuthContext')) return mockAuth;
            if (mod.includes('DialogContext')) return mockDialog;
            if (mod === 'react-router-dom') return mockRouter;
            if (mod === 'axios') return customAxios || {
                get: jest.fn().mockResolvedValue({ data: { reports: [], pagination: { total: 0 } } }),
                post: jest.fn().mockResolvedValue({ data: {} }),
                isCancel: () => false
            };
            return () => null;
        },
        console
    };

    vm.runInNewContext(transformed.code, runContext);
    return runContext.module.exports.default;
}

// ─── TREE SEARCH HELPERS ───
function findElement(node, predicate) {
    if (!node) return null;
    if (predicate(node)) return node;
    if (node.props?.children) {
        const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
        for (const child of children) {
            const found = findElement(child, predicate);
            if (found) return found;
        }
    }
    return null;
}

function findAllElements(node, predicate, acc = []) {
    if (!node) return acc;
    if (predicate(node)) acc.push(node);
    if (node.props?.children) {
        const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
        for (const child of children) {
            findAllElements(child, predicate, acc);
        }
    }
    return acc;
}

describe('Result Reports Query/Filter Lifecycle & Stale-Response Regression (#124)', () => {
    let superAdminToken;

    const testTs = Date.now();
    const sampleId0002 = `SMP-GTM26-0002-${testTs}`;
    const sampleId0003 = `SMP-GTM26-0003-${testTs}`;
    const reportId0002v1 = `RPT-GTM26-0002-V1-${testTs}`;
    const reportId0003v1 = `RPT-GTM26-0003-V1-${testTs}`;
    const reportId0003v2 = `RPT-GTM26-0003-V2-${testTs}`;

    beforeAll(async () => {
        superAdminToken = await getAuthToken('SUPER_ADMIN', null, ['*'], ['*']);

        // Seed Project
        await prisma.project.upsert({
            where: { code: 'GTM-SOIL-2026' },
            update: { name: 'National Soil Fertility Assessment' },
            create: { id: `PRJ-GTM-${testTs}`, code: 'GTM-SOIL-2026', name: 'National Soil Fertility Assessment', status: 'ACTIVE' }
        });

        // Seed Sample GTM26-0002 (Only has 1 report: PUBLISHED v1)
        await prisma.sample.create({
            data: {
                id: sampleId0002,
                labId: 'GTM26-0002',
                originalId: `FIELD-0002-${testTs}`,
                assignedLab: 'LAB-GTM',
                projectCode: 'GTM-SOIL-2026',
                status: 'APPROVED'
            }
        });

        // Seed Report GTM26-0002 v1: PUBLISHED
        await prisma.report.create({
            data: {
                id: reportId0002v1,
                sampleId: sampleId0002,
                labId: 'LAB-GTM',
                version: 1,
                status: 'PUBLISHED',
                firstName: 'Carlos',
                surname: 'Mendez',
                projectCode: 'GTM-SOIL-2026',
                projectName: 'National Soil Fertility Assessment',
                sampleLabId: 'GTM26-0002',
                generatedBy: 'test_manager'
            }
        });

        // Seed Sample GTM26-0003 (Has 2 reports: SUPERSEDED v1, PUBLISHED v2)
        await prisma.sample.create({
            data: {
                id: sampleId0003,
                labId: 'GTM26-0003',
                originalId: `FIELD-0003-${testTs}`,
                assignedLab: 'LAB-GTM',
                projectCode: 'GTM-SOIL-2026',
                status: 'APPROVED'
            }
        });

        // Seed Report GTM26-0003 v1: SUPERSEDED
        await prisma.report.create({
            data: {
                id: reportId0003v1,
                sampleId: sampleId0003,
                labId: 'LAB-GTM',
                version: 1,
                status: 'SUPERSEDED',
                firstName: 'Elena',
                surname: 'Rios',
                projectCode: 'GTM-SOIL-2026',
                projectName: 'National Soil Fertility Assessment',
                sampleLabId: 'GTM26-0003',
                generatedBy: 'test_manager'
            }
        });

        // Seed Report GTM26-0003 v2: PUBLISHED
        await prisma.report.create({
            data: {
                id: reportId0003v2,
                sampleId: sampleId0003,
                labId: 'LAB-GTM',
                version: 2,
                status: 'PUBLISHED',
                firstName: 'Elena',
                surname: 'Rios',
                projectCode: 'GTM-SOIL-2026',
                projectName: 'National Soil Fertility Assessment',
                sampleLabId: 'GTM26-0003',
                generatedBy: 'test_manager'
            }
        });
    });

    afterAll(async () => {
        await prisma.report.deleteMany({
            where: { id: { in: [reportId0002v1, reportId0003v1, reportId0003v2] } }
        });
        await prisma.sample.deleteMany({
            where: { id: { in: [sampleId0002, sampleId0003] } }
        });
    });

    // ─── 1. COMPONENT SSR RENDERING ───
    describe('1. Component SSR & Static Layout Regression', () => {
        test('Renders page header, search input, and 3 filter tabs with Published active by default', () => {
            const ResultReports = loadResultReportsModule();
            const markup = ReactDOMServer.renderToStaticMarkup(React.createElement(ResultReports));

            expect(markup).toContain('Result Reports');
            expect(markup).toContain('Search by name, phone, project, sample ID, or lab ID...');
            expect(markup).toContain('Published');
            expect(markup).toContain('Superseded');
            expect(markup).toContain('All Versions');
            // By default with no query, clear button is not present
            expect(markup).not.toContain('aria-label="Clear search"');
        });

        test('Renders clear button when initialQuery is provided', () => {
            const ResultReports = loadResultReportsModule();
            const markup = ReactDOMServer.renderToStaticMarkup(
                React.createElement(ResultReports, { initialQuery: 'GTM26-0002' })
            );

            expect(markup).toContain('value="GTM26-0002"');
            expect(markup).toContain('aria-label="Clear search"');
        });

        test('Renders populated reports table rows with version and client badges', () => {
            const ResultReports = loadResultReportsModule();
            const mockReports = [
                {
                    id: 'RPT-1',
                    sampleLabId: 'GTM26-0002',
                    firstName: 'Carlos',
                    surname: 'Mendez',
                    projectName: 'National Soil Fertility Assessment',
                    version: 1,
                    status: 'PUBLISHED',
                    generatedAt: new Date().toISOString(),
                    generatedBy: 'mgr_gtm',
                    shareLinks: [{ id: 'L-1' }]
                }
            ];

            const markup = ReactDOMServer.renderToStaticMarkup(
                React.createElement(ResultReports, {
                    initialReports: mockReports,
                    initialPagination: { total: 1, page: 1, pages: 1, limit: 25 }
                })
            );

            expect(markup).toContain('GTM26-0002');
            expect(markup).toContain('Carlos Mendez');
            expect(markup).toContain('v1');
            expect(markup).toContain('1 active');
            expect(markup).not.toContain('No reports found');
        });

        test('Renders truthful empty state when initialReports is empty', () => {
            const ResultReports = loadResultReportsModule();
            const markup = ReactDOMServer.renderToStaticMarkup(
                React.createElement(ResultReports, {
                    initialReports: [],
                    initialPagination: { total: 0, page: 1, pages: 1, limit: 25 }
                })
            );

            expect(markup).toContain('No reports found');
        });
    });

    // ─── 2. MOUNTED COMPONENT QUERY/FILTER LIFECYCLE ───
    describe('2. Mounted Component Query/Filter Lifecycle & State Transitions', () => {
        function setupInteractiveHarness() {
            let hooks = [];
            let hookIndex = 0;
            let effects = [];
            const axiosCalls = [];
            const abortSignals = [];

            const mockAxios = {
                get: jest.fn(async (url, config) => {
                    abortSignals.push(config?.signal);
                    axiosCalls.push({ url, params: { ...config?.params }, signal: config?.signal });
                    return {
                        data: {
                            reports: [{ id: 'RPT-1', sampleLabId: 'GTM26-0002', version: 1, status: 'PUBLISHED' }],
                            pagination: { total: 1, page: 1, limit: 25, pages: 1 }
                        }
                    };
                }),
                isCancel: () => false
            };

            const mockReact = {
                useState: (initial) => {
                    const idx = hookIndex++;
                    if (hooks[idx] === undefined) {
                        hooks[idx] = typeof initial === 'function' ? initial() : initial;
                    }
                    const setState = (newVal) => {
                        hooks[idx] = typeof newVal === 'function' ? newVal(hooks[idx]) : newVal;
                    };
                    return [hooks[idx], setState];
                },
                useRef: (initial) => {
                    const idx = hookIndex++;
                    if (hooks[idx] === undefined) {
                        hooks[idx] = { current: initial };
                    }
                    return hooks[idx];
                },
                useCallback: (fn) => fn,
                useEffect: (fn) => {
                    hookIndex++;
                    effects.push(fn);
                },
                createElement: (type, props, ...children) => ({
                    type,
                    props: { ...props, children: children.length === 1 ? children[0] : children }
                })
            };

            const Component = loadResultReportsModule(mockAxios, mockReact);

            function render(props = {}) {
                hookIndex = 0;
                effects = [];
                const vdom = Component(props);
                for (const eff of effects) eff();
                return vdom;
            }

            return { render, axiosCalls, mockAxios, abortSignals, getHooks: () => hooks };
        }

        test('Initial mount executes exactly 1 query with default PUBLISHED and empty search', () => {
            const h = setupInteractiveHarness();
            h.render();

            expect(h.axiosCalls.length).toBe(1);
            expect(h.axiosCalls[0].params).toEqual({
                q: '',
                page: 1,
                limit: 25,
                status: 'PUBLISHED'
            });
        });

        test('Typing in search input updates draft query WITHOUT dispatching requests or resetting table', () => {
            const h = setupInteractiveHarness();
            let tree = h.render();
            expect(h.axiosCalls.length).toBe(1);

            const input = findElement(tree, el => el.type === 'input' && el.props?.placeholder?.includes('Search'));
            expect(input).not.toBeNull();

            // Simulate typing keystroke
            input.props.onChange({ target: { value: 'GTM26-0002' } });
            tree = h.render();

            // Still exactly 1 call from initial mount! No request dispatched on keystroke
            expect(h.axiosCalls.length).toBe(1);
        });

        test('Submitting search form dispatches request with trimmed query and sets applied query', async () => {
            const h = setupInteractiveHarness();
            let tree = h.render();

            const input = findElement(tree, el => el.type === 'input' && el.props?.placeholder?.includes('Search'));
            input.props.onChange({ target: { value: '  GTM26-0002  ' } });
            tree = h.render();

            const form = findElement(tree, el => el.type === 'form');
            form.props.onSubmit({ preventDefault: () => {} });
            await new Promise(r => setTimeout(r, 10));
            tree = h.render();

            expect(h.axiosCalls.length).toBe(2);
            expect(h.axiosCalls[1].params).toEqual({
                q: 'GTM26-0002',
                page: 1,
                limit: 25,
                status: 'PUBLISHED'
            });
        });

        test('Exact transition: clicking Superseded tab retains applied query and does NOT fire empty-string request', async () => {
            const h = setupInteractiveHarness();
            let tree = h.render();

            // 1. Submit search 'GTM26-0002'
            const input = findElement(tree, el => el.type === 'input' && el.props?.placeholder?.includes('Search'));
            input.props.onChange({ target: { value: 'GTM26-0002' } });
            tree = h.render();
            const form = findElement(tree, el => el.type === 'form');
            form.props.onSubmit({ preventDefault: () => {} });
            await new Promise(r => setTimeout(r, 10));
            tree = h.render();

            // 2. Click 'Superseded' status tab
            const buttons = findAllElements(tree, el => el.type === 'button');
            const supersededBtn = buttons.find(b => b.props?.children === 'Superseded');
            expect(supersededBtn).toBeDefined();

            supersededBtn.props.onClick();
            await new Promise(r => setTimeout(r, 10));
            tree = h.render();

            // Exactly 3 calls total: mount (PUBLISHED, q=''), search (PUBLISHED, q='GTM26-0002'), tab (SUPERSEDED, q='GTM26-0002')
            expect(h.axiosCalls.length).toBe(3);
            expect(h.axiosCalls[2].params).toEqual({
                q: 'GTM26-0002',
                page: 1,
                limit: 25,
                status: 'SUPERSEDED'
            });

            // Crucially: NO call had q: '' when switching to Superseded while input had GTM26-0002!
            const supersededCalls = h.axiosCalls.filter(c => c.params?.status === 'SUPERSEDED');
            expect(supersededCalls.length).toBe(1);
            expect(supersededCalls[0].params.q).toBe('GTM26-0002');
        });

        test('Clicking All Versions tab retains applied query and dispatches status ALL', async () => {
            const h = setupInteractiveHarness();
            let tree = h.render();

            // Apply search
            const input = findElement(tree, el => el.type === 'input' && el.props?.placeholder?.includes('Search'));
            input.props.onChange({ target: { value: 'GTM26-0002' } });
            tree = h.render();
            const form = findElement(tree, el => el.type === 'form');
            form.props.onSubmit({ preventDefault: () => {} });
            await new Promise(r => setTimeout(r, 10));
            tree = h.render();

            // Click All Versions
            const buttons = findAllElements(tree, el => el.type === 'button');
            const allBtn = buttons.find(b => b.props?.children === 'All Versions');
            allBtn.props.onClick();
            await new Promise(r => setTimeout(r, 10));
            tree = h.render();

            const latestCall = h.axiosCalls[h.axiosCalls.length - 1];
            expect(latestCall.params).toEqual({
                q: 'GTM26-0002',
                page: 1,
                limit: 25,
                status: 'ALL'
            });
        });

        test('Clear button resets draft query, resets applied query, and dispatches unfiltered search', async () => {
            const h = setupInteractiveHarness();
            let tree = h.render();

            // Apply search
            const input = findElement(tree, el => el.type === 'input' && el.props?.placeholder?.includes('Search'));
            input.props.onChange({ target: { value: 'GTM26-0002' } });
            tree = h.render();
            const form = findElement(tree, el => el.type === 'form');
            form.props.onSubmit({ preventDefault: () => {} });
            await new Promise(r => setTimeout(r, 10));
            tree = h.render();

            // Click clear button
            const clearBtn = findElement(tree, el => el.props?.['aria-label'] === 'Clear search');
            expect(clearBtn).not.toBeNull();
            clearBtn.props.onClick();
            await new Promise(r => setTimeout(r, 10));
            tree = h.render();

            const latestCall = h.axiosCalls[h.axiosCalls.length - 1];
            expect(latestCall.params).toEqual({
                q: '',
                page: 1,
                limit: 25,
                status: 'PUBLISHED'
            });
        });

        test('Pagination preserves applied query and status filter on page change', async () => {
            const h = setupInteractiveHarness();
            let tree = h.render();

            // Apply search
            const input = findElement(tree, el => el.type === 'input' && el.props?.placeholder?.includes('Search'));
            input.props.onChange({ target: { value: 'GTM26-0002' } });
            tree = h.render();
            const form = findElement(tree, el => el.type === 'form');
            form.props.onSubmit({ preventDefault: () => {} });
            await new Promise(r => setTimeout(r, 10));

            // Mock multi-page response to show pagination controls
            h.getHooks()[5] = { total: 50, page: 1, pages: 2, limit: 25 }; // pagination state
            tree = h.render();

            // Find next page button
            const paginationBtns = findAllElements(tree, el => el.type === 'button' && el.props?.className?.includes('p-1.5'));
            const nextBtn = paginationBtns[1]; // ChevronRight button
            expect(nextBtn).toBeDefined();

            nextBtn.props.onClick();
            await new Promise(r => setTimeout(r, 10));
            tree = h.render();

            const latestCall = h.axiosCalls[h.axiosCalls.length - 1];
            expect(latestCall.params).toEqual({
                q: 'GTM26-0002',
                page: 2,
                limit: 25,
                status: 'PUBLISHED'
            });
        });
    });

    // ─── 3. STALE RESPONSE DISCARD & ORDERING RACES ───
    describe('3. Stale Response Discard & Reversed Response Ordering', () => {
        test('Aborts in-flight request and drops delayed stale response arriving out of order', async () => {
            let hooks = [];
            let hookIndex = 0;
            let effects = [];
            const abortSignals = [];
            const resolvers = [];

            const mockAxios = {
                get: jest.fn((url, config) => {
                    abortSignals.push(config?.signal);
                    return new Promise((resolve) => {
                        resolvers.push({
                            params: config?.params,
                            resolve: (data) => resolve({ data })
                        });
                    });
                }),
                isCancel: () => false
            };

            const mockReact = {
                useState: (initial) => {
                    const idx = hookIndex++;
                    if (hooks[idx] === undefined) {
                        hooks[idx] = typeof initial === 'function' ? initial() : initial;
                    }
                    const setState = (newVal) => {
                        hooks[idx] = typeof newVal === 'function' ? newVal(hooks[idx]) : newVal;
                    };
                    return [hooks[idx], setState];
                },
                useRef: (initial) => {
                    const idx = hookIndex++;
                    if (hooks[idx] === undefined) {
                        hooks[idx] = { current: initial };
                    }
                    return hooks[idx];
                },
                useCallback: (fn) => fn,
                useEffect: (fn) => {
                    hookIndex++;
                    effects.push(fn);
                },
                createElement: (type, props, ...children) => ({
                    type,
                    props: { ...props, children: children.length === 1 ? children[0] : children }
                })
            };

            const Component = loadResultReportsModule(mockAxios, mockReact);

            function render() {
                hookIndex = 0;
                effects = [];
                const vdom = Component();
                for (const eff of effects) eff();
                return vdom;
            }

            let tree = render();
            // Resolve mount request
            resolvers[0].resolve({ reports: [{ id: 'R-INIT' }], pagination: { total: 1 } });
            await new Promise(r => setTimeout(r, 10));
            tree = render();

            const buttons = findAllElements(tree, el => el.type === 'button');
            const supersededBtn = buttons.find(b => b.props?.children === 'Superseded');
            const allBtn = buttons.find(b => b.props?.children === 'All Versions');

            // Dispatch Request 1: click Superseded
            supersededBtn.props.onClick();
            expect(abortSignals[1].aborted).toBe(false);

            // Dispatch Request 2: click All Versions immediately after
            allBtn.props.onClick();
            // Request 1 must be aborted when Request 2 starts
            expect(abortSignals[1].aborted).toBe(true);
            expect(abortSignals[2].aborted).toBe(false);

            // Resolve Request 2 FIRST with fresh data
            resolvers[2].resolve({
                reports: [{ id: 'R-ALL-1' }, { id: 'R-ALL-2' }],
                pagination: { total: 2 }
            });
            await new Promise(r => setTimeout(r, 10));
            tree = render();

            let reportsState = hooks[0];
            expect(reportsState.length).toBe(2);
            expect(reportsState[0].id).toBe('R-ALL-1');

            // Resolve Request 1 LATER (stale / delayed response)
            resolvers[1].resolve({
                reports: [{ id: 'R-STALE-SUPERSEDED' }],
                pagination: { total: 1 }
            });
            await new Promise(r => setTimeout(r, 10));
            tree = render();

            // State must NOT be overwritten by stale Request 1
            reportsState = hooks[0];
            expect(reportsState.length).toBe(2);
            expect(reportsState[0].id).toBe('R-ALL-1');
        });
    });

    // ─── 4. BACKEND SEARCH CONTRACT FOR GTM26-0002 / GTM26-0003 ───
    describe('4. Backend /api/reports/search Scope & Disambiguation Contract', () => {
        test('GTM26-0002 in All Versions returns exactly 1 report (v1 PUBLISHED)', async () => {
            const res = await request(app)
                .get('/api/reports/search')
                .query({ q: 'GTM26-0002', status: 'ALL' })
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.reports).toBeDefined();
            expect(res.body.reports.length).toBe(1);
            expect(res.body.reports[0].sampleLabId).toBe('GTM26-0002');
            expect(res.body.reports[0].version).toBe(1);
            expect(res.body.reports[0].status).toBe('PUBLISHED');
        });

        test('GTM26-0002 in Superseded strictly returns 0 reports (truthful no-match)', async () => {
            const res = await request(app)
                .get('/api/reports/search')
                .query({ q: 'GTM26-0002', status: 'SUPERSEDED' })
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.reports).toBeDefined();
            expect(res.body.reports.length).toBe(0);
            expect(res.body.pagination.total).toBe(0);
        });

        test('Unfiltered status=SUPERSEDED returns GTM26-0003 v1 (demonstrating why empty query was a bug)', async () => {
            const res = await request(app)
                .get('/api/reports/search')
                .query({ q: '', status: 'SUPERSEDED' })
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.reports).toBeDefined();
            // GTM26-0003 has a superseded v1 report
            const gtm0003 = res.body.reports.find(r => r.sampleLabId === 'GTM26-0003');
            expect(gtm0003).toBeDefined();
            expect(gtm0003.version).toBe(1);
            expect(gtm0003.status).toBe('SUPERSEDED');
        });

        test('GTM26-0003 in All Versions returns both v1 and v2', async () => {
            const res = await request(app)
                .get('/api/reports/search')
                .query({ q: 'GTM26-0003', status: 'ALL' })
                .set('Authorization', `Bearer ${superAdminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.reports).toBeDefined();
            expect(res.body.reports.length).toBe(2);
            const versions = res.body.reports.map(r => r.version).sort();
            expect(versions).toEqual([1, 2]);
        });
    });
});
