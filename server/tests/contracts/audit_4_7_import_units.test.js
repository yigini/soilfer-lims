const { numericReportingUnit } = require('../../services/resultReportingUnit');
const read = (analysis, unit, param = analysis.code, method = null) => numericReportingUnit({ analysis, method }, { param, unit }, { instrumentImport: true });
const analysis = { code: 'OWNED_DIRECT', units: 'mg/kg', unitCode: 'MASS_FRACTION_CODE' };
test.each([['mg/kg', 'units'], ['MASS_FRACTION_CODE', 'unitCode']])('direct import unit %s retains the exact catalogue fields and matched source', (unit, matchedField) => {
    expect(read(analysis, unit)).toEqual({ unit, evidence: { analysisId: analysis.code, units: analysis.units,
        unitCode: analysis.unitCode, matchedField, matchedValue: unit } });
});
test.each(['MG/KG', 'milligrams/kilogram', ' mg/kg ', '%'])('an unconfigured synonym, case, whitespace or unrelated unit %s refuses', unit => {
    expect(() => read(analysis, unit)).toThrow(expect.objectContaining({ statusCode: 409, code: 'IMPORT_UNIT_MISMATCH' }));
});
test('an absent catalogue unit refuses even when the method or source supplies a unit', () => {
    expect(() => read({ code: 'NO_UNIT', units: null, unitCode: null }, 'mg/kg', 'NO_UNIT', { unit: 'mg/kg', qudtUnit: 'http://qudt.org/vocab/unit/MilliGM-PER-KiloGM' }))
        .toThrow(expect.objectContaining({ statusCode: 409, code: 'IMPORT_UNIT_UNAVAILABLE' }));
});
test('texture fractions accept only percent on a texture analysis and retain the original catalogue values', () => {
    const texture = { code: 'TEXTURE', units: 'USDA_12_CLASS', unitCode: null };
    expect(read(texture, '%', 'SAND')).toEqual({ unit: '%', evidence: { analysisId: 'TEXTURE', units: 'USDA_12_CLASS', unitCode: null, matchedField: 'textureFraction', matchedValue: '%' } });
    expect(() => read(texture, 'percent', 'SAND')).toThrow(expect.objectContaining({ code: 'IMPORT_UNIT_MISMATCH' }));
    expect(() => read(analysis, '%', 'SAND')).toThrow(expect.objectContaining({ code: 'IMPORT_UNIT_MISMATCH' }));
});
test('QC analytes use the same catalogue authority without QUDT aliases or conversions', () => {
    const qc = { code: 'OWNED_QC', units: null, unitCode: 'g/kg' };
    expect(read(qc, 'g/kg').evidence).toEqual({ analysisId: qc.code, units: null, unitCode: 'g/kg', matchedField: 'unitCode', matchedValue: 'g/kg' });
    expect(() => read(qc, 'http://qudt.org/vocab/unit/GM-PER-KiloGM')).toThrow(expect.objectContaining({ code: 'IMPORT_UNIT_MISMATCH' }));
});
test('the existing typed-writer defaults, method fallback and refusal retain their original behavior', () => {
    expect(numericReportingUnit({ analysis }, { param: analysis.code })).toBe('mg/kg');
    expect(numericReportingUnit({ analysis, method: { unit: 'retained-method-unit' } }, { param: analysis.code })).toBe('retained-method-unit');
    expect(() => numericReportingUnit({ analysis }, { param: analysis.code, unit: 'wrong-unit' })).toThrow(expect.objectContaining({ code: 'RESULT_UNIT_MISMATCH' }));
    expect(numericReportingUnit({ analysis: { code: 'CODE_ONLY', units: null, unitCode: 'g/kg' } }, { param: 'CODE_ONLY', unit: 'retained-existing-writer-behavior' })).toBe('retained-existing-writer-behavior');
});
