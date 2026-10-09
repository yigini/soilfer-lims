const { formatReportedValue } = require('../../shared/reportedValueFormat');

// Presentation consumes the saved selected value. It never computes a result,
// applies a current LOQ, changes precision in storage, or infers a missing basis.
function displayResult(item, labels) {
    const text = item.reportedValueSelectionId ? formatReportedValue(item) : String(item.value ?? '—');
    if (item.reportedMode === 'NOT_REPORTABLE') return text;
    return item.censoring === 'BELOW_LOQ' ? `<${text.trim().replace(/^<\s*/, '')} (${labels.loq})` : text;
}

function resultNotes(item, labels) {
    if (item.reportedMode === 'NOT_REPORTABLE') return String(item.value ?? '');
    const bases = { AIR_DRY: labels.airDry, OVEN_DRY: labels.ovenDry, FIELD_MOIST: labels.fieldMoist };
    return [
        `${labels.basis}: ${bases[item.basis] || item.basis || labels.notRecorded}`,
        item.flags?.length ? `${labels.qcFlags}: ${item.flags.join(', ')}` : null,
        ...(item.qcNotes || [])
    ].filter(Boolean).join('\n');
}

function displayUncertainty(item, labels) {
    if (item.uncertainty?.state === 'CENSORED' || item.censoring && item.censoring !== 'NONE') return '—';
    const uncertainty = item.uncertainty;
    if (uncertainty?.state !== 'EXPANDED') return labels.notStated;
    const value = Number.isInteger(item.decimalPlaces) && item.decimalPlaces >= 0 && item.decimalPlaces <= 6
        ? uncertainty.value.toFixed(item.decimalPlaces) : String(uncertainty.value);
    return `± ${value} ${item.unit || ''} (${uncertainty.relativePct == null ? '' : `${uncertainty.relativePct} %, `}k = ${uncertainty.coverageFactor})`;
}
module.exports = { displayResult, resultNotes, displayUncertainty };
