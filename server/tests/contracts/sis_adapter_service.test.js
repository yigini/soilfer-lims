const {
    unwrapValue,
    extractCoordinates,
    extractDepths,
    extractDates,
    extractProfileReference,
    extractObservations,
    formatSampleV1,
    formatSampleV2
} = require('../../services/sisAdapterService');

describe('Issue #140 Work Package P1: SIS Data Exchange Adapter Contracts', () => {

    describe('1. Metadata unwrapping', () => {
        test('unwraps scalar primitives correctly', () => {
            expect(unwrapValue('simple-string')).toBe('simple-string');
            expect(unwrapValue(42)).toBe(42);
            expect(unwrapValue(0)).toBe(0);
            expect(unwrapValue(false)).toBe(false);
            expect(unwrapValue(null)).toBeNull();
            expect(unwrapValue(undefined)).toBeNull();
        });

        test('unwraps single-level { value, source } wrapper objects', () => {
            expect(unwrapValue({ value: 'FIELD-001', source: 'kobo' })).toBe('FIELD-001');
            expect(unwrapValue({ value: 15.2, source: 'sensor' })).toBe(15.2);
            expect(unwrapValue({ raw: 'RAW-DATA' })).toBe('RAW-DATA');
            expect(unwrapValue({ val: 0 })).toBe(0);
        });

        test('unwraps nested wrappers recursively', () => {
            expect(unwrapValue({ value: { value: 'DEEP-VALUE' } })).toBe('DEEP-VALUE');
            expect(unwrapValue('{"value": "JSON-STRING-VALUE"}')).toBe('JSON-STRING-VALUE');
        });
    });

    describe('2. Truthful WGS84 Coordinates Extraction', () => {
        test('preserves exact 0.0 coordinates (equator / prime meridian) without falsy drop', () => {
            const sample = { latitude: 0.0, longitude: 0.0 };
            const coords = extractCoordinates(sample, {}, {});
            expect(coords).not.toBeNull();
            expect(coords.latitude).toBe(0.0);
            expect(coords.longitude).toBe(0.0);
            expect(coords.srid).toBe(4326);
        });

        test('extracts coordinates from wrapped fieldMetadata', () => {
            const sample = {};
            const field = {
                latitude: { value: -1.2833, source: 'gps' },
                longitude: { value: 36.8167, source: 'gps' },
                accuracy: { value: 4.5 }
            };
            const coords = extractCoordinates(sample, field, {});
            expect(coords).not.toBeNull();
            expect(coords.latitude).toBe(-1.2833);
            expect(coords.longitude).toBe(36.8167);
            expect(coords.accuracyMeters).toBe(4.5);
            expect(coords.source).toBe('FIELD_GPS');
        });

        test('returns null for missing or invalid coordinates outside WGS84 bounds', () => {
            const invalidSample = { latitude: 95.0, longitude: 200.0 };
            expect(extractCoordinates(invalidSample, {}, {})).toBeNull();

            const emptySample = {};
            expect(extractCoordinates(emptySample, {}, {})).toBeNull();
        });
    });

    describe('3. Truthful Depths Extraction', () => {
        test('preserves floating-point decimal depths and zero top depth', () => {
            const sample = { depthTop: 0.0, depthBottom: 15.5 };
            const depths = extractDepths(sample, {}, {});
            expect(depths.topCm).toBe(0.0);
            expect(depths.bottomCm).toBe(15.5);
            expect(depths.depthRange).toBe('0–15.5 cm');
        });

        test('extracts decimal depths from wrapped field metadata without truncation', () => {
            const sample = {};
            const field = {
                depthTopCm: { value: 12.5 },
                depthBottomCm: { value: 37.8 }
            };
            const depths = extractDepths(sample, field, {});
            expect(depths.topCm).toBe(12.5);
            expect(depths.bottomCm).toBe(37.8);
            expect(depths.depthRange).toBe('12.5–37.8 cm');
        });

        test('does NOT invent 0-20 cm defaults when depths are genuinely missing', () => {
            const sample = {};
            const depths = extractDepths(sample, {}, {});
            expect(depths.topCm).toBeNull();
            expect(depths.bottomCm).toBeNull();
            expect(depths.depthRange).toBeNull();
        });
    });

    describe('4. Truthful Dates Extraction', () => {
        test('distinguishes field collectionDate from laboratory receptionDate', () => {
            const sample = {
                receptionDate: new Date('2026-08-15T10:00:00Z')
            };
            const field = {
                collectionDate: { value: '2026-05-10T14:30:00Z' }
            };
            const dates = extractDates(sample, field, {});
            expect(dates.collectionDate).toBe('2026-05-10');
            expect(dates.receptionDate).toBe('2026-08-15');
        });

        test('returns null collectionDate when missing without falling back to reception date', () => {
            const sample = {
                receptionDate: new Date('2026-08-15T10:00:00Z')
            };
            const dates = extractDates(sample, {}, {});
            expect(dates.collectionDate).toBeNull();
            expect(dates.receptionDate).toBe('2026-08-15');
        });
    });

    describe('5. Profile Code and Namespace Resolution', () => {
        test('extracts site_id from fieldMetadata with project namespace', () => {
            const sample = { projectCode: 'SOILFER-US' };
            const field = { site_id: 'PLOT-402' };
            const profile = extractProfileReference(sample, field, {});
            expect(profile.profileCode).toBe('PLOT-402');
            expect(profile.profileNamespace).toBe('SOILFER-US');
            expect(profile.profileKey).toBe('SOILFER-US:PLOT-402');
            expect(profile.profileRelation).toBe('SITE_POINT');
        });

        test('unwraps nested profile code objects', () => {
            const sample = { projectCode: 'SOILFER-JPN' };
            const field = { profile_id: { value: 'PIT-MOZ-12' } };
            const profile = extractProfileReference(sample, field, {});
            expect(profile.profileCode).toBe('PIT-MOZ-12');
            expect(profile.profileKey).toBe('SOILFER-JPN:PIT-MOZ-12');
        });

        test('returns null profileCode and UNSPECIFIED relation when absent', () => {
            const sample = { projectCode: 'SOILFER-US' };
            const profile = extractProfileReference(sample, {}, {});
            expect(profile.profileCode).toBeNull();
            expect(profile.profileKey).toBeNull();
            expect(profile.profileRelation).toBe('UNSPECIFIED');
        });

        test('disambiguates shared programme projects with country prefix', () => {
            const p1 = extractProfileReference({ projectCode: 'P', country: 'AAA' }, { site_id: 'POINT-1' });
            const p2 = extractProfileReference({ projectCode: 'P', country: 'BBB' }, { site_id: 'POINT-1' });
            expect(p1.profileKey).toBe('AAA:P:POINT-1');
            expect(p2.profileKey).toBe('BBB:P:POINT-1');
            expect(p1.profileKey).not.toBe(p2.profileKey);
        });
    });

    describe('6. Lossless Observations Extraction', () => {
        test('retains all determinations including replicates without clobbering', () => {
            const sample = {
                id: 'specimen-uuid-1',
                originalId: 'BAG-001',
                labId: 'LAB-2026-01',
                results: [
                    {
                        id: 'res-1',
                        param: 'PH_H2O',
                        value: '6.5',
                        numericValue: 6.5,
                        unit: 'pH_units',
                        replicateNo: 1,
                        isCurrent: true
                    },
                    {
                        id: 'res-2',
                        param: 'PH_H2O',
                        value: '6.6',
                        numericValue: 6.6,
                        unit: 'pH_units',
                        replicateNo: 2,
                        isCurrent: true
                    }
                ]
            };

            const observations = extractObservations(sample);
            expect(observations).toHaveLength(2);
            expect(observations[0].observationId).toBe('res-1');
            expect(observations[0].replicateNo).toBe(1);
            expect(observations[0].asMeasured.value).toBe(6.5);

            expect(observations[1].observationId).toBe('res-2');
            expect(observations[1].replicateNo).toBe(2);
            expect(observations[1].asMeasured.value).toBe(6.6);
        });

        test('preserves LOD, LOQ, provenance and treats empty string as null value', () => {
            const sample = {
                results: [
                    {
                        id: 'blank-res',
                        param: 'FE',
                        value: '',
                        isCurrent: true,
                        lod: 0.05,
                        loq: 0.1,
                        provenance: 'PREDICTED'
                    }
                ]
            };
            const obs = extractObservations(sample)[0];
            expect(obs.asMeasured.value).toBeNull();
            expect(obs.lod).toBe(0.05);
            expect(obs.loq).toBe(0.1);
            expect(obs.provenance).toBe('PREDICTED');
        });
    });

    describe('7. V1 Backward Compatibility & Additive Metadata', () => {
        test('formatSampleV1 preserves legacy keys and adds non-breaking explicit identifiers', () => {
            const sample = {
                id: 'uuid-1234',
                originalId: 'FIELD-BAG-77',
                labId: 'LAB-ACCESS-99',
                assignedLab: 'GTM-LAB1',
                country: 'GTM',
                projectCode: 'SOILFER-GTM',
                status: 'APPROVED',
                fieldMetadata: JSON.stringify({
                    site_id: { value: 'SITE-A' },
                    latitude: 14.5,
                    longitude: -90.5,
                    collectionDate: '2026-03-01'
                }),
                results: [
                    { id: 'r1', param: 'SOC', value: '1.2', numericValue: 1.2, unit: '%', isCurrent: true }
                ]
            };

            const formatted = formatSampleV1(sample);

            // Legacy keys preserved
            expect(formatted.id).toBe('FIELD-BAG-77');
            expect(formatted.sampleId).toBe('FIELD-BAG-77');
            expect(formatted.originalId).toBe('FIELD-BAG-77');
            expect(formatted.labId).toBe('LAB-ACCESS-99');
            expect(formatted.analyticalResults.SOC.as_measured).toBe(1.2);
            expect(formatted.analyticalResults.SOC.normalized).toBe(12); // % to g/kg factor 10
            expect(formatted.analyticalResults.SOC.value).toBe(12);

            // Additive explicit identities
            expect(formatted.specimenId).toBe('uuid-1234');
            expect(formatted.fieldSampleId).toBe('FIELD-BAG-77');
            expect(formatted.labSampleId).toBe('LAB-ACCESS-99');
            expect(formatted.laboratoryId).toBe('GTM-LAB1');

            // Additive profile metadata
            expect(formatted.profileCode).toBe('SITE-A');
            expect(formatted.profileNamespace).toBe('SOILFER-GTM');
            expect(formatted.profileKey).toBe('SOILFER-GTM:SITE-A');
        });
    });

    describe('8. V2 Clean Lossless Representation', () => {
        test('formatSampleV2 produces clean structured SOSA/GloSIS payload', () => {
            const sample = {
                id: 'uuid-5678',
                originalId: 'FIELD-BAG-88',
                labId: 'LAB-ACCESS-100',
                assignedLab: 'KEN-LAB1',
                country: 'KEN',
                projectCode: 'SOILFER-US',
                status: 'APPROVED',
                fieldMetadata: JSON.stringify({
                    plot_id: 'PLOT-KEN-5',
                    latitude: -1.28,
                    longitude: 36.82,
                    depthTopCm: 0,
                    depthBottomCm: 20,
                    collectionDate: '2026-04-12',
                    collector: 'Dr. John Doe'
                }),
                results: [
                    { id: 'r1', param: 'N_TOTAL', value: '0.15', numericValue: 0.15, unit: '%', isCurrent: true }
                ]
            };

            const v2 = formatSampleV2(sample);
            expect(v2.schemaVersion).toBe('2026-09-issue140-v2');
            expect(v2.specimenId).toBe('uuid-5678');
            expect(v2.fieldSampleId).toBe('FIELD-BAG-88');
            expect(v2.labSampleId).toBe('LAB-ACCESS-100');
            expect(v2.laboratoryId).toBe('KEN-LAB1');
            expect(v2.publicationStatus).toBe('RELEASED');
            expect(v2.sampling.collectorName).toBeNull(); // Redacted in default V2
            expect(v2.profile.code).toBe('PLOT-KEN-5');
            expect(v2.profile.key).toBe('KEN:SOILFER-US:PLOT-KEN-5');
            expect(v2.sampling.location.coordinates).toEqual([36.82, -1.28]); // [lng, lat]
            expect(v2.sampling.depths.topCm).toBe(0);
            expect(v2.sampling.depths.bottomCm).toBe(20);
            expect(v2.observations).toHaveLength(1);
            expect(v2.observations[0].parameter).toBe('N_TOTAL');
        });

        test('unreleased status maps to DRAFT, cancelled to WITHDRAWN', () => {
            const draft = formatSampleV2({ id: 's1', status: 'EXPECTED', results: [] });
            expect(draft.publicationStatus).toBe('DRAFT');

            const withdrawn = formatSampleV2({ id: 's2', status: 'CANCELLED', results: [] });
            expect(withdrawn.publicationStatus).toBe('WITHDRAWN');
        });
    });
});
