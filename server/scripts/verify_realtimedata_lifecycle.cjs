/**
 * verify_realtimedata_lifecycle.cjs
 *
 * Verifies useRealtimeData and ManagerQueue request lifecycle, including:
 *  - Delayed old-scope response / error discard (stale-response race guard)
 *  - Initial request overtaken by refresh / poll clearing loading (no hang)
 *  - Initial request overtaken by failing refresh setting error and clearing loading
 *  - Ordinary same-scope refresh preserving data during background fetch
 *  - Component unmount cleanup discarding subsequent resolves/rejects
 */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const codexRuntime = path.resolve(repoRoot, '../Codex/2026-09-21/se/work/review-react-runtime');

let React, Renderer;
try {
    React = require(path.join(codexRuntime, 'node_modules/react'));
    Renderer = require(path.join(codexRuntime, 'node_modules/react-test-renderer'));
} catch (e) {
    console.error('react-test-renderer runtime not found at ' + codexRuntime);
    process.exit(1);
}

const { act } = Renderer;
const esbuild = require(path.join(repoRoot, 'client/node_modules/esbuild'));

const noop = () => {};
const t = (key, fallback) => typeof fallback === 'string' ? fallback : key;

function createRealtimeHookModule(pendingList) {
    const mod = { exports: {} };
    const code = esbuild.transformSync(fs.readFileSync(path.join(repoRoot, 'client/src/hooks/useRealtimeData.js'), 'utf8'), {
        loader: 'js',
        format: 'cjs'
    }).code;

    vm.runInNewContext(code, {
        module: mod,
        exports: mod.exports,
        console,
        Date,
        document: { hidden: false, addEventListener: noop, removeEventListener: noop },
        setInterval: () => 1,
        clearInterval: noop,
        setTimeout: () => 1,
        clearTimeout: noop,
        require: name => {
            if (name === 'react') return React;
            if (name === 'axios') return {
                get: (url, config) => new Promise((resolve, reject) => pendingList.push({ url, config, resolve, reject }))
            };
            if (name.includes('NotificationContext')) return { useNotifications: () => ({}) };
            throw new Error('Unexpected require: ' + name);
        }
    });

    return mod.exports.useRealtimeData;
}

function createManagerQueueModule(pendingList, searchParamsGetter, setSearchParamsFn) {
    const mod = { exports: {} };
    const code = esbuild.transformSync(fs.readFileSync(path.join(repoRoot, 'client/src/pages/ManagerQueue.jsx'), 'utf8'), {
        loader: 'jsx',
        format: 'cjs',
        jsx: 'automatic'
    }).code;

    vm.runInNewContext(code, {
        module: mod,
        exports: mod.exports,
        console,
        URLSearchParams,
        setTimeout,
        clearTimeout,
        require: name => {
            if (name === 'react') return React;
            if (name === 'react/jsx-runtime') return require(path.join(codexRuntime, 'node_modules/react/jsx-runtime'));
            if (name === 'axios') return {
                get: (url, config) => new Promise((resolve, reject) => pendingList.push({ url, config, resolve, reject }))
            };
            if (name === 'react-router-dom') return {
                useNavigate: () => noop,
                useSearchParams: () => [searchParamsGetter(), setSearchParamsFn || noop]
            };
            if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
            if (name.includes('LanguageContext')) return { useLanguage: () => ({ t }) };
            if (name.includes('AnalysisCatalogueContext')) return { useAnalysisNames: () => code => code };
            if (name.includes('NotificationContext')) return { useNotifications: () => ({ subscribeToEvent: () => noop }) };
            if (name.includes('useRealtimeData')) return {
                useRealtimeData: url => ({ data: null, isLive: false, isStale: false, lastUpdated: null, refresh: noop }),
                formatLastUpdated: () => ''
            };
            return { default: () => null, __esModule: true };
        }
    });

    return mod.exports.default;
}

async function runAllTests() {
    const results = [];

    // --- TEST 1: useRealtimeData: Delayed A success after B success ---
    {
        const pending = [];
        const useRealtimeData = createRealtimeHookModule(pending);
        let observed, root;
        function Harness({ url }) { observed = useRealtimeData(url); return null; }

        await act(async () => { root = Renderer.create(React.createElement(Harness, { url: '/api/dashboard/live?labId=LAB-A' })); });
        await act(async () => { root.update(React.createElement(Harness, { url: '/api/dashboard/live?labId=LAB-B' })); });

        await act(async () => { pending[1].resolve({ data: { lab: 'LAB-B', kpis: { pendingIntakes: 2 } } }); });
        const afterB = { ...observed.data };

        await act(async () => { pending[0].resolve({ data: { lab: 'LAB-A', kpis: { pendingIntakes: 91 } } }); });
        const afterLateA = { ...observed.data };

        const pass = afterB.lab === 'LAB-B' && afterLateA.lab === 'LAB-B' && afterLateA.kpis.pendingIntakes === 2;
        results.push({ name: 'useRealtimeData: Delayed A success after B success does not overwrite B', pass, details: { afterB, afterLateA } });
        await act(async () => root.unmount());
    }

    // --- TEST 2: useRealtimeData: Delayed A error after B success ---
    {
        const pending = [];
        const useRealtimeData = createRealtimeHookModule(pending);
        let observed, root;
        function Harness({ url }) { observed = useRealtimeData(url); return null; }

        await act(async () => { root = Renderer.create(React.createElement(Harness, { url: '/api/dashboard/live?labId=LAB-A' })); });
        await act(async () => { root.update(React.createElement(Harness, { url: '/api/dashboard/live?labId=LAB-B' })); });

        await act(async () => { pending[1].resolve({ data: { lab: 'LAB-B', kpis: { pendingIntakes: 2 } } }); });
        await act(async () => { pending[0].reject(new Error('Delayed network failure on LAB-A')); });

        const pass = observed.data?.lab === 'LAB-B' && observed.error === null;
        results.push({ name: 'useRealtimeData: Delayed A error after B success does not set error or clear data', pass, details: { data: observed.data, error: observed.error } });
        await act(async () => root.unmount());
    }

    // --- TEST 3: useRealtimeData: Delayed A success after B request starts (before B resolves) ---
    {
        const pending = [];
        const useRealtimeData = createRealtimeHookModule(pending);
        let observed, root;
        function Harness({ url }) { observed = useRealtimeData(url); return null; }

        await act(async () => { root = Renderer.create(React.createElement(Harness, { url: '/api/dashboard/live?labId=LAB-A' })); });
        await act(async () => { root.update(React.createElement(Harness, { url: '/api/dashboard/live?labId=LAB-B' })); });

        const beforeResolve = { data: observed.data, loading: observed.loading };
        await act(async () => { pending[0].resolve({ data: { lab: 'LAB-A', kpis: { pendingIntakes: 91 } } }); });
        const afterLateAWhileBPending = { data: observed.data, loading: observed.loading };

        await act(async () => { pending[1].resolve({ data: { lab: 'LAB-B', kpis: { pendingIntakes: 5 } } }); });
        const afterBResolves = { data: observed.data, loading: observed.loading };

        const pass = beforeResolve.data === null &&
            afterLateAWhileBPending.data === null &&
            afterLateAWhileBPending.loading === true &&
            afterBResolves.data?.lab === 'LAB-B' &&
            afterBResolves.loading === false;

        results.push({ name: 'useRealtimeData: Delayed A success while B pending is withheld, loading preserved', pass, details: { beforeResolve, afterLateAWhileBPending, afterBResolves } });
        await act(async () => root.unmount());
    }

    // --- TEST 4: useRealtimeData: Delayed A error after B request starts (before B resolves) ---
    {
        const pending = [];
        const useRealtimeData = createRealtimeHookModule(pending);
        let observed, root;
        function Harness({ url }) { observed = useRealtimeData(url); return null; }

        await act(async () => { root = Renderer.create(React.createElement(Harness, { url: '/api/dashboard/live?labId=LAB-A' })); });
        await act(async () => { root.update(React.createElement(Harness, { url: '/api/dashboard/live?labId=LAB-B' })); });

        await act(async () => { pending[0].reject(new Error('Old lab network error')); });
        const afterLateAErrorWhileBPending = { error: observed.error, loading: observed.loading };

        await act(async () => { pending[1].resolve({ data: { lab: 'LAB-B', kpis: { pendingIntakes: 7 } } }); });
        const finalState = { data: observed.data, error: observed.error, loading: observed.loading };

        const pass = afterLateAErrorWhileBPending.error === null &&
            afterLateAErrorWhileBPending.loading === true &&
            finalState.data?.lab === 'LAB-B' &&
            finalState.error === null &&
            finalState.loading === false;

        results.push({ name: 'useRealtimeData: Delayed A error while B pending does not trigger error or cancel loading', pass, details: { afterLateAErrorWhileBPending, finalState } });
        await act(async () => root.unmount());
    }

    // --- TEST 5: useRealtimeData: Unmount cleanup safety ---
    {
        const pending = [];
        const useRealtimeData = createRealtimeHookModule(pending);
        let observed, root;
        function Harness({ url }) { observed = useRealtimeData(url); return null; }

        await act(async () => { root = Renderer.create(React.createElement(Harness, { url: '/api/dashboard/live?labId=LAB-A' })); });
        await act(async () => root.unmount());

        let unmountError = null;
        try {
            await act(async () => { pending[0].resolve({ data: { lab: 'LAB-A', kpis: { pendingIntakes: 91 } } }); });
        } catch (e) {
            unmountError = e;
        }

        const pass = unmountError === null;
        results.push({ name: 'useRealtimeData: Late response after unmount safely discarded', pass, details: { unmountError } });
    }

    // --- TEST 5b: useRealtimeData: Initial request overtaken by refresh resolves with loading=false ---
    {
        const pending = [];
        const useRealtimeData = createRealtimeHookModule(pending);
        let observed, root;
        function Harness() { observed = useRealtimeData('/api/dashboard/live?labId=LAB-B'); return null; }

        await act(async () => { root = Renderer.create(React.createElement(Harness)); });
        let refreshPromise;
        await act(async () => { refreshPromise = observed.refresh(); });

        await act(async () => { pending[1].resolve({ data: { lab: 'LAB-B', kpis: { pendingIntakes: 2 } } }); await refreshPromise; });
        const afterRefresh = { data: observed.data, loading: observed.loading };

        await act(async () => { pending[0].resolve({ data: { lab: 'LAB-B', kpis: { pendingIntakes: 1 } } }); });
        const afterAllSettled = { data: observed.data, loading: observed.loading };

        const pass = afterRefresh.loading === false &&
            afterAllSettled.loading === false &&
            afterAllSettled.data?.kpis?.pendingIntakes === 2;

        results.push({ name: 'useRealtimeData: Initial request overtaken by refresh clears loading without hanging', pass, details: { afterRefresh, afterAllSettled } });
        await act(async () => root.unmount());
    }

    // --- TEST 5c: useRealtimeData: Initial request overtaken by failing refresh sets error and clears loading ---
    {
        const pending = [];
        const useRealtimeData = createRealtimeHookModule(pending);
        let observed, root;
        function Harness() { observed = useRealtimeData('/api/dashboard/live?labId=LAB-B'); return null; }

        await act(async () => { root = Renderer.create(React.createElement(Harness)); });
        let refreshPromise;
        await act(async () => { refreshPromise = observed.refresh(); });

        await act(async () => { pending[1].reject(new Error('Network error on refresh')); });
        const afterRefreshFail = { error: observed.error, loading: observed.loading };

        await act(async () => { pending[0].resolve({ data: { lab: 'LAB-B', kpis: { pendingIntakes: 1 } } }); });
        const afterAllSettled = { error: observed.error, loading: observed.loading, data: observed.data };

        const pass = afterRefreshFail.loading === false &&
            afterRefreshFail.error === 'Network error on refresh' &&
            afterAllSettled.loading === false &&
            afterAllSettled.error === 'Network error on refresh' &&
            afterAllSettled.data === null;

        results.push({ name: 'useRealtimeData: Initial request overtaken by failing refresh sets error and clears loading', pass, details: { afterRefreshFail, afterAllSettled } });
        await act(async () => root.unmount());
    }

    // --- TEST 5d: useRealtimeData: Ordinary same-scope refresh preserves data while loading in background ---
    {
        const pending = [];
        const useRealtimeData = createRealtimeHookModule(pending);
        let observed, root;
        function Harness() { observed = useRealtimeData('/api/dashboard/live?labId=LAB-B'); return null; }

        await act(async () => { root = Renderer.create(React.createElement(Harness)); });
        await act(async () => { pending[0].resolve({ data: { lab: 'LAB-B', kpis: { pendingIntakes: 10 } } }); });
        const initialDone = { data: observed.data, loading: observed.loading };

        await act(async () => { observed.refresh(); });
        const whileRefreshPending = { data: observed.data, loading: observed.loading };

        await act(async () => { pending[1].resolve({ data: { lab: 'LAB-B', kpis: { pendingIntakes: 15 } } }); });
        const afterRefreshSettled = { data: observed.data, loading: observed.loading };

        const pass = initialDone.data?.kpis?.pendingIntakes === 10 &&
            whileRefreshPending.data?.kpis?.pendingIntakes === 10 &&
            whileRefreshPending.loading === false &&
            afterRefreshSettled.data?.kpis?.pendingIntakes === 15 &&
            afterRefreshSettled.loading === false;

        results.push({ name: 'useRealtimeData: Ordinary same-scope refresh preserves data while loading in background', pass, details: { initialDone, whileRefreshPending, afterRefreshSettled } });
        await act(async () => root.unmount());
    }

    // --- TEST 6: ManagerQueue: Delayed A error after B request starts does not set queue error ---
    {
        const pending = [];
        let params = new URLSearchParams('lane=intake&labId=LAB-A');
        const ManagerQueue = createManagerQueueModule(pending, () => params, next => { params = next; });
        let root;

        await act(async () => { root = Renderer.create(React.createElement(ManagerQueue)); });
        await act(async () => {
            params = new URLSearchParams('lane=intake&labId=LAB-B');
            root.update(React.createElement(ManagerQueue));
        });

        await act(async () => { pending[0].reject(new Error('Connection abort in LAB-A')); });

        const errorNodesBeforeB = root.root.findAllByProps({ className: 'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between' });

        await act(async () => {
            pending[1].resolve({
                data: {
                    data: [{ id: 'SMP-HND-REC', labId: 'LAB-HND', sampleDisplayId: 'SMP-HND-REC', status: 'RECEIVED' }],
                    meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
                }
            });
        });

        const errorNodesAfterB = root.root.findAllByProps({ className: 'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between' });

        const pass = errorNodesBeforeB.length === 0 && errorNodesAfterB.length === 0;
        results.push({ name: 'ManagerQueue: Delayed A error after B starts does not trigger queue error', pass, details: { errorNodesBeforeB: errorNodesBeforeB.length, errorNodesAfterB: errorNodesAfterB.length } });
        await act(async () => root.unmount());
    }

    // --- TEST 7: ManagerQueue: Delayed A error after B success does not overwrite B ---
    {
        const pending = [];
        let params = new URLSearchParams('lane=intake&labId=LAB-A');
        const ManagerQueue = createManagerQueueModule(pending, () => params, next => { params = next; });
        let root;

        await act(async () => { root = Renderer.create(React.createElement(ManagerQueue)); });
        await act(async () => {
            params = new URLSearchParams('lane=intake&labId=LAB-B');
            root.update(React.createElement(ManagerQueue));
        });

        await act(async () => {
            pending[1].resolve({
                data: {
                    data: [{ id: 'SMP-HND-REC', labId: 'LAB-HND', sampleDisplayId: 'SMP-HND-REC', status: 'RECEIVED' }],
                    meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
                }
            });
        });

        await act(async () => { pending[0].reject(new Error('Late network error')); });

        const errorNodes = root.root.findAllByProps({ className: 'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between' });
        const pass = errorNodes.length === 0;
        results.push({ name: 'ManagerQueue: Delayed A error after B success does not trigger queue error', pass, details: { errorNodes: errorNodes.length } });
        await act(async () => root.unmount());
    }

    // --- TEST 8: ManagerQueue: Delayed A success after B success does not overwrite B rows ---
    {
        const pending = [];
        let params = new URLSearchParams('lane=intake&labId=LAB-A');
        const ManagerQueue = createManagerQueueModule(pending, () => params, next => { params = next; });
        let root;

        await act(async () => { root = Renderer.create(React.createElement(ManagerQueue)); });
        await act(async () => {
            params = new URLSearchParams('lane=intake&labId=LAB-B');
            root.update(React.createElement(ManagerQueue));
        });

        await act(async () => {
            pending[1].resolve({
                data: {
                    data: [{ id: 'SMP-HND-REC', labId: 'LAB-HND', sampleDisplayId: 'SMP-HND-REC', status: 'RECEIVED' }],
                    meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
                }
            });
        });

        await act(async () => {
            pending[0].resolve({
                data: {
                    data: [{ id: 'SMP-GTM-REC', labId: 'LAB-GTM', sampleDisplayId: 'SMP-GTM-REC', status: 'RECEIVED' }],
                    meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
                }
            });
        });

        const textContent = JSON.stringify(root.toJSON());
        const hasHnd = textContent.includes('SMP-HND-REC');
        const hasGtm = textContent.includes('SMP-GTM-REC');

        const pass = hasHnd && !hasGtm;
        results.push({ name: 'ManagerQueue: Delayed A success after B success does not overwrite B rows', pass, details: { hasHnd, hasGtm } });
        await act(async () => root.unmount());
    }

    // --- TEST 9: ManagerQueue: Delayed A completion does not end B loading spinner prematurely ---
    {
        const pending = [];
        let params = new URLSearchParams('lane=intake&labId=LAB-A');
        const ManagerQueue = createManagerQueueModule(pending, () => params, next => { params = next; });
        let root;

        await act(async () => { root = Renderer.create(React.createElement(ManagerQueue)); });
        await act(async () => {
            params = new URLSearchParams('lane=intake&labId=LAB-B');
            root.update(React.createElement(ManagerQueue));
        });

        await act(async () => {
            pending[0].resolve({
                data: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } }
            });
        });

        const spinnersBeforeB = root.root.findAllByProps({ className: 'animate-spin text-indigo-600' });

        await act(async () => {
            pending[1].resolve({
                data: {
                    data: [{ id: 'SMP-HND-REC', labId: 'LAB-HND', sampleDisplayId: 'SMP-HND-REC', status: 'RECEIVED' }],
                    meta: { page: 1, limit: 20, total: 1, totalPages: 1 }
                }
            });
        });

        const spinnersAfterB = root.root.findAllByProps({ className: 'animate-spin text-indigo-600' });

        const pass = spinnersBeforeB.length > 0 && spinnersAfterB.length === 0;
        results.push({ name: 'ManagerQueue: Delayed A completion does not end B loading spinner prematurely', pass, details: { spinnersBeforeB: spinnersBeforeB.length, spinnersAfterB: spinnersAfterB.length } });
        await act(async () => root.unmount());
    }

    // --- TEST 10: ManagerQueue: Late rejection after unmount safely discarded ---
    {
        const pending = [];
        let params = new URLSearchParams('lane=intake&labId=LAB-A');
        const ManagerQueue = createManagerQueueModule(pending, () => params, next => { params = next; });
        let root;

        await act(async () => { root = Renderer.create(React.createElement(ManagerQueue)); });
        await act(async () => root.unmount());

        let unmountError = null;
        try {
            await act(async () => { pending[0].reject(new Error('Network error after unmount')); });
        } catch (e) {
            unmountError = e;
        }

        const pass = unmountError === null;
        results.push({ name: 'ManagerQueue: Late rejection after unmount safely discarded', pass, details: { unmountError } });
    }

    const allPassed = results.every(r => r.pass);
    console.log(JSON.stringify({
        summary: allPassed ? 'ALL_TESTS_PASSED' : 'TESTS_FAILED',
        total: results.length,
        passed: results.filter(r => r.pass).length,
        failed: results.filter(r => !r.pass).length,
        tests: results
    }, null, 2));

    if (!allPassed) process.exitCode = 1;
}

runAllTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exitCode = 1;
});
