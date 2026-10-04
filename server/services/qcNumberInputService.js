const { parseNumber, parseDuplicateObservation } = require('../../shared/numberParse');

function normalizeQcNumbers(payload, format) {
    const collections = { blanks: { value: ['value', 'val', 'measured'] },
        controls: { expected: ['expected', 'expectedValue'], measured: ['measured', 'value', 'val'] },
        duplicates: { value1: ['value1', 'val1'], value2: ['value2', 'val2'] } };
    const normalized = { ...payload };
    for (const [collection, fields] of Object.entries(collections)) {
        if (!Array.isArray(payload[collection])) continue;
        normalized[collection] = payload[collection].map(item => {
            if (!item || typeof item !== 'object') return item;
            const copy = { ...item, rawInput: {} };
            for (const [field, aliases] of Object.entries(fields)) {
                const source = item.rawInput && typeof item.rawInput === 'object' && Object.prototype.hasOwnProperty.call(item.rawInput, field)
                    ? item.rawInput[field] : item[aliases.find(alias => item[alias] !== undefined)];
                const parsed = collection === 'duplicates' ? parseDuplicateObservation(source, format) : parseNumber(source, format);
                if (parsed.code === 'AMBIGUOUS_NUMBER' || (!parsed.valid && parsed.code === 'INVALID_NUMBER' && /^[<>≤≥=\s+-]*[\d.,]/.test(String(source)))) {
                    throw Object.assign(new Error(parsed.code === 'AMBIGUOUS_NUMBER' ? 'Clarify the decimal or thousands separator.' : 'Invalid QC number format.'),
                        { statusCode: 400, code: parsed.code || 'INVALID_NUMBER', field, collection });
                }
                copy[field] = parsed.valid && (!parsed.qualifier || collection === 'duplicates')
                    ? (parsed.censored ? parsed.canonical : parsed.value) : null;
                copy.rawInput[field] = source === undefined || source === null ? null : String(source);
            }
            return copy;
        });
    }
    return normalized;
}

function retainQcRawInput(evaluated, payload) {
    for (const collection of ['blanks', 'duplicates', 'controls']) {
        (evaluated[collection] || []).forEach((row, index) => { row.rawInput = payload[collection]?.[index]?.rawInput || {}; });
    }
    return evaluated;
}

module.exports = { normalizeQcNumbers, retainQcRawInput };
