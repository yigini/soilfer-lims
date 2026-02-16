const Database = require('better-sqlite3');
const path = require('path');

// dev.db is in server/prisma/dev.db relative to root, so relative to server/check_db.js it is prisma/dev.db
const dbPath = path.join(__dirname, 'prisma', 'dev.db');
console.log('Checking DB at:', dbPath);

try {
    const db = new Database(dbPath, { readonly: true });
    const user = db.prepare("SELECT * FROM User WHERE id = ?").get('100');
    console.log('User 100:', user);

    if (user) {
        console.log('SUCCESS: User 100 exists.');
    } else {
        console.error('FAILURE: User 100 MISSING.');

        // List all users to see what IDs exist
        const allUsers = db.prepare("SELECT id, username, role FROM User").all();
        console.log('All Users:', allUsers);
    }
} catch (e) {
    console.error('Error opening DB:', e.message);
    process.exit(1);
}
