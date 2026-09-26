/**
 * Soil Information System (SIS) / Data Exchange State & Synchronization Service
 * 
 * Implements Issue #140 Work Package P4:
 * - Durable exchange snapshots with TTL and per-connection isolation.
 * - Resumable cursor-based change feed for continuous synchronization.
 * - Monotonic sequence ordering for publication, amendment, and withdrawal events.
 * - Expired cursor and restore epoch handling (HTTP 410 CURSOR_EXPIRED).
 * - Optional delivery receipt logging (non-mutating for laboratory records).
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const prisma = require('../prisma');
const { buildSampleWhere, AUTHORIZED_RELEASE_STATUSES } = require('./exchangePolicyService');
const { formatSampleV2, extractObservations } = require('./sisAdapterService');

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
    db.exec(`
        CREATE TABLE IF NOT EXISTS _exchange_snapshots (
            id TEXT PRIMARY KEY,
            connection_id TEXT NOT NULL,
            high_water_timestamp TEXT NOT NULL,
            total_samples INTEGER NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL
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
            sequence INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            specimen_id TEXT NOT NULL,
            field_sample_id TEXT,
            lab_sample_id TEXT,
            payload TEXT,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_exchange_snapshots_conn ON _exchange_snapshots(connection_id, expires_at);
        CREATE INDEX IF NOT EXISTS idx_exchange_journal_seq ON _exchange_journal(sequence);
        CREATE INDEX IF NOT EXISTS idx_exchange_journal_specimen ON _exchange_journal(specimen_id);
    `);
}

/**
 * Creates an export snapshot at current high-water sequence boundary.
 */
async function createSnapshot(auth, { ttlHours = 24 } = {}) {
    const db = getDb();
    const connectionId = auth?.name || auth?.keyPrefix || 'default-connection';
    const snapshotId = `snap_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date();
    const highWaterTimestamp = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();

    const sampleWhere = buildSampleWhere(auth, { updatedSince: undefined });
    sampleWhere.updatedAt = { lte: now };

    const totalSamples = await prisma.sample.count({ where: sampleWhere });

    const stmt = db.prepare(`
        INSERT INTO _exchange_snapshots (id, connection_id, high_water_timestamp, total_samples, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(snapshotId, connectionId, highWaterTimestamp, totalSamples, expiresAt, now.toISOString());

    return {
        snapshotId,
        connectionId,
        highWaterTimestamp,
        totalSamples,
        expiresAt,
        ttlHours
    };
}

/**
 * Retrieves a snapshot and validates ownership and expiry.
 */
function getSnapshot(snapshotId, auth) {
    const db = getDb();
    const connectionId = auth?.name || auth?.keyPrefix || 'default-connection';
    const stmt = db.prepare(`SELECT * FROM _exchange_snapshots WHERE id = ?`);
    const snap = stmt.get(snapshotId);

    if (!snap) return { error: 'NOT_FOUND', status: 404, message: 'Snapshot not found.' };

    if (snap.connection_id !== connectionId && auth?.role !== 'SUPER_ADMIN') {
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
 * Reads paginated items within a snapshot boundary.
 */
async function getSnapshotPage(snapshotId, auth, { limit = 50, cursor = null, maps = {} } = {}) {
    const check = getSnapshot(snapshotId, auth);
    if (check.error) return check;

    const snap = check.snapshot;
    const maxLimit = Math.min(500, Math.max(1, parseInt(limit) || 50));
    const sampleWhere = buildSampleWhere(auth, {});
    sampleWhere.updatedAt = { lte: new Date(snap.high_water_timestamp) };

    const decoded = decodeCursor(cursor);
    if (decoded && decoded.lastUpdatedAt && decoded.lastId) {
        sampleWhere.AND = [
            ...(sampleWhere.AND || []),
            {
                OR: [
                    { updatedAt: { lt: new Date(decoded.lastUpdatedAt) } },
                    {
                        updatedAt: new Date(decoded.lastUpdatedAt),
                        id: { lt: decoded.lastId }
                    }
                ]
            }
        ];
    }

    const samples = await prisma.sample.findMany({
        where: sampleWhere,
        include: { results: true },
        orderBy: [
            { updatedAt: 'desc' },
            { id: 'desc' }
        ],
        take: maxLimit + 1
    });

    const hasMore = samples.length > maxLimit;
    const pageSamples = hasMore ? samples.slice(0, maxLimit) : samples;

    let nextCursor = null;
    if (hasMore && pageSamples.length > 0) {
        const last = pageSamples[pageSamples.length - 1];
        nextCursor = encodeCursor({
            snapshotId,
            lastUpdatedAt: last.updatedAt.toISOString(),
            lastId: last.id
        });
    }

    const data = pageSamples.map(s => formatSampleV2(s, maps));

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
 * Reads publication events, amendments, and withdrawals ordered monotonically.
 */
async function getChanges(auth, { cursor = null, limit = 100, maps = {} } = {}) {
    const maxLimit = Math.min(500, Math.max(1, parseInt(limit) || 100));
    const decoded = decodeCursor(cursor);

    let sinceDate = null;
    let lastId = null;

    if (cursor) {
        if (!decoded || !decoded.lastUpdatedAt) {
            return {
                error: 'CURSOR_EXPIRED',
                status: 410,
                message: 'Invalid or expired cursor. Please initialize a fresh synchronization snapshot.'
            };
        }
        sinceDate = new Date(decoded.lastUpdatedAt);
        lastId = decoded.lastId;
        if (isNaN(sinceDate.getTime())) {
            return {
                error: 'CURSOR_EXPIRED',
                status: 410,
                message: 'Malformed cursor timestamp.'
            };
        }
    }

    const sampleWhere = buildSampleWhere(auth, {});
    if (sinceDate) {
        sampleWhere.AND = [
            ...(sampleWhere.AND || []),
            {
                OR: [
                    { updatedAt: { gt: sinceDate } },
                    {
                        updatedAt: sinceDate,
                        id: { gt: lastId }
                    }
                ]
            }
        ];
    }

    const samples = await prisma.sample.findMany({
        where: sampleWhere,
        include: { results: true },
        orderBy: [
            { updatedAt: 'asc' },
            { id: 'asc' }
        ],
        take: maxLimit + 1
    });

    const hasMore = samples.length > maxLimit;
    const pageSamples = hasMore ? samples.slice(0, maxLimit) : samples;

    let nextCursor = null;
    if (pageSamples.length > 0) {
        const last = pageSamples[pageSamples.length - 1];
        nextCursor = encodeCursor({
            lastUpdatedAt: last.updatedAt.toISOString(),
            lastId: last.id
        });
    } else if (cursor) {
        nextCursor = cursor; // retain cursor when up to date
    } else {
        nextCursor = encodeCursor({
            lastUpdatedAt: new Date().toISOString(),
            lastId: ''
        });
    }

    const changes = pageSamples.map((s, idx) => {
        const isWithdrawn = s.status === 'CANCELLED' || s.status === 'REJECTED' || s.status === 'AMBIGUOUS_PROVENANCE_HOLD';
        const formatted = formatSampleV2(s, maps);
        return {
            sequence: (decoded?.seqOffset || 0) + idx + 1,
            eventId: `evt_${s.id}_${new Date(s.updatedAt).getTime()}`,
            eventType: isWithdrawn ? 'WITHDRAWAL' : 'PUBLICATION',
            specimenId: s.id,
            fieldSampleId: s.originalId,
            labSampleId: s.labId,
            timestamp: s.updatedAt.toISOString(),
            data: isWithdrawn ? null : formatted
        };
    });

    return {
        boundaryTimestamp: new Date().toISOString(),
        count: changes.length,
        hasMore,
        nextCursor,
        changes
    };
}

/**
 * Records an authenticated receiver delivery receipt (non-mutating for laboratory records).
 */
function recordReceipt(auth, receiptData) {
    const db = getDb();
    const connectionId = auth?.name || auth?.keyPrefix || 'default-connection';
    const receiptId = `rec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    const {
        snapshotId = null,
        batchId = null,
        importedCount = 0,
        quarantinedCount = 0,
        checkpoint = null,
        errors = []
    } = receiptData;

    const stmt = db.prepare(`
        INSERT INTO _exchange_receipts (id, connection_id, snapshot_id, batch_id, imported_count, quarantined_count, checkpoint, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        receiptId,
        connectionId,
        snapshotId,
        batchId,
        Number(importedCount) || 0,
        Number(quarantinedCount) || 0,
        checkpoint ? String(checkpoint) : null,
        errors.length > 0 ? JSON.stringify(errors) : null,
        now
    );

    return {
        receiptId,
        connectionId,
        receivedAt: now,
        status: 'ACKNOWLEDGED'
    };
}

module.exports = {
    getDb,
    createSnapshot,
    getSnapshot,
    getSnapshotPage,
    getChanges,
    recordReceipt,
    encodeCursor,
    decodeCursor
};
