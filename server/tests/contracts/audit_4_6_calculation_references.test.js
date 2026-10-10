const { REFERENCES, referenceRows } = require('../../services/calculationReferenceLibrary');
const { calculate, validateTemplate } = require('../../../shared/soilCalculation');
const { UNITS } = require('../../seeds/units');
const catalogue = require('../../seeds/data/catalogue.json');
const format = { decimal: '.', thousands: ',' };
const unit = code => {
    const definition = UNITS.find(row => row.code === code);
    if (!definition) throw Error(`No actual controlled unit: ${code}`);
    const { quantityKind, factorToBase } = definition; return { code, quantityKind, factorToBase };
};
const byKey = key => REFERENCES.find(row => row.templateKey === key);
// These are explicit test-local SOP precision choices for references requiring
// verification. They do not activate a reference or introduce production defaults.
function localFixture(key, decimals = 6) {
    const row = structuredClone(byKey(key));
    if (row.outputDecimals === null) {
        row.outputDecimals = decimals;
        row.precisionSource = { kind: 'LOCAL_SOP', citation: 'Synthetic golden-test SOP, fixed reporting precision.' };
    }
    return row;
}
function compute(key, inputs, reportingUnit, options = {}) {
    const row = localFixture(key, options.decimals);
    return calculate(row, inputs, { numberFormat: format,
        units: { native: unit(row.outputUnit), reporting: unit(reportingUnit || row.outputUnit) }, curve: options.curve });
}

test('the eleven published method variants form an inactive library with no lab/preset/method activation', () => {
    expect(REFERENCES.map(row => row.templateKey)).toEqual([
        'gravimetric-moisture', 'walkley-black-130', 'walkley-black-133', 'olsen-phosphorus', 'bray1-phosphorus',
        'exchangeable-ca', 'exchangeable-mg', 'exchangeable-k', 'exchangeable-na', 'cec-titration', 'kjeldahl-nitrogen'
    ]);
    for (const row of REFERENCES) {
        expect(row).toMatchObject({ status: 'REFERENCE', labId: null, methodologyId: null, parentTemplateId: null, version: 1 });
        expect(validateTemplate(row)).toBe(row);
        expect(catalogue.analyses.some(analysis => analysis.code === row.analysisCode)).toBe(true);
        expect(unit(row.outputUnit).factorToBase).toBeGreaterThan(0);
        expect(row.sourceCitation.workedExampleKind).toBe('DERIVED');
        expect(row.sourceCitation.sources.every(source => ['PRIMARY_SOP', 'PRIMARY_RESEARCH'].includes(source.sourceKind))).toBe(true);
    }
    expect(REFERENCES.some(row => /Mehlich|texture|hydrometer|sum of/i.test(row.variant))).toBe(false);
});

test('minimum, conditional and unspecified source precision stay NULL until explicit local SOP verification', () => {
    const fixed = REFERENCES.filter(row => row.outputDecimals !== null);
    expect(fixed.map(row => row.templateKey)).toEqual(['walkley-black-130', 'olsen-phosphorus', 'bray1-phosphorus']);
    for (const row of fixed) expect(row.precisionSource).toMatchObject({ kind: 'FIXED_PUBLISHED', unit: row.outputUnit });
    for (const row of REFERENCES.filter(row => row.outputDecimals === null)) {
        expect(row.precisionSource).toBeNull();
        expect(() => calculate(row, {})).toThrow(expect.objectContaining({ code: 'CALC_TEMPLATE_PRECISION_REQUIRED', statusCode: 422 }));
    }
    expect(byKey('gravimetric-moisture').sourceCitation.sourceRule).toMatchObject({ unit: '%', kind: 'MINIMUM_PRECISION',
        rule: 'The result must be reported to a minimum accuracy of one decimal place.' });
});

test('Kjeldahl retains the verbatim conditional rule and exact source location without creating a conditional rounding engine', () => {
    const row = byKey('kjeldahl-nitrogen');
    expect(row.outputDecimals).toBeNull(); expect(row.precisionSource).toBeNull();
    expect(row.sourceCitation.sourceRule).toMatchObject({ document: 'GLOSOLAN-SOP-14', version: 1, date: '2021-01-18',
        section: '9', pages: [11], pdfPage: 14, kind: 'CONDITIONAL_PRECISION', executable: false, thresholdUnit: null,
        unit: 'Not stated by the source. SOP-14 §9 (printed pp.10–11, PDF pp.13–14) permits mg/g or g/kg, or %N after division by ten; its precision thresholds do not specify the unit.',
        rule: 'The number of decimals reported must conform to the conventional rules of maintaining 3 digits:\n• values greater than 100, no decimal reported;\n• values between 10 and 100, 1 decimal (0.1) reported; and\n• values less than 10, 2 decimals (0.01) reported.' });
});

test('WB1.33 has the accepted primary variant source and the shared SOP equation, without invented source precision', () => {
    const row = byKey('walkley-black-133');
    expect(row.sourceCitation.sources).toEqual(expect.arrayContaining([
        expect.objectContaining({ doi: '10.1002/saj2.20165', section: '2.3', sourceKind: 'PRIMARY_RESEARCH' }),
        expect.objectContaining({ document: 'GLOSOLAN-SOP-02', section: '9.1' })
    ]));
    expect(row.outputDecimals).toBeNull(); expect(row.precisionSource).toBeNull();
});

test('library values are immutable and database serialization preserves the scientific and precision evidence', () => {
    expect(Object.isFrozen(REFERENCES)).toBe(true);
    for (const row of REFERENCES) {
        expect(Object.isFrozen(row.parameters)).toBe(true); expect(Object.isFrozen(row.sourceCitation.sources)).toBe(true);
        const serialized = referenceRows().find(value => value.id === row.id);
        const decoded = { ...serialized, inputs: JSON.parse(serialized.inputs), parameters: JSON.parse(serialized.parameters),
            curve: serialized.curve == null ? null : JSON.parse(serialized.curve),
            precisionSource: serialized.precisionSource == null ? null : JSON.parse(serialized.precisionSource), sourceCitation: JSON.parse(serialized.sourceCitation) };
        expect(decoded).toEqual(row); expect(validateTemplate(decoded)).toEqual(row);
    }
});

test('derived moisture golden from SOP20 §9 retains dry fraction and correction separately', () => {
    const result = compute('gravimetric-moisture', { tareMass: '10', wetWithTare: '32', dryWithTare: '30' }, '%', { decimals: 1 });
    expect(result.nativeValue).toBe(10); expect(result.output).toBe(10);
    expect(result.intermediate.moistureCorrectionFactor).toBe(1.1);
    expect(result.intermediate.ovenDryMassFraction).toBeCloseTo(20 / 22, 14);
});
test.each([['walkley-black-130', 1.56, 15.6], ['walkley-black-133', 1.596, 15.96]])(
    'derived %s golden converts native percent to the actual SOC reporting unit before rounding', (key, native, reported) => {
        const result = compute(key, { sampleMass: '1', blankTitre: '20', sampleTitre: '12', moistureCorrectionFactor: '1' }, 'g/kg', { decimals: 2 });
        expect(result.nativeValue).toBeCloseTo(native, 14); expect(result.nativeUnit).toBe('pct_mass');
        expect(result.conversionFactor).toBe(10); expect(result.unroundedOutput).toBeCloseTo(reported, 12); expect(result.output).toBe(reported);
    });
test.each(['olsen-phosphorus', 'bray1-phosphorus'])('derived %s golden uses the selected free-intercept curve and recorded scale inputs', key => {
    const result = compute(key, { absorbance: '0.55', blankConcentration: '0.1', extractVolume: '100', dilutionFactor: '2',
        sampleMass: '5', moistureCorrectionFactor: '1.1' }, 'mg/kg', { curve: { slope: 0.25, intercept: 0.05 } });
    expect(result.intermediate.concentration).toBe(2); expect(result.output).toBe(83.6);
});
test.each([['ca', 20.04], ['mg', 12.155], ['k', 39.098], ['na', 22.99]])(
    'derived exchangeable %s golden uses the source atomic mass/charge and measured concentration without a curve', (key, equivalentWeight) => {
        const row = byKey(`exchangeable-${key}`); expect(row.curve).toBeNull();
        expect(row.parameters.find(value => value.key === 'equivalentWeight').value).toBe(equivalentWeight);
        const result = compute(row.templateKey, { reading: equivalentWeight, blankConcentration: '0', extractVolume: '100', dilutionFactor: '1', sampleMass: '5' });
        expect(result.output).toBe(2); expect(result.intermediate.mgPerKg).toBeCloseTo(equivalentWeight * 20, 10);
    });
test('derived CEC golden uses actual aliquot/extract volumes and equivalent normality', () => {
    const result = compute('cec-titration', { sampleTitre: '2.5', blankTitre: '0.5', sampleMass: '5', extractVolume: '100', aliquotVolume: '50' });
    expect(result.intermediate.aliquotFactor).toBe(2); expect(result.output).toBe(0.8);
});
test('derived Kjeldahl golden uses H+ equivalent concentration and rounds once after native percent→g/kg', () => {
    const result = compute('kjeldahl-nitrogen', { sampleTitre: '10.5', blankTitre: '0.5', sampleMass: '1' }, 'g/kg', { decimals: 3 });
    expect(result.nativeValue).toBeCloseTo(0.280134, 14); expect(result.unroundedOutput).toBeCloseTo(2.80134, 13);
    expect(result.output).toBe(2.801); expect(result.inputs.sampleTitre).toBe('10.5');
});
