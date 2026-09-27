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
const { formatSampleV2, setCachedSourceSystemId, getCachedSourceSystemId } = require('./sisAdapterService');

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
    const activeResults = results.filter(r => r.isCurrent !== false && r.isCurrent !== 0 && r.isValid !== false && r.isValid !== 0);
    const normResults = activeResults.map(r => ({
        id: r.id != null ? String(r.id) : null,
        param: r.param != null ? String(r.param) : null,
        value: r.value != null ? String(r.value) : null,
        numericValue: (r.numericValue !== null && r.numericValue !== undefined && !isNaN(Number(r.numericValue))) ? Number(r.numericValue) : null,
        unit: r.unit != null ? String(r.unit) : null,
        methodologyId: r.methodologyId != null ? String(r.methodologyId) : null,
        isValid: (r.isValid !== null && r.isValid !== undefined) ? (r.isValid ? 1 : 0) : 1,
        isCurrent: (r.isCurrent !== null && r.isCurrent !== undefined) ? (r.isCurrent ? 1 : 0) : 1,
        provenance: r.provenance != null ? String(r.provenance) : null,
        censoring: r.censoring != null ? String(r.censoring) : null,
        basis: r.basis != null ? String(r.basis) : null,
        replicateNo: (r.replicateNo !== null && r.replicateNo !== undefined && !isNaN(Number(r.replicateNo))) ? Number(r.replicateNo) : 1,
        flags: r.flags != null ? (typeof r.flags === 'object' ? JSON.stringify(r.flags) : String(r.flags)) : null,
        uncertainty: (r.uncertainty !== null && r.uncertainty !== undefined && !isNaN(Number(r.uncertainty))) ? Number(r.uncertainty) : null,
        determinationDate: r.determinationDate != null ? (r.determinationDate instanceof Date ? r.determinationDate.toISOString().split('T')[0] : String(r.determinationDate).split('T')[0]) : (r.analysedAt != null ? (r.analysedAt instanceof Date ? r.analysedAt.toISOString().split('T')[0] : String(r.analysedAt).split('T')[0]) : null)
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
        matrix: raw.matrix != null ? String(raw.matrix) : 'SOIL',
        fieldMetadata: raw.fieldMetadata != null ? (typeof raw.fieldMetadata === 'object' ? JSON.stringify(raw.fieldMetadata) : String(raw.fieldMetadata)) : null,
        metadata: raw.metadata != null ? (typeof raw.metadata === 'object' ? JSON.stringify(raw.metadata) : String(raw.metadata)) : null,
        receptionData: raw.receptionData != null ? (typeof raw.receptionData === 'object' ? JSON.stringify(raw.receptionData) : String(raw.receptionData)) : null,
        latitude: (raw.latitude !== undefined && raw.latitude !== null && !isNaN(Number(raw.latitude))) ? Number(raw.latitude) : null,
        longitude: (raw.longitude !== undefined && raw.longitude !== null && !isNaN(Number(raw.longitude))) ? Number(raw.longitude) : null,
        elevation: (raw.elevation !== undefined && raw.elevation !== null && !isNaN(Number(raw.elevation))) ? Number(raw.elevation) : null,
        depthTopCm: (raw.depthTopCm !== undefined && raw.depthTopCm !== null && !isNaN(Number(raw.depthTopCm))) ? Number(raw.depthTopCm) : null,
        depthBottomCm: (raw.depthBottomCm !== undefined && raw.depthBottomCm !== null && !isNaN(Number(raw.depthBottomCm))) ? Number(raw.depthBottomCm) : null,
        depthUpper: (raw.depthUpper !== undefined && raw.depthUpper !== null && !isNaN(Number(raw.depthUpper))) ? Number(raw.depthUpper) : (raw.depthTop !== undefined && raw.depthTop !== null && !isNaN(Number(raw.depthTop)) ? Number(raw.depthTop) : null),
        depthLower: (raw.depthLower !== undefined && raw.depthLower !== null && !isNaN(Number(raw.depthLower))) ? Number(raw.depthLower) : (raw.depthBottom !== undefined && raw.depthBottom !== null && !isNaN(Number(raw.depthBottom)) ? Number(raw.depthBottom) : null),
        horizon: raw.horizon != null ? String(raw.horizon) : null,
        positionalUncertaintyM: (raw.positionalUncertaintyM !== undefined && raw.positionalUncertaintyM !== null && !isNaN(Number(raw.positionalUncertaintyM))) ? Number(raw.positionalUncertaintyM) : null,
        locationSource: raw.locationSource != null ? String(raw.locationSource) : null,
        collectionDate: colDate,
        samplingDate: sampDate,
        receptionDate: recDate,
        siteName: raw.siteName != null ? String(raw.siteName) : null,
        village: raw.village != null ? String(raw.village) : null,
        admin1: raw.admin1 != null ? String(raw.admin1) : null,
        admin2: raw.admin2 != null ? String(raw.admin2) : null,
        receivedMass: (raw.receivedMass !== undefined && raw.receivedMass !== null && !isNaN(Number(raw.receivedMass))) ? Number(raw.receivedMass) : null,
        moistureOnArrival: raw.moistureOnArrival != null ? String(raw.moistureOnArrival) : null,
        dryingStatus: raw.dryingStatus != null ? String(raw.dryingStatus) : null,
        preparationStatus: raw.preparationStatus != null ? String(raw.preparationStatus) : null,
        rejectionReason: raw.rejectionReason != null ? String(raw.rejectionReason) : null,
        approvedAt: raw.approvedAt != null ? (raw.approvedAt instanceof Date ? raw.approvedAt.toISOString() : String(raw.approvedAt)) : null,
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
        let connSourceSystemId = null;
        try {
            const row = db.prepare("SELECT value FROM _exchange_meta WHERE key = 'source_system_id'").get();
            if (row && row.value) {
                connSourceSystemId = row.value;
                if (typeof setCachedSourceSystemId === 'function') {
                    setCachedSourceSystemId(connSourceSystemId);
                }
            }
        } catch (e) {}

        db.function('exchange_compute_hash', { varargs: true }, (...args) => {
            let sampleObj = {};
            let resultsJson = '[]';

            if (args.length === 2 && typeof args[0] === 'string' && args[0].trim().startsWith('{')) {
                try { sampleObj = JSON.parse(args[0]); } catch (e) {}
                resultsJson = args[1];
            } else if (args.length === 2 && typeof args[0] === 'object' && args[0] !== null) {
                sampleObj = args[0];
                resultsJson = args[1];
            } else {
                let id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, metadata, receptionDate;
                if (args.length >= 11) {
                    [id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, metadata, receptionDate, resultsJson] = args;
                } else if (args.length === 8) {
                    [id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata] = args;
                } else if (args.length === 9) {
                    [id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, metadata] = args;
                } else {
                    [id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, metadata, receptionDate, resultsJson] = args;
                }
                sampleObj = {
                    id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, metadata, receptionDate
                };
            }

            sampleObj.results = resultsJson;
            return computeSampleContentHash(sampleObj);
        });

        db.function('exchange_format_payload', { varargs: true }, (...args) => {
            let sampleObj = {};
            let resultsJson = '[]';

            if (args.length === 2 && typeof args[0] === 'string' && args[0].trim().startsWith('{')) {
                try { sampleObj = JSON.parse(args[0]); } catch (e) {}
                resultsJson = args[1];
            } else if (args.length === 2 && typeof args[0] === 'object' && args[0] !== null) {
                sampleObj = args[0];
                resultsJson = args[1];
            } else {
                let id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, metadata, receptionDate, updatedAt;
                if (args.length >= 12) {
                    [id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, metadata, receptionDate, updatedAt, resultsJson] = args;
                } else if (args.length === 9) {
                    [id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, updatedAt] = args;
                } else {
                    [id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, metadata, receptionDate, updatedAt, resultsJson] = args;
                }
                sampleObj = {
                    id, status, originalId, labId, assignedLab, country, projectCode, fieldMetadata, metadata, receptionDate,
                    updatedAt: updatedAt ? new Date(updatedAt) : new Date()
                };
            }

            let results = [];
            if (resultsJson) {
                try {
                    results = typeof resultsJson === 'string' ? JSON.parse(resultsJson) : resultsJson;
                } catch (e) {}
            }
            if (!Array.isArray(results)) results = [];

            sampleObj.results = results
                .filter(r => r.isCurrent !== false && r.isCurrent !== 0 && r.isValid !== false && r.isValid !== 0)
                .map(r => ({
                    ...r,
                    isValid: true,
                    isCurrent: true
                }));

            if (!sampleObj.updatedAt) {
                sampleObj.updatedAt = new Date();
            }

            const sourceSysId = connSourceSystemId || (typeof getCachedSourceSystemId === 'function' ? getCachedSourceSystemId() : null);
            return JSON.stringify(formatSampleV2(sampleObj, {}, { internal: true, db, sourceSystemId: sourceSysId }));
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
