import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { MapPinOff, AlertTriangle, Maximize2, Minimize2, Layers } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useLanguage } from '../../context/LanguageContext';
import { OSM_TILE_CONFIG, SATELLITE_TILE_CONFIG } from '../../utils/mapConfig';

// Fix for default marker icon in Leaflet + React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIconRetina,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper component to center map when coordinates change
const ChangeView = ({ center }) => {
    const map = useMap();
    useEffect(() => {
        if (center && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
            map.setView(center, 13);
        }
    }, [center, map]);
    return null;
};

const SampleMap = ({ coordinates, title, uncertaintyM, labCoordinates, countryCode }) => {
    const { t } = useLanguage?.() || { t: (k, d) => d };
    const [mapUnavailable, setMapUnavailable] = useState(false);
    const [layer, setLayer] = useState('osm'); // 'osm' | 'satellite'
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [tileRetryKey, setTileRetryKey] = useState(0);
    const containerRef = useRef(null);
    const tileErrorCountRef = useRef(0);

    const handleTileError = () => {
        tileErrorCountRef.current += 1;
        if (layer === 'satellite') {
            console.warn('Satellite tiles unavailable, falling back to OSM');
            setLayer('osm');
            tileErrorCountRef.current = 0;
            return;
        }
        if (tileErrorCountRef.current >= 2) {
            setMapUnavailable(true);
        }
    };

    const handleTileLoad = () => {
        tileErrorCountRef.current = 0;
    };

    const handleRetryMap = () => {
        tileErrorCountRef.current = 0;
        setMapUnavailable(false);
        setTileRetryKey(prev => prev + 1);
    };

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen?.().catch(err => {
                console.warn('Fullscreen request failed', err);
            });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen?.().catch(err => console.warn(err));
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    const hasCoords = Boolean(
        coordinates &&
        coordinates.lat !== null && coordinates.lat !== undefined &&
        coordinates.lng !== null && coordinates.lng !== undefined &&
        !isNaN(Number(coordinates.lat)) && !isNaN(Number(coordinates.lng)) &&
        Number(coordinates.lat) >= -90 && Number(coordinates.lat) <= 90 &&
        Number(coordinates.lng) >= -180 && Number(coordinates.lng) <= 180
    );

    if (!hasCoords) {
        return (
            <div className="h-64 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl flex flex-col items-center justify-center border-2 border-dashed border-amber-300 dark:border-amber-800/60 p-6 text-center">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-full mb-2">
                    <MapPinOff size={24} />
                </div>
                <h4 className="font-bold text-sf-text text-sm">
                    {t('common.noCoordinates', 'No coordinates recorded in the field')}
                </h4>
                <p className="text-xs text-sf-muted max-w-xs mt-1">
                    {t('common.noCoordinatesDesc', 'This sample was logged without GPS coordinates. Contact the field survey team or check the delivery manifest.')}
                </p>
            </div>
        );
    }

    const lat = parseFloat(coordinates.lat);
    const lng = parseFloat(coordinates.lng);
    const position = [lat, lng];
    const uncertainty = uncertaintyM || coordinates.positionalUncertaintyM || coordinates.accuracy;

    const currentTileConfig = layer === 'satellite' ? SATELLITE_TILE_CONFIG : OSM_TILE_CONFIG;

    return (
        <div
            ref={containerRef}
            className={`relative isolate rounded-xl overflow-hidden shadow-inner border border-sf-divider bg-sf-surface z-0 ${
                isFullscreen ? 'fixed inset-0 z-[9999] h-screen w-screen rounded-none' : 'min-h-[256px] h-64'
            }`}
        >
            {/* Map Controls: Layer Switcher & Fullscreen Button */}
            <div className="absolute top-2 right-2 z-[1000] flex items-center gap-1.5 pointer-events-auto bg-sf-surface/90 dark:bg-sf-surface/90 backdrop-blur-xs p-1 rounded-lg border border-sf-divider shadow-sm">
                <button
                    type="button"
                    onClick={() => setLayer(prev => prev === 'osm' ? 'satellite' : 'osm')}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors ${
                        layer === 'satellite'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-sf-muted hover:text-sf-text hover:bg-sf-raised'
                    }`}
                    title={layer === 'satellite' ? t('map.switchToStandard', 'Switch to Standard Map') : t('map.switchToSatellite', 'Switch to Satellite Imagery')}
                    aria-label="Toggle map layer"
                >
                    <Layers size={13} />
                    <span>{layer === 'satellite' ? t('map.satellite', 'Satellite') : t('map.standard', 'Standard')}</span>
                </button>
                <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="p-1.5 rounded text-sf-muted hover:text-sf-text hover:bg-sf-raised transition-colors"
                    title={isFullscreen ? t('map.exitFullscreen', 'Exit Fullscreen') : t('map.fullscreen', 'Toggle Fullscreen')}
                    aria-label="Toggle fullscreen"
                >
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
            </div>

            {mapUnavailable && (
                <div className="absolute top-2 left-2 right-28 z-[1000] bg-amber-500/90 dark:bg-amber-900/90 backdrop-blur-xs border border-amber-600 text-white dark:text-amber-100 px-3 py-2 rounded-lg text-xs shadow flex items-center justify-between gap-2 animate-fadeIn pointer-events-auto">
                    <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle size={14} className="shrink-0 text-white dark:text-amber-200" />
                        <span className="truncate">{t('common.mapUnavailable', 'Map temporarily unavailable.')}</span>
                    </div>
                    <button
                        type="button"
                        onClick={handleRetryMap}
                        className="px-2.5 py-1 bg-white dark:bg-amber-800 text-amber-900 dark:text-white font-bold rounded-md hover:bg-amber-100 text-[11px] shrink-0 cursor-pointer shadow-xs transition-colors"
                    >
                        {t('common.mapRetry', 'Retry map')}
                    </button>
                </div>
            )}
            <MapContainer center={position} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <ChangeView center={position} />
                {!mapUnavailable && (
                    <TileLayer
                        key={`${layer}-${tileRetryKey}`}
                        url={currentTileConfig.url}
                        attribution={currentTileConfig.attribution}
                        referrerPolicy={currentTileConfig.referrerPolicy}
                        maxNativeZoom={currentTileConfig.maxNativeZoom}
                        maxZoom={currentTileConfig.maxZoom}
                        eventHandlers={{
                            tileerror: handleTileError,
                            tileload: handleTileLoad
                        }}
                    />
                )}
                <Marker position={position}>
                    <Popup>
                        <div className="text-xs font-mono">
                            <div className="font-bold text-gray-900">{title || 'Sample Location'}</div>
                            <div>{lat.toFixed(6)}, {lng.toFixed(6)}</div>
                            {uncertainty && <div>Uncertainty: &plusmn;{uncertainty}m</div>}
                        </div>
                    </Popup>
                </Marker>
                {uncertainty && uncertainty > 0 && (
                    <Circle
                        center={position}
                        radius={parseFloat(uncertainty)}
                        pathOptions={{
                            color: '#2563eb',
                            fillColor: '#3b82f6',
                            fillOpacity: 0.15,
                            weight: 1.5
                        }}
                    />
                )}
            </MapContainer>
        </div>
    );
};

export default SampleMap;
