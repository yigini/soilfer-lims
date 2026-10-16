const Database = require('better-sqlite3');
const { assertOwnedTestDatabase } = require('./testOwnedDatabase');
const { loadCustodyMigrationSource } = require('../../services/custodyMigrationSource');

// Explicitly extend an already verified historical fixture for current-client
// behavioural tests. Historical source/checksum assertions run before this call;
// this is not an installation receipt or a claim of startup readiness.
function extendHistoricalCustodyFixture(file) {
    assertOwnedTestDatabase(file, 'system:fixture');
    const db = new Database(file, { fileMustExist: true });
    try {
        const source = loadCustodyMigrationSource();
        db.transaction(() => db.exec(source.schemaSql))();
    } finally { db.close(); }
}
module.exports = { extendHistoricalCustodyFixture };
