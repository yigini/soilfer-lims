/**
 * Soil Information System (SIS) / Data Exchange State & Synchronization Service
 * 
 * Implements Issue #140 Work Package P4 (Codex Remediation R1, R2, R3):
 * - Durable, frozen exchange snapshots stored in _exchange_snapshot_items.
 * - Append-only monotonic change journal in _exchange_journal.
 * - Continuous change feed with publications, amendments, and withdrawals.
 * - Strict credential/connection identity isolation (no role bypass).
 * - Validated, idempotent receiver delivery receipts.
 * - Resumable cursor-based pagination with bounds and validation.
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const prisma = require('../prisma');
const { buildSampleWhere, AUTHORIZED_RELEASE_STATUSES } = require('./exchangePolicyService');
const { formatSampleV2 } = require('./sisAdapterService');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve(__dirname, '..', 'prisma', 'dev.db');

let dbInstance = null;

function getDb() {
    if (!dbInstance) {
        dbInstance = new Database(dbPath, { timeout: 5000 });
        initTables(dbInstance);
    }
    return dbInstance;
}

function initTables(db) {
    try {
        const itemInfo = db.prepare("PRAGMA table_info(_exchange_snapshot_items)").all();
        const itemCols = new Set(itemInfo.map(c => c.name));
        if (itemCols.size > 0 && !itemCols.has('item_order')) {
            db.exec("DROP TABLE IF EXISTS _exchange_snapshot_items");
        }
    } catch (e) {}

    try {
        const journalInfo = db.prepare("PRAGMA table_info(_exchange_journal)").all();
        const journalCols = new Set(journalInfo.map(c => c.name));
        if (journalCols.size > 0 && !journalCols.has('content_hash')) {
            db.exec("DROP TABLE IF EXISTS _exchange_journal");
        }
    } catch (e) {}

    try {
        const snapInfo = db.prepare("PRAGMA table_info(_exchange_snapshots)").all();
        const snapCols = new Set(snapInfo.map(c => c.name));
        if (snapCols.size > 0 && !snapCols.has('high_water_timestamp')) {
            db.exec("DROP TABLE IF EXISTS _exchange_snapshots");
        }
    } catch (e) {}

    try {
        const receiptInfo = db.prepare("PRAGMA table_info(_exchange_receipts)").all();
        const receiptCols = new Set(receiptInfo.map(c => c.name));
        if (receiptCols.size > 0 && !receiptCols.has('checkpoint')) {
            db.exec("DROP TABLE IF EXISTS _exchange_receipts");
        }
    } catch (e) {}

    db.exec(`
        CREATE TABLE IF NOT EXISTS _exchange_snapshots (
            id TEXT PRIMARY KEY,
            connection_id TEXT NOT NULL,
            high_water_timestamp TEXT NOT NULL,
            total_samples INTEGER NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL
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

        CREATE INDEX IF NOT EXISTS idx_exchange_snapshots_conn ON _exchange_snapshots(connection_id, expires_at);
        CREATE INDEX IF NOT EXISTS idx_exchange_snapshot_items_order ON _exchange_snapshot_items(snapshot_id, item_order);
        CREATE INDEX IF NOT EXISTS idx_exchange_receipts_lookup ON _exchange_receipts(connection_id, snapshot_id, checkpoint);
        CREATE INDEX IF NOT EXISTS idx_exchange_receipts_batch ON _exchange_receipts(connection_id, batch_id);
        CREATE INDEX IF NOT EXISTS idx_exchange_journal_seq ON _exchange_journal(sequence);
        CREATE INDEX IF NOT EXISTS idx_exchange_journal_specimen ON _exchange_journal(specimen_id);
    `);
}

/**
 * Derives stable, immutable connection identity independent of display names (R3).
 */
function getConnectionId(auth) {
    if (!auth) return 'anonymous';
    if (auth.keyId) return String(auth.keyId);
    if (auth.id) return String(auth.id);
    if (auth.keyPrefix) return String(auth.keyPrefix);
    if (auth.name) {
        return `conn_${crypto.createHash('sha256').update(String(auth.name)).digest('hex').substring(0, 16)}`;
    }
    return 'default-connection';
}

/**
 * Computes deterministic fingerprint of sample content and current analytical results
 * to reliably detect result-only amendments (R1, Probe 6).
 */
function computeSampleContentHash(s) {
    const dataToHash = {
        id: s.id,
        status: s.status,
        originalId: s.originalId,
        labId: s.labId,
        assignedLab: s.assignedLab,
        country: s.country || s.countryName,
        projectCode: s.projectCode,
        results: (s.results || []).map(r => ({
            id: r.id,
            param: r.param,
            value: r.value,
            numericValue: r.numericValue,
            unit: r.unit,
            lod: r.lod,
            loq: r.loq,
            provenance: r.provenance,
            isCurrent: r.isCurrent
        }))
    };
    return crypto.createHash('sha256').update(JSON.stringify(dataToHash)).digest('hex');
}

/**
 * Synchronizes the append-only monotonic journal (_exchange_journal) with sample state.
 * Emits PUBLICATION, AMENDMENT, and WITHDRAWAL events with strictly monotonic sequence numbers (R1, R2).
 */
async function syncJournal(auth, maps = {}) {
    const db = getDb();

    // Query samples accessible to this connection across all statuses to track cancellations & holds
    const baseWhere = buildSampleWhere(auth, { status: '*' });
    delete baseWhere.status;

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

    let currentMaxSeq = (getMaxSeqStmt.get()?.maxSeq || 0);

    const syncTx = db.transaction(() => {
        for (const s of samples) {
            const isReleasedStatus = AUTHORIZED_RELEASE_STATUSES.includes(s.status);
            const isWithdrawnStatus = ['CANCELLED', 'REJECTED', 'AMBIGUOUS_PROVENANCE_HOLD'].includes(s.status);
            const currentHash = computeSampleContentHash(s);
            const latest = getLatestStmt.get(s.id);
            const eventTime = s.updatedAt ? new Date(s.updatedAt).toISOString() : new Date().toISOString();

            if (!latest) {
                // If never previously journaled and currently in released status: PUBLICATION
                if (isReleasedStatus) {
                    currentMaxSeq++;
                    const evtId = `evt_${s.id}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
                    const formatted = formatSampleV2(s, maps);
                    insertJournalStmt.run(
                        evtId,
                        currentMaxSeq,
                        'PUBLICATION',
                        s.id,
                        s.originalId,
                        s.labId,
                        s.country || s.countryName || null,
                        s.projectCode || null,
                        s.assignedLab || null,
                        currentHash,
                        JSON.stringify(formatted),
                        eventTime
                    );
                }
            } else {
                // Was previously journaled
                if (latest.event_type !== 'WITHDRAWAL' && isWithdrawnStatus) {
                    // Status changed to cancelled/held/rejected: WITHDRAWAL
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
                        currentHash,
                        null,
                        eventTime
                    );
                } else if (isReleasedStatus && latest.content_hash !== currentHash) {
                    // Content or analytical results changed: AMENDMENT
                    currentMaxSeq++;
                    const eventType = (latest.event_type === 'WITHDRAWAL') ? 'PUBLICATION' : 'AMENDMENT';
                    const evtId = `evt_${s.id}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
                    const formatted = formatSampleV2(s, maps);
                    insertJournalStmt.run(
                        evtId,
                        currentMaxSeq,
                        eventType,
                        s.id,
                        s.originalId,
                        s.labId,
                        s.country || s.countryName || null,
                        s.projectCode || null,
                        s.assignedLab || null,
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
 * Creates an immutable export snapshot at current high-water sequence boundary.
 * Freezes item JSON in _exchange_snapshot_items so subsequent sample edits do not mutate the snapshot (R2, Probes 1 & 2).
 */
async function createSnapshot(auth, { ttlHours = 24, profile = null, filter = {}, maps = {} } = {}) {
    const db = getDb();
    const connectionId = getConnectionId(auth);
    const snapshotId = `snap_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date();
    const highWaterTimestamp = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();

    const sampleWhere = buildSampleWhere(auth, { ...filter, profile });
    sampleWhere.updatedAt = { lte: now };

    const samples = await prisma.sample.findMany({
        where: sampleWhere,
        include: { results: true },
        orderBy: [
            { updatedAt: 'desc' },
            { id: 'desc' }
        ]
    });

    const insertSnap = db.prepare(`
        INSERT INTO _exchange_snapshots (id, connection_id, high_water_timestamp, total_samples, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertItem = db.prepare(`
        INSERT INTO _exchange_snapshot_items (snapshot_id, specimen_id, item_order, body_json)
        VALUES (?, ?, ?, ?)
    `);

    const createTx = db.transaction(() => {
        insertSnap.run(snapshotId, connectionId, highWaterTimestamp, samples.length, expiresAt, now.toISOString());
        for (let i = 0; i < samples.length; i++) {
            const s = samples[i];
            const formatted = formatSampleV2(s, maps);
            insertItem.run(snapshotId, s.id, i + 1, JSON.stringify(formatted));
        }
    });

    createTx();

    return {
        snapshotId,
        connectionId,
        highWaterTimestamp,
        totalSamples: samples.length,
        expiresAt,
        ttlHours
    };
}

/**
 * Retrieves a snapshot and validates ownership and expiry.
 * Enforces strict connection ownership without role bypass (R3, Probe 3).
 */
function getSnapshot(snapshotId, auth) {
    const db = getDb();
    const connectionId = getConnectionId(auth);
    const stmt = db.prepare(`SELECT * FROM _exchange_snapshots WHERE id = ?`);
    const snap = stmt.get(snapshotId);

    if (!snap) return { error: 'NOT_FOUND', status: 404, message: 'Snapshot not found.' };

    if (snap.connection_id !== connectionId) {
        return { error: 'FORBIDDEN', status: 403, message: 'Snapshot belongs to a different connection.' };
    }

    if (new Date(snap.expires_at) < new Date()) {
        return { error: 'SNAPSHOT_EXPIRED', status: 410, message: 'Snapshot has expired. Create a new snapshot.' };
    }

    return { snapshot: snap };
}

/**
 * Encodes an opaque cursor for change feed or paginated queries.
 */
function encodeCursor(data) {
    return Buffer.from(JSON.stringify({ v: 2, ...data })).toString('base64');
}

/**
 * Decodes and validates an opaque cursor.
 */
function decodeCursor(cursorStr) {
    if (!cursorStr) return null;
    try {
        const decoded = JSON.parse(Buffer.from(cursorStr, 'base64').toString('utf8'));
        if (decoded && decoded.v === 2) return decoded;
        return null;
    } catch (e) {
        return null;
    }
}

/**
 * Reads paginated items within a snapshot boundary from frozen _exchange_snapshot_items (R2).
 */
async function getSnapshotPage(snapshotId, auth, { limit = 50, cursor = null } = {}) {
    const check = getSnapshot(snapshotId, auth);
    if (check.error) return check;

    const snap = check.snapshot;
    const maxLimit = Math.min(500, Math.max(1, parseInt(limit) || 50));
    const decoded = decodeCursor(cursor);
    const offset = decoded?.itemOrder || 0;

    const db = getDb();
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
            snapshotId,
            itemOrder: last.item_order
        });
    }

    const data = pageRows.map(r => JSON.parse(r.body_json));

    return {
        snapshotId,
        highWaterTimestamp: snap.high_water_timestamp,
        count: data.length,
        hasMore,
        nextCursor,
        data
    };
}

/**
 * Change feed reader (continuous synchronization).
 * Reads publication events, amendments, and withdrawals ordered monotonically from _exchange_journal (R1).
 */
async function getChanges(auth, { cursor = null, limit = 100, maps = {} } = {}) {
    const db = getDb();
    await syncJournal(auth, maps);

    const maxLimit = Math.min(500, Math.max(1, parseInt(limit) || 100));
    const decoded = decodeCursor(cursor);

    let startSeq = 0;
    if (cursor) {
        if (!decoded) {
            return {
                error: 'CURSOR_EXPIRED',
                status: 410,
                message: 'Invalid or expired cursor. Please initialize a fresh synchronization snapshot.'
            };
        }
        if (decoded.seq !== undefined && !isNaN(Number(decoded.seq))) {
            startSeq = Number(decoded.seq);
        } else if (decoded.lastUpdatedAt) {
            const row = db.prepare(`SELECT MAX(sequence) as s FROM _exchange_journal WHERE created_at <= ?`).get(decoded.lastUpdatedAt);
            startSeq = row?.s || 0;
        } else {
            return {
                error: 'CURSOR_EXPIRED',
                status: 410,
                message: 'Malformed cursor.'
            };
        }
    }

    const rows = db.prepare(`
        SELECT id, sequence, event_type, specimen_id, field_sample_id, lab_sample_id,
               country, project_code, laboratory_id, payload, created_at
        FROM _exchange_journal
        WHERE sequence > ?
        ORDER BY sequence ASC
        LIMIT ?
    `).all(startSeq, maxLimit + 1);

    const hasMore = rows.length > maxLimit;
    const pageRows = hasMore ? rows.slice(0, maxLimit) : rows;

    let nextCursor = null;
    if (pageRows.length > 0) {
        const last = pageRows[pageRows.length - 1];
        nextCursor = encodeCursor({
            seq: last.sequence,
            timestamp: last.created_at
        });
    } else if (cursor) {
        nextCursor = cursor;
    } else {
        nextCursor = encodeCursor({
            seq: 0,
            timestamp: new Date().toISOString()
        });
    }

    const changes = pageRows.map(r => ({
        sequence: r.sequence,
        eventId: r.id,
        eventType: r.event_type,
        specimenId: r.specimen_id,
        fieldSampleId: r.field_sample_id,
        labSampleId: r.lab_sample_id,
        timestamp: r.created_at,
        data: r.payload ? JSON.parse(r.payload) : null
    }));

    return {
        boundaryTimestamp: new Date().toISOString(),
        count: changes.length,
        hasMore,
        nextCursor,
        changes
    };
}

/**
 * Records an authenticated receiver delivery receipt (R3, Probe 8).
 * Validates non-negative counts, validates referenced snapshotId, and enforces idempotency.
 */
function recordReceipt(auth, receiptData = {}) {
    const db = getDb();
    const connectionId = getConnectionId(auth);
    const now = new Date().toISOString();

    const {
        receiptId = null,
        snapshotId = null,
        batchId = null,
        importedCount = 0,
        quarantinedCount = 0,
        checkpoint = null,
        errors = []
    } = receiptData;

    const imported = Number(importedCount);
    const quarantined = Number(quarantinedCount);

    // Validate counts (R3, Probe 8)
    if (isNaN(imported) || imported < 0 || isNaN(quarantined) || quarantined < 0) {
        return {
            error: 'INVALID_COUNT',
            status: 400,
            message: 'importedCount and quarantinedCount must be non-negative integers.'
        };
    }

    // Validate referenced snapshotId exists and belongs to connection (R3, Probe 8)
    if (snapshotId) {
        const snap = db.prepare('SELECT * FROM _exchange_snapshots WHERE id = ?').get(snapshotId);
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
    }

    // Idempotency check: if receipt for this connection & snapshotId & checkpoint (or batchId, or client receiptId) exists
    let existing = null;
    if (receiptId) {
        existing = db.prepare('SELECT * FROM _exchange_receipts WHERE id = ? AND connection_id = ?').get(receiptId, connectionId);
    } else if (snapshotId && checkpoint) {
        existing = db.prepare('SELECT * FROM _exchange_receipts WHERE connection_id = ? AND snapshot_id = ? AND checkpoint = ?').get(connectionId, snapshotId, String(checkpoint));
    } else if (batchId) {
        existing = db.prepare('SELECT * FROM _exchange_receipts WHERE connection_id = ? AND batch_id = ?').get(connectionId, batchId);
    }

    if (existing) {
        return {
            receiptId: existing.id,
            connectionId: existing.connection_id,
            receivedAt: existing.created_at,
            status: 'ACKNOWLEDGED',
            idempotent: true
        };
    }

    const finalReceiptId = receiptId || `rec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const stmt = db.prepare(`
        INSERT INTO _exchange_receipts (id, connection_id, snapshot_id, batch_id, imported_count, quarantined_count, checkpoint, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        now
    );

    return {
        receiptId: finalReceiptId,
        connectionId,
        receivedAt: now,
        status: 'ACKNOWLEDGED'
    };
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
    decodeCursor
};
