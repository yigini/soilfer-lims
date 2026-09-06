/**
 * Coordinate and Location Provenance Resolver
 * Canonical parser and validator for sample location data across
 * explicit columns, receptionData, and provenance-wrapped fieldMetadata.
 */

function extractNumeric(val) {
    if (val === null || val === undefined || val === '' || typeof val === 'boolean') {
        return null;
    }
    if (typeof val === 'object' && val !== null) {
        if ('value' in val) return extractNumeric(val.value);
        if ('lat' in val) return extractNumeric(val.lat);
        if ('latitude' in val) return extractNumeric(val.latitude);
        if ('lng' in val) return extractNumeric(val.lng);
        if ('longitude' in val) return extractNumeric(val.longitude);
    }
    const num = Number(val);
    if (!Number.isFinite(num)) return null;
    return num;
}

function extractString(val) {
    if (val === null || val === undefined || typeof val === 'boolean') return null;
    if (typeof val === 'object' && val !== null) {
        if ('value' in val) return extractString(val.value);
    }
    const s = String(val).trim();
    return s.length > 0 ? s : null;
}

function isValidLat(lat) {
    return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

function isValidLng(lng) {
    return typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

/**
 * Resolve coordinates and provenance from a sample record
 * Returns {
 *   status: 'RECORDED' | 'TEXT_ONLY' | 'UNKNOWN' | 'NOT_LOADED',
 *   lat: number | null,
 *   lng: number | null,
 *   elevation: number | null,
 *   accuracy: number | null,
 *   source: string | null,
 *   confidence: 'HIGH' | 'MEDIUM' | 'LOW' | null,
 *   captureMethod: string | null,
 *   locationDescription: string | null,
 *   isRecorded: boolean
 * }
 */
function resolveCoordinates(sample) {
    if (!sample) {
        return {
            status: 'NOT_LOADED',
            lat: null,
            lng: null,
            elevation: null,
            accuracy: null,
            source: null,
            confidence: null,
            captureMethod: null,
            locationDescription: null,
            isRecorded: false
        };
    }

    let lat = null;
    let lng = null;
    let elevation = null;
    let accuracy = null;
    let source = null;
    let confidence = null;
    let captureMethod = null;

    // 1. Explicit DB columns (already intaken / accepted)
    if (sample.latitude !== undefined && sample.latitude !== null &&
        sample.longitude !== undefined && sample.longitude !== null) {
        const parsedLat = extractNumeric(sample.latitude);
        const parsedLng = extractNumeric(sample.longitude);
        if (isValidLat(parsedLat) && isValidLng(parsedLng)) {
            lat = parsedLat;
            lng = parsedLng;
            elevation = extractNumeric(sample.elevation);
            accuracy = extractNumeric(sample.positionalUncertaintyM);
            source = sample.locationSource || 'DATABASE_RECORD';
            captureMethod = sample.locationSource || null;
        }
    }

    // 2. Draft / receptionData
    if (lat === null || lng === null) {
        const recData = typeof sample.receptionData === 'string'
            ? (() => { try { return JSON.parse(sample.receptionData); } catch { return null; } })()
            : sample.receptionData;

        const draftCoords = recData?.samplingDetails?.coordinates || recData?.coordinates;
        if (draftCoords) {
            const parsedLat = extractNumeric(draftCoords.lat ?? draftCoords.latitude);
            const parsedLng = extractNumeric(draftCoords.lng ?? draftCoords.longitude);
            if (isValidLat(parsedLat) && isValidLng(parsedLng)) {
                lat = parsedLat;
                lng = parsedLng;
                elevation = extractNumeric(draftCoords.elevation ?? draftCoords.altitude);
                accuracy = extractNumeric(draftCoords.accuracy ?? recData?.samplingDetails?.positionalUncertaintyM);
                source = recData?.samplingDetails?.locationSource || 'RECEPTION_DRAFT';
                captureMethod = recData?.samplingDetails?.captureMethod || null;
                confidence = recData?.samplingDetails?.locationConfidence || null;
            }
        }
    }

    // 3. fieldMetadata (Kobo / survey metadata with provenance)
    if (lat === null || lng === null) {
        const fm = typeof sample.fieldMetadata === 'string'
            ? (() => { try { return JSON.parse(sample.fieldMetadata); } catch { return null; } })()
            : sample.fieldMetadata;

        if (fm && typeof fm === 'object') {
            // Check wrapped or scalar coordinates object
            if (fm.coordinates && typeof fm.coordinates === 'object') {
                const cLat = extractNumeric(fm.coordinates.lat ?? fm.coordinates.latitude);
                const cLng = extractNumeric(fm.coordinates.lng ?? fm.coordinates.longitude);
                if (isValidLat(cLat) && isValidLng(cLng)) {
                    lat = cLat;
                    lng = cLng;
                    accuracy = extractNumeric(fm.coordinates.accuracy ?? fm.gpsAccuracy);
                    elevation = extractNumeric(fm.coordinates.elevation);
                    source = extractString(fm.coordinates.source) || 'FIELD_METADATA';
                }
            }

            // Check latitude/longitude keys (including {value, source})
            if (lat === null || lng === null) {
                const fLat = extractNumeric(fm.latitude ?? fm.lat ?? fm.gps_latitude ?? fm['@lat']);
                const fLng = extractNumeric(fm.longitude ?? fm.lng ?? fm.gps_longitude ?? fm.lon ?? fm['@lon']);
                if (isValidLat(fLat) && isValidLng(fLng)) {
                    lat = fLat;
                    lng = fLng;
                    accuracy = extractNumeric(fm.gpsAccuracy ?? fm.accuracy ?? fm.positionalUncertaintyM);
                    elevation = extractNumeric(fm.elevation ?? fm.altitude);
                    source = (fm.latitude && typeof fm.latitude === 'object' && fm.latitude.source)
                        ? fm.latitude.source
                        : (extractString(fm.locationSource) || 'FIELD_METADATA');
                }
            }

            // Check space-separated gps string e.g. "14.5321 -90.5432 1520 4.2"
            if (lat === null || lng === null) {
                const gpsStr = extractString(fm.gps ?? fm._geolocation_str ?? fm.location_gps);
                if (gpsStr) {
                    const parts = gpsStr.split(/\s+/);
                    if (parts.length >= 2) {
                        const pLat = extractNumeric(parts[0]);
                        const pLng = extractNumeric(parts[1]);
                        if (isValidLat(pLat) && isValidLng(pLng)) {
                            lat = pLat;
                            lng = pLng;
                            if (parts[2]) elevation = extractNumeric(parts[2]);
                            if (parts[3]) accuracy = extractNumeric(parts[3]);
                            source = 'FIELD_GPS';
                        }
                    }
                }
            }

            // Check array e.g. _geolocation: [14.5, -90.5]
            if ((lat === null || lng === null) && Array.isArray(fm._geolocation) && fm._geolocation.length >= 2) {
                const aLat = extractNumeric(fm._geolocation[0]);
                const aLng = extractNumeric(fm._geolocation[1]);
                if (isValidLat(aLat) && isValidLng(aLng)) {
                    lat = aLat;
                    lng = aLng;
                    source = 'FIELD_METADATA';
                }
            }
        }
    }

    // Text-only location description extraction
    const fmObj = typeof sample.fieldMetadata === 'string'
        ? (() => { try { return JSON.parse(sample.fieldMetadata); } catch { return null; } })()
        : sample.fieldMetadata;
    const recDataObj = typeof sample.receptionData === 'string'
        ? (() => { try { return JSON.parse(sample.receptionData); } catch { return null; } })()
        : sample.receptionData;

    const locationDescription = extractString(sample.siteName)
        || extractString(sample.village)
        || extractString(sample.areaVillage)
        || extractString(sample.district)
        || extractString(recDataObj?.samplingDetails?.siteName)
        || extractString(recDataObj?.samplingDetails?.location)
        || extractString(recDataObj?.samplingDetails?.areaVillage)
        || extractString(recDataObj?.samplingDetails?.district)
        || extractString(fmObj?.location)
        || extractString(fmObj?.site)
        || extractString(fmObj?.site_id)
        || extractString(fmObj?.village)
        || extractString(fmObj?.district)
        || extractString(fmObj?.areaVillage)
        || null;

    if (lat !== null && lng !== null) {
        return {
            status: 'RECORDED',
            lat,
            lng,
            elevation,
            accuracy,
            source: source || 'FIELD_GPS',
            confidence: confidence || (accuracy && accuracy <= 20 ? 'HIGH' : 'MEDIUM'),
            captureMethod: captureMethod || source || 'FIELD_GPS',
            locationDescription,
            isRecorded: true
        };
    }

    if (locationDescription) {
        return {
            status: 'TEXT_ONLY',
            lat: null,
            lng: null,
            elevation: null,
            accuracy: null,
            source: 'TEXT_ONLY',
            confidence: 'LOW',
            captureMethod: 'TEXT_ONLY',
            locationDescription,
            isRecorded: false
        };
    }

    return {
        status: 'UNKNOWN',
        lat: null,
        lng: null,
        elevation: null,
        accuracy: null,
        source: null,
        confidence: null,
        captureMethod: null,
        locationDescription: null,
        isRecorded: false
    };
}

module.exports = {
    extractNumeric,
    extractString,
    isValidLat,
    isValidLng,
    resolveCoordinates
};
