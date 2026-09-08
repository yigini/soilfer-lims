import React from 'react';
import { RefreshCw, Download, CalendarClock, Inbox, ClipboardCheck, Beaker, ShieldCheck, History } from 'lucide-react';
import InfoTooltip from '../common/InfoTooltip';

const STATUS_CONFIG = [
    {
        key: 'EXPECTED', label: 'Expected', icon: CalendarClock,
        color: 'text-sf-muted', bg: 'bg-sf-canvas', border: 'border-sf-divider',
        gradient: 'from-gray-50 to-white',
        description: 'Samples registered in the system but not yet physically received at the laboratory.',
        statuses: 'EXPECTED'
    },
    {
        key: 'RECEIVED', label: 'Received', icon: Inbox,
        color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-200 dark:border-blue-800',
        gradient: 'from-blue-50 to-white',
        description: 'Samples have physically arrived and been marked as received.',
        statuses: 'RECEIVED'
    },
    {
        key: 'ACCEPTED', label: 'Accepted', icon: ClipboardCheck,
        color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800',
        gradient: 'from-emerald-50 to-white',
        description: 'Intake validated, Lab ID assigned, ready for processing.',
        statuses: 'ACCEPTED'
    },
    {
        key: 'ONGOING', label: 'Ongoing', icon: Beaker,
        color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800',
        gradient: 'from-amber-50 to-white',
        description: 'Samples are currently undergoing preparation or analysis.',
        statuses: 'PROCESSING,SUBMITTED_PARTIAL'
    },
    {
        key: 'COMPLETED', label: 'Complete', icon: ShieldCheck,
        color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/40', border: 'border-purple-200 dark:border-purple-800',
        gradient: 'from-purple-50 to-white',
        description: 'All analyses completed and results submitted for approval.',
        statuses: 'SUBMITTED_FULL,APPROVED'
    },
    {
        key: 'HISTORY', label: 'Archived', icon: History,
        color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-200 dark:border-red-800',
        gradient: 'from-red-50 to-white',
        description: 'Final state: Samples stored in long-term archive or disposed.',
        statuses: 'ARCHIVED,DISPOSED'
    },
];

const SamplesHeader = ({ facets = {}, onSync, onExport, onLegacyBackfill, loadingSync, onToggleQuickFilter }) => {
    const lifecycleCounts = facets.lifecycle || {};

    return (
        <div className="flex flex-col gap-4 mb-4">
            {/* Top Row: Title and Global Actions */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold tracking-tight text-sf-text flex items-center gap-2">
                        Samples
                        <InfoTooltip text="Active sample management dashboard. View lifecycle stages, search, and manage laboratory resources." position="bottom" />
                    </h1>

                    {/* Action Icons next to title */}
                    <div className="flex items-center gap-1 p-1 bg-sf-surface rounded-xl border border-sf-divider ml-2">
                        {/* Sync Action */}
                        <div className="flex items-center">
                            <button
                                onClick={onSync}
                                disabled={loadingSync}
                                className="p-2 rounded-lg text-sf-muted hover:text-emerald-500 hover:bg-sf-canvas transition-all duration-200"
                            >
                                <RefreshCw size={16} className={loadingSync ? "animate-spin" : ""} />
                            </button>
                            <InfoTooltip text="Sync with Kobo to check for newly collected field samples." position="bottom" />
                        </div>

                        {/* Export Action */}
                        <div className="flex items-center">
                            <button
                                onClick={onExport}
                                className="p-2 rounded-lg text-sf-muted hover:text-purple-500 hover:bg-sf-canvas transition-all duration-200"
                            >
                                <Download size={16} />
                            </button>
                            <InfoTooltip text="Download currently filtered list as CSV/Excel." position="bottom" />
                        </div>

                        {/* Pre-Delivery Historical Analysis Backfill Action */}
                        {onLegacyBackfill && (
                            <div className="flex items-center">
                                <button
                                    onClick={onLegacyBackfill}
                                    className="p-2 rounded-lg text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-all duration-200"
                                    title="Pre-delivery historical sample analysis backfill (backward compatibility)"
                                >
                                    <History size={16} />
                                </button>
                                <InfoTooltip text="Backward compatibility: Ingest samples and analytical results completed prior to platform rollout." position="bottom" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Connected Lifecycle Stepper */}
            <div className="flex items-center w-full bg-sf-surface p-2 rounded-2xl border border-sf-divider shadow-sm overflow-visible">
                {STATUS_CONFIG.map((status, index) => {
                    const count = lifecycleCounts[status.key] || 0;
                    const isLast = index === STATUS_CONFIG.length - 1;

                    return (
                        <React.Fragment key={status.key}>
                            <div
                                className="relative group flex-1 cursor-pointer"
                                onClick={() => onToggleQuickFilter && onToggleQuickFilter('status', status.statuses)}
                            >
                                <div className={`flex items-center justify-center gap-2 px-2 py-1.5 rounded-full hover:bg-sf-canvas transition-colors duration-200 cursor-default ${index === 0 ? 'pl-2' : ''} ${isLast ? 'pr-2' : ''}`}>
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full ${status.bg} ${status.border} border`}>
                                        <status.icon size={14} className={status.color} />
                                    </div>

                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-sf-muted leading-none mb-0.5 truncate flex items-center">
                                            {status.label}
                                            <InfoTooltip text={status.description} position="bottom" />
                                        </span>
                                        <span className="text-sm font-bold text-sf-text leading-none">
                                            {count}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Connector Arrow */}
                            {!isLast && (
                                <div className="flex-shrink-0 text-sf-muted px-1">
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4">
                                        <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default SamplesHeader;
