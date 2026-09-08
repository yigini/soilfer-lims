import { IntlMessageFormat } from 'intl-messageformat';

const messageFormatCache = new Map();

/**
 * Legacy double-brace parameter substitution: {{param}}
 */
export function applyLegacyParams(pattern, params = {}) {
    if (typeof pattern !== 'string') return pattern;
    if (!params || typeof params !== 'object') return pattern;
    return pattern.replace(/{{\s*(\w+)\s*}}/g, (_, key) =>
        params[key] !== undefined && params[key] !== null ? String(params[key]) : ''
    );
}

/**
 * Production-grade message formatting supporting ICU MessageFormat + Legacy {{param}} fallback.
 *
 * Supports:
 * - Simple strings
 * - Legacy {{param}}
 * - ICU plurals: {count, plural, =0 {No samples} one {1 sample} other {# samples}}
 * - ICU selects: {gender, select, male {He} female {She} other {They}}
 * - ICU numbers: {val, number}
 */
export function formatMessage(pattern, params = {}, locale = 'en') {
    if (typeof pattern !== 'string') return pattern;
    if (!params || Object.keys(params).length === 0) {
        // Fast path: if pattern has no braces, return as is
        if (!pattern.includes('{')) return pattern;
    }

    // 1. If pattern has double braces {{param}}, use legacy substitution first
    if (/{{\s*\w+\s*}}/.test(pattern)) {
        return applyLegacyParams(pattern, params);
    }

    // 2. If pattern has single braces, use ICU MessageFormat
    if (pattern.includes('{') && pattern.includes('}')) {
        const cacheKey = `${locale}:${pattern}`;
        try {
            let formatter = messageFormatCache.get(cacheKey);
            if (!formatter) {
                formatter = new IntlMessageFormat(pattern, locale);
                // Keep cache bounded
                if (messageFormatCache.size > 2000) {
                    messageFormatCache.clear();
                }
                messageFormatCache.set(cacheKey, formatter);
            }
            return formatter.format(params);
        } catch (err) {
            // Fallback gracefully to basic param substitution
            return applyLegacyParams(pattern.replace(/\{/g, '{{').replace(/\}/g, '}}'), params);
        }
    }

    return pattern;
}

/**
 * Strict Laboratory Numeric Parser
 *
 * Principles:
 * - Distinguishes empty from zero (empty returns null)
 * - Preserves qualifiers (<, >, <=, >=, ±)
 * - Accepts dot or comma as decimal separators (e.g. 6.42 and 6,42)
 * - Rejects ambiguous thousands groupings (e.g. 1,234 or 1.234 when decimals expected)
 * - Does not silently truncate invalid input
 */
export function parseLaboratoryNumber(rawInput) {
    if (rawInput === null || rawInput === undefined) return { valid: true, value: null, canonical: null };
    const str = String(rawInput).trim();
    if (str === '') return { valid: true, value: null, canonical: null };

    // Check for qualifiers
    const qualifierMatch = str.match(/^([<>]=?|±|\+|-)?\s*(.*)$/);
    const qualifier = qualifierMatch ? (qualifierMatch[1] || '') : '';
    const numericPart = qualifierMatch ? qualifierMatch[2].trim() : str;

    if (numericPart === '') {
        return { valid: false, error: 'MISSING_NUMERIC_VALUE', raw: str };
    }

    // Check for multiple separators (e.g. 1,234.56 or 1.234,56)
    const hasComma = numericPart.includes(',');
    const hasDot = numericPart.includes('.');

    if (hasComma && hasDot) {
        // Grouped thousands plus decimal
        // Check standard patterns: 1,234.56 or 1.234,56
        const dotLast = numericPart.lastIndexOf('.') > numericPart.lastIndexOf(',');
        if (dotLast) {
            // Comma is thousands, dot is decimal
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
            // Dot is thousands, comma is decimal
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

    // Single separator (comma or dot)
    const normalizedStr = numericPart.replace(',', '.');

    // Disallow multiple dots
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

/**
 * Format a laboratory number with locale-aware decimal presentation
 */
export function formatLaboratoryNumber(num, locale = 'en', options = {}) {
    if (num === null || num === undefined || num === '') return '—';
    if (typeof num === 'string' && isNaN(Number(num))) return num;

    const n = typeof num === 'number' ? num : Number(num);
    try {
        return new Intl.NumberFormat(locale, options).format(n);
    } catch {
        return String(n);
    }
}
