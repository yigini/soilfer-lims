const { calculateUsdaTexture, calculateTernaryCoordinates } = require('../../utils/soilCalculations');

describe('USDA Soil Texture Metrology & 12-Class Boundary Verification (Contract)', () => {
    describe('Mandatory Audit Probes', () => {
        test('Probe 1: 50/35/15 returns Loam under USDA definition (Finding F11)', () => {
            const res = calculateUsdaTexture(50, 35, 15);
            expect(res.isValid).toBe(true);
            expect(res.className).toBe('Loam');
            expect(res.code).toBe('L');
            expect(res.closureError).toBe(0);
        });

        test('Probe 2: 20/50/30 returns Silty Clay Loam under USDA definition', () => {
            const res = calculateUsdaTexture(20, 50, 30);
            expect(res.isValid).toBe(true);
            expect(res.className).toBe('Silty Clay Loam');
            expect(res.code).toBe('SiCL');
        });

        test('Probe 3: 45/20/35 returns Clay Loam under USDA definition', () => {
            const res = calculateUsdaTexture(45, 20, 35);
            expect(res.isValid).toBe(true);
            expect(res.className).toBe('Clay Loam');
            expect(res.code).toBe('CL');
        });
    });

    describe('All 12 USDA Texture Class Centroids (Soil Survey Manual Ch. 3)', () => {
        const centroidCases = [
            { name: 'Clay', code: 'C', sand: 20, silt: 20, clay: 60 },
            { name: 'Silty Clay', code: 'SiC', sand: 5, silt: 45, clay: 50 },
            { name: 'Sandy Clay', code: 'SC', sand: 55, silt: 5, clay: 40 },
            { name: 'Clay Loam', code: 'CL', sand: 35, silt: 32, clay: 33 },
            { name: 'Silty Clay Loam', code: 'SiCL', sand: 10, silt: 60, clay: 30 },
            { name: 'Sandy Clay Loam', code: 'SCL', sand: 60, silt: 15, clay: 25 },
            { name: 'Sand', code: 'S', sand: 92, silt: 5, clay: 3 },
            { name: 'Loamy Sand', code: 'LS', sand: 82, silt: 12, clay: 6 },
            { name: 'Sandy Loam', code: 'SL', sand: 65, silt: 25, clay: 10 },
            { name: 'Silt', code: 'Si', sand: 5, silt: 88, clay: 7 },
            { name: 'Silt Loam', code: 'SiL', sand: 20, silt: 65, clay: 15 },
            { name: 'Loam', code: 'L', sand: 40, silt: 42, clay: 18 }
        ];

        centroidCases.forEach(({ name, code, sand, silt, clay }) => {
            test(`Class ${name} (${code}) at [Sand ${sand}%, Silt ${silt}%, Clay ${clay}%]`, () => {
                const res = calculateUsdaTexture(sand, silt, clay);
                expect(res.isValid).toBe(true);
                expect(res.className).toBe(name);
                expect(res.code).toBe(code);
                expect(res.scheme).toBe('USDA_12_CLASS');
            });
        });
    });

    describe('Method-Specific Closure Policy (Mandatory Correction 2)', () => {
        test('Standard method tolerance allows slight field precision within tolerance', () => {
            // 50 + 35 + 15.4 = 100.4 (closure error 0.4%)
            const resWithTol = calculateUsdaTexture(50, 35, 15.4, { tolerance: 0.5 });
            expect(resWithTol.isValid).toBe(true);
            expect(resWithTol.className).toBe('Loam');
            expect(resWithTol.closureError).toBeCloseTo(0.4, 3);
        });

        test('Fails closed when closure error exceeds method-specific tolerance', () => {
            // 50 + 35 + 15.4 = 100.4 (closure error 0.4%) with strict tolerance 0.2%
            const resStrict = calculateUsdaTexture(50, 35, 15.4, { tolerance: 0.2 });
            expect(resStrict.isValid).toBe(false);
            expect(resStrict.className).toBe('Unavailable');
            expect(resStrict.code).toBe('UNAVAILABLE');
            expect(resStrict.closureError).toBeCloseTo(0.4, 3);
            expect(resStrict.error).toMatch(/Closure check failed/);
        });

        test('Strict mode requires exact closure to floating point precision', () => {
            const resStrictExact = calculateUsdaTexture(50, 35, 15, { strict: true });
            expect(resStrictExact.isValid).toBe(true);
            expect(resStrictExact.className).toBe('Loam');

            const resStrictMismatch = calculateUsdaTexture(50, 35, 15.01, { strict: true });
            expect(resStrictMismatch.isValid).toBe(false);
            expect(resStrictMismatch.className).toBe('Unavailable');
        });

        test('Rejects gross closure errors without silent normalization', () => {
            const resGross = calculateUsdaTexture(50, 30, 10); // sum 90%
            expect(resGross.isValid).toBe(false);
            expect(resGross.className).toBe('Unavailable');
            expect(resGross.closureError).toBe(10);
        });
    });

    describe('Defensive Metrology: Negative, Blank, Censored and Out-of-Bounds Inputs (Finding F12)', () => {
        test('Rejects negative fractions', () => {
            const res = calculateUsdaTexture(-5, 55, 50);
            expect(res.isValid).toBe(false);
            expect(res.className).toBe('Unavailable');
            expect(res.code).toBe('UNAVAILABLE');
        });

        test('Rejects empty / blank fractions', () => {
            const resBlank = calculateUsdaTexture('', 50, 50);
            expect(resBlank.isValid).toBe(false);
            expect(resBlank.className).toBe('Unavailable');

            const resNull = calculateUsdaTexture(50, null, 50);
            expect(resNull.isValid).toBe(false);
            expect(resNull.className).toBe('Unavailable');
        });

        test('Rejects fractions greater than 100%', () => {
            const res = calculateUsdaTexture(105, -5, 0);
            expect(res.isValid).toBe(false);
            expect(res.className).toBe('Unavailable');
        });

        test('Rejects censored strings (< or >)', () => {
            const res = calculateUsdaTexture('<1', 50, 50);
            expect(res.isValid).toBe(false);
            expect(res.className).toBe('Unavailable');
        });

        test('Parses comma-decimals properly without coercing blanks to zero', () => {
            const resComma = calculateUsdaTexture('50,0', '35,0', '15,0');
            expect(resComma.isValid).toBe(true);
            expect(resComma.className).toBe('Loam');
        });
    });

    describe('Ternary Coordinates Mapping', () => {
        test('Maps 100% clay apex, 100% sand base-left, 100% silt base-right', () => {
            const apex = calculateTernaryCoordinates(0, 0, 100);
            expect(apex.x).toBe(50);
            expect(apex.y).toBeCloseTo(13.4, 1);

            const sandVertex = calculateTernaryCoordinates(100, 0, 0);
            expect(sandVertex.x).toBe(0);
            expect(sandVertex.y).toBe(100);

            const siltVertex = calculateTernaryCoordinates(0, 100, 0);
            expect(siltVertex.x).toBe(100);
            expect(siltVertex.y).toBe(100);
        });
    });
});
