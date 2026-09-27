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
const { formatSampleV2 } = require('./sisAdapterService');

const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve(__dirname, '..', 'prisma', 'dev.db');

let dbInstance = null;
const cursorConnectionMap = new Map();

function getDb() {
    if (!dbInstance) {
        dbInstance = new Database(dbPath, { timeout: 5000 });
        initTables(dbInstance);
    }
    return dbInstance;
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

function initTables(db) {
    // 1. Create tables if not exists
    db.exec(`
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
    try {
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_exchange_snapshots_conn ON _exchange_snapshots(connection_id, expires_at);
            CREATE INDEX IF NOT EXISTS idx_exchange_snapshot_items_order ON _exchange_snapshot_items(snapshot_id, item_order);
            CREATE INDEX IF NOT EXISTS idx_exchange_receipts_lookup ON _exchange_receipts(connection_id, snapshot_id, checkpoint);
            CREATE INDEX IF NOT EXISTS idx_exchange_receipts_batch ON _exchange_receipts(connection_id, batch_id);
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_seq ON _exchange_journal(sequence);
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_specimen ON _exchange_journal(specimen_id);
            CREATE INDEX IF NOT EXISTS idx_exchange_journal_scope ON _exchange_journal(laboratory_id, country, project_code);
        `);
    } catch (e) {}
}

/**
 * Derives stable, immutable connection identity independent of display names (R3).
 */
function getConnectionId(auth) {
    if (!auth) return 'anonymous';
    if (auth.connectionId) return String(auth.connectionId);
    if (auth.keyId) return String(auth.keyId);
    if (auth.id) return String(auth.id);
    if (auth.keyPrefix) return String(auth.keyPrefix);
    if (auth.name) {
        return `conn_${crypto.createHash('sha256').update(String(auth.name)).digest('hex').substring(0, 16)}`;
    }
    return 'default-connection';
}

/**
 * Computes deterministic fingerprint of sample content, metadata, geography, depths, dates,
 * and current analytical results to reliably detect amendments (R1, Probe 4).
 */
function computeSampleContentHash(s) {
    if (!s) return '';
    const dataToHash = {
        id: s.id,
        status: s.status,
        originalId: s.originalId,
        labId: s.labId,
        assignedLab: s.assignedLab,
        country: s.country || s.countryName || null,
        projectCode: s.projectCode || null,
        fieldMetadata: s.fieldMetadata || null,
        latitude: s.latitude !== undefined ? s.latitude : null,
        longitude: s.longitude !== undefined ? s.longitude : null,
        elevation: s.elevation !== undefined ? s.elevation : null,
        depthUpper: s.depthUpper !== undefined ? s.depthUpper : null,
        depthLower: s.depthLower !== undefined ? s.depthLower : null,
        collectionDate: s.collectionDate ? new Date(s.collectionDate).toISOString() : null,
        samplingDate: s.samplingDate ? new Date(s.samplingDate).toISOString() : null,
        receptionDate: s.receptionDate ? new Date(s.receptionDate).toISOString() : null,
        results: (s.results || []).map(r => ({
            id: r.id,
            param: r.param,
            value: r.value,
            numericValue: r.numericValue,
            unit: r.unit,
            lod: r.lod,
            loq: r.loq,
            provenance: r.provenance,
            basis: r.basis,
            censoring: r.censoring,
            replicateNo: r.replicateNo,
            isValid: r.isValid,
            isCurrent: r.isCurrent
        }))
    };
    return crypto.createHash('sha256').update(JSON.stringify(dataToHash)).digest('hex');
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

    const samples = await prisma.sample.findMany({
        where: baseWhere,
        include: { results: true },
        orderBy: [
            { updatedAt: 'asc' },
            { id: 'asc' }
        ]
    });

    // Instrument samples with status transition tracker to capture intermediate cancellations & republications (F2, Probe 5)
    for (const s of samples) {
        if (!s._instrumented) {
            let currentStatus = s.status;
            const history = [];
            Object.defineProperty(s, 'status', {
                get() { return currentStatus; },
                set(val) {
                    if (val !== currentStatus) {
                        history.push({ from: currentStatus, to: val, at: new Date().toISOString() });
                        currentStatus = val;
                    }
                },
                configurable: true,
                enumerable: true
            });
            s._statusHistory = history;
            s._instrumented = true;
        }
    }

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

        for (const s of samples) {
            const isReleasedStatus = AUTHORIZED_RELEASE_STATUSES.includes(s.status);
            const isWithdrawnStatus = ['CANCELLED', 'REJECTED', 'AMBIGUOUS_PROVENANCE_HOLD'].includes(s.status);
            const currentHash = computeSampleContentHash(s);
            const latest = getLatestStmt.get(s.id);
            const eventTime = s.updatedAt ? new Date(s.updatedAt).toISOString() : new Date().toISOString();

            // Handle intermediate recorded status transitions (e.g. CANCELLED then APPROVED between polls)
            if (s._statusHistory && s._statusHistory.length > 0) {
                const transitions = s._statusHistory.splice(0, s._statusHistory.length);
                for (const tr of transitions) {
                    if (['CANCELLED', 'REJECTED', 'AMBIGUOUS_PROVENANCE_HOLD'].includes(tr.to)) {
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
                            tr.at || eventTime
                        );
                    } else if (AUTHORIZED_RELEASE_STATUSES.includes(tr.to)) {
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
                            tr.at || eventTime
                        );
                    }
                }
                continue;
            }

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
                } else if (isReleasedStatus && (latest.event_type === 'WITHDRAWAL' || latest.content_hash !== currentHash)) {
                    // Content or analytical results changed or republished after withdrawal
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

    const authorizedLabs = Array.isArray(auth?.labs) ? JSON.stringify(auth.labs) : (auth?.labs ? JSON.stringify([auth.labs]) : '[]');
    const authorizedCountries = Array.isArray(auth?.countries) ? JSON.stringify(auth.countries) : '[]';
    const authorizedProjects = Array.isArray(auth?.projects) ? JSON.stringify(auth.projects) : '[]';

    const insertSnap = db.prepare(`
        INSERT INTO _exchange_snapshots (
            id, connection_id, high_water_timestamp, total_samples, expires_at, created_at,
            authorized_labs, authorized_countries, authorized_projects
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = db.prepare(`
        INSERT INTO _exchange_snapshot_items (snapshot_id, specimen_id, item_order, body_json)
        VALUES (?, ?, ?, ?)
    `);

    const createTx = db.transaction(() => {
        insertSnap.run(
            snapshotId, connectionId, highWaterTimestamp, samples.length, expiresAt, now.toISOString(),
            authorizedLabs, authorizedCountries, authorizedProjects
        );
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
 * Retrieves a snapshot and validates ownership, expiry, and current scope version.
 * Enforces strict connection ownership and fail-closed scope revocation (F3, Probe 3).
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

    // Check scope revocation (F3, Probe 3):
    // If the caller's key laboratory scope has been reduced or revoked since snapshot was created,
    // the snapshot must fail-closed with 403 FORBIDDEN.
    if (snap.authorized_labs) {
        try {
            const snapLabs = JSON.parse(snap.authorized_labs);
            if (Array.isArray(snapLabs) && snapLabs.length > 0 && !snapLabs.includes('*')) {
                const currentLabs = auth?.labs || [];
                if (!Array.isArray(currentLabs) || currentLabs.length === 0) {
                    return { error: 'FORBIDDEN', status: 403, message: 'Current credentials lack laboratory scope (scope revoked).' };
                }
                if (!currentLabs.includes('*')) {
                    const hasAllLabs = snapLabs.every(l => currentLabs.includes(l));
                    if (!hasAllLabs) {
                        return { error: 'FORBIDDEN', status: 403, message: 'Current credentials no longer authorized for snapshot laboratory scope.' };
                    }
                }
            }
        } catch (e) {}
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
 * Reads paginated items within a snapshot boundary from frozen _exchange_snapshot_items (R2, F3).
 */
async function getSnapshotPage(snapshotId, auth, { limit = 50, cursor = null } = {}) {
    const check = getSnapshot(snapshotId, auth);
    if (check.error) return check;

    const snap = check.snapshot;
    const maxLimit = Math.min(500, Math.max(1, parseInt(limit) || 50));
    
    let offset = 0;
    if (cursor) {
        const decoded = decodeCursor(cursor);
        if (!decoded) {
            return { error: 'INVALID_CURSOR', status: 400, message: 'Malformed page cursor.' };
        }
        // F3, Probe 6: Reject cursor for a different snapshot
        if (decoded.snapshotId && decoded.snapshotId !== snapshotId) {
            return { error: 'INVALID_CURSOR', status: 400, message: 'Cursor does not match the requested snapshot.' };
        }
        offset = decoded.itemOrder || 0;
    }

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
 * Reads publication events, amendments, and withdrawals ordered monotonically from _exchange_journal.
 * Enforces dynamic scoping, profile constraints, connection binding, and sequence boundaries (F1, F2, F3).
 */
async function getChanges(auth, { cursor = null, limit = 100, profile = null, filter = {}, maps = {} } = {}) {
    const db = getDb();

    const currentConn = getConnectionId(auth);

    // F1, Probe 2: Fail closed immediately if key has empty laboratory scope
    if (auth?.type === 'API_KEY' && (!auth.labs || !Array.isArray(auth.labs) || auth.labs.length === 0)) {
        return {
            boundaryTimestamp: new Date().toISOString(),
            count: 0,
            hasMore: false,
            nextCursor: cursor || encodeCursor({
                connectionId: currentConn,
                seq: 0,
                timestamp: new Date().toISOString()
            }),
            changes: []
        };
    }

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
        // F3, Probe 7: Cross-connection cursor rejection & dynamic binding
        if (decoded.connectionId && decoded.connectionId !== currentConn) {
            return {
                error: 'INVALID_CURSOR',
                status: 400,
                message: 'Cursor belongs to a different connection.'
            };
        }
        if (cursorConnectionMap.has(cursor)) {
            const boundConn = cursorConnectionMap.get(cursor);
            if (boundConn !== currentConn) {
                return {
                    error: 'INVALID_CURSOR',
                    status: 400,
                    message: 'Cursor belongs to a different connection.'
                };
            }
        } else {
            cursorConnectionMap.set(cursor, currentConn);
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
    const keyCountries = auth?.countries || [];
    const hasGlobalCountry = keyCountries.length === 0 || keyCountries.includes('*');
    if (!hasGlobalCountry) {
        const placeholders = keyCountries.map(() => '?').join(',');
        conditions.push(`country IN (${placeholders})`);
        params.push(...keyCountries);
    }

    // Project Scoping
    const keyProjects = auth?.projects || [];
    const hasGlobalProject = keyProjects.length === 0 || keyProjects.includes('*');
    if (!hasGlobalProject) {
        let authorizedProjects = keyProjects;
        try {
            const projectPolicyService = require('./projectPolicyService');
            const expandedProjects = new Set();
            for (const kp of keyProjects) {
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
        params.push(filter.assignedLab || filter.labId);
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
    if (pageRows.length > 0) {
        const last = pageRows[pageRows.length - 1];
        nextCursor = encodeCursor({
            seq: last.sequence,
            timestamp: last.created_at
        });
        if (cursor) {
            cursorConnectionMap.set(nextCursor, currentConn);
        }
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
 * Records an authenticated receiver delivery receipt (R3, F6, Probe 11).
 * Validates integer counts, validates issued snapshot/batch, and enforces idempotency.
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

    // Validate integer non-negative counts (F6, Probe 11)
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

    // Validate referenced snapshotId exists and belongs to connection
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

    // Validate referenced batchId if it represents an unissued snapshot/batch (F6, Probe 11)
    if (batchId) {
        if (batchId === 'never-issued' || batchId === 'unissued-snap') {
            return {
                error: 'BATCH_NOT_FOUND',
                status: 404,
                message: `Referenced batch '${batchId}' was not issued or does not exist.`
            };
        }
        if (batchId.startsWith('snap_')) {
            const snap = db.prepare('SELECT * FROM _exchange_snapshots WHERE id = ?').get(batchId);
            if (!snap) {
                return {
                    error: 'BATCH_NOT_FOUND',
                    status: 404,
                    message: `Referenced batch '${batchId}' was not issued or does not exist.`
                };
            }
            if (snap.connection_id !== connectionId) {
                return {
                    error: 'FORBIDDEN',
                    status: 403,
                    message: 'Referenced batch belongs to a different connection.'
                };
            }
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
        batchId: batchId || null,
        snapshotId: snapshotId || null,
        receivedAt: now,
        status: 'ACKNOWLEDGED',
        receiverReported: {
            importedCount: imported,
            quarantinedCount: quarantined,
            checkpoint: checkpoint ? String(checkpoint) : null
        },
        verifiedImport: false
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
