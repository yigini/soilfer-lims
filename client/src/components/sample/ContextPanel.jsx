import React from 'react';
import { MapPin, Calendar, User, Truck, ClipboardList } from 'lucide-react';

const ContextPanel = ({ sample, isActive, onToggleDrawer }) => {
    // Only render map if active or explicitly requested (perf)
    // For now simple render.

    return (
        <div className="space-y-6">
            {/* Origin & Ownership */}
            <div className="bg-sf-surface p-6 rounded-xl border border-sf-divider shadow-sm">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <User size={18} /> Origin & Ownership
                </h3>
                <div className="space-y-3 text-sm">
                    {sample.sampleType === 'WALKIN' ? (
                        <>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Submitter</span>
                                <span className="font-medium">{sample.submitter}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Contact</span>
                                <span className="font-medium">{sample.submitterContact || 'N/A'}</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Project</span>
                                <span className="font-medium">{sample.projectCode}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Collector</span>
                                <span className="font-medium">{sample.metadata?.collector || 'Unknown'}</span>
                            </div>
                        </>
                    )}
                    <div className="h-px bg-sf-raised my-2" />
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span className="block text-gray-500">Collection Date</span>
                            <span className="font-medium">{sample.collectionDate ? new Date(sample.collectionDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500">Reception Date</span>
                            <span className="font-medium">{sample.receptionDate ? new Date(sample.receptionDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Map - Stub for now, lazy load ideally */}
            <div className="bg-sf-surface p-6 rounded-xl border border-sf-divider shadow-sm">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <MapPin size={18} /> Location
                </h3>
                <div className="aspect-video bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                    {sample.location ? `Lat: ${sample.location.lat}, Lng: ${sample.location.lng}` : 'No Coordinates'}
                </div>
            </div>

            {/* Chain of Custody Summary */}
            <div className="bg-sf-surface p-6 rounded-xl border border-sf-divider shadow-sm">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <Truck size={18} /> Chain of Custody
                </h3>
                <div className="space-y-4 relative pl-4 border-l-2 border-sf-divider">
                    {/* Reverse order history or key events */}
                    <div className="relative">
                        <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white dark:ring-gray-800" />
                        <p className="text-sm font-bold text-sf-text">Current Location</p>
                        <p className="text-xs text-gray-500">Lab Storage - B2</p>
                    </div>
                </div>
                <button
                    onClick={onToggleDrawer}
                    className="w-full mt-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
                >
                    View Full History
                </button>
            </div>
        </div>
    );
};

export default ContextPanel;
