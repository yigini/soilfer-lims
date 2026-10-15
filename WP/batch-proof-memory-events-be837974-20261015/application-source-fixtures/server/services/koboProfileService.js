'use strict';

const crypto = require('crypto');
const identity = require('./profileIdentityService');
const MAPPING_KEYS = new Set(['codePath', 'sitePath', 'namespacePath', 'namespace', 'relationPath', 'relation', 'collectionDatePath', 'depthTopPath', 'depthBottomPath', 'depthTopD1Path', 'depthBottomD1Path', 'depthTopD2Path', 'depthBottomD2Path']);

// Kobo may export flat slash paths or nested objects. Never choose a suffix match for identity.
function exactValue(submission, path) {
    if (!path) return undefined;
    if (Object.hasOwn(submission, path)) return submission[path];
    return path.split('/').reduce((value, key) => value && typeof value === 'object' && Object.hasOwn(value, key) ? value[key] : undefined, submission);
}

function validateMapping(fieldMapping) {
    if (fieldMapping == null) return null;
    if (typeof fieldMapping !== 'object' || Array.isArray(fieldMapping)) throw new identity.ProfileReferenceConflictError('INVALID_MAPPING');
    const mapping = fieldMapping.profileReference;
    if (mapping == null) return null;
    if (typeof mapping !== 'object' || Array.isArray(mapping)) throw new identity.ProfileReferenceConflictError('INVALID_MAPPING');
    for (const [key, value] of Object.entries(mapping)) {
        if (!MAPPING_KEYS.has(key)) throw new identity.ProfileReferenceConflictError('INVALID_MAPPING');
        if (key.endsWith('Path')) {
            const path = identity.scalar(value, 512);
            if (path.split('/').some(part => !part || ['__proto__', 'prototype', 'constructor'].includes(part))) throw new identity.ProfileReferenceConflictError('INVALID_MAPPING');
        } else if (key === 'relation') {
            if (!['SITE_POINT', 'COMPOSITE', 'CONFIRMED_PROFILE', 'UNSPECIFIED'].includes(value)) throw new identity.ProfileReferenceConflictError('INVALID_MAPPING');
        } else identity.scalar(value, 512);
    }
    if (mapping.namespacePath && mapping.namespace) throw new identity.ProfileReferenceConflictError('AMBIGUOUS_NAMESPACE_MAPPING');
    if (mapping.relationPath && mapping.relation) throw new identity.ProfileReferenceConflictError('AMBIGUOUS_RELATION_MAPPING');
    return mapping;
}

function optionalNumber(value, min, max) {
    if (value == null || value === '') return null;
    const text = identity.scalar(value, 64);
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new identity.ProfileReferenceConflictError('INVALID_SOURCE_NUMBER');
    return parsed;
}

function extractEvidence(submission, fieldMapping, fallbackSite, layer = null) {
    const mapping = validateMapping(fieldMapping) || {};
    const input = {};
    // Only exact known root fields participate when a form has no explicit mapping.
    for (const key of identity.PIT_KEYS) if (Object.hasOwn(submission, key)) input[key] = submission[key];
    for (const key of ['isComposite', 'composite', 'profileConfirmed', 'isConfirmedProfile']) if (Object.hasOwn(submission, key)) input[key] = submission[key];
    const site = mapping.sitePath ? exactValue(submission, mapping.sitePath) : fallbackSite;
    if (site !== undefined) input.site_id = site;
    let sourcePath = null;
    if (mapping.codePath) {
        const raw = exactValue(submission, mapping.codePath);
        const code = identity.scalar(raw, 255, true);
        const relation = code === null ? 'UNSPECIFIED' : identity.scalar(mapping.relationPath ? exactValue(submission, mapping.relationPath) : mapping.relation, 40, true) || 'SITE_POINT';
        input.profileReference = {code, relation};
        sourcePath = mapping.codePath;
    }
    const namespace = mapping.namespacePath ? identity.scalar(exactValue(submission, mapping.namespacePath), 512) : mapping.namespace || null;
    const topPath = mapping[`depthTop${layer || ''}Path`] || mapping.depthTopPath;
    const bottomPath = mapping[`depthBottom${layer || ''}Path`] || mapping.depthBottomPath;
    const depthTopCm = topPath ? optionalNumber(exactValue(submission, topPath), 0, 100000) : null;
    const depthBottomCm = bottomPath ? optionalNumber(exactValue(submission, bottomPath), 0, 100000) : null;
    if (depthTopCm !== null && depthBottomCm !== null && depthBottomCm < depthTopCm) throw new identity.ProfileReferenceConflictError('INVALID_DEPTH_INTERVAL');
    const rawDate = mapping.collectionDatePath ? exactValue(submission, mapping.collectionDatePath) : submission.collection_date ?? submission.today ?? null;
    const collectedAt = identity.scalar(rawDate, 100, true);
    if (collectedAt !== null && !Number.isFinite(Date.parse(collectedAt))) throw new identity.ProfileReferenceConflictError('INVALID_COLLECTION_DATE');
    const calendar = collectedAt?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (calendar && new Date(Date.UTC(Number(calendar[1]), Number(calendar[2])-1, Number(calendar[3]))).toISOString().slice(0,10) !== calendar[0]) throw new identity.ProfileReferenceConflictError('INVALID_COLLECTION_DATE');
    return {input, namespace, sourcePath, sourceRecordId: submission._uuid ?? submission._id ?? null, depthTopCm, depthBottomCm, collectedAt};
}

function capture(evidence, context) {
    const ref = identity.captureReference(evidence?.input || {site_id: context.site}, {
        ...context, source: 'KOBO', authorizedNamespace: evidence?.namespace || identity.namespaceFor(context.sample), sourceRecordId: evidence?.sourceRecordId
    });
    if (evidence?.sourcePath) ref.sourcePath = evidence.sourcePath;
    return ref;
}

function fingerprint(sampleData) {
    const evidence = sampleData.profileEvidence;
    if (!evidence) return null; // Existing fixtures/legacy adapters retain their original evidence contract.
    return crypto.createHash('sha256').update(JSON.stringify({version: 1, input: evidence.input, namespace: evidence.namespace, depthTopCm: evidence.depthTopCm, depthBottomCm: evidence.depthBottomCm, collectedAt: evidence.collectedAt, lat: sampleData.lat, lng: sampleData.lng})).digest('hex');
}

module.exports = {exactValue, validateMapping, optionalNumber, extractEvidence, capture, fingerprint};
