const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { qcGateFixture } = require('../helpers/qcGateFixture');

const entry = fs.readFileSync(path.resolve(__dirname, '../../index.js'), 'utf8');
const stages = [...entry.matchAll(/require\('\.\/scripts\/(install_\w+)'\)\.(assert\w+StartupReady)\(dbPath, startupContext\)/g)]
    .map(([, script, method]) => [script, method]);
const held = [];
let fixtureFile;
const triples = file => Object.fromEntries(['', '-wal', '-shm'].map(suffix => [suffix,
    fs.existsSync(file + suffix) ? createHash('sha256').update(fs.readFileSync(file + suffix)).digest('hex') : null]));
const normalize = value => JSON.parse(JSON.stringify(value, (key, item) => key === 'path' ? '<retained-snapshot>' : item));

beforeAll(async () => {
    const fixture = await qcGateFixture({ managedStartup: true, resolvedRules: false, fixedWindowPolicy: false });
    held.push(fixture);
    await fixture.db.$disconnect();
    fixtureFile = fixture.file;
});
afterAll(async () => { for (const fixture of held) await fixture.db.$disconnect(); });

// Instrument only the constructors loaded in this isolated module graph. The
// real Database prototype and other callers remain unchanged.
function startup(file, { shared = false, selected = stages, corruptIntegrity = false, corruptForeignKeys = false, during, afterCopy, afterOrderPolicy, afterOrderChart } = {}) {
    const physical = [], opens = [], outcomes = [], timings = [], computations = { chart: 0 };
    const copyFile = fs.copyFileSync;
    const copy = jest.spyOn(fs, 'copyFileSync');
    if (afterCopy) copy.mockImplementation((...args) => { const result = copyFile(...args); afterCopy(...args); return result; });
    let context, activeStage;
    const pragmaBefore = Database.prototype.pragma;
    try {
        jest.isolateModules(() => {
            jest.doMock('better-sqlite3', () => function ReadinessDatabase(target, options) {
                const db = new Database(target, options);
                opens.push({ target, readonly: db.readonly });
                return new Proxy(db, { get(real, key) {
                    if (key === 'pragma') return (sql, opts) => {
                        if (sql === 'integrity_check') {
                            physical.push({ target, sql, stage: activeStage });
                            if (corruptIntegrity) return opts?.simple ? 'synthetic damaged database' : [{ integrity_check: 'synthetic damaged database' }];
                            return real.pragma('integrity_check', opts);
                        }
                        if (sql === 'foreign_key_check') {
                            physical.push({ target, sql, stage: activeStage });
                            if (corruptForeignKeys) return [{ table: 'WorkItem', rowid: 1, parent: 'Sample', fkid: 0 }];
                            return real.pragma('foreign_key_check', opts);
                        }
                        throw new Error('Unexpected pragma in the closed startup test instrumentation.');
                    };
                    const value = Reflect.get(real, key, real);
                    return typeof value === 'function' ? value.bind(real) : value;
                } });
            });
            if (shared) {
                context = require('../../utils/startupReadinessContext').createStartupReadinessContext();
                const reviewChart = context.reviewChart;
                context.reviewChart = (source, review) => reviewChart(source, () => { computations.chart++; return review(); });
            }
            const restore = [];
            if (afterOrderPolicy) {
                const owner = require('../../scripts/install_lab_policy_schema');
                const original = owner.assertLabPolicyStartupReady;
                const spy = jest.spyOn(owner, 'assertLabPolicyStartupReady').mockImplementation((...args) => {
                    const result = original(...args);
                    if (activeStage === 'install_order_revisions' && args[0] === file) {
                        const captured = result.readonlySnapshot.path;
                        Object.defineProperty(result.readonlySnapshot, 'path', { enumerable: true, get() {
                            afterOrderPolicy(); return captured;
                        } });
                    }
                    return result;
                });
                restore.push(() => spy.mockRestore());
            }
            if (afterOrderChart) {
                const owner = require('../../scripts/install_control_charts');
                const original = owner.assertControlChartStartupReady;
                const spy = jest.spyOn(owner, 'assertControlChartStartupReady').mockImplementation((...args) => {
                    const result = original(...args);
                    if (activeStage === 'install_order_revisions') afterOrderChart();
                    return result;
                });
                restore.push(() => spy.mockRestore());
            }
            try {
                for (const [script, method] of selected) {
                    activeStage = script;
                    const began = process.hrtime.bigint();
                    try { outcomes.push({ script, report: normalize(require('../../scripts/' + script)[method](file, context)) }); }
                    catch (error) {
                        outcomes.push({ script, error: normalize({ message: error.message, ...Object.fromEntries(Object.entries(error)) }) });
                        break;
                    }
                    timings.push({ script, elapsed_ms: Number(process.hrtime.bigint() - began) / 1e6, rss_bytes: process.memoryUsage().rss });
                    during?.(script, context);
                }
            } finally { context?.close(); for (const reset of restore) reset(); }
        });
        return { outcomes, physical, opens, computations, timings,
            snapshotCopies: new Set(copy.mock.calls.filter(([, destination]) => destination.includes('lims-policy-schema-readonly-')).map(([, destination]) => path.dirname(destination))).size };
    } finally {
        jest.dontMock('better-sqlite3');
        copy.mockRestore();
        expect(Database.prototype.pragma).toBe(pragmaBefore);
    }
}

function cloneFixture() {
    const directory = fs.mkdtempSync(path.join(__dirname, '../.tmp/startup-readiness-'));
    const file = path.join(directory, 'owned.db');
    for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(fixtureFile + suffix)) fs.copyFileSync(fixtureFile + suffix, file + suffix);
    return file;
}
function ownedMutationTarget(file) {
    const parent = path.dirname(file), root = path.resolve(__dirname, '../.tmp');
    if (process.env.NODE_ENV !== 'test' || path.dirname(parent) !== root ||
        !path.basename(parent).startsWith('startup-readiness-') || path.basename(file) !== 'owned.db' ||
        fs.realpathSync(file).toLowerCase() !== path.resolve(file).toLowerCase() ||
        [process.env.DATABASE_PATH, process.env.PRODUCTION_DATABASE_PATH, path.resolve(__dirname, '../../prisma/dev.db')]
            .filter(Boolean).some(protectedFile => path.resolve(protectedFile).toLowerCase() === path.resolve(file).toLowerCase()))
        throw new Error('A closed startup mutation requires its independently owned file.');
    require('../../services/workflowStateRules').assertFixtureContext();
    return file;
}
function changeOwned(file, change) {
    if (!['policy-index', 'order-index', 'chart-trigger'].includes(change)) throw new Error('Unknown closed startup DDL case.');
    const db = new Database(ownedMutationTarget(file), { fileMustExist: true });
    try {
        if (change === 'policy-index') db.exec('DROP INDEX "LabPolicy_labId_key"');
        if (change === 'order-index') db.exec('DROP INDEX "OrderLine_workItemId_idx"');
        if (change === 'chart-trigger') db.exec('DROP TRIGGER "control_limit_proposal_insert"');
    } finally { db.close(); }
}

test('all 26 startup reports equal the legacy default path; one physical integrity/FK check and one retained policy snapshot', () => {
    expect(stages).toHaveLength(26);
    const file = cloneFixture(), before = triples(file);
    const old = startup(file), current = startup(file, { shared: true });
    expect(current.outcomes).toEqual(old.outcomes);
    expect(current.outcomes).toHaveLength(26);
    expect(current.outcomes.every(row => row.report && !row.error)).toBe(true);
    expect(current.physical.filter(row => row.sql === 'integrity_check')).toHaveLength(1);
    expect(current.physical.filter(row => row.sql === 'foreign_key_check')).toHaveLength(1);
    expect(old.physical.length).toBeGreaterThan(2);
    expect(current.snapshotCopies).toBe(1);
    expect(old.snapshotCopies).toBeGreaterThan(1);
    expect(current.computations.chart).toBe(1);
    expect(current.opens.filter(row => row.target !== ':memory:').every(row => row.readonly)).toBe(true);
    expect(triples(file)).toEqual(before);
    const order = current.outcomes.at(-1).report;
    expect(order.impact).toHaveProperty('approvedAmendmentKitGate');
    console.log(JSON.stringify({ event: 'ALL_26_OWNED_STARTUP_COMPARISON', reportsEqual: true,
        oldPhysicalChecks: old.physical.length, newPhysicalChecks: current.physical.length,
        oldSnapshotCopies: old.snapshotCopies, newSnapshotCopies: current.snapshotCopies,
        oldStages: old.timings, newStages: current.timings, notProductionTimingOrStartupQualification: true }));
});

test.each([
    ['policy', 'policy-index', 'LAB_POLICY_SCHEMA_MISMATCH'],
    ['order', 'order-index', 'ORDER_REVISION_SCHEMA_MISMATCH']
])('%s schema refusal keeps the legacy code, message, differences and stage', (_name, sql, code) => {
    const file = cloneFixture(); changeOwned(file, sql);
    const old = startup(file), current = startup(file, { shared: true });
    expect(current.outcomes).toEqual(old.outcomes);
    expect(current.outcomes.at(-1).error.code).toBe(code);
});

test('control chart schema refusal keeps the legacy code and stage', () => {
    const file = cloneFixture();
    const source = require('../../services/controlChartMigrationSource').loadControlChartMigrationSource();
    const trigger = source.guardsSql.match(/^CREATE TRIGGER "([^"]+)"/m)[1];
    expect(trigger).toBe('control_limit_proposal_insert');
    changeOwned(file, 'chart-trigger');
    const old = startup(file), current = startup(file, { shared: true });
    expect(current.outcomes).toEqual(old.outcomes);
    expect(current.outcomes.at(-1).error.code).toBe('QC_CHART_SCHEMA_MISMATCH');
});

test.each([
    { corruptIntegrity: true }, { corruptForeignKeys: true }
])('bad shared SQL results still reach the existing owner refusal: %j', bad => {
    const file = cloneFixture();
    const selected = stages.slice(23);
    const old = startup(file, { ...bad, selected }), current = startup(file, { ...bad, selected, shared: true });
    expect(current.outcomes).toEqual(old.outcomes);
    expect(current.outcomes.at(-1).error.code).toBe('LAB_POLICY_INTEGRITY_REFUSED');
});

test('a new startup never reuses a prior startup result', () => {
    const file = cloneFixture();
    const first = startup(file, { shared: true }), second = startup(file, { shared: true });
    expect(first.outcomes).toEqual(second.outcomes);
    for (const run of [first, second]) {
        expect(run.physical.filter(row => row.sql === 'integrity_check')).toHaveLength(1);
        expect(run.physical.filter(row => row.sql === 'foreign_key_check')).toHaveLength(1);
    }
});

test('changed bytes between stages cannot inherit cached integrity or chart results', () => {
    const file = cloneFixture();
    const result = startup(file, { shared: true, selected: stages.slice(23), during: script => {
        if (script === 'install_lab_policy_schema') changeOwned(file, 'order-index');
    } });
    expect(result.outcomes.at(-1).error.code).toBe('ORDER_REVISION_SCHEMA_MISMATCH');
    expect(result.physical.filter(row => row.sql === 'integrity_check')).toHaveLength(2);
    expect(result.physical.filter(row => row.sql === 'foreign_key_check')).toHaveLength(2);
});

test('context closes on refusal and cannot be reused for another database', () => {
    const { createStartupReadinessContext, openReadonlyDatabase } = require('../../utils/startupReadinessContext');
    const context = createStartupReadinessContext(), file = cloneFixture();
    const reader = openReadonlyDatabase(Database, file, { readonly: true, fileMustExist: true }, context);
    expect(reader.readonly).toBe(true);
    expect(() => reader.exec('CREATE TABLE startup_readonly_canary(id INTEGER)')).toThrow();
    expect(() => openReadonlyDatabase(Database, cloneFixture(), { readonly: true, fileMustExist: true }, context)).toThrow(TypeError);
    context.close();
    expect(() => reader.prepare('SELECT 1').get()).toThrow();
    expect(() => openReadonlyDatabase(Database, file, { readonly: true, fileMustExist: true }, context)).toThrow(TypeError);
});

test.each([{ corruptIntegrity: true }, { corruptForeignKeys: true }])('the complete startup retains the first real owner refusal for %j', bad => {
    const file = cloneFixture(), old = startup(file, bad), current = startup(file, { ...bad, shared: true });
    expect(current.outcomes).toEqual(old.outcomes);
    expect(current.outcomes.at(-1)).toMatchObject({ script: 'install_qc_runs', error: { code: 'QC_RUN_INTEGRITY_REFUSED' } });
});

test('one full SQL result preserves both the full-row and simple pragma APIs', () => {
    const { createStartupReadinessContext, openReadonlyDatabase } = require('../../utils/startupReadinessContext');
    const physical = [];
    function Instrumented(file, options) {
        const db = new Database(file, options);
        return new Proxy(db, { get(real, key) {
            if (key === 'pragma') return (sql, options) => {
                physical.push(sql);
                if (sql === 'integrity_check') return real.pragma('integrity_check', options);
                if (sql === 'foreign_key_check') return real.pragma('foreign_key_check', options);
                throw new Error('Unexpected pragma in the closed mixed-view test.');
            };
            const value = Reflect.get(real, key, real); return typeof value === 'function' ? value.bind(real) : value;
        } });
    }
    const context = createStartupReadinessContext();
    try {
        const reader = openReadonlyDatabase(Instrumented, cloneFixture(), { readonly: true, fileMustExist: true }, context);
        expect(reader.pragma('integrity_check')).toEqual([{ integrity_check: 'ok' }]);
        expect(reader.pragma('integrity_check', { simple: true })).toBe('ok');
        expect(reader.pragma('foreign_key_check')).toEqual([]);
        expect(reader.pragma('foreign_key_check', { simple: true })).toBeUndefined();
        expect(physical).toEqual(['integrity_check', 'foreign_key_check']);
    } finally { context.close(); }
});

test('copy races preserve the existing snapshot refusal, with no second copy attempt', () => {
    const results = [false, true].map(shared => {
        const file = cloneFixture(); let changed = false;
        return startup(file, { shared, afterCopy: source => {
            if (!changed && source === file) { changed = true; changeOwned(file, 'order-index'); }
        } });
    });
    expect(results[1].outcomes).toEqual(results[0].outcomes);
    for (const result of results) {
        expect(result.outcomes.at(-1).error.code).toBe('LAB_POLICY_SNAPSHOT_CHANGED');
        expect(result.snapshotCopies).toBe(1);
    }
});

test.each(['after-policy-capture', 'after-nested-chart'])('an original-file race %s keeps ORDER_REVISION_SNAPSHOT_CHANGED', boundary => {
    const results = [false, true].map(shared => {
        const file = cloneFixture(); let changed = false;
        const mutate = () => { if (!changed) { changed = true; changeOwned(file, 'order-index'); } };
        return startup(file, { shared,
            ...(boundary === 'after-policy-capture' ? { afterOrderPolicy: mutate } : { afterOrderChart: mutate }) });
    });
    expect(results[0].outcomes.at(-1).error.code).toBe('ORDER_REVISION_SNAPSHOT_CHANGED');
    expect(results[1].outcomes).toEqual(results[0].outcomes);
});

test.each(['absent', 'empty', 'nonempty'])('all26 reports and shared checks remain equivalent with an owned WAL-mode %s WAL', representation => {
    const file = cloneFixture();
    let writer = new Database(ownedMutationTarget(file), { fileMustExist: true });
    try {
        expect(writer.pragma('journal_mode = WAL', { simple: true })).toBe('wal');
        writer.pragma('wal_autocheckpoint = 0');
        writer.exec('CREATE TABLE startup_wal_canary(id INTEGER PRIMARY KEY)');
        if (representation === 'empty') writer.pragma('wal_checkpoint(TRUNCATE)');
        if (representation === 'absent') { writer.close(); writer = null; }
        const exists = fs.existsSync(file + '-wal');
        if (representation === 'absent') expect(exists).toBe(false);
        if (representation === 'empty') expect(fs.statSync(file + '-wal').size).toBe(0);
        if (representation === 'nonempty') expect(fs.statSync(file + '-wal').size).toBeGreaterThan(32);
        expect([...fs.readFileSync(file).subarray(18, 20)]).toEqual([2, 2]);
        const old = startup(file), current = startup(file, { shared: true });
        expect(current.outcomes).toEqual(old.outcomes);
        expect(current.outcomes).toHaveLength(26);
        expect(current.outcomes.every(row => row.report && !row.error)).toBe(true);
        expect(current.physical.filter(row => row.sql === 'integrity_check')).toHaveLength(1);
        expect(current.physical.filter(row => row.sql === 'foreign_key_check')).toHaveLength(1);
        expect(current.snapshotCopies).toBe(1);
        expect(current.computations.chart).toBe(1);
    } finally { writer?.close(); }
});

test('changed retained-copy bytes cannot reuse cached policy or integrity results', () => {
    const results = [false, true].map(shared => {
        const file = cloneFixture(), before = triples(file);
        let capturedCopy;
        const result = startup(file, { shared, selected: stages.slice(23, 25),
            afterCopy: (source, destination) => {
                if (source === file && destination.endsWith('snapshot.db')) capturedCopy = destination;
            },
            during: script => {
                if (script === 'install_lab_policy_schema') {
                    expect(capturedCopy).toBeDefined();
                    // Only this run's newly retained copy is changed. The
                    // original owned fixture and SQL data remain unchanged.
                    fs.appendFileSync(capturedCopy, '\nowned-copy-byte-canary\n');
                }
            } });
        expect(triples(file)).toEqual(before);
        return result;
    });
    expect(results[1].outcomes).toEqual(results[0].outcomes);
    expect(results[1].outcomes.every(row => row.report && !row.error)).toBe(true);
    expect(results[1].snapshotCopies).toBe(2);
    expect(results[1].physical.filter(row => row.sql === 'integrity_check')).toHaveLength(2);
    expect(results[1].physical.filter(row => row.sql === 'foreign_key_check')).toHaveLength(2);
});

test('reusing a chart result still reloads and verifies its migration digest', () => {
    const results = [false, true].map(shared => {
        const file = cloneFixture(), readFile = fs.readFileSync;
        let changed = false;
        const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((name, ...args) => {
            const bytes = readFile(name, ...args);
            return changed && String(name).includes('20261013000200_control_charts') && String(name).endsWith('migration.sql')
                ? Buffer.concat([Buffer.from(bytes), Buffer.from('\n-- test-only changed source\n')]) : bytes;
        });
        try { return startup(file, { shared, during: script => { if (script === 'install_control_charts') changed = true; } }); }
        finally { spy.mockRestore(); }
    });
    expect(results[1].outcomes).toEqual(results[0].outcomes);
    expect(results[1].outcomes.at(-1).error.code).toBe('QC_CHART_SOURCE_MISMATCH');
});
