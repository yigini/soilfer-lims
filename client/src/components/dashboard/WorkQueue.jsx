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

        let badgeClass = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
        if (s.includes('ready') || s.includes('accepted') || s.includes('passed') || s.includes('done') || s.includes('published') || s.includes('operational')) {
            badgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
        } else if (s.includes('fail') || s.includes('problem') || s.includes('rejected') || s.includes('conflict') || s.includes('missing') || s.includes('unconfigured')) {
            badgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800';
        } else if (s.includes('wait') || s.includes('pending') || s.includes('review') || s.includes('hold') || s.includes('progress') || s.includes('unassigned') || s.includes('required')) {
            badgeClass = 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800';
        }

        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${badgeClass}`}>
                {status}
            </span>
        );
    };

    return (
        <section aria-label="Work queue panel" className="bg-white dark:bg-gray-800/80 rounded-xl border border-gray-200 dark:border-gray-700/80 shadow-sm overflow-hidden flex flex-col">
            {/* Queue Header & Search */}
            <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        {title || 'Current Work Queue'}
                    </h2>
                    {subtitle && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {hasSideRail && onToggleSideRail && (
                        <button
                            type="button"
                            onClick={onToggleSideRail}
                            className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap shadow-sm"
                            title={sideRailCollapsed ? "Show side notes panel" : "Expand table to full width"}
                        >
                            <PanelRightClose className={`w-3.5 h-3.5 transition-transform ${sideRailCollapsed ? 'rotate-180 text-emerald-600' : 'text-gray-400'}`} />
                            <span>{sideRailCollapsed ? "Show Notes" : "Full Width"}</span>
                        </button>
                    )}
                    <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter this queue…"
                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                </div>
            </div>

            {/* Queue Selector Lanes / Tabs */}
            {availableQueues && availableQueues.length > 1 && (
                <div className="px-4 sm:px-5 py-2.5 bg-gray-50/70 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700/60 flex flex-wrap items-center gap-2">
                    {availableQueues.map((q) => {
                        const isSelected = q.key === queueKey;
                        return (
                            <button
                                key={q.key}
                                type="button"
                                onClick={() => onSelectQueue && onSelectQueue(q.key)}
                                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                                    isSelected
                                        ? 'bg-emerald-700 text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-gray-700/60'
                                }`}
                            >
                                <span>{q.label}</span>
                                {q.count !== undefined && (
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                        isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
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
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 dark:text-emerald-400 mb-2" />
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
                                <tr className="border-b border-gray-200 dark:border-gray-700/80 text-gray-500 dark:text-gray-400 font-semibold">
                                    <th className="pb-3 pr-4">Work / Item</th>
                                    <th className="pb-3 px-3">State</th>
                                    <th className="pb-3 px-3 text-right">Count</th>
                                    <th className="pb-3 pl-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {filteredRows.map((row) => (
                                    <tr
                                        key={row.key || row.id}
                                        className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors group"
                                    >
                                        <td className="py-3 pr-4">
                                            <div className="font-semibold text-gray-900 dark:text-white text-sm">
                                                {row.title}
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                                                {row.key && (
                                                    <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                                        {row.key}
                                                    </span>
                                                )}
                                                {row.context && (
                                                    <span className="font-medium text-gray-600 dark:text-gray-300">
                                                        {row.context}
                                                    </span>
                                                )}
                                            </div>
                                            {row.note && (
                                                <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 italic line-clamp-2">
                                                    {row.note}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 whitespace-nowrap">
                                            {getStatusBadge(row.status)}
                                        </td>
                                        <td className="py-3 px-3 text-right whitespace-nowrap">
                                            <span className="font-bold text-gray-900 dark:text-white text-sm">
                                                {row.count !== undefined ? row.count : 1}
                                            </span>
                                            {row.unit && (
                                                <span className="text-gray-500 dark:text-gray-400 ml-1 text-xs">
                                                    {row.unit}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                                            {row.route ? (
                                                <Link
                                                    to={row.route}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 transition-colors shadow-sm"
                                                >
                                                    <span>{row.action || 'Open'}</span>
                                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                                </Link>
                                            ) : (
                                                <span className="text-gray-400 text-xs italic">
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
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-4">
                    <div>
                        Showing <span className="font-semibold text-gray-700 dark:text-gray-300">{filteredRows.length}</span> of{' '}
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{total || filteredRows.length}</span> items
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => onPageChange && onPageChange(page - 1)}
                            disabled={page <= 1 || isLoading}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
