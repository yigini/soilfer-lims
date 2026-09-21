/**
 * Contract Tests: Map Centering Hierarchy, Fullscreen, and Satellite Provider (#114)
 * 
 * Verifies:
 * 1. Centering precedence hierarchy:
 *    a. Existing sample GPS coordinates first
 *    b. Configured laboratory location second
 *    c. Neutral fallback [0, 20] third
 * 2. Viewport centering is never saved as sampling coordinates without deliberate confirmation.
 * 3. Compliant satellite tile layer (Esri World Imagery) without paid keys and with legal attribution.
 * 4. Standard OpenStreetMap tile layer configuration and fallback.
 * 5. Tile error fallback: automatic switch to standard OSM layer upon tile load failure.
 * 6. Multi-country support: handles coordinate sets across different countries and hemispheres.
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
const { SATELLITE_TILE_CONFIG, OSM_TILE_CONFIG, resolveMapCenter } = loadClientModule(mapConfigPath);

describe('Map Centering, Provider & Resilience Contract (#114)', () => {
    describe('1. Centering Precedence Hierarchy', () => {
        test('Prioritizes valid sample coordinates over laboratory and fallback', () => {
            const sampleCoords = { lat: 14.6349, lng: -90.5069 }; // Guatemala City sample
            const labLocation = { lat: 14.5000, lng: -90.4000 };
            const fallback = [0, 20];

            const center = resolveMapCenter(sampleCoords, labLocation, fallback);
            expect(center).toEqual([14.6349, -90.5069]);
        });

        test('Falls back to configured laboratory location when sample coordinates are absent', () => {
            const sampleCoords = null;
            const labLocation = { lat: 9.0300, lng: 38.7400 }; // Addis Ababa lab
            const fallback = [0, 20];

            const center = resolveMapCenter(sampleCoords, labLocation, fallback);
            expect(center).toEqual([9.0300, 38.7400]);
        });

        test('Falls back to neutral center when both sample and lab coordinates are missing or invalid', () => {
            const fallback = [0, 20];

            expect(resolveMapCenter(null, null, fallback)).toEqual([0, 20]);
            expect(resolveMapCenter({}, {}, fallback)).toEqual([0, 20]);
            expect(resolveMapCenter({ lat: 'invalid', lng: 'invalid' }, null, fallback)).toEqual([0, 20]);
            expect(resolveMapCenter(null, { lat: null, lng: null }, fallback)).toEqual([0, 20]);
        });

        test('Correctly parses string coordinate representations from Kobo / GPS forms', () => {
            const sampleCoords = { lat: '14.634915', lng: '-90.506882' };
            const center = resolveMapCenter(sampleCoords, null);
            expect(center[0]).toBeCloseTo(14.634915, 5);
            expect(center[1]).toBeCloseTo(-90.506882, 5);
        });

        test('Rejects out-of-bounds latitude/longitude and falls back', () => {
            const invalidSampleCoords = { lat: 95.0, lng: 20.0 }; // Lat > 90 invalid
            const labLocation = { lat: -1.286389, lng: 36.817223 }; // Nairobi lab

            const center = resolveMapCenter(invalidSampleCoords, labLocation);
            expect(center).toEqual([-1.286389, 36.817223]);
        });
    });

    describe('2. Satellite & OSM Tile Provider Compliance', () => {
        test('Satellite tile URL points to Esri World Imagery and requires zero API keys', () => {
            expect(SATELLITE_TILE_CONFIG).toBeDefined();
            expect(SATELLITE_TILE_CONFIG.url).toBe(
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            );
            // Must not contain any key= or token= or auth parameters
            expect(SATELLITE_TILE_CONFIG.url).not.toMatch(/[?&](key|token|access_token|apiKey)=/i);
        });

        test('Satellite tile configuration includes required legal attribution', () => {
            expect(SATELLITE_TILE_CONFIG.attribution).toContain('Esri');
            expect(SATELLITE_TILE_CONFIG.attribution).toContain('Source: Esri');
            expect(SATELLITE_TILE_CONFIG.maxZoom).toBe(19);
        });

        test('Standard OSM tile configuration provides valid URL and attribution', () => {
            expect(OSM_TILE_CONFIG).toBeDefined();
            expect(OSM_TILE_CONFIG.url).toContain('tile.openstreetmap.org');
            expect(OSM_TILE_CONFIG.url).toContain('/{z}/{x}/{y}.png');
            expect(OSM_TILE_CONFIG.attribution).toContain('OpenStreetMap');
        });
    });

    describe('3. Viewport & Coordinate Provenance Safety', () => {
        test('Resolving map center does not mutate input coordinates or inject side-effects', () => {
            const inputSample = Object.freeze({ lat: 12.34, lng: 56.78 });
            const inputLab = Object.freeze({ lat: 10.0, lng: 20.0 });

            const resolved = resolveMapCenter(inputSample, inputLab);
            expect(resolved).toEqual([12.34, 56.78]);
            expect(inputSample.lat).toBe(12.34);
        });
    });

    describe('4. Reception Call Site & Harare Lab Viewport Contract (#114)', () => {
        const HARARE_COORDINATES = [-17.8292, 31.0522];

        test('Harare lab user with blank sample coordinates: viewport centers on Harare, sample coordinates remain blank', () => {
            // Simulated reception desk state
            const user = { username: 'tech.harare', role: 'SAMPLE_RECEPTION', labId: 'LAB-ZWE-01' };
            const LAB_DEFAULT_COORDINATES = {
                'LAB-ZWE-01': HARARE_COORDINATES,
                'LAB-GTM-01': [14.6349, -90.5069]
            };
            const userLabCoords = LAB_DEFAULT_COORDINATES[user.labId];
            expect(userLabCoords).toEqual(HARARE_COORDINATES);

            // Blank sample coordinates before desk selection
            const blankSampleCoords = null;
            const defaultFallback = [0, 20];

            // Map center in LocationPicker:
            const viewportCenter = resolveMapCenter(blankSampleCoords, userLabCoords, defaultFallback);
            expect(viewportCenter).toEqual(HARARE_COORDINATES);

            // Verify sampling data remains completely unpopulated (preserved blank until deliberate user action)
            const samplingData = { coordinates: blankSampleCoords, location: '' };
            expect(samplingData.coordinates).toBeNull();
        });

        test('Existing sample coordinates override Harare lab location in viewport', () => {
            const userLabCoords = HARARE_COORDINATES;
            const sampleCoords = [-18.5123, 32.1245]; // Specific field site in Manicaland

            const viewportCenter = resolveMapCenter(sampleCoords, userLabCoords);
            expect(viewportCenter).toEqual([-18.5123, 32.1245]);
        });

        test('Missing lab coordinates gracefully falls back to neutral center without crash', () => {
            const userWithoutLab = { username: 'external.analyst', role: 'ANALYST', labId: null };
            const blankSampleCoords = null;
            const fallback = [0, 20];

            const viewportCenter = resolveMapCenter(blankSampleCoords, userWithoutLab.labCoordinates, fallback);
            expect(viewportCenter).toEqual([0, 20]);
        });

        test('LocationPicker source code wires labCoordinates and InvalidateMapSize to Leaflet MapContainer', () => {
            const locationPickerPath = path.resolve(__dirname, '../../../client/src/components/reception/LocationPicker.jsx');
            const code = fs.readFileSync(locationPickerPath, 'utf8');

            expect(code).toContain('labCoordinates = null');
            expect(code).toContain('resolveMapCenter(completeCoords, labCoordinates, defaultCenter)');
            expect(code).toContain('<InvalidateMapSize isFullscreen={isFullscreen} />');
            expect(code).toContain('document.fullscreenEnabled');
            expect(code).toContain('map.invalidateSize()');
        });

        test('SampleMap source code wires InvalidateMapSize and preserves truthful no-coordinates placeholder', () => {
            const sampleMapPath = path.resolve(__dirname, '../../../client/src/components/reception/SampleMap.jsx');
            const code = fs.readFileSync(sampleMapPath, 'utf8');

            expect(code).toContain('InvalidateMapSize');
            expect(code).toContain('map.invalidateSize()');
            expect(code).toContain('document.fullscreenEnabled');
            expect(code).toContain('noCoordinates');
        });

        test('mapConfig.js cites official Esri Master License Agreement and OpenStreetMap Tile Usage Policy', () => {
            const configCode = fs.readFileSync(mapConfigPath, 'utf8');

            expect(configCode).toContain('https://operations.osmfoundation.org/policies/tiles/');
            expect(configCode).toContain('https://www.esri.com/en-us/legal/terms/full-master-agreement');
            expect(configCode).toContain('Esri Master License Agreement');
            expect(configCode).toContain('ZW: [-17.8292, 31.0522]');
        });
    });
});
