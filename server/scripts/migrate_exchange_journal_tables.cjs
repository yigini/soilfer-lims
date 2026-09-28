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
const crypto = require('crypto');
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
                high_water_sequence INTEGER DEFAULT 0,
                high_water_timestamp TEXT NOT NULL,
                total_samples INTEGER NOT NULL,
                expires_at TEXT NOT NULL,
                created_at TEXT NOT NULL,
                authorized_labs TEXT,
                authorized_countries TEXT,
                authorized_projects TEXT,
                auth_version INTEGER DEFAULT 1,
                epoch TEXT DEFAULT 'epoch-1',
                schema_version TEXT DEFAULT '2026-09-issue140-v2',
                digest TEXT
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
                created_at TEXT NOT NULL,
                auth_version INTEGER DEFAULT 1,
                epoch TEXT DEFAULT 'epoch-1'
            );

            CREATE TABLE IF NOT EXISTS _exchange_batches (
                id TEXT PRIMARY KEY,
                connection_id TEXT NOT NULL,
                snapshot_id TEXT,
                start_seq INTEGER,
                end_seq INTEGER,
                item_count INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                auth_version INTEGER DEFAULT 1,
                epoch TEXT DEFAULT 'epoch-1',
                schema_version TEXT DEFAULT '2026-09-issue140-v2',
                digest TEXT
            );

            CREATE TABLE IF NOT EXISTS _exchange_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS _exchange_connections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                client_code TEXT,
                organization TEXT,
                contact_email TEXT,
                status TEXT NOT NULL DEFAULT 'ACTIVE',
                capabilities TEXT NOT NULL DEFAULT '[]',
                countries TEXT,
                projects TEXT,
                labs TEXT,
                auth_version INTEGER NOT NULL DEFAULT 1,
                rate_limit_per_min INTEGER DEFAULT 120,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS _exchange_connection_keys (
                id TEXT PRIMARY KEY,
                connection_id TEXT NOT NULL,
                api_key_id TEXT NOT NULL,
                key_status TEXT NOT NULL DEFAULT 'ACTIVE',
                created_at TEXT NOT NULL,
                rotated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS _exchange_rotation_operations (
                idempotency_key TEXT PRIMARY KEY,
                actor_id TEXT NOT NULL,
                old_key_id TEXT NOT NULL,
                connection_id TEXT NOT NULL,
                request_fingerprint TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'COMMITTED',
                replacement_key_id TEXT,
                response_payload TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_exchange_rot_old_key ON _exchange_rotation_operations(old_key_id);
        `);

        // 2. Non-destructive additive column checks (F5: NEVER drop populated tables)
        ensureColumns(db, '_exchange_meta', {
            updated_at: "TEXT DEFAULT ''"
        });

        ensureColumns(db, 'ApiKey', {
            capabilities: "TEXT",
            connectionId: "TEXT"
        });

        ensureColumns(db, '_exchange_snapshots', {
            high_water_sequence: "INTEGER DEFAULT 0",
            high_water_timestamp: "TEXT DEFAULT ''",
            total_samples: "INTEGER DEFAULT 0",
            expires_at: "TEXT DEFAULT ''",
            created_at: "TEXT DEFAULT ''",
            authorized_labs: "TEXT",
            authorized_countries: "TEXT",
            authorized_projects: "TEXT",
            auth_version: "INTEGER DEFAULT 1",
            epoch: "TEXT DEFAULT 'epoch-1'",
            schema_version: "TEXT DEFAULT '2026-09-issue140-v2'",
            digest: "TEXT"
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
            created_at: "TEXT DEFAULT ''",
            auth_version: "INTEGER DEFAULT 1",
            epoch: "TEXT DEFAULT 'epoch-1'"
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
            created_at: "TEXT DEFAULT ''",
            auth_version: "INTEGER DEFAULT 1",
            epoch: "TEXT DEFAULT 'epoch-1'",
            schema_version: "TEXT DEFAULT '2026-09-issue140-v2'",
            digest: "TEXT"
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

        // Preserve existing epoch if set, default to epoch-1 if absent
        db.prepare(`
            INSERT INTO _exchange_meta (key, value, updated_at)
            VALUES ('epoch', 'epoch-1', ?)
            ON CONFLICT(key) DO NOTHING
        `).run(new Date().toISOString());

        // Ensure source_system_id exists in _exchange_meta
        const existingSourceId = db.prepare("SELECT value FROM _exchange_meta WHERE key = 'source_system_id'").get();
        let currentSourceId = existingSourceId?.value;
        if (!currentSourceId) {
            const crypto = require('crypto');
            const initId = process.env.SOURCE_SYSTEM_ID || `soilfer-lims-node-${crypto.randomBytes(4).toString('hex')}`;
            db.prepare(`
                INSERT INTO _exchange_meta (key, value, updated_at)
                VALUES ('source_system_id', ?, ?)
                ON CONFLICT(key) DO NOTHING
            `).run(initId, new Date().toISOString());
            currentSourceId = initId;
        }
        try {
            const sisAdapter = require('../services/sisAdapterService');
            if (sisAdapter && typeof sisAdapter.setCachedSourceSystemId === 'function') {
                sisAdapter.setCachedSourceSystemId(currentSourceId);
            }
        } catch (e) {}

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
            CREATE INDEX IF NOT EXISTS idx_exchange_conn_keys_conn ON _exchange_connection_keys(connection_id);
            CREATE INDEX IF NOT EXISTS idx_exchange_conn_keys_key ON _exchange_connection_keys(api_key_id);
            DROP TRIGGER IF EXISTS trg_sample_au;
        `);

        // 6. Ensure triggers and UDFs are installed at migration time before writers resume
        try {
            const { ensureTriggers } = require('../services/exchangeStateService');
            ensureTriggers(db);
        } catch (e) {}

        // 7. Authoritative bounded backfill: migrate legacy active ApiKeys missing connection linkages (R3, F5)
        // No GET-side recreation; all authoritative key-to-connection mappings established at migration time
        const hasApiKeyTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ApiKey'").get());
        if (hasApiKeyTable) {
            const activeKeys = db.prepare("SELECT * FROM ApiKey WHERE isActive = 1").all();
            for (const key of activeKeys) {
                const connId = key.connectionId || `conn_${key.id}`;
                if (!key.connectionId) {
                    db.prepare('UPDATE ApiKey SET connectionId = ? WHERE id = ?').run(connId, key.id);
                }
                const connRow = db.prepare('SELECT id FROM _exchange_connections WHERE id = ?').get(connId);
                if (!connRow) {
                    const nowIso = new Date().toISOString();
                    db.prepare(`
                        INSERT INTO _exchange_connections (id, name, capabilities, countries, projects, labs, auth_version, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
                    `).run(
                        connId,
                        key.name || 'Legacy Connection',
                        key.capabilities || '[]',
                        key.countries || null,
                        key.projects || null,
                        key.labs || '[]',
                        nowIso,
                        nowIso
                    );
                }
                const linkRow = db.prepare('SELECT id FROM _exchange_connection_keys WHERE connection_id = ? AND api_key_id = ?').get(connId, key.id);
                if (!linkRow) {
                    db.prepare(`
                        INSERT INTO _exchange_connection_keys (id, connection_id, api_key_id, key_status, created_at)
                        VALUES (?, ?, ?, 'ACTIVE', ?)
                    `).run(`conn_key_${crypto.randomUUID()}`, connId, key.id, new Date().toISOString());
                }
            }
        }

        // 8. Bounded canonical backfill: ensure released specimens are recorded in _exchange_journal (R1, R10)
        // Establishes authoritative journaled publications at migration time before readers start
        const hasSampleTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Sample'").get());
        if (hasSampleTable) {
            const sampleCols = new Set((db.prepare("PRAGMA table_info(Sample)").all() || []).map(c => c.name));
            const holdConds = [];
            if (sampleCols.has('metadata')) {
                holdConds.push(`(s.metadata IS NOT NULL AND (NOT json_valid(s.metadata) OR COALESCE(json_extract(s.metadata, '$.provenanceHold.status'), '') = 'AMBIGUOUS_PROVENANCE_HOLD'))`);
            }
            if (sampleCols.has('fieldMetadata')) {
                holdConds.push(`(s.fieldMetadata IS NOT NULL AND (NOT json_valid(s.fieldMetadata) OR COALESCE(json_extract(s.fieldMetadata, '$.provenanceHold.status'), '') = 'AMBIGUOUS_PROVENANCE_HOLD'))`);
            }
            const holdClause = holdConds.length > 0 ? `AND NOT (${holdConds.join(' OR ')})` : '';

            const unjournaled = db.prepare(`
                SELECT s.* FROM Sample s
                LEFT JOIN _exchange_journal j ON s.id = j.specimen_id
                WHERE ((s.status IN ('APPROVED', 'RELEASED')) OR (s.status IN ('ARCHIVED', 'DISPOSED') AND s.approvedAt IS NOT NULL))
                  ${holdClause}
                  AND j.specimen_id IS NULL
                ORDER BY s.rowid ASC
            `).all();
            if (unjournaled.length > 0) {
                let maxSeq = (db.prepare('SELECT MAX(sequence) as m FROM _exchange_journal').get()?.m || 0);
                const insertJournal = db.prepare(`
                    INSERT INTO _exchange_journal (
                        id, sequence, event_type, specimen_id, field_sample_id, lab_sample_id,
                        country, project_code, laboratory_id, content_hash, payload, created_at
                    ) VALUES (?, ?, 'PUBLICATION', ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                
                const sisAdapter = require('../services/sisAdapterService');
                if (!sisAdapter || typeof sisAdapter.formatSampleV2 !== 'function') {
                    throw new Error('Migration failure: sisAdapterService.formatSampleV2 is unavailable.');
                }

                const hasResultTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Result'").get());
                const selectResults = hasResultTable
                    ? db.prepare("SELECT * FROM Result WHERE sampleId = ? AND (isValid IS NULL OR isValid = 1) AND (isCurrent IS NULL OR isCurrent = 1) ORDER BY rowid ASC")
                    : null;

                const metaSourceId = db.prepare("SELECT value FROM _exchange_meta WHERE key = 'source_system_id'").get()?.value;
                const nowIso = new Date().toISOString();

                for (const sample of unjournaled) {
                    maxSeq++;
                    if (selectResults) {
                        sample.results = selectResults.all(sample.id);
                    } else {
                        sample.results = [];
                    }

                    const formatted = sisAdapter.formatSampleV2(sample, {}, {
                        internal: true,
                        db,
                        sourceSystemId: metaSourceId
                    });
                    if (!formatted || !formatted.specimenId) {
                        throw new Error(`Migration failure: formatSampleV2 returned invalid payload for specimen ${sample.id}`);
                    }

                    const payload = JSON.stringify(formatted);
                    const hash = crypto.createHash('sha256').update(payload).digest('hex');
                    const eventId = `evt_${crypto.randomUUID()}`;

                    insertJournal.run(
                        eventId,
                        maxSeq,
                        sample.id,
                        sample.originalId || null,
                        sample.labId || null,
                        sample.country || null,
                        sample.projectCode || null,
                        sample.assignedLab || null,
                        hash,
                        payload,
                        sample.approvedAt ? new Date(sample.approvedAt).toISOString() : nowIso
                    );
                }
            }
        }
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
