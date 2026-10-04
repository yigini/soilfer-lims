const { parseNumber, validateNumberFormat } = require('../../../shared/numberParse');
const validation = require('../../services/workbenchValidationService');
const { getStrictNumberFormat } = require('../../services/policyService');

describe('Audit 0.14: one number parser', () => {
    const format = getStrictNumberFormat();
    test.each([['6,85', 6.85], ['6.85', 6.85], ['0,125', 0.125], ['+6,85', 6.85], ['1e-3', 0.001], ['1,5E-3', 0.0015], ['12.3456', 12.3456]])('%s is unambiguous', (raw, number) => {
        expect(parseNumber(raw, format)).toMatchObject({ valid: true, value: number, canonical: String(number), rawInput: raw });
        expect(validation.parseDeterminationValue(raw, format)).toMatchObject({ isValid: true, normalizedValue: number, rawInput: raw });
    });
    test.each(['1,234', '1.234', '+1,234', '12.345', '1,234e-3'])('%s requires explicit clarification with no thousands policy', raw => {
        expect(parseNumber(raw, format)).toMatchObject({ valid: false, code: 'AMBIGUOUS_NUMBER' });
    });
    test.each(['6 ,42', '6.8.5', '1,234.5', 'NaN', 'Infinity', '1e', '1e3.5'])('%s fails with INVALID_NUMBER', raw => {
        expect(parseNumber(raw, format)).toMatchObject({ valid: false, code: 'INVALID_NUMBER' });
    });
    test.each([['<0,5', '<0.5'], ['< 0.5', '<0.5'], ['>100', '>100'], ['≤ 0,5', '<=0.5'], ['≥100', '>=100']])('qualified %s normalizes without losing its qualifier', (raw, canonical) => {
        expect(parseNumber(raw, format)).toMatchObject({ valid: true, canonical, rawInput: raw });
        expect(validation.parseDeterminationValue(raw, format)).toMatchObject({ isValid: true, raw: canonical, isCensored: true });
    });
    test('explicit grouping disambiguates both separators and rejects malformed groups', () => {
        const configured = { decimal: '.', thousands: ',' };
        expect(parseNumber('1,234', configured)).toMatchObject({ valid: true, value: 1234 });
        expect(parseNumber('1.234', configured)).toMatchObject({ valid: true, value: 1.234 });
        expect(parseNumber('1,234,567.8', configured)).toMatchObject({ valid: true, value: 1234567.8 });
        expect(parseNumber('6,85', configured)).toMatchObject({ valid: false, code: 'INVALID_NUMBER' });
        expect(parseNumber('12,34,567', configured).valid).toBe(false);
        expect(parseNumber("1'234,5", { decimal: ',', thousands: "'" }).value).toBe(1234.5);
        expect(parseNumber('1 234,5', { decimal: ',', thousands: ' ' }).value).toBe(1234.5);
        expect(parseNumber('1.234', { decimal: ',', thousands: null }).code).toBe('AMBIGUOUS_NUMBER');
    });
    test('invalid format fails closed and numeric JSON values are already unambiguous', () => {
        expect(validateNumberFormat({ decimal: ',', thousands: ',' })).toBe(false);
        expect(parseNumber('6,85', { decimal: ';', thousands: null }).code).toBe('NUMBER_FORMAT_POLICY_INVALID');
        expect(parseNumber(1.234, format)).toMatchObject({ valid: true, value: 1.234 });
    });
    test('texture uses the same parser, rejects internal spaces and preserves valid closure', () => {
        expect(validation.validateTextureFractions({ sand: '6,85', silt: '43,15', clay: '50' }, null, format)).toMatchObject({ isValid: true, fractions: { sand: 6.85, silt: 43.15, clay: 50 } });
        expect(validation.validateTextureFractions({ sand: '6 ,85', silt: '43,15', clay: '50' }, null, format)).toMatchObject({ isValid: false, code: 'INVALID_NUMBER' });
        expect(validation.validateTextureFractions({ sand: '1,234', silt: '48,766', clay: '50' }, null, format)).toMatchObject({ isValid: false, code: 'AMBIGUOUS_NUMBER' });
    });
});
