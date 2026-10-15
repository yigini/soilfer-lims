const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const contexts = new WeakSet();
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

// Full main/WAL hashes bind a cached SQL check to the bytes SQLite read. SHM is
// an index/lock file, not SQL data. The policy owner's separate three-file copy
// and race guards still hash and compare SHM as well.
function dataHashes(target) {
    return ['', '-wal'].map(suffix => {
        if (!fs.existsSync(target + suffix)) return null;
        const hash = createHash('sha256'), buffer = Buffer.allocUnsafe(1024 * 1024);
        const fd = fs.openSync(target + suffix, 'r');
        try {
            let length;
            while ((length = fs.readSync(fd, buffer, 0, buffer.length, null))) hash.update(buffer.subarray(0, length));
        } finally { fs.closeSync(fd); }
        return hash.digest('hex');
    });
}
function optionalDataHashes(target) {
    // A failed cache binding never creates a new refusal: use the real SQL
    // checks again. The owning installers retain their existing error paths.
    try { return dataHashes(target); } catch { return null; }
}

function createStartupReadinessContext() {
    let original, connection, facade, activePath, closed = false;
    let checks = new Map(), checkedVersion = null, firstReadVersion = null;
    let policy, chart, policyCopyHashes;
    const retainedSnapshots = new Set();

    function releaseReader() {
        if (!connection) return;
        try { if (connection.inTransaction) connection.exec('ROLLBACK'); }
        finally { connection.close(); connection = facade = null; }
    }
    const context = {
        open(Database, target, options) {
            if (closed) throw new TypeError('The startup readiness context is closed.');
            const resolved = path.resolve(target);
            if (!original) original = resolved;
            if (resolved !== original && !retainedSnapshots.has(resolved) && resolved !== activePath)
                throw new TypeError('A startup context belongs to one database and its retained snapshot.');
            if (connection && resolved !== original && resolved !== activePath) {
                releaseReader();
                const version = optionalDataHashes(resolved);
                if (!checkedVersion || !same(checkedVersion, version)) checks = new Map();
                firstReadVersion = version;
                checkedVersion = checks.size ? version : null;
            }
            if (connection) return facade;
            activePath = resolved;
            connection = new Database(resolved, options);
            connection.exec('BEGIN');
            const reader = connection;
            facade = new Proxy(reader, {
                get(db, key) {
                    // Existing installer finally blocks release their lease;
                    // the startup owner closes the one private read transaction.
                    if (key === 'close') return () => {};
                    if (key === 'pragma') return (sql, pragmaOptions) => {
                        const name = sql.trim().toLowerCase();
                        // This private facade accepts only the two startup
                        // checks. SQL stays literal and visible to the scanner.
                        if (name !== 'integrity_check' && name !== 'foreign_key_check')
                            throw new TypeError('The startup context supports only integrity and foreign-key checks.');
                        if (!checks.has(name)) checks.set(name, name === 'integrity_check'
                            ? db.pragma('integrity_check') : db.pragma('foreign_key_check'));
                        // Preserve the owners' full-row and simple result views.
                        if (name === 'foreign_key_check' && !checkedVersion) {
                            const after = optionalDataHashes(activePath);
                            if (firstReadVersion && same(firstReadVersion, after)) checkedVersion = after;
                        }
                        const rows = checks.get(name);
                        return structuredClone(pragmaOptions?.simple ? (rows.length ? Object.values(rows[0])[0] : undefined) : rows);
                    };
                    if (key === 'prepare' && !firstReadVersion)
                        firstReadVersion = optionalDataHashes(activePath);
                    // Prepared statements use the ordinary bound method. Their
                    // SQL remains visible at each owning installer call site.
                    const value = Reflect.get(db, key, db);
                    return typeof value === 'function' ? value.bind(db) : value;
                }
            });
            return facade;
        },
        beforeSnapshot() {
            releaseReader();
        },
        useSnapshot(copy, originalHashes) {
            const version = ['', '-wal'].map(suffix => originalHashes[suffix]);
            if (!checkedVersion || !same(checkedVersion, version)) checks = new Map();
            activePath = copy;
            firstReadVersion = version;
            checkedVersion = checks.size ? version : null;
        },
        reviewPolicy(target, source, hashes, review, snapshotHashes) {
            const resolved = path.resolve(target);
            if (!original) original = resolved;
            let copyUnchanged = false;
            if (policy && policy.sourceSha256 === source.sha256) {
                copyUnchanged = same(policyCopyHashes, resolved === policy.readonlySnapshot.path
                    ? hashes : snapshotHashes(policy.readonlySnapshot.path));
                if (resolved === policy.readonlySnapshot.path && copyUnchanged) {
                    // A nested owner is reviewing the already pinned copy.
                    // Validate that copy and the source, without refreshing
                    // from the original midway through the outer order check.
                    const pinned = structuredClone(policy);
                    pinned.readonlySnapshot.originalDbWalShmSha256 = structuredClone(hashes);
                    return pinned;
                }
                if (resolved === original && copyUnchanged && same(policy.readonlySnapshot.originalDbWalShmSha256, hashes))
                    return structuredClone(policy);
            }
            // Changed source/copy bytes use the unchanged full owner review.
            // Its copy and race guards still decide the existing refusal.
            releaseReader();
            if (policy && !copyUnchanged) {
                checks.clear(); checkedVersion = firstReadVersion = null;
            }
            policy = chart = null;
            policyCopyHashes = null;
            policy = review();
            retainedSnapshots.add(policy.readonlySnapshot.path);
            policyCopyHashes = snapshotHashes(policy.readonlySnapshot.path);
            return structuredClone(policy);
        },
        reviewChart(source, review) {
            const key = [activePath, source.sha256];
            if (!chart || !same(chart.key, key)) chart = { key, result: review() };
            return structuredClone(chart.result);
        },
        close() {
            try { releaseReader(); }
            finally { closed = true; checks.clear(); retainedSnapshots.clear(); policy = chart = policyCopyHashes = null; }
        }
    };
    contexts.add(context);
    return context;
}

function openReadonlyDatabase(Database, target, options, startupContext) {
    if (!startupContext) return new Database(target, options);
    if (!contexts.has(startupContext)) throw new TypeError('Use an explicit startup readiness context.');
    return startupContext.open(Database, target, options);
}

module.exports = { createStartupReadinessContext, openReadonlyDatabase };
