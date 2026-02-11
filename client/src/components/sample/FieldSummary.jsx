
import React from 'react';
import { MapPin, Calendar, Globe, Building } from 'lucide-react';

const FieldSummary = ({ sample, onToggleMetadata, showMetadata }) => {
    // Helper to get value from fieldMetadata or fallback to top-level
    const getValue = (key, fallback) => {
        if (sample?.fieldMetadata?.[key]?.value) return sample.fieldMetadata[key].value;
        return fallback || 'Not recorded';
    };

    const project = sample.projectCode || getValue('projectCode', 'Unknown Project');
    const site = getValue('siteName') || getValue('locationDescription');
    const date = sample.collectionDate ? new Date(sample.collectionDate).toLocaleDateString() : getValue('collectionDate');
    const lat = sample.location?.lat || getValue('latitude');
    const lng = sample.location?.lng || getValue('longitude');

    // Format coords for display
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const coordsStr = (!isNaN(latNum) && !isNaN(lngNum) && lat !== 'Not recorded')
        ? `${latNum.toFixed(4)}, ${lngNum.toFixed(4)}`
        : 'No coordinates';

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm">

                {/* Project */}
                <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-secondary-500" />
                    <div>
                        <span className="block text-xs text-gray-400 uppercase tracking-wider">Project</span>
                        <span className="font-medium text-gray-900">{project}</span>
                    </div>
                </div>

                {/* Site */}
                <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-gray-400" />
                    <div>
                        <span className="block text-xs text-gray-400 uppercase tracking-wider">Site / Location</span>
                        <span className="font-medium text-gray-900 truncate max-w-[200px]">{site}</span>
                    </div>
                </div>

                {/* Date */}
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                        <span className="block text-xs text-gray-400 uppercase tracking-wider">Collection Date</span>
                        <span className="font-medium text-gray-900">{date}</span>
                    </div>
                </div>

                {/* Coords */}
                <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <div>
                        <span className="block text-xs text-gray-400 uppercase tracking-wider">Coordinates</span>
                        <span className={`font-mono ${!lat ? 'text-orange-500' : 'text-gray-700'}`}>
                            {coordsStr}
                        </span>
                    </div>
                </div>

            </div>

            {/* Toggle Action */}
            <button
                onClick={onToggleMetadata}
                className="text-primary-600 hover:text-primary-800 text-sm font-medium border border-primary-100 bg-primary-50 px-3 py-1.5 rounded-md transition-colors"
                id="view-all-metadata-btn"
            >
                {showMetadata ? 'Hide Field Data' : 'View Full Field Data'}
            </button>
        </div>
    );
};

export default FieldSummary;
