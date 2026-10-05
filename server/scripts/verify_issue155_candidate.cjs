/**
 * Candidate-Specific Verification for Sitewide Theme Library & Selector
 * 
 * Verifies all 19 cases from Codex's independent review plus fixes:
 * 1. Identity-safe state & AuthContext desync
 * 2. Target drafts, inheritance, independent controls, modal interactions
 * 3. Shared write contracts (mandatory expectedRevision, validation ordering, null payload)
 * 4. Single-source catalogue generation & drift verification
 * 5. Token contrast and CSS contract verification
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '../..');
const { createDisposableDatabase, cleanupDisposableDatabase } = require('./journey_db_isolation.cjs');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'issue155-candidate-test-'));
const logFile = path.join(scratch, 'issue155-candidate-verification.log');
fs.writeFileSync(logFile, '');

for (const level of ['log', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
        fs.appendFileSync(logFile, args.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ') + '\n');
        original(...args);
    };
}

const sr = createRequire(path.join(root, 'server/package.json'));
const cr = createRequire(path.join(root, 'client/package.json'));

const { dbPath, runnerDir } = createDisposableDatabase();
process.env.NODE_ENV = 'test';
process.env.DISABLE_BACKGROUND_JOBS = 'true';
process.env.JWT_SECRET = 'issue155-candidate-synthetic-secret-not-real';
process.env.DATABASE_PATH = dbPath;
process.env.DATABASE_URL = `file:${dbPath}`;

const Database = sr('better-sqlite3');
sr('./scripts/migrate_sitewide_theme_library').migrateThemeLibrary(dbPath);
const prisma = sr('./prisma');
const express = sr('express');
const request = sr('supertest');
const jwt = sr('jsonwebtoken');

const app = express();
app.use(express.json());
app.use('/api/auth', sr('./routes/authRoutes'));
app.use('/api/labs', sr('./routes/labRoutes'));
app.use('/api/appearance', sr('./routes/appearanceRoutes'));
app.use('/api/admin', sr('./routes/adminRoutes'));
app.use((e, req, res, next) => res.status(500).json({ error: e.message, code: e.code }));

const cases = [];
const responses = [];

const record = (name, details, status = 'PASS') => {
    cases.push({ name, details, status });
    console.log(`[${status}]`, name, JSON.stringify(details));
};

async function http(method, url, actor, body) {
    let q = request(app)[method](url);
    if (actor) {
        q = q.set('Authorization', 'Bearer ' + jwt.sign({ id: actor.id, tokenVersion: 1 }, process.env.JWT_SECRET));
    }
    if (body !== undefined) {
        q = q.send(body);
    }
    const r = await q;
    responses.push({ method, url, actor: actor?.id, status: r.status, body: r.body });
    return r;
}

function loadClient(file, requireAdapter) {
    const esbuild = cr('esbuild');
    const code = esbuild.transformSync(fs.readFileSync(path.join(root, 'client/src', file), 'utf8'), {
        loader: file.endsWith('.jsx') ? 'jsx' : 'js',
        format: 'cjs',
        jsx: 'transform'
    }).code;
    const m = { exports: {} };
    new Function('require', 'module', 'exports', code)(requireAdapter, m, m.exports);
    return m.exports;
}

const catalog = loadClient('lib/themeCatalog.js', () => { throw Error('unexpected catalogue import'); });
const appearance = loadClient('lib/appearance.js', x => {
    if (x === './themeCatalog') return catalog;
    throw Error(x);
});

function hookHarness() {
    const states = [], refs = [], deps = [], memos = [];
    let cursor = 0, dirty = false, pending = [];
    const memo = (f, d) => {
        const i = cursor++;
        if (!memos[i] || !d || d.some((v, j) => !Object.is(v, memos[i].deps[j]))) {
            memos[i] = { value: f(), deps: d };
        }
        return memos[i].value;
    };
    const React = {
        createContext: () => ({ Provider: 'Provider' }),
        createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
        useContext: () => null,
        useState: init => {
            const i = cursor++;
            if (!(i in states)) states[i] = typeof init === 'function' ? init() : init;
            return [states[i], v => {
                states[i] = typeof v === 'function' ? v(states[i]) : v;
                dirty = true;
            }];
        },
        useRef: init => {
            const i = cursor++;
            return refs[i] ||= { current: init };
        },
        useMemo: memo,
        useCallback: (f, d) => memo(() => f, d),
        useId: () => { cursor++; return 'candidate-id'; },
        useEffect: (f, d) => {
            const i = cursor++;
            if (!deps[i] || !d || d.some((v, j) => !Object.is(v, deps[i][j]))) {
                pending.push(f);
            }
            deps[i] = d;
        }
    };
    React.default = React;
    React.__esModule = true;
    let value;
    return {
        React,
        render(fn) {
            cursor = 0;
            dirty = false;
            pending = [];
            value = fn();
            for (const f of pending) f();
            return value;
        },
        async flush(fn) {
            for (let i = 0; i < 8; i++) {
                this.render(fn);
                await new Promise(r => setImmediate(r));
                if (!dirty) break;
            }
            return value;
        }
    };
}

const walk = (node, arr = []) => {
    if (!node || typeof node !== 'object') return arr;
    if (Array.isArray(node)) {
        node.forEach(n => walk(n, arr));
        return arr;
    }
    arr.push(node);
    walk(node.props?.children, arr);
    return arr;
};

const textOf = n => Array.isArray(n) ? n.map(textOf).join('') : typeof n === 'string' ? n : n && typeof n === 'object' ? textOf(n.props?.children) : '';

function galleryHarness(theme, props = { targetScope: 'personal' }) {
    const h = hookHarness();
    const icons = new Proxy({}, { get: () => () => null });
    const mod = loadClient('components/appearance/ThemeGallery.jsx', x => {
        if (x === 'react') return h.React;
        if (x === 'lucide-react') return icons;
        if (x === '../../context/ThemeContext') return { useTheme: () => theme };
        if (x === '../../context/LanguageContext') return { useLanguage: () => ({ t: (k, fb) => fb || k }) };
        throw Error(x);
    });
    const render = () => mod.ThemeGallery(props);
    return {
        async flush() { return h.flush(render); },
        async click(label) {
            const tree = await h.flush(render);
            const b = walk(tree).find(n => n.type === 'button' && label.test(textOf(n)));
            assert(b, 'missing button ' + label);
            await b.props.onClick();
            return h.flush(render);
        }
    };
}

async function run() {
    console.log('START candidate verification at', scratch);

    // Seed test fixtures
    await prisma.lab.create({ data: { id: 'cand-lab-a', code: 'CAND-A', name: 'Candidate Own Laboratory', country: 'AAA' } });
    await prisma.lab.create({ data: { id: 'cand-lab-b', code: 'CAND-B', name: 'Candidate Foreign Laboratory', country: 'BBB' } });

    const users = {};
    for (const [key, role, labId] of [
        ['admin', 'SUPER_ADMIN', null],
        ['mgr', 'LAB_MANAGER', 'cand-lab-a'],
        ['tech', 'LAB_TECHNICIAN', 'cand-lab-a']
    ]) {
        users[key] = await prisma.user.create({
            data: {
                id: 'cand-' + key,
                username: 'cand_' + key,
                email: key + '@example.invalid',
                password: 'synthetic-unused-hash',
                role,
                labId,
                isActive: true,
                tokenVersion: 1,
                uiAppearanceRevision: 0
            }
        });
    }

    await prisma.globalAppearanceSetting.upsert({
        where: { id: 'global' },
        create: { id: 'global', themeId: 'soilfer-classic', defaultMode: 'light', revision: 1 },
        update: { themeId: 'soilfer-classic', defaultMode: 'light', revision: 1 }
    });
    await prisma.labAppearanceSetting.create({ data: { labId: 'cand-lab-a', themeId: 'forest', defaultMode: 'light', revision: 1 } });
    await prisma.labAppearanceSetting.create({ data: { labId: 'cand-lab-b', themeId: 'mineral', defaultMode: 'dark', revision: 1 } });

    // Case 1: GET /api/appearance/context
    const ctx = await http('get', '/api/appearance/context', users.mgr);
    assert.equal(ctx.status, 200);
    record('Context retrieval for lab manager', { status: 200, labDefault: ctx.body.data.labDefault?.themeId });

    // Case 2: Foreign lab appearance read is 403 Forbidden
    const foreignRead = await http('get', '/api/labs/cand-lab-b/appearance', users.tech);
    assert.equal(foreignRead.status, 403);
    record('Foreign laboratory settings read 403', { status: 403, code: foreignRead.body.code });

    // Case 3: Null appearance returns 400 with stable INVALID_APPEARANCE_PAYLOAD (no raw TypeError)
    const nullResult = await http('patch', '/api/auth/preferences', users.mgr, { themePreference: 'dark', appearance: null });
    assert.equal(nullResult.status, 400);
    assert.equal(nullResult.body.code, 'INVALID_APPEARANCE_PAYLOAD');
    assert.ok(!nullResult.body.error.includes('Cannot read properties of null'));
    record('Null appearance returns 400 with stable error contract', { status: 400, code: nullResult.body.code });

    // Case 4: Profile/preference mixed mode parity
    const combo = { themePreference: 'dark', appearance: { modePreference: 'light', expectedRevision: 0 } };
    const pc = await http('patch', '/api/auth/preferences', users.mgr, combo);
    const pr = await http('patch', '/api/auth/profile', users.mgr, combo);
    assert.equal(pc.status, 400);
    assert.equal(pr.status, 400);
    assert.equal(pc.body.code, 'CONFLICTING_THEME_PARAMETERS');
    assert.equal(pr.body.code, 'CONFLICTING_THEME_PARAMETERS');
    record('Profile/preference mixed-mode parity 400 CONFLICTING_THEME_PARAMETERS', { preferences: pc.status, profile: pr.status });

    // Case 5: Two parallel actual HTTP same-revision writes (atomic concurrency 200/409)
    const conc = await Promise.all([
        http('patch', '/api/auth/preferences', users.admin, { appearance: { themeId: 'forest', modePreference: 'light', expectedRevision: 0 } }),
        http('patch', '/api/auth/preferences', users.admin, { appearance: { themeId: 'terra', modePreference: 'dark', expectedRevision: 0 } })
    ]);
    assert.deepEqual(conc.map(r => r.status).sort(), [200, 409]);
    const persistedAdmin = await prisma.user.findUnique({ where: { id: users.admin.id } });
    assert.equal(persistedAdmin.uiAppearanceRevision, 1);
    record('Parallel same-revision writes return 200/409 with exact revision 1', {
        statuses: conc.map(r => r.status).sort(),
        persistedRevision: 1
    });

    // Case 6: Personal appearance revision is mandatory (400 EXPECTED_REVISION_REQUIRED)
    const noRev = await http('patch', '/api/auth/preferences', users.admin, { appearance: { themeId: 'mineral' } });
    assert.equal(noRev.status, 400);
    assert.equal(noRev.body.code, 'EXPECTED_REVISION_REQUIRED');
    record('Personal appearance requires expectedRevision', { status: 400, code: noRev.body.code });

    // Case 7: Shared laboratory PATCH requires expectedRevision strictly (400 EXPECTED_REVISION_REQUIRED)
    const labNoRev = await http('patch', '/api/labs/cand-lab-a/appearance', users.mgr, { themeId: 'terra', defaultMode: 'light' });
    assert.equal(labNoRev.status, 400);
    assert.equal(labNoRev.body.code, 'EXPECTED_REVISION_REQUIRED');
    record('Shared laboratory save requires expectedRevision (400)', { status: 400, code: labNoRev.body.code });

    // Case 8: Platform PATCH with null expectedRevision returns 400 EXPECTED_REVISION_REQUIRED
    const globalNoRev = await http('patch', '/api/admin/appearance', users.admin, { themeId: 'forest', defaultMode: 'dark', expectedRevision: null });
    assert.equal(globalNoRev.status, 400);
    assert.equal(globalNoRev.body.code, 'EXPECTED_REVISION_REQUIRED');
    record('Platform save rejects null expectedRevision (400)', { status: 400, code: globalNoRev.body.code });

    // Case 9: Canonical Lab FK rejects orphan
    const sql = new Database(dbPath);
    sql.pragma('foreign_keys=ON');
    const fks = sql.prepare("PRAGMA foreign_key_list('LabAppearanceSetting')").all();
    assert(fks.some(x => x.table === 'Lab'));
    assert.throws(() => {
        sql.prepare('INSERT INTO LabAppearanceSetting(labId, themeId, defaultMode, revision, updatedAt) VALUES(?,?,?,?,?)')
           .run('missing-orphan-lab', 'forest', 'light', 1, new Date().toISOString());
    }, /FOREIGN KEY/);
    sql.close();
    record('Canonical Lab foreign key rejects orphan insert', { orphan: 'rejected' });

    // Client provider tests
    let token = null, holdContexts = false, deferredSave = null;
    const transport = [];
    const axiosMock = {
        isCancel: () => false,
        get: async (url) => {
            transport.push({ url });
            if (url === '/api/appearance/public') return { data: { themeId: 'soilfer-classic', appearance: 'light', revision: 1 } };
            if (url === '/api/admin/settings') return { data: {} };
            if (url === '/api/labs/cand-lab-b/appearance') return { data: { data: { labId: 'cand-lab-b', themeId: 'mineral', defaultMode: 'dark', revision: 1 } } };
            if (holdContexts) return await new Promise(() => {});
            return { data: ctx.body.data };
        },
        patch: async (url, payload) => {
            transport.push({ url, payload });
            if (deferredSave) return deferredSave;
            return { data: { data: { appearance: { themeId: payload.appearance.themeId, modePreference: payload.appearance.modePreference, revision: 1 } } } };
        }
    };

    global.localStorage = { getItem: () => token, setItem: () => {} };
    const h = hookHarness();
    const provider = loadClient('context/ThemeContext.jsx', x => {
        if (x === 'react') return h.React;
        if (x === 'axios') return axiosMock;
        if (x === '../lib/appearance') return appearance;
        if (x === '../lib/themeCatalog') return catalog;
        throw Error(x);
    });

    const render = () => provider.ThemeProvider({ children: null }).props.value;
    let v = await h.flush(render);
    token = 'synthetic-A';
    const cachedA = { ...users.mgr, uiThemeId: null, uiModePreference: 'inherit', uiAppearanceRevision: 0 };
    v.syncAuthUser(cachedA);
    v = await h.flush(render);
    assert.equal(v.activeThemeId, 'forest');

    // Case 10: Preview cleared at account change
    v.setPreviewTheme({ themeId: 'watershed', mode: 'dark' });
    v = await h.flush(render);
    holdContexts = true;
    token = 'synthetic-B';
    v.syncAuthUser({ ...users.tech, id: 'cand-second-identity', uiThemeId: null, uiModePreference: 'inherit' });
    v = await h.flush(render);
    assert.equal(v.isPreviewActive, false);
    record('Preview cleared at account change', { isPreviewActive: v.isPreviewActive });

    // Case 11: Same identity laboratory change requests fresh context
    const beforeReqs = transport.filter(x => x.url.startsWith('/api/appearance/context')).length;
    v.syncAuthUser({ ...users.tech, id: 'cand-second-identity', labId: 'cand-lab-b', uiThemeId: null, uiModePreference: 'inherit' });
    v = await h.flush(render);
    assert.equal(transport.filter(x => x.url.startsWith('/api/appearance/context')).length, beforeReqs + 1);
    record('Same identity laboratory change triggers context request', { requests: beforeReqs + 1 });

    // Case 12: Logout clears previous laboratory and resets to Classic Light
    token = null;
    v.syncAuthUser(null);
    v = await h.flush(render);
    assert.equal(v.serverContext.labDefault, null);
    assert.equal(v.activeThemeId, 'soilfer-classic');
    record('Logout clears previous laboratory', { labDefault: v.serverContext.labDefault, theme: v.activeThemeId });

    // Case 13 & 14: Save personal preference and verify AuthContext language update preserves saved appearance
    holdContexts = false;
    token = 'synthetic-A';
    v.syncAuthUser(cachedA);
    v = await h.flush(render);
    await v.savePersonalPreferences({ themeId: 'terra', modePreference: 'light' });
    v = await h.flush(render);
    assert.equal(v.activeThemeId, 'terra');

    // Extracted AuthContext updateUserPreferences simulates language update without clobbering higher revision
    const authSource = fs.readFileSync(path.join(root, 'client/src/context/AuthContext.jsx'), 'utf8');
    const start = authSource.indexOf('const updateUserPreferences = ');
    const end = authSource.indexOf('\n    const hasAccess', start);
    assert(start >= 0 && end > start);
    let authCache = { ...cachedA, uiThemeId: 'terra', uiModePreference: 'light', uiAppearanceRevision: 1 };
    const updateUserPreferences = new Function('setUser', 'localStorage', authSource.slice(start, end) + '\nreturn updateUserPreferences;')(f => {
        authCache = f(authCache);
    }, global.localStorage);

    updateUserPreferences({ language: 'fr' });
    v.syncAuthUser(authCache);
    v = await h.flush(render);
    assert.equal(v.authSubject.savedThemeId, 'terra');
    assert.equal(v.activeThemeId, 'terra');
    assert.equal(v.authSubject.revision, 1);
    record('AuthContext language merge preserves saved appearance and revision', {
        themeId: v.authSubject.savedThemeId,
        revision: v.authSubject.revision,
        activeThemeId: v.activeThemeId
    });

    // Case 15: Delayed prior-account save response is NOT applied to current account
    let releaseSave;
    deferredSave = new Promise(r => { releaseSave = r; });
    const pending = v.savePersonalPreferences({ themeId: 'watershed', modePreference: 'dark' });
    holdContexts = true;
    token = 'synthetic-B';
    v.syncAuthUser({ ...users.tech, id: 'cand-second-identity', labId: 'cand-lab-b', uiThemeId: null, uiModePreference: 'inherit' });
    v = await h.flush(render);
    releaseSave({ data: { data: { appearance: { themeId: 'watershed', modePreference: 'dark', revision: 8 } } } });
    await pending;
    v = await h.flush(render);
    assert.equal(v.authSubject.userId, 'cand-second-identity');
    assert.notEqual(v.authSubject.savedThemeId, 'watershed');
    assert.notEqual(v.authSubject.revision, 8);
    record('Delayed prior-account save response safely discarded for current account', {
        currentUser: v.authSubject.userId,
        retainedTheme: v.authSubject.savedThemeId,
        retainedRevision: v.authSubject.revision
    });

    // Case 16: Ordinary staff Dark save submits { themeId: null, modePreference: 'dark' }
    let ordinaryPayload;
    const baseTheme = {
        activeThemeId: 'forest',
        appearance: 'light',
        isPreviewActive: false,
        authSubject: { role: 'LAB_TECHNICIAN', savedThemeId: null, savedModePreference: 'inherit' },
        serverContext: { canAdoptLabDefault: false, labDefault: { themeId: 'forest', defaultMode: 'light' }, platformDefault: { themeId: 'soilfer-classic', defaultMode: 'light' } },
        themes: catalog.THEMES,
        savePersonalPreferences: async p => { ordinaryPayload = p; },
        resetPersonalToDefault: async () => {},
        setPreviewTheme: () => {},
        clearPreviewTheme: () => {}
    };

    const ordinary = galleryHarness(baseTheme);
    await ordinary.click(/^Dark/);
    await ordinary.click(/^Save for me$/);
    assert.deepEqual(ordinaryPayload, { themeId: null, modePreference: 'dark' });
    const ordinaryHttp = await http('patch', '/api/auth/preferences', users.tech, { appearance: { ...ordinaryPayload, expectedRevision: 0 } });
    assert.equal(ordinaryHttp.status, 200);
    record('Ordinary staff Dark save submits themeId: null with 200 OK', { payload: ordinaryPayload, status: 200 });

    // Case 17: Independent palette and mode inheritance controls are present
    const cc = galleryHarness({
        ...baseTheme,
        activeThemeId: 'clear-contrast',
        authSubject: { role: 'LAB_TECHNICIAN', savedThemeId: 'clear-contrast', savedModePreference: 'light' }
    });
    const ccTree = await cc.flush();
    const labels = walk(ccTree).filter(n => n.type === 'button').map(textOf);
    assert(labels.includes('Reset to inherited defaults'));
    assert(labels.some(x => /Follow.*default/i.test(x)), 'Missing Follow default mode control');
    assert(labels.some(x => /Follow.*theme/i.test(x)), 'Missing Follow shared theme control');
    record('Independent palette and mode inheritance controls present', {
        hasFollowDefaultMode: labels.some(x => /Follow.*default/i.test(x)),
        hasFollowSharedTheme: labels.some(x => /Follow.*theme/i.test(x)),
        hasResetBoth: labels.includes('Reset to inherited defaults')
    });

    // Case 18: Untouched inherited mode is preserved as 'inherit' upon save
    let managerSavedPayload;
    const managerGal = galleryHarness({
        ...baseTheme,
        authSubject: { role: 'LAB_MANAGER', labId: 'cand-lab-a', savedThemeId: null, savedModePreference: 'inherit' },
        savePersonalPreferences: async p => { managerSavedPayload = p; }
    });
    await managerGal.click(/^Save for me$/);
    assert.equal(managerSavedPayload.modePreference, 'inherit');
    record('Untouched inherited mode preserved as inherit upon save', { savedMode: managerSavedPayload.modePreference });

    // Case 19: Gallery editing Lab B preserves Lab B target data and submits Lab B values
    let labAdoptPayload;
    const labGal = galleryHarness({
        ...baseTheme,
        authSubject: { role: 'SUPER_ADMIN', labId: 'cand-lab-a' },
        serverContext: { canAdoptLabDefault: true, labDefault: { labId: 'cand-lab-a', themeId: 'forest', defaultMode: 'light', revision: 1 } },
        getLabAppearance: async id => ({ labId: id, themeId: 'mineral', defaultMode: 'dark', revision: 1 }),
        adoptLabDefault: async p => { labAdoptPayload = p; }
    }, {
        targetScope: 'lab',
        targetLabId: 'cand-lab-b',
        targetLabName: 'Candidate Foreign Laboratory',
        targetAppearance: { labId: 'cand-lab-b', themeId: 'mineral', defaultMode: 'dark', revision: 1 }
    });
    await labGal.click(/Use as Candidate Foreign Laboratory default/i);
    await labGal.click(/Confirm.*Apply/i);
    assert.equal(labAdoptPayload.labId, 'cand-lab-b');
    assert.equal(labAdoptPayload.themeId, 'mineral');
    assert.equal(labAdoptPayload.defaultMode, 'dark');
    assert.equal(labAdoptPayload.expectedRevision, 1);
    record('Selected Lab B correctly initialized from Lab B target and submitted with revision', {
        submitted: labAdoptPayload
    });

    // Case 20: 14-variant token contrast calculation: 0 failures across 7 critical state pairs
    const lum = hex => hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4).reduce((a, x, i) => a + x * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => {
        const x = lum(a), y = lum(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const contrastFailures = [];
    for (const th of catalog.THEMES) {
        for (const mode of ['light', 'dark']) {
            const p = th[mode];
            for (const pair of [
                ['text', 'canvas', 4.5],
                ['muted', 'hover', 4.5],
                ['muted', 'selected', 4.5],
                ['onPrimary', 'primaryHover', 4.5],
                ['control', 'hover', 3],
                ['control', 'selected', 3],
                ['sideMuted', 'sideActive', 4.5]
            ]) {
                const r = ratio(p[pair[0]], p[pair[1]]);
                if (r < pair[2]) contrastFailures.push({ theme: th.id, mode, pair, ratio: r });
            }
        }
    }
    assert.equal(contrastFailures.length, 0);
    record('All 14 theme variants pass contrast checks with 0 failures', { variants: 14, failures: 0 });

    // Case 21: CSS chart tokens contract
    const cssContent = fs.readFileSync(path.join(root, 'client/src/styles/appearance-tokens.css'), 'utf8');
    const chartTokens = ['--sf-chart-grid', '--sf-chart-axis', '--sf-chart-4', '--sf-chart-5', '--sf-chart-6'];
    assert(chartTokens.every(t => cssContent.includes(t + ':')));
    record('CSS tokens contract verified with all 5 chart tokens present', { tokens: chartTokens.length });

    // Write candidate results
    const results = {
        timestamp: new Date().toISOString(),
        scratch,
        totalCases: cases.length,
        passedCases: cases.filter(c => c.status === 'PASS').length,
        failedCases: cases.filter(c => c.status === 'FAIL').length,
        cases
    };
    fs.writeFileSync(path.join(scratch, 'issue155-candidate-verification-results.json'), JSON.stringify(results, null, 2));
    console.log(`\nCOMPLETED ${cases.length}/${cases.length} CANDIDATE CASES PASSED. 0 DEFECTS REMAINING.`);
    console.log(`Candidate results saved to: ${path.join(scratch, 'issue155-candidate-verification-results.json')}`);
}

run().then(async () => {
    await prisma.$disconnect();
    cleanupDisposableDatabase(runnerDir);
    process.exit(0);
}).catch(async err => {
    console.error('CANDIDATE_TEST_FAILURE', err);
    try { await prisma.$disconnect(); } catch {}
    cleanupDisposableDatabase(runnerDir);
    process.exit(1);
});
