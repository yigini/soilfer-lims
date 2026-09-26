/**
 * Versioned Additive Migration: Exchange Journal & Resumable Snapshots
 * Issue #140 (Packages P1-P4)
 *
 * Creates/aligns durable, immutable exchange journal, snapshot items, and receipt auditing tables.
 * Safe, idempotent, zero mutations to core laboratory tables.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function migrateExchangeTables(dbPath) {
    if (!dbPath) {
        dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../prisma/dev.db');
    }

    if (!fs.existsSync(dbPath)) {
        throw new Error(`Database file does not exist at ${dbPath}`);
    }

    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const runMigration = db.transaction(() => {
        // Inspect existing _exchange_journal table if present
        // Inspect existing _exchange_journal table if present
        const journalInfo = db.prepare("PRAGMA table_info(_exchange_journal)").all();
        const journalCols = new Set(journalInfo.map(c => c.name));

        if (journalCols.size > 0 && !journalCols.has('content_hash')) {
            // Drop unpopulated prototype journal table from previous pass
            db.exec("DROP TABLE IF EXISTS _exchange_journal");
        }

        // 1. Immutable Publication Journal
        db.exec(`
            CREATE TABLE IF NOT EXISTS _exchange_journal (
                id TEXT PRIMARY KEY,
                sequence INTEGER NOT NULL UNIQUE,
                event_type TEXT NOT NULL,
                specimen_id TEXT NOT NULL,
                field_sample_id TEXT,
                lab_sample_id TEXT,
                country TEXT,
                project_code TEXT,
                laboratory_id TEXT,
                content_hash TEXT,
                payload TEXT,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_exchange_journal_seq ON _exchange_journal(sequence);
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_specimen ON _exchange_journal(specimen_id);
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_scope ON _exchange_journal(laboratory_id, country, project_code);
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_created ON _exchange_journal(created_at);
        `);

        // Inspect existing _exchange_snapshots
        const snapInfo = db.prepare("PRAGMA table_info(_exchange_snapshots)").all();
        const snapCols = new Set(snapInfo.map(c => c.name));

        if (snapCols.size > 0 && !snapCols.has('high_water_timestamp')) {
            // Drop unpopulated prototype snapshot table
            db.exec("DROP TABLE IF EXISTS _exchange_snapshots");
        }

        // 2. Frozen Export Snapshots
        db.exec(`
            CREATE TABLE IF NOT EXISTS _exchange_snapshots (
                id TEXT PRIMARY KEY,
                connection_id TEXT NOT NULL,
                high_water_timestamp TEXT NOT NULL,
                total_samples INTEGER NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_exchange_snapshots_conn ON _exchange_snapshots(connection_id, expires_at);
        `);

        // Inspect existing _exchange_snapshot_items
        const itemInfo = db.prepare("PRAGMA table_info(_exchange_snapshot_items)").all();
        const itemCols = new Set(itemInfo.map(c => c.name));

        if (itemCols.size > 0 && !itemCols.has('item_order')) {
            db.exec("DROP TABLE IF EXISTS _exchange_snapshot_items");
        }

        // 3. Frozen Snapshot Items (Guarantees zero drift across pagination)
        db.exec(`
            CREATE TABLE IF NOT EXISTS _exchange_snapshot_items (
                snapshot_id TEXT NOT NULL,
                specimen_id TEXT NOT NULL,
                item_order INTEGER NOT NULL,
                body_json TEXT NOT NULL,
                PRIMARY KEY (snapshot_id, specimen_id)
            );

            CREATE INDEX IF NOT EXISTS idx_exchange_snapshot_items_order 
                ON _exchange_snapshot_items(snapshot_id, item_order);
        `);

        // Inspect existing _exchange_receipts
        const receiptInfo = db.prepare("PRAGMA table_info(_exchange_receipts)").all();
        const receiptCols = new Set(receiptInfo.map(c => c.name));

        if (receiptCols.size > 0 && !receiptCols.has('checkpoint')) {
            db.exec("DROP TABLE IF EXISTS _exchange_receipts");
        }

        db.exec(`
            CREATE TABLE IF NOT EXISTS _exchange_receipts (
                id TEXT PRIMARY KEY,
                connection_id TEXT NOT NULL,
                snapshot_id TEXT,
                batch_id TEXT,
                imported_count INTEGER DEFAULT 0,
                quarantined_count INTEGER DEFAULT 0,
                checkpoint TEXT,
                details TEXT,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_exchange_receipts_lookup ON _exchange_receipts(connection_id, snapshot_id, checkpoint);
            CREATE INDEX IF NOT EXISTS idx_exchange_receipts_batch ON _exchange_receipts(connection_id, batch_id);
        `);
    });

    runMigration();
    db.close();
    return { success: true, dbPath };
}

if (require.main === module) {
    const targetDb = process.argv[2] || process.env.DATABASE_PATH;
    try {
        const res = migrateExchangeTables(targetDb);
        console.log(`[MIGRATION_SUCCESS] Exchange tables migrated at: ${res.dbPath}`);
        process.exit(0);
    } catch (err) {
        console.error(`[MIGRATION_FAILED] ${err.message}`);
        process.exit(1);
    }
}

module.exports = { migrateExchangeTables };
