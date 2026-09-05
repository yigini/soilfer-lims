import React from 'react';
import { ArrowLeft, RefreshCw, Activity, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * WorkflowHeader
 * Breadcrumb, identity, isolated denominators (prep vs tests vs reviews),
 * next eligible action banner, view switcher, and quiet freshness indicator.
 */
export default function WorkflowHeader({
    sample,
    mapState,
    activeView,
    onViewChange,
    onInspectNext,
    lastUpdated,
    refreshing,
    onRefresh
}) {
    const navigate = useNavigate();

    const sampleId = sample?.originalId || sample?.id || '—';
    const projectCode = sample?.projectCode || '—';
    const sampleType = sample?.sampleType || 'Soil Sample';
    const lifecycle = mapState?.lifecycle || sample?.status || 'ACCEPTED';

    const counters = mapState?.counters || {
        prep: { done: 0, total: 0 },
        tests: { done: 0, total: 0 },
        reviews: { cleared: 0, total: 0 },
        tasksCompleted: '—',
        resultsCleared: '—'
    };

    const nextAction = mapState?.nextEligibleAction || {
        title: mapState?.nextActions?.[0]?.action || 'Workflow in progress',
        action: 'Inspect work',
        assignee: mapState?.owner || 'Assigned operator',
        reason: 'Action derived from active work item state'
    };

    const formatFreshness = () => {
        if (!lastUpdated) return 'Syncing...';
        const diffMs = Date.now() - new Date(lastUpdated).getTime();
        if (diffMs < 30000) return 'Updated just now';
        const mins = Math.floor(diffMs / 60000);
        return `Updated ${mins}m ago`;
    };

    return (
        <header className="sf-header-root">
            {/* Top Bar / Breadcrumb */}
            <div className="sf-top">
                <div className="sf-crumb">
                    <button
                        type="button"
                        onClick={() => navigate('/samples')}
                        className="inline-flex items-center gap-1.5 hover:text-emerald-600 transition-colors"
                        title="Back to Samples"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Samples</span>
                    </button>
                    <span>›</span>
                    <button
                        type="button"
                        onClick={() => navigate(`/samples/${sample?.id}`)}
                        className="hover:text-emerald-600 transition-colors font-medium text-slate-800 dark:text-slate-200"
                    >
                        {sampleId}
                    </button>
                    <span>›</span>
                    <span>Workflow</span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="sf-asof">{formatFreshness()}</span>
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={refreshing}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-50"
                        title="Refresh workflow state"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Main Heading & Reconciled Facts */}
            <div className="sf-heading">
                <div>
                    <h2>
                        {sampleId} <span style={{ color: 'var(--sf-muted)' }}>/</span> Workflow
                    </h2>
                    <div className="sf-subtitle">
                        <span className="font-semibold">{projectCode}</span>
                        <span>{sampleType}</span>
                        <span className="sf-pill sf-active">
                            Lifecycle: {lifecycle}
                        </span>
                    </div>
                </div>

                <div className="sf-facts">
                    <span>
                        <b>{counters.tasksCompleted}</b> tasks completed
                    </span>
                    <span>
                        <b>{counters.resultsCleared}</b> results accepted / waived
                    </span>
                </div>
            </div>

            {/* Next Eligible Action Banner */}
            {nextAction && (
                <div className="sf-next">
                    <Activity className="w-4 h-4 flex-shrink-0" />
                    <strong>{nextAction.title}</strong>
                    <span>Assigned to {nextAction.assignee || 'operator'}</span>
                    <button type="button" onClick={onInspectNext}>
                        Inspect next work →
                    </button>
                </div>
            )}

            {/* 3-View Switcher Toolbar */}
            <div className="sf-toolbar">
                <div className="sf-views" role="tablist" aria-label="Workflow view switcher">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeView === 'overview'}
                        aria-pressed={activeView === 'overview'}
                        onClick={() => onViewChange('overview')}
                    >
                        Overview
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeView === 'dependencies'}
                        aria-pressed={activeView === 'dependencies'}
                        onClick={() => onViewChange('dependencies')}
                    >
                        Dependencies
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeView === 'list'}
                        aria-pressed={activeView === 'list'}
                        onClick={() => onViewChange('list')}
                    >
                        Analysis list
                    </button>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400">
                    {activeView === 'overview' && 'Only relevant stations · Parallel branches aggregated'}
                    {activeView === 'dependencies' && 'Parallel tests remain parallel · Prerequisites vs handoffs'}
                    {activeView === 'list' && 'Complete assigned tasks · Sortable by status and owner'}
                </div>
            </div>
        </header>
    );
}
