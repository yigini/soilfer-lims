const COMPOUND_ANALYSIS_EXPANSION = {
    'exchangeableBases': ['EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA']
};

const TEXTURE_ALIASES = new Set([
    'TEXTURE',
    'SOIL_PSD_TEXTURE',
    'SOIL_TEXTURE',
    'PSA',
    'pSA',
    'Particle Size Analysis'
]);

function normalizeAnalysisCodes(codes) {
    if (!Array.isArray(codes)) return [];
    const normalized = [];
    let hasTexture = false;
    for (const raw of codes) {
        if (!raw || typeof raw !== 'string') continue;
        const trimmed = raw.trim();
        if (TEXTURE_ALIASES.has(trimmed)) {
            if (!hasTexture) {
                normalized.push('TEXTURE');
                hasTexture = true;
            }
        } else if (COMPOUND_ANALYSIS_EXPANSION[trimmed]) {
            normalized.push(...COMPOUND_ANALYSIS_EXPANSION[trimmed]);
        } else {
            normalized.push(trimmed);
        }
    }
    const unique = [...new Set(normalized)];
    if (hasTexture) {
        return unique.filter(c => !['SAND', 'SILT', 'CLAY'].includes(c) || c === 'TEXTURE');
    }
    return unique;
}

function runAnalyteCode(batch, code) {
    const compatibility = batch.analytes?.some(row => row.provenance === 'LEGACY_MIGRATED') || batch.provenance === 'LEGACY_MIGRATED';
    return compatibility && TEXTURE_ALIASES.has(batch.analysis) && TEXTURE_ALIASES.has(code) ? batch.analysis : code;
}

module.exports = { normalizeAnalysisCodes, TEXTURE_ALIASES, runAnalyteCode };
