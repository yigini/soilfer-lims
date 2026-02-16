const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'prisma/dev.db');
console.log('Opening DB at:', dbPath);
const db = new Database(dbPath);

const dumpPath = path.join(__dirname, 'languages_dump.json');
if (!fs.existsSync(dumpPath)) {
    console.error('languages_dump.json not found!');
    process.exit(1);
}

const languages = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const stmt = db.prepare('INSERT OR REPLACE INTO Language (code, name, isDefault, translations) VALUES (?, ?, ?, ?)');

const insertTransaction = db.transaction((languages) => {
    for (const lang of languages) {
        console.log(`Importing ${lang.code}...`);
        stmt.run(lang.code, lang.name, lang.isDefault, lang.translations);
    }
});

try {
    insertTransaction(languages);
    console.log('SUCCESS: Imported languages.');
} catch (e) {
    console.error('ERROR:', e.message);
}
