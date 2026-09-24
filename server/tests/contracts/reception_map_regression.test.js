/**
 * Regression Contract Tests: Reception Map Batched State Preservation & Country Fallback (Refs #114)
 *
 * Verifies the two narrow candidate fixes:
 * 1. Batched Sampling State Updates:
 *    - Validates that sequential rapid state updates (e.g. from LocationPicker map click or marker dragend)
 *      are preserved using functional state updaters (prev => ({ ...prev, [key]: value })), preventing
 *      stale-closure spread overwrites where positionalUncertaintyM or locationSource would be clobbered.
 *    - Asserts source and uncertainty values are explicitly preserved upon batching.
 * 2. Laboratory Country Fallback Pass-Through:
 *    - Validates that unconfigured African facilities fall back to the neutral African centroid [0, 25]
 *      rather than defaulting to Guatemala ('GT', [15.78, -90.23]).
 *    - Validates prop wiring across Reception.jsx -> WalkInForm.jsx -> LocationPicker.jsx.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadClientModule(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    code = code.replace(/export\s+const\s+([a-zA-Z0-9_$]+)\s*=/g, 'const $1 = exports.$1 =');
    code = code.replace(/export\s+function\s+([a-zA-Z0-9_$]+)/g, 'exports.$1 = $1; function $1');
    const exportsObj = {};
    const context = {
        exports: exportsObj,
        module: { exports: exportsObj },
        console,
        Array,
        parseFloat,
        isNaN
    };
    vm.runInNewContext(code, context);
    return context.exports;
}

const mapConfigPath = path.resolve(__dirname, '../../../client/src/utils/mapConfig.js');
const { COUNTRY_CENTERS, resolveMapCenter } = loadClientModule(mapConfigPath);

const walkInFormPath = path.resolve(__dirname, '../../../client/src/components/reception/WalkInForm.jsx');
const locationPickerPath = path.resolve(__dirname, '../../../client/src/components/reception/LocationPicker.jsx');
const receptionPath = path.resolve(__dirname, '../../../client/src/pages/Reception.jsx');

describe('Reception Map Regression Contracts (Refs #114)', () => {
    describe('1. Batched Sampling State Preservation (WalkInForm)', () => {
        test('Baseline flaw: stale closure spreads clobber earlier batched field updates', () => {
            // Simulate React stale closure behavior with non-functional object spreads:
            // setSampling({ ...sampling, [key]: value })
            let samplingState = {
                positionalUncertaintyM: null,
                locationSource: 'MANUAL',
                locationConfidence: 'MEDIUM',
                coordinates: null
            };

            // When multiple callbacks fire synchronously from LocationPicker (e.g. map click):
            // 1. onPositionalUncertaintyChange(500)
            // 2. onLocationSourceChange('DESK_PIN')
            // 3. onConfidenceChange('HIGH')
            // 4. onChange({ coordinates: [-17.8292, 31.0522] })
            // In the baseline, all 4 calls closed over the same initial `samplingState`.
            const staleClosure = samplingState;
            const nonFunctionalBatch = [
                () => ({ ...staleClosure, positionalUncertaintyM: 500 }),
                () => ({ ...staleClosure, locationSource: 'DESK_PIN' }),
                () => ({ ...staleClosure, locationConfidence: 'HIGH' }),
                () => ({ ...staleClosure, coordinates: [-17.8292, 31.0522] })
            ];

            // In React batched rendering with stale closure, the last updater evaluated wins
            // and clobbers earlier fields:
            let baselineResult = staleClosure;
            for (const fn of nonFunctionalBatch) {
                baselineResult = fn();
            }

            // Demonstrates the baseline regression: positionalUncertaintyM and locationSource are lost (null / MANUAL)
            expect(baselineResult.positionalUncertaintyM).toBeNull();
            expect(baselineResult.locationSource).toBe('MANUAL');
            expect(baselineResult.locationConfidence).toBe('MEDIUM');
            expect(baselineResult.coordinates).toEqual([-17.8292, 31.0522]);
        });

        test('Candidate fix: functional updaters compose sequentially and preserve all batched fields', () => {
            // Simulate React functional updater behavior:
            // setSampling(prev => ({ ...prev, [key]: value }))
            let samplingState = {
                positionalUncertaintyM: null,
                locationSource: 'MANUAL',
                locationConfidence: 'MEDIUM',
                coordinates: null
            };

            const setSampling = (updater) => {
                samplingState = typeof updater === 'function' ? updater(samplingState) : updater;
            };

            const handleChange = (section, key, value) => {
                if (section === 'sampling') {
                    setSampling(prev => ({ ...prev, [key]: value }));
                }
            };

            // Dispatch rapid sequential updates matching LocationPicker event sequence
            handleChange('sampling', 'positionalUncertaintyM', 500);
            handleChange('sampling', 'locationSource', 'DESK_PIN');
            handleChange('sampling', 'locationConfidence', 'HIGH');
            handleChange('sampling', 'coordinates', [-17.8292, 31.0522]);

            // All batched fields are preserved without data loss
            expect(samplingState.positionalUncertaintyM).toBe(500);
            expect(samplingState.locationSource).toBe('DESK_PIN');
            expect(samplingState.locationConfidence).toBe('HIGH');
            expect(samplingState.coordinates).toEqual([-17.8292, 31.0522]);
        });

        test('WalkInForm.jsx source code implements functional state updaters for both submitter and sampling', () => {
            const code = fs.readFileSync(walkInFormPath, 'utf8');

            // Must use functional updater syntax
            expect(code).toContain("if (section === 'submitter') setSubmitter(prev => ({ ...prev, [key]: value }));");
            expect(code).toContain("if (section === 'sampling') setSampling(prev => ({ ...prev, [key]: value }));");

            // Must NOT use stale closure spread
            expect(code).not.toContain("setSampling({ ...sampling, [key]: value })");
            expect(code).not.toContain("setSubmitter({ ...submitter, [key]: value })");
        });
    });

    describe('2. Laboratory Country Fallback Pass-Through', () => {
        test('Baseline flaw: hardcoded countryCode="GT" in LocationPicker causes unconfigured African labs to center on Guatemala', () => {
            const baselineDefaultCountry = 'GT';
            const labCoordinates = null;
            const completeCoords = null;

            // Baseline resolution:
            const defaultCenter = COUNTRY_CENTERS[baselineDefaultCountry] || COUNTRY_CENTERS.DEFAULT;
            const viewportCenter = resolveMapCenter(completeCoords, labCoordinates, defaultCenter);

            // Baseline wrongfully centered on Guatemala [15.78, -90.23]
            expect(viewportCenter).toEqual([15.78, -90.23]);
            expect(viewportCenter[0]).toBeGreaterThan(10);
            expect(viewportCenter[1]).toBeLessThan(-80);
        });

        test('Candidate fix: countryCode defaults to null, resolving unconfigured facilities to neutral centroid [0, 25]', () => {
            const candidateDefaultCountry = null;
            const labCoordinates = null;
            const completeCoords = null;

            // Candidate resolution with null countryCode:
            const defaultCenter = COUNTRY_CENTERS[candidateDefaultCountry] || COUNTRY_CENTERS.DEFAULT;
            const viewportCenter = resolveMapCenter(completeCoords, labCoordinates, defaultCenter);

            // Correctly resolves to neutral Central Africa centroid [0, 25]
            expect(viewportCenter).toEqual([0, 25]);
        });

        test('Configured laboratory country codes resolve to appropriate regional centroids', () => {
            const testCases = [
                { country: 'ZW', expected: [-17.8292, 31.0522] }, // Zimbabwe
                { country: 'ZM', expected: [-15.41, 28.28] },       // Zambia
                { country: 'ET', expected: [9.15, 40.49] },         // Ethiopia
                { country: 'KE', expected: [-1.29, 36.82] },        // Kenya
                { country: 'RW', expected: [-1.94, 29.87] }         // Rwanda
            ];

            for (const { country, expected } of testCases) {
                const center = COUNTRY_CENTERS[country] || COUNTRY_CENTERS.DEFAULT;
                expect(center).toEqual(expected);
            }
        });

        test('LocationPicker.jsx defaults countryCode to null rather than GT', () => {
            const code = fs.readFileSync(locationPickerPath, 'utf8');
            expect(code).toContain('countryCode = null,');
            expect(code).not.toContain("countryCode = 'GT',");
        });

        test('WalkInForm.jsx accepts countryCode prop and forwards it to LocationPicker', () => {
            const code = fs.readFileSync(walkInFormPath, 'utf8');
            expect(code).toContain('countryCode = null');
            expect(code).toContain('countryCode={countryCode}');
        });

        test('Reception.jsx passes user lab country or user country to WalkInForm', () => {
            const code = fs.readFileSync(receptionPath, 'utf8');
            expect(code).toContain('countryCode={user?.lab?.country || user?.country}');
        });
    });
});
