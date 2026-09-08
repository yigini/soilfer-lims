import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, ArrowUpRight, Loader2, PanelRightClose } from 'lucide-react';
import EmptyState from './EmptyState';

/**
 * WorkQueue
 * Displays the active queue table, search filter, lane switcher, and direct continuation actions.
 */
export default function WorkQueue({
    queueKey = '',
    title = '',
    subtitle = '',
    availableQueues = [], // [{ key, label, count }]
    onSelectQueue,
    rows = [],
    total = 0,
    page = 1,
    pageSize = 10,
    hasMore = false,
    onPageChange,
    isLoading = false,
    error = null,
    onRetry,
    sideRailCollapsed = false,
    onToggleSideRail = null,
    hasSideRail = false
}) {
    const [searchQuery, setSearchQuery] = useState('');

    // Filter rows client-side if loaded, or search can pass through
    const filteredRows = searchQuery.trim()
        ? rows.filter(r => {
            const query = searchQuery.toLowerCase();
            return (
                (r.title && r.title.toLowerCase().includes(query)) ||
                (r.key && String(r.key).toLowerCase().includes(query)) ||
                (r.context && r.context.toLowerCase().includes(query)) ||
                (r.status && r.status.toLowerCase().includes(query))
            );
        })
        : rows;

    const getStatusBadge = (status) => {
        if (!status) return null;
        const s = status.toLowerCase();

        let badgeClass = 'bg-sf-inset text-sf-muted border-sf-divider';
        if (s.includes('ready') || s.includes('accepted') || s.includes('passed') || s.includes('done') || s.includes('published') || s.includes('operational')) {
            badgeClass = 'bg-[var(--sf-success-bg)] text-[var(--sf-success)] border-[var(--sf-success)]/20';
        } else if (s.includes('fail') || s.includes('problem') || s.includes('rejected') || s.includes('conflict') || s.includes('missing') || s.includes('unconfigured')) {
            badgeClass = 'bg-[var(--sf-danger-bg)] text-[var(--sf-danger)] border-[var(--sf-danger)]/20';
        } else if (s.includes('wait') || s.includes('pending') || s.includes('review') || s.includes('hold') || s.includes('progress') || s.includes('unassigned') || s.includes('required')) {
            badgeClass = 'bg-[var(--sf-warning-bg)] text-[var(--sf-warning)] border-[var(--sf-warning)]/20';
        }

        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${badgeClass}`}>
                {status}
            </span>
        );
    };

    return (
        <section aria-label="Work queue panel" className="bg-sf-surface rounded-xl border border-sf-divider shadow-sm overflow-hidden flex flex-col">
            {/* Queue Header & Search */}
            <div className="p-4 sm:p-5 border-b border-sf-divider flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-sf-text">
                        {title || 'Current Work Queue'}
                    </h2>
                    {subtitle && (
                        <p className="text-xs text-sf-muted mt-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {hasSideRail && onToggleSideRail && (
                        <button
                            type="button"
                            onClick={onToggleSideRail}
                            className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-sf-divider bg-sf-inset text-sf-muted hover:bg-sf-hover transition-colors whitespace-nowrap shadow-sm"
                            title={sideRailCollapsed ? "Show side notes panel" : "Expand table to full width"}
                        >
                            <PanelRightClose className={`w-3.5 h-3.5 transition-transform ${sideRailCollapsed ? 'rotate-180 text-sf-primary' : 'text-sf-muted'}`} />
                            <span>{sideRailCollapsed ? "Show Notes" : "Full Width"}</span>
                        </button>
                    )}
                    <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 text-sf-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter this queue…"
                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-sf-surface border border-sf-control rounded-lg text-sf-text placeholder:text-sf-muted focus:outline-none focus:border-sf-primary focus:ring-1 focus:ring-sf-primary"
                        />
                    </div>
                </div>
            </div>

            {/* Queue Selector Lanes / Tabs */}
            {availableQueues && availableQueues.length > 1 && (
                <div className="px-4 sm:px-5 py-2.5 bg-sf-inset border-b border-sf-divider flex flex-wrap items-center gap-2">
                    {availableQueues.map((q) => {
                        const isSelected = q.key === queueKey;
                        return (
                            <button
                                key={q.key}
                                type="button"
                                onClick={() => onSelectQueue && onSelectQueue(q.key)}
                                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                                    isSelected
                                        ? 'bg-sf-primary text-sf-on-primary font-semibold shadow-sm'
                                        : 'text-sf-muted hover:bg-sf-hover'
                                }`}
                            >
                                <span>{q.label}</span>
                                {q.count !== undefined && (
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                        isSelected ? 'bg-black/20 text-white' : 'bg-sf-surface border border-sf-divider text-sf-muted'
                                    }`}>
                                        {q.count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 p-4 sm:p-5 min-h-[300px] flex flex-col justify-between">
                {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-sf-muted">
                        <Loader2 className="w-8 h-8 animate-spin text-sf-primary mb-2" />
                        <span className="text-xs font-medium">Loading queue items…</span>
                    </div>
                ) : error ? (
                    <EmptyState
                        type="error"
                        title="Failed to load queue"
                        message={error.message || 'Records could not be loaded.'}
                        onRetry={onRetry}
                    />
                ) : filteredRows.length === 0 ? (
                    searchQuery.trim() ? (
                        <EmptyState
                            type="search"
                            searchTerm={searchQuery}
                            onClearSearch={() => setSearchQuery('')}
                        />
                    ) : (
                        <EmptyState
                            type="zero"
                            title="Queue is clear"
                            message="No pending items waiting in this view."
                        />
                    )
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-sf-divider/80 text-sf-muted font-semibold">
                                    <th className="pb-3 pr-4">Work / Item</th>
                                    <th className="pb-3 px-3">State</th>
                                    <th className="pb-3 px-3 text-right">Count</th>
                                    <th className="pb-3 pl-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sf-divider">
                                {filteredRows.map((row) => (
                                    <tr
                                        key={row.key || row.id}
                                        className="hover:bg-sf-hover transition-colors group"
                                    >
                                        <td className="py-3 pr-4">
                                            <div className="font-semibold text-sf-text text-sm">
                                                {row.title}
                                            </div>
                                            <div className="text-xs text-sf-muted mt-0.5 flex items-center gap-2 flex-wrap">
                                                {row.key && (
                                                    <span className="text-[11px] font-mono text-sf-muted bg-sf-raised px-1.5 py-0.5 rounded">
                                                        {row.key}
                                                    </span>
                                                )}
                                                {row.context && (
                                                    <span className="font-medium text-sf-muted">
                                                        {row.context}
                                                    </span>
                                                )}
                                            </div>
                                            {row.note && (
                                                <div className="text-[11px] text-sf-muted mt-1 italic line-clamp-2">
                                                    {row.note}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 whitespace-nowrap">
                                            {getStatusBadge(row.status)}
                                        </td>
                                        <td className="py-3 px-3 text-right whitespace-nowrap">
                                            <span className="font-bold text-sf-text text-sm">
                                                {row.count !== undefined ? row.count : 1}
                                            </span>
                                            {row.unit && (
                                                <span className="text-sf-muted ml-1 text-xs">
                                                    {row.unit}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                                            {row.route ? (
                                                <Link
                                                    to={row.route}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-sf-primary bg-[var(--sf-selected)] hover:bg-sf-hover border border-sf-divider transition-colors shadow-sm"
                                                >
                                                    <span>{row.action || 'Open'}</span>
                                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                                </Link>
                                            ) : (
                                                <span className="text-sf-muted text-xs italic">
                                                    View only
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                <div className="pt-4 border-t border-sf-divider flex items-center justify-between text-xs text-sf-muted mt-4">
                    <div>
                        Showing <span className="font-semibold text-sf-muted">{filteredRows.length}</span> of{' '}
                        <span className="font-semibold text-sf-muted">{total || filteredRows.length}</span> items
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onPageChange && onPageChange(page - 1)}
                            disabled={page <= 1 || isLoading}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-sf-divider bg-sf-surface text-sf-muted hover:bg-sf-raised disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Previous</span>
                        </button>

                        <span className="px-2 font-medium">Page {page}</span>

                        <button
                            type="button"
                            onClick={() => onPageChange && onPageChange(page + 1)}
                            disabled={!hasMore || isLoading}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-sf-divider bg-sf-surface text-sf-muted hover:bg-sf-raised disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            aria-label="Next page"
                        >
                            <span>Next</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
