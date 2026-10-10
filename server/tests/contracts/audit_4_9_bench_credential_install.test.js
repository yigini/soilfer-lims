const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { createHash, randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { installBenchCredentials, assertBenchCredentialStartupReady, parseArguments } = require('../../scripts/install_bench_credentials');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-202-install-'));
afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));

// Starts from the fully installed test template and removes only #202 objects,
// giving the exact fresh-Prisma and pre-#202 shapes the installer must accept.
async function database(shape) {
    const file = path.join(directory, randomUUID() + '.db'), source = new Database(process.env.DATABASE_PATH, { readonly: true });
    try { await source.backup(file); } finally { source.close(); }
    const db = new Database(file);
    try {
        db.exec('DELETE FROM "UserBenchCredential"');
        if (shape !== 'COMPLETE') db.prepare('DELETE FROM _schema_migrations WHERE id=?').run('202_bench_credentials');
        if (shape === 'PRE') db.exec('DROP TABLE "UserBenchCredential"');
    } finally { db.close(); }
    return file;
}
const digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const users = file => { const db = new Database(file, { readonly: true }); try { return db.prepare('SELECT id,username,password FROM "User" ORDER BY id').all(); } finally { db.close(); } };

test.each(['PRE', 'FRESH'])('%s databases dry-run without writes, then apply additively with a verified receipt', async shape => {
    const file = await database(shape), before = digest(file), retained = users(file);
    const dry = installBenchCredentials({ dbPath: file });
    expect(dry).toMatchObject({ classification: shape === 'PRE' ? 'PRE_202' : 'FRESH_PRISMA_202', mode: 'DRY_RUN', totalChanges: 0 });
    expect(digest(file)).toBe(before);
    expect(() => assertBenchCredentialStartupReady(file)).toThrow(expect.objectContaining({ code: 'BENCH_CREDENTIAL_STARTUP_REQUIRED' }));
    const applied = installBenchCredentials({ dbPath: file, apply: true });
    expect(applied).toMatchObject({ classification: 'COMPLETE_202', previousClassification: dry.classification, mode: 'APPLIED', backfilledCount: 0,
        receipt: { originalRowsPreserved: true, backfilledCount: 0 } });
    expect(users(file)).toEqual(retained);
    const settled = digest(file);
    expect(installBenchCredentials({ dbPath: file, apply: true })).toMatchObject({ classification: 'COMPLETE_202', mode: 'NO_OP', totalChanges: 0 });
    expect(digest(file)).toBe(settled);
    expect(assertBenchCredentialStartupReady(file).classification).toBe('COMPLETE_202');
});

test('unmarked credentials, a marker without its table and an altered table refuse with zero writes', async () => {
    const populated = await database('FRESH');
    let db = new Database(populated);
    try {
        db.prepare('INSERT INTO "User"(id,username,password,email,role,updatedAt) VALUES(?,?,?,?,?,?)').run('bench-user', 'bench-user', 'hash', 'bench@example.test', 'LAB_TECHNICIAN', Date.now());
        db.prepare('INSERT INTO "UserBenchCredential"(userId,pinHash,updatedAt) VALUES(?,?,?)').run('bench-user', 'unreviewed', Date.now());
    } finally { db.close(); }
    let before = digest(populated);
    expect(() => installBenchCredentials({ dbPath: populated, apply: true })).toThrow(expect.objectContaining({ code: 'BENCH_CREDENTIAL_SCHEMA_MISMATCH',
        differences: ['Unmarked bench credentials must not be adopted'] }));
    expect(digest(populated)).toBe(before);

    const orphan = await database('COMPLETE');
    db = new Database(orphan);
    try { db.exec('DROP TABLE "UserBenchCredential"'); } finally { db.close(); }
    before = digest(orphan);
    expect(() => installBenchCredentials({ dbPath: orphan, apply: true })).toThrow(expect.objectContaining({ code: 'BENCH_CREDENTIAL_SCHEMA_MISMATCH',
        differences: ['Bench credential installation is partial or unmarked'] }));
    expect(digest(orphan)).toBe(before);

    const altered = await database('PRE');
    db = new Database(altered);
    try { db.exec('CREATE TABLE "UserBenchCredential" ("userId" TEXT NOT NULL PRIMARY KEY, "pinHash" TEXT)'); } finally { db.close(); }
    before = digest(altered);
    expect(() => installBenchCredentials({ dbPath: altered, apply: true })).toThrow(expect.objectContaining({ code: 'BENCH_CREDENTIAL_SCHEMA_MISMATCH',
        differences: ['UserBenchCredential differs'] }));
    expect(digest(altered)).toBe(before);
});

test('the command line requires an explicit database and one mode', () => {
    expect(parseArguments(['--db', 'lab.db'])).toEqual({ apply: false, dbPath: 'lab.db' });
    expect(parseArguments(['--db', 'lab.db', '--apply'])).toEqual({ apply: true, dbPath: 'lab.db' });
    for (const args of [[], ['--apply'], ['--db', 'lab.db', '--apply', '--dry-run'], ['--db', 'lab.db', '--force']])
        expect(() => parseArguments(args)).toThrow(expect.objectContaining({ code: 'BENCH_CREDENTIAL_ARGUMENT_INVALID' }));
});
