/**
 * Universal Coordinate & Geodesy Parser
 * Supports Decimal Degrees (DD), Degrees-Minutes-Seconds (DMS), and UTM with Zone.
 * Part of SoilFER-LIMS Reception Stage B (RC-05, RC-06).
 */

function utmToLatLng(zone, hemisphere, easting, northing) {
    const a = 6378137.0; // WGS84 semi-major axis
    const f = 1 / 298.257223563; // WGS84 flattening
    const b = a * (1 - f);
    const e2 = (a * a - b * b) / (a * a);
    const ePrime2 = (a * a - b * b) / (b * b);
    const k0 = 0.9996;

    const x = easting - 500000.0;
    const isSouth = hemisphere.toUpperCase() === 'S';
    const y = isSouth ? northing - 10000000.0 : northing;

    const m = y / k0;
    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

    const mu = m / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * Math.pow(e2, 3) / 256));

    const j1 = (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32);
    const j2 = (21 * e1 * e1 / 16 - 55 * Math.pow(e1, 4) / 32);
    const j3 = (151 * Math.pow(e1, 3) / 96);
    const j4 = (1097 * Math.pow(e1, 4) / 512);

    const fp = mu + j1 * Math.sin(2 * mu) + j2 * Math.sin(4 * mu) + j3 * Math.sin(6 * mu) + j4 * Math.sin(8 * mu);

    const sinFp = Math.sin(fp);
    const cosFp = Math.cos(fp);
    const tanFp = Math.tan(fp);

    const c1 = ePrime2 * cosFp * cosFp;
    const t1 = tanFp * tanFp;
    const n1 = a / Math.sqrt(1 - e2 * sinFp * sinFp);
    const r1 = a * (1 - e2) / Math.pow(1 - e2 * sinFp * sinFp, 1.5);
    const d = x / (n1 * k0);

    const latRad = fp - (n1 * tanFp / r1) * (
        (d * d) / 2 -
        (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ePrime2) * Math.pow(d, 4) / 24 +
        (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ePrime2 - 3 * c1 * c1) * Math.pow(d, 6) / 720
    );

    const lonRad = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180) +
        (d - (1 + 2 * t1 + c1) * Math.pow(d, 3) / 6 +
        (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ePrime2 + 24 * t1 * t1) * Math.pow(d, 5) / 120) / cosFp;

    const lat = latRad * (180 / Math.PI);
    const lng = lonRad * (180 / Math.PI);

    return {
        lat: parseFloat(lat.toFixed(6)),
        lng: parseFloat(lng.toFixed(6))
    };
}

function parseDmsPart(part) {
    const clean = part.trim().toUpperCase();
    const dmsRegex = /([+-]?\d+(?:\.\d+)?)[°\s:]+(\d+(?:\.\d+)?)?['′\s:]*(\d+(?:\.\d+)?)?["″\s]*([NSEW])?/i;
    const match = clean.match(dmsRegex);
    if (!match) return null;

    let deg = parseFloat(match[1]);
    let min = match[2] ? parseFloat(match[2]) : 0;
    let sec = match[3] ? parseFloat(match[3]) : 0;
    let hemi = match[4];

    if (isNaN(deg)) return null;

    let sign = (deg < 0) ? -1 : 1;
    deg = Math.abs(deg);
    let val = sign * (deg + min / 60 + sec / 3600);

    if (hemi === 'S' || hemi === 'W') {
        val = -Math.abs(val);
    } else if (hemi === 'N' || hemi === 'E') {
        val = Math.abs(val);
    }

    return {
        val: parseFloat(val.toFixed(6)),
        hasMinutesOrSeconds: (min > 0 || sec > 0)
    };
}

function estimateDdUncertainty(str) {
    const decimals = str.match(/\.\d+/g);
    if (!decimals) return 10000;
    const minDecLength = Math.min(...decimals.map(d => d.length - 1));
    if (minDecLength >= 5) return 10;
    if (minDecLength === 4) return 30;
    if (minDecLength === 3) return 150;
    if (minDecLength === 2) return 1500;
    return 10000;
}

/**
 * Universal Coordinate Parser
 * @param {string} input - Raw coordinate input string
 * @returns {object|null} { lat, lng, format, uncertaintyM, sourceDescription } or null
 */
function parseCoordinates(input) {
    if (!input || typeof input !== 'string') return null;
    const text = input.trim();
    if (!text) return null;

    // 1. Try UTM Pattern
    // Flexible regex supporting:
    // "15N 752300 1625400"
    // "Zone 15N, 752300m E, 1625400m N"
    // "35S 245000 8530000"
    const utmRegex = /(?:ZONE\s*)?(\d{1,2})\s*([A-Z])(?:[,\s]+|(?=\d))(?:(?:EAST(?:ING)?|E)?\s*(\d{5,7}(?:\.\d+)?)(?:[m\s,]+(?:E)?))[\s,]+(?:(?:NORTH(?:ING)?|N)?\s*(\d{6,8}(?:\.\d+)?)(?:[m\s,]+(?:N)?))/i;
    let utmMatch = text.match(utmRegex);

    if (!utmMatch) {
        // Fallback simplified UTM regex: ZoneLetter Easting Northing
        const simpleUtm = /(?:ZONE\s*)?(\d{1,2})\s*([A-Z])[\s,]+(\d{5,7}(?:\.\d+)?)[\s,]+(\d{6,8}(?:\.\d+)?)/i;
        utmMatch = text.match(simpleUtm);
    }

    if (utmMatch) {
        const zone = parseInt(utmMatch[1], 10);
        const letter = utmMatch[2].toUpperCase();
        const easting = parseFloat(utmMatch[3]);
        const northing = parseFloat(utmMatch[4]);

        if (zone >= 1 && zone <= 60 && easting >= 100000 && easting <= 900000 && northing >= 0 && northing <= 10000000) {
            // Determine hemisphere:
            // S is explicitly South, N is explicitly North
            // Latitude bands C..M are Southern Hemisphere
            let hemisphere = 'N';
            if (letter === 'S' || (letter >= 'C' && letter <= 'M')) {
                hemisphere = 'S';
            }

            const { lat, lng } = utmToLatLng(zone, hemisphere, easting, northing);
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                return {
                    lat,
                    lng,
                    format: 'UTM',
                    utm: { zone, hemisphere, easting, northing },
                    uncertaintyM: 10,
                    sourceDescription: `UTM Zone ${zone}${hemisphere} ${Math.round(easting)}E ${Math.round(northing)}N`
                };
            }
        }
    }

    // 2. Try DMS or DD with cardinal letters
    if (/[°'"NSEW]/i.test(text) && /[,\s]+/.test(text)) {
        let parts = text.split(/[,;\/]/);
        if (parts.length === 1) {
            const splitMatch = text.match(/^(.*?[NS])[\s,]+(.*?)$/i);
            if (splitMatch) {
                parts = [splitMatch[1], splitMatch[2]];
            }
        }

        if (parts.length >= 2) {
            const latRes = parseDmsPart(parts[0]);
            const lngRes = parseDmsPart(parts[1]);
            if (latRes !== null && lngRes !== null) {
                const lat = latRes.val;
                const lng = lngRes.val;
                if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    const isRealDms = latRes.hasMinutesOrSeconds || lngRes.hasMinutesOrSeconds || text.includes('\'') || text.includes('"');
                    return {
                        lat,
                        lng,
                        format: isRealDms ? 'DMS' : 'DD',
                        uncertaintyM: isRealDms ? 10 : estimateDdUncertainty(text),
                        sourceDescription: text
                    };
                }
            }
        }
    }

    // 3. Try Standard Decimal Degrees Pattern (plain numbers)
    const ddRegex = /([+-]?\d+(?:\.\d+)?)\s*°?\s*([NS])?[\s,;\/]+([+-]?\d+(?:\.\d+)?)\s*°?\s*([EW])?/i;
    const ddMatch = text.match(ddRegex);
    if (ddMatch) {
        let lat = parseFloat(ddMatch[1]);
        const latHemi = ddMatch[2]?.toUpperCase();
        let lng = parseFloat(ddMatch[3]);
        const lngHemi = ddMatch[4]?.toUpperCase();

        if (latHemi === 'S') lat = -Math.abs(lat);
        if (latHemi === 'N') lat = Math.abs(lat);
        if (lngHemi === 'W') lng = -Math.abs(lng);
        if (lngHemi === 'E') lng = Math.abs(lng);

        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return {
                lat: parseFloat(lat.toFixed(6)),
                lng: parseFloat(lng.toFixed(6)),
                format: 'DD',
                uncertaintyM: estimateDdUncertainty(text),
                sourceDescription: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
            };
        }
    }

    return null;
}

module.exports = {
    parseCoordinates,
    utmToLatLng,
    estimateDdUncertainty
};
