import React from 'react';
import {
    CheckCircle, Circle, Clock, User, FileText,
    ShieldCheck, FlaskConical, Archive, ArrowDown
} from 'lucide-react';

const STEPS = [
    { id: 'EXPECTED', label: 'Field Registration', role: 'Field Agent', group: 'Origin' },
    { id: 'RECEIVED', label: 'Lab Reception', role: 'Receptionist', group: 'Intake', isGate: true },
    { id: 'ACCEPTED', label: 'Intake Accepted', role: 'Manager', group: 'Intake', isGate: true },
    { id: 'PROCESSING', label: 'Preparation & Analysis', role: 'Technician', group: 'Analysis' },
    { id: 'SUBMITTED_FULL', label: 'Results Submitted', role: 'Technician', group: 'Validation' },
    { id: 'APPROVED', label: 'Manager Approval', role: 'Manager', group: 'Validation', isGate: true },
    { id: 'ARCHIVED', label: 'Sample Archived', role: 'Manager', group: 'Storage' },
    { id: 'DISPOSED', label: 'Sample Disposed', role: 'Manager', group: 'Storage' }
];

const STATUS_ALIASES = {
    'COLLECTED': 'EXPECTED',
    'SUBMITTED_PARTIAL': 'SUBMITTED_FULL',
    'ANALYZED': 'SUBMITTED_FULL'
};

const SampleTimeline = ({ currentStatus, history = [], className = '' }) => {
    const normalizedCurrent = STATUS_ALIASES[currentStatus] || currentStatus;

    const getStepStatus = (stepId, index) => {
        // Find if this step (or alias) is in history
        const entry = history.slice().reverse().find(h => {
            const hStatus = STATUS_ALIASES[h.status] || h.status;
            return hStatus === stepId;
        });

        // Is it the current active state?
        const isCurrent = normalizedCurrent === stepId;

        // Determining "Completed" in chronological order of STEPS. 
        const currentIndex = STEPS.findIndex(s => s.id === normalizedCurrent);
        const isPassed = currentIndex > index;

        return { entry, isCurrent, isPassed };
    };

    return (
        <div className={`bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 overflow-y-auto ${className}`}>
            <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Clock size={16} /> Workflow Timeline
            </h3>

            <div className="space-y-0 relative">
                {/* Vertical Line */}
                <div className="absolute top-4 bottom-4 left-3.5 w-0.5 bg-gray-100 -z-10" />

                {STEPS.map((step, idx) => {
                    const { entry, isCurrent, isPassed } = getStepStatus(step.id, idx);

                    // Skip 'Skipped' steps unless they are in history? 
                    // No, show full process but dim the skipped ones? 
                    // Or just show them as "Bypassed".

                    // Hiding irrelevant terminal states
                    if (step.id === 'ARCHIVED' && currentStatus === 'DISPOSED') return null;
                    if (step.id === 'DISPOSED' && currentStatus === 'ARCHIVED') return null;

                    return (
                        <div key={step.id} className={`relative flex gap-4 pb-8 ${isPassed && !entry ? 'opacity-50' : ''}`}>
                            {/* Node */}
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 z-10 transition-colors bg-white
                                ${isCurrent ? 'border-blue-600 text-blue-600 shadow-lg ring-4 ring-blue-50' :
                                    isPassed ? (entry ? 'border-green-500 text-green-600 bg-green-50' : 'border-gray-300 text-gray-300') :
                                        'border-gray-200 text-gray-200'}
                            `}>
                                {isCurrent ? <ArrowDown size={14} className="animate-bounce" /> :
                                    isPassed ? (entry ? <CheckCircle size={14} /> : <Circle size={14} />) :
                                        <Circle size={14} />}
                            </div>

                            {/* Content */}
                            <div className={`flex-1 pt-1 ${isCurrent ? 'scale-[1.02] origin-left' : ''}`}>
                                <div className="flex justify-between items-start">
                                    <span className={`text-xs font-bold uppercase tracking-wider ${isCurrent ? 'text-blue-700' : 'text-gray-600'}`}>
                                        {step.group}
                                    </span>
                                    {step.role && (
                                        <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">
                                            {step.role}
                                        </span>
                                    )}
                                </div>

                                <h4 className={`font-bold mt-1 ${isCurrent ? 'text-gray-900 text-base' : 'text-gray-700'}`}>
                                    {step.label}
                                </h4>

                                {/* Metadata Card */}
                                {(entry || isCurrent) && (
                                    <div className={`mt-2 p-3 rounded-lg border text-sm ${isCurrent ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-transparent'}`}>
                                        {entry ? (
                                            <>
                                                <div className="flex items-center gap-2 mb-1 text-gray-700 font-medium">
                                                    <User size={12} /> {entry.performedBy || entry.changedBy || 'System'}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <Clock size={12} /> {new Date(entry.timestamp).toLocaleString(undefined, {
                                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </div>
                                                {entry.reason && (
                                                    <div className="mt-2 text-xs italic text-gray-600 border-l-2 border-gray-300 pl-2">
                                                        "{entry.reason}"
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-blue-600 font-medium animate-pulse">
                                                Currently Active Step
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SampleTimeline;
