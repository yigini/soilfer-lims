// Temporary Strict preset accessor authorized for Phase 0. Issue #219 replaces
// this with persisted per-lab and per-method policy resolution.
const STRICT_PRESET_DEFAULTS = Object.freeze({
    'qc.mode': 'REQUIRED_BLOCKING',
    'report.numberFormat': 'RPT-{LAB}-{YYYY}-{SEQ:5}'
});

function get(labId, key, context = {}) {
    if (!(key in STRICT_PRESET_DEFAULTS)) throw new Error(`Unknown policy key: ${key}`);
    return STRICT_PRESET_DEFAULTS[key];
}

module.exports = { get };
