'use strict';
const { createHash } = require('node:crypto');

function appendRows(hash, rows, transform = row => row) {
    hash.update('[');
    let separator = '';
    for (const row of rows) {
        hash.update(separator);
        hash.update(JSON.stringify(transform(row)));
        separator = ',';
    }
    hash.update(']');
}

// Same bytes as JSON.stringify([...rows]), retaining only the current row.
function fingerprintRows(rows) {
    const hash = createHash('sha256');
    appendRows(hash, rows);
    return hash.digest('hex');
}

// Preserve the old Object.fromEntries / JSON.stringify table and row ordering,
// including JavaScript's integer property-name ordering. Only schema names are
// collected; historical rows remain lazy better-sqlite3 iterators.
function fingerprintRetainedTables(db, { excludeTables = [], tableNames, orderBy = 'rowid', transformRow } = {}) {
    if (!['rowid', 'id'].includes(orderBy)) throw new TypeError('Unknown retained-row order.');
    const excluded = new Set(excludeTables);
    const names = (tableNames || db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all().map(row => row.name)).filter(name => !excluded.has(name));
    const ordered = Object.keys(Object.fromEntries(names.map(name => [name, null])));
    const hash = createHash('sha256');
    hash.update('{');
    let separator = '';
    for (const name of ordered) {
        hash.update(separator);
        hash.update(JSON.stringify(name));
        hash.update(':');
        const rows = db.prepare('SELECT * FROM "' + name.replace(/"/g, '""') + '" ORDER BY ' + orderBy).iterate();
        appendRows(hash, rows, transformRow ? row => transformRow(name, row) : undefined);
        separator = ',';
    }
    hash.update('}');
    return hash.digest('hex');
}

module.exports = { fingerprintRows, fingerprintRetainedTables };
