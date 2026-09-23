import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
    Search, SlidersHorizontal, X,
    CalendarClock, Inbox, CheckCircle2, Clock, PackageCheck, Archive, AlertTriangle,
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
    { id: 'rejected', label: 'Rejected', param: 'status', value: 'RECEIVED_REJECTED', icon: AlertTriangle, color: 'text-rose-600', activeColor: 'text-white', activeBg: 'bg-rose-600', facetKey: 'REJECTED' },
];

const SamplesFilterBar = ({
    search, onSearchChange,
    activeFilters, onToggleQuickFilter,
    onOpenAdvanced, onReset,
    totalResults, facets,
    page, pages, onPageChange,
    view = 'daily', onViewChange, views: propViews
}) => {
    const { t } = useLanguage();
    const [localSearch, setLocalSearch] = useState(search);
    const [animatingId, setAnimatingId] = useState(null);

    const views = propViews || facets?.views || {};

    // Synchronize local search input when external search prop updates (navigation, reset)
    useEffect(() => {
        setLocalSearch(search || '');
    }, [search]);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (localSearch !== search) onSearchChange(localSearch);
        }, 300);
        return () => clearTimeout(handler);
    }, [localSearch, search, onSearchChange]);

    const handleViewClick = (newView) => {
        if (localSearch !== search) {
            onSearchChange(localSearch);
        }
        onViewChange?.(newView);
    };

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
        <div className="sticky top-0 z-20 bg-sf-surface/95 backdrop-blur-md border-b border-sf-divider py-3 mb-4 shadow-sm px-4">
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">

                {/* Operational Views Navigation (#120) */}
                <div className="flex bg-sf-canvas p-1 rounded-xl border border-sf-divider gap-1 shrink-0 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => handleViewClick('daily')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            view === 'daily'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-sf-muted hover:text-sf-text hover:bg-sf-raised'
                        }`}
                        title={t('samplesSection.views.dailyTooltip', 'Physically received & active laboratory samples')}
                    >
                        <span>{t('samplesSection.views.daily', 'Active Lab Work')}</span>
                        {views.daily !== undefined && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black tabular-nums leading-none ${
                                view === 'daily' ? 'bg-emerald-700 text-white' : 'bg-sf-surface text-sf-muted border border-sf-divider'
                            }`}>
                                {views.daily}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleViewClick('expected')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            view === 'expected'
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-sf-muted hover:text-sf-text hover:bg-sf-raised'
                        }`}
                        title={t('samplesSection.views.expectedTooltip', 'Registered field samples awaiting physical arrival')}
                    >
                        <span>{t('samplesSection.views.expected', 'Expected Arrivals')}</span>
                        {views.expected !== undefined && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black tabular-nums leading-none ${
                                view === 'expected' ? 'bg-indigo-700 text-white' : 'bg-sf-surface text-sf-muted border border-sf-divider'
                            }`}>
                                {views.expected}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleViewClick('registry')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                            view === 'registry'
                                ? 'bg-slate-700 text-white shadow-sm'
                                : 'text-sf-muted hover:text-sf-text hover:bg-sf-raised'
                        }`}
                        title={t('samplesSection.views.registryTooltip', 'Full field registry across all lifecycle stages')}
                    >
                        <span>{t('samplesSection.views.registry', 'Field Registry')}</span>
                        {views.registry !== undefined && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black tabular-nums leading-none ${
                                view === 'registry' ? 'bg-slate-800 text-white' : 'bg-sf-surface text-sf-muted border border-sf-divider'
                            }`}>
                                {views.registry}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex flex-1 items-center gap-3 w-full lg:w-auto">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sf-muted" size={16} />
                        <input
                            type="text"
                            value={localSearch}
                            onChange={(e) => setLocalSearch(e.target.value)}
                            placeholder={t('samplesSection.filterBar.searchPlaceholder', 'Search by Lab ID or Original ID...')}
                            className="w-full pl-9 pr-4 py-2 rounded-xl border border-sf-divider bg-sf-canvas text-sf-text text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm font-medium"
                        />
                        {localSearch && (
                            <button
                                onClick={() => {
                                    setLocalSearch('');
                                    onSearchChange('');
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-sf-muted hover:text-sf-text"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Quick Filters */}
                    <div className="flex gap-1.5 items-center">
                        <div className="flex gap-1 items-center p-1 bg-sf-canvas rounded-xl border border-sf-divider">
                            {QUICK_FILTERS.map(qf => {
                                const active = isFilterActive(qf);
                                const Icon = qf.icon;
                                const count = lifecycle[qf.facetKey] || 0;
                                const isAnimating = animatingId === qf.id;

                                return (
                                    <div key={qf.id} className="group relative">
                                        <button
                                            data-testid={`qf-${qf.id}`}
                                            onClick={() => handleFilterClick(qf)}
                                            className={`
                                                relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg 
                                                transition-all duration-200 ease-out font-semibold text-xs
                                                ${isAnimating ? 'animate-pulse' : ''}
                                                ${active
                                                    ? `${qf.activeBg} ${qf.activeColor} shadow-lg shadow-current/20`
                                                    : `text-sf-muted hover:text-sf-text hover:bg-sf-raised`
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
                                                        : 'text-sf-muted'
                                                    }
                                                `}>
                                                    {count}
                                                </span>
                                            )}
                                        </button>

                                        {/* Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-sf-raised text-sf-text text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-all duration-200 transform translate-y-1 group-hover:translate-y-0 whitespace-nowrap shadow-2xl border border-sf-divider">
                                            {active ? `✓ ${qf.label}` : qf.label}{count > 0 ? ` (${count})` : ''}
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-sf-raised"></div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Clear All active filters */}
                            {hasActiveFilters && (
                                <button
                                    data-testid="clear-all-filters"
                                    onClick={() => {
                                        setLocalSearch('');
                                        onReset();
                                    }}
                                    className="ml-0.5 p-1.5 text-sf-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                                    title={t('samplesSection.filterBar.clearAll', 'Clear all filters')}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Advanced & Pagination */}
                <div className="flex items-center gap-4 shrink-0">
                    <div className="h-6 w-px bg-sf-divider hidden md:block"></div>
                    <button
                        onClick={onOpenAdvanced}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-sf-text hover:bg-sf-canvas rounded-lg transition-colors whitespace-nowrap"
                    >
                        <SlidersHorizontal size={16} />
                        <span>{t('samplesSection.filterBar.filters', 'Filters')}</span>
                    </button>

                    {/* Top Pagination */}
                    <div className="flex items-center gap-1 bg-sf-canvas rounded-lg p-0.5 border border-sf-divider">
                        <button
                            onClick={() => onPageChange(page - 1)}
                            disabled={page === 1}
                            className="p-1 rounded-md text-sf-muted hover:text-sf-text hover:bg-sf-surface disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span className="text-[10px] font-black text-sf-muted min-w-[30px] text-center select-none">
                            {page} / {pages || 1}
                        </span>
                        <button
                            onClick={() => onPageChange(page + 1)}
                            disabled={page === pages}
                            className="p-1 rounded-md text-sf-muted hover:text-sf-text hover:bg-sf-surface disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    <div className="hidden lg:block px-3 py-1 bg-sf-canvas rounded-lg text-[11px] text-sf-muted font-black uppercase tracking-widest border border-sf-divider whitespace-nowrap">
                        {t('samplesSection.filterBar.matches', `${totalResults} matches`, { count: totalResults })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SamplesFilterBar;
