import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronLeft, Clock, Activity, Send, User, RotateCcw, ClipboardCheck, Microscope, ChevronDown, ChevronUp, Truck } from 'lucide-react';

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
        if (action.includes('ASSIGN')) return <User size={14} className="text-blue-500" />;
        if (action.includes('SUBMIT')) return <Send size={14} className="text-purple-500" />;
        if (action.includes('REVIEW') || action.includes('DECISION')) return <ClipboardCheck size={14} className="text-green-500" />;
        if (action.includes('RECEIVED') || action.includes('SYNC')) return <Truck size={14} className="text-indigo-500" />;
        if (action.includes('REANALYSIS') || action.includes('REJECT')) return <RotateCcw size={14} className="text-red-500" />;
        if (action.includes('DRYING') || action.includes('PREP')) return <Activity size={14} className="text-orange-500" />;
        if (action.includes('RESULT')) return <Microscope size={14} className="text-cyan-500" />;
        return <Activity size={14} className="text-gray-400" />;
    };

    // Humanize Single Action
    const humanizeAction = (event) => {
        const { action, details, analysisName, decision, type, performedByName } = event;
        // eslint-disable-next-line no-unused-vars
        const actor = performedByName || event.performedBy || 'System';

        // Extract Target from details if available (heuristic)
        const targetMatch = details?.match(/to (.+)$/);
        const target = targetMatch ? targetMatch[1] : 'Technician';

        switch (action) {
            case 'WORKITEM_ASSIGNED':
                return `Assigned analysis: ${analysisName || 'Unknown'} → ${target}`;
            case 'WORKITEM_REASSIGNED':
                return `Reassigned analysis: ${analysisName} → ${target}`;
            case 'WORKITEM_STARTED':
                return `Started analysis: ${analysisName}`;
            case 'WORKITEM_COMPLETED':
                return `Completed analysis: ${analysisName}`;
            case 'CREATE_SYNC':
                return "Synced field data for this sample";
            case 'SAMPLE_RECEIVED':
                return "Sample received at lab";
            case 'DRYING_STATUS_CHANGED':
                if (event.after?.dryingStatus === 'DONE' || details?.includes('DONE')) return "Drying marked DONE";
                if (event.after?.dryingStatus === 'FAILED' || details?.includes('FAILED')) return "Drying marked FAILED";
                return "Drying status updated";
            case 'PREP_STATUS_CHANGED':
                if (event.after?.preparationStatus === 'DONE' || details?.includes('DONE')) return "Preparation marked DONE";
                return "Preparation status updated";
            case 'WORKITEM_SUBMITTED':
                return `Submitted analysis: ${analysisName}`;
            case 'SUBMISSION_CREATED':
                return `Created ${type} submission package`;
            case 'REVIEW_DECISION_MADE':
                if (decision === 'ACCEPT') return `QA/QC accepted: ${analysisName}`;
                if (decision === 'REJECT_REANALYSIS') return `QA/QC rejected: ${analysisName}`;
                return `QA/QC decision: ${decision} for ${analysisName}`;
            case 'REANALYSIS_REQUESTED':
                return `Reanalysis requested: ${analysisName}`;
            case 'WORKITEM_GENERATED':
                return `Task generated: ${analysisName}`;
            case 'UPDATE_RESULTS':
                return `Result saved: ${analysisName}`;
            case 'STATUS_CHANGE':
                return `Status updated: ${event.before?.status} → ${event.after?.status}`;
            default:
                // Fallback to specific details if they are narrative, otherwise readable action name
                if (details && details.includes(actor)) return details;
                return action?.replace(/_/g, ' ') || "System activity";
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

            // Define Groupable Actions
            const isGroupable = [
                'WORKITEM_ASSIGNED',
                'WORKITEM_GENERATED',
                'WORKITEM_SUBMITTED',
                'REVIEW_DECISION_MADE'
            ].includes(currentActionType);

            if (isGroupable) {
                const members = [];
                // Look ahead for same action, same actor, within 2 seconds
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
                    // Create Group Event
                    // eslint-disable-next-line no-unused-vars
                    const actorName = members[0].performedByName || members[0].performedBy;
                    let label = `${members.length} items processed`;

                    if (currentActionType === 'WORKITEM_ASSIGNED') {
                        const targetMatch = members[0].details?.match(/to (.+)$/);
                        const target = targetMatch ? targetMatch[1] : 'Technician';
                        label = `Assigned ${members.length} analyses → ${target}`;
                    } else if (currentActionType === 'WORKITEM_GENERATED') {
                        label = `Generated ${members.length} tasks`;
                    } else if (currentActionType === 'WORKITEM_SUBMITTED') {
                        label = `Submitted ${members.length} analyses`;
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
                    continue; // i is already incremented in loop
                } else if (members.length === 1) {
                    grouped.push(members[0]);
                    continue; // Loop incremented inside
                }
            }

            grouped.push(current);
            i++;
        }
        return grouped;
    }, [history]);

    return (
        <div
            className={`fixed right-0 top-[73px] bottom-0 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out shadow-[-10px_0_30px_rgba(0,0,0,0.05)] z-40 flex flex-col ${isOpen ? 'w-96' : 'w-12'
                }`}
        >
            {/* Toggle Handle */}
            <button
                onClick={onToggle}
                className="absolute -left-3.5 top-8 bg-indigo-600 dark:bg-indigo-500 text-white rounded-full p-1.5 shadow-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 z-50 flex items-center justify-center w-7 h-7 hover:scale-110 transition-all border-2 border-white dark:border-gray-900"
            >
                {isOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            {/* Content */}
            {isOpen ? (
                <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
                    <div className="flex items-center gap-3 mb-8 sticky top-0 bg-white dark:bg-gray-900 pb-5 border-b border-gray-100 dark:border-gray-800 z-10">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                            <Clock size={18} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-widest text-xs">Audit Timeline</h2>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">History of all activities</p>
                        </div>
                        <span className="ml-auto bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-bold px-2.5 py-1 rounded-full border border-gray-200 dark:border-gray-700">
                            {processedHistory.length}
                        </span>
                    </div>

                    <div className="relative border-l-2 border-indigo-50 dark:border-gray-800 ml-4 space-y-9 pb-10">
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
                            <div className="text-center py-12">
                                <Activity size={32} className="mx-auto text-gray-200 mb-2" />
                                <div className="text-gray-400 italic text-sm">No history recorded yet</div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center pt-24 gap-6 opacity-40 hover:opacity-100 transition-opacity cursor-pointer" onClick={onToggle}>
                    <Clock size={22} className="text-gray-500" />
                    <div className="writing-vertical-rl text-[10px] font-black text-gray-400 tracking-[0.3em] uppercase">
                        Audit Log
                    </div>
                </div>
            )}
        </div>
    );
};

// Sub-component for individual or grouped items
const TimelineItem = ({ event, humanizeAction, getIcon, formatTime }) => {
    const [expanded, setExpanded] = useState(false);

    if (event.isGroup) {
        return (
            <div className="relative pl-8">
                {/* Timeline Dot */}
                <div className="absolute -left-[7px] top-1.5 w-3.5 h-3.5 rounded-full bg-white dark:bg-gray-900 border-[3px] border-indigo-500 z-10 shadow-sm"></div>

                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-indigo-50/30 dark:bg-indigo-900/10 border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all">
                    <span className="text-[10px] font-mono font-bold text-indigo-400/80 dark:text-indigo-500/80">{formatTime(event.timestamp)}</span>

                    {/* Clickable Header for Group */}
                    <div
                        className="font-bold text-gray-800 dark:text-gray-100 text-[13px] cursor-pointer hover:text-indigo-600 flex items-center justify-between group/hdr"
                        onClick={() => setExpanded(!expanded)}
                    >
                        <span>{event.label}</span>
                        <div className="p-0.5 rounded bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </div>
                    </div>

                    <div className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[8px]">
                            {event.performedByName?.charAt(0) || 'U'}
                        </div>
                        {event.performedByName || event.performedBy}
                    </div>

                    {/* Expanded List */}
                    {expanded && (
                        <div className="mt-3 pl-3 border-l-2 border-indigo-100 dark:border-indigo-900/50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            {event.members.map((member, i) => (
                                <div key={i} className="flex flex-col gap-1">
                                    <div className="text-[11px] text-gray-700 dark:text-gray-300 font-bold flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                                        {member.analysisName || member.analysisCode}
                                    </div>
                                    {member.decision && (
                                        <div className={`ml-3.5 px-2 py-0.5 rounded text-[9px] font-black inline-block w-fit ${member.decision === 'ACCEPT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
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
        <div className="relative pl-8 group">
            {/* Timeline Icon */}
            <div className="absolute -left-3 top-0 p-1.5 bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 rounded-xl z-10 shadow-sm transition-all group-hover:border-indigo-400 group-hover:scale-110 group-hover:shadow-md">
                {getIcon(event.action)}
            </div>

            <div className="flex flex-col gap-1.5 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all border border-transparent hover:border-gray-100 dark:hover:border-gray-800">
                <span className="text-[10px] font-mono font-bold text-gray-400 group-hover:text-indigo-400 transition-colors">
                    {formatTime(event.timestamp)}
                </span>

                <div className="font-bold text-gray-800 dark:text-gray-100 text-[13px] leading-snug">
                    {humanizeAction(event)}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
                    <div className="w-4 h-4 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-[8px] border border-indigo-100 dark:border-indigo-800">
                        {event.performedByName?.charAt(0) || 'U'}
                    </div>
                    {event.performedByName || event.performedBy}
                </div>

                {/* Extra Details / Reason */}
                {(event.reason || (event.details && !humanizeAction(event).includes(event.details))) && (
                    <div className="mt-2 text-[11px] text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                        {event.reason && (
                            <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-black mb-1 text-[10px] uppercase tracking-wider">
                                <span className="w-1 h-1 rounded-full bg-orange-600 animate-pulse"></span>
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
