import React, { useState } from 'react';
import {
    MapPin,
    AlertTriangle,
    Calendar,
    User,
    Sprout,
    Layers,
    ChevronDown,
    ChevronUp,
    ShieldAlert,
    CheckCircle,
    Building2,
    Compass
} from 'lucide-react';

const FieldProvenanceCard = ({ sampleData, coordinates }) => {
    const [showFullRawMeta, setShowFullRawMeta] = useState(false);

    if (!sampleData) return null;

    const meta = sampleData.fieldMetadata || {};

    // Helper to safely extract field values that might be raw or { value: ... }
    const getVal = (key, fallback = null) => {
        const val = meta[key];
        if (val === undefined || val === null) return fallback;
        if (typeof val === 'object') return val.value ?? JSON.stringify(val);
        return String(val);
    };

    const collector = getVal('collector') || getVal('collectorName') || getVal('surveyor') || getVal('collectedBy') || getVal('enumerator') || 'Not recorded';
    const collectionDate = getVal('collectionDate') || getVal('date') || getVal('samplingDate') || 'Not recorded';
    const crop = getVal('crop') || getVal('currentCrop') || getVal('crops') || '—';
    const landUse = getVal('landUse') || getVal('landuse') || getVal('management') || '—';
    const depth = getVal('depth') || (meta.depthTop !== undefined && meta.depthBottom !== undefined ? `${meta.depthTop}–${meta.depthBottom} cm` : (sampleData.depthTopCm != null ? `${sampleData.depthTopCm}–${sampleData.depthBottomCm} cm` : 'Not recorded'));
    const organization = getVal('organization') || getVal('institution') || getVal('partner') || '—';

    // Spatial coordinates extraction (accept valid 0 coordinates)
    const hasCoordinates = Boolean(
        coordinates &&
        coordinates.lat !== null && coordinates.lat !== undefined &&
        coordinates.lng !== null && coordinates.lng !== undefined &&
        !isNaN(Number(coordinates.lat)) && !isNaN(Number(coordinates.lng))
    );
    const lat = hasCoordinates ? Number(coordinates.lat) : null;
    const lng = hasCoordinates ? Number(coordinates.lng) : null;
    const accuracy = coordinates?.accuracy || coordinates?.positionalUncertaintyM || meta.gpsAccuracy || meta.accuracy;
    const source = coordinates?.source || 'RECORDED';
    const isHighAccuracyFieldGps = (source === 'FIELD_GPS' || source === 'KOBO') && accuracy && accuracy <= 20;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            {/* CARD HEADER */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-750 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
                        <Layers size={18} />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                            Field Provenance &amp; Context (Archetype A)
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Project Campaign Record &middot; {sampleData.projectCode || sampleData.projectId || 'Unassigned Project'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 bg-white dark:bg-gray-750 border rounded-lg text-gray-700 dark:text-gray-300">
                        {sampleData.originalId}
                    </span>
                    <span className="text-xs px-2.5 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-semibold rounded-full">
                        {sampleData.status}
                    </span>
                </div>
            </div>

            <div className="p-5 space-y-4">
                {/* 1. COORDINATE STATUS BANNER (RC-09) */}
                {hasCoordinates ? (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                            <div>
                                <span className="font-bold">Field Coordinates Recorded:</span>{' '}
                                <span className="font-mono">{lat.toFixed(5)}&deg;, {lng.toFixed(5)}&deg;</span>
                                {accuracy && <span className="ml-1 text-emerald-700 dark:text-emerald-400">(&plusmn;{accuracy}m)</span>}
                            </div>
                        </div>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 rounded font-semibold text-[10px]">
                            {isHighAccuracyFieldGps ? 'FIELD-GRADE GPS' : (source || 'RECORDED')}
                        </span>
                    </div>
                ) : (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-300 dark:border-amber-800 flex items-start gap-2.5 text-xs">
                        <AlertTriangle size={18} className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold text-amber-900 dark:text-amber-300">
                                No Coordinates Recorded in the Field
                            </span>
                            <p className="text-amber-800 dark:text-amber-400 text-[11px] mt-0.5 leading-relaxed">
                                Field survey team did not submit GPS coordinates for this point. Verify the paper manifest or contact the field sampling team today before laboratory preparation begins.
                            </p>
                        </div>
                    </div>
                )}

                {/* 2. STRUCTURED AGRONOMIC & COLLECTION GRID */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-100 dark:border-gray-700">
                        <span className="text-gray-400 block flex items-center gap-1 mb-1">
                            <Calendar size={12} /> Collection Date
                        </span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{collectionDate}</span>
                    </div>

                    <div className="p-2.5 bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-100 dark:border-gray-700">
                        <span className="text-gray-400 block flex items-center gap-1 mb-1">
                            <User size={12} /> Collector / Officer
                        </span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block" title={collector}>
                            {collector}
                        </span>
                    </div>

                    <div className="p-2.5 bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-100 dark:border-gray-700">
                        <span className="text-gray-400 block flex items-center gap-1 mb-1">
                            <Sprout size={12} /> Crop &amp; Land Use
                        </span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block" title={`${crop} (${landUse})`}>
                            {crop} &middot; {landUse}
                        </span>
                    </div>

                    <div className="p-2.5 bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-100 dark:border-gray-700">
                        <span className="text-gray-400 block flex items-center gap-1 mb-1">
                            <Compass size={12} /> Depth Interval
                        </span>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{depth}</span>
                    </div>
                </div>

                {/* 3. OPTIONAL RAW METADATA ACCORDION */}
                {Object.keys(meta).length > 0 && (
                    <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
                        <button
                            type="button"
                            onClick={() => setShowFullRawMeta(!showFullRawMeta)}
                            className="flex items-center justify-between w-full text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 py-1"
                        >
                            <span>{showFullRawMeta ? 'Hide complete survey questionnaire' : `View all survey attributes (${Object.keys(meta).length} fields)`}</span>
                            {showFullRawMeta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {showFullRawMeta && (
                            <div className="mt-2 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border dark:border-gray-700 space-y-1.5 max-h-56 overflow-y-auto font-mono text-[11px]">
                                {Object.entries(meta).map(([k, v]) => {
                                    const display = typeof v === 'object' ? (v?.value ?? JSON.stringify(v)) : String(v);
                                    return (
                                        <div key={k} className="flex justify-between border-b border-gray-200 dark:border-gray-800 pb-1">
                                            <span className="text-gray-500">{k}:</span>
                                            <span className="text-gray-800 dark:text-gray-200 text-right truncate max-w-[65%]">{display}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FieldProvenanceCard;
