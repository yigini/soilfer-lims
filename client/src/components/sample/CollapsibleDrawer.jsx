import { useAnalysisNames } from '../../context/AnalysisCatalogueContext';
import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronLeft, Clock, Activity, Send, User, RotateCcw, ClipboardCheck, Microscope, ChevronDown, ChevronUp, Truck, X, ShieldCheck } from 'lucide-react';

const CollapsibleDrawer = ({ history = [], isOpen, onToggle }) => {

    // Helper to format timestamps
    const formatTime = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toLocaleString('en-GB', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Icon mapping
    const getIcon = (action) => {
        if (action.includes('ASSIGN')) return <User size={14} className="text-blue-600 dark:text-blue-400" />;
        if (action.includes('SUBMIT')) return <Send size={14} className="text-purple-600 dark:text-purple-400" />;
        if (action.includes('REVIEW') || action.includes('DECISION')) return <ClipboardCheck size={14} className="text-emerald-600 dark:text-emerald-400" />;
        if (action.includes('RECEIVED') || action.includes('SYNC')) return <Truck size={14} className="text-sf-emerald" />;
        if (action.includes('REANALYSIS') || action.includes('REJECT')) return <RotateCcw size={14} className="text-red-600 dark:text-red-400" />;
        if (action.includes('DRYING') || action.includes('PREP')) return <Activity size={14} className="text-amber-600 dark:text-amber-400" />;
        if (action.includes('RESULT')) return <Microscope size={14} className="text-teal-600 dark:text-teal-400" />;
        return <Activity size={14} className="text-gray-400" />;
    };

    // Humanize Single Action
    const humanizeAction = (event) => {
        const { action, details, analysisName, decision, type, performedByName } = event;
        const actor = performedByName || event.performedBy || 'System';

        const targetMatch = details?.match(/to (.+)$/);
        const target = targetMatch ? targetMatch[1] : 'Technician';

        switch (action) {
            case 'WORKITEM_ASSIGNED':
                return `Assigned analysis: ${analysisName || 'Parameter'} → ${target}`;
            case 'WORKITEM_REASSIGNED':
                return `Reassigned analysis: ${analysisName} → ${target}`;
            case 'WORKITEM_STARTED':
                return `Started analysis: ${analysisName}`;
            case 'WORKITEM_COMPLETED':
                return `Completed analysis: ${analysisName}`;
            case 'CREATE_SYNC':
                return "Synced field data from survey";
            case 'SAMPLE_RECEIVED':
                return "Sample received at laboratory";
            case 'DRYING_STATUS_CHANGED':
                if (event.after?.dryingStatus === 'DONE' || details?.includes('DONE')) return "Sample drying completed";
                if (event.after?.dryingStatus === 'FAILED' || details?.includes('FAILED')) return "Sample drying flagged failed";
                return "Drying stage updated";
            case 'PREP_STATUS_CHANGED':
                if (event.after?.preparationStatus === 'DONE' || details?.includes('DONE')) return "Sample preparation completed";
                return "Preparation stage updated";
            case 'WORKITEM_SUBMITTED':
                return `Submitted results for ${analysisName}`;
            case 'SUBMISSION_CREATED':
                return `Created ${type || 'analysis'} submission package`;
            case 'REVIEW_DECISION_MADE':
                if (decision === 'ACCEPT') return `QA/QC Accepted: ${analysisName}`;
                if (decision === 'REJECT_REANALYSIS') return `QA/QC Rejected for Re-analysis: ${analysisName}`;
                return `QA/QC Decision (${decision}): ${analysisName}`;
            case 'REANALYSIS_REQUESTED':
                return `Re-analysis requested for ${analysisName}`;
            case 'WORKITEM_GENERATED':
                return `Generated analytical work item: ${analysisName}`;
            case 'UPDATE_RESULTS':
                return `Saved result value for ${analysisName}`;
            case 'STATUS_CHANGE':
                return `Sample status transitioned: ${event.before?.status || '—'} → ${event.after?.status || '—'}`;
            default:
                if (details && details.includes(actor)) return details;
                return action?.replace(/_/g, ' ') || "Laboratory event logged";
        }
    };

    // Grouping Logic
    const processedHistory = useMemo(() => {
        if (!history || history.length === 0) return [];

        const sorted = [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const grouped = [];

        let i = 0;
        while (i < sorted.length) {
            const current = sorted[i];
            const currentActionType = current.action;
            const currentActor = current.performedBy;
            const currentStamp = current.timestamp;

            const isGroupable = [
                'WORKITEM_ASSIGNED',
                'WORKITEM_GENERATED',
                'WORKITEM_SUBMITTED',
                'REVIEW_DECISION_MADE'
            ].includes(currentActionType);

            if (isGroupable) {
                const members = [];
                while (
                    i < sorted.length &&
                    sorted[i].action === currentActionType &&
                    sorted[i].performedBy === currentActor &&
                    Math.abs(new Date(sorted[i].timestamp) - new Date(currentStamp)) < 2000
                ) {
                    members.push(sorted[i]);
                    i++;
                }

                if (members.length > 1) {
                    let label = `${members.length} items processed`;

                    if (currentActionType === 'WORKITEM_ASSIGNED') {
                        const targetMatch = members[0].details?.match(/to (.+)$/);
                        const target = targetMatch ? targetMatch[1] : 'Technician';
                        label = `Assigned ${members.length} analyses → ${target}`;
                    } else if (currentActionType === 'WORKITEM_GENERATED') {
                        label = `Generated ${members.length} analytical tasks`;
                    } else if (currentActionType === 'WORKITEM_SUBMITTED') {
                        label = `Submitted results for ${members.length} analyses`;
                    } else if (currentActionType === 'REVIEW_DECISION_MADE') {
                        label = `QA/QC Reviewed ${members.length} analyses`;
                    }

                    grouped.push({
                        ...members[0],
                        isGroup: true,
                        count: members.length,
                        label: label,
                        members: members,
                        timestamp: members[0].timestamp
                    });
                    continue;
                } else if (members.length === 1) {
                    grouped.push(members[0]);
                    continue;
                }
            }

            grouped.push(current);
            i++;
        }
        return grouped;
    }, [history]);

    return (
        <>
            {/* 1. Sleek Floating Trigger Pill (When Closed) */}
            {!isOpen && (
                <button
                    onClick={onToggle}
                    className="fixed right-0 top-36 z-40 flex items-center gap-2 bg-sf-surface text-sf-muted hover:text-emerald-700 dark:hover:text-emerald-300 px-3.5 py-2.5 rounded-l-2xl shadow-xl border-y border-l border-sf-divider hover:border-emerald-300 font-bold text-xs transition-all hover:translate-x-[-3px] group font-sans"
                    title="Open Sample Audit Trail & History"
                >
                    <Clock size={16} className="text-emerald-600 group-hover:rotate-45 transition-transform" />
                    <span className="font-extrabold uppercase tracking-wider text-[11px]">Audit Log</span>
                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-black rounded-full">
                        {processedHistory.length}
                    </span>
                </button>
            )}

            {/* 2. Backdrop Overlay (When Open) */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-xs z-[99] transition-opacity duration-200"
                    onClick={onToggle}
                />
            )}

            {/* 3. Slide-in Drawer Container */}
            <div
                className={`fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-sf-surface border-l border-gray-200 dark:border-gray-800 z-[100] flex flex-col shadow-2xl transition-transform duration-300 ease-in-out font-sans ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Header */}
                <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/80 dark:bg-gray-900/80 sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded-xl">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h2 className="font-black text-sf-text text-base leading-tight">
                                Sample Audit Trail
                            </h2>
                            <p className="text-[11px] text-sf-muted font-medium">
                                ISO/IEC 17025 Defensible Event Log
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold rounded-full border border-emerald-200 dark:border-emerald-800/60">
                            {processedHistory.length} Events
                        </span>
                        <button
                            onClick={onToggle}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Timeline Content */}
                <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                    <div className="relative border-l-2 border-emerald-100 dark:border-gray-800 ml-3 space-y-6 pb-8">
                        {processedHistory.map((event, idx) => (
                            <TimelineItem
                                key={idx}
                                event={event}
                                humanizeAction={humanizeAction}
                                getIcon={getIcon}
                                formatTime={formatTime}
                            />
                        ))}
                        {processedHistory.length === 0 && (
                            <div className="text-center py-16">
                                <Activity size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2 opacity-60" />
                                <div className="text-gray-400 font-medium text-xs">No audit events recorded for this sample yet.</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

// Sub-component for individual or grouped items
const TimelineItem = ({ event, humanizeAction, getIcon, formatTime }) => {
    const getAnalysisDisplayName = useAnalysisNames();
    const [expanded, setExpanded] = useState(false);

    if (event.isGroup) {
        return (
            <div className="relative pl-7">
                {/* Timeline Dot */}
                <div className="absolute -left-[7px] top-1.5 w-3.5 h-3.5 rounded-full bg-sf-surface border-[3px] border-emerald-600 z-10 shadow-sm"></div>

                <div className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100/60 dark:border-emerald-900/40 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all">
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{formatTime(event.timestamp)}</span>

                    {/* Clickable Header for Group */}
                    <div
                        className="font-bold text-gray-900 dark:text-gray-100 text-xs cursor-pointer hover:text-emerald-700 dark:hover:text-emerald-400 flex items-center justify-between group/hdr"
                        onClick={() => setExpanded(!expanded)}
                    >
                        <span>{event.label}</span>
                        <div className="p-1 rounded-lg bg-sf-surface border border-sf-divider shadow-xs">
                            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </div>
                    </div>

                    <div className="text-[11px] text-sf-muted font-semibold flex items-center gap-1.5 pt-0.5">
                        <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center text-[9px] font-bold">
                            {event.performedByName?.charAt(0) || 'U'}
                        </div>
                        <span>{event.performedByName || event.performedBy}</span>
                    </div>

                    {/* Expanded List */}
                    {expanded && (
                        <div className="mt-2.5 pl-3 border-l-2 border-emerald-200 dark:border-emerald-800 space-y-2 animate-in fade-in duration-200">
                            {event.members.map((member, i) => (
                                <div key={i} className="flex flex-col gap-0.5">
                                    <div className="text-[11px] text-sf-muted font-bold flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                        {getAnalysisDisplayName(member.analysisCode, member.analysisName)}
                                    </div>
                                    {member.decision && (
                                        <div className={`ml-3 px-2 py-0.5 rounded text-[9px] font-extrabold inline-block w-fit ${
                                            member.decision === 'ACCEPT' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                        }`}>
                                            {member.decision}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="relative pl-7 group">
            {/* Timeline Icon */}
            <div className="absolute -left-3 top-0.5 p-1 bg-sf-surface border-2 border-sf-divider rounded-xl z-10 shadow-sm transition-all group-hover:border-emerald-500 group-hover:scale-105">
                {getIcon(event.action)}
            </div>

            <div className="flex flex-col gap-1 p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-700">
                <span className="text-[10px] font-bold text-sf-muted group-hover:text-emerald-600 transition-colors">
                    {formatTime(event.timestamp)}
                </span>

                <div className="font-bold text-gray-900 dark:text-gray-100 text-xs leading-snug">
                    {humanizeAction(event)}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-bold pt-0.5">
                    <div className="w-4 h-4 rounded-full bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-[9px] border border-emerald-200 dark:border-emerald-800">
                        {event.performedByName?.charAt(0) || 'U'}
                    </div>
                    <span>{event.performedByName || event.performedBy}</span>
                </div>

                {/* Extra Details / Reason */}
                {(event.reason || (event.details && !humanizeAction(event).includes(event.details))) && (
                    <div className="mt-1.5 text-[11px] text-sf-muted bg-sf-canvas p-2.5 rounded-xl border border-sf-divider">
                        {event.reason && (
                            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold mb-1 text-[10px] uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Reason: {event.reason}
                            </div>
                        )}
                        {event.details && event.details !== humanizeAction(event) && (
                            <div className="font-medium whitespace-pre-wrap leading-relaxed">{event.details}</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CollapsibleDrawer;

