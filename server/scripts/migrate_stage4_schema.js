const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../prisma/dev.db');
const db = new Database(dbPath);

console.log('Migrating dev.db for Stage 4...');

function addCol(table, col, type) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes(col)) {
        console.log(`Adding ${col} to ${table}...`);
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type};`);
    } else {
        console.log(`${table}.${col} already exists.`);
    }
}

addCol('Analysis', 'executionOrder', 'INTEGER DEFAULT 100');
addCol('Analysis', 'prerequisites', 'TEXT');

console.log('Stage 4 database migration complete.');
db.close();
