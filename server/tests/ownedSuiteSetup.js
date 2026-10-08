const fs = require('node:fs'), path = require('node:path');
const { randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { assertOwnedTestDatabase } = require('./helpers/testOwnedDatabase');

// Pin6068463777: preserve immutable attempt events by giving each suite its
// own real, fully installed database. No guard, actor or permission is mocked.
module.exports = async function ownedSuiteSetup() {
    const template = process.env.DATABASE_PATH;
    const directory = path.resolve(__dirname, '.tmp');
    if (process.env.NODE_ENV !== 'test' || typeof template !== 'string' ||
        path.dirname(path.resolve(template)) !== directory || !path.basename(template).startsWith('test_')) {
        throw Error('Suite isolation requires the real global-setup owned template.');
    }
    const file = path.join(directory, 'test_suite_' + randomUUID() + '.db');
    assertOwnedTestDatabase(file, 'system:fixture');
    if (fs.existsSync(file)) throw Error('Suite isolation refuses an existing destination.');
    const reader = new Database(template, { readonly: true, fileMustExist: true });
    try { await reader.backup(file); } finally { reader.close(); }
    process.env.DATABASE_PATH = file;
    process.env.DATABASE_URL = 'file:' + file;
};
