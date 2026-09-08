const { IntlMessageFormat } = require('intl-messageformat');

const messageFormatCache = new Map();

function applyLegacyParams(pattern, params = {}) {
    if (typeof pattern !== 'string') return pattern;
    if (!params || typeof params !== 'object') return pattern;
    return pattern.replace(/{{\s*(\w+)\s*}}/g, (_, key) =>
        params[key] !== undefined && params[key] !== null ? String(params[key]) : ''
    );
}

function formatMessage(pattern, params = {}, locale = 'en') {
    if (typeof pattern !== 'string') return pattern;
    if (!params || Object.keys(params).length === 0) {
        if (!pattern.includes('{')) return pattern;
    }

    if (/{{\s*\w+\s*}}/.test(pattern)) {
        return applyLegacyParams(pattern, params);
    }

    if (pattern.includes('{') && pattern.includes('}')) {
        const cacheKey = `${locale}:${pattern}`;
        try {
            let formatter = messageFormatCache.get(cacheKey);
            if (!formatter) {
                formatter = new IntlMessageFormat(pattern, locale);
                if (messageFormatCache.size > 2000) {
                    messageFormatCache.clear();
                }
                messageFormatCache.set(cacheKey, formatter);
            }
            return formatter.format(params);
        } catch (err) {
            return applyLegacyParams(pattern.replace(/\{/g, '{{').replace(/\}/g, '}}'), params);
        }
    }

    return pattern;
}

function parseLaboratoryNumber(rawInput) {
    if (rawInput === null || rawInput === undefined) return { valid: true, value: null, canonical: null };
    const str = String(rawInput).trim();
    if (str === '') return { valid: true, value: null, canonical: null };

    const qualifierMatch = str.match(/^([<>]=?|±|\+|-)?\s*(.*)$/);
    const qualifier = qualifierMatch ? (qualifierMatch[1] || '') : '';
    const numericPart = qualifierMatch ? qualifierMatch[2].trim() : str;

    if (numericPart === '') {
        return { valid: false, error: 'MISSING_NUMERIC_VALUE', raw: str };
    }

    const hasComma = numericPart.includes(',');
    const hasDot = numericPart.includes('.');

    if (hasComma && hasDot) {
        const dotLast = numericPart.lastIndexOf('.') > numericPart.lastIndexOf(',');
        if (dotLast) {
            const clean = numericPart.replace(/,/g, '');
            const num = Number(clean);
            if (isNaN(num)) return { valid: false, error: 'INVALID_NUMBER', raw: str };
            return {
                valid: true,
                value: num,
                qualifier,
                canonical: qualifier + String(num),
                raw: str
            };
        } else {
            const clean = numericPart.replace(/\./g, '').replace(',', '.');
            const num = Number(clean);
            if (isNaN(num)) return { valid: false, error: 'INVALID_NUMBER', raw: str };
            return {
                valid: true,
                value: num,
                qualifier,
                canonical: qualifier + String(num),
                raw: str
            };
        }
    }

    const normalizedStr = numericPart.replace(',', '.');

    if ((normalizedStr.match(/\./g) || []).length > 1) {
        return { valid: false, error: 'MULTIPLE_DECIMAL_POINTS', raw: str };
    }

    const num = Number(normalizedStr);
    if (isNaN(num)) {
        return { valid: false, error: 'INVALID_FORMAT', raw: str };
    }

    return {
        valid: true,
        value: num,
        qualifier,
        canonical: qualifier + String(num),
        raw: str
    };
}

module.exports = {
    applyLegacyParams,
    formatMessage,
    parseLaboratoryNumber
};
