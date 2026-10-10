// #199: scientific references are inactive library entries, never lab policy
// presets or implicit activations. Local managers verify method and precision.
const { validateTemplate } = require('../../shared/soilCalculation');
const frozen = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
    return value;
};
const sop = (document, id, date, pages, section) => ({ document, version: 1, date, pages, section,
    url: `https://openknowledge.fao.org/3/${id}/${id}.pdf`, sourceKind: 'PRIMARY_SOP' });
const moisture = sop('GLOSOLAN-SOP-20', 'cc4831en', '2023-01-24', [7], '9');
const wb = sop('GLOSOLAN-SOP-02', 'ca7471en', '2019-10-28', [15, 16], '9.1');
const olsen = sop('GLOSOLAN-SOP-10', 'cb3644en', '2021-01-13', [7], '9');
const bray = sop('GLOSOLAN-SOP-09', 'cb3460en', '2021-01-13', [8], '9');
const cec = { ...sop('GLOSOLAN-SOP-17', 'cc1200en', '2022-07-26', [9], '9.1'), pdfPage: 12,
    equation: 'Section9.1 CEC equation: titre difference × acid normality ×100/soil mass ×extract/aliquot volumes.',
    moistureCorrection: 'The printed equation has no additional moisture correction factor. Verify the sample mass basis against the local SOP before activation.' };
const cations = { ...cec, section: '9.2',
    equation: 'Section9.2 Ca/Mg/Na/K equations: blank-corrected extract concentration ×extract/soil mass ×charge/atomic mass /10 ×dilution factor.' };
const kjeldahl = { ...sop('GLOSOLAN-SOP-14', 'cb3642en', '2021-01-18', [10, 11], '9'), pdfPage: 13,
    equation: 'Section9 N equation: (V1−V0) ×c(H+) ×MN /m, in mg/g or g/kg. PDF page14 describes division by ten for percent N.',
    moistureCorrection: 'The printed equation has no additional moisture correction factor. PDF page14 allows air-dry or oven-dry40°C reporting; verify the local sample mass basis before activation.' };
const wb133 = { document: 'Bierer et al., Evaluation of a microplate spectrophotometer for soil organic carbon determination in south-central Idaho',
    publication: 'Soil Science Society of America Journal 85 (2021) 438–451', doi: '10.1002/saj2.20165',
    section: '2.3', url: 'https://acsess.onlinelibrary.wiley.com/doi/10.1002/saj2.20165', sourceKind: 'PRIMARY_RESEARCH' };
const input = (key, label, unit) => ({ key, label, unit, type: 'number', required: true });
const parameter = (key, label, unit, value, citation) => ({ key, label, unit, value, min: null, max: null, citation });
const titres = [input('sampleTitre', 'Sample titre', 'mL'), input('blankTitre', 'Blank titre', 'mL'), input('sampleMass', 'Soil sample mass', 'g')];
const wbInputs = [input('sampleMass', 'Soil sample mass', 'g'), input('blankTitre', 'Blank titre', 'mL'),
    input('sampleTitre', 'Sample titre', 'mL'), input('moistureCorrectionFactor', 'Measured moisture correction factor', '1')];
const pInputs = [input('absorbance', 'Sample absorbance', 'absorbance'), input('blankConcentration', 'Blank concentration', 'mg/L'),
    input('extractVolume', 'Extract volume', 'mL'), input('dilutionFactor', 'Recorded dilution factor', '1'),
    input('sampleMass', 'Soil sample mass', 'g'), input('moistureCorrectionFactor', 'Measured moisture correction factor', '1')];

function reference(key, analysisCode, variant, formulaModule, inputs, parameters, outputUnit, sources,
    { outputDecimals = null, precisionSource = null, sourceRule = null, notes = [] } = {}) {
    const row = { id: `calc-ref-${key}-v1`, templateKey: key, labId: null, parentTemplateId: null, version: 1,
        analysisCode, methodologyId: null, variant, formulaModule, inputs, parameters, outputUnit, outputDecimals, precisionSource,
        curve: formulaModule === 'COLORIMETRIC_PHOSPHORUS' ? { xUnit: 'mg/L', yUnit: 'absorbance' } : null,
        status: 'REFERENCE', sourceCitation: { sources, workedExampleKind: 'DERIVED', sourceRule, notes },
        createdBy: 'system:calculation-reference', createdAt: '2026-10-09T00:00:00.000Z',
        reason: 'Published method reference; inactive until local SOP verification.' };
    validateTemplate(row);
    return row;
}
const wbParameters = (recoveryFactor, variantSource) => [
    parameter('ferrousNormality', 'Ferrous titrant equivalent concentration', 'eq/L', 0.5,
        { ...variantSource, note: '0.5 mol/L Fe(II) is 0.5 eq/L for the one-electron Fe(II)/Fe(III) reaction; verify actual standardized titrant in the local SOP.' }),
    parameter('carbonGramsPerMilliEquivalent', 'Carbon equivalent mass', 'g/meq', 0.003,
        { ...wb, note: 'One mL of 1 N dichromate represents 3 mg carbon.' }),
    parameter('recoveryFactor', 'Published carbon recovery factor', '1', recoveryFactor, variantSource)
];
const fixedPrecision = (decimals, source, unit) => ({ outputDecimals: decimals,
    precisionSource: { ...source, unit, rule: `Report to ${decimals} decimal places.`, kind: 'FIXED_PUBLISHED' } });

const REFERENCES = frozen([
    reference('gravimetric-moisture', 'SOIL_MOISTURE', 'GLOSOLAN gravimetric moisture on dry-soil basis', 'GRAVIMETRIC_MOISTURE',
        [input('tareMass', 'Container tare mass', 'g'), input('wetWithTare', 'Container and air-dry soil mass', 'g'),
            input('dryWithTare', 'Container and oven-dry soil mass', 'g')], [], '%', [moisture], {
            sourceRule: { ...moisture, unit: '%', rule: 'The result must be reported to a minimum accuracy of one decimal place.', kind: 'MINIMUM_PRECISION' },
            notes: ['The source gives a minimum rather than one fixed precision; a verified local clone must choose decimals.',
                'Water content = (wet soil - dry soil) / dry soil × 100; dry mass fraction = dry / wet; moisture correction factor = wet / dry. These secondary outputs never change another Result.'] }),
    reference('walkley-black-130', 'SOC', 'Walkley-Black recovery 1.30', 'WALKLEY_BLACK', wbInputs,
        wbParameters(1.30, wb), 'pct_mass', [wb], fixedPrecision(2, wb, 'pct_mass')),
    reference('walkley-black-133', 'SOC', 'Walkley-Black recovery 1.33', 'WALKLEY_BLACK', wbInputs,
        wbParameters(1.33, wb133), 'pct_mass', [wb133, wb], { notes: ['The primary research establishes this separate 1.33 recovery variant; the shared titration equation is SOP-02 §9.1. No fixed reporting precision is specified for the variant.'] }),
    reference('olsen-phosphorus', 'P_OLSEN', 'Olsen colorimetric phosphorus', 'COLORIMETRIC_PHOSPHORUS', pInputs,
        [], 'mg/kg', [olsen], fixedPrecision(2, olsen, 'mg/kg')),
    reference('bray1-phosphorus', 'P_BRAY1', 'Bray-1 colorimetric phosphorus', 'COLORIMETRIC_PHOSPHORUS', pInputs,
        [], 'mg/kg', [bray], fixedPrecision(2, bray, 'mg/kg')),
    ...[['ca', 'EXCH_CA', 'Calcium', 40.08, 2], ['mg', 'EXCH_MG', 'Magnesium', 24.31, 2],
        ['k', 'EXCH_K', 'Potassium', 39.098, 1], ['na', 'EXCH_NA', 'Sodium', 22.99, 1]].map(([key, code, name, atomicMass, charge]) =>
        reference(`exchangeable-${key}`, code, `${name}: measured extract by AAS/ICP or flame emission`, 'EXCHANGEABLE_CATION',
            [input('reading', 'Measured sample extract concentration', 'mg/L'), input('blankConcentration', 'Measured blank concentration', 'mg/L'),
                input('extractVolume', 'Extract volume', 'mL'), input('dilutionFactor', 'Recorded dilution factor', '1'), input('sampleMass', 'Soil sample mass', 'g')],
            [parameter('equivalentWeight', `${name} equivalent mass`, 'g/eq', atomicMass / charge,
                { ...cations, atomicMass, atomicMassUnit: 'g/mol', charge, note: 'Published atomic mass divided by ionic charge. Convert mg/kg to cmol(+)/kg by dividing by ten times this equivalent mass.' })],
            'cmol(+)/kg', [cations], { notes: ['Instrument-derived extract concentration is an input; this template does not declare or require a LIMS calibration curve.', 'No fixed reporting precision is given in this source.'] })),
    reference('cec-titration', 'CEC', 'Ammonium acetate CEC by distillation and titration', 'CEC_TITRATION',
        [...titres, input('extractVolume', 'Total extract volume', 'mL'), input('aliquotVolume', 'Distilled aliquot volume', 'mL')],
        [parameter('acidNormality', 'Standardized acid equivalent concentration', 'eq/L', 0.01,
            { ...cec, procedureSection: '8.9', note: 'SOP-17 uses 0.01 N HCl or H2SO4; this parameter is equivalent concentration, not molecular concentration.' })],
        'cmol(+)/kg', [cec], { notes: ['The source calculation uses a 50 mL distilled aliquot from a 100 mL extract; both actual volumes are recorded inputs.', 'No fixed reporting precision is given in this source.'] }),
    reference('kjeldahl-nitrogen', 'TN', 'Kjeldahl nitrogen', 'KJELDAHL', titres,
        [parameter('acidNormality', 'Standardized acid equivalent concentration', 'eq/L', 0.02,
            { ...kjeldahl, pages: [10], note: 'SOP-14 §9 example: 0.01 mol/L H2SO4 yields c(H+) = 0.02 mol/L; use the actual standardized H+ equivalent concentration in the local SOP.' }),
        parameter('nitrogenMgPerMilliMole', 'Nitrogen molar mass', 'mg/mmol', 14.0067, { ...kjeldahl, pages: [10] })],
        'pct_mass', [kjeldahl], { sourceRule: { ...kjeldahl, pages: [11], pdfPage: 14, unit: 'Reported N in mg/g, g/kg or %N (the source reporting choices)', kind: 'CONDITIONAL_PRECISION',
            rule: 'The number of decimals reported must conform to the conventional rules of maintaining 3 digits:\n• values greater than 100, no decimal reported;\n• values between 10 and 100, 1 decimal (0.1) reported; and\n• values less than 10, 2 decimals (0.01) reported.' },
            notes: ['The equation produces mg/g or g/kg; division by ten yields native pct_mass. The source permits mg/g, g/kg or %N reporting. No threshold conversion or rounding is inferred for a different reporting unit.',
                'Pin6087996018: conditional rounding is not executable in this release. A verified local clone must select a fixed reporting precision.'] })
]);

function referenceRows() {
    return REFERENCES.map(row => ({ ...row, inputs: JSON.stringify(row.inputs), parameters: JSON.stringify(row.parameters),
        curve: row.curve == null ? null : JSON.stringify(row.curve),
        sourceCitation: JSON.stringify(row.sourceCitation), precisionSource: row.precisionSource == null ? null : JSON.stringify(row.precisionSource) }));
}
module.exports = { REFERENCES, referenceRows };
