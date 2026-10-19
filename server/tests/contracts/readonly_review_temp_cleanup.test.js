// Real file lifetimes and hashes, with a mocked SQLite reader: no local DB template.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
jest.mock('better-sqlite3', () => jest.fn());
const Database = require('better-sqlite3');
const policy = require('../../scripts/install_lab_policy_schema');
const sampleCode = require('../../scripts/install_sample_code_schema');
const { createStartupReadinessContext } = require('../../utils/startupReadinessContext');
const realTmp = os.tmpdir();
let directory, target, installed, damaged, thrown, readers;
const hashes = file => Object.fromEntries(['', '-wal', '-shm'].map(suffix => [suffix,
    createHash('sha256').update(fs.readFileSync(file + suffix)).digest('hex')]));
const leftovers = () => fs.readdirSync(os.tmpdir()).filter(name => /^lims-.*-readonly-/.test(name));
const column = (name, type = 'TEXT') => ({ name, type, notnull: 0, pk: 0, hidden: 0, dflt_value: null });

beforeEach(() => {
    directory = fs.mkdtempSync(path.join(realTmp, 'lims-review-cleanup-test-'));
    target = path.join(directory, 'original.db');
    for (const suffix of ['', '-wal', '-shm']) fs.writeFileSync(target + suffix, 'new synthetic bytes ' + suffix);
    jest.spyOn(os, 'tmpdir').mockReturnValue(directory);
    installed = damaged = false; thrown = null; readers = [];
    const policySql = require('../../services/labPolicyMigrationSource').loadLabPolicyMigrationSource().schemaSql;
    const sampleSql = require('../../services/sampleCodeMigrationSource').loadSampleCodeMigrationSource().sql;
    const tables = Object.fromEntries([...policySql.matchAll(/^CREATE TABLE "([^"]+)"[\s\S]*?^\);/gm)].map(row => [row[1], row[0]]));
    const indexes = [...policySql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"[^;]*;/gm)]
        .map(row => ({ name: row[1], type: 'index', sql: row[0] }));
    Database.mockImplementation(() => {
        const reader = {
            inTransaction: false,
            close: jest.fn(),
            exec(sql) { this.inTransaction = sql === 'BEGIN'; },
            transaction: fn => () => fn(),
            pragma: (sql, options) => sql === 'foreign_key_check' ? []
                : options?.simple ? (damaged ? 'damaged' : 'ok') : [{ integrity_check: damaged ? 'damaged' : 'ok' }],
            prepare(sql) {
                if (thrown) throw thrown;
                return {
                    get(name) {
                        if (sql.startsWith('SELECT name,type')) return { name, type: 'table' };
                        if (sql.includes("name='Sample_labSampleCode_key'")) return installed
                            ? { type: 'index', tbl_name: 'Sample', sql: sampleSql.match(/^CREATE UNIQUE INDEX [^;]+;/m)[0] } : undefined;
                        if (sql.includes("name='LabSequence'")) return installed
                            ? { type: 'table', sql: sampleSql.match(/^CREATE TABLE "LabSequence"[\s\S]*?^\);/m)[0] } : undefined;
                        if (sql.startsWith('SELECT sql')) return { sql: 'CREATE TABLE "' + name + '" ("id" TEXT,"labSampleCode" TEXT,"legacyLabId" TEXT)' };
                        if (sql.startsWith('SELECT type,sql')) return installed && tables[name] ? { type: 'table', sql: tables[name] } : undefined;
                        return undefined;
                    },
                    all() {
                        if (sql.startsWith('PRAGMA table_info')) return [column('id')];
                        if (sql.includes('table_xinfo("Report")')) return [column('id'), ...(installed ? [column('policyVersion', 'INTEGER')] : [])];
                        if (sql.includes('table_xinfo("Sample")')) return [column('id'), ...(installed ? [column('labSampleCode')] : [])];
                        if (sql.includes('table_xinfo("WorkItem")')) return [column('id'), ...(installed ? [column('legacyLabId')] : [])];
                        if (sql.startsWith('SELECT name,type,sql')) return indexes;
                        return [];
                    }
                };
            }
        };
        readers.push(reader); return reader;
    });
});
afterEach(() => {
    jest.restoreAllMocks();
    // Only this test's newly created absolute directory is removed.
    expect(path.dirname(directory)).toBe(path.resolve(realTmp));
    expect(path.basename(directory)).toMatch(/^lims-review-cleanup-test-/);
    fs.rmSync(directory, { recursive: true, force: true });
});

const owners = [
    ['policy', policy.installLabPolicySchema, policy.assertLabPolicyStartupReady, 'LAB_POLICY'],
    ['sample code', sampleCode.installSampleCodeSchema, sampleCode.assertSampleCodeStartupReady, 'SAMPLE_CODE_SCHEMA']
];
test.each(owners)('%s DRY run removes its copy and retains all three original hashes', (_name, install) => {
    const before = hashes(target), result = install({ dbPath: target });
    expect(result.mode).toBe('DRY_RUN');
    expect(result.readonlySnapshot).toMatchObject({ originalDbWalShmSha256: before, originalFilesPreserved: true });
    expect(result.readonlySnapshot).not.toHaveProperty('path');
    expect(hashes(target)).toEqual(before); expect(leftovers()).toEqual([]);
    expect(readers.every(reader => reader.close.mock.calls.length === 1)).toBe(true);
});
test.each(owners)('%s startup review removes its standalone copy', (_name, _install, startup) => {
    installed = true;
    const before = hashes(target), result = startup(target);
    expect(result.mode).toBe('NO_OP');
    expect(result.readonlySnapshot).not.toHaveProperty('path');
    expect(hashes(target)).toEqual(before); expect(leftovers()).toEqual([]);
});
test.each(owners)('%s refusal and thrown reader error leave no copy or changed original', (_name, install, _startup, prefix) => {
    const before = hashes(target);
    damaged = true;
    expect(() => install({ dbPath: target })).toThrow(expect.objectContaining({ code: prefix + '_INTEGRITY_REFUSED' }));
    expect(leftovers()).toEqual([]); expect(hashes(target)).toEqual(before);
    damaged = false; thrown = new Error('forced reader error');
    expect(() => install({ dbPath: target })).toThrow(thrown);
    expect(leftovers()).toEqual([]); expect(hashes(target)).toEqual(before);
});
test.each(owners)('%s SNAPSHOT_CHANGED removes the failed copy without touching originals', (_name, install, _startup, prefix) => {
    const before = hashes(target), copy = fs.copyFileSync;
    jest.spyOn(fs, 'copyFileSync').mockImplementation((source, destination, flags) => {
        copy(source, destination, flags);
        if (source === target) fs.appendFileSync(destination, 'forced copy mismatch');
    });
    expect(() => install({ dbPath: target })).toThrow(expect.objectContaining({ code: prefix + '_SNAPSHOT_CHANGED' }));
    expect(leftovers()).toEqual([]); expect(hashes(target)).toEqual(before);
});
test.each(owners)('%s copy and reader-constructor failures also release the directory', (_name, install) => {
    const before = hashes(target), failure = new Error('forced I/O failure');
    const copy = jest.spyOn(fs, 'copyFileSync').mockImplementation(() => { throw failure; });
    expect(() => install({ dbPath: target })).toThrow(failure);
    expect(leftovers()).toEqual([]); expect(hashes(target)).toEqual(before);
    copy.mockRestore();
    Database.mockImplementation(() => { throw failure; });
    expect(() => install({ dbPath: target })).toThrow(failure);
    expect(leftovers()).toEqual([]); expect(hashes(target)).toEqual(before);
});
test('nested policy consumers finish before cleanup, including a throwing consumer', () => {
    installed = true;
    const before = hashes(target);
    for (const fail of [false, true]) {
        const consume = () => policy.assertLabPolicyStartupReady(target, undefined, (result, copy) => {
            expect(fs.existsSync(copy)).toBe(true); expect(hashes(copy)).toEqual(before);
            expect(result.readonlySnapshot).not.toHaveProperty('path');
            if (fail) throw new Error('nested consumer refused');
            return { nestedCheckFinished: true, ...result };
        });
        if (fail) expect(consume).toThrow('nested consumer refused');
        else expect(consume()).toMatchObject({ nestedCheckFinished: true });
        expect(leftovers()).toEqual([]); expect(hashes(target)).toEqual(before);
    }
});
test.each([false, true])('shared startup keeps one copy until its final caller closes (refusal=%s)', refuse => {
    installed = true;
    const context = createStartupReadinessContext(), before = hashes(target);
    try {
        policy.assertLabPolicyStartupReady(target, context);
        policy.assertLabPolicyStartupReady(target, context, (_result, copy) => expect(fs.existsSync(copy)).toBe(true));
        expect(leftovers()).toHaveLength(1);
        if (refuse) throw new Error('later startup stage refused');
        sampleCode.assertSampleCodeStartupReady(target, context);
    } catch (error) {
        if (!refuse) throw error;
        expect(error.message).toBe('later startup stage refused');
    } finally { context.close(); context.close(); }
    expect(leftovers()).toEqual([]); expect(hashes(target)).toEqual(before);
    expect(readers.every(reader => reader.close.mock.calls.length === 1)).toBe(true);
});
test('a failed shared policy review cleans up before returning its existing refusal', () => {
    const context = createStartupReadinessContext(), before = hashes(target);
    damaged = true;
    try {
        expect(() => policy.installLabPolicySchema({ dbPath: target, startupContext: context }))
            .toThrow(expect.objectContaining({ code: 'LAB_POLICY_INTEGRITY_REFUSED' }));
        expect(leftovers()).toEqual([]); expect(hashes(target)).toEqual(before);
    } finally { context.close(); }
});
