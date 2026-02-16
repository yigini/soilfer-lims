const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'prisma', 'dev.db');
console.log('Opening DB at:', dbPath);

try {
    const db = new Database(dbPath);
    // Add language column
    try {
        db.prepare('ALTER TABLE User ADD COLUMN language TEXT').run();
        console.log('SUCCESS: "language" column added.');
    } catch (e) {
        if (e.message.includes('duplicate column')) {
            console.log('NOTICE: "language" column already exists.');
        } else {
            console.error('ERROR adding language:', e.message);
        }
    }
} catch (e) {
    console.error('Error opening DB:', e.message);
}
