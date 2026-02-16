const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'prisma', 'dev.db');
console.log('Opening DB at:', dbPath);

const db = new Database(dbPath);

const LANG = {
    code: 'es-419',
    name: 'Español (Latinoamérica)',
    isDefault: 0,
    translations: JSON.stringify({})
};

try {
    const stmt = db.prepare('INSERT OR IGNORE INTO Language (code, name, isDefault, translations) VALUES (?, ?, ?, ?)');
    const info = stmt.run(LANG.code, LANG.name, LANG.isDefault, LANG.translations);
    if (info.changes > 0) {
        console.log('SUCCESS: Added es-419');
    } else {
        console.log('NOTICE: es-419 already exists');
    }
} catch (e) {
    console.error('ERROR:', e.message);
}
