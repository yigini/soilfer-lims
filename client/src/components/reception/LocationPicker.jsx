import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import {
    Crosshair,
    MapPin,
    MousePointer,
    Type,
    ClipboardPaste,
    Navigation,
    Building2,
    RotateCcw,
    ShieldCheck,
    ShieldAlert,
    ShieldQuestion,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    Maximize2,
    Minimize2,
    Layers
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { parseCoordinates } from '../../utils/coordParser';
import { useLanguage } from '../../context/LanguageContext';
import { OSM_TILE_CONFIG, SATELLITE_TILE_CONFIG, COUNTRY_CENTERS, resolveMapCenter } from '../../utils/mapConfig';

// Fix Leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export const CAPTURE_METHODS = [
    { id: 'MAP_PIN', label: 'Map Pin', icon: MousePointer, color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700', desc: 'Click map' },
    { id: 'PASTE_COORDS', label: 'Paste Coords', icon: ClipboardPaste, color: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700', desc: 'DD / DMS / UTM' },
    { id: 'DEVICE_GPS', label: 'Device GPS', icon: Navigation, color: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700', desc: 'Current fix' },
    { id: 'ADMIN_UNIT', label: 'Admin Picker', icon: Building2, color: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700', desc: 'Municipality' },
    { id: 'PREVIOUS_SAMPLE', label: 'Same as Prev', icon: RotateCcw, color: 'bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700', desc: 'Reuse prior' },
    { id: 'TEXT_ONLY', label: 'Text Only', icon: Type, color: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700', desc: 'No coordinates' }
];

export const CONFIDENCE_LEVELS = [
    { id: 'HIGH', label: 'High', icon: ShieldCheck, color: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700', desc: 'Field GPS (≤20m)' },
    { id: 'MEDIUM', label: 'Medium', icon: ShieldAlert, color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700', desc: 'Map pin / Paste (≤100m)' },
    { id: 'LOW', label: 'Low', icon: ShieldQuestion, color: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700', desc: 'Admin centroid / Text' }
];

export function deriveLocationConfidence(source, uncertaintyM) {
    if (!source || source === 'TEXT_ONLY') return 'LOW';
    if (source === 'FIELD_GPS' || source === 'DEVICE_GPS') {
        return (uncertaintyM && uncertaintyM <= 20) ? 'HIGH' : 'MEDIUM';
    }
    if (source === 'DESK_PASTE' || source === 'MAP_PIN') {
        if (uncertaintyM && uncertaintyM <= 50) return 'MEDIUM';
        return 'LOW';
    }
    if (source === 'ADMIN_UNIT') return 'LOW';
    return 'MEDIUM';
}

const getDefaultCenter = (countryCode) => {
    if (countryCode && COUNTRY_CENTERS[countryCode.toUpperCase()]) {
        return COUNTRY_CENTERS[countryCode.toUpperCase()];
    }
    return COUNTRY_CENTERS.DEFAULT;
};

const isFiniteCoord = (val) => val !== null && val !== undefined && val !== '' && !isNaN(Number(val)) && Number.isFinite(Number(val));

// Component to programmatically re-center Leaflet
const RecenterMap = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        if (center && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
            map.flyTo(center, zoom || map.getZoom());
        }
    }, [center, zoom, map]);
    return null;
};

// Component to invalidate Leaflet size on container resize or fullscreen toggle (#114)
const InvalidateMapSize = ({ isFullscreen }) => {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 150);
        return () => clearTimeout(timer);
    }, [isFullscreen, map]);
    return null;
};

const LocationPicker = ({
    value,
    onChange,
    captureMethod = 'MAP_PIN',
    onCaptureMethodChange,
    confidence,
    onConfidenceChange,
    positionalUncertaintyM,
    onPositionalUncertaintyChange,
    locationSource,
    onLocationSourceChange,
    countryCode = 'GT',
    labCoordinates = null,
    siteName,
    onSiteNameChange,
    areaVillage,
    onAreaVillageChange,
    district,
    onDistrictChange,
    landmark,
    onLandmarkChange,
    uncertaintyReason,
    onUncertaintyReasonChange,
    errors = []
}) => {
    const defaultCenter = useMemo(() => getDefaultCenter(countryCode), [countryCode]);

    // Controlled coordinate input state allowing empty, partial, and negative strings
    const [latInput, setLatInput] = useState(() => isFiniteCoord(value?.lat) ? String(value.lat) : '');
    const [lngInput, setLngInput] = useState(() => isFiniteCoord(value?.lng) ? String(value.lng) : '');

    // Synchronize inputs when value props change externally (e.g. paste, map pin click, GPS fix, form reset)
    useEffect(() => {
        if (isFiniteCoord(value?.lat)) {
            if (parseFloat(latInput) !== Number(value.lat)) {
                setLatInput(String(value.lat));
            }
        } else if (value?.lat === null || value?.lat === undefined || value?.lat === '') {
            if (latInput !== '') {
                setLatInput('');
            }
        }
    }, [value?.lat]);

    useEffect(() => {
        if (isFiniteCoord(value?.lng)) {
            if (parseFloat(lngInput) !== Number(value.lng)) {
                setLngInput(String(value.lng));
            }
        } else if (value?.lng === null || value?.lng === undefined || value?.lng === '') {
            if (lngInput !== '') {
                setLngInput('');
            }
        }
    }, [value?.lng]);

    // Complete finite pair strictly requires BOTH latitude and longitude to be finite numbers within valid ranges
    const completeCoords = useMemo(() => {
        if (isFiniteCoord(value?.lat) && isFiniteCoord(value?.lng)) {
            const lat = Number(value.lat);
            const lng = Number(value.lng);
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                return [lat, lng];
            }
        }
        return null;
    }, [value?.lat, value?.lng]);

    // Viewport map center resolves via canonical precedence (#114):
    // 1. Valid sample coordinates
    // 2. Authenticated lab coordinates (e.g. Harare)
    // 3. Country / regional fallback center
    const mapCenter = useMemo(() => {
        return resolveMapCenter(completeCoords, labCoordinates, defaultCenter);
    }, [completeCoords, labCoordinates, defaultCenter]);

    const [zoom, setZoom] = useState(completeCoords ? 13 : 7);

    // Paste mode state
    const [pasteText, setPasteText] = useState('');
    const [pasteParseResult, setPasteParseResult] = useState(null);

    // GPS Acquisition state
    const [acquiringGps, setAcquiringGps] = useState(false);
    const [gpsError, setGpsError] = useState(null);

    // Admin units state
    const [adminData, setAdminData] = useState(null);
    const [selectedDept, setSelectedDept] = useState('');
    const [selectedMun, setSelectedMun] = useState('');

    // Confidence override tracking
    const [isConfidenceOverridden, setIsConfidenceOverridden] = useState(false);

    // Map availability and bounded retry tracking (Refs #110, #114)
    const { t } = useLanguage?.() || { t: (k, d) => d };
    const [mapUnavailable, setMapUnavailable] = useState(false);
    const [layer, setLayer] = useState('osm'); // 'osm' | 'satellite'
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [tileRetryKey, setTileRetryKey] = useState(0);
    const mapContainerRef = useRef(null);
    const tileErrorCountRef = useRef(0);

    const handleTileError = () => {
        tileErrorCountRef.current += 1;
        if (layer === 'satellite') {
            console.warn('Satellite tiles unavailable, falling back to standard map');
            setLayer('osm');
            tileErrorCountRef.current = 0;
            return;
        }
        if (tileErrorCountRef.current >= 2) {
            setMapUnavailable(true);
        }
    };

    const handleTileLoad = () => {
        // Reset error counter on successful tile recovery
        tileErrorCountRef.current = 0;
    };

    const handleRetryMap = () => {
        tileErrorCountRef.current = 0;
        setMapUnavailable(false);
        setTileRetryKey(prev => prev + 1);
    };

    const toggleFullscreen = () => {
        if (!mapContainerRef.current) return;
        if (!document.fullscreenEnabled) {
            console.warn('Fullscreen is not supported or not enabled in this environment');
            return;
        }
        if (!document.fullscreenElement) {
            mapContainerRef.current.requestFullscreen?.().then(() => {
                setIsFullscreen(true);
            }).catch(err => {
                console.warn('Fullscreen request failed or was denied', err);
            });
        } else {
            document.exitFullscreen?.().then(() => {
                setIsFullscreen(false);
            }).catch(err => console.warn(err));
        }
    };

    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }, []);

    const hasErr = (key) => errors.some(e => e.key === key);
    const errBorder = (key) => hasErr(key) ? 'border-red-400 ring-1 ring-red-200' : '';

    // Fetch offline admin units for dropdown picker
    useEffect(() => {
        const fetchAdminUnits = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/reception/admin-units?country=${countryCode || 'GT'}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                if (res.ok) {
                    const data = await res.json();
                    setAdminData(data);
                }
            } catch (e) {
                console.warn("Could not load admin units:", e);
            }
        };
        fetchAdminUnits();
    }, [countryCode]);

    // Sync localStorage on explicit coordinate values only (do not copy viewport/default center)
    useEffect(() => {
        if (value?.lat != null && value?.lng != null && !isNaN(Number(value.lat)) && !isNaN(Number(value.lng))) {
            try {
                localStorage.setItem('lastIntakeLocation', JSON.stringify({
                    lat: Number(value.lat),
                    lng: Number(value.lng),
                    elevation: value?.elevation,
                    positionalUncertaintyM,
                    siteName,
                    areaVillage,
                    district,
                    landmark,
                    countryCode
                }));
            } catch (e) { /* ignore */ }
        }
    }, [value?.lat, value?.lng, value?.elevation, positionalUncertaintyM, siteName, areaVillage, district, landmark, countryCode]);

    // Handle map click
    const LocationMarker = () => {
        const map = useMapEvents({
            click(e) {
                if (captureMethod === 'TEXT_ONLY') return;
                const { lat, lng } = e.latlng;

                // Map pin uncertainty heuristic based on zoom
                const currentZoom = map.getZoom();
                let defaultUncertainty = 500;
                if (currentZoom >= 16) defaultUncertainty = 25;
                else if (currentZoom >= 14) defaultUncertainty = 100;
                else if (currentZoom >= 12) defaultUncertainty = 500;
                else defaultUncertainty = 2000;

                const newUncertainty = positionalUncertaintyM || defaultUncertainty;
                onPositionalUncertaintyChange?.(newUncertainty);
                onLocationSourceChange?.('DESK_PIN');

                if (!isConfidenceOverridden) {
                    const computedConf = deriveLocationConfidence('DESK_PIN', newUncertainty);
                    onConfidenceChange?.(computedConf);
                }

                onChange?.({
                    ...value,
                    lat: parseFloat(lat.toFixed(6)),
                    lng: parseFloat(lng.toFixed(6)),
                    accuracy: 'EXACT'
                });
                map.flyTo(e.latlng, map.getZoom());
            },
        });

        if (!completeCoords) return null;

        return (
            <>
                <Marker position={completeCoords} draggable={true} eventHandlers={{
                    dragend: (e) => {
                        const marker = e.target;
                        const { lat, lng } = marker.getLatLng();
                        onLocationSourceChange?.('DESK_PIN');
                        onChange?.({
                            ...value,
                            lat: parseFloat(lat.toFixed(6)),
                            lng: parseFloat(lng.toFixed(6)),
                            accuracy: 'EXACT'
                        });
                    }
                }}>
                    <Popup>
                        <div className="text-xs font-mono">
                            <div><strong>Lat:</strong> {completeCoords[0].toFixed(6)}</div>
                            <div><strong>Lng:</strong> {completeCoords[1].toFixed(6)}</div>
                            {positionalUncertaintyM && <div><strong>Uncertainty:</strong> ±{positionalUncertaintyM}m</div>}
                        </div>
                    </Popup>
                </Marker>
                {positionalUncertaintyM && positionalUncertaintyM > 0 && (
                    <Circle
                        center={completeCoords}
                        radius={positionalUncertaintyM}
                        pathOptions={{
                            color: '#2563eb',
                            fillColor: '#3b82f6',
                            fillOpacity: 0.15,
                            weight: 1.5
                        }}
                    />
                )}
            </>
        );
    };

    // Handle coordinate paste input
    const handlePasteChange = (text) => {
        setPasteText(text);
        if (!text.trim()) {
            setPasteParseResult(null);
            return;
        }

        const parsed = parseCoordinates(text);
        if (parsed) {
            setPasteParseResult(parsed);
            setZoom(14);
            onPositionalUncertaintyChange?.(parsed.uncertaintyM);
            onLocationSourceChange?.('DESK_PASTE');

            if (!isConfidenceOverridden) {
                const computed = deriveLocationConfidence('DESK_PASTE', parsed.uncertaintyM);
                onConfidenceChange?.(computed);
            }

            onChange?.({
                ...value,
                lat: parsed.lat,
                lng: parsed.lng,
                accuracy: 'EXACT'
            });
        } else {
            setPasteParseResult({ error: 'Unrecognized format. Try DD (-1.29, 36.82), DMS (14°48\'12"N), or UTM (15N 752300 1625400)' });
        }
    };

    // Handle one-tap Device Geolocation (RC-05)
    const handleAcquireDeviceGps = () => {
        if (!navigator.geolocation) {
            setGpsError('Geolocation is not supported by your browser.');
            return;
        }

        setAcquiringGps(true);
        setGpsError(null);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setAcquiringGps(false);
                const { latitude, longitude, altitude, accuracy } = pos.coords;
                const roundedAcc = Math.round(accuracy) || 10;

                setZoom(15);
                onPositionalUncertaintyChange?.(roundedAcc);
                onLocationSourceChange?.('DEVICE_GPS');

                if (!isConfidenceOverridden) {
                    const computed = deriveLocationConfidence('DEVICE_GPS', roundedAcc);
                    onConfidenceChange?.(computed);
                }

                onChange?.({
                    ...value,
                    lat: parseFloat(latitude.toFixed(6)),
                    lng: parseFloat(longitude.toFixed(6)),
                    elevation: altitude ? Math.round(altitude) : value?.elevation,
                    accuracy: 'EXACT'
                });
            },
            (err) => {
                setAcquiringGps(false);
                setGpsError(`GPS fix error: ${err.message}`);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    // Handle Admin Unit Selection (RC-05)
    const handleDepartmentSelect = (deptName) => {
        setSelectedDept(deptName);
        setSelectedMun('');
        const dept = adminData?.departments?.find(d => d.name === deptName);
        if (dept && dept.center) {
            setZoom(11);
            onDistrictChange?.(dept.name);
            onPositionalUncertaintyChange?.(15000); // 15 km uncertainty for department
            onLocationSourceChange?.('ADMIN_UNIT');

            if (!isConfidenceOverridden) {
                onConfidenceChange?.('LOW');
            }

            onChange?.({
                ...value,
                lat: dept.center[0],
                lng: dept.center[1],
                accuracy: 'APPROX'
            });
        }
    };

    const handleMunicipalitySelect = (munName) => {
        setSelectedMun(munName);
        const dept = adminData?.departments?.find(d => d.name === selectedDept);
        const mun = dept?.municipalities?.find(m => m.name === munName);
        if (mun && mun.center) {
            setZoom(13);
            onAreaVillageChange?.(mun.name);
            onPositionalUncertaintyChange?.(5000); // 5 km uncertainty for municipality
            onLocationSourceChange?.('ADMIN_UNIT');

            if (!isConfidenceOverridden) {
                onConfidenceChange?.('LOW');
            }

            onChange?.({
                ...value,
                lat: mun.center[0],
                lng: mun.center[1],
                accuracy: 'APPROX'
            });
        }
    };

    // Handle Same as Previous Sample (RC-05)
    const handleReusePreviousSample = () => {
        try {
            const saved = localStorage.getItem('lastIntakeLocation');
            if (!saved) {
                alert('No previous sample intake found in this browser session.');
                return;
            }
            const data = JSON.parse(saved);
            if (data.lat && data.lng) {
                setZoom(14);
                if (data.siteName) onSiteNameChange?.(data.siteName);
                if (data.areaVillage) onAreaVillageChange?.(data.areaVillage);
                if (data.district) onDistrictChange?.(data.district);
                if (data.landmark) onLandmarkChange?.(data.landmark);
                if (data.positionalUncertaintyM) onPositionalUncertaintyChange?.(data.positionalUncertaintyM);

                onLocationSourceChange?.('PREVIOUS_SAMPLE');
                if (!isConfidenceOverridden) {
                    onConfidenceChange?.(deriveLocationConfidence('DESK_PIN', data.positionalUncertaintyM || 50));
                }

                onChange({
                    ...value,
                    lat: data.lat,
                    lng: data.lng,
                    elevation: data.elevation || value?.elevation,
                    accuracy: 'EXACT'
                });
            }
        } catch (e) {
            console.error('Failed to reuse previous sample location', e);
        }
    };

    const showMap = captureMethod !== 'TEXT_ONLY';

    return (
        <div className="space-y-4 text-sf-text">
            {/* 6 CAPTURE METHOD CHIPS (RC-05) */}
            <div>
                <label className="block text-xs font-bold text-sf-muted uppercase tracking-wide mb-2">
                    How was this location captured? (RC-05)
                </label>
                <div className="flex flex-wrap gap-2">
                    {CAPTURE_METHODS.map(method => {
                        const Icon = method.icon;
                        const isActive = captureMethod === method.id;
                        return (
                            <button
                                key={method.id}
                                type="button"
                                onClick={() => {
                                    onCaptureMethodChange?.(method.id);
                                    if (method.id === 'PREVIOUS_SAMPLE') {
                                        handleReusePreviousSample();
                                    } else if (method.id === 'DEVICE_GPS') {
                                        handleAcquireDeviceGps();
                                    } else if (method.id === 'TEXT_ONLY') {
                                        onLocationSourceChange?.('TEXT_ONLY');
                                        if (!isConfidenceOverridden) onConfidenceChange?.('LOW');
                                    } else if (method.id === 'MAP_PIN') {
                                        onLocationSourceChange?.('DESK_PIN');
                                        if (!isConfidenceOverridden) onConfidenceChange?.('MEDIUM');
                                    }
                                }}
                                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${isActive
                                    ? `${method.color} ring-2 ring-offset-1 shadow-md scale-[1.02]`
                                    : 'bg-sf-surface text-sf-muted border-sf-divider hover:border-sf-divider hover:bg-sf-canvas hover:text-sf-text hover:shadow-sm'
                                    }`}
                            >
                                <Icon size={15} />
                                {method.label}
                                <span className="text-[10px] font-normal opacity-70 hidden sm:inline">{method.desc}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* CONDITIONAL SUB-PANEL PER CAPTURE METHOD */}
            {/* 1. PASTE COORD PANEL */}
            {captureMethod === 'PASTE_COORDS' && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                            <ClipboardPaste size={14} /> Type or Paste Coordinates
                        </label>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400">Accepts DD, DMS, or UTM Zone</span>
                    </div>
                    <input
                        className="w-full p-2 border rounded-lg bg-sf-surface text-sm font-mono border-sf-divider text-sf-text"
                        placeholder="e.g. 15N 752300 1625400  OR  14°48'12&quot;N, 90°13'48&quot;W  OR  -1.2921, 36.8219"
                        value={pasteText}
                        onChange={(e) => handlePasteChange(e.target.value)}
                    />
                    {pasteParseResult && (
                        <div className={`p-2 rounded flex items-center gap-2 text-xs ${pasteParseResult.error
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            }`}>
                            {pasteParseResult.error ? (
                                <>
                                    <AlertTriangle size={14} className="shrink-0" />
                                    <span>{pasteParseResult.error}</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={14} className="shrink-0" />
                                    <span>
                                        <strong>Format:</strong> {pasteParseResult.format} ({pasteParseResult.sourceDescription}) &rarr; Lat: <strong>{pasteParseResult.lat}</strong>, Lng: <strong>{pasteParseResult.lng}</strong> (Uncertainty &plusmn;{pasteParseResult.uncertaintyM}m)
                                    </span>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* 2. DEVICE GPS PANEL */}
            {captureMethod === 'DEVICE_GPS' && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between">
                    <div>
                        <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                            <Navigation size={14} /> One-Tap Geolocation
                        </span>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                            Acquires current GPS fix directly from phone/tablet browser with reported hardware accuracy.
                        </p>
                        {gpsError && <p className="text-red-600 dark:text-red-400 font-semibold mt-1">{gpsError}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={handleAcquireDeviceGps}
                        disabled={acquiringGps}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-2 text-xs shadow cursor-pointer disabled:opacity-50"
                    >
                        {acquiringGps ? <Loader2 size={14} className="animate-spin" /> : <Crosshair size={14} />}
                        {acquiringGps ? 'Fixing...' : 'Re-acquire Fix'}
                    </button>
                </div>
            )}

            {/* 3. ADMIN UNIT PANEL */}
            {captureMethod === 'ADMIN_UNIT' && (
                <div className="p-3 bg-violet-50 dark:bg-violet-950/30 rounded-xl border border-violet-200 dark:border-violet-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-violet-900 dark:text-violet-300 flex items-center gap-1.5">
                            <Building2 size={14} /> Administrative Boundary Picker
                        </span>
                        <span className="text-[10px] text-violet-600 dark:text-violet-400">Offline Centroid Lookup</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[11px] font-semibold text-sf-muted mb-1">Department / Province</label>
                            <select
                                className="w-full p-2 border rounded-lg bg-sf-surface border-sf-divider text-sf-text text-xs"
                                value={selectedDept}
                                onChange={(e) => handleDepartmentSelect(e.target.value)}
                            >
                                <option value="">-- Select Department --</option>
                                {adminData?.departments?.map(d => (
                                    <option key={d.name} value={d.name}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-sf-muted mb-1">Municipality / District</label>
                            <select
                                className="w-full p-2 border rounded-lg bg-sf-surface border-sf-divider text-sf-text text-xs disabled:opacity-50"
                                value={selectedMun}
                                disabled={!selectedDept}
                                onChange={(e) => handleMunicipalitySelect(e.target.value)}
                            >
                                <option value="">-- Select Municipality --</option>
                                {adminData?.departments?.find(d => d.name === selectedDept)?.municipalities?.map(m => (
                                    <option key={m.name} value={m.name}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* STRUCTURED TEXT FIELDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                    <label className="block text-xs font-semibold text-sf-muted mb-1">Site / Farm Name</label>
                    <input
                        className={`w-full p-2 border rounded-lg text-sm bg-sf-surface border-sf-divider text-sf-text ${errBorder('siteName')}`}
                        placeholder="e.g. Mutara Farm"
                        value={siteName || ''}
                        onChange={(e) => onSiteNameChange?.(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-sf-muted mb-1">Area / Village *</label>
                    <input
                        className={`w-full p-2 border rounded-lg text-sm bg-sf-surface border-sf-divider text-sf-text ${errBorder('areaVillage')}`}
                        placeholder="e.g. Nyagatare"
                        value={areaVillage || ''}
                        onChange={(e) => onAreaVillageChange?.(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-sf-muted mb-1">District / County</label>
                    <input
                        className={`w-full p-2 border rounded-lg text-sm bg-sf-surface border-sf-divider text-sf-text`}
                        placeholder="e.g. Eastern Province"
                        value={district || ''}
                        onChange={(e) => onDistrictChange?.(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-sf-muted mb-1">Nearest Landmark *</label>
                    <input
                        className={`w-full p-2 border rounded-lg text-sm bg-sf-surface border-sf-divider text-sf-text ${errBorder('landmark')}`}
                        placeholder="e.g. 500m south of church"
                        value={landmark || ''}
                        onChange={(e) => onLandmarkChange?.(e.target.value)}
                    />
                </div>
            </div>

            {/* MAP + COORDINATES & UNCERTAINTY (hidden for TEXT_ONLY) */}
            {showMap && (
                <>
                    <div className="flex justify-between items-end flex-wrap gap-2 pt-1">
                        <label className="block text-sm font-semibold text-sf-text flex items-center gap-2">
                            <MapPin size={16} /> Map Coordinates &amp; Uncertainty (RC-06)
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                            <input
                                type="number"
                                step="0.00001"
                                placeholder="Latitude"
                                value={latInput}
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    setLatInput(raw);
                                    const currentLng = isFiniteCoord(value?.lng) ? Number(value.lng) : null;
                                    if (raw === '') {
                                        onChange?.({ ...value, lat: null, lng: currentLng });
                                    } else {
                                        const lat = parseFloat(raw);
                                        if (Number.isFinite(lat) && lat >= -90 && lat <= 90) {
                                            onChange?.({ ...value, lat, lng: currentLng });
                                        }
                                    }
                                }}
                                className="text-xs p-1.5 border rounded-lg w-28 bg-sf-surface border-sf-divider text-sf-text font-mono"
                            />
                            <input
                                type="number"
                                step="0.00001"
                                placeholder="Longitude"
                                value={lngInput}
                                onChange={(e) => {
                                    const raw = e.target.value;
                                    setLngInput(raw);
                                    const currentLat = isFiniteCoord(value?.lat) ? Number(value.lat) : null;
                                    if (raw === '') {
                                        onChange?.({ ...value, lat: currentLat, lng: null });
                                    } else {
                                        const lng = parseFloat(raw);
                                        if (Number.isFinite(lng) && lng >= -180 && lng <= 180) {
                                            onChange?.({ ...value, lat: currentLat, lng });
                                        }
                                    }
                                }}
                                className="text-xs p-1.5 border rounded-lg w-28 bg-sf-surface border-sf-divider text-sf-text font-mono"
                            />
                            {/* RC-06: Positional Uncertainty in Metres */}
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="Uncertainty"
                                    value={isFiniteCoord(positionalUncertaintyM) ? positionalUncertaintyM : ''}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        if (raw === '') {
                                            onPositionalUncertaintyChange?.(null);
                                        } else {
                                            const u = parseFloat(raw);
                                            const valUncert = Number.isFinite(u) ? u : null;
                                            onPositionalUncertaintyChange?.(valUncert);
                                            if (!isConfidenceOverridden && locationSource) {
                                                onConfidenceChange?.(deriveLocationConfidence(locationSource, valUncert));
                                            }
                                        }
                                    }}
                                    className="text-xs p-1.5 pr-7 border rounded-lg w-28 bg-sf-surface border-sf-divider text-sf-text font-mono"
                                />
                                <span className="absolute right-2 top-1.5 text-[10px] text-sf-muted font-bold">&plusmn;m</span>
                            </div>

                            <div className="relative">
                                <input
                                    type="number"
                                    step="1"
                                    placeholder="Elev"
                                    value={isFiniteCoord(value?.elevation) ? value.elevation : ''}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        if (raw === '') {
                                            onChange?.({ ...value, elevation: null });
                                        } else {
                                            const el = parseFloat(raw);
                                            onChange?.({ ...value, elevation: Number.isFinite(el) ? Math.round(el) : null });
                                        }
                                    }}
                                    className="text-xs p-1.5 pr-6 border rounded-lg w-20 bg-sf-surface border-sf-divider text-sf-text"
                                />
                                <span className="absolute right-2 top-1.5 text-[10px] text-sf-muted">m</span>
                            </div>
                        </div>
                    </div>

                    {/* STATIC MAP CONTAINER - PREVENTS PAGE SHIFT */}
                    <div
                        ref={mapContainerRef}
                        className={`w-full rounded-xl overflow-hidden border border-sf-divider relative z-0 shadow-inner bg-sf-surface ${
                            isFullscreen ? 'fixed inset-0 z-[9999] h-screen w-screen rounded-none' : 'h-64'
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
                        <MapContainer center={mapCenter} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                            {!mapUnavailable && (
                                <TileLayer
                                    key={`${layer}-${tileRetryKey}`}
                                    attribution={(layer === 'satellite' ? SATELLITE_TILE_CONFIG : OSM_TILE_CONFIG).attribution}
                                    url={(layer === 'satellite' ? SATELLITE_TILE_CONFIG : OSM_TILE_CONFIG).url}
                                    referrerPolicy={(layer === 'satellite' ? SATELLITE_TILE_CONFIG : OSM_TILE_CONFIG).referrerPolicy}
                                    maxNativeZoom={(layer === 'satellite' ? SATELLITE_TILE_CONFIG : OSM_TILE_CONFIG).maxNativeZoom}
                                    maxZoom={(layer === 'satellite' ? SATELLITE_TILE_CONFIG : OSM_TILE_CONFIG).maxZoom}
                                    eventHandlers={{
                                        tileerror: handleTileError,
                                        tileload: handleTileLoad
                                    }}
                                />
                            )}
                            <RecenterMap center={completeCoords} zoom={zoom} />
                            <InvalidateMapSize isFullscreen={isFullscreen} />
                            <LocationMarker />
                        </MapContainer>
                    </div>
                </>
            )}

            {/* CONFIDENCE CHIPS & OVERRIDE BADGE (RC-07) */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-sf-muted uppercase tracking-wide">
                        Location Confidence (Derived from Evidence)
                    </label>
                    {isConfidenceOverridden && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold">
                            Manual Override
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {CONFIDENCE_LEVELS.map(level => {
                        const Icon = level.icon;
                        const isActive = confidence === level.id;
                        return (
                            <button
                                key={level.id}
                                type="button"
                                onClick={() => {
                                    setIsConfidenceOverridden(true);
                                    onConfidenceChange?.(level.id);
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border cursor-pointer ${isActive
                                    ? `${level.color} ring-2 ring-offset-1 shadow-md scale-[1.02]`
                                    : 'bg-sf-surface text-sf-muted border-sf-divider hover:border-sf-divider hover:bg-sf-canvas hover:text-sf-text'
                                    }`}
                            >
                                <Icon size={14} />
                                {level.label}
                                <span className="text-[10px] font-normal opacity-70">{level.desc}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* LOW CONFIDENCE REASON */}
            {confidence === 'LOW' && (
                <div className={`p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl border ${errBorder('uncertaintyReason') || 'border-amber-200 dark:border-amber-800/50'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} className="text-amber-600 dark:text-amber-500" />
                        <label className="text-xs font-bold text-amber-700 dark:text-amber-500 uppercase">Why is confidence low?</label>
                    </div>
                    <textarea
                        className="w-full p-2 border border-amber-200 dark:border-amber-700/50 rounded-lg text-sm bg-sf-surface text-sf-text"
                        placeholder="e.g. Customer could not remember exact coordinates, mapped by general municipality description..."
                        rows={2}
                        value={uncertaintyReason || ''}
                        onChange={(e) => onUncertaintyReasonChange?.(e.target.value)}
                    />
                </div>
            )}
        </div>
    );
};

export default LocationPicker;
