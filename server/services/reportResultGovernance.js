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

// Resolve once at the IO boundary, then use the existing qcModes hook in every
// validity and publication check. Reopened Native runs retain their first start.
async function resolveReportingModes(sample, batches, options = {}) {
    const qcModes = {}, qcModeEvidence = [];
    const ranks = ['OFF', 'ADVISORY', 'REQUIRED_WARN', 'REQUIRED_BLOCKING'];
    const items = sample.workItems || [];
    for (const result of sample.results || []) {
        const ids = linkedBatchIds(result, items), governing = governingItems(result, items);
        const contributions = [];
        for (const batchId of ids.length ? ids : [null]) {
            const batch = (batches || []).find(row => row.id === batchId);
            const item = governing.find(row => row.batchId === batchId);
            const analysisCode = item?.analysis || result.param;
            const analyte = batch?.analytes?.find(row => row.analysisCode === analysisCode);
            let mode, source = 'LIVE';
            if (analyte?.provenance === 'NATIVE' && batch.startedAt) {
                let snapshot;
                try { snapshot = typeof analyte.criteriaSnapshot === 'string'
                    ? JSON.parse(analyte.criteriaSnapshot) : analyte.criteriaSnapshot; } catch (_) { snapshot = null; }
                mode = snapshot?.qcMode;
                source = 'FROZEN';
            } else {
                mode = await policyService.get(sample.assignedLab || sample.labId, 'qc.mode', {
                    analysisCode, methodologyId: result.methodologyId || item?.methodologyId || null, db: options.db
                });
            }
            // Validate frozen snapshots as strictly as live policy; never fall
            // back to today's policy when a started run's evidence is damaged.
            if (!ranks.includes(mode)) throw Object.assign(new Error('QC policy mode could not be resolved.'),
                { statusCode: 409, code: 'QC_POLICY_UNRESOLVED' });
            contributions.push({ batchId, analysisCode, mode, source });
        }
        const rank = Math.max(...contributions.map(row => ranks.indexOf(row.mode)));
        const effectiveMode = ranks[rank];
        qcModes[result.id] = effectiveMode;
        qcModeEvidence.push({ resultId: result.id, effectiveMode,
            source: contributions.some(row => row.mode === effectiveMode && row.source === 'FROZEN') ? 'FROZEN' : 'LIVE',
            contributingBatchIds: ids, contributions });
    }
    return { qcModes, qcModeEvidence };
}

function reportingQc(sample, options = {}) {
    const items = options.workItems || sample.workItems || [];
    const results = options.results || sample.results || [];
    const batches = options.qcBatches || [];
    const warnings = [], gates = [];
    let blocker = null;
    const qcGate = require('./qcGateService');
    for (const result of results.filter(row => row.isCurrent && !EXCLUDED_GATE_CODES.has(row.param))) {
        const governing = governingItems(result, items);
        if (!governing.length || !governing.every(item => item.status === 'ACCEPTED')) continue;
        const mode = getReportingMode(sample, result, options);
        const gate = options.qcGates?.[result.id] || qcGate.gateFromEvidence(result, items, batches, { mode });
        const acknowledgement = options.qcAcknowledgements?.[result.id];
        const check = qcGate.decision(gate, { acknowledgement, publication: true });
        gates.push({ resultId: result.id, gate, ...check });
        if (!check.allowed && !blocker) blocker = { gate: check, batch: { id: gate.batchIds[0] || null, status: gate.value }, resultId: result.id };
        if (mode !== 'OFF' && (['WARN', 'FAIL'].includes(gate.value) || gate.required && ['NO_BATCH', 'NOT_EVALUATED'].includes(gate.value))) {
            warnings.push({ resultId: result.id, batchId: gate.batchIds[0] || null, analysisCode: result.param,
                qcStatus: gate.value, dispositionDecision: gate.acceptedWithDeviation ? 'ACCEPT_WITH_DEVIATION' : null,
                dispositionReason: gate.dispositionReason || null, acknowledgement: acknowledgement || null });
        }
    }
    // Existing batch-only callers have no result identity. Preserve their
    // fail-closed check until the IO caller supplies result-level gate evidence.
    if (!results.length) {
        const batch = batches.find(row => !checkBatchDisposition(row).allowed);
        if (batch) blocker = { batch, gate: checkBatchDisposition(batch) };
    }
    return { blocker, warnings, gates };
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
    getReportingMode, linkedBatchIds, resolveReportingModes, reportingQc };
