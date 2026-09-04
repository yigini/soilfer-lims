const { parseCoordinates, utmToLatLng, estimateDdUncertainty } = require('../../utils/coordParser');

describe('Universal Coordinate Parser (RC-05, RC-06)', () => {
    test('parses standard Decimal Degrees with comma', () => {
        const res = parseCoordinates('14.803300, -90.230100');
        expect(res).not.toBeNull();
        expect(res.lat).toBeCloseTo(14.8033, 4);
        expect(res.lng).toBeCloseTo(-90.2301, 4);
        expect(res.format).toBe('DD');
        expect(res.uncertaintyM).toBe(10);
    });

    test('parses Decimal Degrees with cardinal directions and symbols', () => {
        const res = parseCoordinates('14.8033° N, 90.2301° W');
        expect(res).not.toBeNull();
        expect(res.lat).toBeCloseTo(14.8033, 4);
        expect(res.lng).toBeCloseTo(-90.2301, 4);
        expect(res.format).toBe('DD');
    });

    test('parses Southern Hemisphere & East African coordinates', () => {
        const res = parseCoordinates('-1.2921, 36.8219');
        expect(res).not.toBeNull();
        expect(res.lat).toBeCloseTo(-1.2921, 4);
        expect(res.lng).toBeCloseTo(36.8219, 4);
    });

    test('parses Degrees-Minutes-Seconds (DMS)', () => {
        const res = parseCoordinates('14°48\'12"N, 90°13\'48"W');
        expect(res).not.toBeNull();
        expect(res.lat).toBeCloseTo(14.803333, 3);
        expect(res.lng).toBeCloseTo(-90.230000, 3);
        expect(res.format).toBe('DMS');
        expect(res.uncertaintyM).toBe(10);
    });

    test('parses DMS with space delimiter and decimals', () => {
        const res = parseCoordinates('14 48 12.6 N 90 13 48.4 W');
        expect(res).not.toBeNull();
        expect(res.lat).toBeCloseTo(14.8035, 3);
        expect(res.lng).toBeCloseTo(-90.2301, 3);
    });

    test('parses UTM Zone 15N (Guatemala)', () => {
        const res = parseCoordinates('15N 752300 1625400');
        expect(res).not.toBeNull();
        expect(res.format).toBe('UTM');
        expect(res.lat).toBeCloseTo(14.690472, 3);
        expect(res.lng).toBeCloseTo(-90.657096, 3);
        expect(res.uncertaintyM).toBe(10);
    });

    test('parses UTM with Zone keyword and units', () => {
        const res = parseCoordinates('Zone 15N, 752300m E, 1625400m N');
        expect(res).not.toBeNull();
        expect(res.lat).toBeCloseTo(14.690472, 3);
        expect(res.lng).toBeCloseTo(-90.657096, 3);
    });

    test('parses UTM Zone 35S (Zambia)', () => {
        const res = parseCoordinates('35S 245000 8530000');
        expect(res).not.toBeNull();
        expect(res.lat).toBeCloseTo(-13.28629, 3);
        expect(res.lng).toBeCloseTo(24.646367, 3);
    });

    test('returns null for invalid strings', () => {
        expect(parseCoordinates('not a coordinate')).toBeNull();
        expect(parseCoordinates('')).toBeNull();
        expect(parseCoordinates(null)).toBeNull();
    });
});
