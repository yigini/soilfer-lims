const { evaluateCrossParameters } = require('../../services/crossParameterEvaluator');
const { registry } = require('../../config/policyRegistry');
const { calculateUsdaTexture } = require('../../utils/soilCalculations');
const snapshot = changes => ({ version: 3, values: { ...Object.fromEntries(Object.entries(registry)
    .filter(([key]) => key.startsWith('crossCheck.')).map(([key, row]) => [key, row.presets.ISO17025_STRICT])), ...changes } });
const input = (param, numericValue, unit = 'g/kg', extra = {}) => ({ id: param + '-result', param,
    numericValue, value: 'retained text; never parsed', unit, basis: 'AIR_DRY', censoring: 'NONE', ...extra });
const check = (code, rows, policy = snapshot()) => evaluateCrossParameters(rows, policy).find(row => row.ruleCode === code);
const cn = (carbon = 12, nitrogen = 1, unit = 'g/kg') => [input('SOC', carbon, unit), input('TN', nitrogen, unit)];
const bases = (na = true) => [input('EXCH_CA', 6, 'cmol(+)/kg'), input('EXCH_MG', 5, 'cmol(+)/kg'),
    input('EXCH_K', 2, 'cmol(+)/kg'), ...(na ? [input('EXCH_NA', 0, 'cmol(+)/kg')] : []), input('CEC', 10, 'cmol(+)/kg')];

describe('Audit 4.8: cross-parameter science from stored evidence', () => {
    test('the 1.3 × CEC sample flags both base rules and retains every used input', () => {
        const rows = bases(), before = structuredClone(rows), evaluations = evaluateCrossParameters(rows, snapshot());
        expect(evaluations.find(row => row.ruleCode === 'BASES_CEC')).toMatchObject({ outcome: 'FLAGGED',
            flagCode: 'CROSS_CHECK_BASES_GT_CEC', reasonCode: null, severity: 'ADVISORY',
            thresholds: { policyVersion: 3, 'crossCheck.basesCecFactor': 1.1 } });
        expect(evaluations.find(row => row.ruleCode === 'BASE_SATURATION')).toMatchObject({ outcome: 'FLAGGED', flagCode: 'CROSS_CHECK_BASE_SAT_GT_MAX' });
        expect(evaluations.find(row => row.ruleCode === 'BASES_CEC').inputs.values.map(row => row.resultIds))
            .toEqual(rows.map(row => [row.id]));
        expect(rows).toEqual(before);
    });
    test.each(['BASES_CEC', 'BASE_SATURATION'])('missing Na is a recorded lower bound, flags only when %s is already exceeded', code => {
        const flagged = check(code, bases(false));
        expect(flagged).toMatchObject({ outcome: 'FLAGGED', inputs: { missing: ['EXCH_NA'], lowerBound: true } });
        expect(flagged.inputs.values.map(row => row.analysisCode)).not.toContain('EXCH_NA');
        const low = bases(false).map(row => row.param === 'EXCH_CA' ? { ...row, numericValue: 1 } : row);
        expect(check(code, low)).toMatchObject({ outcome: 'NOT_EVALUATED', reasonCode: 'INPUT_MISSING' });
    });
    test('base limits are strict and come from the provided policy, including partial Na cases', () => {
        const rows = bases();
        expect(check('BASES_CEC', rows, snapshot({ 'crossCheck.basesCecFactor': 1.3 })).outcome).toBe('PASS');
        expect(check('BASE_SATURATION', rows, snapshot({ 'crossCheck.baseSaturationMaxPct': 130 })).outcome).toBe('PASS');
        expect(check('BASES_CEC', bases(false), snapshot({ 'crossCheck.basesCecFactor': 1.3 })))
            .toMatchObject({ outcome: 'NOT_EVALUATED', reasonCode: 'INPUT_MISSING' });
        expect(check('BASE_SATURATION', bases(false), snapshot({ 'crossCheck.baseSaturationMaxPct': 130 })))
            .toMatchObject({ outcome: 'NOT_EVALUATED', reasonCode: 'INPUT_MISSING' });
    });
    test('finite stored values cannot create a false base outcome through sum or product overflow', () => {
        const rows = bases().map(row => ({ ...row, numericValue: row.param === 'EXCH_NA' ? 0 : 1.7e308 }));
        expect(check('BASES_CEC', rows).outcome).toBe('FLAGGED');
        expect(check('BASE_SATURATION', rows, snapshot({ 'crossCheck.baseSaturationMaxPct': 400 })).outcome).toBe('PASS');
        expect(check('BASE_SATURATION', rows, snapshot({ 'crossCheck.baseSaturationMaxPct': 200 })).outcome).toBe('FLAGGED');
    });
    test.each([0, -1])('nonpositive CEC %s is never divided or flagged', cec => {
        const rows = bases().map(row => row.param === 'CEC' ? { ...row, numericValue: cec } : row);
        for (const code of ['BASES_CEC', 'BASE_SATURATION']) expect(check(code, rows))
            .toMatchObject({ outcome: 'NOT_EVALUATED', reasonCode: 'DENOMINATOR_NOT_POSITIVE', flagCode: null });
    });
    test.each([0, -1])('nonpositive nitrogen %s cannot produce a C:N flag', nitrogen => {
        expect(check('CN_RATIO', cn(12, nitrogen))).toMatchObject({ outcome: 'NOT_EVALUATED', reasonCode: 'DENOMINATOR_NOT_POSITIVE' });
    });
    test.each([['%', 12], ['g/kg', 12], ['mg/g', 12], ['mg/kg', 120]])('C:N accepts equal allowed %s units', (unit, carbon) => {
        expect(check('CN_RATIO', cn(carbon, carbon / 12, unit)).outcome).toBe('PASS');
    });
    test.each([[7.99, 'FLAGGED'], [8, 'PASS'], [25, 'PASS'], [25.01, 'FLAGGED']])('C:N %s has outcome %s at the pinned boundaries', (carbon, outcome) => {
        expect(check('CN_RATIO', cn(carbon))).toMatchObject({ outcome, flagCode: outcome === 'FLAGGED' ? 'CROSS_CHECK_CN_OUT_OF_RANGE' : null });
    });
    test('C:N never converts different units even when their factors coincide', () => {
        expect(check('CN_RATIO', [input('SOC', 12, 'g/kg'), input('TN', 1, 'mg/g')]))
            .toMatchObject({ outcome: 'NOT_EVALUATED', reasonCode: 'UNIT_MISMATCH' });
    });
    test('only published unit synonyms normalize; no scale factors or unknown units are inferred', () => {
        const aliases = bases().map(row => ({ ...row, unit: 'meq/100g' }));
        expect(check('BASES_CEC', aliases).outcome).toBe('FLAGGED');
        for (const unit of ['mmol/kg', 'unknown-unit', null, '']) {
            expect(check('BASES_CEC', bases().map(row => ({ ...row, unit }))))
                .toMatchObject({ outcome: 'NOT_EVALUATED', reasonCode: 'UNIT_MISMATCH' });
        }
        expect(check('CN_RATIO', [input('SOC', 12, 'g kg-1'), input('TN', 1, 'g/kg')]).outcome).toBe('PASS');
    });
    test.each([null, '', 'OVEN_DRY'])('required absent/different C:N basis %s is disclosed', basis => {
        expect(check('CN_RATIO', [input('SOC', 12), input('TN', 1, 'g/kg', { basis })]))
            .toMatchObject({ outcome: 'NOT_EVALUATED', reasonCode: 'BASIS_MISMATCH' });
    });
    test('both-null unit and both-null basis still fail their respective authority checks', () => {
        expect(check('CN_RATIO', cn().map(row => ({ ...row, unit: null }))).reasonCode).toBe('UNIT_MISMATCH');
        expect(check('CN_RATIO', cn().map(row => ({ ...row, basis: null }))).reasonCode).toBe('BASIS_MISMATCH');
    });
    test('texture uses stored numeric fractions and policy tolerance, preserving source text', () => {
        const rows = [input('SAND', 40, '%'), input('SILT', 40, '%'), input('CLAY', 19, '%')];
        expect(check('TEXTURE_CLOSURE', rows).outcome).toBe('PASS');
        expect(check('TEXTURE_CLOSURE', rows, snapshot({ 'crossCheck.textureClosureTolerancePct': 0.5 })).outcome).toBe('FLAGGED');
        expect(rows.every(row => row.value === 'retained text; never parsed')).toBe(true);
        // The pre-existing gate still rejects this non-exact closure. Pin
        //6092909004 keeps it unchanged; correction is deferred to#278.
        expect(calculateUsdaTexture(40, 40, 19).isValid).toBe(false);
    });
    test('g/kg texture is not compared with100, while the legacy gate still ignores its units', () => {
        const rows = [input('SAND', 40), input('SILT', 40), input('CLAY', 20)];
        expect(check('TEXTURE_CLOSURE', rows)).toMatchObject({ outcome: 'NOT_EVALUATED', reasonCode: 'UNIT_MISMATCH' });
        expect(calculateUsdaTexture(40, 40, 20).isValid).toBe(true);
    });
    test.each(['%', 'g/kg', 'mg/kg'])('positive carbonate in %s compares its sign with water pH, without conversion or basis matching', unit => {
        const rows = [input('CACO3', 0.1, unit, { basis: null }), input('PH_H2O', 6.9, 'pH_units', { basis: 'FRESH' })];
        expect(check('CACO3_PH', rows)).toMatchObject({ outcome: 'FLAGGED', flagCode: 'CROSS_CHECK_CACO3_LOW_PH' });
        expect(check('CACO3_PH', rows, snapshot({ 'crossCheck.carbonatePhMin': 6.5 })).outcome).toBe('PASS');
    });
    test.each([0, -1])('carbonate %s does not impose a pH threshold', carbonate => {
        expect(check('CACO3_PH', [input('CACO3', carbonate, '%'), input('PH_H2O', 6, 'pH')]).outcome).toBe('PASS');
    });
    test('each pH salt checks strict inequality independently and ignores basis differences', () => {
        const rows = [input('PH_H2O', 7, 'pH', { basis: null }), input('PH_KCL', 7, 'pH_units'), input('PH_CACL2', 6, 'pH units')];
        expect(check('PH_KCL_WATER', rows)).toMatchObject({ outcome: 'FLAGGED', flagCode: 'CROSS_CHECK_PH_SALT_GE_WATER' });
        expect(check('PH_CACL2_WATER', rows).outcome).toBe('PASS');
        expect(check('PH_CACL2_WATER', rows.filter(row => row.param !== 'PH_CACL2')).reasonCode).toBe('INPUT_MISSING');
    });
    test('legacy analysis aliases and ECEC do not stand in for the pinned catalogue codes', () => {
        expect(check('CN_RATIO', [input('OC', 12), input('TN', 1)]).reasonCode).toBe('INPUT_MISSING');
        expect(check('BASES_CEC', bases().map(row => row.param === 'CEC' ? { ...row, param: 'ECEC' } : row)).reasonCode).toBe('INPUT_MISSING');
        expect(check('CACO3_PH', [input('CACO3', 1, '%'), input('PH', 6, 'pH_units')]).reasonCode).toBe('INPUT_MISSING');
    });
    test('selected values disclose saved result identities; raw candidates are never chosen or averaged', () => {
        const rows = cn(); rows[0] = { ...rows[0], id: 'selection', selectionId: 'selection', sourceResultIds: ['old-a', 'old-b'] };
        expect(check('CN_RATIO', rows).inputs.values[0]).toMatchObject({ selectionId: 'selection', resultIds: ['old-a', 'old-b'], value: 12 });
        const many = check('CN_RATIO', [...cn(), input('SOC', 24, 'g/kg', { id: 'other-method' })]);
        expect(many).toMatchObject({ outcome: 'NOT_EVALUATED', reasonCode: 'MULTIPLE_CANDIDATES' });
        expect(many.inputs.values.filter(row => row.analysisCode === 'SOC').map(row => row.value)).toEqual([12, 24]);
    });
    test.each([
        ['INPUT_MISSING', [input('TN', null, 'g/kg', { mode: 'NOT_REPORTABLE' })]],
        ['INPUT_NOT_REPORTABLE', [input('SOC', 12, 'g/kg', { mode: 'NOT_REPORTABLE' }), input('TN', null)]],
        ['INPUT_NON_NUMERIC', [input('SOC', '12'), input('TN', 1, 'g/kg', { censoring: 'BELOW_LOQ' })]],
        ['INPUT_CENSORED', [input('SOC', 12, 'g/kg', { censoring: 'BELOW_LOQ' }), input('SOC', 24), input('TN', 1)]],
        ['MULTIPLE_CANDIDATES', [input('SOC', 12, null), input('SOC', 24), input('TN', 1)]],
        ['UNIT_MISMATCH', [input('SOC', 12, null), input('TN', 1, 'g/kg', { basis: null })]],
        ['BASIS_MISMATCH', [input('SOC', 12, 'g/kg', { basis: null }), input('TN', 0)]],
        ['DENOMINATOR_NOT_POSITIVE', cn(12, 0)]
    ])('reason precedence selects only %s', (reasonCode, rows) => {
        expect(check('CN_RATIO', rows)).toMatchObject({ outcome: 'NOT_EVALUATED', reasonCode, flagCode: null });
    });
    test.each([NaN, Infinity, -Infinity, null, '12'])('non-numeric stored carbon %s is never parsed', carbon => {
        expect(check('CN_RATIO', cn(carbon)).reasonCode).toBe('INPUT_NON_NUMERIC');
    });
    test('policy snapshot is mandatory and invalid bounds are refused without a default', () => {
        for (const policy of [null, { version: 0, values: {} }, snapshot({ 'crossCheck.cnMin': 25 })]) {
            expect(() => evaluateCrossParameters(cn(), policy)).toThrow(expect.objectContaining({ statusCode: 409, code: 'CROSS_CHECK_POLICY_REQUIRED' }));
        }
    });
    test('the EC rule is absent and no evaluation mutates input or policy data', () => {
        const rows = [...cn(), input('EC', 100, 'dS/m')], policy = snapshot(), before = structuredClone({ rows, policy });
        const evaluations = evaluateCrossParameters(rows, policy);
        expect(evaluations).toHaveLength(7);
        expect(evaluations.map(row => row.ruleCode)).not.toContain('EC');
        expect(evaluations.every(row => row.severity === 'ADVISORY')).toBe(true);
        expect({ rows, policy }).toEqual(before);
    });
});
