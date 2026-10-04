// Pure parser used by both browser and server. Configuration comes from the lab
// policy accessor; no user language preference can change a measurement.
function validateNumberFormat({ decimal, thousands }) {
    return ['.', ','].includes(decimal) && [null, ',', '.', ' ', "'"].includes(thousands) && decimal !== thousands;
}

function parseNumber(input, format) {
    const rawInput = input === null || input === undefined ? '' : String(input);
    const fail = code => ({ valid: false, code, rawInput, value: null, canonical: null, qualifier: '', blank: rawInput.trim() === '' });
    if (!validateNumberFormat(format || {})) return fail('NUMBER_FORMAT_POLICY_INVALID');
    if (!['string', 'number'].includes(typeof input) || rawInput.trim() === '') return fail(rawInput.trim() === '' ? 'VALUE_REQUIRED' : 'INVALID_NUMBER');
    if (typeof input === 'number') return Number.isFinite(input)
        ? { valid: true, code: null, rawInput, value: input, canonical: String(input), qualifier: '', blank: false }
        : fail('INVALID_NUMBER');
    let source = rawInput.trim(), qualifier = '';
    const prefix = source.match(/^(<=|>=|<|>|≤|≥)\s*/);
    if (prefix) { qualifier = prefix[1].replace('≤', '<=').replace('≥', '>='); source = source.slice(prefix[0].length); }
    const exponent = source.match(/(?:[eE]([+-]?\d+))$/);
    const exponentText = exponent ? `e${exponent[1]}` : '';
    if (exponent) source = source.slice(0, exponent.index);
    if (/[eE]/.test(source)) return fail('INVALID_NUMBER');
    let sign = '';
    if (/^[+-]/.test(source)) { sign = source[0]; source = source.slice(1); }
    const { decimal, thousands } = format;
    if (!source || (thousands !== ' ' && /\s/.test(source)) || /[^\d., ']/.test(source)) return fail('INVALID_NUMBER');
    const marks = source.match(/[^\d]/g) || [];
    let canonical;
    if (!marks.length) canonical = source;
    else if (marks.length === 1 && ['.', ','].includes(marks[0])) {
        const mark = marks[0], [integer, fraction] = source.split(mark);
        if (!/^\d*$/.test(integer) || !/^\d*$/.test(fraction) || (!integer && !fraction)) return fail('INVALID_NUMBER');
        if (fraction.length === 3 && integer !== '0') {
            if (mark === thousands) {
                if (!/^[1-9]\d{0,2}$/.test(integer)) return fail('INVALID_NUMBER');
                canonical = integer + fraction;
            } else if (thousands !== null && mark === decimal) canonical = `${integer || '0'}.${fraction}`;
            else return fail('AMBIGUOUS_NUMBER');
        } else if (mark === thousands && integer !== '0') return fail('INVALID_NUMBER');
        else canonical = `${integer || '0'}.${fraction}`;
    } else {
        if (thousands === null) return fail('INVALID_NUMBER');
        const parts = source.split(decimal);
        if (parts.length > 2 || (parts.length === 2 && !/^\d+$/.test(parts[1]))) return fail('INVALID_NUMBER');
        const groups = parts[0].split(thousands);
        if (groups.length < 2 || !/^[1-9]\d{0,2}$/.test(groups[0]) || groups.slice(1).some(group => !/^\d{3}$/.test(group))) return fail('INVALID_NUMBER');
        canonical = groups.join('') + (parts.length === 2 ? `.${parts[1]}` : '');
    }
    const value = Number(sign + canonical + exponentText);
    if (!Number.isFinite(value)) return fail('INVALID_NUMBER');
    // Keep explicit decimal precision while normalizing separators. Scientific
    // notation is expanded after parsing so its exponent cannot be mistaken for
    // a grouping separator by downstream consumers.
    const normalized = exponent ? String(value) : (sign === '-' ? '-' : '') + canonical;
    return { valid: true, code: null, rawInput, value, canonical: qualifier + normalized, qualifier, blank: false };
}

// A censoring limit is an observation, never a numeric measured value. Only
// duplicate QC uses this classifier; all numeric syntax still uses parseNumber.
function parseDuplicateObservation(input, format) {
    if (validateNumberFormat(format || {}) && typeof input === 'string' && /^<LOQ$/i.test(input.trim())) {
        return { valid: true, code: null, rawInput: input, value: null, canonical: '<LOQ', qualifier: '<', censored: 'BELOW', literalLoq: true };
    }
    const parsed = parseNumber(input, format);
    return { ...parsed, censored: parsed.valid && parsed.qualifier
        ? (parsed.qualifier.startsWith('<') ? 'BELOW' : 'ABOVE') : null, literalLoq: false };
}

module.exports = { parseNumber, parseDuplicateObservation, validateNumberFormat };
