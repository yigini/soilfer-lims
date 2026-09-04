import React, { useState, useEffect, useMemo } from 'react';
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
    Loader2
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { parseCoordinates } from '../../utils/coordParser';

// Fix Leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Country fallback centers
const COUNTRY_CENTERS = {
    GT: [15.78, -90.23],   // Guatemala
    RW: [-1.94, 29.87],    // Rwanda
    KE: [-1.29, 36.82],    // Kenya
    UG: [0.35, 32.58],     // Uganda
    TZ: [-6.37, 34.89],    // Tanzania
    ET: [9.15, 40.49],     // Ethiopia
    ZM: [-15.41, 28.28],   // Zambia
    DEFAULT: [0, 25]       // Central Africa fallback
};

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
    try {
        const saved = localStorage.getItem('lastIntakeLocation');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.lat && parsed.lng) return [parsed.lat, parsed.lng];
        }
    } catch (e) { /* ignore */ }

    if (countryCode && COUNTRY_CENTERS[countryCode.toUpperCase()]) {
        return COUNTRY_CENTERS[countryCode.toUpperCase()];
    }
    return COUNTRY_CENTERS.DEFAULT;
};

// Component to programmatically re-center Leaflet
const RecenterMap = ({ center, zoom }) => {
    const map = useMap();
    useEffect(() => {
        if (center && center[0] && center[1]) {
            map.flyTo(center, zoom || map.getZoom());
        }
    }, [center, zoom, map]);
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
    const [position, setPosition] = useState(value?.lat && value?.lng ? [value.lat, value.lng] : defaultCenter);
    const [zoom, setZoom] = useState(value?.lat ? 13 : 7);

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

    const hasErr = (key) => errors.some(e => e.key === key);
    const errBorder = (key) => hasErr(key) ? 'border-red-400 ring-1 ring-red-200' : '';

    useEffect(() => {
        if (value?.lat && value?.lng) {
            setPosition([value.lat, value.lng]);
        }
    }, [value?.lat, value?.lng]);

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

    // Sync localStorage on position changes
    useEffect(() => {
        if (position && position[0] !== 0) {
            try {
                localStorage.setItem('lastIntakeLocation', JSON.stringify({
                    lat: position[0],
                    lng: position[1],
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
    }, [position, value?.elevation, positionalUncertaintyM, siteName, areaVillage, district, landmark, countryCode]);

    // Handle map click
    const LocationMarker = () => {
        const map = useMapEvents({
            click(e) {
                if (captureMethod === 'TEXT_ONLY') return;
                const { lat, lng } = e.latlng;
                setPosition([lat, lng]);

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

                onChange({ ...value, lat, lng, accuracy: 'EXACT' });
                map.flyTo(e.latlng, map.getZoom());
            },
        });

        return position === null ? null : (
            <>
                <Marker position={position} draggable={true} eventHandlers={{
                    dragend: (e) => {
                        const marker = e.target;
                        const { lat, lng } = marker.getLatLng();
                        setPosition([lat, lng]);
                        onLocationSourceChange?.('DESK_PIN');
                        onChange({ ...value, lat, lng, accuracy: 'EXACT' });
                    }
                }}>
                    <Popup>
                        <div className="text-xs font-mono">
                            <div><strong>Lat:</strong> {position[0].toFixed(6)}</div>
                            <div><strong>Lng:</strong> {position[1].toFixed(6)}</div>
                            {positionalUncertaintyM && <div><strong>Uncertainty:</strong> ±{positionalUncertaintyM}m</div>}
                        </div>
                    </Popup>
                </Marker>
                {positionalUncertaintyM && positionalUncertaintyM > 0 && (
                    <Circle
                        center={position}
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
            setPosition([parsed.lat, parsed.lng]);
            setZoom(14);
            onPositionalUncertaintyChange?.(parsed.uncertaintyM);
            onLocationSourceChange?.('DESK_PASTE');

            if (!isConfidenceOverridden) {
                const computed = deriveLocationConfidence('DESK_PASTE', parsed.uncertaintyM);
                onConfidenceChange?.(computed);
            }

            onChange({
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

                setPosition([latitude, longitude]);
                setZoom(15);
                onPositionalUncertaintyChange?.(roundedAcc);
                onLocationSourceChange?.('DEVICE_GPS');

                if (!isConfidenceOverridden) {
                    const computed = deriveLocationConfidence('DEVICE_GPS', roundedAcc);
                    onConfidenceChange?.(computed);
                }

                onChange({
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
            setPosition(dept.center);
            setZoom(11);
            onDistrictChange?.(dept.name);
            onPositionalUncertaintyChange?.(15000); // 15 km uncertainty for department
            onLocationSourceChange?.('ADMIN_UNIT');

            if (!isConfidenceOverridden) {
                onConfidenceChange?.('LOW');
            }

            onChange({
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
            setPosition(mun.center);
            setZoom(13);
            onAreaVillageChange?.(mun.name);
            onPositionalUncertaintyChange?.(5000); // 5 km uncertainty for municipality
            onLocationSourceChange?.('ADMIN_UNIT');

            if (!isConfidenceOverridden) {
                onConfidenceChange?.('LOW');
            }

            onChange({
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
                setPosition([data.lat, data.lng]);
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
        <div className="space-y-4 text-gray-800 dark:text-gray-200">
            {/* 6 CAPTURE METHOD CHIPS (RC-05) */}
            <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
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
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-sm'
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
                        className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800 text-sm font-mono dark:border-gray-700"
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
                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Department / Province</label>
                            <select
                                className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 text-xs"
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
                            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Municipality / District</label>
                            <select
                                className="w-full p-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 text-xs disabled:opacity-50"
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
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Site / Farm Name</label>
                    <input
                        className={`w-full p-2 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-700 ${errBorder('siteName')}`}
                        placeholder="e.g. Mutara Farm"
                        value={siteName || ''}
                        onChange={(e) => onSiteNameChange?.(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Area / Village *</label>
                    <input
                        className={`w-full p-2 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-700 ${errBorder('areaVillage')}`}
                        placeholder="e.g. Nyagatare"
                        value={areaVillage || ''}
                        onChange={(e) => onAreaVillageChange?.(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">District / County</label>
                    <input
                        className={`w-full p-2 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-700`}
                        placeholder="e.g. Eastern Province"
                        value={district || ''}
                        onChange={(e) => onDistrictChange?.(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Nearest Landmark *</label>
                    <input
                        className={`w-full p-2 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-700 ${errBorder('landmark')}`}
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
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <MapPin size={16} /> Map Coordinates &amp; Uncertainty (RC-06)
                        </label>
                        <div className="flex items-center gap-2 flex-wrap">
                            <input
                                type="number"
                                step="0.00001"
                                placeholder="Latitude"
                                value={position ? position[0] : ''}
                                onChange={(e) => {
                                    const lat = parseFloat(e.target.value);
                                    if (!isNaN(lat) && lat >= -90 && lat <= 90) {
                                        setPosition([lat, position[1]]);
                                        onChange({ ...value, lat, lng: position[1] });
                                    }
                                }}
                                className="text-xs p-1.5 border rounded w-28 bg-white dark:bg-gray-800 dark:border-gray-700 font-mono"
                            />
                            <input
                                type="number"
                                step="0.00001"
                                placeholder="Longitude"
                                value={position ? position[1] : ''}
                                onChange={(e) => {
                                    const lng = parseFloat(e.target.value);
                                    if (!isNaN(lng) && lng >= -180 && lng <= 180) {
                                        setPosition([position[0], lng]);
                                        onChange({ ...value, lat: position[0], lng });
                                    }
                                }}
                                className="text-xs p-1.5 border rounded w-28 bg-white dark:bg-gray-800 dark:border-gray-700 font-mono"
                            />
                            {/* RC-06: Positional Uncertainty in Metres */}
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="Uncertainty"
                                    value={positionalUncertaintyM || ''}
                                    onChange={(e) => {
                                        const u = parseFloat(e.target.value);
                                        const valUncert = isNaN(u) ? null : u;
                                        onPositionalUncertaintyChange?.(valUncert);
                                        if (!isConfidenceOverridden && locationSource) {
                                            onConfidenceChange?.(deriveLocationConfidence(locationSource, valUncert));
                                        }
                                    }}
                                    className="text-xs p-1.5 pr-7 border rounded w-28 bg-white dark:bg-gray-800 dark:border-gray-700 font-mono"
                                />
                                <span className="absolute right-2 top-1.5 text-[10px] text-gray-400 font-bold">&plusmn;m</span>
                            </div>

                            <div className="relative">
                                <input
                                    type="number"
                                    step="1"
                                    placeholder="Elev"
                                    value={value?.elevation || ''}
                                    onChange={(e) => {
                                        const el = parseFloat(e.target.value);
                                        onChange({ ...value, elevation: isNaN(el) ? null : el });
                                    }}
                                    className="text-xs p-1.5 pr-6 border rounded w-20 bg-white dark:bg-gray-800 dark:border-gray-700"
                                />
                                <span className="absolute right-2 top-1.5 text-[10px] text-gray-400">m</span>
                            </div>
                        </div>
                    </div>

                    {/* STATIC MAP CONTAINER - PREVENTS PAGE SHIFT */}
                    <div className="h-64 w-full rounded-xl overflow-hidden border border-gray-300 dark:border-gray-700 relative z-0 shadow-inner">
                        <MapContainer center={position} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <RecenterMap center={position} zoom={zoom} />
                            <LocationMarker />
                        </MapContainer>
                    </div>
                </>
            )}

            {/* CONFIDENCE CHIPS & OVERRIDE BADGE (RC-07) */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
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
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
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
                        className="w-full p-2 border border-amber-200 dark:border-amber-700/50 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
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
