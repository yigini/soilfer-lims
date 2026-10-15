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
function startup(file, { shared = false, selected = stages, corruptIntegrity = false, corruptForeignKeys = false, during, afterCopy, beforeSql } = {}) {
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
                        if (['integrity_check', 'foreign_key_check'].includes(sql.trim().toLowerCase())) {
                            physical.push({ target, sql, stage: activeStage });
                            if (corruptIntegrity && sql === 'integrity_check') return opts?.simple ? 'synthetic damaged database' : [{ integrity_check: 'synthetic damaged database' }];
                            if (corruptForeignKeys && sql === 'foreign_key_check') return [{ table: 'WorkItem', rowid: 1, parent: 'Sample', fkid: 0 }];
                        }
                        return real.pragma(sql, opts);
                    };
                    if (key === 'prepare' && beforeSql) return sql => { beforeSql(sql); return real.prepare(sql); };
                    const value = Reflect.get(real, key, real);
                    return typeof value === 'function' ? value.bind(real) : value;
                } });
            });
            if (shared) {
                context = require('../../utils/startupReadinessContext').createStartupReadinessContext();
                const reviewChart = context.reviewChart;
                context.reviewChart = (source, review) => reviewChart(source, () => { computations.chart++; return review(); });
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
            } finally { context?.close(); }
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
function changeOwned(file, sql) {
    const db = new Database(file, { fileMustExist: true });
    try { db.exec(sql); } finally { db.close(); }
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
    ['policy', 'DROP INDEX "LabPolicy_labId_key"', 'LAB_POLICY_SCHEMA_MISMATCH'],
    ['order', 'DROP INDEX "OrderLine_workItemId_idx"', 'ORDER_REVISION_SCHEMA_MISMATCH']
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
    changeOwned(file, 'DROP TRIGGER "' + trigger + '"');
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
        if (script === 'install_lab_policy_schema') changeOwned(file, 'DROP INDEX "OrderLine_workItemId_idx"');
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
    expect(() => reader.prepare('DELETE FROM WorkItem').run()).toThrow();
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
            if (key === 'pragma') return (...args) => { physical.push(args[0]); return real.pragma(...args); };
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
            if (!changed && source === file) { changed = true; changeOwned(file, 'DROP INDEX "OrderLine_workItemId_idx"'); }
        } });
    });
    expect(results[1].outcomes).toEqual(results[0].outcomes);
    for (const result of results) {
        expect(result.outcomes.at(-1).error.code).toBe('LAB_POLICY_SNAPSHOT_CHANGED');
        expect(result.snapshotCopies).toBe(1);
    }
});

test('an original-file race during impact keeps ORDER_REVISION_SNAPSHOT_CHANGED', () => {
    const results = [false, true].map(shared => {
        const file = cloneFixture(); let changed = false;
        return startup(file, { shared, beforeSql: sql => {
            if (!changed && sql.startsWith('SELECT w.id,w.sampleId,w.analysis,w.status,s.id AS storedSampleId')) {
                changed = true; changeOwned(file, 'DROP INDEX "OrderLine_workItemId_idx"');
            }
        } });
    });
    expect(results[1].outcomes).toEqual(results[0].outcomes);
    expect(results[1].outcomes.at(-1).error.code).toBe('ORDER_REVISION_SNAPSHOT_CHANGED');
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
