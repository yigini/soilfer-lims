const fs = require('node:fs'), path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const Database = require('better-sqlite3');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { fingerprintRows, fingerprintRetainedTables } = require('../../services/retainedRowsFingerprint');
const legacyHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const exclusions = [['NonconformityReport', '_schema_migrations'], ['ReportedValueSelection'],
    ['BatchReagentLot', '_schema_migrations'], ['ResultOverrideRequest', '_schema_migrations'],
    ['CrossCheckEvaluation', '_schema_migrations']];
const owned = [];

// The previous installer algorithm is retained only as a test oracle.
function legacyRows(db, excludeTables) {
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all().map(row => row.name).filter(name => !excludeTables.includes(name));
    return Object.fromEntries(names.map(name => [name,
        db.prepare('SELECT * FROM "' + name.replace(/"/g, '""') + '" ORDER BY rowid').all()]));
}

function synthetic(count = 0) {
    const file = assertOwnedTestDatabase(path.resolve(__dirname, '../.tmp', `streamed_${randomUUID()}.db`), 'system:fixture');
    owned.push(file);
    const db = new Database(file);
    db.exec('CREATE TABLE "10" ("2" TEXT,"1" INTEGER); CREATE TABLE "2" (empty TEXT);'
        + 'CREATE TABLE "a\\quoted\"\"name" (id INTEGER PRIMARY KEY, payload TEXT, raw BLOB, optional TEXT, number REAL);'
        + 'CREATE TABLE ProficiencyRound(id TEXT, outcome TEXT);'
        + 'CREATE TABLE NonconformityReport(id TEXT); CREATE TABLE _schema_migrations(id TEXT, details TEXT);'
        + 'CREATE TABLE ReportedValueSelection(id TEXT);');
    db.exec('CREATE TABLE WorkAttempt(id TEXT, metadata TEXT);'
        + 'CREATE TABLE BatchReagentLot(id TEXT); CREATE TABLE ResultOverrideRequest(id TEXT);'
        + 'CREATE TABLE CrossCheckEvaluation(id TEXT);');
    db.prepare('INSERT INTO WorkAttempt VALUES (?,?)').run('z-last', 'retained');
    db.prepare('INSERT INTO WorkAttempt VALUES (?,?)').run('a-first', 'retained');
    db.prepare('INSERT INTO "10" VALUES (?,?)').run('numeric property order', 7);
    db.prepare('INSERT INTO ProficiencyRound VALUES (?,?)').run('round-old', 'UNSATISFACTORY');
    db.prepare('INSERT INTO _schema_migrations VALUES (?,?)').run('historical', '{"retained":true}');
    const insert = db.prepare('INSERT INTO "a\\quoted\"\"name" VALUES (?,?,?,?,?)');
    db.transaction(() => {
        for (let index = 0; index < count; index++) insert.run(index + 1,
            'x'.repeat(4096) + '\u0000\n\\"é𝄞\ud800:' + index, Buffer.from([0, 255, index % 256]), null, index / 7);
    })();
    return { file, db };
}

afterAll(() => {
    for (const file of owned) {
        assertOwnedTestDatabase(file, 'system:fixture');
        for (const suffix of ['', '-wal', '-shm']) if (fs.existsSync(file + suffix)) fs.unlinkSync(file + suffix);
    }
});

test('both historical installer fingerprints are byte-identical on the real published test template', () => {
    const file = path.resolve(__dirname, '../../prisma/dev.db');
    const before = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    const db = new Database(file, { readonly: true, fileMustExist: true });
    try {
        for (const excludeTables of exclusions) expect(fingerprintRetainedTables(db, { excludeTables }))
            .toBe(legacyHash(legacyRows(db, excludeTables)));
    } finally { db.close(); }
    expect(createHash('sha256').update(fs.readFileSync(file)).digest('hex')).toBe(before);
});

test('ordered JSON handles empty tables, integer keys, quoted names, Unicode, BLOBs and NULL', () => {
    const { db } = synthetic(3);
    try {
        for (const excludeTables of exclusions) expect(fingerprintRetainedTables(db, { excludeTables }))
            .toBe(legacyHash(legacyRows(db, excludeTables)));
        const rows = db.prepare('SELECT * FROM "a\\quoted\"\"name" ORDER BY rowid');
        expect(fingerprintRows(rows.iterate())).toBe(legacyHash(rows.all()));
        expect(fingerprintRows([])).toBe(legacyHash([]));
    } finally { db.close(); }
});

test('PRE_193 virtual NULL column matches the old expected-row hash without changing rows', () => {
    const { db } = synthetic(2);
    try {
        const before = legacyRows(db, exclusions[0]);
        const expected = { ...before, ProficiencyRound: before.ProficiencyRound.map(row => ({ ...row, nonconformityId: null })) };
        expect(fingerprintRetainedTables(db, { excludeTables: exclusions[0],
            transformRow: (table, row) => table === 'ProficiencyRound' ? { ...row, nonconformityId: null } : row }))
            .toBe(legacyHash(expected));
        expect(legacyRows(db, exclusions[0])).toEqual(before);
        expect(db.prepare('SELECT total_changes() n').get().n).toBe(7);
    } finally { db.close(); }
});

test('repeat installer explicit table/id order and virtual NULL fields match its original bytes', () => {
    const { db } = synthetic(2);
    try {
        const tableNames = ['WorkAttempt', '_schema_migrations', 'ProficiencyRound'];
        const before = Object.fromEntries(tableNames.map(table => [table,
            db.prepare('SELECT * FROM "'+table+'" ORDER BY id').all()]));
        expect(fingerprintRetainedTables(db, { tableNames, orderBy: 'id' })).toBe(legacyHash(before));
        const expected = { ...before, WorkAttempt: before.WorkAttempt.map(row => ({ ...row, parentAttemptId: null, note: null })) };
        expect(fingerprintRetainedTables(db, { tableNames, orderBy: 'id',
            transformRow: (table, row) => table === 'WorkAttempt' ? { ...row, parentAttemptId: null, note: null } : row }))
            .toBe(legacyHash(expected));
        expect(Object.fromEntries(tableNames.map(table => [table, db.prepare('SELECT * FROM "'+table+'" ORDER BY id').all()])))
            .toEqual(before);
    } finally { db.close(); }
});

test('a changed historical field changes the fingerprint', () => {
    const { db } = synthetic(1);
    try {
        const before = fingerprintRetainedTables(db, { excludeTables: exclusions[0] });
        db.prepare('UPDATE ProficiencyRound SET outcome=? WHERE id=?').run('QUESTIONABLE', 'round-old');
        expect(fingerprintRetainedTables(db, { excludeTables: exclusions[0] })).not.toBe(before);
    } finally { db.close(); }
});

test('large historical fixture matches the old digests and streams in a 48 MiB child heap', () => {
    const { file, db } = synthetic(20000);
    let expected;
    try {
        for (const excludeTables of exclusions) {
            const digest = legacyHash(legacyRows(db, excludeTables));
            expect(fingerprintRetainedTables(db, { excludeTables })).toBe(digest);
            if (excludeTables === exclusions[0]) expected = digest;
        }
    } finally { db.close(); }
    const code = `const D=require('better-sqlite3');
        const {assertOwnedTestDatabase}=require('./tests/helpers/testOwnedDatabase');
        const {fingerprintRetainedTables}=require('./services/retainedRowsFingerprint');
        const db=new D(assertOwnedTestDatabase(process.argv[1],'system:fixture'),{readonly:true,fileMustExist:true});
        try{console.log(fingerprintRetainedTables(db,{excludeTables:['NonconformityReport','_schema_migrations']}));}finally{db.close();}`;
    const actual = execFileSync(process.execPath, ['--max-old-space-size=48', '-e', code, file],
        { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8', timeout: 45000 });
    expect(actual.trim()).toBe(expected);
}, 60000);
