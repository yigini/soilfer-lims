const Database = require('better-sqlite3');
const path = require('path');

function migrateDatabase(dbPath) {
    const db = new Database(dbPath, { timeout: 5000 });
    console.log(`[MIGRATE] Checking Stage B columns on: ${dbPath}`);

    const sampleCols = new Set(db.prepare("PRAGMA table_info(Sample);").all().map(c => c.name));

    const stageBCols = [
        { name: 'latitude', type: 'REAL' },
        { name: 'longitude', type: 'REAL' },
        { name: 'elevation', type: 'REAL' },
        { name: 'positionalUncertaintyM', type: 'REAL' },
        { name: 'locationSource', type: 'TEXT' },
        { name: 'locationCapturedAt', type: 'DATETIME' },
        { name: 'locationCapturedBy', type: 'TEXT' },
        { name: 'compositeRadiusM', type: 'REAL' },
        { name: 'depthTopCm', type: 'REAL' },
        { name: 'depthBottomCm', type: 'REAL' },
        { name: 'admin1', type: 'TEXT' },
        { name: 'admin2', type: 'TEXT' },
        { name: 'village', type: 'TEXT' },
        { name: 'siteName', type: 'TEXT' }
    ];

    for (const col of stageBCols) {
        if (!sampleCols.has(col.name)) {
            db.prepare(`ALTER TABLE Sample ADD COLUMN ${col.name} ${col.type};`).run();
            console.log(`  + Added Sample.${col.name} (${col.type})`);
        } else {
            console.log(`  - Sample.${col.name} already exists`);
        }
    }

    db.close();
    console.log("[MIGRATE] Stage B migration complete.");
}

if (require.main === module) {
    const targetDb = process.env.DATABASE_PATH || path.join(__dirname, '..', 'prisma', 'dev.db');
    migrateDatabase(targetDb);
}

module.exports = { migrateDatabase };
