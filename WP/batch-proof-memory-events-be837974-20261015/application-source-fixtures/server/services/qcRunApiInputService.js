const failure = (code, message, details = {}) => Object.assign(new Error(message), { statusCode: 400, code, details });
const collections = ['blanks', 'duplicates', 'controls'];
function hasQcPayload(input) {
    return ['qcResults', 'measurements', ...collections].some(key => Object.hasOwn(input, key));
}
function emptyQcPayload(input) {
    if (Object.hasOwn(input, 'measurements') || Object.hasOwn(input, 'corrections')) return false;
    const payload = input.qcResults || input;
    return collections.every(key => payload[key] === undefined || Array.isArray(payload[key]) && payload[key].length === 0);
}

// The existing collection grammar is an adapter over actual physical ids.
// Neither array order nor a client-generated id can select a Native position.
function nativeInput(batch, input, { correction = false } = {}) {
    const key = correction ? 'corrections' : 'measurements';
    if (Object.hasOwn(input, key)) return input;
    if (Object.hasOwn(input, 'qcResults') && (!input.qcResults || typeof input.qcResults !== 'object' || Array.isArray(input.qcResults))) {
        throw failure('QC_VALUES_MISSING', 'Submit QC observations as an object.');
    }
    const payload = input.qcResults || input, readings = new Map(), references = new Map(), expectedValues = {};
    if (input.references !== undefined && !Array.isArray(input.references)) throw failure('REFERENCE_VALUE_MISMATCH', 'Submit reference placements as an array.');
    for (const row of input.references || []) {
        if (references.has(row.positionId)) throw failure('REFERENCE_VALUE_MISMATCH', 'Submit distinct reference placements.');
        references.set(row.positionId, row);
    }
    const add = (positionId, value, rawInput) => {
        const row = { positionId, value, ...(rawInput !== undefined && { rawInput }) }, previous = readings.get(positionId);
        if (previous && JSON.stringify(previous) !== JSON.stringify(row)) throw failure('QC_DUPLICATE_PARENT_VALUE_CONFLICT', 'A physical position has one observation per request.', { positionId });
        readings.set(positionId, row);
    };
    for (const collection of collections) {
        if (payload[collection] === undefined) continue;
        if (!Array.isArray(payload[collection])) throw failure('QC_VALUES_MISSING', 'Submit QC observations as arrays.');
        for (const entry of payload[collection]) {
            const positionId = entry?.positionId || entry?.id, position = batch.positions.find(row => row.id === positionId && row.historicalSnapshotSeq == null);
            const validKind = collection === 'blanks' ? ['BLANK', 'CCB'] : collection === 'duplicates' ? ['DUPLICATE'] : ['LRM', 'CRM', 'ICV', 'CCV'];
            if (!position || !validKind.includes(position.kind)) throw failure('QC_POSITION_NOT_IN_ANALYSIS', 'Select the actual QC position.', { positionId });
            if (collection === 'duplicates') {
                if (entry.duplicateOfPositionId && entry.duplicateOfPositionId !== position.duplicateOfPositionId) {
                    throw failure('QC_DUPLICATE_PARENT_REQUIRED', 'The duplicate parent is fixed by this run.', { positionId });
                }
                if (entry.value1 === undefined && entry.val1 === undefined && entry.rawInput?.value1 === undefined ||
                    entry.value2 === undefined && entry.val2 === undefined && entry.rawInput?.value2 === undefined) {
                    throw failure('QC_VALUES_MISSING', 'Enter both observations for the real duplicate pair.', { positionIds: [positionId, position.duplicateOfPositionId] });
                }
                add(position.duplicateOfPositionId, entry.value1 ?? entry.val1, entry.rawInput?.value1);
                add(position.id, entry.value2 ?? entry.val2, entry.rawInput?.value2);
            } else {
                const field = collection === 'blanks' ? 'value' : 'measured';
                add(position.id, entry[field] ?? entry.value ?? entry.val, entry.rawInput?.[field]);
                if (collection === 'controls') {
                    if (entry.referenceUse && entry.referenceUse !== position.kind) throw failure('REFERENCE_USE_INCOMPATIBLE', 'Reference use is determined by the position kind.');
                    if (entry.referenceMaterialId) {
                        const selection = { positionId: position.id, referenceMaterialId: entry.referenceMaterialId,
                            ...(entry.referenceValueId && { referenceValueId: entry.referenceValueId }) };
                        const prior = references.get(position.id);
                        if (prior && (prior.referenceMaterialId !== selection.referenceMaterialId || prior.referenceValueId && selection.referenceValueId && prior.referenceValueId !== selection.referenceValueId)) {
                            throw failure('REFERENCE_POSITION_LOT_CONFLICT', 'A physical position has one reference lot.');
                        }
                        references.set(position.id, selection);
                    }
                    const expected = entry.rawInput?.expected ?? entry.expected ?? entry.expectedValue;
                    if (expected !== undefined && expected !== null && expected !== '') expectedValues[position.id] = expected;
                }
            }
        }
    }
    return { ...input, [key]: [...readings.values()], references: [...references.values()], expectedValues };
}
module.exports = { hasQcPayload, emptyQcPayload, nativeInput };
