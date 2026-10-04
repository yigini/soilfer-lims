const crypto = require('crypto');
const policyService = require('./policyService');
const { isInvalidOnlyByQcFailure, checkBatchDisposition } = require('./qcService');
const { SPECTRAL_ACQUISITION_CODES } = require('../config/spectralAcquisition');

const TEXTURE_ALIASES = new Set(['TEXTURE', 'SOIL_PSD_TEXTURE', 'SOIL_TEXTURE', 'PSA', 'pSA', 'Particle Size Analysis']);
const DERIVED_TEXTURE_FRACTIONS = ['SAND', 'SILT', 'CLAY'];
const NON_ANALYTICAL = ['DRYING', 'PREPARATION', 'ARCHIVING', 'ARCH', 'DISPOSAL', 'DISP'];
const EXCLUDED_GATE_CODES = new Set([...NON_ANALYTICAL, 'PREP', 'SAMPLE_PREP', 'SIEVING', 'MILLING', 'HOMOGENIZATION']);

function hasApprovedSpectralEvidence(item, scans) {
    return (scans || []).some(scan => scan.workItemId === item.id &&
        scan.sampleId === item.sampleId && scan.isCurrent === true && scan.status === 'APPROVED');
}

function matchesResult(item, result) {
    if (!item || !result || String(item.sampleId) !== String(result.sampleId)) return false;
    const analysisMatches = item.analysis === result.param || (TEXTURE_ALIASES.has(item.analysis) &&
        [...DERIVED_TEXTURE_FRACTIONS, 'TEXTURE', item.analysis].includes(result.param));
    return analysisMatches && !(item.methodologyId && result.methodologyId && item.methodologyId !== result.methodologyId);
}

function matchingItems(result, items) {
    return (items || []).filter(item => matchesResult(item, result));
}

function governsResult(item, result) {
    return !['CANCELLED', 'WAIVED'].includes(item?.status) && matchesResult(item, result);
}

function governingItems(result, items) {
    return (items || []).filter(item => governsResult(item, result));
}

function getReportingMode(sample, result, options = {}) {
    // IO callers pass resolved modes; standalone pure checks use registry Strict.
    const mode = options.qcModes?.[result.id] ?? policyService.getStrict('qc.mode');
    if (!['REQUIRED_BLOCKING', 'REQUIRED_WARN', 'ADVISORY', 'OFF'].includes(mode)) {
        throw Object.assign(new Error('QC policy mode could not be resolved.'), { statusCode: 409, code: 'QC_POLICY_UNRESOLVED' });
    }
    return mode;
}

function isCurrentValidAnalyticalResult(result, mode) {
    const valid = result.isValid !== false ||
        (['REQUIRED_WARN', 'ADVISORY', 'OFF'].includes(mode) && isInvalidOnlyByQcFailure(result));
    return result.isCurrent === true && valid && !EXCLUDED_GATE_CODES.has(result.param);
}

function isReviewedReportResult(result, items, mode) {
    if (!isCurrentValidAnalyticalResult(result, mode)) return false;
    const governing = governingItems(result, items);
    return governing.length > 0 && governing.every(item => item.status === 'ACCEPTED');
}

function linkedBatchIds(result, items) {
    return [...new Set([result.batchId, ...governingItems(result, items).map(item => item.batchId)].filter(Boolean))];
}

function reportingQc(sample, options = {}) {
    const items = options.workItems || sample.workItems || [];
    const results = options.results || sample.results || [];
    const batches = options.qcBatches || [];
    const warnings = [];
    let blocker = null;
    for (const result of results.filter(row => row.isCurrent && !EXCLUDED_GATE_CODES.has(row.param))) {
        const governing = governingItems(result, items);
        if (!governing.length || !governing.every(item => item.status === 'ACCEPTED')) continue;
        const mode = getReportingMode(sample, result, options);
        for (const batchId of linkedBatchIds(result, items)) {
            const batch = batches.find(row => row.id === batchId) || { id: batchId, status: 'ERROR' };
            const gate = checkBatchDisposition(batch);
            if (mode === 'REQUIRED_BLOCKING' && !gate.allowed && !blocker) blocker = { batch, gate };
            if (isReviewedReportResult(result, items, mode) &&
                ((!gate.allowed && mode === 'REQUIRED_WARN') || batch.status === 'QC_FAIL')) {
                let disposition = batch.disposition;
                if (typeof disposition === 'string') {
                    try { disposition = JSON.parse(disposition); } catch (_) { disposition = null; }
                }
                const warning = { batchId, analysisCode: result.param, qcStatus: batch.status,
                    dispositionDecision: disposition?.decision || null };
                if (!warnings.some(row => row.batchId === batchId && row.analysisCode === result.param)) warnings.push(warning);
            }
        }
    }
    // Retain the pure gate's batch-only evaluation for existing callers.
    if (!results.length) {
        const batch = batches.find(row => !checkBatchDisposition(row).allowed);
        if (batch) blocker = { batch, gate: checkBatchDisposition(batch) };
    }
    return { blocker, warnings };
}

async function invalidateReturnedResults(tx, item, actor, reason) {
    const current = await tx.result.findMany({ where: { sampleId: String(item.sampleId), isCurrent: true } });
    const returnedItem = { ...item, status: 'REANALYSIS_REQUIRED' };
    for (const result of current.filter(row => governsResult(returnedItem, row))) {
        let flags;
        try { flags = typeof result.flags === 'string' ? JSON.parse(result.flags) : (result.flags || []); }
        catch (_) { flags = null; }
        if (!Array.isArray(flags)) {
            throw Object.assign(new Error('Stored result flags must be repaired before review.'), { statusCode: 409, code: 'RESULT_FLAGS_INVALID' });
        }
        await tx.result.update({ where: { id: result.id }, data: {
            isValid: false, flags: JSON.stringify([...new Set([...flags, 'REVIEW_RETURNED'])])
        } });
        await tx.auditLog.create({ data: {
            id: crypto.randomUUID(), entity: 'RESULT', entityId: result.id, action: 'REVIEW_RETURNED',
            details: JSON.stringify({ workItemId: item.id, reason }), performedBy: actor.username,
            sampleId: String(item.sampleId), analysisCode: result.param, labId: item.assignedLab || item.labId || actor.labId || null
        } });
    }
}

module.exports = { TEXTURE_ALIASES, DERIVED_TEXTURE_FRACTIONS, NON_ANALYTICAL, EXCLUDED_GATE_CODES,
    SPECTRAL_ACQUISITION_CODES, hasApprovedSpectralEvidence,
    matchesResult, matchingItems, governsResult, governingItems, isCurrentValidAnalyticalResult, isReviewedReportResult, invalidateReturnedResults,
    getReportingMode, linkedBatchIds, reportingQc };
