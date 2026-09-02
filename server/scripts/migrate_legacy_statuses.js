const path = require('path');
const Database = require('better-sqlite3');
const { SAMPLE_STATE_LIST } = require('../workflowContract');

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, '../prisma/dev.db');
console.log(`[STATUS_MIGRATION] Opening database at: ${dbPath}`);
const db = new Database(dbPath);

function runMigration() {
    // 1. Initial count & report
    const beforeCounts = db.prepare('SELECT status, COUNT(*) as count FROM Sample GROUP BY status').all();
    console.log('\n=== STATUS DISTRIBUTION BEFORE MIGRATION ===');
    beforeCounts.forEach(r => console.log(`  ${(r.status || 'NULL').padEnd(25)} : ${r.count}`));

    const totalSamples = db.prepare('SELECT COUNT(*) as count FROM Sample').get().count;
    console.log(`Total samples: ${totalSamples}`);

    // 2. Perform Migration in Transaction
    const migrationTx = db.transaction(() => {
        const m1 = db.prepare("UPDATE Sample SET status = 'PROCESSING' WHERE status = 'ANALYSIS'").run();
        const m2 = db.prepare("UPDATE Sample SET status = 'SUBMITTED_PARTIAL' WHERE status = 'PARTIALLY_COMPLETE'").run();
        const m3 = db.prepare("UPDATE Sample SET status = 'SUBMITTED_FULL' WHERE status = 'COMPLETED'").run();
        const m4 = db.prepare("UPDATE Sample SET status = 'EXPECTED' WHERE status IN ('COLLECTED', 'NON_CONFORMING')").run();

        console.log('\n=== MIGRATION CHANGES APPLIED ===');
        console.log(`  ANALYSIS -> PROCESSING              : ${m1.changes} rows`);
        console.log(`  PARTIALLY_COMPLETE -> SUBMITTED_PARTIAL : ${m2.changes} rows`);
        console.log(`  COMPLETED -> SUBMITTED_FULL          : ${m3.changes} rows`);
        console.log(`  COLLECTED/NON_CONFORMING -> EXPECTED: ${m4.changes} rows`);
    });

    migrationTx();

    // 3. Post-migration audit
    const afterCounts = db.prepare('SELECT status, COUNT(*) as count FROM Sample GROUP BY status').all();
    console.log('\n=== STATUS DISTRIBUTION AFTER MIGRATION ===');
    afterCounts.forEach(r => console.log(`  ${(r.status || 'NULL').padEnd(25)} : ${r.count}`));

    // 4. Assert zero rows outside SAMPLE_STATE_LIST
    const invalidRows = db.prepare(`SELECT id, status FROM Sample WHERE status NOT IN (${SAMPLE_STATE_LIST.map(() => '?').join(',')})`).all(...SAMPLE_STATE_LIST);
    if (invalidRows.length > 0) {
        console.error(`\n[ERROR] Found ${invalidRows.length} rows with invalid statuses:`, invalidRows.slice(0, 5));
        process.exit(1);
    } else {
        console.log('\n? SUCCESS: All sample rows strictly conform to canonical SAMPLE_STATES!');
    }
}

runMigration();
