import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { Crosshair, MapPin, MousePointer, Type, ShieldCheck, ShieldAlert, ShieldQuestion, AlertTriangle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Country-based fallback centers for map
const COUNTRY_CENTERS = {
    GT: [15.78, -90.23],   // Guatemala
    RW: [-1.94, 29.87],    // Rwanda
    KE: [-1.29, 36.82],    // Kenya
    UG: [0.35, 32.58],     // Uganda
    TZ: [-6.37, 34.89],    // Tanzania
    ET: [9.15, 40.49],     // Ethiopia
    NG: [9.08, 7.49],      // Nigeria
    GH: [7.95, -1.02],     // Ghana
    ZA: [-30.56, 22.94],   // South Africa
    MW: [-13.25, 34.30],   // Malawi
    MZ: [-18.67, 35.53],   // Mozambique
    DEFAULT: [0, 25]       // Central Africa fallback
};

const CAPTURE_METHODS = [
    { id: 'MAP_PIN', label: 'Map Pin', icon: MousePointer, color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700', desc: 'Interactive Map' },
    { id: 'TEXT_ONLY', label: 'Manual Entry', icon: Type, color: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700', desc: 'No Coordinates' }
];

const CONFIDENCE_LEVELS = [
    { id: 'HIGH', label: 'High', icon: ShieldCheck, color: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700', desc: 'Verified Coordinates' },
    { id: 'MEDIUM', label: 'Medium', icon: ShieldAlert, color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700', desc: 'Map pin + confirmed' },
    { id: 'LOW', label: 'Low', icon: ShieldQuestion, color: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700', desc: 'Text/memory only' }
];

const getDefaultCenter = (countryCode) => {
    // 1. Try localStorage last intake position
    try {
        const saved = localStorage.getItem('lastIntakeLocation');
        if (saved) {
            const { lat, lng } = JSON.parse(saved);
            if (lat && lng) return [lat, lng];
        }
    } catch (e) { /* ignore */ }

    // 2. Country-based fallback
    if (countryCode && COUNTRY_CENTERS[countryCode.toUpperCase()]) {
        return COUNTRY_CENTERS[countryCode.toUpperCase()];
    }

    // 3. Default fallback
    return COUNTRY_CENTERS.DEFAULT;
};

const LocationPicker = ({
    value,
    onChange,
    captureMethod,
    onCaptureMethodChange,
    confidence,
    onConfidenceChange,
    countryCode,
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
    // value = { lat, lng, elevation, accuracy: 'EXACT'|'APPROX'|'UNKNOWN', description }
    const defaultCenter = useMemo(() => getDefaultCenter(countryCode), [countryCode]);
    const [position, setPosition] = useState(value?.lat && value?.lng ? [value.lat, value.lng] : defaultCenter);
    const [zoom, setZoom] = useState(value?.lat ? 13 : 7);

    const hasErr = (key) => errors.some(e => e.key === key);
    const errBorder = (key) => hasErr(key) ? 'border-red-400 ring-1 ring-red-200' : '';

    useEffect(() => {
        if (value?.lat && value?.lng) {
            setPosition([value.lat, value.lng]);
            setZoom(13);
        }
    }, [value?.lat, value?.lng]);

    // Save to localStorage on position change
    useEffect(() => {
        if (position && position[0] !== 0) {
            try {
                localStorage.setItem('lastIntakeLocation', JSON.stringify({ lat: position[0], lng: position[1] }));
            } catch (e) { /* ignore */ }
        }
    }, [position]);

    const LocationMarker = () => {
        const map = useMapEvents({
            click(e) {
                const { lat, lng } = e.latlng;
                setPosition([lat, lng]);
                onChange({ ...value, lat, lng, accuracy: value?.accuracy || 'EXACT' });
                // Auto-set confidence to MEDIUM on map click if not already HIGH
                if (!confidence || confidence === 'LOW') {
                    onConfidenceChange?.('MEDIUM');
                }
                map.flyTo(e.latlng, map.getZoom());
            },
        });

        return position === null ? null : (
            <Marker position={position} draggable={true} eventHandlers={{
                dragend: (e) => {
                    const marker = e.target;
                    const { lat, lng } = marker.getLatLng();
                    setPosition([lat, lng]);
                    onChange({ ...value, lat, lng, accuracy: value?.accuracy || 'EXACT' });
                    if (!confidence || confidence === 'LOW') {
                        onConfidenceChange?.('MEDIUM');
                    }
                }
            }}>
                <Popup>
                    <span>Sample Location</span>
                </Popup>
            </Marker>
        );
    };

    const showMap = captureMethod !== 'TEXT_ONLY';

    return (
        <div className="space-y-4 text-gray-800 dark:text-gray-200">
            {/* CAPTURE METHOD CHIPS */}
            <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    How was this location captured?
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
                                    // Auto-set confidence based on method
                                    if (method.id === 'MAP_PIN') onConfidenceChange?.('MEDIUM');
                                    else if (method.id === 'TEXT_ONLY') onConfidenceChange?.('LOW');
                                }}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border cursor-pointer ${isActive
                                    ? `${method.color} ring-2 ring-offset-1 shadow-md scale-[1.02]`
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-sm'
                                    }`}
                            >
                                <Icon size={16} />
                                {method.label}
                                <span className="text-[10px] font-normal opacity-70">{method.desc}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

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

            {/* MAP + COORDINATES (hidden for TEXT_ONLY) */}
            {showMap && (
                <>
                    <div className="flex justify-between items-end flex-wrap gap-2">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <MapPin size={16} /> Map Location
                        </label>
                        <div className="flex gap-2">
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
                                className="text-xs p-1 border rounded w-28 bg-white dark:bg-gray-800 dark:border-gray-700"
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
                                className="text-xs p-1 border rounded w-28 bg-white dark:bg-gray-800 dark:border-gray-700"
                            />
                            <div className="relative">
                                <input
                                    type="number"
                                    step="1"
                                    placeholder="Elev (m)"
                                    value={value?.elevation || ''}
                                    onChange={(e) => {
                                        const el = parseFloat(e.target.value);
                                        onChange({ ...value, elevation: isNaN(el) ? null : el });
                                    }}
                                    className="text-xs p-1 border rounded w-20 bg-white dark:bg-gray-800 dark:border-gray-700"
                                />
                                <span className="absolute right-2 top-1.5 text-[10px] text-gray-400">m</span>
                            </div>
                        </div>
                    </div>

                    <div className="h-64 w-full rounded-xl overflow-hidden border border-gray-300 dark:border-gray-700 relative z-0">
                        <MapContainer center={position} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            <LocationMarker />
                        </MapContainer>
                    </div>
                </>
            )}

            {/* CONFIDENCE CHIPS */}
            <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    Location Confidence
                </label>
                <div className="flex flex-wrap gap-2">
                    {CONFIDENCE_LEVELS.map(level => {
                        const Icon = level.icon;
                        const isActive = confidence === level.id;
                        return (
                            <button
                                key={level.id}
                                type="button"
                                onClick={() => onConfidenceChange?.(level.id)}
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

            {/* LOW CONFIDENCE REASON (conditional) */}
            {confidence === 'LOW' && (
                <div className={`p-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl border ${errBorder('uncertaintyReason') || 'border-amber-200 dark:border-amber-800/50'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} className="text-amber-600 dark:text-amber-500" />
                        <label className="text-xs font-bold text-amber-700 dark:text-amber-500 uppercase">Why is confidence low?</label>
                    </div>
                    <textarea
                        className="w-full p-2 border border-amber-200 dark:border-amber-700/50 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                        placeholder="e.g. Customer could not remember exact location, described general area only..."
                        rows={2}
                        value={uncertaintyReason || ''}
                        onChange={(e) => onUncertaintyReasonChange?.(e.target.value)}
                    />
                </div>
            )}

            {/* LOCATION DESCRIPTION (legacy, kept for fallback) */}
            <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Additional Location Notes</label>
                <input
                    className="w-full p-2 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-gray-200"
                    placeholder="e.g. Field near river, next to banana plantation"
                    value={value?.description || ''}
                    onChange={(e) => onChange({ ...value, description: e.target.value })}
                />
            </div>
        </div>
    );
};

export default LocationPicker;
