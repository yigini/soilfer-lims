import React, { useState, useEffect, useRef } from 'react';
import { Globe, MapPin, Maximize2, Minimize2, Map, Box, Maximize, Camera, X, AlertTriangle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { OSM_TILE_CONFIG } from '../../utils/mapConfig';
import { useLanguage } from '../../context/LanguageContext';

// Custom Leaflet marker icon (no external images needed)
const sampleIcon = new L.DivIcon({
    className: '',
    html: `
        <div style="position:relative;width:32px;height:42px">
            <svg viewBox="0 0 32 42" width="32" height="42" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z" fill="#2563eb" stroke="#fff" stroke-width="2"/>
                <circle cx="16" cy="15" r="6" fill="#fff"/>
                <circle cx="16" cy="15" r="3" fill="#2563eb"/>
            </svg>
        </div>`,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -42]
});

// ─── Cesium CDN Loader ───
const CESIUM_VERSION = '1.124';
const CESIUM_BASE = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium`;
const CESIUM_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhZjA2OTI4NC0yYjg4LTRhZjUtOWQ2OS04YmU5MWIyYmYyOTciLCJpZCI6NjU0MzUsImlhdCI6MTc3MDYyOTY3OX0.5vA6I0n9SS-f1SCt8xQQmw1JhrKsEsfqZgzhJ_4Tgh8';

let cesiumLoadPromise = null;
const loadCesium = () => {
    if (cesiumLoadPromise) return cesiumLoadPromise;
    cesiumLoadPromise = new Promise((resolve, reject) => {
        if (window.Cesium) return resolve(window.Cesium);
        if (!document.getElementById('cesium-widget-css')) {
            const link = document.createElement('link');
            link.id = 'cesium-widget-css';
            link.rel = 'stylesheet';
            link.href = `${CESIUM_BASE}/Widgets/widgets.css`;
            document.head.appendChild(link);
        }
        const script = document.createElement('script');
        script.src = `${CESIUM_BASE}/Cesium.js`;
        script.onload = () => window.Cesium ? resolve(window.Cesium) : (cesiumLoadPromise = null, reject(new Error('CesiumJS failed')));
        script.onerror = () => { cesiumLoadPromise = null; reject(new Error('CDN load failed')); };
        document.head.appendChild(script);
    });
    return cesiumLoadPromise;
};

// ─── Photo helpers ───
const proxyUrl = (url) => url ? `/api/kobo/media?url=${encodeURIComponent(url)}` : null;
const HIDDEN = ['participant_signature', 'surveyor_signature', 'signature'];
const DIR_LABELS = { north: 'N', south: 'S', east: 'E', west: 'W' };

function getPhotos(sample) {
    let rawMeta = sample?.metadata || {};
    if (typeof rawMeta === 'string') { try { rawMeta = JSON.parse(rawMeta); } catch { rawMeta = {}; } }
    const all = (rawMeta?.attachments || []).filter(a => a.mimetype?.startsWith('image') && !HIDDEN.includes(a.category));
    const directional = all.filter(a => ['north', 'south', 'east', 'west'].includes(a.category));
    const soil = all.filter(a => a.category === 'soil' || a.category === 'sample');
    const other = all.filter(a => !['north', 'south', 'east', 'west', 'soil', 'sample'].includes(a.category));
    return { all, directional, soil, other };
}


// ─── Photo Lightbox ───
const PhotoLightbox = ({ photos, index, onClose, onNav }) => {
    const photo = photos[index];
    if (!photo) return null;
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') onNav(-1);
            if (e.key === 'ArrowRight') onNav(1);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);
    return (
        <div className="fixed inset-0 z-[10000] bg-black/90 flex items-center justify-center" onClick={onClose}>
            <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <img
                    src={proxyUrl(photo.download_large || photo.download_url)}
                    alt={photo.category || photo.filename}
                    className="max-w-full max-h-[85vh] object-contain rounded-lg"
                />
                <div className="absolute top-3 left-3 px-3 py-1.5 bg-black/70 backdrop-blur rounded-lg">
                    <span className="text-white text-xs font-bold capitalize">{photo.category || 'Photo'}</span>
                    <span className="text-white/50 text-xs ml-2">{index + 1}/{photos.length}</span>
                </div>
                <button onClick={onClose}
                    className="absolute top-3 right-3 w-8 h-8 bg-black/70 backdrop-blur rounded-lg flex items-center justify-center text-white hover:bg-red-600 transition">
                    ✕
                </button>
                {photos.length > 1 && (
                    <>
                        <button onClick={() => onNav(-1)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-white/20 text-lg">‹</button>
                        <button onClick={() => onNav(1)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/60 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-white/20 text-lg">›</button>
                    </>
                )}
            </div>
        </div>
    );
};


// ─── Photo Popup Panel (shown when pin is clicked) ───
const PhotoPopupPanel = ({ sample, photos, onClose, onPhotoClick }) => {
    const { directional, soil, other } = photos;
    const allPhotos = photos.all;
    if (allPhotos.length === 0) return null;

    return (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1001] w-[340px] max-h-[80%] bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/15 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <Camera size={14} className="text-blue-400" />
                    <span className="text-white text-xs font-bold">Field Photos</span>
                    <span className="text-white/40 text-[10px]">— {sample.originalId || sample.id}</span>
                </div>
                <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition">
                    <X size={14} />
                </button>
            </div>

            {/* Photos grid */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
                {/* Directional Photos (N/S/E/W) */}
                {directional.length > 0 && (
                    <div>
                        <div className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-2">🧭 Directional Views</div>
                        <div className="grid grid-cols-2 gap-1.5">
                            {['north', 'east', 'south', 'west'].map(dir => {
                                const photo = directional.find(p => p.category === dir);
                                if (!photo) return (
                                    <div key={dir} className="aspect-square rounded-lg border border-dashed border-white/10 flex items-center justify-center">
                                        <span className="text-white/20 text-[10px] font-bold">{DIR_LABELS[dir]}</span>
                                    </div>
                                );
                                const globalIdx = allPhotos.indexOf(photo);
                                return (
                                    <button key={dir} onClick={() => onPhotoClick(globalIdx)}
                                        className="relative aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-blue-400 transition group cursor-pointer">
                                        <img src={proxyUrl(photo.download_small || photo.download_medium || photo.download_url)}
                                            alt={dir} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" loading="lazy" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 backdrop-blur rounded text-[9px] text-white font-bold">
                                            {DIR_LABELS[dir]}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Soil / Sample Photos */}
                {soil.length > 0 && (
                    <div>
                        <div className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-2">🌍 Soil & Sample</div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {soil.map((photo, i) => {
                                const globalIdx = allPhotos.indexOf(photo);
                                return (
                                    <button key={i} onClick={() => onPhotoClick(globalIdx)}
                                        className="relative aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-blue-400 transition group cursor-pointer">
                                        <img src={proxyUrl(photo.download_small || photo.download_medium || photo.download_url)}
                                            alt={photo.category} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" loading="lazy" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                                        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 backdrop-blur rounded text-[8px] text-white font-bold capitalize">
                                            {photo.category}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Other Photos */}
                {other.length > 0 && (
                    <div>
                        <div className="text-[9px] text-white/40 font-bold uppercase tracking-widest mb-2">📷 Other</div>
                        <div className="grid grid-cols-3 gap-1.5">
                            {other.map((photo, i) => {
                                const globalIdx = allPhotos.indexOf(photo);
                                return (
                                    <button key={i} onClick={() => onPhotoClick(globalIdx)}
                                        className="relative aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-blue-400 transition group cursor-pointer">
                                        <img src={proxyUrl(photo.download_small || photo.download_medium || photo.download_url)}
                                            alt={photo.category || 'photo'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" loading="lazy" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                                        <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 backdrop-blur rounded text-[8px] text-white font-bold capitalize">
                                            {photo.category || 'photo'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


// ─── Cesium 3D View ───
const CesiumView = ({ lat, lng, sample, onPinClick }) => {
    const containerRef = useRef(null);
    const viewerRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [ionAvailable, setIonAvailable] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;
        let viewer = null;
        let destroyed = false;

        const init = async () => {
            try {
                const Cesium = await loadCesium();
                if (destroyed) return;
                Cesium.Ion.defaultAccessToken = CESIUM_TOKEN;
                if (containerRef.current) containerRef.current.innerHTML = '';

                let terrainProvider, usingIon = false;
                try { terrainProvider = await Cesium.createWorldTerrainAsync(); usingIon = true; }
                catch (e) { terrainProvider = new Cesium.EllipsoidTerrainProvider(); }
                if (destroyed) return;

                viewer = new Cesium.Viewer(containerRef.current, {
                    terrainProvider,
                    baseLayerPicker: false, geocoder: false, homeButton: false,
                    sceneModePicker: false, selectionIndicator: false, infoBox: false,
                    timeline: false, animation: false, navigationHelpButton: false,
                    fullscreenButton: false,
                    creditContainer: document.createElement('div'),
                    skyBox: false, shadows: false, imageryProvider: false, msaaSamples: 2
                });
                if (destroyed) { viewer.destroy(); return; }

                // Imagery
                if (usingIon) {
                    try {
                        const ionImg = await Cesium.IonImageryProvider.fromAssetId(2);
                        if (!destroyed) { viewer.imageryLayers.addImageryProvider(ionImg); setIonAvailable(true); }
                    } catch (e) {
                        if (!destroyed) viewer.imageryLayers.addImageryProvider(
                            new Cesium.UrlTemplateImageryProvider({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', credit: 'Esri' })
                        );
                    }
                } else if (!destroyed) {
                    viewer.imageryLayers.addImageryProvider(
                        new Cesium.UrlTemplateImageryProvider({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', credit: 'Esri' })
                    );
                }
                if (destroyed) { viewer.destroy(); return; }

                viewer.scene.globe.enableLighting = false;
                viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#1e293b');

                // Sample pin
                viewer.entities.add({
                    name: 'sample-pin',
                    position: Cesium.Cartesian3.fromDegrees(lng, lat, 20),
                    point: {
                        pixelSize: 18,
                        color: Cesium.Color.fromCssColorString('#2563eb'),
                        outlineColor: Cesium.Color.WHITE,
                        outlineWidth: 4,
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
                    },
                    label: {
                        text: '📍 ' + (sample.originalId || sample.id || 'Sample'),
                        font: 'bold 14px Inter, system-ui, sans-serif',
                        fillColor: Cesium.Color.WHITE,
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 3,
                        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        pixelOffset: new Cesium.Cartesian2(0, -20),
                        disableDepthTestDistance: Number.POSITIVE_INFINITY,
                        showBackground: true,
                        backgroundColor: Cesium.Color.fromCssColorString('#1e293b').withAlpha(0.9),
                        backgroundPadding: new Cesium.Cartesian2(10, 6)
                    }
                });

                // Camera — tilted to show 3D terrain, centered on pin
                const target = Cesium.Cartesian3.fromDegrees(lng, lat);
                viewer.camera.lookAt(
                    target,
                    new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 3000)
                );
                viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

                // Click handler → show photo popup
                const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
                clickHandler.setInputAction((click) => {
                    const picked = viewer.scene.pick(click.position);
                    if (Cesium.defined(picked) && picked.id && picked.id.name === 'sample-pin') {
                        onPinClick();
                    }
                }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

                // Hover tooltip
                const tooltipDiv = document.createElement('div');
                tooltipDiv.style.cssText = 'position:absolute;pointer-events:none;padding:8px 12px;background:rgba(15,23,42,0.95);color:white;border-radius:8px;font:bold 11px Inter,system-ui,sans-serif;border:1px solid rgba(255,255,255,0.15);display:none;z-index:100;white-space:nowrap;backdrop-filter:blur(8px)';
                containerRef.current.appendChild(tooltipDiv);

                const tooltipHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
                tooltipHandler.setInputAction((movement) => {
                    const picked = viewer.scene.pick(movement.endPosition);
                    if (Cesium.defined(picked) && picked.id) {
                        tooltipDiv.style.display = 'block';
                        tooltipDiv.style.left = (movement.endPosition.x + 16) + 'px';
                        tooltipDiv.style.top = (movement.endPosition.y - 16) + 'px';
                        tooltipDiv.innerHTML = '📍 ' + (sample.originalId || sample.id) +
                            (sample.projectCode ? ' • ' + sample.projectCode : '') +
                            '<br><span style="font-size:9px;color:#94a3b8;font-weight:normal">Click to view field photos</span>';
                        containerRef.current.style.cursor = 'pointer';
                    } else {
                        tooltipDiv.style.display = 'none';
                        containerRef.current.style.cursor = '';
                    }
                }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

                viewerRef.current = viewer;
                setLoading(false);
            } catch (e) {
                if (!destroyed) { setError(e.message); setLoading(false); }
            }
        };

        init();
        return () => {
            destroyed = true;
            if (viewer && !viewer.isDestroyed()) viewer.destroy();
            viewerRef.current = null;
        };
    }, [lat, lng]);

    useEffect(() => { setLoading(true); setError(null); }, []);

    return (
        <div className="w-full h-full relative">
            {loading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900">
                    <Globe size={36} className="text-blue-500 animate-pulse mb-3" />
                    <p className="text-white text-xs font-bold uppercase tracking-widest">Loading 3D View</p>
                </div>
            )}
            {error && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-red-950/80">
                    <p className="text-red-400 text-sm font-bold mb-2">3D map error</p>
                    <p className="text-red-300/70 text-xs">{error}</p>
                </div>
            )}
            <div ref={containerRef} className="w-full h-full" />
        </div>
    );
};


// ─── Leaflet 2D View ───
const LeafletView = ({ lat, lng, sample, onPinClick }) => {
    const { t } = useLanguage?.() || { t: (k, d) => d };
    const [mapUnavailable, setMapUnavailable] = useState(false);
    const [tileRetryKey, setTileRetryKey] = useState(0);
    const tileErrorCountRef = useRef(0);

    const handleTileError = () => {
        tileErrorCountRef.current += 1;
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

    const position = [Number(lat), Number(lng)];
    const photos = getPhotos(sample);
    const hasPhotos = photos.all.length > 0;

    return (
        <div className="w-full h-full z-0 relative">
            {mapUnavailable && (
                <div className="absolute top-14 left-3 right-3 z-[1000] bg-amber-500/90 dark:bg-amber-900/90 backdrop-blur-xs border border-amber-600 text-white dark:text-amber-100 px-3 py-2 rounded-lg text-xs shadow flex items-center justify-between gap-2 animate-fadeIn pointer-events-auto">
                    <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle size={14} className="shrink-0 text-white dark:text-amber-200" />
                        <span className="truncate">{t('common.mapUnavailable', 'Map temporarily unavailable. You can still enter coordinates.')}</span>
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
            <MapContainer center={position} zoom={18} style={{ height: '100%', width: '100%' }}>
                <LayersControl position="topright">
                    <LayersControl.BaseLayer checked name="Satellite (Esri)">
                        <TileLayer attribution='Tiles &copy; Esri'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            maxNativeZoom={19} maxZoom={21} />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Street (OpenStreetMap)">
                        {!mapUnavailable && (
                            <TileLayer
                                key={tileRetryKey}
                                attribution={OSM_TILE_CONFIG.attribution}
                                url={OSM_TILE_CONFIG.url}
                                referrerPolicy={OSM_TILE_CONFIG.referrerPolicy}
                                maxNativeZoom={19} maxZoom={21}
                                eventHandlers={{
                                    tileerror: handleTileError,
                                    tileload: handleTileLoad
                                }}
                            />
                        )}
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Google Satellite">
                        <TileLayer attribution='&copy; Google'
                            url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                            maxNativeZoom={20} maxZoom={21} />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="Google Hybrid">
                        <TileLayer attribution='&copy; Google'
                            url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
                            maxNativeZoom={20} maxZoom={21} />
                    </LayersControl.BaseLayer>
                </LayersControl>
                <Marker position={position} icon={sampleIcon}
                    eventHandlers={{ click: () => { if (hasPhotos) onPinClick(); } }}>
                    {!hasPhotos && (
                        <Popup>
                            <strong>{sample.originalId || sample.id}</strong><br />
                            {sample.projectCode && <span>{sample.projectCode}<br /></span>}
                            {sample.country && <span>{sample.country}<br /></span>}
                            <span style={{ fontSize: '11px', color: '#888' }}>{Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</span>
                        </Popup>
                    )}
                </Marker>
            </MapContainer>
        </div>
    );
};


// ─── Main FieldMap Component ───
const FieldMap = ({ sample }) => {
    const [viewMode, setViewMode] = useState('3d');
    const [expanded, setExpanded] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [showPhotoPopup, setShowPhotoPopup] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(null);

    // Parse coordinates
    let lat = null, lng = null;
    const isFiniteNum = (n) => n !== null && n !== undefined && n !== '' && !isNaN(Number(n)) && Number.isFinite(Number(n));
    if (sample?.coordinates && isFiniteNum(sample.coordinates.lat) && isFiniteNum(sample.coordinates.lng)) {
        lat = Number(sample.coordinates.lat);
        lng = Number(sample.coordinates.lng);
    }
    if (lat === null || lng === null) {
        try {
            const fm = typeof sample?.fieldMetadata === 'string' ? JSON.parse(sample.fieldMetadata) : sample?.fieldMetadata;
            if (fm) {
                const v = (obj) => obj && typeof obj === 'object' ? obj.value : obj;
                const rawLat = v(fm.latitude) ?? v(fm.lat) ?? v(fm.gps_latitude);
                const rawLng = v(fm.longitude) ?? v(fm.lng) ?? v(fm.gps_longitude) ?? v(fm.lon);
                if (isFiniteNum(rawLat) && isFiniteNum(rawLng)) {
                    lat = Number(rawLat);
                    lng = Number(rawLng);
                }
            }
        } catch (e) { }
    }
    if (lat === null || lng === null) {
        if (sample?.location && isFiniteNum(sample.location.lat) && isFiniteNum(sample.location.lng)) {
            lat = Number(sample.location.lat);
            lng = Number(sample.location.lng);
        }
    }

    const photos = getPhotos(sample);

    // Escape handlers
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') {
                if (lightboxIndex !== null) setLightboxIndex(null);
                else if (showPhotoPopup) setShowPhotoPopup(false);
                else if (fullscreen) setFullscreen(false);
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [fullscreen, showPhotoPopup, lightboxIndex]);

    const hasValidCoords = lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    if (!hasValidCoords) {
        return (
            <div className="bg-gray-50 dark:bg-gray-800/50 border border-sf-divider rounded-xl h-[300px] flex items-center justify-center">
                <div className="text-center p-6">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <MapPin size={24} className="text-gray-400" />
                    </div>
                    <p className="text-sm font-bold text-sf-muted mb-1">No Coordinates Available</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">This sample doesn't have GPS data</p>
                </div>
            </div>
        );
    }

    const handlePinClick = () => {
        if (photos.all.length > 0) setShowPhotoPopup(true);
    };

    // Controls bar
    const Controls = ({ isFullscreen }) => (
        <div className={`absolute top-3 right-3 z-[1000] flex gap-1.5 ${isFullscreen ? 'top-5 right-5' : ''}`}>
            <div className="flex rounded-lg overflow-hidden border border-white/15 shadow-lg">
                <button onClick={() => setViewMode('3d')}
                    className={`px-3 py-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-all backdrop-blur-xl ${viewMode === '3d' ? 'bg-blue-600/90 text-white' : 'bg-slate-900/80 text-gray-400 hover:text-white'}`}>
                    <Box size={12} /> 3D
                </button>
                <button onClick={() => setViewMode('2d')}
                    className={`px-3 py-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-all backdrop-blur-xl ${viewMode === '2d' ? 'bg-blue-600/90 text-white' : 'bg-slate-900/80 text-gray-400 hover:text-white'}`}>
                    <Map size={12} /> 2D
                </button>
            </div>
            {isFullscreen ? (
                <button onClick={() => setFullscreen(false)}
                    className="p-2 bg-red-600/80 backdrop-blur-xl border border-red-500/30 text-white rounded-lg transition-all hover:bg-red-700" title="Close (Esc)">
                    <Minimize2 size={14} />
                </button>
            ) : (
                <>
                    <button onClick={() => setExpanded(!expanded)}
                        className="p-2 bg-slate-900/80 backdrop-blur-xl border border-white/10 text-gray-400 hover:text-white rounded-lg transition-all"
                        title={expanded ? 'Collapse' : 'Expand'}>
                        {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button onClick={() => setFullscreen(true)}
                        className="p-2 bg-slate-900/80 backdrop-blur-xl border border-white/10 text-gray-400 hover:text-white rounded-lg transition-all" title="Fullscreen">
                        <Maximize size={14} />
                    </button>
                </>
            )}
        </div>
    );

    // Bottom info bar
    const InfoBar = ({ isFullscreen }) => (
        <div className={`absolute ${isFullscreen ? 'bottom-5 left-5 right-5' : 'bottom-3 left-3 right-3'} z-[1000]`}>
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900/85 backdrop-blur-xl rounded-xl border border-white/10">
                <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-blue-400" />
                    <span className="text-[10px] text-white font-bold">{sample.originalId || sample.id}</span>
                    {sample.projectCode && (<><div className="w-px h-3 bg-white/20" /><span className="text-[10px] text-gray-400">{sample.projectCode}</span></>)}
                    {sample.country && (<><div className="w-px h-3 bg-white/20" /><span className="text-[10px] text-gray-400">{sample.country}</span></>)}
                    {photos.all.length > 0 && (
                        <><div className="w-px h-3 bg-white/20" /><span className="text-[10px] text-blue-400">📷 Click pin to view photos</span></>
                    )}
                </div>
                <span className="text-[9px] text-gray-500 font-mono">{Number(lat).toFixed(4)}°, {Number(lng).toFixed(4)}°</span>
            </div>
        </div>
    );

    // Map content
    const MapContent = () => (
        viewMode === '3d'
            ? <CesiumView lat={lat} lng={lng} sample={sample} onPinClick={handlePinClick} />
            : <LeafletView lat={lat} lng={lng} sample={sample} onPinClick={handlePinClick} />
    );

    return (
        <>
            {/* Inline map */}
            <div className={`relative rounded-xl overflow-hidden border border-sf-divider shadow-sm transition-all duration-500 ${expanded ? 'h-[600px]' : 'h-[350px]'}`}>
                <MapContent />
                <Controls isFullscreen={false} />
                <InfoBar isFullscreen={false} />
                {showPhotoPopup && (
                    <PhotoPopupPanel
                        sample={sample}
                        photos={photos}
                        onClose={() => setShowPhotoPopup(false)}
                        onPhotoClick={(idx) => setLightboxIndex(idx)}
                    />
                )}
            </div>

            {/* Fullscreen modal */}
            {fullscreen && (
                <div className="fixed inset-0 z-[9999] bg-black">
                    <div className="w-full h-full">
                        <MapContent />
                        <Controls isFullscreen={true} />
                        <InfoBar isFullscreen={true} />
                        {showPhotoPopup && (
                            <PhotoPopupPanel
                                sample={sample}
                                photos={photos}
                                onClose={() => setShowPhotoPopup(false)}
                                onPhotoClick={(idx) => setLightboxIndex(idx)}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Photo lightbox */}
            {lightboxIndex !== null && (
                <PhotoLightbox
                    photos={photos.all}
                    index={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    onNav={(dir) => setLightboxIndex((lightboxIndex + dir + photos.all.length) % photos.all.length)}
                />
            )}
        </>
    );
};

export default FieldMap;
