const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'prisma/dev.db');
const db = new Database(dbPath);

const rows = db.prepare('SELECT * FROM Language').all();
console.log(`Found ${rows.length} languages locally.`);

// Check if es-419 exists
let es419 = rows.find(r => r.code === 'es-419');
const es = rows.find(r => r.code === 'es');

if (es) {
    if (!es419) {
        console.log('Duplicating ES to ES-419...');
        es419 = { ...es, code: 'es-419', name: 'Español (Latinoamérica)', isDefault: 0 };
        rows.push(es419);
    } else if (es419.translations === '{}' || es419.translations.length < 10) {
        console.log('ES-419 found but empty. Overwriting with ES translations...');
        es419.translations = es.translations;
    }
}

fs.writeFileSync(path.join(__dirname, 'languages_dump.json'), JSON.stringify(rows, null, 2));
console.log(`Exported ${rows.length} languages to languages_dump.json`);
