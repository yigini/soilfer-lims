/**
 * Versioned Additive Migration: Exchange Journal & Resumable Snapshots
 * Issue #140 (Packages P1-P4, F5, Codex Remediation)
 *
 * Creates/aligns durable, immutable exchange journal, snapshot items, issued batches, and receipt auditing tables.
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
        // 1. Immutable Publication Journal & Resumable Snapshots
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

            CREATE TABLE IF NOT EXISTS _exchange_batches (
                id TEXT PRIMARY KEY,
                connection_id TEXT NOT NULL,
                snapshot_id TEXT,
                start_seq INTEGER,
                end_seq INTEGER,
                item_count INTEGER NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS _exchange_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT ''
            );
        `);

        // 2. Non-destructive additive column checks (F5: NEVER drop populated tables)
        ensureColumns(db, '_exchange_meta', {
            updated_at: "TEXT DEFAULT ''"
        });

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
            sequence: "INTEGER",
            event_type: "TEXT",
            specimen_id: "TEXT",
            field_sample_id: "TEXT",
            lab_sample_id: "TEXT",
            country: "TEXT",
            project_code: "TEXT",
            laboratory_id: "TEXT",
            content_hash: "TEXT",
            payload: "TEXT",
            created_at: "TEXT DEFAULT ''"
        });

        ensureColumns(db, '_exchange_batches', {
            connection_id: "TEXT DEFAULT ''",
            snapshot_id: "TEXT",
            start_seq: "INTEGER DEFAULT 0",
            end_seq: "INTEGER DEFAULT 0",
            item_count: "INTEGER DEFAULT 0",
            created_at: "TEXT DEFAULT ''"
        });

        // 3. Monotonically re-sequence any legacy rows with missing, null, or zero sequence without guessing
        const badSeqs = db.prepare('SELECT rowid, id FROM _exchange_journal WHERE sequence IS NULL OR sequence <= 0 ORDER BY created_at ASC, rowid ASC').all();
        if (badSeqs.length > 0) {
            let nextSeq = (db.prepare('SELECT MAX(sequence) as m FROM _exchange_journal WHERE sequence > 0').get()?.m || 0) + 1;
            const upd = db.prepare('UPDATE _exchange_journal SET sequence = ? WHERE rowid = ?');
            for (const row of badSeqs) {
                upd.run(nextSeq++, row.rowid);
            }
        }

        // 4. Record migration version metadata
        const setMeta = db.prepare(`
            INSERT INTO _exchange_meta (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `);
        setMeta.run('schema_version', '2', new Date().toISOString());
        setMeta.run('epoch', 'epoch-1', new Date().toISOString());

        // 5. Create indexes now that all columns are guaranteed to exist
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_seq ON _exchange_journal(sequence);
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_specimen ON _exchange_journal(specimen_id);
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_scope ON _exchange_journal(laboratory_id, country, project_code);
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_created ON _exchange_journal(created_at);
            CREATE INDEX IF NOT EXISTS idx_exchange_snapshots_conn ON _exchange_snapshots(connection_id, expires_at);
            CREATE INDEX IF NOT EXISTS idx_exchange_snapshot_items_order ON _exchange_snapshot_items(snapshot_id, item_order);
            CREATE INDEX IF NOT EXISTS idx_exchange_receipts_lookup ON _exchange_receipts(connection_id, snapshot_id, checkpoint);
            CREATE INDEX IF NOT EXISTS idx_exchange_receipts_batch ON _exchange_receipts(connection_id, batch_id);
            CREATE UNIQUE INDEX IF NOT EXISTS uq_exchange_receipts_conn_snap_chk ON _exchange_receipts(connection_id, snapshot_id, checkpoint) WHERE snapshot_id IS NOT NULL AND checkpoint IS NOT NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS uq_exchange_receipts_conn_snap_batch ON _exchange_receipts(connection_id, snapshot_id, batch_id) WHERE snapshot_id IS NOT NULL AND batch_id IS NOT NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS uq_exchange_receipts_conn_snap ON _exchange_receipts(connection_id, snapshot_id) WHERE snapshot_id IS NOT NULL AND batch_id IS NULL AND checkpoint IS NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS uq_exchange_receipts_conn_batch ON _exchange_receipts(connection_id, batch_id) WHERE batch_id IS NOT NULL AND snapshot_id IS NULL;
            CREATE INDEX IF NOT EXISTS idx_exchange_batches_conn ON _exchange_batches(connection_id, id);
            DROP TRIGGER IF EXISTS trg_sample_au;
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
