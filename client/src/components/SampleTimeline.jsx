import React from 'react';
import {
    CheckCircle, Circle, Clock, User, FileText,
    ShieldCheck, FlaskConical, Archive, ArrowDown, RotateCcw
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

const SampleTimeline = ({ currentStatus, history = [], episodes = [], className = '' }) => {
    const normalizedCurrent = STATUS_ALIASES[currentStatus] || currentStatus;

    // SD-17: Detect multiple analytical episodes
    const reopenEntries = history.filter(h =>
        h.status === 'UNDO_APPROVAL' ||
        h.status === 'SAMPLE_REOPENED' ||
        h.action === 'UNDO_APPROVAL' ||
        (typeof h.reason === 'string' && h.reason.includes('Reverted'))
    );
    const hasMultipleEpisodes = (episodes && episodes.length > 1) || reopenEntries.length > 0;

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
        <div className={`bg-sf-surface p-6 rounded-xl border border-sf-divider overflow-y-auto ${className}`}>
            <h3 className="font-bold text-sf-text mb-6 flex items-center gap-2">
                <Clock size={16} /> Workflow Timeline
            </h3>

            {/* SD-17: Analytical Episodes Overview for Reopened Records */}
            {hasMultipleEpisodes && (
                <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm mb-2">
                        <RotateCcw size={16} /> Reopened Analytical Record — Multiple Passes
                    </div>
                    <div className="space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                        {episodes && episodes.length > 0 ? (
                            episodes.map(ep => (
                                <div key={ep.episodeNumber} className="flex justify-between items-center py-0.5 border-b border-amber-200/50 dark:border-amber-800/50 last:border-0">
                                    <span className="font-semibold">{ep.label}:</span>
                                    <span className="font-mono text-[11px]">
                                        {ep.approvedAt ? `Approved ${new Date(ep.approvedAt).toLocaleDateString()}` : (ep.reopenedAt ? `Reopened ${new Date(ep.reopenedAt).toLocaleDateString()}` : 'Current')}
                                    </span>
                                </div>
                            ))
                        ) : (
                            reopenEntries.map((reopen, idx) => (
                                <div key={idx} className="flex justify-between items-center">
                                    <span className="font-semibold">Reopened by {reopen.performedBy}:</span>
                                    <span className="italic truncate max-w-xs">{reopen.reason || 'Rework required'}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            <div className="space-y-0 relative">
                {/* Vertical Line */}
                <div className="absolute top-4 bottom-4 left-3.5 w-0.5 bg-sf-raised -z-10" />

                {STEPS.map((step, idx) => {
                    const { entry, isCurrent, isPassed } = getStepStatus(step.id, idx);

                    // Hiding irrelevant terminal states
                    if (step.id === 'ARCHIVED' && currentStatus === 'DISPOSED') return null;
                    if (step.id === 'DISPOSED' && currentStatus === 'ARCHIVED') return null;

                    return (
                        <div key={step.id} className={`relative flex gap-4 pb-8 ${isPassed && !entry ? 'opacity-50' : ''}`}>
                            {/* Node */}
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0 z-10 transition-colors bg-sf-surface
                                ${isCurrent ? 'border-blue-600 text-blue-600 shadow-lg ring-4 ring-blue-50 dark:ring-blue-900/30' :
                                    isPassed ? (entry ? 'border-green-500 text-green-600 bg-green-50 dark:bg-green-950/20' : 'border-gray-300 text-gray-300') :
                                        'border-sf-divider text-gray-200 dark:text-gray-600'}
                            `}>
                                {isCurrent ? <ArrowDown size={14} className="animate-bounce" /> :
                                    isPassed ? (entry ? <CheckCircle size={14} /> : <Circle size={14} />) :
                                        <Circle size={14} />}
                            </div>

                            {/* Content */}
                            <div className={`flex-1 pt-1 ${isCurrent ? 'scale-[1.02] origin-left' : ''}`}>
                                <div className="flex justify-between items-start">
                                    <span className={`text-xs font-bold uppercase tracking-wider ${isCurrent ? 'text-blue-700 dark:text-blue-400' : 'text-sf-muted'}`}>
                                        {step.group}
                                    </span>
                                    {step.role && (
                                        <span className="text-[10px] px-2 py-0.5 bg-sf-raised text-gray-500 dark:text-gray-300 rounded-full font-medium">
                                            {step.role}
                                        </span>
                                    )}
                                </div>

                                <h4 className={`font-bold mt-1 ${isCurrent ? 'text-gray-900 dark:text-gray-100 text-base' : 'text-sf-muted'}`}>
                                    {step.label}
                                </h4>

                                {/* Metadata Card */}
                                {(entry || isCurrent) && (
                                    <div className={`mt-2 p-3 rounded-lg border text-sm ${isCurrent ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900' : 'bg-gray-50 dark:bg-gray-700/50 border-transparent'}`}>
                                        {entry ? (
                                            <>
                                                <div className="flex items-center gap-2 mb-1 text-sf-text font-medium">
                                                    <User size={12} /> {entry.performedBy || entry.changedBy || 'System'}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-sf-muted">
                                                    <Clock size={12} /> {new Date(entry.timestamp).toLocaleString(undefined, {
                                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </div>
                                                {entry.reason && (
                                                    <div className="mt-2 text-xs italic text-sf-muted border-l-2 border-sf-divider pl-2">
                                                        "{entry.reason}"
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-blue-600 dark:text-blue-400 font-medium animate-pulse">
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
