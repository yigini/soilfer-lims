import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, ExternalLink } from 'lucide-react';
import QueueSummary from './QueueSummary';
import WorkQueue from './WorkQueue';
import ScopeSelector from './ScopeSelector';
import UpdateStatus from './UpdateStatus';

/**
 * DashboardShell
 * Composes the redesigned all-role dashboard layout:
 * Header, Status Line, Metric Summaries, Work Queue Panel, and Side Rail.
 */
export default function DashboardShell({
    role = '',
    eyebrow = '',
    title = '',
    subtitle = '',
    primaryAction = null, // { label, route, icon: Icon }
    statusDate = '',
    freshnessStatus = 'idle',
    lastUpdated = null,
    onRefresh,
    isRefreshing = false,
    scope = {},
    labs = [],
    projects = [],
    selectedLabId = '',
    selectedProjectId = '',
    onSelectLab,
    onSelectProject,
    metrics = [],
    activeQueue = '',
    onSelectQueue,
    queueTitle = '',
    queueSubtitle = '',
    availableQueues = [],
    queueRows = [],
    queueTotal = 0,
    queuePage = 1,
    queuePageSize = 10,
    queueHasMore = false,
    onQueuePageChange,
    isQueueLoading = false,
    queueError = null,
    onRetryQueue,
    shiftNotes = null, // { title, items: [] }
    shortcuts = [] // [{ label, route, description }]
}) {
    const hasSideContent = Boolean((shiftNotes && (shiftNotes.items?.length || shiftNotes.content)) || (shortcuts && shortcuts.length > 0));
    const [sideRailCollapsed, setSideRailCollapsed] = React.useState(() => {
        try {
            return localStorage.getItem('dashboard-siderail-collapsed') === 'true';
        } catch {
            return false;
        }
    });

    const toggleSideRail = () => {
        setSideRailCollapsed(prev => {
            const next = !prev;
            try { localStorage.setItem('dashboard-siderail-collapsed', String(next)); } catch {}
            return next;
        });
    };

    return (
        <div className="space-y-6 max-w-full 2xl:max-w-[1650px] mx-auto">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-gray-200 dark:border-gray-800">
                <div>
                    {eyebrow && (
                        <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
                            {eyebrow}
                        </div>
                    )}
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
                            {subtitle}
                        </p>
                    )}
                </div>

                {primaryAction && primaryAction.route && (
                    <div className="flex-shrink-0">
                        <Link
                            to={primaryAction.route}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                        >
                            <span>{primaryAction.label}</span>
                            <ArrowUpRight className="w-4 h-4" />
                        </Link>
                    </div>
                )}
            </header>

            {/* Status & Scope Control Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl border border-gray-200/80 dark:border-gray-700/60">
                <ScopeSelector
                    scope={scope}
                    userRole={role}
                    labs={labs}
                    projects={projects}
                    selectedLabId={selectedLabId}
                    selectedProjectId={selectedProjectId}
                    onSelectLab={onSelectLab}
                    onSelectProject={onSelectProject}
                />

                <div className="flex items-center justify-between sm:justify-end gap-4">
                    {statusDate && (
                        <span className="text-gray-500 dark:text-gray-400 font-medium">
                            {statusDate}
                        </span>
                    )}

                    <UpdateStatus
                        status={freshnessStatus}
                        lastUpdated={lastUpdated}
                        onRefresh={onRefresh}
                        isRefreshing={isRefreshing}
                    />
                </div>
            </div>

            {/* Metric Summaries Deck */}
            <QueueSummary
                metrics={metrics}
                activeQueue={activeQueue}
                onSelectQueue={onSelectQueue}
            />

            {/* Main Content Grid (Queue Panel + Side Rail) */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Main Queue Column */}
                <div className={hasSideContent && !sideRailCollapsed ? "xl:col-span-8 2xl:col-span-9 col-span-12" : "col-span-12"}>
                    <WorkQueue
                        queueKey={activeQueue}
                        title={queueTitle}
                        subtitle={queueSubtitle}
                        availableQueues={availableQueues}
                        onSelectQueue={onSelectQueue}
                        rows={queueRows}
                        total={queueTotal}
                        page={queuePage}
                        pageSize={queuePageSize}
                        hasMore={queueHasMore}
                        onPageChange={onQueuePageChange}
                        isLoading={isQueueLoading}
                        error={queueError}
                        onRetry={onRetryQueue}
                        sideRailCollapsed={sideRailCollapsed}
                        onToggleSideRail={toggleSideRail}
                        hasSideRail={hasSideContent}
                    />
                </div>

                {/* Side Rail */}
                {hasSideContent && !sideRailCollapsed && (
                    <aside className="xl:col-span-4 2xl:col-span-3 col-span-12 space-y-6">
                    {/* Shift Notes / Operational Guidance */}
                    {shiftNotes && (
                        <section className="bg-white dark:bg-gray-800/80 p-5 rounded-xl border border-gray-200 dark:border-gray-700/80 shadow-sm">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Shift Notes</span>
                            </div>
                            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                                {shiftNotes.title || 'Role Responsibilities'}
                            </h2>
                            <div className="text-xs text-gray-600 dark:text-gray-300 space-y-2 leading-relaxed">
                                {Array.isArray(shiftNotes.items) ? (
                                    <ul className="list-disc pl-4 space-y-1.5">
                                        {shiftNotes.items.map((item, idx) => (
                                            <li key={idx}>{item}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>{shiftNotes.content}</p>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Shortcuts / Continue Elsewhere */}
                    {shortcuts && shortcuts.length > 0 && (
                        <section className="bg-white dark:bg-gray-800/80 p-5 rounded-xl border border-gray-200 dark:border-gray-700/80 shadow-sm">
                            <div className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                                Continue elsewhere
                            </div>
                            <div className="space-y-2">
                                {shortcuts.map((sc, idx) => (
                                    <Link
                                        key={idx}
                                        to={sc.route}
                                        className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 dark:border-gray-700/60 hover:border-emerald-200 dark:hover:border-emerald-800 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all group"
                                    >
                                        <div>
                                            <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                                {sc.label}
                                            </div>
                                            {sc.description && (
                                                <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                                                    {sc.description}
                                                </div>
                                            )}
                                        </div>
                                        <ArrowUpRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}
                </aside>
            )}
            </div>

            {/* Product Footer Guarantee */}
            <footer className="pt-6 border-t border-gray-200 dark:border-gray-800 text-center text-xs text-gray-400 dark:text-gray-500 font-sans">
                The source record is checked again when you open or act on work.
            </footer>
        </div>
    );
}
