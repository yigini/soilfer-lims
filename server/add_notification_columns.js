const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'prisma', 'dev.db');
console.log('Opening DB at:', dbPath);

const db = new Database(dbPath);

const columnsToAdd = [
    'titleCode TEXT',
    'titleParams TEXT',
    'messageCode TEXT',
    'messageParams TEXT'
];

columnsToAdd.forEach(colDef => {
    try {
        const stmt = `ALTER TABLE Notification ADD COLUMN ${colDef}`;
        console.log(`Executing: ${stmt}`);
        db.prepare(stmt).run();
        console.log('Success.');
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            console.log(`Column already exists: ${colDef.split(' ')[0]}`);
        } else {
            console.error('Error adding column:', e.message);
        }
    }
});

console.log('Done.');
