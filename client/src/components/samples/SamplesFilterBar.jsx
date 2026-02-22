import React, { useState, useEffect } from 'react';
import {
    Search, SlidersHorizontal, X,
    CalendarClock, Inbox, CheckCircle2, Clock, PackageCheck, Archive,
    ChevronLeft, ChevronRight
} from 'lucide-react';

// Quick filters aligned with backend-supported status filters + lifecycle facets
const QUICK_FILTERS = [
    { id: 'expected', label: 'Expected', param: 'status', value: 'EXPECTED', icon: CalendarClock, color: 'text-gray-600', activeColor: 'text-white', activeBg: 'bg-gray-600', facetKey: 'EXPECTED' },
    { id: 'intake', label: 'Intake Queue', param: 'status', value: 'RECEIVED,COLLECTED', icon: Inbox, color: 'text-indigo-600', activeColor: 'text-white', activeBg: 'bg-indigo-600', facetKey: 'RECEIVED' },
    { id: 'accepted', label: 'Accepted', param: 'status', value: 'ACCEPTED', icon: CheckCircle2, color: 'text-emerald-600', activeColor: 'text-white', activeBg: 'bg-emerald-600', facetKey: 'ACCEPTED' },
    { id: 'processing', label: 'In Progress', param: 'status', value: 'PROCESSING,SUBMITTED_PARTIAL', icon: Clock, color: 'text-amber-600', activeColor: 'text-white', activeBg: 'bg-amber-600', facetKey: 'ONGOING' },
    { id: 'completed', label: 'Completed', param: 'status', value: 'SUBMITTED_FULL,APPROVED', icon: PackageCheck, color: 'text-blue-600', activeColor: 'text-white', activeBg: 'bg-blue-600', facetKey: 'COMPLETED' },
    { id: 'archived', label: 'Archived', param: 'status', value: 'ARCHIVED,DISPOSED', icon: Archive, color: 'text-purple-600', activeColor: 'text-white', activeBg: 'bg-purple-600', facetKey: 'HISTORY' },
];

const SamplesFilterBar = ({
    search, onSearchChange,
    activeFilters, onToggleQuickFilter,
    onOpenAdvanced, onReset,
    totalResults, facets,
    page, pages, onPageChange
}) => {
    const [localSearch, setLocalSearch] = useState(search);
    const [animatingId, setAnimatingId] = useState(null);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (localSearch !== search) onSearchChange(localSearch);
        }, 300);
        return () => clearTimeout(handler);
    }, [localSearch, search, onSearchChange]);

    const isFilterActive = (qf) => {
        const current = activeFilters[qf.param];
        if (!current) return false;

        const currentList = current.split(',').map(v => v.trim());
        const incomingList = String(qf.value).split(',').map(v => v.trim());
        return incomingList.every(v => currentList.includes(v));
    };

    const handleFilterClick = (qf) => {
        setAnimatingId(qf.id);
        setTimeout(() => setAnimatingId(null), 400);
        onToggleQuickFilter(qf.param, qf.value);
    };

    // Get lifecycle counts from facets
    const lifecycle = facets?.lifecycle || {};
    const hasActiveFilters = Object.keys(activeFilters).some(k => activeFilters[k]);

    return (
        <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 py-3 mb-4 shadow-sm px-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">

                <div className="flex flex-1 items-center gap-4 w-full md:w-auto">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                            placeholder="Search by Lab ID or Original ID..."
                            className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm font-medium"
                        />
                        {localSearch && (
                            <button
                                onClick={() => setLocalSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Quick Filters */}
                    <div className="flex gap-1.5 items-center">
                        <div className="flex gap-1 items-center p-1 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200/80 dark:border-gray-700/50">
                            {QUICK_FILTERS.map(qf => {
                                const active = isFilterActive(qf);
                                const Icon = qf.icon;
                                const count = lifecycle[qf.facetKey] || 0;
                                const isAnimating = animatingId === qf.id;

                                return (
                                    <div key={qf.id} className="group relative">
                                        <button
                                            onClick={() => handleFilterClick(qf)}
                                            className={`
                                                relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg 
                                                transition-all duration-200 ease-out font-semibold text-xs
                                                ${isAnimating ? 'animate-pulse' : ''}
                                                ${active
                                                    ? `${qf.activeBg} ${qf.activeColor} shadow-lg shadow-current/20`
                                                    : `text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700`
                                                }
                                            `}
                                        >
                                            <Icon size={16} className={`transition-transform duration-200 ${isAnimating ? 'scale-125' : ''}`} />
                                            {count > 0 && (
                                                <span className={`
                                                    text-[10px] font-black tabular-nums leading-none
                                                    transition-all duration-300
                                                    ${active
                                                        ? 'text-white/90'
                                                        : 'text-gray-400'
                                                    }
                                                `}>
                                                    {count}
                                                </span>
                                            )}
                                        </button>

                                        {/* Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-gray-900 dark:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 whitespace-nowrap shadow-2xl border border-white/10">
                                            {active ? `✓ ${qf.label}` : qf.label}{count > 0 ? ` (${count})` : ''}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900 dark:border-t-black"></div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Clear All active filters */}
                            {hasActiveFilters && (
                                <button
                                    onClick={onReset}
                                    className="ml-0.5 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                                    title="Clear all filters"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Advanced & Pagination */}
                <div className="flex items-center gap-4 shrink-0">
                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden md:block"></div>
                    <button
                        onClick={onOpenAdvanced}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors whitespace-nowrap"
                    >
                        <SlidersHorizontal size={16} />
                        <span>Filters</span>
                    </button>

                    {/* Top Pagination */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 border border-gray-200 dark:border-gray-700">
                        <button
                            onClick={() => onPageChange(page - 1)}
                            disabled={page === 1}
                            className="p-1 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-white dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className="text-[10px] font-black text-gray-500 min-w-[30px] text-center select-none">
                            {page} / {pages || 1}
                        </span>
                        <button
                            onClick={() => onPageChange(page + 1)}
                            disabled={page === pages}
                            className="p-1 rounded-md text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-white dark:hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    <div className="hidden lg:block px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[11px] text-gray-400 font-black uppercase tracking-widest border border-gray-200 dark:border-gray-700 whitespace-nowrap">
                        {totalResults} matches
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SamplesFilterBar;
