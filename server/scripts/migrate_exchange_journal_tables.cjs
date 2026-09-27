/**
 * Versioned Additive Migration: Exchange Journal & Resumable Snapshots
 * Issue #140 (Packages P1-P4, F5)
 *
 * Creates/aligns durable, immutable exchange journal, snapshot items, and receipt auditing tables.
 * Safe, idempotent, non-destructive additive DDL. Zero mutations to core laboratory tables.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

function ensureColumns(db, tableName, colDefs) {
    try {
        const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
        if (!info || info.length === 0) return;
        const existing = new Set(info.map(c => c.name));
        for (const [colName, colType] of Object.entries(colDefs)) {
            if (!existing.has(colName)) {
                db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colType}`);
            }
        }
    } catch (e) {
        // Table may not exist yet
    }
}

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

            CREATE TABLE IF NOT EXISTS _exchange_snapshots (
                id TEXT PRIMARY KEY,
                connection_id TEXT NOT NULL,
                high_water_timestamp TEXT NOT NULL,
                total_samples INTEGER NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                authorized_labs TEXT,
                authorized_countries TEXT,
                authorized_projects TEXT
            );

            CREATE TABLE IF NOT EXISTS _exchange_snapshot_items (
                snapshot_id TEXT NOT NULL,
                specimen_id TEXT NOT NULL,
                item_order INTEGER NOT NULL,
                body_json TEXT NOT NULL,
                PRIMARY KEY (snapshot_id, specimen_id)
            );

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
        `);

        // 2. Non-destructive additive column checks (F5: NEVER drop populated tables)
        ensureColumns(db, '_exchange_snapshots', {
            high_water_timestamp: "TEXT DEFAULT ''",
            total_samples: "INTEGER DEFAULT 0",
            expires_at: "TEXT DEFAULT ''",
            created_at: "TEXT DEFAULT ''",
            authorized_labs: "TEXT",
            authorized_countries: "TEXT",
            authorized_projects: "TEXT"
        });

        ensureColumns(db, '_exchange_snapshot_items', {
            item_order: "INTEGER DEFAULT 1",
            body_json: "TEXT DEFAULT '{}'"
        });

        ensureColumns(db, '_exchange_receipts', {
            snapshot_id: "TEXT",
            batch_id: "TEXT",
            imported_count: "INTEGER DEFAULT 0",
            quarantined_count: "INTEGER DEFAULT 0",
            checkpoint: "TEXT",
            details: "TEXT",
            created_at: "TEXT DEFAULT ''"
        });

        ensureColumns(db, '_exchange_journal', {
            sequence: "INTEGER DEFAULT 0",
            event_type: "TEXT DEFAULT 'PUBLICATION'",
            specimen_id: "TEXT DEFAULT ''",
            field_sample_id: "TEXT",
            lab_sample_id: "TEXT",
            country: "TEXT",
            project_code: "TEXT",
            laboratory_id: "TEXT",
            content_hash: "TEXT",
            payload: "TEXT",
            created_at: "TEXT DEFAULT ''"
        });

        // 3. Create indexes now that all columns are guaranteed to exist
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_seq ON _exchange_journal(sequence);
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_specimen ON _exchange_journal(specimen_id);
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_scope ON _exchange_journal(laboratory_id, country, project_code);
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_created ON _exchange_journal(created_at);
            CREATE INDEX IF NOT EXISTS idx_exchange_snapshots_conn ON _exchange_snapshots(connection_id, expires_at);
            CREATE INDEX IF NOT EXISTS idx_exchange_snapshot_items_order ON _exchange_snapshot_items(snapshot_id, item_order);
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
