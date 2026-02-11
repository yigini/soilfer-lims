import React from 'react';
import { Check, Circle, Loader, AlertCircle } from 'lucide-react';

const PHASES = [
    { label: 'Intake', statuses: ['COLLECTED', 'RECEIVED', 'LAB_ID_ASSIGNED'] },
    { label: 'Preparation', statuses: ['DRYING', 'PREPARED'] },
    { label: 'Analysis', statuses: ['WET_CHEM_IN_PROGRESS', 'WET_CHEM_COMPLETED', 'SPECTRAL_IN_PROGRESS', 'SPECTRAL_COMPLETED'] },
    { label: 'Validation', statuses: ['QA_QC_IN_PROGRESS', 'ANALYSIS_COMPLETED'] },
    { label: 'Complete', statuses: ['ACCEPTED', 'ARCHIVED', 'DISPOSED'] }
];

const SampleStepper = ({ currentStatus }) => {

    const getPhaseStatus = (phase) => {
        // FLAT LIST of all statuses in order
        const ALL_ORDERED = [
            'COLLECTED', 'RECEIVED', 'LAB_ID_ASSIGNED',
            'DRYING', 'PREPARED',
            'WET_CHEM_IN_PROGRESS', 'WET_CHEM_COMPLETED', 'SPECTRAL_IN_PROGRESS', 'SPECTRAL_COMPLETED',
            'QA_QC_IN_PROGRESS', 'ANALYSIS_COMPLETED',
            'ACCEPTED', 'ARCHIVED', 'DISPOSED'
        ];

        const currentIndex = ALL_ORDERED.indexOf(currentStatus);

        // Find first status of this phase
        const firstInPhase = phase.statuses[0];
        const lastInPhase = phase.statuses[phase.statuses.length - 1];

        const firstIndex = ALL_ORDERED.indexOf(firstInPhase);
        const lastIndex = ALL_ORDERED.indexOf(lastInPhase);

        if (currentIndex > lastIndex) return 'completed';
        if (currentIndex >= firstIndex && currentIndex <= lastIndex) return 'current';
        return 'upcoming';
    };

    return (
        <div className="w-full flex items-center justify-between px-4 py-4 bg-white border-b border-gray-100">
            {PHASES.map((phase, idx) => {
                const status = getPhaseStatus(phase);
                const isLast = idx === PHASES.length - 1;

                return (
                    <React.Fragment key={phase.label}>
                        <div className="flex flex-col items-center relative z-10 group">
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500
                                ${status === 'completed' ? 'bg-green-500 border-green-500 text-white' :
                                    status === 'current' ? 'bg-white border-blue-600 text-blue-600 ring-4 ring-blue-50' :
                                        'bg-white border-gray-200 text-gray-300'}
                            `}>
                                {status === 'completed' ? <Check size={16} strokeWidth={3} /> :
                                    status === 'current' ? <Loader size={16} className="animate-spin-slow" /> :
                                        <Circle size={12} />}
                            </div>
                            <span className={`
                                text-xs font-bold mt-2 uppercase tracking-wide transition-colors duration-300
                                ${status === 'current' ? 'text-blue-700 transform scale-105' :
                                    status === 'completed' ? 'text-green-700' : 'text-gray-400'}
                            `}>
                                {phase.label}
                            </span>
                        </div>

                        {!isLast && (
                            <div className="flex-1 h-0.5 mx-4 bg-gray-100 relative">
                                <div className={`
                                    absolute left-0 top-0 bottom-0 transition-all duration-700 bg-green-500
                                    ${status === 'completed' ? 'w-full' : 'w-0'}
                                `} />
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default SampleStepper;
