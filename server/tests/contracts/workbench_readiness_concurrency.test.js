const {
    parseDeterminationValue,
    validateNumericMethod,
    validateTextureFractions,
    validateOperationalTask
} = require('../../services/workbenchValidationService');

const { evaluateItemReadiness } = require('../../services/workbenchReadinessService');

describe('Workbench Validation & Readiness Engine Contracts (Phase 2)', () => {
    describe('1. Determination Value Parsing & Formatting', () => {
        test('Distinguishes blank from zero (0 is valid numeric, empty is blank)', () => {
            const blankResult1 = parseDeterminationValue('');
            expect(blankResult1.isBlank).toBe(true);
            expect(blankResult1.normalizedValue).toBeNull();

            const blankResult2 = parseDeterminationValue('   ');
            expect(blankResult2.isBlank).toBe(true);

            const blankResult3 = parseDeterminationValue(null);
            expect(blankResult3.isBlank).toBe(true);

            const zeroResult = parseDeterminationValue('0');
            expect(zeroResult.isBlank).toBe(false);
            expect(zeroResult.isValid).toBe(true);
            expect(zeroResult.normalizedValue).toBe(0);

            const zeroNumberResult = parseDeterminationValue(0);
            expect(zeroNumberResult.isBlank).toBe(false);
            expect(zeroNumberResult.isValid).toBe(true);
            expect(zeroNumberResult.normalizedValue).toBe(0);
        });

        test('Normalizes locale decimal comma to dot', () => {
            const parsed = parseDeterminationValue('14,25');
            expect(parsed.isValid).toBe(true);
            expect(parsed.normalizedValue).toBe(14.25);
            expect(parsed.raw).toBe('14.25');
        });

        test('Detects and standardizes censored values (<LOQ and >Range)', () => {
            const belowLoq = parseDeterminationValue('< 0,05');
            expect(belowLoq.isCensored).toBe(true);
            expect(belowLoq.censoring).toBe('BELOW_LOQ');
            expect(belowLoq.limitValue).toBe(0.05);

            const aboveRange = parseDeterminationValue('>120');
            expect(aboveRange.isCensored).toBe(true);
            expect(aboveRange.censoring).toBe('ABOVE_RANGE');
            expect(aboveRange.limitValue).toBe(120);
        });

        test('Invalid string formats are caught with INVALID_FORMAT flag', () => {
            const invalid = parseDeterminationValue('abc');
            expect(invalid.isValid).toBe(false);
            expect(invalid.flags).toContain('INVALID_FORMAT');
        });
    });

    describe('2. Numeric Method Range Bounds', () => {
        const phRules = { type: 'numeric', min: 3.0, max: 10.0, loq: 4.0 };

        test('Validates values within range', () => {
            const result = validateNumericMethod('6.5', phRules);
            expect(result.isValid).toBe(true);
            expect(result.flags).toHaveLength(0);
        });

        test('Flags below min and above max as invalid', () => {
            const tooLow = validateNumericMethod('2.5', phRules);
            expect(tooLow.isValid).toBe(false);
            expect(tooLow.flags).toContain('BELOW_MIN');

            const tooHigh = validateNumericMethod('11.0', phRules);
            expect(tooHigh.isValid).toBe(false);
            expect(tooHigh.flags).toContain('ABOVE_MAX');
        });

        test('Flags values below LOQ with warning flag but valid if within hard bounds', () => {
            const lowLoq = validateNumericMethod('3.5', phRules);
            expect(lowLoq.flags).toContain('BELOW_LOQ');
            expect(lowLoq.isValid).toBe(true); // LOQ is a warning, not hard bound violation
        });
    });

    describe('3. Soil Texture Closure Validation (100% ± 2.0%)', () => {
        test('Exact 100% closure produces valid USDA classification', () => {
            const texture = validateTextureFractions(40, 40, 20);
            expect(texture.isValid).toBe(true);
            expect(texture.sum).toBe(100);
            expect(texture.closureError).toBe(0);
            expect(texture.className).toBe('Loam');
            expect(texture.flags).toHaveLength(0);
        });

        test('Within ±2.0% tolerance is accepted and normalized', () => {
            // 45 + 35 + 21 = 101% (error 1.0% <= 2.0%)
            const texture = validateTextureFractions('45,0', '35,0', '21,0');
            expect(texture.isValid).toBe(true);
            expect(texture.sum).toBe(101);
            expect(texture.closureError).toBe(1);
            expect(texture.flags).toHaveLength(0);
        });

        test('Closure error exceeding 2.0% is blocked with TEXTURE_CLOSURE_FAILED', () => {
            // 30 + 30 + 20 = 80% (error 20% > 2.0%)
            const texture = validateTextureFractions(30, 30, 20);
            expect(texture.isValid).toBe(false);
            expect(texture.sum).toBe(80);
            expect(texture.closureError).toBe(20);
            expect(texture.flags).toContain('TEXTURE_CLOSURE_FAILED');
            expect(texture.error).toContain('closure error');
        });

        test('Incomplete fractions are flagged', () => {
            const incomplete = validateTextureFractions(40, '', 20);
            expect(incomplete.isValid).toBe(false);
            expect(incomplete.flags).toContain('INCOMPLETE_FRACTIONS');
        });
    });

    describe('4. Operational Task Checklist Validation', () => {
        test('Requires all required steps to be true', () => {
            const valid = validateOperationalTask([true, true, true], 3);
            expect(valid.isValid).toBe(true);

            const incomplete = validateOperationalTask([true, false, true], 3);
            expect(incomplete.isValid).toBe(false);
            expect(incomplete.flags).toContain('SOP_STEPS_INCOMPLETE');
        });
    });

    describe('5. Task Execution Readiness & Equipment Qualification', () => {
        const user = { username: 'tech_marcos', role: 'LAB_TECHNICIAN', labId: 'LAB-DEFAULT' };

        test('Blocks analytical work when sample is ON_HOLD', () => {
            const item = {
                id: 'wi-1',
                analysis: 'PH',
                assignedTo: 'tech_marcos',
                status: 'ASSIGNED',
                sample: {
                    id: 'smp-1',
                    status: 'ON_HOLD',
                    dryingStatus: 'DONE',
                    preparationStatus: 'DONE'
                }
            };
            const readiness = evaluateItemReadiness(item, user);
            expect(readiness.isReady).toBe(false);
            expect(readiness.blockers).toContain('SAMPLE_ON_HOLD');
        });

        test('Blocks analytical work when drying is not completed', () => {
            const item = {
                id: 'wi-2',
                analysis: 'PH',
                assignedTo: 'tech_marcos',
                status: 'ASSIGNED',
                sample: {
                    id: 'smp-2',
                    status: 'PROCESSING',
                    dryingStatus: 'PENDING',
                    preparationStatus: 'PENDING'
                }
            };
            const readiness = evaluateItemReadiness(item, user);
            expect(readiness.isReady).toBe(false);
            expect(readiness.blockers).toContain('DRYING_PREREQUISITE_BLOCKED');
        });

        test('Blocks analytical work when preparation is not completed', () => {
            const item = {
                id: 'wi-3',
                analysis: 'PH',
                assignedTo: 'tech_marcos',
                status: 'ASSIGNED',
                sample: {
                    id: 'smp-3',
                    status: 'PROCESSING',
                    dryingStatus: 'DONE',
                    preparationStatus: 'IN_PROGRESS'
                }
            };
            const readiness = evaluateItemReadiness(item, user);
            expect(readiness.isReady).toBe(false);
            expect(readiness.blockers).toContain('PREPARATION_PREREQUISITE_BLOCKED');
        });

        test('Allows DRYING task when sample is ACCEPTED even if dryingStatus is PENDING', () => {
            const item = {
                id: 'wi-dry',
                analysis: 'DRYING',
                category: 'Operational Gates',
                assignedTo: 'tech_marcos',
                status: 'ASSIGNED',
                sample: {
                    id: 'smp-4',
                    status: 'ACCEPTED',
                    dryingStatus: 'PENDING',
                    preparationStatus: 'PENDING'
                }
            };
            const readiness = evaluateItemReadiness(item, user);
            expect(readiness.isReady).toBe(true);
            expect(readiness.blockers).toHaveLength(0);
        });

        test('Blocks when required instrument is missing', () => {
            const item = {
                id: 'wi-5',
                analysis: 'PH',
                assignedTo: 'tech_marcos',
                status: 'ASSIGNED',
                sample: {
                    id: 'smp-5',
                    status: 'PROCESSING',
                    dryingStatus: 'DONE',
                    preparationStatus: 'DONE'
                }
            };
            const equipReq = { isRequired: true, eligibleIds: ['EQ-PH-01'] };
            const readiness = evaluateItemReadiness(item, user, { equipReq });
            expect(readiness.isReady).toBe(false);
            expect(readiness.blockers).toContain('INSTRUMENT_REQUIRED');
        });

        test('Blocks when instrument calibration is OVERDUE', () => {
            const item = {
                id: 'wi-6',
                analysis: 'PH',
                equipmentId: 'EQ-PH-01',
                assignedTo: 'tech_marcos',
                status: 'ASSIGNED',
                sample: {
                    id: 'smp-6',
                    status: 'PROCESSING',
                    dryingStatus: 'DONE',
                    preparationStatus: 'DONE'
                }
            };
            const equipReq = { isRequired: true, eligibleIds: ['EQ-PH-01'] };
            const asset = {
                id: 'EQ-PH-01',
                name: 'Mettler Toledo pH Meter',
                status: 'IN_SERVICE',
                calibrationStatus: 'OVERDUE'
            };
            const readiness = evaluateItemReadiness(item, user, { equipReq, asset });
            expect(readiness.isReady).toBe(false);
            expect(readiness.blockers).toContain('INSTRUMENT_CALIBRATION_OVERDUE');
        });

        test('Approves item when all prerequisites and instrument qualification are met', () => {
            const item = {
                id: 'wi-7',
                analysis: 'PH',
                equipmentId: 'EQ-PH-01',
                assignedTo: 'tech_marcos',
                status: 'ASSIGNED',
                sample: {
                    id: 'smp-7',
                    status: 'PROCESSING',
                    dryingStatus: 'DONE',
                    preparationStatus: 'DONE'
                }
            };
            const equipReq = { isRequired: true, eligibleIds: ['EQ-PH-01'] };
            const asset = {
                id: 'EQ-PH-01',
                name: 'Mettler Toledo pH Meter',
                status: 'IN_SERVICE',
                calibrationStatus: 'OK'
            };
            const readiness = evaluateItemReadiness(item, user, { equipReq, asset });
            expect(readiness.isReady).toBe(true);
            expect(readiness.blockers).toHaveLength(0);
        });
    });
});
