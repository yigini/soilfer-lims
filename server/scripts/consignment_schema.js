const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

function inspect(db) {
    const hash = crypto.createHash('sha256');
    let rowCount = 0;
    for (const row of db.prepare('SELECT id, code, expectedCount FROM Consignment ORDER BY id').iterate()) {
        hash.update(JSON.stringify([row.id, row.code, row.expectedCount]) + '\n'); rowCount++;
    }
    return { mode: 'dry-run', rowCount, fingerprint: hash.digest('hex'),
        columns: db.prepare('PRAGMA table_info("Consignment")').all(),
        indexes: db.prepare("SELECT name, sql FROM sqlite_master WHERE tbl_name = 'Consignment' AND type = 'index' AND sql IS NOT NULL ORDER BY name").all(),
        foreignKeys: db.prepare('PRAGMA foreign_key_list("Consignment")').all(), foreignKeyErrors: db.prepare('PRAGMA foreign_key_check').all() };
}
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--database') { console.error('Usage: node scripts/consignment_schema.js --database <existing SQLite file>'); process.exitCode = 2; }
    else {
        const db = new Database(path.resolve(args[1]), { readonly: true, fileMustExist: true });
        try { console.log(JSON.stringify(inspect(db), null, 2)); } finally { db.close(); }
    }
}
module.exports = { inspect };
