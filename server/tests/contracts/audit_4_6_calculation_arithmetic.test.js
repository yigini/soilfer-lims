const { calculate, validateTemplate, fitCurve, INPUTS, PARAMETERS } = require('../../../shared/soilCalculation');
const format = { decimal: '.', thousands: ',' };
// These are derived arithmetic examples, not claimed SOP worked examples.
// Reference metadata/precision and persisted lab activation are separate #199
// contracts. Every scalar below has an explicit unit and source equation.
function template(formulaModule, values = {}, outputUnit = '%', outputDecimals = 2) {
    return { formulaModule, inputs: INPUTS[formulaModule].map(key => ({ key, label: key, unit: 'fixture-defined', type: 'number', required: true })),
        parameters: PARAMETERS[formulaModule].map(key => ({ key, unit: 'fixture-defined', value: values[key], min: null, max: null })),
        outputUnit, outputDecimals, curve: formulaModule === 'COLORIMETRIC_PHOSPHORUS' ? { xUnit: 'mg/L', yUnit: 'absorbance' } : null };
}
const source = id => `https://openknowledge.fao.org/3/${id}/${id}.pdf`;
describe('Audit 4.6 shared, source-derived arithmetic', () => {
    test('derived moisture: SOP-20 v1, 24 Jan 2023, p7 §9; (32-30)/(30-10)*100 = 10%', () => {
        const citation = { url: source('cc4831en'), document: 'GLOSOLAN-SOP-20', version: 1, page: 7, section: '9', kind: 'derived' };
        expect(citation.page).toBe(7);
        const result = calculate(template('GRAVIMETRIC_MOISTURE', {}, '%', 1),
            { tareMass: '10', wetWithTare: '32', dryWithTare: '30' }, { numberFormat: format });
        expect(result.output).toBe(10);
        expect(result.intermediate).toMatchObject({ wetMass: 22, dryMass: 20, waterMass: 2, moistureCorrectionFactor: 1.1 });
        expect(result.intermediate.ovenDryMassFraction).toBeCloseTo(20 / 22, 14);
        expect(result.inputs.wetWithTare).toBe('32');
    });
    test('derived WB 1.30: SOP-02 v1, 28 Oct 2019, pp15–16 §9.1; (20-12)*0.5*0.003*100*1.30/1 = 1.56%', () => {
        const citation = { url: source('ca7471en'), document: 'GLOSOLAN-SOP-02', version: 1, pages: [15, 16], section: '9.1', kind: 'derived' };
        expect(citation.pages).toEqual([15, 16]);
        const result = calculate(template('WALKLEY_BLACK', { ferrousNormality: 0.5, carbonGramsPerMilliEquivalent: 0.003, recoveryFactor: 1.30 }),
            { blankTitre: '20', sampleTitre: '12', sampleMass: '1', moistureCorrectionFactor: '1' }, { numberFormat: format });
        expect(result.output).toBe(1.56);
        expect(result.intermediate).toMatchObject({ titreDifference: 8, carbonMass: 0.012 });
    });
    test('WB recovery remains supplied by the immutable template, including the separately published 1.33 variant', () => {
        // EPA/600/R-02/069, September 2002, p10, describes the 1.33
        // correction variant. Its arithmetic is derived using SOP-02 §9.1:
        // 8 * 0.5 * 0.003 * 100 * 1.33 / 1 = 1.596 -> 1.60%.
        const input = { blankTitre: '20', sampleTitre: '12', sampleMass: '1', moistureCorrectionFactor: '1' };
        const labA = template('WALKLEY_BLACK', { ferrousNormality: 0.5, carbonGramsPerMilliEquivalent: 0.003, recoveryFactor: 1.30 });
        const labB = template('WALKLEY_BLACK', { ferrousNormality: 0.5, carbonGramsPerMilliEquivalent: 0.003, recoveryFactor: 1.33 });
        expect(calculate(labA, input, { numberFormat: format }).output).toBe(1.56);
        expect(calculate(labB, input, { numberFormat: format }).output).toBe(1.60);
        expect(calculate(labB, input, { numberFormat: format }).parameters).toEqual(labB.parameters);
        expect(labA.parameters.find(p => p.key === 'recoveryFactor').value).toBe(1.30);
    });
    test.each([
        ['Olsen', 'cb3644en', 'GLOSOLAN-SOP-10', 7],
        ['Bray-1', 'cb3460en', 'GLOSOLAN-SOP-09', 8]
    ])('derived %s P: %s, %s v1, 13 Jan 2021 p%s §9', (_, id, document, page) => {
        const citation = { url: source(id), document, version: 1, page, section: '9', kind: 'derived' };
        expect(citation.section).toBe('9');
        // Free intercept curve gives (0.55-0.05)/0.25 = 2 mg/L;
        // (2-0.1)*100*2*1.1/5 = 83.6 mg/kg, rounded to 2 decimals.
        const result = calculate(template('COLORIMETRIC_PHOSPHORUS', {}, 'mg/kg'), {
            absorbance: '0.55', blankConcentration: '0.1', extractVolume: '100', dilutionFactor: '2', sampleMass: '5', moistureCorrectionFactor: '1.1'
        }, { numberFormat: format, curve: { slope: 0.25, intercept: 0.05 } });
        expect(result.output).toBe(83.6);
        expect(result.intermediate.concentration).toBe(2);
    });
    test.each([['Ca', 40.08, 2], ['Mg', 24.31, 2], ['K', 39.098, 1], ['Na', 22.99, 1]])(
        'derived %s: SOP-17 v1, 26 July 2022 p9 §9.2; (atomicMass/charge)*100/5/(atomicMass/charge*10) = 2 cmol(+)/kg', (_, atomicMass, charge) => {
            const citation = { url: source('cc1200en'), document: 'GLOSOLAN-SOP-17', version: 1, page: 9, section: '9.2', kind: 'derived' };
            expect(citation.page).toBe(9);
            const equivalentWeight = atomicMass / charge;
            const result = calculate(template('EXCHANGEABLE_CATION', { equivalentWeight }, 'cmol(+)/kg', 6), {
                reading: equivalentWeight, blankConcentration: '0', extractVolume: '100', dilutionFactor: '1', sampleMass: '5'
            }, { numberFormat: format });
            expect(result.output).toBe(2);
            expect(result.intermediate.mgPerKg).toBeCloseTo(equivalentWeight * 20, 12);
        });
    test('derived CEC: SOP-17 v1, 26 July 2022 p9 §9.1; (2.5-0.5)*0.01*100/5*100/50 = 0.8 cmol(+)/kg', () => {
        const result = calculate(template('CEC_TITRATION', { acidNormality: 0.01 }, 'cmol(+)/kg', 6), {
            sampleTitre: '2.5', blankTitre: '0.5', sampleMass: '5', extractVolume: '100', aliquotVolume: '50'
        }, { numberFormat: format });
        expect(result.output).toBe(0.8);
        expect(result.intermediate.aliquotFactor).toBe(2);
    });
    test('derived Kjeldahl: SOP-14 v1, 18 Jan 2021 pp10–11 §9; (10.5-0.5)*0.02*14.0067/1/10 = 0.280134% -> 0.28%', () => {
        const result = calculate(template('KJELDAHL', { acidNormality: 0.02, nitrogenMgPerMilliMole: 14.0067 }), {
            sampleTitre: '10.5', blankTitre: '0.5', sampleMass: '1'
        }, { numberFormat: format });
        expect(result.output).toBe(0.28);
        expect(result.intermediate.mgPerGram).toBeCloseTo(2.80134, 12);
    });
    test('comma decimals use the supplied lab format and preserve exact input strings', () => {
        const result = calculate(template('KJELDAHL', { acidNormality: 0.02, nitrogenMgPerMilliMole: 14.0067 }), {
            sampleTitre: '10,5', blankTitre: '0,5', sampleMass: '1'
        }, { numberFormat: { decimal: ',', thousands: '.' } });
        expect(result.output).toBe(0.28); expect(result.inputs.sampleTitre).toBe('10,5');
    });
    test.each([null, {}, { sampleTitre: '', blankTitre: 0, sampleMass: 1 }])('missing raw input refuses with the pinned code', inputs => {
        expect(() => calculate(template('KJELDAHL', { acidNormality: 0.02, nitrogenMgPerMilliMole: 14.0067 }), inputs, { numberFormat: format }))
            .toThrow(expect.objectContaining({ code: 'CALC_INPUT_REQUIRED', statusCode: 422 }));
    });
    test.each(['<1', 'NaN', 'Infinity', '10 mg'])('a qualified or malformed raw input %s cannot pretend to be a reading', sampleMass => {
        expect(() => calculate(template('KJELDAHL', { acidNormality: 0.02, nitrogenMgPerMilliMole: 14.0067 }), {
            sampleTitre: 10, blankTitre: 0, sampleMass
        }, { numberFormat: format })).toThrow(expect.objectContaining({ code: 'CALC_INPUT_INVALID' }));
    });
    test.each([0, -1])('invalid denominator %s refuses rather than clamping or yielding infinity', sampleMass => {
        expect(() => calculate(template('KJELDAHL', { acidNormality: 0.02, nitrogenMgPerMilliMole: 14.0067 }), {
            sampleTitre: 10, blankTitre: 0, sampleMass
        }, { numberFormat: format })).toThrow(expect.objectContaining({ code: 'CALC_INPUT_INVALID' }));
    });
    test('a negative blank-corrected result remains numerical evidence; the engine applies no QC acceptance limits', () => {
        expect(calculate(template('KJELDAHL', { acidNormality: 0.02, nitrogenMgPerMilliMole: 14.0067 }), {
            sampleTitre: 0, blankTitre: 1, sampleMass: 1
        }, { numberFormat: format }).output).toBe(-0.03);
    });
    test('templates cannot supply executable formula strings or omit required method constants', () => {
        expect(() => validateTemplate({ ...template('KJELDAHL'), formulaModule: 'eval(input)' })).toThrow(expect.objectContaining({ code: 'CALC_TEMPLATE_INVALID' }));
        expect(() => validateTemplate(template('KJELDAHL', { acidNormality: 0 }))).toThrow(expect.objectContaining({ code: 'CALC_TEMPLATE_INVALID' }));
    });
    test('OLS is unweighted, free-intercept; a zero standard counts and replicate standards do not inflate distinct levels', () => {
        const points = [0, 1, 1, 2, 3, 4].map(x => ({ standardConcentration: x, response: 0.05 + x * 0.25 }));
        const result = fitCurve(points);
        expect(result).toMatchObject({ levelCount: 5, calibrationMax: 4, usable: true });
        expect(result.slope).toBeCloseTo(0.25, 14); expect(result.intercept).toBeCloseTo(0.05, 14);
        expect(result.r).toBeCloseTo(1, 14); expect(result.rSquared).toBeCloseTo(1, 14);
        expect(points).toHaveLength(6);
    });
    test('Pearson r retains its sign; r-squared cannot turn a negative slope into a passing positive-correlation curve', () => {
        const result = fitCurve([0, 1, 2, 3, 4].map(x => ({ standardConcentration: x, response: 5 - x })));
        expect(result.r).toBe(-1); expect(result.rSquared).toBe(1); expect(result.slope).toBe(-1);
    });
    test.each([
        [{ standardConcentration: 1, response: 1 }],
        [{ standardConcentration: 1, response: 1 }, { standardConcentration: 1, response: 2 }],
        [{ standardConcentration: 0, response: 1 }, { standardConcentration: 1, response: 1 }]
    ])('degenerate standards have no usable fit, rather than invented coefficients', points => {
        expect(fitCurve(points)).toMatchObject({ usable: false, slope: null, intercept: null, r: null, rSquared: null });
    });
});
