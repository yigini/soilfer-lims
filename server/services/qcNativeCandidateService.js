// Build the evidence candidate before any persistence. Preview and real entry
// share this construction so frozen reference placements and replaced
// observations have exactly the same meaning in both paths.
function buildNativeMeasurementCandidate(batch, { observations = [], replacements = [], plans = [] } = {}) {
    const candidate = {
        ...batch,
        measurements: [...batch.measurements.filter(row => !replacements.some(change => change.previous.id === row.id)), ...observations],
        positions: batch.positions.map(position => ({ ...position, references: [...(position.references || [])] }))
    };
    for (const plan of plans) for (const binding of plan.bindings) {
        const position = candidate.positions.find(row => row.id === binding.positionId);
        position.references = position.references.filter(row => row.analysisCode !== binding.analysisCode).concat(binding);
    }
    return candidate;
}

module.exports = { buildNativeMeasurementCandidate };
