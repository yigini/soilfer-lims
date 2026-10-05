const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { rejectedGuardWrite } = require('../helpers/rejectedGuardWrite');
const ownedFiles = [];
const newPath = () => { const file = path.resolve(__dirname, '../.tmp', `guard-helper-${randomUUID()}.db`); ownedFiles.push(file); return file; };
afterAll(() => { for (const file of ownedFiles) for (const suffix of ['', '-wal', '-shm', '-journal', '.pre-migration.db']) {
    if (fs.existsSync(`${file}${suffix}`)) { fs.chmodSync(`${file}${suffix}`, 0o600); fs.rmSync(`${file}${suffix}`); }
} });
function legacy(options = {}) {
    const now = Date.now();
    return beforeGuards({ actor: 'system:fixture', file: newPath(), samples: [{ id: 'legacy', originalId: 'legacy', status: 'COLLECTED',
        createdAt: now, updatedAt: now }], workItems: [{ id: 'legacy-work', sampleId: 'legacy', analysis: 'PH_H2O', status: 'PENDING',
        createdAt: now, updatedAt: now }], ...options });
}
const probe = (file, options = {}) => rejectedGuardWrite({ actor: 'system:fixture', file,
    statement: 'UPDATE Sample SET status = ? WHERE id = ?', parameters: ['INVALID', 'legacy'], expectedGuardCode: 'INVALID_SAMPLE_STATUS', ...options });

test('the named legacy inserter installs every actual release guard and refuses reusing a file', () => {
    const { file, preMigrationSnapshot } = legacy();
    expect(preMigrationSnapshot).toBeNull();
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
        expect(db.prepare('SELECT status FROM Sample WHERE id=?').get('legacy').status).toBe('COLLECTED');
        const guardSql = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261005000100_workflow_state_guards/migration.sql'), 'utf8');
        const installed = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all().map(row => row.name);
        for (const match of guardSql.matchAll(/CREATE TRIGGER "([^"]+)"/g)) expect(installed).toContain(match[1]);
    } finally { db.close(); }
    const digest = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    expect(() => beforeGuards({ actor: 'system:fixture', file })).toThrow(/EEXIST/);
    expect(createHash('sha256').update(fs.readFileSync(file)).digest('hex')).toBe(digest);
    expect(probe(file)).toBeUndefined();
});

test('the negative probe requires the exact refusal and fails if a write succeeds', () => {
    const { file } = legacy();
    expect(() => probe(file, { expectedGuardCode: 'INVALID_WORKITEM_STATUS' })).toThrow('different code');
    expect(() => probe(file, { statement: 'UPDATE Sample SET status = status WHERE id = ?', parameters: ['legacy'] })).toThrow('unexpectedly succeeded');
    expect(probe(file, { statement: 'UPDATE WorkItem SET status = ? WHERE id = ?', parameters: ['INVALID', 'legacy-work'],
        expectedGuardCode: 'INVALID_WORKITEM_STATUS' })).toBeUndefined();
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try { expect(db.prepare('SELECT status FROM Sample WHERE id=?').get('legacy').status).toBe('COLLECTED'); }
    finally { db.close(); }
});

test.each(['UPDATE Sample SET status = ?; DROP TRIGGER anything', 'PRAGMA foreign_keys = OFF',
    'UPDATE Sample SET status = ? -- comment', 'SELECT 1'])('the negative probe refuses non-probe SQL before opening: %s', statement => {
    const file = newPath();
    expect(() => probe(file, { statement })).toThrow('single workflow guard probe');
    expect(fs.existsSync(file)).toBe(false);
});

test.each(['system:other', undefined])('both helpers require the literal fixture actor: %s', actor => {
    const file = newPath();
    expect(() => beforeGuards({ actor, file })).toThrow('system:fixture');
    expect(() => probe(file, { actor })).toThrow('system:fixture');
    expect(fs.existsSync(file)).toBe(false);
});

test('both helpers refuse outside test mode even if explicit fixture flags are enabled', () => {
    const previous = process.env.NODE_ENV, file = newPath();
    process.env.NODE_ENV = 'production';
    try {
        expect(() => beforeGuards({ actor: 'system:fixture', file })).toThrow('NODE_ENV=test');
        expect(() => probe(file)).toThrow('NODE_ENV=test');
        expect(fs.existsSync(file)).toBe(false);
    } finally { process.env.NODE_ENV = previous; }
});

test('both helpers refuse configured, working, production and out-of-directory database paths before opening', () => {
    const productionFile = newPath(), previous = process.env.PRODUCTION_DATABASE_PATH;
    process.env.PRODUCTION_DATABASE_PATH = productionFile;
    try {
        for (const file of [productionFile, process.env.DATABASE_PATH, path.resolve(__dirname, '../../prisma/dev.db'),
            path.resolve(__dirname, `outside-${randomUUID()}.db`)]) {
            expect(() => beforeGuards({ actor: 'system:fixture', file })).toThrow();
            expect(() => probe(file)).toThrow();
        }
        expect(fs.existsSync(productionFile)).toBe(false);
    } finally {
        if (previous === undefined) delete process.env.PRODUCTION_DATABASE_PATH;
        else process.env.PRODUCTION_DATABASE_PATH = previous;
    }
});

test('an opted-in snapshot has its creation hash, no sidecars and no returned writable handle', () => {
    const { file, preMigrationSnapshot } = legacy({ preMigrationSnapshot: true });
    expect(Object.keys(preMigrationSnapshot).sort()).toEqual(['path', 'sha256']);
    expect(createHash('sha256').update(fs.readFileSync(preMigrationSnapshot.path)).digest('hex')).toBe(preMigrationSnapshot.sha256);
    for (const suffix of ['-wal', '-shm', '-journal']) expect(fs.existsSync(`${preMigrationSnapshot.path}${suffix}`)).toBe(false);
    expect(probe(file)).toBeUndefined();
});
