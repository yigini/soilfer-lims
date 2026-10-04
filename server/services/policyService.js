// Temporary Strict preset accessor authorized for Phase 0. Issue #219 replaces
// this with persisted per-lab and per-method policy resolution.
const STRICT_PRESET_DEFAULTS = Object.freeze({
    'qc.mode': 'REQUIRED_BLOCKING',
    'report.numberFormat': 'RPT-{LAB}-{YYYY}-{SEQ:5}',
    'intake.defaultAnalysisMassG': 10,
    'intake.retentionMassG': 100,
    'numbers.decimalSeparator': '.',
    'numbers.thousandsSeparator': null
});

function get(labId, key, context = {}) {
    if (!(key in STRICT_PRESET_DEFAULTS)) throw new Error(`Unknown policy key: ${key}`);
    if (key.startsWith('numbers.')) {
        return (async () => {
            const lab = await (context.db || require('../prisma')).lab.findUnique({ where: { id: labId || '' }, select: { settings: true } });
            let settings = {};
            try { settings = lab?.settings ? JSON.parse(lab.settings) : {}; }
            catch (_) { throw Object.assign(new Error('Invalid laboratory number settings.'), { statusCode: 409, code: 'NUMBER_FORMAT_POLICY_INVALID' }); }
            if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw Object.assign(new Error('Invalid laboratory number settings.'), { statusCode: 409, code: 'NUMBER_FORMAT_POLICY_INVALID' });
            const decimal = Object.prototype.hasOwnProperty.call(settings, 'decimalSeparator') ? settings.decimalSeparator : STRICT_PRESET_DEFAULTS['numbers.decimalSeparator'];
            const thousands = Object.prototype.hasOwnProperty.call(settings, 'thousandsSeparator') ? settings.thousandsSeparator : STRICT_PRESET_DEFAULTS['numbers.thousandsSeparator'];
            if (!require('../../shared/numberParse').validateNumberFormat({ decimal, thousands })) {
                throw Object.assign(new Error('Invalid laboratory number settings.'), { statusCode: 409, code: 'NUMBER_FORMAT_POLICY_INVALID' });
            }
            return key === 'numbers.decimalSeparator' ? decimal : thousands;
        })();
    }
    return STRICT_PRESET_DEFAULTS[key];
}

function getStrictNumberFormat() {
    return { decimal: STRICT_PRESET_DEFAULTS['numbers.decimalSeparator'], thousands: STRICT_PRESET_DEFAULTS['numbers.thousandsSeparator'] };
}

module.exports = { get, getStrictNumberFormat };
