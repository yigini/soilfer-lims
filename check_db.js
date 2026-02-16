const Database = require('better-sqlite3');
const path = require('path');

// Try to find dev.db in server/prisma/dev.db
const dbPath = path.join(__dirname, 'server', 'prisma', 'dev.db');
console.log('Checking DB at:', dbPath);

try {
    const db = new Database(dbPath, { readonly: true });
    const columns = db.pragma('table_info(User)');
    console.log('Columns in User table:');
    console.log(columns.map(c => c.name).join(', '));

    if (columns.find(c => c.name === 'language')) {
        console.log('SUCCESS: "language" column exists.');
    } else {
        console.error('FAILURE: "language" column MISSING.');
    }
} catch (e) {
    console.error('Error opening DB:', e.message);
}
