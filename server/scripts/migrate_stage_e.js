/**
 * Migration script for Stage E: RC-19 Distinct RECEIVED_REJECTED State & Immutable Chain of Custody
 * Adds custody columns to Sample and Consignment tables in SQLite.
 * Safely updates any existing rejected samples with rejection reasons to RECEIVED_REJECTED.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace('file:', '')
    : path.join(__dirname, '..', 'prisma', 'dev.db');

console.log('[MIGRATE-E] Running Stage E schema migration on:', dbPath);

if (!fs.existsSync(dbPath)) {
    console.error(`[MIGRATE-E] Database file does not exist at ${dbPath}`);
    process.exit(1);
}

const db = new Database(dbPath);

try {
    const custodyCols = [
        { name: 'custodyHandoverAt', type: 'DATETIME' },
        { name: 'custodyCarrierName', type: 'TEXT' },
        { name: 'custodyTrackingNumber', type: 'TEXT' },
        { name: 'custodySenderSignature', type: 'TEXT' },
        { name: 'receivingOfficerId', type: 'TEXT' },
        { name: 'receivingOfficerName', type: 'TEXT' },
        { name: 'receivingOfficerSignature', type: 'TEXT' }
    ];

    // 1. Add columns to Sample
    const sampleCols = db.pragma('table_info(Sample)');
    for (const col of custodyCols) {
        if (!sampleCols.some(c => c.name === col.name)) {
            console.log(`  + Adding Sample.${col.name} (${col.type})`);
            db.exec(`ALTER TABLE "Sample" ADD COLUMN "${col.name}" ${col.type};`);
        } else {
            console.log(`  = Sample.${col.name} already exists.`);
        }
    }

    // 2. Add columns to Consignment
    const csgTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Consignment'").get();
    if (csgTableExists) {
        const csgCols = db.pragma('table_info(Consignment)');
        for (const col of custodyCols) {
            if (!csgCols.some(c => c.name === col.name)) {
                console.log(`  + Adding Consignment.${col.name} (${col.type})`);
                db.exec(`ALTER TABLE "Consignment" ADD COLUMN "${col.name}" ${col.type};`);
            } else {
                console.log(`  = Consignment.${col.name} already exists.`);
            }
        }
    }

    // 3. Migrate historical rejected samples: any sample with a rejection reason currently marked EXPECTED or REJECTED
    const updateResult = db.prepare(`
        UPDATE "Sample"
        SET "status" = 'RECEIVED_REJECTED'
        WHERE "rejectionReason" IS NOT NULL
          AND "status" IN ('EXPECTED', 'REJECTED')
    `).run();

    console.log(`  + Migrated ${updateResult.changes} historical sample(s) with rejection reasons to 'RECEIVED_REJECTED'.`);

    console.log('[MIGRATE-E] Migration completed successfully.');
} catch (err) {
    console.error('[MIGRATE-E] Migration failed:', err.message);
    process.exit(1);
} finally {
    db.close();
}
