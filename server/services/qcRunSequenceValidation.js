const { sequenceRequirements } = require('./batchSequenceService');
const failure = details => Object.assign(new Error('Rebuild the QC sequence before starting this run.'), {
    statusCode: 409, code: 'QC_SEQUENCE_STALE', details
});
const sampleCodes = row => Array.isArray(row.workItems) ? row.workItems.map(link => link.analysisCode) : row.servedAnalytes || [];

// Read-only validation against criteria resolved in the first-start transaction.
// Existing extra checks are allowed, and each analyte counts only its own samples.
function validateRunSequence({ positions, analyses }) {
    const ordered = [...positions].sort((a, b) => a.position - b.position), ids = new Set(ordered.map(row => row.id));
    if (ids.size !== ordered.length || ordered.some((row, index) => row.position !== index + 1 || row.historicalSnapshotSeq != null)) {
        throw failure({ missing: [{ kind: 'CONTIGUOUS_CURRENT_SEQUENCE' }] });
    }
    const samples = ordered.filter(row => row.kind === 'SAMPLE'), sampleIds = new Set(samples.map(row => row.sampleId));
    if (sampleIds.size !== samples.length || samples.some(row => !row.sampleId || !sampleCodes(row).length)) {
        throw failure({ missing: [{ kind: 'SAMPLE_MEMBERSHIP' }] });
    }
    const duplicates = ordered.filter(row => row.kind === 'DUPLICATE');
    for (const row of duplicates) {
        const parent = samples.find(sample => sample.id === row.duplicateOfPositionId);
        if (!parent || row.sampleId !== parent.sampleId || row.position <= parent.position) {
            throw failure({ missing: [{ kind: 'DUPLICATE_PARENT', positionId: row.id }] });
        }
    }
    const forecasts = analyses.map(criteria => {
        const sampleCount = samples.filter(row => sampleCodes(row).includes(criteria.analysisCode)).length;
        if (!sampleCount) throw failure({ analysisCode: criteria.analysisCode, missing: [{ kind: 'SAMPLE_MEMBERSHIP' }] });
        let counts;
        try { counts = sequenceRequirements(criteria, sampleCount, criteria.crmOrdinal); }
        catch (error) {
            if (error.code !== 'QC_BATCH_TOO_LARGE') throw error;
            throw failure({ ...error.details, missing: [{ kind: 'MAX_BATCH_SIZE' }] });
        }
        const missing = [], count = kind => ordered.filter(row => row.kind === kind).length;
        for (const [field, kind] of [['blank', 'BLANK'], ['lrm', 'LRM'], ['crm', 'CRM']]) {
            if (count(kind) < counts[field]) missing.push({ kind, required: counts[field], actual: count(kind) });
        }
        const actualDuplicates = duplicates.filter(row => sampleCodes(samples.find(sample => sample.id === row.duplicateOfPositionId)).includes(criteria.analysisCode)).length;
        if (actualDuplicates < counts.duplicate) missing.push({ kind: 'DUPLICATE', required: counts.duplicate, actual: actualDuplicates });
        if (counts.calibration) {
            if (ordered[0]?.kind !== 'ICV' || ordered[1]?.kind !== 'CCB') missing.push({ kind: 'OPENING_ICV_CCB' });
            if (ordered.at(-2)?.kind !== 'CCV' || ordered.at(-1)?.kind !== 'CCB') missing.push({ kind: 'CLOSING_CCV_CCB' });
            let gap = 0;
            for (const [index, row] of ordered.entries()) {
                if (row.kind === 'SAMPLE' && sampleCodes(row).includes(criteria.analysisCode)) {
                    gap++;
                    if (counts.ccvEvery > 0 && gap > counts.ccvEvery) missing.push({ kind: 'CCV_INTERVAL', positionId: row.id, maximum: counts.ccvEvery });
                }
                if (row.kind === 'CCV') {
                    if (ordered[index + 1]?.kind !== 'CCB') missing.push({ kind: 'CCV_CCB_PAIR', positionId: row.id });
                    gap = 0;
                }
            }
        }
        if (missing.length) throw failure({ analysisCode: criteria.analysisCode, missing,
            ...(counts.crm > 0 && !count('CRM') && { crmOrdinal: criteria.crmOrdinal, crmDue: true }) });
        return { ...criteria, sampleCount, counts };
    });
    const served = row => {
        if (row.kind === 'SAMPLE') return sampleCodes(row);
        if (row.kind === 'DUPLICATE') return sampleCodes(samples.find(sample => sample.id === row.duplicateOfPositionId));
        return forecasts.filter(criteria => {
            if (['ICV', 'CCV', 'CCB'].includes(row.kind)) return criteria.counts.calibration;
            const field = { BLANK: 'blank', LRM: 'lrm', CRM: 'crm' }[row.kind];
            if (row.kind === 'CRM' && !criteria.counts.crm) return criteria.qcRule.resolved.crmEveryNBatches.value > 0 &&
                (row.references || []).some(reference => reference.analysisCode === criteria.analysisCode && !reference.supersededById);
            return field && criteria.counts[field] > 0;
        }).map(criteria => criteria.analysisCode);
    };
    return { forecasts, positions: ordered.map(row => ({ id: row.id, position: row.position, kind: row.kind, servedAnalytes: served(row) })) };
}

module.exports = { validateRunSequence };
