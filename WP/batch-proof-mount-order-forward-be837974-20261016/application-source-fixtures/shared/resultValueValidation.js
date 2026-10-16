const { parseNumber, validateNumberFormat } = require('./numberParse');

function parseResultValue(rawInput, numberFormat) {
    const parsed = parseNumber(rawInput, numberFormat), below = parsed.qualifier.startsWith('<');
    return { isBlank: parsed.blank, isValid: parsed.valid, normalizedValue: parsed.value,
        raw: parsed.valid ? parsed.canonical : parsed.rawInput.trim(), rawInput: parsed.rawInput,
        code: parsed.code, isCensored: Boolean(parsed.qualifier),
        censoring: parsed.qualifier ? below ? 'BELOW_LOQ' : 'ABOVE_RANGE' : 'NONE',
        ...(parsed.qualifier ? { limitValue: parsed.value } : {}),
        flags: parsed.valid ? parsed.qualifier ? [below ? 'BELOW_LOQ' : 'ABOVE_RANGE'] : []
            : [parsed.blank ? 'VALUE_REQUIRED' : 'INVALID_FORMAT', parsed.code] };
}

// All rule values are supplied by the server's lab/method context. This module
// supplies classification, never a default limit, approval or repeat authority.
function classifyResultValue(rawInput, rules, numberFormat, parsedValue = null) {
    const parsed = parsedValue || parseResultValue(rawInput, numberFormat);
    if (parsed.isBlank) return { ...parsed, flags: ['VALUE_REQUIRED'], severity: 'EMPTY', canOverride: false };
    if (!parsed.isValid) return { ...parsed, severity: 'RED', canOverride: false };
    const flags = [...parsed.flags], value = parsed.normalizedValue;
    const add = flag => { if (!flags.includes(flag)) flags.push(flag); };
    if (rules) {
        if (rules.min != null && value < rules.min) add('BELOW_MIN');
        if (rules.max != null && value > rules.max) add('ABOVE_MAX');
        if (rules.loq != null && parsed.censoring === 'BELOW_LOQ' && value < rules.loq) add('CENSOR_LIMIT_BELOW_LOQ');
        if (rules.loq != null && value < rules.loq && !parsed.isCensored) add('BELOW_LOQ');
        if (rules.lod != null && value < rules.lod && !parsed.isCensored) add('BELOW_LOD');
        if (!parsed.isCensored && (rules.typicalMin != null && value < rules.typicalMin ||
            rules.typicalMax != null && value > rules.typicalMax)) add('OUTSIDE_TYPICAL_RANGE');
        // Use the existing flag accepted by #191's dilution command.
        if (rules.calibrationMax != null && value > rules.calibrationMax) add('ABOVE_RANGE');
    }
    const hardRange = flags.some(flag => ['BELOW_MIN', 'ABOVE_MAX'].includes(flag));
    const nonOverridable = flags.includes('CENSOR_LIMIT_BELOW_LOQ');
    const red = hardRange || nonOverridable;
    const amber = flags.some(flag => ['BELOW_LOQ', 'BELOW_LOD', 'OUTSIDE_TYPICAL_RANGE', 'ABOVE_RANGE'].includes(flag));
    return { ...parsed, flags, isValid: !red, severity: red ? 'RED' : amber ? 'AMBER' : 'VALID',
        canOverride: hardRange && !nonOverridable, nonOverridable };
}

function loqQuickValue(rules, numberFormat) {
    if (rules?.loq == null) return { value: null, code: 'LOQ_NOT_CONFIGURED' };
    if (!validateNumberFormat(numberFormat || {})) return { value: null, code: 'NUMBER_FORMAT_POLICY_INVALID' };
    return { value: '<' + String(rules.loq).replace('.', numberFormat.decimal), code: null };
}

module.exports = { parseResultValue, classifyResultValue, loqQuickValue };
