import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    BarChart3, UserCheck, AlertTriangle, ArrowUpRight, ArrowRight,
    CheckCircle2, Clock, Layers, FlaskConical, Calendar, ShieldAlert
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

/**
 * ManagerProgressOverview
 * Renders the high-level Laboratory Overview dashboard for LAB_MANAGER and scoped administrators.
 * Provides sample determination progress (% bars), technician workload distribution / bottlenecks,
 * stage lifecycle counts, and direct task list continuation links. (Refs #120)
 */
export default function ManagerProgressOverview({
    progressOverview = {},
    onSwitchToQueue = null,
    activeLabId = ''
}) {
    const { t } = useLanguage();
    const navigate = useNavigate();

    const oversight = progressOverview?.oversight || [];
    const techWorkload = progressOverview?.techWorkload || [];
    const stageCounts = progressOverview?.stageCounts || {
        pendingIntake: 0,
        inProgress: 0,
        awaitingReview: 0,
        finalApproval: 0,
        completed: 0,
        approvedToday: 0,
        unassignedTasks: 0,
        totalSamples: 0
    };

    const stages = [
        {
            key: 'intake',
            label: t('dashboard.manager.stageIntake', 'Intake Acceptance'),
            count: stageCounts.pendingIntake ?? 0,
            unit: t('dashboard.units.samples', { count: stageCounts.pendingIntake ?? 0 }, 'samples'),
            route: '/manager-queue?lane=intake',
            color: 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300'
        },
        {
            key: 'inProgress',
            label: t('dashboard.manager.stageInAnalysis', 'In Analysis'),
            count: stageCounts.inProgress ?? 0,
            unit: t('dashboard.units.samples', { count: stageCounts.inProgress ?? 0 }, 'samples'),
            route: '/samples?view=daily',
            color: 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300'
        },
        {
            key: 'review',
            label: t('dashboard.manager.stageAwaitingReview', 'Awaiting Review'),
            count: stageCounts.awaitingReview ?? 0,
            unit: t('dashboard.units.samples', { count: stageCounts.awaitingReview ?? 0 }, 'samples'),
            route: '/manager-queue?lane=review',
            color: 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300'
        },
        {
            key: 'finalApproval',
            label: t('dashboard.manager.stageFinalApproval', 'Final Approval'),
            count: stageCounts.finalApproval ?? 0,
            unit: t('dashboard.units.samples', { count: stageCounts.finalApproval ?? 0 }, 'samples'),
            route: '/manager-queue?lane=approve',
            color: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
        },
        {
            key: 'completed',
            label: t('dashboard.manager.stageCompleted', 'Approved / Released'),
            count: stageCounts.completed ?? stageCounts.approved ?? stageCounts.completedToday ?? 0,
            subtext: (stageCounts.approvedToday ?? 0) > 0
                ? t('dashboard.manager.approvedTodayCount', '{count} approved today', { count: stageCounts.approvedToday })
                : null,
            unit: t('dashboard.units.samples', { count: stageCounts.completed ?? stageCounts.approved ?? stageCounts.completedToday ?? 0 }, 'samples'),
            route: '/samples?status=APPROVED',
            color: 'border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-300'
        }
    ];

    return (
        <section aria-label={t('dashboard.manager.operationalOverview', 'Operational Overview')} className="space-y-6">
            {/* ── Stage Lifecycle Pipeline Deck ── */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-sf-muted">
                        {t('dashboard.manager.stagePipeline', 'Operational Stage Pipeline')}
                    </h2>
                    <span className="text-[11px] text-sf-muted font-medium">
                        {t('dashboard.manager.stagePipelineDesc', 'Active laboratory specimens classified by primary lifecycle stage')}
                    </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {stages.map(st => (
                        <Link
                            key={st.key}
                            to={st.route}
                            className={`p-3.5 rounded-xl border transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between group ${st.color}`}
                        >
                            <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold truncate">
                                    {st.label}
                                </span>
                                <ArrowUpRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                            <div>
                                <div className="mt-2.5 flex items-baseline gap-1.5">
                                    <span className="text-2xl font-black">
                                        {st.count}
                                    </span>
                                    <span className="text-[10px] font-semibold opacity-70">
                                        {st.unit}
                                    </span>
                                </div>
                                {st.subtext && (
                                    <div className="text-[10px] font-medium mt-1 opacity-80 truncate">
                                        {st.subtext}
                                    </div>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* ── Two-Column Main Overview: Analysis Progress + Tech Workload ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Column 1: Analysis Progress Monitor (7 cols on desktop) */}
                <div className="lg:col-span-7 col-span-12 bg-sf-surface rounded-xl border border-sf-divider shadow-sm overflow-hidden flex flex-col">
                    <div className="p-4 sm:p-5 border-b border-sf-divider flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                                <BarChart3 className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-sf-text">
                                    {t('dashboard.manager.analysisProgress', 'Analysis Progress')}
                                </h3>
                                <p className="text-[11px] text-sf-muted mt-0.5">
                                    {t('dashboard.manager.analysisProgressDesc', 'Sample-level determination progress (% completed across ordered analytical methods)')}
                                </p>
                            </div>
                        </div>
                        {oversight.length > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                {oversight.length} {t('dashboard.units.samples', { count: oversight.length }, 'samples')}
                            </span>
                        )}
                    </div>

                    <div className="p-4 sm:p-5">
                        {oversight.length > 0 ? (
                            <div className="space-y-3">
                                {oversight.map(s => {
                                    const isComplete = s.progress === 100 || s.readiness === 'READY_FOR_APPROVAL' || s.readiness === 'APPROVED';
                                    const barColor = (s.readiness === 'READY_FOR_APPROVAL' || s.readiness === 'APPROVED')
                                        ? 'bg-emerald-500'
                                        : s.readiness === 'READY_FOR_REVIEW'
                                            ? 'bg-blue-500'
                                            : s.progress > 50
                                                ? 'bg-blue-500'
                                                : 'bg-amber-500';

                                    return (
                                        <button
                                            key={s.sampleId}
                                            type="button"
                                            onClick={() => navigate(`/samples/${s.sampleId}`)}
                                            className="w-full flex items-center gap-4 p-3 rounded-lg bg-sf-surface border border-sf-divider hover:border-sf-primary/40 hover:bg-sf-hover transition-all text-left group"
                                        >
                                            <div className="w-32 truncate shrink-0">
                                                <div className="font-mono font-bold text-xs text-sf-text group-hover:text-sf-primary transition-colors">
                                                    {s.labId}
                                                </div>
                                                {s.originalId && s.originalId !== s.labId && (
                                                    <div className="text-[10px] text-sf-muted truncate">
                                                        {s.originalId}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 bg-sf-inset rounded-full h-2 overflow-hidden border border-sf-divider/50">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                                            style={{ width: `${Math.min(100, Math.max(0, s.progress))}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-black w-10 text-right text-sf-text shrink-0">
                                                        {s.progress}%
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-sf-muted mt-1 font-medium">
                                                    {t('dashboard.manager.analysesProgress', '{completed}/{total} analyses', { completed: s.completed, total: s.total })}
                                                </div>
                                            </div>

                                            <div className="shrink-0 flex items-center gap-1.5 ml-2">
                                                {s.readiness === 'READY_FOR_APPROVAL' ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                                        {t('dashboard.manager.readyForApproval', 'Ready for Approval')}
                                                    </span>
                                                ) : s.readiness === 'READY_FOR_REVIEW' ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                                                        {t('dashboard.manager.readyForReview', 'Ready for Review')}
                                                    </span>
                                                ) : s.readiness === 'APPROVED' ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
                                                        {t('dashboard.manager.approved', 'Approved')}
                                                    </span>
                                                ) : (
                                                    <ArrowRight className="w-3.5 h-3.5 text-sf-muted group-hover:text-sf-primary transition-colors" />
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-10 px-4 border border-dashed border-sf-divider rounded-xl bg-sf-inset/30">
                                <FlaskConical className="w-8 h-8 mx-auto mb-2 text-sf-muted opacity-40" />
                                <div className="text-xs font-bold text-sf-text">
                                    {t('dashboard.manager.noActiveAnalyses', 'No active samples undergoing laboratory determinations.')}
                                </div>
                                <p className="text-[11px] text-sf-muted mt-1 max-w-sm mx-auto">
                                    {t('dashboard.manager.noActiveAnalysesSub', 'Physically intaken samples with pending determinations will appear here.')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 2: Technician Workload & Bottlenecks (5 cols on desktop) */}
                <div className="lg:col-span-5 col-span-12 space-y-4">
                    {/* Unassigned Work Items Alert (if any) */}
                    {stageCounts.unassignedTasks > 0 && (
                        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 flex items-start justify-between gap-3 shadow-sm">
                            <div className="flex items-start gap-2.5">
                                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <div className="text-xs font-bold">
                                        {t('dashboard.manager.unassignedAlert', '{count} work items need assignment', { count: stageCounts.unassignedTasks })}
                                    </div>
                                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                                        {t('dashboard.manager.unassignedAlertSub', 'Allocate determinations to analysts to prevent bench delays.')}
                                    </p>
                                </div>
                            </div>
                            <Link
                                to="/manager-queue?lane=assign"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors shrink-0 shadow-sm"
                            >
                                <span>{t('dashboard.manager.assignInTaskList', 'Assign')}</span>
                                <ArrowUpRight className="w-3 h-3" />
                            </Link>
                        </div>
                    )}

                    {/* Technician Workload Deck */}
                    <div className="bg-sf-surface rounded-xl border border-sf-divider shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 sm:p-5 border-b border-sf-divider flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                                    <UserCheck className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-sf-text">
                                        {t('dashboard.manager.techWorkload', 'Technician Workload & Bottlenecks')}
                                    </h3>
                                    <p className="text-[11px] text-sf-muted mt-0.5">
                                        {t('dashboard.manager.techWorkloadDesc', 'Workload distribution and pending task balance across bench technicians')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 sm:p-5">
                            {techWorkload.length > 0 ? (
                                <div className="space-y-2.5">
                                    {techWorkload.map(tItem => {
                                        const isBottleneck = tItem.pending >= 15;
                                        return (
                                            <div
                                                key={tItem.username}
                                                className={`p-3 rounded-lg border transition-all flex items-center justify-between gap-3 ${isBottleneck
                                                    ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                                                    : 'bg-sf-surface border-sf-divider'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-full bg-sf-inset border border-sf-divider flex items-center justify-center text-xs font-black text-sf-primary shrink-0">
                                                        {(tItem.name || tItem.username).charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-bold text-sf-text truncate flex items-center gap-1.5">
                                                            <span>{tItem.name}</span>
                                                            {isBottleneck && (
                                                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                                                                    {t('dashboard.manager.highWorkload', 'High Workload')}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-sf-muted">
                                                            <span className="font-semibold text-amber-600 dark:text-amber-400">
                                                                {t('dashboard.manager.tasksPending', '{count} pending', { count: tItem.pending })}
                                                            </span>
                                                            <span>•</span>
                                                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                                                {t('dashboard.manager.tasksDone', '{count} done', { count: tItem.completed })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <div className="text-base font-black text-sf-text">
                                                        {tItem.assigned}
                                                    </div>
                                                    <div className="text-[10px] text-sf-muted uppercase font-medium">
                                                        {t('dashboard.units.tasks', 'tasks')}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-xs text-sf-muted border border-dashed border-sf-divider rounded-xl">
                                    {t('dashboard.manager.noTechnicians', 'No active bench technicians registered in this laboratory.')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Task List Continuation Banner ── */}
            <div className="p-4 sm:p-5 rounded-xl border border-sf-divider bg-sf-surface shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-sf-text">
                            {t('dashboard.manager.actionCenterTitle', 'Manager Operational Task List')}
                        </h3>
                        <p className="text-xs text-sf-muted mt-0.5">
                            {t('dashboard.manager.takeActionBanner', 'Need to execute assignments, reviews, approvals, or QC decisions?')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {onSwitchToQueue && (
                        <button
                            type="button"
                            onClick={onSwitchToQueue}
                            className="px-3 py-2 rounded-lg text-xs font-bold border border-sf-divider bg-sf-inset text-sf-text hover:bg-sf-hover transition-colors shadow-sm"
                        >
                            {t('dashboard.manager.viewPendingQueueHere', 'View Queue Items Here')}
                        </button>
                    )}
                    <Link
                        to="/manager-queue"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-sf-primary text-sf-on-primary hover:brightness-95 transition-all shadow-sm"
                    >
                        <span>{t('dashboard.manager.openTaskList', 'Open Manager Task List')}</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </div>
        </section>
    );
}
