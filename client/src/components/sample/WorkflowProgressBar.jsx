import React from 'react';
import { CheckCircle, Circle, Clock, AlertTriangle } from 'lucide-react';

/**
 * WorkflowProgressBar - Visual representation of sample workflow state
 * 
 * Consumes the workflowSummary from the Workflow Engine API.
 * Shows: Phase name, progress bar, and next actions.
 */
const WorkflowProgressBar = ({ workflowSummary }) => {
    if (!workflowSummary) return null;

    const { phase, progress, nextActions, eligibility } = workflowSummary;

    // Phase colors and icons
    const phaseConfig = {
        'Intake': { color: 'bg-blue-500', icon: Circle, textColor: 'text-blue-700' },
        'Ready for Processing': { color: 'bg-indigo-500', icon: Clock, textColor: 'text-indigo-700' },
        'Preparation': { color: 'bg-amber-500', icon: Clock, textColor: 'text-amber-700' },
        'Analysis': { color: 'bg-purple-500', icon: Clock, textColor: 'text-purple-700' },
        'Review': { color: 'bg-orange-500', icon: AlertTriangle, textColor: 'text-orange-700' },
        'Complete': { color: 'bg-green-500', icon: CheckCircle, textColor: 'text-green-700' }
    };

    const config = phaseConfig[phase] || phaseConfig['Intake'];
    const Icon = config.icon;

    return (
        <div className="bg-sf-surface rounded-xl shadow-sm border border-sf-divider p-4 mb-4">
            {/* Phase Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${config.textColor}`} />
                    <span className={`font-bold text-sm uppercase tracking-wide ${config.textColor}`}>
                        {phase}
                    </span>
                </div>
                <span className="text-sm font-medium text-sf-muted">
                    {progress}% Complete
                </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-sf-raised rounded-full overflow-hidden mb-3">
                <div
                    className={`h-full ${config.color} rounded-full transition-all duration-500 ease-out`}
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Next Actions */}
            {nextActions && nextActions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <span className="text-xs text-sf-muted font-medium">Next:</span>
                    {nextActions.map((action, idx) => (
                        <span
                            key={idx}
                            className="text-xs bg-sf-canvas text-sf-muted px-2 py-1 rounded-md"
                        >
                            {action}
                        </span>
                    ))}
                </div>
            )}

            {/* Eligibility Badges */}
            {eligibility && (
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-sf-divider">
                    {eligibility.gatesComplete && (
                        <span className="text-xs bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-md flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Gates Done
                        </span>
                    )}
                    {eligibility.totalAnalyses > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded-md">
                            {eligibility.submittedCount}/{eligibility.totalAnalyses} Submitted
                        </span>
                    )}
                    {eligibility.totalAnalyses > 0 && (
                        <span className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-1 rounded-md">
                            {eligibility.acceptedCount}/{eligibility.totalAnalyses} Approved
                        </span>
                    )}
                    {eligibility.canArchive && (
                        <span className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-1 rounded-md flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Ready for Archive
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default WorkflowProgressBar;
