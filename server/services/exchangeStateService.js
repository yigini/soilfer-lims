/**
 * Soil Information System (SIS) / Data Exchange State & Synchronization Service
 * 
 * Implements Issue #140 Work Package P4 (Codex Remediation R1, R2, R3, F1-F7):
 * - Durable, frozen exchange snapshots stored in _exchange_snapshot_items.
 * - Append-only monotonic change journal in _exchange_journal.
 * - Continuous change feed with publications, amendments, and withdrawals.
 * - Strict credential/connection identity isolation & scope verification.
 * - Validated, idempotent receiver delivery receipts.
 * - Resumable cursor-based pagination with bounds, binding, and validation.
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const prisma = require('../prisma');
const { buildSampleWhere, AUTHORIZED_RELEASE_STATUSES } = require('./exchangePolicyService');
const { formatSampleV2, setCachedSourceSystemId } = require('./sisAdapterService');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve(__dirname, '..', 'prisma', 'dev.db');

let dbInstance = null;

function getDb() {
    if (!dbInstance) {
        dbInstance = new Database(dbPath, { timeout: 5000 });
        initTables(dbInstance);
    }
    return dbInstance;
}

function getCursorSecret(db) {
    if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    if (process.env.API_KEY_SECRET) return process.env.API_KEY_SECRET;
    const metaDb = db || (dbInstance || getDb());
    if (!metaDb || typeof metaDb.prepare !== 'function') {
        throw new Error('Signing state storage unavailable: database connection required and no environment secret configured.');
    }
    try {
        const row = metaDb.prepare("SELECT value FROM _exchange_meta WHERE key = 'cursor_signing_secret'").get();
        if (row && row.value) return row.value;
        const generated = crypto.randomBytes(32).toString('hex');
        metaDb.prepare("INSERT OR REPLACE INTO _exchange_meta (key, value, updated_at) VALUES ('cursor_signing_secret', ?, ?)").run(generated, new Date().toISOString());
        return generated;
    } catch (e) {
        throw new Error(`Signing state storage unavailable and no environment secret configured: ${e.message}`);
    }
}

function getCurrentEpoch(db) {
    const metaDb = db || (dbInstance || getDb());
    if (!metaDb || typeof metaDb.prepare !== 'function') {
        throw new Error('Epoch state storage unavailable: database connection missing or invalid.');
    }
    try {
        const row = metaDb.prepare("SELECT value FROM _exchange_meta WHERE key = 'epoch'").get();
        if (row && row.value) return row.value;
        try {
            metaDb.prepare("INSERT OR IGNORE INTO _exchange_meta (key, value, updated_at) VALUES ('epoch', 'epoch-1', ?)").run(new Date().toISOString());
        } catch (ignoreErr) {}
        return 'epoch-1';
    } catch (e) {
        throw new Error(`Epoch state storage unavailable: ${e.message}`);
    }
}

function rotateEpoch(db, reason = 'RESTORE_EVENT') {
    const metaDb = db || (dbInstance || getDb());
    if (!metaDb || typeof metaDb.prepare !== 'function') {
        throw new Error('Epoch rotation failed: database connection missing or invalid.');
    }
    const current = getCurrentEpoch(metaDb);
    // Unrepeatable restore generation using timestamp + cryptographic nonce
    const nonce = crypto.randomBytes(6).toString('hex');
    const newEpoch = `epoch-${Date.now()}-${nonce}`;
    const now = new Date().toISOString();

    const rotateTx = metaDb.transaction(() => {
        metaDb.prepare(`
            INSERT INTO _exchange_meta (key, value, updated_at)
            VALUES ('epoch', ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `).run(newEpoch, now);

        metaDb.prepare(`
            INSERT INTO _exchange_meta (key, value, updated_at)
            VALUES ('last_epoch_rotation_reason', ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        `).run(reason, now);
    });

    rotateTx();
    return {
        previousEpoch: current,
        currentEpoch: newEpoch,
        rotatedAt: now,
        reason
    };
}

let cachedSourceSystemId = null;

function getSourceSystemId(db) {
    if (process.env.SOURCE_SYSTEM_ID) {
        return process.env.SOURCE_SYSTEM_ID;
    }
    if (cachedSourceSystemId) {
        return cachedSourceSystemId;
    }
    const metaDb = db || (dbInstance || getDb());
    if (!metaDb || typeof metaDb.prepare !== 'function') {
        throw new Error('Source system identity storage unavailable: database connection missing or invalid.');
    }
    try {
        const row = metaDb.prepare("SELECT value FROM _exchange_meta WHERE key = 'source_system_id'").get();
        if (row && row.value) {
            cachedSourceSystemId = row.value;
            if (typeof setCachedSourceSystemId === 'function') setCachedSourceSystemId(row.value);
            return row.value;
        }
        const newId = `soilfer-lims-node-${crypto.randomBytes(4).toString('hex')}`;
        metaDb.prepare("INSERT INTO _exchange_meta (key, value, updated_at) VALUES ('source_system_id', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(newId, new Date().toISOString());
        cachedSourceSystemId = newId;
        if (typeof setCachedSourceSystemId === 'function') setCachedSourceSystemId(newId);
        return newId;
    } catch (e) {
        throw new Error(`Source system identity storage unavailable: ${e.message}`);
    }
}

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
        // Table may not exist yet or in-memory dialect variance
    }
}

const {
    normalizeSampleDataForHash,
    computeSampleContentHash,
    registerDbFunctions,
    installSqliteHooks
} = require('./exchangeDbFunctions');

const CURRENT_TRIGGER_VERSION = '11';

function ensureTriggers(db, force = false) {
    registerDbFunctions(db);

    const hasMeta = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_meta'").get();
    if (!force && hasMeta) {
        try {
            const verRow = db.prepare("SELECT value FROM _exchange_meta WHERE key = 'exchange_triggers_version'").get();
            if (verRow && verRow.value === CURRENT_TRIGGER_VERSION) {
                return;
            }
        } catch (e) {}
    }

    const hasSample = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Sample'").get();
    if (!hasSample) return;

    const sampleCols = new Set((db.prepare("PRAGMA table_info(Sample)").all() || []).map(c => c.name));
    const hasResult = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Result'").get();
    const resultCols = hasResult ? new Set((db.prepare("PRAGMA table_info(Result)").all() || []).map(c => c.name)) : new Set();

    const buildSampleJsonObj = (prefix) => {
        const candidateFields = [
            'id', 'status', 'originalId', 'labId', 'assignedLab', 'country', 'countryName', 'projectCode',
            'matrix', 'fieldMetadata', 'metadata', 'receptionData', 'receptionDate',
            'latitude', 'longitude', 'elevation', 'depthTopCm', 'depthBottomCm', 'depthTop', 'depthBottom',
            'horizon', 'positionalUncertaintyM', 'locationSource',
            'siteName', 'village', 'admin1', 'admin2',
            'receivedMass', 'moistureOnArrival', 'dryingStatus', 'preparationStatus',
            'rejectionReason', 'approvedAt', 'approvedBy', 'acceptedAt', 'acceptedBy',
            'createdAt', 'updatedAt'
        ];
        const fields = [];
        for (const col of candidateFields) {
            if (sampleCols.has(col)) {
                fields.push(`'${col}', ${prefix}."${col}"`);
            }
        }
        return `json_object(${fields.join(', ')})`;
    };

    const newSampleJson = buildSampleJsonObj('NEW');
    const oldSampleJson = buildSampleJsonObj('OLD');
    const sSampleJson = buildSampleJsonObj('s');

    const resColParam = resultCols.has('param') ? 'r.param' : "''";
    const resColValid = resultCols.has('isValid') ? 'r.isValid' : '1';
    const resColCurr = resultCols.has('isCurrent') ? 'r.isCurrent' : '1';
    const resColUnit = resultCols.has('unit') ? 'r.unit' : 'NULL';
    const resColMeth = resultCols.has('methodologyId') ? 'r.methodologyId' : 'NULL';
    const resColProv = resultCols.has('provenance') ? 'r.provenance' : "'MEASURED'";
    const resColCens = resultCols.has('censoring') ? 'r.censoring' : "'NONE'";
    const resColBasis = resultCols.has('basis') ? 'r.basis' : "'AIR_DRY'";
    const resColRep = resultCols.has('replicateNo') ? 'r.replicateNo' : '1';
    const resColFlags = resultCols.has('flags') ? 'r.flags' : 'NULL';
    const resColUnc = resultCols.has('uncertainty') ? 'r.uncertainty' : 'NULL';
    const resColDetDate = resultCols.has('determinationDate') ? 'r.determinationDate' : (resultCols.has('analysedAt') ? 'r.analysedAt' : 'NULL');

    const resValidFilter = resultCols.has('isValid') ? '(r.isValid IS NULL OR r.isValid = 1)' : '1=1';
    const resCurrFilter = resultCols.has('isCurrent') ? '(r.isCurrent IS NULL OR r.isCurrent = 1)' : '1=1';

    const resultSubquery = hasResult
        ? `(SELECT COALESCE(json_group_array(json_object(
            'id', r.id,
            'param', ${resColParam},
            'value', r.value,
            'numericValue', r.numericValue,
            'isValid', ${resColValid},
            'isCurrent', ${resColCurr},
            'unit', ${resColUnit},
            'methodologyId', ${resColMeth},
            'provenance', ${resColProv},
            'censoring', ${resColCens},
            'basis', ${resColBasis},
            'replicateNo', ${resColRep},
            'flags', ${resColFlags},
            'uncertainty', ${resColUnc},
            'determinationDate', ${resColDetDate}
        )), '[]') FROM Result r WHERE r.sampleId = NEW.id AND ${resValidFilter} AND ${resCurrFilter})`
        : `'[]'`;

    const resSubForSample = hasResult
        ? `(SELECT COALESCE(json_group_array(json_object(
            'id', r.id,
            'param', ${resColParam},
            'value', r.value,
            'numericValue', r.numericValue,
            'isValid', ${resColValid},
            'isCurrent', ${resColCurr},
            'unit', ${resColUnit},
            'methodologyId', ${resColMeth},
            'provenance', ${resColProv},
            'censoring', ${resColCens},
            'basis', ${resColBasis},
            'replicateNo', ${resColRep},
            'flags', ${resColFlags},
            'uncertainty', ${resColUnc},
            'determinationDate', ${resColDetDate}
        )), '[]') FROM Result r WHERE r.sampleId = s.id AND ${resValidFilter} AND ${resCurrFilter})`
        : `'[]'`;

    const candidateAmendCols = [
        'originalId', 'labId', 'assignedLab', 'country', 'countryName', 'projectCode',
        'matrix', 'fieldMetadata', 'metadata', 'receptionData', 'receptionDate',
        'latitude', 'longitude', 'elevation', 'depthTopCm', 'depthBottomCm', 'depthTop', 'depthBottom',
        'horizon', 'positionalUncertaintyM', 'locationSource',
        'siteName', 'village', 'admin1', 'admin2',
        'receivedMass', 'moistureOnArrival', 'dryingStatus', 'preparationStatus',
        'rejectionReason', 'approvedAt'
    ];
    const sampleAmendConds = [];
    for (const col of candidateAmendCols) {
        if (sampleCols.has(col)) {
            sampleAmendConds.push(`OLD."${col}" IS NOT NEW."${col}"`);
        }
    }

    const resultAmendConds = [
        'OLD.value IS NOT NEW.value',
        'OLD.numericValue IS NOT NEW.numericValue'
    ];
    if (resultCols.has('isValid')) resultAmendConds.push('OLD.isValid IS NOT NEW.isValid');
    if (resultCols.has('isCurrent')) resultAmendConds.push('OLD.isCurrent IS NOT NEW.isCurrent');
    if (resultCols.has('unit')) resultAmendConds.push('OLD.unit IS NOT NEW.unit');
    if (resultCols.has('methodologyId')) resultAmendConds.push('OLD.methodologyId IS NOT NEW.methodologyId');
    if (resultCols.has('provenance')) resultAmendConds.push('OLD.provenance IS NOT NEW.provenance');
    if (resultCols.has('censoring')) resultAmendConds.push('OLD.censoring IS NOT NEW.censoring');
    if (resultCols.has('basis')) resultAmendConds.push('OLD.basis IS NOT NEW.basis');
    if (resultCols.has('replicateNo')) resultAmendConds.push('OLD.replicateNo IS NOT NEW.replicateNo');
    if (resultCols.has('flags')) resultAmendConds.push('OLD.flags IS NOT NEW.flags');
    if (resultCols.has('uncertainty')) resultAmendConds.push('OLD.uncertainty IS NOT NEW.uncertainty');
    if (resultCols.has('determinationDate')) resultAmendConds.push('OLD.determinationDate IS NOT NEW.determinationDate');
    if (resultCols.has('analysedAt')) resultAmendConds.push('OLD.analysedAt IS NOT NEW.analysedAt');

    const isEligibleSql = (prefix) => {
        const statusCond = `(${prefix}.status IN ('APPROVED', 'RELEASED') OR (${prefix}.status IN ('ARCHIVED', 'DISPOSED') AND ${prefix}.approvedAt IS NOT NULL))`;
        const holdConds = [];
        if (sampleCols.has('metadata')) {
            holdConds.push(`(CASE
                WHEN ${prefix}.metadata IS NULL OR ${prefix}.metadata = '' THEN 0
                WHEN NOT json_valid(${prefix}.metadata) THEN 1
                WHEN json_type(${prefix}.metadata) != 'object' THEN 1
                WHEN COALESCE(json_extract(${prefix}.metadata, '$.provenanceHold.status'), '') = 'AMBIGUOUS_PROVENANCE_HOLD' THEN 1
                ELSE 0
            END = 1)`);
        }
        if (sampleCols.has('fieldMetadata')) {
            holdConds.push(`(CASE
                WHEN ${prefix}.fieldMetadata IS NULL OR ${prefix}.fieldMetadata = '' THEN 0
                WHEN NOT json_valid(${prefix}.fieldMetadata) THEN 1
                WHEN json_type(${prefix}.fieldMetadata) != 'object' THEN 1
                WHEN COALESCE(json_extract(${prefix}.fieldMetadata, '$.provenanceHold.status'), '') = 'AMBIGUOUS_PROVENANCE_HOLD' THEN 1
                ELSE 0
            END = 1)`);
        }
        if (holdConds.length > 0) {
            return `(${statusCond} AND NOT (${holdConds.join(' OR ')}))`;
        }
        return `(${statusCond})`;
    };

    const installTx = db.transaction(() => {
        db.exec(`
            DROP TRIGGER IF EXISTS trg_sample_ai_publish;
            DROP TRIGGER IF EXISTS trg_sample_au_publish;
            DROP TRIGGER IF EXISTS trg_sample_au_withdraw;
            DROP TRIGGER IF EXISTS trg_sample_au_amend;
            DROP TRIGGER IF EXISTS trg_sample_ad_withdraw;
            DROP TRIGGER IF EXISTS trg_sample_norm_updated_at;
            DROP TRIGGER IF EXISTS trg_sample_norm_updated_at_update;

            CREATE TRIGGER trg_sample_norm_updated_at AFTER INSERT ON Sample
            FOR EACH ROW
            WHEN NEW.updatedAt LIKE '%Z'
            BEGIN
                UPDATE Sample SET updatedAt = strftime('%Y-%m-%dT%H:%M:%f+00:00', NEW.updatedAt) WHERE id = NEW.id;
            END;

            CREATE TRIGGER trg_sample_norm_updated_at_update AFTER UPDATE OF updatedAt ON Sample
            FOR EACH ROW
            WHEN NEW.updatedAt LIKE '%Z'
            BEGIN
                UPDATE Sample SET updatedAt = strftime('%Y-%m-%dT%H:%M:%f+00:00', NEW.updatedAt) WHERE id = NEW.id;
            END;

            CREATE TRIGGER trg_sample_ai_publish AFTER INSERT ON Sample
            FOR EACH ROW
            WHEN ${isEligibleSql('NEW')}
            BEGIN
                INSERT INTO _exchange_journal (
                    id, sequence, event_type, specimen_id, field_sample_id, lab_sample_id,
                    country, project_code, laboratory_id, content_hash, payload, created_at
                )
                SELECT
                    'evt_' || NEW.id || '_' || (SELECT COALESCE(MAX(sequence), 0) + 1 FROM _exchange_journal),
                    (SELECT COALESCE(MAX(sequence), 0) + 1 FROM _exchange_journal),
                    'PUBLICATION',
                    NEW.id,
                    NEW.originalId,
                    NEW.labId,
                    NEW.country,
                    NEW.projectCode,
                    NEW.assignedLab,
                    exchange_compute_hash(${newSampleJson}, ${resultSubquery}),
                    exchange_format_payload(${newSampleJson}, ${resultSubquery}),
                    datetime('now');
            END;

            CREATE TRIGGER trg_sample_au_publish AFTER UPDATE ON Sample
            FOR EACH ROW
            WHEN NOT ${isEligibleSql('OLD')}
             AND ${isEligibleSql('NEW')}
            BEGIN
                INSERT INTO _exchange_journal (
                    id, sequence, event_type, specimen_id, field_sample_id, lab_sample_id,
                    country, project_code, laboratory_id, content_hash, payload, created_at
                )
                SELECT
                    'evt_' || NEW.id || '_' || (SELECT COALESCE(MAX(sequence), 0) + 1 FROM _exchange_journal),
                    (SELECT COALESCE(MAX(sequence), 0) + 1 FROM _exchange_journal),
                    'PUBLICATION',
                    NEW.id,
                    NEW.originalId,
                    NEW.labId,
                    NEW.country,
                    NEW.projectCode,
                    NEW.assignedLab,
                    exchange_compute_hash(${newSampleJson}, ${resultSubquery}),
                    exchange_format_payload(${newSampleJson}, ${resultSubquery}),
                    datetime('now');
            END;

            CREATE TRIGGER trg_sample_au_withdraw AFTER UPDATE ON Sample
            FOR EACH ROW
            WHEN ${isEligibleSql('OLD')}
             AND NOT ${isEligibleSql('NEW')}
            BEGIN
                INSERT INTO _exchange_journal (
                    id, sequence, event_type, specimen_id, field_sample_id, lab_sample_id,
                    country, project_code, laboratory_id, content_hash, payload, created_at
                )
                SELECT
                    'evt_' || NEW.id || '_' || (SELECT COALESCE(MAX(sequence), 0) + 1 FROM _exchange_journal),
                    (SELECT COALESCE(MAX(sequence), 0) + 1 FROM _exchange_journal),
                    'WITHDRAWAL',
                    NEW.id,
                    NEW.originalId,
                    NEW.labId,
                    NEW.country,
                    NEW.projectCode,
                    NEW.assignedLab,
                    exchange_compute_hash(${newSampleJson}, ${resultSubquery}),
                    NULL,
                    datetime('now');
            END;

            CREATE TRIGGER trg_sample_au_amend AFTER UPDATE ON Sample
            FOR EACH ROW
            WHEN ${isEligibleSql('OLD')}
             AND ${isEligibleSql('NEW')}
             AND (${sampleAmendConds.join(' OR ')})
            BEGIN
                INSERT INTO _exchange_journal (
                    id, sequence, event_type, specimen_id, field_sample_id, lab_sample_id,
                    country, project_code, laboratory_id, content_hash, payload, created_at
                )
                SELECT
                    'evt_' || NEW.id || '_' || (SELECT COALESCE(MAX(sequence), 0) + 1 FROM _exchange_journal),
                    (SELECT COALESCE(MAX(sequence), 0) + 1 FROM _exchange_journal),
                    'AMENDMENT',
                    NEW.id,
                    NEW.originalId,
                    NEW.labId,
                    NEW.country,
                    NEW.projectCode,
                    NEW.assignedLab,
                    exchange_compute_hash(${newSampleJson}, ${resultSubquery}),
                    exchange_format_payload(${newSampleJson}, ${resultSubquery}),
                    datetime('now');
            END;

            CREATE TRIGGER trg_sample_ad_withdraw AFTER DELETE ON Sample
            FOR EACH ROW
            WHEN ${isEligibleSql('OLD')}
            BEGIN
                INSERT INTO _exchange_journal (
                    id, sequence, event_type, specimen_id, field_sample_id, lab_sample_id,
                    country, project_code, laboratory_id, content_hash, payload, created_at
                )
                SELECT
                    'evt_' || OLD.id || '_' || (SELECT COALESCE(MAX(sequence), 0) + 1 FROM _exchange_journal),
                    (SELECT COALESCE(MAX(sequence), 0) + 1 FROM _exchange_journal),
                    'WITHDRAWAL',
                    OLD.id,
                    OLD.originalId,
                    OLD.labId,
                    OLD.country,
                    OLD.projectCode,
                    OLD.assignedLab,
                    exchange_compute_hash(${oldSampleJson}, '[]'),
                    NULL,
                    datetime('now');
            END;
        `);

        if (hasResult) {
            db.exec(`
                DROP TRIGGER IF EXISTS trg_result_ai_amend;
                DROP TRIGGER IF EXISTS trg_result_au_amend;
                DROP TRIGGER IF EXISTS trg_result_ad_amend;

                CREATE TRIGGER trg_result_ai_amend AFTER INSERT ON Result
                FOR EACH ROW
                WHEN (SELECT ${isEligibleSql('s')} FROM Sample s WHERE s.id = NEW.sampleId) = 1
                BEGIN
                    INSERT INTO _exchange_journal (
                        id, sequence, event_type, specimen_id, field_sample_id, lab_sample_id,
                        country, project_code, laboratory_id, content_hash, payload, created_at
                    )
                    SELECT
                        'evt_' || NEW.sampleId || '_' || (SELECT COALESCE(MAX(sequence), 0) + 1 FROM _exchange_journal),
                        (SELECT COALESCE(MAX(sequence), 0) + 1 FROM _exchange_journal),
                        'AMENDMENT',
                        s.id,
                        s.originalId,
                        s.labId,
                        s.country,
                        s.projectCode,
                        s.assignedLab,
                        exchange_compute_hash(${sSampleJson}, ${resSubForSample}),
                        exchange_format_payload(${sSampleJson}, ${resSubForSample}),
                        datetime('now')
                    FROM Sample s
                    WHERE s.id = NEW.sampleId;
                END;

                CREATE TRIGGER trg_result_au_amend AFTER UPDATE ON Result
                FOR EACH ROW
                WHEN (${resultAmendConds.join(' OR ')})
                AND (SELECT ${isEligibleSql('s')} FROM Sample s WHERE s.id = NEW.sampleId) = 1
                BEGIN
                    INSERT INTO _exchange_journal (
                        id, sequence, event_type, specimen_id, field_sample_id, lab_sample_id,
                        country, project_code, laboratory_id, content_hash, payload, created_at
                    )
                    SELECT
                        'evt_' || NEW.sampleId || '_' || (SELECT COALESCE(MAX(sequence), 0) + 1 FROM _exchange_journal),
                        (SELECT COALESCE(MAX(sequence), 0) + 1 FROM _exchange_journal),
                        'AMENDMENT',
                        s.id,
                        s.originalId,
                        s.labId,
                        s.country,
                        s.projectCode,
                        s.assignedLab,
                        exchange_compute_hash(${sSampleJson}, ${resSubForSample}),
                        exchange_format_payload(${sSampleJson}, ${resSubForSample}),
                        datetime('now')
                    FROM Sample s
                    WHERE s.id = NEW.sampleId;
                END;

                CREATE TRIGGER trg_result_ad_amend AFTER DELETE ON Result
                FOR EACH ROW
                WHEN (SELECT ${isEligibleSql('s')} FROM Sample s WHERE s.id = OLD.sampleId) = 1
                BEGIN
                    INSERT INTO _exchange_journal (
                        id, sequence, event_type, specimen_id, field_sample_id, lab_sample_id,
                        country, project_code, laboratory_id, content_hash, payload, created_at
                    )
                    SELECT
                        'evt_' || OLD.sampleId || '_' || (SELECT COALESCE(MAX(sequence), 0) + 1 FROM _exchange_journal),
                        (SELECT COALESCE(MAX(sequence), 0) + 1 FROM _exchange_journal),
                        'AMENDMENT',
                        s.id,
                        s.originalId,
                        s.labId,
                        s.country,
                        s.projectCode,
                        s.assignedLab,
                        exchange_compute_hash(${sSampleJson}, ${resSubForSample}),
                        exchange_format_payload(${sSampleJson}, ${resSubForSample}),
                        datetime('now')
                    FROM Sample s
                    WHERE s.id = OLD.sampleId;
                END;
            `);
        }

        if (hasMeta) {
            db.prepare("INSERT OR REPLACE INTO _exchange_meta (key, value, updated_at) VALUES ('exchange_triggers_version', ?, datetime('now'))").run(CURRENT_TRIGGER_VERSION);
        }
    });

    installTx();
}

function initTables(db) {
    // 1. Create tables if not exists
    db.exec(`
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
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS _exchange_connection_keys (
            id TEXT PRIMARY KEY,
            connection_id TEXT NOT NULL,
            api_key_id TEXT NOT NULL,
            key_status TEXT NOT NULL DEFAULT 'ACTIVE',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            rotated_at DATETIME
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
        epoch: "TEXT DEFAULT ''",
        schema_version: "TEXT DEFAULT '2026-09-issue140-v2'",
        digest: "TEXT DEFAULT ''"
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
        epoch: "TEXT DEFAULT ''"
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

    ensureColumns(db, '_exchange_batches', {
        connection_id: "TEXT DEFAULT ''",
        snapshot_id: "TEXT",
        start_seq: "INTEGER DEFAULT 0",
        end_seq: "INTEGER DEFAULT 0",
        item_count: "INTEGER DEFAULT 0",
        created_at: "TEXT DEFAULT ''",
        auth_version: "INTEGER DEFAULT 1",
        epoch: "TEXT DEFAULT ''",
        schema_version: "TEXT DEFAULT '2026-09-issue140-v2'",
        digest: "TEXT DEFAULT ''"
    });

    ensureColumns(db, '_exchange_connections', {
        id: "TEXT",
        connection_id: "TEXT",
        client_code: "TEXT",
        organization: "TEXT",
        contact_email: "TEXT",
        status: "TEXT DEFAULT 'ACTIVE'",
        countries: "TEXT",
        projects: "TEXT",
        labs: "TEXT",
        rate_limit_per_min: "INTEGER DEFAULT 120"
    });

    ensureColumns(db, '_exchange_connection_keys', {
        id: "TEXT",
        connection_id: "TEXT",
        api_key_id: "TEXT",
        key_status: "TEXT DEFAULT 'ACTIVE'"
    });

    // 3. Create indexes now that all columns are guaranteed to exist
    try {
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_exchange_snapshots_conn ON _exchange_snapshots(connection_id, expires_at);
            CREATE INDEX IF NOT EXISTS idx_exchange_snapshot_items_order ON _exchange_snapshot_items(snapshot_id, item_order);
            CREATE INDEX IF NOT EXISTS idx_exchange_receipts_lookup ON _exchange_receipts(connection_id, snapshot_id, checkpoint);
            CREATE INDEX IF NOT EXISTS idx_exchange_receipts_batch ON _exchange_receipts(connection_id, batch_id);
            CREATE UNIQUE INDEX IF NOT EXISTS uq_exchange_receipts_conn_snap_chk ON _exchange_receipts(connection_id, snapshot_id, checkpoint) WHERE snapshot_id IS NOT NULL AND checkpoint IS NOT NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS uq_exchange_receipts_conn_snap_batch ON _exchange_receipts(connection_id, snapshot_id, batch_id) WHERE snapshot_id IS NOT NULL AND batch_id IS NOT NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS uq_exchange_receipts_conn_snap ON _exchange_receipts(connection_id, snapshot_id) WHERE snapshot_id IS NOT NULL AND batch_id IS NULL AND checkpoint IS NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS uq_exchange_receipts_conn_batch ON _exchange_receipts(connection_id, batch_id) WHERE batch_id IS NOT NULL AND snapshot_id IS NULL;
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_seq ON _exchange_journal(sequence);
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_specimen ON _exchange_journal(specimen_id);
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_scope ON _exchange_journal(laboratory_id, country, project_code);
            CREATE INDEX IF NOT EXISTS idx_exchange_batches_conn ON _exchange_batches(connection_id);
            CREATE INDEX IF NOT EXISTS idx_exchange_conn_keys_conn ON _exchange_connection_keys(connection_id);
            CREATE INDEX IF NOT EXISTS idx_exchange_conn_keys_key ON _exchange_connection_keys(api_key_id);
        `);
    } catch (e) {}

    try {
        db.prepare("INSERT OR IGNORE INTO _exchange_meta (key, value, updated_at) VALUES ('epoch', 'epoch-1', ?)").run(new Date().toISOString());
        const sysId = process.env.SOURCE_SYSTEM_ID || `soilfer-lims-node-${crypto.randomBytes(4).toString('hex')}`;
        db.prepare("INSERT OR IGNORE INTO _exchange_meta (key, value, updated_at) VALUES ('source_system_id', ?, ?)").run(sysId, new Date().toISOString());
        const row = db.prepare("SELECT value FROM _exchange_meta WHERE key = 'source_system_id'").get();
        if (row && row.value) {
            cachedSourceSystemId = row.value;
            if (typeof setCachedSourceSystemId === 'function') setCachedSourceSystemId(row.value);
        }
    } catch (e) {}

    ensureTriggers(db);
}

/**
 * Derives stable, immutable connection identity independent of display names (R3).
 */
function getConnectionId(auth) {
    if (!auth) return 'anonymous';
    if (auth.connectionId) return String(auth.connectionId);
    if (auth.keyId) return `conn_${auth.keyId}`;
    if (auth.id) return `conn_${auth.id}`;
    if (auth.keyPrefix) return `conn_${auth.keyPrefix}`;
    return 'default-connection';
}


function isProvenanceHeld(meta) {
    if (meta === null || meta === undefined || meta === '') return false;
    try {
        const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return true;
        }
        if (parsed.provenanceHold && parsed.provenanceHold.status === 'AMBIGUOUS_PROVENANCE_HOLD') {
            return true;
        }
        return false;
    } catch (e) {
        return true;
    }
}

function isSpecimenEligible(sample) {
    if (!sample) return false;
    const status = sample.status;
    const isCurrentRelease = status === 'APPROVED' || status === 'RELEASED';
    const isApprovedHistory = (status === 'ARCHIVED' || status === 'DISPOSED') && Boolean(sample.approvedAt);
    if (!isCurrentRelease && !isApprovedHistory) {
        return false;
    }
    if (isProvenanceHeld(sample.metadata) || isProvenanceHeld(sample.fieldMetadata)) {
        return false;
    }
    return true;
}

/**
 * Safely format stored SQLite UTC timestamp without local runtime timezone shift (R7, R8, R12).
 * SQLite stores UTC timestamps without offset ('YYYY-MM-DD HH:MM:SS').
 * Calling new Date(str).toISOString() in non-UTC runtimes (e.g. Europe/Rome) interprets
 * zone-free strings as local time, shifting UTC instants.
 */
function formatStoredUtc(val) {
    if (!val || (typeof val !== 'string' && !(val instanceof Date))) {
        throw new Error(`Invalid stored timestamp: ${val}`);
    }
    if (val instanceof Date) {
        if (isNaN(val.getTime())) throw new Error('Invalid Date timestamp');
        return val.toISOString();
    }
    const str = val.trim();
    if (!str) {
        throw new Error('Empty stored timestamp');
    }
    // Check if string has explicit timezone indicator: Z or offset [+-]HH:MM
    if (/([zZ]|[+-]\d{2}(?::?\d{2})?)$/.test(str)) {
        const d = new Date(str);
        if (isNaN(d.getTime())) throw new Error(`Invalid zoned timestamp: ${val}`);
        return d.toISOString();
    }
    // Zone-free string (e.g. SQLite CURRENT_TIMESTAMP "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS")
    const isoUtc = str.replace(' ', 'T') + 'Z';
    const d = new Date(isoUtc);
    if (isNaN(d.getTime())) {
        throw new Error(`Invalid zone-free timestamp: ${val}`);
    }
    return d.toISOString();
}

/**
 * Synchronizes the append-only monotonic journal (_exchange_journal) with sample state.
 * Emits PUBLICATION, AMENDMENT, and WITHDRAWAL events with strictly monotonic sequence numbers (R1, R2, F2).
 */
async function syncJournal(auth, maps = {}) {
    const db = getDb();

    // Query samples accessible to this connection across all statuses to track cancellations & holds
    const baseWhere = buildSampleWhere(auth, { status: '*' });
    delete baseWhere.status;
    delete baseWhere.OR;
    delete baseWhere.AND;

    const samples = await prisma.sample.findMany({
        where: baseWhere,
        include: { results: true },
        orderBy: [
            { updatedAt: 'asc' },
            { id: 'asc' }
        ]
    });

    const getLatestStmt = db.prepare(`
        SELECT sequence, event_type, content_hash
        FROM _exchange_journal
        WHERE specimen_id = ?
        ORDER BY sequence DESC
        LIMIT 1
    `);

    const getMaxSeqStmt = db.prepare(`
        SELECT MAX(sequence) as maxSeq FROM _exchange_journal
    `);

    const insertJournalStmt = db.prepare(`
        INSERT INTO _exchange_journal (
            id, sequence, event_type, specimen_id, field_sample_id, lab_sample_id,
            country, project_code, laboratory_id, content_hash, payload, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const syncTx = db.transaction(() => {
        let currentMaxSeq = (getMaxSeqStmt.get()?.maxSeq || 0);
        const hasSampleTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Sample'").get());
        const hasResultTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Result'").get());

        for (const s of samples) {
            // Live row check directly from SQLite within the transaction to prevent stale read races
            const live = hasSampleTable ? db.prepare('SELECT * FROM Sample WHERE id = ?').get(s.id) : s;
            if (!live) {
                const latest = getLatestStmt.get(s.id);
                if (latest && latest.event_type !== 'WITHDRAWAL') {
                    currentMaxSeq++;
                    const evtId = `evt_${s.id}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
                    insertJournalStmt.run(
                        evtId,
                        currentMaxSeq,
                        'WITHDRAWAL',
                        s.id,
                        s.originalId,
                        s.labId,
                        s.country || s.countryName || null,
                        s.projectCode || null,
                        s.assignedLab || null,
                        latest.content_hash,
                        null,
                        new Date().toISOString()
                    );
                }
                continue;
            }

            const isEligible = isSpecimenEligible(live);
            const isWithdrawnStatus = !isEligible;
            const latest = getLatestStmt.get(live.id);

            if (isWithdrawnStatus) {
                if (latest && latest.event_type !== 'WITHDRAWAL') {
                    // Status changed away from released/eligible (e.g. hold applied, unapproved, processing, cancelled): WITHDRAWAL
                    currentMaxSeq++;
                    const evtId = `evt_${live.id}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
                    const eventTime = live.updatedAt ? new Date(live.updatedAt).toISOString() : new Date().toISOString();
                    insertJournalStmt.run(
                        evtId,
                        currentMaxSeq,
                        'WITHDRAWAL',
                        live.id,
                        live.originalId,
                        live.labId,
                        live.country || live.countryName || null,
                        live.projectCode || null,
                        live.assignedLab || null,
                        latest.content_hash,
                        null,
                        eventTime
                    );
                }
                // If !latest, or latest is already WITHDRAWAL: DO NOTHING!
                continue;
            }

            // Live sample is in released status.
            // Fetch live results from SQLite if table exists to ensure 100% current results
            const liveResults = hasResultTable ? db.prepare('SELECT * FROM Result WHERE sampleId = ?').all(live.id) : (s.results || []);
            live.results = liveResults;

            const currentHash = computeSampleContentHash(live);
            const eventTime = live.updatedAt ? new Date(live.updatedAt).toISOString() : new Date().toISOString();
            const sourceSysId = getSourceSystemId(db);

            if (!latest) {
                // If never previously journaled and currently in released status: PUBLICATION
                currentMaxSeq++;
                const evtId = `evt_${live.id}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
                const formatted = formatSampleV2(live, maps, { internal: true, db, sourceSystemId: sourceSysId });
                insertJournalStmt.run(
                    evtId,
                    currentMaxSeq,
                    'PUBLICATION',
                    live.id,
                    live.originalId,
                    live.labId,
                    live.country || live.countryName || null,
                    live.projectCode || null,
                    live.assignedLab || null,
                    currentHash,
                    JSON.stringify(formatted),
                    eventTime
                );
            } else {
                // Was previously journaled
                if (latest.event_type === 'WITHDRAWAL') {
                    // Was previously withdrawn. ONLY republish if live sample was genuinely re-approved AFTER withdrawal!
                    const liveApprovedTime = live.approvedAt ? new Date(live.approvedAt).getTime() : 0;
                    const withdrawalTime = Date.parse(formatStoredUtc(latest.created_at));
                    if (liveApprovedTime > withdrawalTime) {
                        currentMaxSeq++;
                        const evtId = `evt_${live.id}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
                        const formatted = formatSampleV2(live, maps, { internal: true, db, sourceSystemId: sourceSysId });
                        insertJournalStmt.run(
                            evtId,
                            currentMaxSeq,
                            'PUBLICATION',
                            live.id,
                            live.originalId,
                            live.labId,
                            live.country || live.countryName || null,
                            live.projectCode || null,
                            live.assignedLab || null,
                            currentHash,
                            JSON.stringify(formatted),
                            eventTime
                        );
                    }
                } else if (latest.content_hash !== currentHash) {
                    // Analytical results or metadata changed on released sample: AMENDMENT
                    currentMaxSeq++;
                    const evtId = `evt_${live.id}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
                    const formatted = formatSampleV2(live, maps, { internal: true, db, sourceSystemId: sourceSysId });
                    insertJournalStmt.run(
                        evtId,
                        currentMaxSeq,
                        'AMENDMENT',
                        live.id,
                        live.originalId,
                        live.labId,
                        live.country || live.countryName || null,
                        live.projectCode || null,
                        live.assignedLab || null,
                        currentHash,
                        JSON.stringify(formatted),
                        eventTime
                    );
                }
            }
        }
    });

    syncTx();
}

/**
 * Prunes expired snapshots and associated items to enforce bounded storage retention (R2/R10).
 * Bounded by retention TTL and per-connection quota.
 */
function pruneExpiredSnapshots(db) {
    const targetDb = db || (dbInstance || getDb());
    if (!targetDb || typeof targetDb.prepare !== 'function') return { prunedCount: 0 };
    try {
        const nowIso = new Date().toISOString();
        const expiredSnaps = targetDb.prepare('SELECT id FROM _exchange_snapshots WHERE expires_at < ?').all(nowIso);
        if (expiredSnaps.length === 0) return { prunedCount: 0 };

        let prunedCount = 0;
        const pruneTx = targetDb.transaction(() => {
            const deleteItems = targetDb.prepare('DELETE FROM _exchange_snapshot_items WHERE snapshot_id = ?');
            const deleteSnap = targetDb.prepare('DELETE FROM _exchange_snapshots WHERE id = ?');
            for (const s of expiredSnaps) {
                deleteItems.run(s.id);
                deleteSnap.run(s.id);
                prunedCount++;
            }
        });
        pruneTx();
        return { prunedCount };
    } catch (e) {
        console.warn('[EXCHANGE_PRUNE_WARN]', e.message);
        return { prunedCount: 0 };
    }
}

/**
 * Creates an immutable export snapshot at current high-water sequence boundary.
 * Freezes item JSON in _exchange_snapshot_items so subsequent sample edits do not mutate the snapshot (R2, Probes 1 & 2).
 */
async function createSnapshot(auth, { ttlHours = 24, profile = null, filter = {}, maps = {} } = {}) {
    const db = getDb();
    ensureTriggers(db);
    const connectionId = getConnectionId(auth);
    if (auth?.connectionStatus && auth.connectionStatus !== 'ACTIVE') {
        return { error: 'FORBIDDEN', status: 403, code: 'CONNECTION_DISABLED', message: `Exchange connection '${connectionId}' is ${auth.connectionStatus}.` };
    }

    // Pure reader operation: no outbox journal synchronization or mutation during snapshot creation (R1, R10)

    // Storage maintenance & quota enforcement (R2/R10)
    pruneExpiredSnapshots(db);
    const MAX_ACTIVE_SNAPSHOTS = 10;
    const now = new Date();
    const activeSnaps = db.prepare('SELECT COUNT(*) as n FROM _exchange_snapshots WHERE connection_id = ? AND expires_at > ?').get(connectionId, now.toISOString())?.n || 0;
    if (activeSnaps >= MAX_ACTIVE_SNAPSHOTS) {
        return {
            error: 'QUOTA_EXCEEDED',
            status: 429,
            code: 'SNAPSHOT_QUOTA_EXCEEDED',
            message: `Active snapshot quota exceeded (${activeSnaps}/${MAX_ACTIVE_SNAPSHOTS}). Await expiration of existing snapshots.`
        };
    }

    const snapshotId = `snap_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const highWaterTimestamp = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();

    const maxSeq = db.prepare('SELECT COALESCE(MAX(sequence), 0) as s FROM _exchange_journal').get()?.s || 0;

    // Scoping conditions on _exchange_journal for immutable snapshot items
    const conditions = ['j.sequence <= ?'];
    const params = [maxSeq];

    // Laboratory Scoping
    if (Array.isArray(auth?.labs)) {
        if (auth.labs.includes('*') || (auth?.type !== 'API_KEY' && auth?.role === 'SUPER_ADMIN')) {
            // Global lab scope
        } else if (auth.labs.length === 0) {
            conditions.push('1 = 0');
        } else {
            const placeholders = auth.labs.map(() => '?').join(',');
            conditions.push(`j.laboratory_id IN (${placeholders})`);
            params.push(...auth.labs);
        }
    } else {
        conditions.push('1 = 0');
    }

    // Country Scoping
    if (Array.isArray(auth?.countries)) {
        if (auth.countries.includes('*')) {
            // Global country scope
        } else if (auth.countries.length === 0) {
            conditions.push('1 = 0');
        } else {
            const placeholders = auth.countries.map(() => '?').join(',');
            conditions.push(`j.country IN (${placeholders})`);
            params.push(...auth.countries);
        }
    }

    // Project Scoping
    if (Array.isArray(auth?.projects)) {
        if (auth.projects.includes('*')) {
            // Global project scope
        } else if (auth.projects.length === 0) {
            conditions.push('1 = 0');
        } else {
            let authorizedProjects = auth.projects;
            try {
                const projectPolicyService = require('./projectPolicyService');
                const expandedProjects = new Set();
                for (const kp of auth.projects) {
                    expandedProjects.add(kp);
                    try {
                        const children = projectPolicyService.getProgrammeChildProjectCodes(kp);
                        children.forEach(c => expandedProjects.add(c));
                    } catch (e) {}
                }
                authorizedProjects = Array.from(expandedProjects);
            } catch (e) {}

            if (authorizedProjects.length > 0) {
                const placeholders = authorizedProjects.map(() => '?').join(',');
                conditions.push(`j.project_code IN (${placeholders})`);
                params.push(...authorizedProjects);
            } else {
                conditions.push('1 = 0');
            }
        }
    }

    // Strict OpenNSIS profile filter (specimen must possess lab accession)
    if (profile === 'opennsis') {
        conditions.push('j.lab_sample_id IS NOT NULL');
    }

    // Explicit query filter overrides (if authorized)
    if (filter?.country) {
        conditions.push('j.country = ?');
        params.push(filter.country);
    }
    if (filter?.project) {
        conditions.push('j.project_code = ?');
        params.push(filter.project);
    }
    if (filter?.labId || filter?.assignedLab) {
        conditions.push('j.laboratory_id = ?');
        params.push(filter.assignedLab || filter.labId);
    }

    const whereSql = conditions.join(' AND ');

    // Read latest published revision for each specimen up to maxSeq from immutable journal
    const items = db.prepare(`
        SELECT j.specimen_id, j.payload
        FROM _exchange_journal j
        INNER JOIN (
            SELECT specimen_id, MAX(sequence) as max_seq
            FROM _exchange_journal
            WHERE sequence <= ?
            GROUP BY specimen_id
        ) latest ON j.specimen_id = latest.specimen_id AND j.sequence = latest.max_seq
        WHERE ${whereSql}
          AND j.event_type != 'WITHDRAWAL'
          AND j.payload IS NOT NULL
        ORDER BY j.specimen_id ASC
    `).all(maxSeq, ...params);

    const currentConn = db.prepare('SELECT auth_version FROM _exchange_connections WHERE id = ?').get(connectionId);
    const currentAuthVersion = auth?.authVersion || currentConn?.auth_version || 1;
    const epoch = getCurrentEpoch(db);
    const schemaVersion = '2026-09-issue140-v2';

    // Permitted canonical projection for snapshot items (R2, R8, R10)
    // Redact spatial coordinates if caller lacks SPATIAL capability so stored items and digest match delivered projection
    const canAccessSpatial = hasSpatialCapability(auth);
    const projectedItems = items.map(item => {
        let payloadStr = item.payload || '';
        if (!canAccessSpatial && payloadStr) {
            try {
                const parsed = JSON.parse(payloadStr);
                if (parsed.sampling) {
                    parsed.sampling.location = null;
                }
                payloadStr = JSON.stringify(parsed);
            } catch (e) {}
        }
        return {
            specimen_id: item.specimen_id,
            payload: payloadStr
        };
    });

    // Canonical delivered revision content digest (R2, R8, R10)
    const snapHash = crypto.createHash('sha256');
    snapHash.update(`${snapshotId}:${connectionId}:${maxSeq}:${epoch}:${currentAuthVersion}\n`);
    for (const item of projectedItems) {
        snapHash.update(`${item.specimen_id}:${item.payload || ''}\n`);
    }
    const digest = snapHash.digest('hex');

    const authorizedLabs = Array.isArray(auth?.labs) ? JSON.stringify(auth.labs) : (auth?.labs ? JSON.stringify([auth.labs]) : '[]');
    const authorizedCountries = Array.isArray(auth?.countries) ? JSON.stringify(auth.countries) : '[]';
    const authorizedProjects = Array.isArray(auth?.projects) ? JSON.stringify(auth.projects) : '[]';

    const insertSnap = db.prepare(`
        INSERT INTO _exchange_snapshots (
            id, connection_id, high_water_sequence, high_water_timestamp, total_samples, expires_at, created_at,
            authorized_labs, authorized_countries, authorized_projects, auth_version, epoch, schema_version, digest
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = db.prepare(`
        INSERT INTO _exchange_snapshot_items (snapshot_id, specimen_id, item_order, body_json)
        VALUES (?, ?, ?, ?)
    `);

    const createTx = db.transaction(() => {
        insertSnap.run(
            snapshotId, connectionId, maxSeq, highWaterTimestamp, projectedItems.length, expiresAt, now.toISOString(),
            authorizedLabs, authorizedCountries, authorizedProjects, currentAuthVersion, epoch, schemaVersion, digest
        );
        for (let i = 0; i < projectedItems.length; i++) {
            insertItem.run(snapshotId, projectedItems[i].specimen_id, i + 1, projectedItems[i].payload);
        }
    });

    createTx();

    const nextCursor = encodeCursor({
        type: 'change',
        connectionId,
        seq: maxSeq,
        profile: profile || null,
        filter: filter || {},
        timestamp: highWaterTimestamp
    }, db);

    return {
        snapshotId,
        connectionId,
        highWaterSequence: maxSeq,
        highWaterTimestamp,
        nextCursor,
        totalSamples: items.length,
        digest,
        authVersion: currentAuthVersion,
        epoch,
        schemaVersion,
        expiresAt,
        ttlHours
    };
}

/**
 * Retrieves a snapshot and validates ownership, expiry, and current scope version.
 * Enforces strict connection ownership and fail-closed scope revocation (F3, Probe 3).
 */
function getSnapshot(snapshotId, auth) {
    const db = getDb();
    const connectionId = getConnectionId(auth);
    if (auth?.connectionStatus && auth.connectionStatus !== 'ACTIVE') {
        return { error: 'FORBIDDEN', status: 403, code: 'CONNECTION_DISABLED', message: `Exchange connection '${connectionId}' is ${auth.connectionStatus}.` };
    }
    const stmt = db.prepare(`SELECT * FROM _exchange_snapshots WHERE id = ?`);
    const snap = stmt.get(snapshotId);

    if (!snap) return { error: 'NOT_FOUND', status: 404, message: 'Snapshot not found.' };

    if (snap.connection_id !== connectionId) {
        return { error: 'FORBIDDEN', status: 403, message: 'Snapshot belongs to a different connection.' };
    }

    if (new Date(snap.expires_at) < new Date()) {
        return { error: 'SNAPSHOT_EXPIRED', status: 410, message: 'Snapshot has expired. Create a new snapshot.' };
    }

    // Validate authorization version / generation binding (R2, R3)
    const currentConn = db.prepare('SELECT auth_version, status FROM _exchange_connections WHERE id = ?').get(connectionId);
    const currentAuthVersion = auth?.authVersion || currentConn?.auth_version || 1;
    if (snap.auth_version !== undefined && snap.auth_version !== null && snap.auth_version !== currentAuthVersion) {
        return {
            error: 'SNAPSHOT_EXPIRED',
            status: 410,
            code: 'AUTH_VERSION_MISMATCH',
            message: `Snapshot '${snapshotId}' was issued under authorization version ${snap.auth_version}, but current connection authorization version is ${currentAuthVersion}. Create a new snapshot.`
        };
    }

    const currentEpoch = getCurrentEpoch(db);
    if (snap.epoch && snap.epoch !== currentEpoch) {
        return {
            error: 'SNAPSHOT_EXPIRED',
            status: 410,
            code: 'EPOCH_MISMATCH',
            message: `Snapshot '${snapshotId}' belongs to a previous epoch (${snap.epoch}) and has been invalidated.`
        };
    }

    // Check scope revocation (F3, Probe 3, Finding 3):
    // Validate effective authorization for labs, countries, and projects.
    // Fail closed if metadata is malformed or credentials were reduced/revoked.
    if (auth?.type === 'API_KEY') {
        // 1. Laboratory scope validation
        if (!snap.authorized_labs) {
            return { error: 'FORBIDDEN', status: 403, message: 'Snapshot lacks required laboratory authorization metadata.' };
        }
        let snapLabs;
        try {
            snapLabs = JSON.parse(snap.authorized_labs);
        } catch (e) {
            return { error: 'FORBIDDEN', status: 403, message: 'Malformed snapshot laboratory scope metadata.' };
        }
        const currentLabs = auth.labs || [];
        if (!Array.isArray(currentLabs) || currentLabs.length === 0) {
            return { error: 'FORBIDDEN', status: 403, message: 'Current credentials lack laboratory scope (scope revoked).' };
        }
        if (!currentLabs.includes('*')) {
            if (snapLabs.includes('*')) {
                return { error: 'FORBIDDEN', status: 403, message: 'Wildcard laboratory scope has been revoked.' };
            }
            if (!snapLabs.every(l => currentLabs.includes(l))) {
                return { error: 'FORBIDDEN', status: 403, message: 'Current credentials no longer authorized for snapshot laboratory scope.' };
            }
        }

        // 2. Country scope validation
        if (snap.authorized_countries) {
            let snapCountries;
            try {
                snapCountries = JSON.parse(snap.authorized_countries);
            } catch (e) {
                return { error: 'FORBIDDEN', status: 403, message: 'Malformed snapshot country scope metadata.' };
            }
            const currentCountries = auth.countries || [];
            if (!Array.isArray(currentCountries) || currentCountries.length === 0) {
                return { error: 'FORBIDDEN', status: 403, message: 'Current credentials lack country scope (scope revoked).' };
            }
            if (!currentCountries.includes('*')) {
                if (snapCountries.includes('*')) {
                    return { error: 'FORBIDDEN', status: 403, message: 'Wildcard country scope has been revoked.' };
                }
                if (!snapCountries.every(c => currentCountries.includes(c))) {
                    return { error: 'FORBIDDEN', status: 403, message: 'Current credentials no longer authorized for snapshot country scope.' };
                }
            }
        }

        // 3. Project scope validation (including programme child project expansion)
        if (snap.authorized_projects) {
            let snapProjects;
            try {
                snapProjects = JSON.parse(snap.authorized_projects);
            } catch (e) {
                return { error: 'FORBIDDEN', status: 403, message: 'Malformed snapshot project scope metadata.' };
            }
            const currentProjects = auth.projects || [];
            if (!Array.isArray(currentProjects) || currentProjects.length === 0) {
                return { error: 'FORBIDDEN', status: 403, message: 'Current credentials lack project scope (scope revoked).' };
            }
            if (!currentProjects.includes('*')) {
                if (snapProjects.includes('*')) {
                    return { error: 'FORBIDDEN', status: 403, message: 'Wildcard project scope has been revoked.' };
                }
                const expandedCurrent = new Set(currentProjects);
                try {
                    const projectPolicyService = require('./projectPolicyService');
                    for (const p of currentProjects) {
                        const children = projectPolicyService.getProgrammeChildProjectCodes(p);
                        if (children && Array.isArray(children)) {
                            children.forEach(c => expandedCurrent.add(c));
                        }
                    }
                } catch (e) {}
                if (!snapProjects.every(p => expandedCurrent.has(p))) {
                    return { error: 'FORBIDDEN', status: 403, message: 'Current credentials no longer authorized for snapshot project scope.' };
                }
            }
        }
    }

    return { snapshot: snap };
}

/**
 * Encodes an authenticated opaque cursor with HMAC integrity protection (Finding 3).
 */
function encodeCursor(data, db) {
    const metaDb = db || (dbInstance || getDb());
    const secret = getCursorSecret(metaDb);
    const epoch = getCurrentEpoch(metaDb);

    let authVersion = data.authVersion;
    if (authVersion === undefined && data.connectionId && metaDb) {
        try {
            const row = metaDb.prepare('SELECT auth_version FROM _exchange_connections WHERE id = ?').get(data.connectionId);
            if (row && row.auth_version !== undefined) {
                authVersion = row.auth_version;
            }
        } catch (e) {}
    }

    const payload = {
        v: 2,
        ...data,
        authVersion: authVersion !== undefined ? authVersion : 1,
        profile: (data.profile && String(data.profile).trim().toLowerCase()) || 'default',
        epoch,
        issuedAt: Date.now()
    };
    const raw = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', secret).update(raw).digest('hex').slice(0, 16);
    return Buffer.from(JSON.stringify({ p: payload, s: sig })).toString('base64');
}

function decodeCursor(cursorStr, db) {
    if (!cursorStr) return null;
    const metaDb = db || (dbInstance || getDb());
    try {
        const decoded = JSON.parse(Buffer.from(cursorStr, 'base64').toString('utf8'));
        if (decoded && decoded.p && decoded.s) {
            let secret;
            try {
                secret = getCursorSecret(metaDb);
            } catch (err) {
                return { invalid: true, reason: 'STATE_STORAGE_UNAVAILABLE', message: 'Cursor verification unavailable: signing state storage failed.' };
            }
            const expectedSig = crypto.createHmac('sha256', secret).update(JSON.stringify(decoded.p)).digest('hex').slice(0, 16);
            if (decoded.s !== expectedSig) {
                return { invalid: true, reason: 'SIGNATURE_MISMATCH', message: 'Cursor signature verification failed.' };
            }
            let currentEpoch;
            try {
                currentEpoch = getCurrentEpoch(metaDb);
            } catch (err) {
                return { invalid: true, reason: 'STATE_STORAGE_UNAVAILABLE', message: 'Epoch verification unavailable: signing state storage failed.' };
            }
            if (decoded.p.epoch && decoded.p.epoch !== currentEpoch) {
                return { invalid: true, expired: true, reason: 'EPOCH_MISMATCH', message: 'Cursor epoch mismatch.' };
            }

            // Connection status and auth_version validation (R2, R3, R11)
            if (decoded.p.connectionId && metaDb) {
                try {
                    const connRow = metaDb.prepare('SELECT status, auth_version FROM _exchange_connections WHERE id = ?').get(decoded.p.connectionId);
                    if (connRow) {
                        if (connRow.status && connRow.status !== 'ACTIVE') {
                            return { invalid: true, expired: true, reason: 'CONNECTION_DISABLED', message: `Connection '${decoded.p.connectionId}' is ${connRow.status}.` };
                        }
                        if (decoded.p.authVersion !== undefined && decoded.p.authVersion !== connRow.auth_version) {
                            return { invalid: true, expired: true, reason: 'AUTH_VERSION_MISMATCH', message: 'Cursor authorization version mismatch due to permission changes.' };
                        }
                    }
                } catch (e) {}
            }

            if (decoded.p.issuedAt && typeof decoded.p.issuedAt === 'number') {
                const age = Date.now() - decoded.p.issuedAt;
                if (age > 72 * 3600 * 1000) {
                    return { expired: true, message: 'Cursor has expired.' };
                }
            }
            return decoded.p;
        }
        // Fail closed on unsigned or malformed cursor structures
        return { invalid: true, expired: true, reason: 'UNSIGNED_CURSOR', message: 'Cursor must be HMAC signed.' };
    } catch (e) {
        return { invalid: true, expired: true, reason: 'MALFORMED_CURSOR', message: 'Malformed cursor payload.' };
    }
}

/**
 * Canonical filter normalization across all live-list endpoints (samples, observations, geojson, spectra).
 * Ensures uniform case-folding, string trimming, and alias resolution (R2, R8, R11).
 */
function normalizeFilter(query = {}, endpoint = 'samples') {
    const norm = {};

    // Common filters across endpoints
    if (query.status !== undefined && query.status !== null && String(query.status).trim() !== '') {
        const rawStatus = String(query.status).trim().toUpperCase();
        norm.status = (rawStatus === 'ALL' || rawStatus === '*') ? '*' : rawStatus;
    } else {
        norm.status = null;
    }

    if (query.profile !== undefined && query.profile !== null && String(query.profile).trim() !== '') {
        norm.profile = String(query.profile).trim().toLowerCase();
    } else {
        norm.profile = 'default';
    }

    if (query.country !== undefined && query.country !== null && String(query.country).trim() !== '') {
        norm.country = String(query.country).trim().toUpperCase();
    } else {
        norm.country = null;
    }

    if (query.project !== undefined && query.project !== null && String(query.project).trim() !== '') {
        norm.project = String(query.project).trim();
    } else {
        norm.project = null;
    }

    const rawLabId = (query.labId !== undefined && query.labId !== null && String(query.labId).trim() !== '') ? String(query.labId).trim() : null;
    const rawAssigned = (query.assignedLab !== undefined && query.assignedLab !== null && String(query.assignedLab).trim() !== '') ? String(query.assignedLab).trim() : null;
    if (rawLabId && rawAssigned && rawLabId !== rawAssigned) {
        const err = new Error(`Conflicting labId ('${rawLabId}') and assignedLab ('${rawAssigned}') query parameters.`);
        err.code = 'INVALID_QUERY';
        throw err;
    }
    norm.labId = rawLabId || rawAssigned || null;

    if (query.updatedSince !== undefined && query.updatedSince !== null && String(query.updatedSince).trim() !== '') {
        norm.updatedSince = String(query.updatedSince).trim();
    } else {
        norm.updatedSince = null;
    }

    if (endpoint === 'observations') {
        norm.param = (query.param && String(query.param).trim() !== '') ? String(query.param).trim().toUpperCase() : null;
        norm.censoring = (query.censoring && String(query.censoring).trim() !== '') ? String(query.censoring).trim().toUpperCase() : null;
        norm.basis = (query.basis && String(query.basis).trim() !== '') ? String(query.basis).trim().toUpperCase() : null;
    } else if (endpoint === 'geojson') {
        norm.bbox = (query.bbox && String(query.bbox).trim() !== '') ? String(query.bbox).trim() : null;
    } else if (endpoint === 'spectra') {
        norm.modality = (query.modality && String(query.modality).trim() !== '') ? String(query.modality).trim().toUpperCase() : null;
        const rawInst = (query.instrument !== undefined && query.instrument !== null && String(query.instrument).trim() !== '') ? String(query.instrument).trim() : null;
        const rawEquip = (query.equipmentId !== undefined && query.equipmentId !== null && String(query.equipmentId).trim() !== '') ? String(query.equipmentId).trim() : null;
        if (rawInst && rawEquip && rawInst !== rawEquip) {
            const err = new Error(`Conflicting instrument ('${rawInst}') and equipmentId ('${rawEquip}') query parameters.`);
            err.code = 'INVALID_QUERY';
            throw err;
        }
        norm.instrument = rawInst || rawEquip || null;
        norm.qcStatus = (query.qcStatus && String(query.qcStatus).trim() !== '') ? String(query.qcStatus).trim().toUpperCase() : null;
    }

    return norm;
}

/**
 * Builds a single canonical effective query context across live-list endpoints (R2, R8, R11).
 * Detects alias conflicts, enforces consistent alias precedence, uppercase case-folding,
 * and passes the canonical filter context to cursor validation and query builders.
 */
function buildCanonicalQueryContext(rawQuery = {}, endpoint = 'samples') {
    try {
        const norm = normalizeFilter(rawQuery, endpoint);
        const query = {
            ...rawQuery,
            ...norm,
            profile: norm.profile
        };
        if (norm.labId !== undefined && norm.labId !== null) {
            query.labId = norm.labId;
            query.assignedLab = norm.labId;
        }
        if (norm.instrument !== undefined && norm.instrument !== null) {
            query.instrument = norm.instrument;
            query.equipmentId = norm.instrument;
        }
        return { ok: true, query, filter: norm };
    } catch (err) {
        return { ok: false, error: err.message, code: err.code || 'INVALID_QUERY' };
    }
}

/**
 * Validates and decodes live list cursors (samples, observations, geojson, spectra).
 * Enforces fail-closed validation on malformed/signature/expiry/epoch/connection/endpoint/filter changes (R2, R8, R11).
 */
function validateLiveListCursor(cursorStr, auth, endpoint, query = {}, db) {
    if (!cursorStr) {
        return { ok: true, decoded: null };
    }
    const metaDb = db || (dbInstance || getDb());
    const decoded = decodeCursor(cursorStr, metaDb);

    if (!decoded || typeof decoded !== 'object') {
        return { ok: false, status: 400, code: 'INVALID_CURSOR', message: 'Cursor could not be parsed.' };
    }

    // Expiry / Epoch / Connection status / AuthVersion changes return 410 CURSOR_EXPIRED
    if (decoded.reason === 'EPOCH_MISMATCH' || decoded.reason === 'AUTH_VERSION_MISMATCH' || decoded.reason === 'CONNECTION_DISABLED' || (decoded.expired && !decoded.invalid)) {
        return {
            ok: false,
            status: 410,
            code: 'CURSOR_EXPIRED',
            message: decoded.message || 'Cursor has expired or was invalidated by database restore/rotation.'
        };
    }

    if (decoded.invalid) {
        return {
            ok: false,
            status: 400,
            code: 'INVALID_CURSOR',
            message: decoded.message || 'Cursor signature verification failed or cursor is malformed.'
        };
    }

    if (decoded.expired) {
        return {
            ok: false,
            status: 410,
            code: 'CURSOR_EXPIRED',
            message: decoded.message || 'Cursor has expired or was invalidated by database restore/rotation.'
        };
    }

    // Must be a live list cursor (R2, R8, R11)
    if (decoded.type !== 'live_list') {
        return {
            ok: false,
            status: 400,
            code: 'INVALID_CURSOR',
            message: `Cursor type '${decoded.type || 'unknown'}' is not a valid live list cursor.`
        };
    }

    // 1. Connection binding (required):
    const currentConn = getConnectionId(auth);
    if (!decoded.connectionId || decoded.connectionId !== currentConn) {
        return {
            ok: false,
            status: 400,
            code: 'CURSOR_CONTEXT_MISMATCH',
            message: `Cursor was issued for connection '${decoded.connectionId || 'none'}', not '${currentConn}'.`
        };
    }

    // 2. Endpoint binding (required):
    if (!decoded.endpoint || decoded.endpoint !== endpoint) {
        return {
            ok: false,
            status: 400,
            code: 'CURSOR_ENDPOINT_MISMATCH',
            message: `Cursor was issued for endpoint '${decoded.endpoint || 'none'}', not '${endpoint}'.`
        };
    }

    // 3. Profile binding (required):
    const currentProfile = (query.profile && String(query.profile).trim().toLowerCase()) || 'default';
    if (!decoded.profile || decoded.profile !== currentProfile) {
        return {
            ok: false,
            status: 400,
            code: 'CURSOR_PROFILE_MISMATCH',
            message: `Cursor profile '${decoded.profile || 'none'}' does not match requested profile '${currentProfile}'.`
        };
    }

    // 4. Query filter binding (symmetric normalized filter check):
    let reqFilter;
    try {
        reqFilter = normalizeFilter(query, endpoint);
    } catch (err) {
        return {
            ok: false,
            status: 400,
            code: err.code || 'INVALID_QUERY',
            message: err.message
        };
    }
    const curFilter = (decoded.filter && typeof decoded.filter === 'object') ? decoded.filter : {};
    const allKeys = new Set([...Object.keys(reqFilter), ...Object.keys(curFilter)]);
    for (const k of allKeys) {
        const reqVal = reqFilter[k] !== undefined ? reqFilter[k] : null;
        const curVal = curFilter[k] !== undefined ? curFilter[k] : null;
        if (k === 'status') {
            if ((reqVal === 'ALL' || reqVal === '*') && (curVal === 'ALL' || curVal === '*')) {
                continue;
            }
        }
        if (reqVal !== curVal) {
            return {
                ok: false,
                status: 400,
                code: 'CURSOR_FILTER_MISMATCH',
                message: `Cursor query filter '${k}' (${curVal}) does not match requested filter (${reqVal}).`
            };
        }
    }

    // 5. Live authorization / connection status verification:
    if (decoded.connectionId && metaDb) {
        try {
            const connRow = metaDb.prepare('SELECT status, auth_version FROM _exchange_connections WHERE id = ?').get(decoded.connectionId);
            if (connRow) {
                if (connRow.status && connRow.status !== 'ACTIVE') {
                    return {
                        ok: false,
                        status: 410,
                        code: 'CURSOR_EXPIRED',
                        message: `Connection '${decoded.connectionId}' is ${connRow.status}.`
                    };
                }
                if (decoded.authVersion !== undefined && decoded.authVersion !== connRow.auth_version) {
                    return {
                        ok: false,
                        status: 410,
                        code: 'CURSOR_EXPIRED',
                        message: 'Cursor authorization version mismatch due to permission changes.'
                    };
                }
            }
        } catch (e) {}
    }

    return { ok: true, decoded };
}

function hasSpatialCapability(auth) {
    if (!auth) return false;
    // Platform-user JWT exception applies strictly to authenticated platform users, never to API_KEY principals
    if (auth.type !== 'API_KEY' && auth.role === 'SUPER_ADMIN') return true;
    const caps = auth.capabilities;
    if (!Array.isArray(caps)) return false;
    return caps.includes('SPATIAL') || caps.includes('*');
}

/**
 * Reads paginated items within a snapshot boundary from frozen _exchange_snapshot_items (R2, F3).
 */
async function getSnapshotPage(snapshotId, auth, { limit = 50, cursor = null } = {}) {
    const check = getSnapshot(snapshotId, auth);
    if (check.error) return check;

    const connectionId = getConnectionId(auth);
    const snap = check.snapshot;
    const maxLimit = Math.min(500, Math.max(1, parseInt(limit) || 50));
    const db = getDb();
    
    let offset = 0;
    if (cursor) {
        const decoded = decodeCursor(cursor, db);
        if (!decoded || decoded.invalid || decoded.expired) {
            return {
                error: decoded?.expired ? 'CURSOR_EXPIRED' : 'INVALID_CURSOR',
                status: decoded?.expired ? 410 : 400,
                message: decoded?.message || 'Malformed page cursor.'
            };
        }
        // F3, Probe 6: Reject cursor for a different snapshot or endpoint
        if (decoded.type && decoded.type !== 'snapshot') {
            return { error: 'INVALID_CURSOR', status: 400, message: 'Cursor is not a snapshot page cursor.' };
        }
        if (!decoded.snapshotId || decoded.snapshotId !== snapshotId) {
            return { error: 'INVALID_CURSOR', status: 400, message: 'Cursor does not match the requested snapshot.' };
        }
        if (decoded.connectionId && decoded.connectionId !== connectionId) {
            return { error: 'INVALID_CURSOR', status: 400, message: 'Cursor belongs to a different connection.' };
        }
        offset = decoded.itemOrder || 0;
    }

    const rows = db.prepare(`
        SELECT specimen_id, item_order, body_json
        FROM _exchange_snapshot_items
        WHERE snapshot_id = ? AND item_order > ?
        ORDER BY item_order ASC
        LIMIT ?
    `).all(snapshotId, offset, maxLimit + 1);

    const hasMore = rows.length > maxLimit;
    const pageRows = hasMore ? rows.slice(0, maxLimit) : rows;

    let nextCursor = null;
    if (hasMore && pageRows.length > 0) {
        const last = pageRows[pageRows.length - 1];
        nextCursor = encodeCursor({
            type: 'snapshot',
            connectionId,
            snapshotId,
            itemOrder: last.item_order
        }, db);
    }

    const canAccessSpatial = hasSpatialCapability(auth);
    const data = pageRows.map(r => {
        const item = JSON.parse(r.body_json);
        if (!canAccessSpatial && item.sampling) {
            item.sampling.location = null;
        }
        return item;
    });

    return {
        snapshotId,
        highWaterTimestamp: snap.high_water_timestamp,
        highWaterSequence: snap.high_water_sequence || 0,
        digest: snap.digest,
        authVersion: snap.auth_version || 1,
        epoch: snap.epoch,
        schemaVersion: snap.schema_version,
        count: data.length,
        hasMore,
        nextCursor,
        data
    };
}

/**
 * Change feed reader (continuous synchronization).
 * Reads publication events, amendments, and withdrawals ordered monotonically from _exchange_journal.
 * Enforces dynamic scoping, profile constraints, connection binding, and sequence boundaries (F1, F2, F3).
 */
async function getChanges(auth, { cursor = null, limit = 100, profile = null, filter = {}, maps = {} } = {}) {
    const db = getDb();
    ensureTriggers(db);

    const currentConn = getConnectionId(auth);
    if (auth?.connectionStatus && auth.connectionStatus !== 'ACTIVE') {
        return { error: 'FORBIDDEN', status: 403, code: 'CONNECTION_DISABLED', message: `Exchange connection '${currentConn}' is ${auth.connectionStatus}.` };
    }

    // F1, Probe 2: Fail closed immediately if key has empty laboratory scope
    if (auth?.type === 'API_KEY' && (!auth.labs || !Array.isArray(auth.labs) || auth.labs.length === 0)) {
        return {
            boundaryTimestamp: new Date().toISOString(),
            count: 0,
            hasMore: false,
            nextCursor: cursor || encodeCursor({
                type: 'change',
                connectionId: currentConn,
                seq: 0,
                profile: profile || null,
                filter: filter || {},
                timestamp: new Date().toISOString()
            }, db),
            changes: []
        };
    }

    // Reader-only authoritative outbox (R1/R10): transactional SQLite triggers populate _exchange_journal
    const maxLimit = Math.min(500, Math.max(1, parseInt(limit) || 100));
    const decoded = decodeCursor(cursor, db);

    let startSeq = 0;
    if (cursor) {
        if (!decoded || decoded.expired) {
            return {
                error: 'CURSOR_EXPIRED',
                status: 410,
                message: decoded?.message || 'Invalid or expired cursor.'
            };
        }
        if (decoded.invalid) {
            return {
                error: 'INVALID_CURSOR',
                status: 400,
                message: decoded.message || 'Invalid cursor signature or format.'
            };
        }
        // Endpoint context validation
        if (decoded.type && decoded.type !== 'change') {
            return {
                error: 'INVALID_CURSOR',
                status: 400,
                message: 'Cursor is not a change-feed cursor.'
            };
        }
        // F3, Probe 7: Cross-connection cursor rejection & dynamic binding
        if (decoded.connectionId && decoded.connectionId !== currentConn) {
            return {
                error: 'INVALID_CURSOR',
                status: 400,
                message: 'Cursor belongs to a different connection.'
            };
        }
        // Profile binding: strictly enforce matching between cursor profile and requested profile
        const reqProf = (profile && String(profile).trim().toLowerCase()) || 'default';
        const curProf = (decoded.profile && String(decoded.profile).trim().toLowerCase()) || 'default';
        if (curProf !== reqProf) {
            return {
                error: 'INVALID_CURSOR',
                status: 400,
                message: `Cursor profile '${curProf}' does not match requested profile '${reqProf}'.`
            };
        }
        // Filter binding: compare requested filter with decoded.filter
        const reqFilter = filter || {};
        const curFilter = decoded.filter || {};
        const filterMismatch = (reqFilter.country && reqFilter.country !== curFilter.country) ||
            (curFilter.country && curFilter.country !== reqFilter.country) ||
            (reqFilter.project && reqFilter.project !== curFilter.project) ||
            (curFilter.project && curFilter.project !== reqFilter.project) ||
            (reqFilter.assignedLab && reqFilter.assignedLab !== curFilter.assignedLab) ||
            (curFilter.assignedLab && curFilter.assignedLab !== reqFilter.assignedLab) ||
            (reqFilter.labId && reqFilter.labId !== curFilter.labId) ||
            (curFilter.labId && curFilter.labId !== reqFilter.labId);
        if (filterMismatch) {
            return {
                error: 'INVALID_CURSOR',
                status: 400,
                message: 'Cursor filter does not match requested filter.'
            };
        }
        if (decoded.seq !== undefined && !isNaN(Number(decoded.seq))) {
            startSeq = Number(decoded.seq);
        } else if (decoded.lastUpdatedAt) {
            const row = db.prepare(`SELECT MAX(sequence) as s FROM _exchange_journal WHERE created_at <= ?`).get(decoded.lastUpdatedAt);
            startSeq = row?.s || 0;
        } else {
            return {
                error: 'INVALID_CURSOR',
                status: 400,
                message: 'Malformed cursor.'
            };
        }
    }

    // F3, Probe 8: Reject forged future sequence beyond current journal boundary
    const maxSeqRow = db.prepare('SELECT MAX(sequence) as s FROM _exchange_journal').get();
    const maxSeq = maxSeqRow?.s || 0;
    if (startSeq > maxSeq) {
        return {
            error: 'INVALID_CURSOR',
            status: 400,
            message: 'Cursor sequence is beyond current journal boundary (future sequence).'
        };
    }

    // F1, Probes 1 & 2: Dynamic SQL WHERE scoping on _exchange_journal
    const conditions = ['sequence > ?'];
    const params = [startSeq];

    // Laboratory Scoping
    const keyLabs = auth?.labs || [];
    const hasGlobalLab = keyLabs.includes('*') || (auth?.type !== 'API_KEY' && auth?.role === 'SUPER_ADMIN');
    if (!hasGlobalLab) {
        if (keyLabs.length > 0) {
            const placeholders = keyLabs.map(() => '?').join(',');
            conditions.push(`laboratory_id IN (${placeholders})`);
            params.push(...keyLabs);
        } else {
            conditions.push('1 = 0');
        }
    }

    // Country Scoping
    if (Array.isArray(auth?.countries)) {
        if (auth.countries.includes('*')) {
            // Global country scope
        } else if (auth.countries.length === 0) {
            conditions.push('1 = 0');
        } else {
            const placeholders = auth.countries.map(() => '?').join(',');
            conditions.push(`country IN (${placeholders})`);
            params.push(...auth.countries);
        }
    }

    // Project Scoping
    if (Array.isArray(auth?.projects)) {
        if (auth.projects.includes('*')) {
            // Global project scope
        } else if (auth.projects.length === 0) {
            conditions.push('1 = 0');
        } else {
            let authorizedProjects = auth.projects;
            try {
                const projectPolicyService = require('./projectPolicyService');
                const expandedProjects = new Set();
                for (const kp of auth.projects) {
                    expandedProjects.add(kp);
                    try {
                        const children = projectPolicyService.getProgrammeChildProjectCodes(kp);
                        children.forEach(c => expandedProjects.add(c));
                    } catch (e) {}
                }
                authorizedProjects = Array.from(expandedProjects);
            } catch (e) {}

            if (authorizedProjects.length > 0) {
                const placeholders = authorizedProjects.map(() => '?').join(',');
                conditions.push(`project_code IN (${placeholders})`);
                params.push(...authorizedProjects);
            } else {
                conditions.push('1 = 0');
            }
        }
    }

    // Strict OpenNSIS profile filter (specimen must possess lab accession) (F3, Probe 9)
    if (profile === 'opennsis') {
        conditions.push('lab_sample_id IS NOT NULL');
    }

    // Explicit query filter overrides (if authorized)
    if (filter?.country) {
        conditions.push('country = ?');
        params.push(filter.country);
    }
    if (filter?.project) {
        conditions.push('project_code = ?');
        params.push(filter.project);
    }
    if (filter?.labId || filter?.assignedLab) {
        conditions.push('laboratory_id = ?');
        params.push(filter.labId || filter.assignedLab);
    }

    const whereSql = conditions.join(' AND ');
    params.push(maxLimit + 1);

    const rows = db.prepare(`
        SELECT id, sequence, event_type, specimen_id, field_sample_id, lab_sample_id,
               country, project_code, laboratory_id, payload, created_at
        FROM _exchange_journal
        WHERE ${whereSql}
        ORDER BY sequence ASC
        LIMIT ?
    `).all(...params);

    const hasMore = rows.length > maxLimit;
    const pageRows = hasMore ? rows.slice(0, maxLimit) : rows;

    let nextCursor = null;
    let issuedBatchId = null;
    if (pageRows.length > 0) {
        const last = pageRows[pageRows.length - 1];
        nextCursor = encodeCursor({
            type: 'change',
            connectionId: currentConn,
            seq: last.sequence,
            profile: profile || null,
            filter: filter || {},
            timestamp: formatStoredUtc(last.created_at)
        }, db);

        // Record issued change batch in _exchange_batches for durable receipt resolution
        issuedBatchId = `batch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const currentConnRow = db.prepare('SELECT auth_version FROM _exchange_connections WHERE id = ?').get(currentConn);
        const currentAuthVer = auth?.authVersion || currentConnRow?.auth_version || 1;
        const curEpoch = getCurrentEpoch(db);
        try {
            db.prepare(`
                INSERT INTO _exchange_batches (id, connection_id, snapshot_id, start_seq, end_seq, item_count, created_at, auth_version, epoch, schema_version)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-09-issue140-v2')
            `).run(issuedBatchId, currentConn, null, pageRows[0].sequence, last.sequence, pageRows.length, new Date().toISOString(), currentAuthVer, curEpoch);
        } catch (e) {}
    } else if (cursor) {
        nextCursor = cursor;
    } else {
        nextCursor = encodeCursor({
            type: 'change',
            connectionId: currentConn,
            seq: maxSeq,
            profile: profile || null,
            filter: filter || {},
            timestamp: new Date().toISOString()
        }, db);
    }

    const canAccessSpatial = hasSpatialCapability(auth);
    const changes = pageRows.map(r => {
        let data = null;
        if (r.payload) {
            try {
                data = JSON.parse(r.payload);
                if (!canAccessSpatial && data && data.sampling) {
                    data.sampling.location = null;
                }
            } catch (e) {}
        }
        return {
            id: r.id,
            sequence: r.sequence,
            eventType: r.event_type,
            specimenId: r.specimen_id,
            fieldSampleId: r.field_sample_id,
            labSampleId: r.lab_sample_id,
            country: r.country,
            projectCode: r.project_code,
            laboratoryId: r.laboratory_id,
            timestamp: formatStoredUtc(r.created_at),
            data
        };
    });

    return {
        batchId: issuedBatchId,
        boundaryTimestamp: new Date().toISOString(),
        count: changes.length,
        hasMore,
        nextCursor,
        changes
    };
}

/**
 * Records an authenticated receiver delivery receipt for snapshots or change batches.
 * Resolves EVERY batch/snapshot against durable issued database artifacts (Finding 2).
 */
function recordReceipt(auth, receiptData = {}) {
    const db = getDb();
    const connectionId = getConnectionId(auth);
    if (auth?.connectionStatus && auth.connectionStatus !== 'ACTIVE') {
        return { error: 'FORBIDDEN', status: 403, code: 'CONNECTION_DISABLED', message: `Exchange connection '${connectionId}' is ${auth.connectionStatus}.` };
    }
    const { receiptId, snapshotId, batchId, importedCount, quarantinedCount, checkpoint, errors = [] } = receiptData;
    const now = new Date().toISOString();

    const imported = importedCount !== undefined ? Number(importedCount) : 0;
    const quarantined = quarantinedCount !== undefined ? Number(quarantinedCount) : 0;

    // Validate integer non-negative counts (F6, Probe 11, Finding 2)
    if (
        isNaN(imported) || imported < 0 || !Number.isInteger(imported) ||
        isNaN(quarantined) || quarantined < 0 || !Number.isInteger(quarantined)
    ) {
        return {
            error: 'INVALID_COUNT',
            status: 400,
            message: 'importedCount and quarantinedCount must be non-negative integers.'
        };
    }

    if (!snapshotId && !batchId) {
        return {
            error: 'INVALID_RECEIPT',
            status: 400,
            message: 'Receipt must reference an issued snapshotId or batchId.'
        };
    }

    // Checkpoint validation: strictly seq_<N> or item_<N>
    if (checkpoint !== undefined && checkpoint !== null && checkpoint !== '') {
        const chkStr = String(checkpoint);
        const isValidCheckpoint = /^(seq_\d+|item_\d+)$/.test(chkStr);
        if (!isValidCheckpoint) {
            return {
                error: 'INVALID_CHECKPOINT',
                status: 400,
                message: `Invalid checkpoint format '${chkStr}'. Checkpoint must be a valid sequence (seq_<N>) or item (item_<N>).`
            };
        }
    }

    const currentConn = db.prepare('SELECT auth_version, status FROM _exchange_connections WHERE id = ?').get(connectionId);
    const currentAuthVersion = auth?.authVersion || currentConn?.auth_version || 1;
    const currentEpoch = getCurrentEpoch(db);

    let snap = null;
    if (snapshotId) {
        snap = db.prepare('SELECT * FROM _exchange_snapshots WHERE id = ?').get(snapshotId);
        if (!snap) {
            return {
                error: 'SNAPSHOT_NOT_FOUND',
                status: 404,
                message: `Referenced snapshot '${snapshotId}' was not issued or does not exist.`
            };
        }
        if (snap.connection_id !== connectionId) {
            return {
                error: 'FORBIDDEN',
                status: 403,
                message: 'Referenced snapshot belongs to a different connection.'
            };
        }
        // Authorization-version binding (R2, R3)
        if (snap.auth_version !== undefined && snap.auth_version !== null && snap.auth_version !== currentAuthVersion) {
            return {
                error: 'SNAPSHOT_EXPIRED',
                status: 410,
                code: 'AUTH_VERSION_MISMATCH',
                message: `Referenced snapshot '${snapshotId}' was issued under authorization version ${snap.auth_version}, but current connection authorization version is ${currentAuthVersion}. Receipt rejected.`
            };
        }
        if (snap.epoch && snap.epoch !== currentEpoch) {
            return {
                error: 'SNAPSHOT_EXPIRED',
                status: 410,
                code: 'EPOCH_MISMATCH',
                message: `Referenced snapshot '${snapshotId}' belongs to a previous epoch (${snap.epoch}) and has been invalidated.`
            };
        }
    }

    // Validate referenced batchId against durable issued artifacts in _exchange_batches or _exchange_snapshots
    let batch = null;
    if (batchId) {
        batch = db.prepare('SELECT id, connection_id, start_seq, end_seq, item_count, snapshot_id, auth_version, epoch FROM _exchange_batches WHERE id = ?').get(batchId);
        if (!batch) {
            const snapAsBatch = db.prepare('SELECT id, connection_id, 1 as start_seq, high_water_sequence as end_seq, total_samples as item_count, auth_version, epoch FROM _exchange_snapshots WHERE id = ?').get(batchId);
            if (snapAsBatch) {
                // If referencing a snapshot as batchId, and snapshotId is also provided:
                // They must refer to the SAME snapshot!
                if (snapshotId && batchId !== snapshotId) {
                    return {
                        error: 'BATCH_SNAPSHOT_MISMATCH',
                        status: 400,
                        message: 'Referenced batch snapshot does not belong to specified snapshot.'
                    };
                }
                snapAsBatch.snapshot_id = snapAsBatch.id;
                batch = snapAsBatch;
            }
        }
        if (!batch) {
            return {
                error: 'BATCH_NOT_FOUND',
                status: 404,
                message: `Referenced batch '${batchId}' was not issued or does not exist.`
            };
        }
        if (batch.connection_id !== connectionId) {
            return {
                error: 'FORBIDDEN',
                status: 403,
                message: 'Referenced batch belongs to a different connection.'
            };
        }
        if (snapshotId && (!batch.snapshot_id || batch.snapshot_id !== snapshotId)) {
            return {
                error: 'BATCH_SNAPSHOT_MISMATCH',
                status: 400,
                message: 'Referenced batch does not belong to specified snapshot.'
            };
        }
        if (batch.auth_version !== undefined && batch.auth_version !== null && batch.auth_version !== currentAuthVersion) {
            return {
                error: 'BATCH_EXPIRED',
                status: 410,
                code: 'AUTH_VERSION_MISMATCH',
                message: `Referenced batch '${batchId}' was issued under authorization version ${batch.auth_version}, but current connection authorization version is ${currentAuthVersion}. Receipt rejected.`
            };
        }
        if (batch.epoch && batch.epoch !== currentEpoch) {
            return {
                error: 'BATCH_EXPIRED',
                status: 410,
                code: 'EPOCH_MISMATCH',
                message: `Referenced batch '${batchId}' belongs to a previous epoch (${batch.epoch}) and has been invalidated.`
            };
        }
    }

    // Bounds checking on checkpoint sequence/item against issued artifacts
    if (checkpoint !== undefined && checkpoint !== null && checkpoint !== '') {
        const chkStr = String(checkpoint);
        const mSeq = chkStr.match(/^seq_(\d+)$/);
        if (mSeq) {
            const seqNum = parseInt(mSeq[1], 10);
            if (seqNum < 1) {
                return {
                    error: 'INVALID_CHECKPOINT',
                    status: 400,
                    message: `Checkpoint sequence must be a positive integer, got ${seqNum}.`
                };
            }
            if (batch) {
                if (batch.end_seq !== undefined && batch.end_seq !== null && seqNum > batch.end_seq) {
                    return {
                        error: 'INVALID_CHECKPOINT',
                        status: 400,
                        message: `Checkpoint sequence ${seqNum} exceeds maximum issued sequence (${batch.end_seq}).`
                    };
                }
                if (batch.start_seq !== undefined && batch.start_seq !== null && batch.start_seq > 0 && seqNum < batch.start_seq) {
                    return {
                        error: 'INVALID_CHECKPOINT',
                        status: 400,
                        message: `Checkpoint sequence ${seqNum} is before batch start sequence (${batch.start_seq}).`
                    };
                }
            }
            if (snap && snap.high_water_sequence !== undefined && snap.high_water_sequence !== null) {
                if (seqNum > snap.high_water_sequence) {
                    return {
                        error: 'INVALID_CHECKPOINT',
                        status: 400,
                        message: `Checkpoint sequence ${seqNum} exceeds maximum issued sequence (${snap.high_water_sequence}).`
                    };
                }
            }
            if (!batch && !snap) {
                const maxAllowedSeq = db.prepare('SELECT MAX(sequence) as s FROM _exchange_journal').get()?.s || 0;
                if (seqNum > maxAllowedSeq) {
                    return {
                        error: 'INVALID_CHECKPOINT',
                        status: 400,
                        message: `Checkpoint sequence ${seqNum} exceeds maximum issued sequence (${maxAllowedSeq}).`
                    };
                }
            }
        }
        const mItem = chkStr.match(/^item_(\d+)$/);
        if (mItem) {
            const itemNum = parseInt(mItem[1], 10);
            if (itemNum < 1) {
                return {
                    error: 'INVALID_CHECKPOINT',
                    status: 400,
                    message: `Checkpoint item must be a positive integer, got ${itemNum}.`
                };
            }
            if (snap && snap.total_samples !== undefined) {
                if (snap.total_samples === 0 || itemNum > snap.total_samples) {
                    return {
                        error: 'INVALID_CHECKPOINT',
                        status: 400,
                        message: `Checkpoint item ${itemNum} exceeds total items (${snap.total_samples}).`
                    };
                }
            }
            if (batch && batch.item_count !== undefined) {
                if (batch.item_count === 0 || itemNum > batch.item_count) {
                    return {
                        error: 'INVALID_CHECKPOINT',
                        status: 400,
                        message: `Checkpoint item ${itemNum} exceeds batch item count (${batch.item_count}).`
                    };
                }
            }
        }
    }

    // Bounds checking on counts against issued artifacts
    if (snap && (imported + quarantined > snap.total_samples)) {
        return {
            error: 'INVALID_COUNT',
            status: 400,
            message: `Reported counts (${imported + quarantined}) exceed total snapshot samples (${snap.total_samples}).`
        };
    }
    if (batch && batch.item_count !== undefined && (imported + quarantined > batch.item_count)) {
        return {
            error: 'INVALID_COUNT',
            status: 400,
            message: `Reported counts (${imported + quarantined}) exceed batch item count (${batch.item_count}).`
        };
    }

    // Database-enforced Idempotency within transaction
    try {
        const recordTx = db.transaction(() => {
            let existing = null;
            if (receiptId) {
                existing = db.prepare('SELECT * FROM _exchange_receipts WHERE id = ? AND connection_id = ?').get(receiptId, connectionId);
            } else if (snapshotId && checkpoint) {
                existing = db.prepare('SELECT * FROM _exchange_receipts WHERE connection_id = ? AND snapshot_id = ? AND checkpoint = ?').get(connectionId, snapshotId, String(checkpoint));
            } else if (snapshotId && batchId) {
                existing = db.prepare('SELECT * FROM _exchange_receipts WHERE connection_id = ? AND snapshot_id = ? AND batch_id = ?').get(connectionId, snapshotId, batchId);
            } else if (snapshotId) {
                existing = db.prepare('SELECT * FROM _exchange_receipts WHERE connection_id = ? AND snapshot_id = ?').get(connectionId, snapshotId);
            } else if (batchId) {
                existing = db.prepare('SELECT * FROM _exchange_receipts WHERE connection_id = ? AND batch_id = ?').get(connectionId, batchId);
            }

            if (existing) {
                const countMatch = (existing.imported_count === imported) && (existing.quarantined_count === quarantined);
                const chkMatch = existing.checkpoint === (checkpoint ? String(checkpoint) : null);
                const snapMatch = (existing.snapshot_id || null) === (snapshotId || null);
                const batchMatch = (existing.batch_id || null) === (batchId || null);
                const detailsJson = errors.length > 0 ? JSON.stringify(errors) : null;
                const detailsMatch = (existing.details || null) === detailsJson;
                if (!countMatch || !chkMatch || !snapMatch || !batchMatch || !detailsMatch) {
                    return {
                        error: 'RECEIPT_CONFLICT',
                        status: 409,
                        message: 'Receipt conflict: receipt already exists under this identity with conflicting artifacts, counts, checkpoint, or error details.'
                    };
                }
                return {
                    receiptId: existing.id,
                    connectionId: existing.connection_id,
                    batchId: existing.batch_id || batchId || null,
                    snapshotId: existing.snapshot_id || snapshotId || null,
                    receivedAt: formatStoredUtc(existing.created_at),
                    status: 'ACKNOWLEDGED',
                    idempotent: true,
                    receiverReported: {
                        importedCount: existing.imported_count,
                        quarantinedCount: existing.quarantined_count,
                        checkpoint: existing.checkpoint
                    },
                    verifiedImport: false
                };
            }

            const finalReceiptId = receiptId || `rec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
            const stmt = db.prepare(`
                INSERT INTO _exchange_receipts (
                    id, connection_id, snapshot_id, batch_id, imported_count, quarantined_count,
                    checkpoint, details, created_at, auth_version, epoch
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                finalReceiptId,
                connectionId,
                snapshotId,
                batchId,
                imported,
                quarantined,
                checkpoint ? String(checkpoint) : null,
                errors.length > 0 ? JSON.stringify(errors) : null,
                now,
                currentAuthVersion,
                currentEpoch
            );

            return {
                receiptId: finalReceiptId,
                connectionId,
                batchId: batchId || null,
                snapshotId: snapshotId || null,
                receivedAt: now,
                status: 'ACKNOWLEDGED',
                idempotent: false,
                receiverReported: {
                    importedCount: imported,
                    quarantinedCount: quarantined,
                    checkpoint: checkpoint ? String(checkpoint) : null
                },
                verifiedImport: false
            };
        });

        return recordTx();
    } catch (e) {
        if (e.message && e.message.includes('UNIQUE constraint failed')) {
            let existing = null;
            if (receiptId) {
                existing = db.prepare('SELECT * FROM _exchange_receipts WHERE id = ? AND connection_id = ?').get(receiptId, connectionId);
            } else if (snapshotId && checkpoint) {
                existing = db.prepare('SELECT * FROM _exchange_receipts WHERE connection_id = ? AND snapshot_id = ? AND checkpoint = ?').get(connectionId, snapshotId, String(checkpoint));
            } else if (snapshotId && batchId) {
                existing = db.prepare('SELECT * FROM _exchange_receipts WHERE connection_id = ? AND snapshot_id = ? AND batch_id = ?').get(connectionId, snapshotId, batchId);
            } else if (snapshotId) {
                existing = db.prepare('SELECT * FROM _exchange_receipts WHERE connection_id = ? AND snapshot_id = ?').get(connectionId, snapshotId);
            } else if (batchId) {
                existing = db.prepare('SELECT * FROM _exchange_receipts WHERE connection_id = ? AND batch_id = ?').get(connectionId, batchId);
            }
            if (existing) {
                const countMatch = (existing.imported_count === imported) && (existing.quarantined_count === quarantined);
                const chkMatch = existing.checkpoint === (checkpoint ? String(checkpoint) : null);
                const snapMatch = (existing.snapshot_id || null) === (snapshotId || null);
                const batchMatch = (existing.batch_id || null) === (batchId || null);
                const detailsJson = errors.length > 0 ? JSON.stringify(errors) : null;
                const detailsMatch = (existing.details || null) === detailsJson;
                if (!countMatch || !chkMatch || !snapMatch || !batchMatch || !detailsMatch) {
                    return {
                        error: 'RECEIPT_CONFLICT',
                        status: 409,
                        message: 'Receipt conflict: receipt already exists under this identity with conflicting artifacts, counts, checkpoint, or error details.'
                    };
                }
                return {
                    receiptId: existing.id,
                    connectionId: existing.connection_id,
                    batchId: existing.batch_id || batchId || null,
                    snapshotId: existing.snapshot_id || snapshotId || null,
                    receivedAt: formatStoredUtc(existing.created_at),
                    status: 'ACKNOWLEDGED',
                    idempotent: true,
                    receiverReported: {
                        importedCount: existing.imported_count,
                        quarantinedCount: existing.quarantined_count,
                        checkpoint: existing.checkpoint
                    },
                    verifiedImport: false
                };
            }
        }
        throw e;
    }
}

module.exports = {
    getDb,
    getConnectionId,
    computeSampleContentHash,
    syncJournal,
    createSnapshot,
    getSnapshot,
    getSnapshotPage,
    getChanges,
    recordReceipt,
    encodeCursor,
    decodeCursor,
    registerDbFunctions,
    installSqliteHooks,
    initTables,
    ensureTriggers,
    normalizeSampleDataForHash,
    getCurrentEpoch,
    rotateEpoch,
    getSourceSystemId,
    pruneExpiredSnapshots,
    isSpecimenEligible,
    isProvenanceHeld,
    normalizeFilter,
    buildCanonicalQueryContext,
    formatStoredUtc,
    validateLiveListCursor
};
