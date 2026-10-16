/**
 * Migration script: Spectroscopy Operational Corrections
 * Adds workItemId and attemptNo columns to SpectralData table in SQLite.
 * Zero modification to historical scans or S002 records.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace('file:', '')
    : path.join(__dirname, '..', 'prisma', 'dev.db');

console.log('[MIGRATE-SPECTRAL] Running Spectroscopy Operational Corrections migration on:', dbPath);

if (!fs.existsSync(dbPath)) {
    console.error(`[MIGRATE-SPECTRAL] Database file does not exist at ${dbPath}`);
    process.exit(1);
}

const db = new Database(dbPath);

try {
    const spectralCols = [
        { name: 'workItemId', type: 'TEXT' },
        { name: 'attemptNo', type: 'INTEGER DEFAULT 1' }
    ];

    const currentCols = db.pragma('table_info("SpectralData")');
    for (const col of spectralCols) {
        if (!currentCols.some(c => c.name === col.name)) {
            console.log(`  + Adding SpectralData.${col.name} (${col.type})`);
            db.exec(`ALTER TABLE "SpectralData" ADD COLUMN "${col.name}" ${col.type};`);
        } else {
            console.log(`  = SpectralData.${col.name} already exists.`);
        }
    }

    try {
        db.exec(`CREATE INDEX IF NOT EXISTS "idx_spectral_workitem_current" ON "SpectralData"("workItemId", "isCurrent");`);
        console.log(`  + Index idx_spectral_workitem_current ensured.`);
    } catch (idxErr) {
        console.warn(`  ! Index creation warning:`, idxErr.message);
    }

    console.log('[MIGRATE-SPECTRAL] Migration completed successfully.');
} catch (err) {
    console.error('[MIGRATE-SPECTRAL] Migration failed:', err);
    process.exit(1);
} finally {
    db.close();
}
