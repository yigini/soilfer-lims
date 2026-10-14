const { normalizeAnalysisCodes } = require('./analysisCodesService');
const FRACTIONS = Object.freeze(['SAND', 'SILT', 'CLAY']);

function isFractionOwner(item) {
    const codes = normalizeAnalysisCodes([item.analysis]);
    return codes.length === 1 && FRACTIONS.includes(codes[0]);
}

/** Existing owners supply execution lines; the logical catalogue target stays unchanged. */
function inspectTextureOwners(items, target) {
    const owners = normalizeAnalysisCodes(target).includes('TEXTURE')
        ? items.filter(item => item.status !== 'WAIVED' && isFractionOwner(item)) : [];
    const missingFractions = owners.length ? FRACTIONS.filter(code =>
        !owners.some(item => normalizeAnalysisCodes([item.analysis])[0] === code)) : [];
    return { owners, missingFractions };
}

module.exports = { inspectTextureOwners, isFractionOwner };
