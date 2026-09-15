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
