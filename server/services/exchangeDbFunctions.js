/**
 * Exchange Database Functions and SQLite Hook Manager
 *
 * Registers UDFs required by exchange triggers:
 * - exchange_compute_hash: pure SHA-256 computation over specimen attributes
 * - exchange_format_payload: pure SOSA/GloSIS payload serialization
 *
 * Also provides installSqliteHooks() so that Prisma (via @prisma/adapter-better-sqlite3)
 * and all other database connections in the Node process automatically have the
 * exchange functions available when triggers fire.
 */

const crypto = require('crypto');
const { formatSampleV2 } = require('./sisAdapterService');

function registerDbFunctions(db) {
    if (!db || typeof db.function !== 'function') return;
    try {
        db.function('exchange_compute_hash', { varargs: true }, (id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata) => {
            const dataToHash = {
                id,
                status,
                originalId: originalId || null,
                labId: labId || null,
                assignedLab: assignedLab || null,
                country: country || null,
                projectCode: projectCode || null,
                fieldMetadata: fieldMetadata || null,
                latitude: null,
                longitude: null,
                elevation: null,
                depthUpper: null,
                depthLower: null,
                collectionDate: null,
                samplingDate: null,
                receptionDate: null,
                results: []
            };
            return crypto.createHash('sha256').update(JSON.stringify(dataToHash)).digest('hex');
        });

        db.function('exchange_format_payload', { varargs: true }, (id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, updatedAt) => {
            const raw = {
                id,
                status,
                originalId,
                labId,
                assignedLab,
                country,
                projectCode,
                fieldMetadata,
                updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
                results: []
            };
            return JSON.stringify(formatSampleV2(raw));
        });
    } catch (e) {
        // Function already registered on this connection
    }
}

function installSqliteHooks() {
    try {
        const betterSqlite3Path = require.resolve('better-sqlite3');
        const OrigDb = require('better-sqlite3');
        if (OrigDb.__exchangeHooksInstalled) return;

        function WrappedDb(...args) {
            const db = new OrigDb(...args);
            registerDbFunctions(db);
            return db;
        }
        WrappedDb.prototype = OrigDb.prototype;
        WrappedDb.__exchangeHooksInstalled = true;
        Object.assign(WrappedDb, OrigDb);
        require.cache[betterSqlite3Path].exports = WrappedDb;
    } catch (e) {
        // Silently skip if module resolution fails in test harnesses
    }
}

// Auto-install hooks on module evaluation
installSqliteHooks();

module.exports = {
    registerDbFunctions,
    installSqliteHooks
};
