/**
 * Shared Map Provider Configurations
 *
 * OpenStreetMap Tile Usage Policy (https://operations.osmfoundation.org/policies/tiles/)
 * mandates a valid HTTP Referer or User-Agent identifying the consuming application.
 *
 * Leaflet's TileLayer natively supports the `referrerPolicy` option:
 * setting `referrerPolicy: 'strict-origin'` instructs Leaflet to attach
 * referrerpolicy="strict-origin" to every rendered <img> tile element.
 *
 * This allows the browser to transmit the application's origin (e.g. `https://lims.yigini.net/`)
 * to OpenStreetMap tile servers, preventing 403 Access Blocked rejections while:
 * 1. Maintaining the application's global `Referrer-Policy: no-referrer` header for all other traffic.
 * 2. Ensuring no sensitive paths, query parameters, sample IDs, or tokens are leaked to OSM.
 */

export const OSM_TILE_CONFIG = {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    referrerPolicy: 'strict-origin',
    maxNativeZoom: 19,
    maxZoom: 19
};

/**
 * Esri World Imagery Terms of Use Reference:
 * Esri Master License Agreement (MLA) and ArcGIS Online Terms of Use
 * (https://www.esri.com/en-us/legal/terms/full-master-agreement):
 * World Imagery map service is available for public application display provided that:
 * 1. The service is accessed without circumvention of access controls.
 * 2. Esri and its data contributors are credited with copyright attribution:
 *    "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
 * Note: A reachable public tile endpoint is not legally unencumbered merely because
 * client code displays attribution; consuming deployments must comply with official terms.
 */

export const SATELLITE_TILE_CONFIG = {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    referrerPolicy: 'strict-origin',
    maxNativeZoom: 19,
    maxZoom: 19
};

export const COUNTRY_CENTERS = {
    GT: [15.78, -90.23],   // Guatemala
    RW: [-1.94, 29.87],    // Rwanda
    KE: [-1.29, 36.82],    // Kenya
    UG: [0.35, 32.58],     // Uganda
    TZ: [-6.37, 34.89],    // Tanzania
    ET: [9.15, 40.49],     // Ethiopia
    ZM: [-15.41, 28.28],   // Zambia
    ZW: [-17.8292, 31.0522], // Zimbabwe (Harare)
    DEFAULT: [0, 25]       // Central Africa fallback
};

/**
 * Resolves map center coordinates following canonical precedence (#114):
 * 1. Sample coordinates (if valid)
 * 2. Laboratory coordinates (if valid)
 * 3. Neutral fallback center [lat, lng]
 */
export function resolveMapCenter(sampleCoords, labCoords, fallback = [0, 20]) {
    const parseCoord = (coords) => {
        if (!coords) return null;
        let lat, lng;
        if (typeof coords === 'string') {
            const parts = coords.replace(/[\[\]\(\)]/g, '').split(',').map(s => parseFloat(s.trim()));
            if (parts.length >= 2) {
                lat = parts[0];
                lng = parts[1];
            }
        } else if (Array.isArray(coords) && coords.length >= 2) {
            lat = parseFloat(coords[0]);
            lng = parseFloat(coords[1]);
        } else if (typeof coords === 'object') {
            lat = parseFloat(coords.lat !== undefined ? coords.lat : coords.latitude);
            lng = parseFloat(coords.lng !== undefined ? coords.lng : (coords.lon !== undefined ? coords.lon : coords.longitude));
        }
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return [lat, lng];
        }
        return null;
    };

    const sample = parseCoord(sampleCoords);
    if (sample) return sample;

    const lab = parseCoord(labCoords);
    if (lab) return lab;

    const defFallback = parseCoord(fallback);
    return defFallback || [0, 20];
}

