
import React from 'react';
import { CheckCircle, Circle, Clock, User, FileText } from 'lucide-react';

const STEPS = [
    { id: 'RECEIVED', label: 'Received', group: 'Reception' },
    { id: 'LAB_ID_ASSIGNED', label: 'Lab ID', group: 'Reception' },
    { id: 'DRYING', label: 'Drying', group: 'Prep' },
    { id: 'PREPARED', label: 'Prepared', group: 'Prep' },
    { id: 'WET_CHEM_IN_PROGRESS', label: 'Wet Chem', group: 'Analysis' },
    { id: 'WET_CHEM_COMPLETED', label: 'WC Done', group: 'Analysis' },
    { id: 'SPECTRAL_IN_PROGRESS', label: 'Spectral', group: 'Analysis' },
    { id: 'SPECTRAL_COMPLETED', label: 'Spec Done', group: 'Analysis' },
    { id: 'QA_QC_IN_PROGRESS', label: 'QA/QC', group: 'Review' },
    { id: 'ANALYSIS_COMPLETED', label: 'Pending', group: 'Review' },
    { id: 'ACCEPTED', label: 'Accepted', group: 'Final' },
    { id: 'TERMINAL', label: 'Archived/Disposed', group: 'Final' }
];

const SampleProgressBar = ({ currentStatus, history = [] }) => {

    // Find index of current status
    // Handle Terminal special case
    const isTerminal = ['ARCHIVED', 'DISPOSED'].includes(currentStatus);
    const effectiveStatus = isTerminal ? 'TERMINAL' : currentStatus;

    let currentIndex = STEPS.findIndex(s => s.id === effectiveStatus);

    // Fallback if status not in list (e.g. COLLECTED not shown or custom)
    if (currentIndex === -1) {
        if (currentStatus === 'COLLECTED') currentIndex = -1; // Before start
        else currentIndex = 0; // Default
    }

    // Helper to find history entry for a step
    const getHistoryEntry = (stepId) => {
        if (stepId === 'TERMINAL') {
            return history.find(h => ['ARCHIVED', 'DISPOSED'].includes(h.status));
        }
        // Find most recent entry for this status
        // History is usually chronological desc or asc? Assuming we search all.
        return history.find(h => h.status === stepId);
    };

    return (
        <div className="w-full overflow-x-auto pb-4">
            {/* Legend / Group Headers? Optional, keeping simple for now */}

            <div className="flex items-center justify-between min-w-[800px] relative mt-4 px-4">
                {/* Connecting Line */}
                <div className="absolute top-4 left-4 right-4 h-1 bg-gray-100 -z-10" />
                <div
                    className="absolute top-4 left-4 h-1 bg-green-500 -z-10 transition-all duration-500"
                    style={{ width: `${Math.max(0, (currentIndex / (STEPS.length - 1)) * 100)}%` }}
                />

                {STEPS.map((step, idx) => {
                    const isCompleted = idx <= currentIndex;
                    const isCurrent = idx === currentIndex;
                    const isFuture = idx > currentIndex;

                    const entry = getHistoryEntry(step.id);

                    // Specific check for skipped steps? 
                    // If we are at index 5, steps 0-4 are "completed" logically even if missing from history (skipped).
                    // But we want to show audit info if available.

                    return (
                        <div key={step.id} className="group relative flex flex-col items-center">
                            {/* Node */}
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 bg-white transition-all cursor-help
                                    ${isCurrent ? 'border-blue-600 text-blue-600 scale-110 shadow-md ring-4 ring-blue-50' :
                                        isCompleted ? 'border-green-500 bg-green-50 text-green-600' :
                                            'border-gray-200 text-gray-300'}`}
                            >
                                {isCompleted ? <CheckCircle size={14} /> : <Circle size={14} />}
                            </div>

                            {/* Label */}
                            <span
                                className={`mt-2 text-[10px] uppercase font-bold tracking-wider text-center w-20 
                                    ${isCurrent ? 'text-blue-700' : isCompleted ? 'text-gray-600' : 'text-gray-300'}`}
                            >
                                {step.label}
                            </span>

                            {/* Hover Tooltip (Audit Info) */}
                            <div className="absolute bottom-full mb-2 hidden group-hover:block z-20 w-48 p-3 bg-gray-800 text-white text-xs rounded shadow-xl">
                                <p className="font-bold border-b border-gray-600 pb-1 mb-1">{step.label}</p>
                                {entry ? (
                                    <div className="space-y-1">
                                        <p className="flex items-center gap-2">
                                            <User size={10} className="text-gray-400" />
                                            {entry.performedBy || entry.changedBy || 'Unknown'}
                                        </p>
                                        <p className="flex items-center gap-2">
                                            <Clock size={10} className="text-gray-400" />
                                            {new Date(entry.timestamp).toLocaleString(undefined, {
                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </p>
                                        {entry.reason && (
                                            <p className="italic text-gray-400 mt-1">"{entry.reason}"</p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-gray-400 italic">
                                        {isCompleted ? 'Log missing / Skipped' : 'Pending'}
                                    </p>
                                )}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SampleProgressBar;
