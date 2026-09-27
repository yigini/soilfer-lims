/**
 * Exchange Database Functions and SQLite Hook Manager
 *
 * Implements deterministic hashing and SQLite UDF functions for Exchange triggers:
 * - exchange_compute_hash: 256-bit SHA256 content hash of sample data and results
 * - exchange_format_payload: GloSIS/SOSA JSON payload formatting for triggers
 * - registerDbFunctions(db): registers UDFs on any better-sqlite3 Database instance
 * - installSqliteHooks(): intercepts better-sqlite3 construction to auto-register UDFs
 *
 * NOTE: This module has ZERO dependencies on Prisma or exchangeStateService
 * to prevent circular requires and ensure fail-safe UDF availability.
 */

'use strict';

const crypto = require('crypto');
const path = require('path');
const { formatSampleV2 } = require('./sisAdapterService');

function normalizeSampleDataForHash(raw) {
    if (!raw) return {};

    let results = [];
    if (raw.results) {
        if (typeof raw.results === 'string') {
            try { results = JSON.parse(raw.results); } catch (e) {}
        } else if (Array.isArray(raw.results)) {
            results = raw.results;
        }
    }
    const normResults = results.map(r => ({
        id: r.id != null ? String(r.id) : null,
        param: r.param != null ? String(r.param) : null,
        value: r.value != null ? String(r.value) : null,
        numericValue: (r.numericValue !== null && r.numericValue !== undefined && !isNaN(Number(r.numericValue))) ? Number(r.numericValue) : null,
        unit: r.unit != null ? String(r.unit) : null,
        methodologyId: r.methodologyId != null ? String(r.methodologyId) : null,
        isValid: (r.isValid !== null && r.isValid !== undefined) ? (r.isValid ? 1 : 0) : 1,
        isCurrent: (r.isCurrent !== null && r.isCurrent !== undefined) ? (r.isCurrent ? 1 : 0) : 1
    }));
    normResults.sort((a, b) => String(a.id || a.param || '').localeCompare(String(b.id || b.param || '')));

    let recDate = null;
    if (raw.receptionDate) {
        const str = (raw.receptionDate instanceof Date) ? raw.receptionDate.toISOString() : String(raw.receptionDate);
        const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        recDate = m ? `${m[1]}-${m[2]}-${m[3]}` : str;
    }

    let colDate = null;
    if (raw.collectionDate) {
        const str = (raw.collectionDate instanceof Date) ? raw.collectionDate.toISOString() : String(raw.collectionDate);
        const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        colDate = m ? `${m[1]}-${m[2]}-${m[3]}` : str;
    }

    let sampDate = null;
    if (raw.samplingDate) {
        const str = (raw.samplingDate instanceof Date) ? raw.samplingDate.toISOString() : String(raw.samplingDate);
        const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        sampDate = m ? `${m[1]}-${m[2]}-${m[3]}` : str;
    }

    return {
        id: raw.id != null ? String(raw.id) : null,
        status: raw.status != null ? String(raw.status) : null,
        originalId: raw.originalId != null ? String(raw.originalId) : null,
        labId: raw.labId != null ? String(raw.labId) : null,
        assignedLab: raw.assignedLab != null ? String(raw.assignedLab) : null,
        country: (raw.country || raw.countryName) != null ? String(raw.country || raw.countryName) : null,
        projectCode: raw.projectCode != null ? String(raw.projectCode) : null,
        fieldMetadata: raw.fieldMetadata != null ? (typeof raw.fieldMetadata === 'object' ? JSON.stringify(raw.fieldMetadata) : String(raw.fieldMetadata)) : null,
        metadata: raw.metadata != null ? (typeof raw.metadata === 'object' ? JSON.stringify(raw.metadata) : String(raw.metadata)) : null,
        latitude: raw.latitude !== undefined && raw.latitude !== null ? Number(raw.latitude) : null,
        longitude: raw.longitude !== undefined && raw.longitude !== null ? Number(raw.longitude) : null,
        elevation: raw.elevation !== undefined && raw.elevation !== null ? Number(raw.elevation) : null,
        depthUpper: raw.depthUpper !== undefined && raw.depthUpper !== null ? Number(raw.depthUpper) : null,
        depthLower: raw.depthLower !== undefined && raw.depthLower !== null ? Number(raw.depthLower) : null,
        collectionDate: colDate,
        samplingDate: sampDate,
        receptionDate: recDate,
        results: normResults
    };
}

function computeSampleContentHash(s) {
    if (!s) return '';
    return crypto.createHash('sha256').update(JSON.stringify(normalizeSampleDataForHash(s))).digest('hex');
}

function registerDbFunctions(db) {
    if (!db || typeof db.function !== 'function') return;
    try {
        db.function('exchange_compute_hash', { varargs: true }, (...args) => {
            let id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, metadata, receptionDate, resultsJson;
            if (args.length >= 11) {
                [id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, metadata, receptionDate, resultsJson] = args;
            } else if (args.length === 8) {
                [id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata] = args;
            } else if (args.length === 9) {
                [id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, metadata] = args;
            } else {
                [id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, metadata, receptionDate, resultsJson] = args;
            }

            const raw = {
                id,
                status,
                originalId,
                labId,
                assignedLab,
                country,
                projectCode,
                fieldMetadata,
                metadata,
                receptionDate,
                results: resultsJson
            };
            return computeSampleContentHash(raw);
        });

        db.function('exchange_format_payload', { varargs: true }, (...args) => {
            let id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, metadata, receptionDate, updatedAt, resultsJson;
            if (args.length >= 12) {
                [id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, metadata, receptionDate, updatedAt, resultsJson] = args;
            } else if (args.length === 9) {
                [id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, updatedAt] = args;
            } else {
                [id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, metadata, receptionDate, updatedAt, resultsJson] = args;
            }

            let results = [];
            if (resultsJson) {
                try {
                    results = typeof resultsJson === 'string' ? JSON.parse(resultsJson) : resultsJson;
                } catch (e) {}
            }
            if (!Array.isArray(results)) results = [];

            const raw = {
                id,
                status,
                originalId,
                labId,
                assignedLab,
                country,
                projectCode,
                fieldMetadata,
                metadata,
                receptionDate,
                updatedAt: updatedAt ? new Date(updatedAt) : new Date(),
                results: results.map(r => ({
                    ...r,
                    isValid: r.isValid !== undefined ? Boolean(r.isValid) : true,
                    isCurrent: r.isCurrent !== undefined ? Boolean(r.isCurrent) : true
                }))
            };
            return JSON.stringify(formatSampleV2(raw));
        });
    } catch (e) {}
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
    } catch (e) {}
}

// Auto-install hooks upon import
installSqliteHooks();

module.exports = {
    normalizeSampleDataForHash,
    computeSampleContentHash,
    registerDbFunctions,
    installSqliteHooks
};
