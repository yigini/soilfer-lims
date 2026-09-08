import React, { useState } from 'react';
import {
    ArrowLeft, RefreshCw, Maximize2, Minimize2, MapPin,
    CheckCircle2, AlertTriangle, XCircle, ExternalLink,
    FlaskConical, Printer, Clock, User, Activity, Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Executive Workflow Radar Top Strip
 * Modern glassmorphism header with live progress, station radar, owner avatar, and quick actions.
 */
export default function WorkflowTopStrip({
    locationSummary,
    mapState,
    sample,
    workItems = [],
    isFullscreen,
    onBack,
    onRefresh,
    onFullscreen,
    onOpenTimeline
}) {
    const navigate = useNavigate();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const {
        currentRoom,
        activeRooms = [],
        owner,
        status,
        risk,
        nextAction,
        sla
    } = locationSummary || {};

    const handleRefreshClick = async () => {
        setIsRefreshing(true);
        try {
            await onRefresh?.();
        } finally {
            setTimeout(() => setIsRefreshing(false), 500);
        }
    };

    // Calculate overall sample progress
    const totalItems = workItems.length;
    const doneItems = workItems.filter(wi => ['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(wi.status)).length;
    const progressPct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

    // Humanize raw backend status enums
    const formatStatus = (s) => {
        if (!s) return 'Registered';
        const map = {
            'DRAFT': 'Draft Intake',
            'EXPECTED': 'Expected',
            'RECEIVED': 'Received',
            'REGISTERED': 'Registered',
            'LAB_ID_ASSIGNED': 'Lab ID Assigned',
            'ACCEPTED': 'Accepted',
            'IN_PROGRESS': 'In Progress',
            'SUBMITTED_PARTIAL': 'In Testing (Partial)',
            'SUBMITTED': 'Submitted for Review',
            'COMPLETED': 'Completed',
            'APPROVED': 'Approved',
            'REJECTED': 'Rejected',
            'REANALYSIS_REQUIRED': 'Re-analysis Required'
        };
        return map[s] || s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    };

    const getStatusTheme = (s) => {
        switch (s) {
            case 'COMPLETED':
            case 'APPROVED':
            case 'ACCEPTED':
                return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20';
            case 'IN_PROGRESS':
            case 'SUBMITTED_PARTIAL':
                return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20';
            case 'REANALYSIS_REQUIRED':
            case 'REJECTED':
                return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20';
            case 'EXPECTED':
            case 'DRAFT':
                return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
            default:
                return 'bg-slate-500/10 text-sf-text border-slate-500/20';
        }
    };

    const formatSLA = (h) => {
        if (!h && h !== 0) return '—';
        if (h < 24) return `${h}h elapsed`;
        const d = Math.floor(h / 24);
        const rem = h % 24;
        return rem > 0 ? `${d}d ${rem}h elapsed` : `${d}d elapsed`;
    };

    const ownerInitials = owner
        ? owner.split(/[ _-]/).map(n => n[0]).join('').slice(0, 2).toUpperCase()
        : '?';

    return (
        <header className="wf-top-strip" role="banner" aria-label="Sample workflow status bar">
            {/* Left Zone: Back + Sample Identifier */}
            <div className="flex items-center gap-3 shrink-0">
                <button
                    onClick={onBack}
                    className="wf-back-btn"
                    title="Return to Sample Details"
                    aria-label="Go back"
                >
                    <ArrowLeft size={18} />
                </button>

                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Sample
                        </span>
                        {sample?.projectCode && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-sf-divider">
                                {sample.projectCode}
                            </span>
                        )}
                        {sample?.matrix && (
                            <span className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-semibold rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                {sample.matrix}
                            </span>
                        )}
                    </div>
                    <div className="text-sm font-extrabold text-sf-text tracking-tight flex items-center gap-1.5">
                        {sample?.labId || sample?.sampleId || sample?.id || '—'}
                    </div>
                </div>
            </div>

            <div className="wf-strip-divider hidden md:block" />

            {/* Middle Zone: Metrics Grid */}
            <div className="flex items-center gap-4 flex-1 flex-wrap min-w-0">
                {/* Station Location Radar */}
                <div className="wf-metric-pill">
                    <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Station</span>
                    </div>
                    <div className="text-xs font-bold text-sf-text truncate max-w-[140px] sm:max-w-[180px]">
                        {currentRoom || 'Intake Station'}
                    </div>
                </div>

                {/* Progress Bar & Counter */}
                <div className="wf-metric-pill min-w-[130px]">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Progress</span>
                        <span className="text-[11px] font-extrabold text-sf-emerald">{progressPct}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        <span className="text-[10px] font-medium text-sf-muted">
                            {doneItems}/{totalItems || '—'}
                        </span>
                    </div>
                </div>

                {/* Owner Avatar Pill */}
                <div className="wf-metric-pill hidden lg:flex">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Handler</span>
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white text-[9px] font-bold flex items-center justify-center shadow-sm">
                            {ownerInitials}
                        </div>
                        <span className="text-xs font-medium text-sf-text truncate max-w-[110px]">
                            {owner || 'Unassigned'}
                        </span>
                    </div>
                </div>

                {/* Status Badge */}
                <div className="wf-metric-pill">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Lifecycle</span>
                    <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md border ${getStatusTheme(status)}`}>
                        {formatStatus(status)}
                    </span>
                </div>

                {/* Risk / SLA */}
                <div className="wf-metric-pill hidden sm:flex">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">SLA Status</span>
                    <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md flex items-center gap-1 border ${
                            risk === 'CRITICAL'
                                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
                                : risk === 'WARNING'
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                        }`}>
                            {risk === 'CRITICAL' ? <XCircle size={11} /> : risk === 'WARNING' ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                            {risk || 'Nominal'}
                        </span>
                        {sla?.totalHours > 0 && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                ({formatSLA(sla.totalHours)})
                            </span>
                        )}
                    </div>
                </div>

                {/* Next Action Banner */}
                {nextAction && nextAction !== '—' && (
                    <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-950 dark:text-indigo-200 text-xs">
                        <Sparkles size={13} className="text-indigo-500 shrink-0" />
                        <span className="font-medium truncate max-w-[220px]">
                            <strong className="font-bold">Next:</strong> {nextAction}
                        </span>
                    </div>
                )}
            </div>

            {/* Right Zone: Quick Action Tools */}
            <div className="flex items-center gap-1.5 shrink-0">
                {/* Jump to Workbench */}
                <button
                    onClick={() => navigate(`/workbench?sampleId=${sample?.id || sample?.labId}`)}
                    className="wf-action-btn hidden md:inline-flex text-sf-emerald bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 border-indigo-200 dark:border-indigo-800"
                    title="Open in Analytical Workbench"
                    aria-label="Open in Workbench"
                >
                    <FlaskConical size={14} />
                    <span className="hidden lg:inline text-xs font-semibold">Workbench</span>
                </button>

                {/* Deep Link to Sample Page */}
                <button
                    onClick={() => navigate(`/samples/${sample?.id || sample?.labId}`)}
                    className="wf-action-btn text-sf-text hover:bg-sf-raised border-sf-divider"
                    title="Open Full Sample Details"
                    aria-label="Sample Details"
                >
                    <ExternalLink size={14} />
                    <span className="hidden lg:inline text-xs font-semibold">Details</span>
                </button>

                {/* Print Label */}
                <button
                    onClick={() => window.print()}
                    className="wf-action-btn text-sf-text hover:bg-sf-raised border-sf-divider"
                    title="Print Workflow Summary / Label"
                    aria-label="Print Label"
                >
                    <Printer size={14} />
                </button>

                {/* Refresh Live State */}
                <button
                    onClick={handleRefreshClick}
                    className="wf-action-btn text-sf-text hover:bg-sf-raised border-sf-divider"
                    title="Live Refresh Data"
                    aria-label="Refresh data"
                >
                    <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-indigo-500' : ''} />
                </button>

                {/* Fullscreen Mode */}
                <button
                    onClick={onFullscreen}
                    className="wf-action-btn text-sf-text hover:bg-sf-raised border-sf-divider"
                    title="Toggle Fullscreen Canvas (Shortcut: F)"
                    aria-label="Toggle Fullscreen"
                >
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
            </div>
        </header>
    );
}
