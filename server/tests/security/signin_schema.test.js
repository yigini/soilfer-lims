const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { assertOwnedTestDatabase } = require('../helpers/testOwnedDatabase');
const { installSignInProtection, assertSignInStartupReady } = require('../../scripts/install_signin_protection');
const { loadSignInMigrationSource } = require('../../services/signinMigrationSource');

async function fixture() {
    const file = path.resolve(__dirname, '../.tmp/test_signin_schema_' + randomUUID() + '.db');
    assertOwnedTestDatabase(file, 'system:fixture');
    const reader = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
    try { await reader.backup(file); } finally { reader.close(); }
    return file;
}
function legacyRows(db) {
    const result = {};
    for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'AuthLoginState' ORDER BY name").all()) {
        const quoted = '"' + name.replaceAll('"', '""') + '"';
        const rows = db.prepare('SELECT * FROM ' + quoted + (name === '_schema_migrations' ? " WHERE id<>'338_signin_protection'" : '') + ' ORDER BY rowid').all();
        result[name] = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    }
    return result;
}

test('sign-in installer dry-run is read-only; apply preserves every existing synthetic table and is idempotent', async () => {
    const file = await fixture();
    const writer = new Database(file);
    writer.exec('DROP TABLE "AuthLoginState"');
    writer.prepare('DELETE FROM _schema_migrations WHERE id=?').run('338_signin_protection');
    const before = legacyRows(writer); writer.close();
    expect(installSignInProtection({ dbPath: file }).classification).toBe('PRE_338');
    expect(() => assertSignInStartupReady(file)).toThrow();
    const applied = installSignInProtection({ dbPath: file, apply: true });
    expect(applied).toMatchObject({ classification: 'COMPLETE_338', mode: 'APPLIED', backfilledCount: 0 });
    const reader = new Database(file, { readonly: true });
    try { expect(legacyRows(reader)).toEqual(before); } finally { reader.close(); }
    expect(installSignInProtection({ dbPath: file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
    expect(assertSignInStartupReady(file).classification).toBe('COMPLETE_338');
});

test('partial or unmarked populated sign-in state refuses adoption without writes', async () => {
    const file = await fixture(), writer = new Database(file);
    writer.prepare('DELETE FROM _schema_migrations WHERE id=?').run('338_signin_protection');
    writer.prepare('INSERT INTO AuthLoginState(accountKey) VALUES(?)').run('synthetic-existing-unmarked-state');
    const before = legacyRows(writer); writer.close();
    expect(() => installSignInProtection({ dbPath: file, apply: true })).toThrow('differs');
    const reader = new Database(file, { readonly: true });
    try {
        expect(legacyRows(reader)).toEqual(before);
        expect(reader.prepare('SELECT count(*) n FROM AuthLoginState').get().n).toBe(1);
    } finally { reader.close(); }
});

test('canonical DDL is digest-bound before opening any requested database', () => {
    const source = loadSignInMigrationSource();
    expect(createHash('sha256').update(source.sql).digest('hex')).toBe(source.sha256);
    const original = fs.readFileSync;
    const read = jest.spyOn(fs, 'readFileSync').mockImplementation((name, ...args) => {
        if (String(name).includes('20261024000100_signin_protection') && String(name).endsWith('migration.sql')) return Buffer.from(source.sql + '\n');
        return original(name, ...args);
    });
    try { expect(() => loadSignInMigrationSource()).toThrow('digest differs'); }
    finally { read.mockRestore(); }
});
