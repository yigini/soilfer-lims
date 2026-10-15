function positionNumber(raw) {
    if (typeof raw !== 'string' || !/^\d+$/.test(raw.trim())) return null;
    const number = Number(raw.trim());
    return Number.isSafeInteger(number) && number > 0 ? number : null;
}

// Identifier interpretation is explicit mapping, never measurement parsing.
// Match only current native physical positions; historical/duplicate positions
// cannot become sample destinations merely because they share a sample id.
function matchInstrumentRow(batch, samples, mapping, cells) {
    const sourceId = cells[mapping.idColumn];
    const identifier = typeof sourceId === 'string' ? sourceId.trim() : '';
    const positions = batch.positions.filter(row => row.provenance === 'NATIVE' && row.historicalSnapshotSeq == null);
    const rules = mapping.qcDetector?.prefixes.filter(rule => identifier.startsWith(rule.prefix)) || [];
    const refusal = (kind, code, ids = []) => ({ kind, code, sourceId, positionId: null, candidatePositionIds: ids });
    if (!identifier) return refusal('UNKNOWN', 'IMPORT_IDENTIFIER_MISSING');
    if (rules.length > 1) return refusal('AMBIGUOUS', 'IMPORT_QC_POSITION_AMBIGUOUS');
    let candidates, kind;
    if (rules.length === 1) {
        kind = 'QC';
        const number = positionNumber(cells[mapping.qcDetector.positionColumn]);
        candidates = positions.filter(row => row.kind === rules[0].kind && row.position === number);
    } else {
        kind = 'SAMPLE';
        const sampleIds = new Set(samples.filter(sample => mapping.idType === 'LAB_SAMPLE_CODE' ? sample.labSampleCode === identifier
            : mapping.idType === 'ORIGINAL_ID' ? sample.originalId === identifier : false).map(sample => sample.id));
        const number = mapping.idType === 'POSITION' ? positionNumber(identifier) : null;
        candidates = positions.filter(row => row.kind === 'SAMPLE' && (mapping.idType === 'POSITION'
            ? row.position === number : sampleIds.has(row.sampleId)));
    }
    if (!candidates.length) return refusal('UNKNOWN', kind === 'QC' ? 'IMPORT_QC_POSITION_UNMATCHED' : 'IMPORT_IDENTIFIER_UNMATCHED');
    if (candidates.length !== 1) return refusal('AMBIGUOUS', kind === 'QC' ? 'IMPORT_QC_POSITION_AMBIGUOUS' : 'IMPORT_IDENTIFIER_AMBIGUOUS', candidates.map(row => row.id));
    const position = candidates[0];
    return { kind, code: null, sourceId, positionId: position.id, positionNumber: position.position,
        ...(kind === 'SAMPLE' && { sampleId: position.sampleId,
            workItemIdsByAnalysis: Object.fromEntries((position.workItems || []).map(link => [link.analysisCode, link.workItemId])) }) };
}
module.exports = { matchInstrumentRow };
