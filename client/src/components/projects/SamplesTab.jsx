import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ExternalLink, Calendar, Beaker, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function SamplesTab({
    project,
    samples = [],
    selectedStage = 'all',
    onSelectStage,
    searchQuery = '',
    onSearchChange,
    onClearFilters,
    counts,
    capabilities = {},
    page = 1,
    limit = 50,
    totalCount = 0,
    onPageChange,
    onLimitChange,
    loading = false,
    error = null,
    onRetry
}) {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [inputValue, setInputValue] = useState(searchQuery || '');

    useEffect(() => {
        setInputValue(searchQuery || '');
    }, [searchQuery]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (inputValue !== (searchQuery || '')) {
                onSearchChange?.(inputValue);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [inputValue, searchQuery, onSearchChange]);

    const stageLabels = [
        t('projects.stages.awaitingArrival', 'Awaiting arrival'),
        t('projects.stages.intakeInProgress', 'Intake in progress'),
        t('projects.stages.labWork', 'Lab work'),
        t('projects.stages.awaitingReview', 'Awaiting review'),
        t('projects.stages.released', 'Released'),
        t('projects.stages.rejectedOrCancelled', 'Rejected / cancelled')
    ];

    const getSampleStageIndex = (sample) => {
        const st = (sample.status || '').toUpperCase();
        if (['RECEIVED_REJECTED', 'REJECTED', 'CANCELLED', 'DISPOSED', 'FAILED'].includes(st)) return 5;
        if (['RELEASED', 'APPROVED', 'ARCHIVED'].includes(st)) return 4;
        if (['SUBMITTED_FULL', 'SUBMITTED_PARTIAL', 'SUBMITTED'].includes(st)) return 3;
        if (['PROCESSING', 'IN_LAB', 'ANALYSIS_IN_PROGRESS', 'ANALYSIS'].includes(st)) return 2;
        if (['RECEIVED', 'ACCEPTED', 'DRYING', 'GRINDING', 'PREPARED'].includes(st)) return 1;
        if (['EXPECTED', 'PENDING_MANIFEST', 'COLLECTED'].includes(st)) return 0;
        return 0;
    };

    const stageBadges = [
        'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300',
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300 border-yellow-300',
        'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300 border-green-300',
        'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300',
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300',
        'bg-gray-100 text-gray-800 dark:bg-gray-950/40 dark:text-gray-300 border-gray-300'
    ];

    const isFiltered = Boolean((searchQuery || '').trim()) || (selectedStage && selectedStage !== 'all');
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    return (
        <div className="space-y-4">
            {/* Header & Filter Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-sf-text">
                        {t('projects.samples.title', 'Samples & arrivals')}
                    </h2>
                    <p className="text-xs text-sf-muted mt-0.5">
                        {capabilities.isScopedOnly
                            ? t('projects.samples.scopedCount', { count: totalCount }, 'Only samples in your authorized lab scope · {{count}} matching samples')
                            : t('projects.samples.wholeCount', { count: totalCount }, 'Authorized project samples · {{count}} matching samples')}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => navigate(`/samples?project=${encodeURIComponent(project?.code)}`)}
                        className="text-xs font-semibold px-3 py-2 rounded-lg border border-sf-border bg-sf-surface hover:bg-sf-hover text-sf-text transition-colors flex items-center gap-1"
                    >
                        <span>{t('projects.samples.openSampleList', 'Open full sample list →')}</span>
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-3.5 rounded-xl border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                        <span>{t('projects.samples.fetchError', { error }, 'Failed to load samples: {{error}}')}</span>
                    </div>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="text-xs font-semibold px-3 py-1 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-sf-surface hover:bg-red-100 dark:hover:bg-red-950/50 text-red-800 dark:text-red-200 transition-colors shrink-0"
                        >
                            {t('common.retry', 'Retry')}
                        </button>
                    )}
                </div>
            )}

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 rounded-xl bg-sf-surface border border-sf-divider">
                <div className="flex items-center gap-2">
                    <label htmlFor="stage-filter" className="text-xs font-semibold text-sf-muted whitespace-nowrap">
                        {t('projects.samples.stageLabel', 'Stage:')}
                    </label>
                    <select
                        id="stage-filter"
                        value={selectedStage}
                        onChange={(e) => onSelectStage(e.target.value)}
                        className="text-xs rounded-lg border border-sf-border bg-sf-inset px-2.5 py-1.5 font-medium text-sf-text"
                    >
                        <option value="all">
                            {t('projects.samples.allStages', { count: counts?.registered ?? totalCount }, 'All stages ({{count}})')}
                        </option>
                        {stageLabels.map((lbl, idx) => (
                            <option key={idx} value={String(idx)}>
                                {lbl} ({
                                    idx === 0 ? (counts?.awaitingArrival ?? 0)
                                    : idx === 1 ? (counts?.intakeInProgress ?? 0)
                                    : idx === 2 ? (counts?.labWork ?? 0)
                                    : idx === 3 ? (counts?.awaitingReview ?? 0)
                                    : idx === 4 ? (counts?.released ?? 0)
                                    : (counts?.rejectedOrCancelled ?? 0)
                                })
                            </option>
                        ))}
                    </select>
                </div>

                <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-sf-muted" />
                    <input
                        type="text"
                        aria-label={t('projects.samples.searchAriaLabel', 'Search project samples by field or laboratory ID')}
                        placeholder={t('projects.samples.searchPlaceholder', 'Find a field or laboratory ID…')}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-sf-border bg-sf-inset text-sf-text placeholder:text-sf-muted"
                    />
                </div>

                {isFiltered && (
                    <button
                        onClick={() => {
                            setInputValue('');
                            if (onClearFilters) {
                                onClearFilters();
                            } else {
                                onSearchChange?.('');
                                onSelectStage?.('all');
                            }
                        }}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-sf-border bg-sf-inset hover:bg-sf-hover text-sf-text transition-colors whitespace-nowrap"
                    >
                        {t('projects.samples.clearFilters', 'Clear all filters')}
                    </button>
                )}
            </div>

            {/* Scrollable Sample Table Container */}
            <div className="card-base rounded-2xl shadow-sm border border-sf-divider bg-sf-surface overflow-hidden">
                <div className="overflow-x-auto" tabIndex={0} aria-label="Sample table">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-sf-inset border-b border-sf-divider text-sf-muted uppercase tracking-wider font-semibold text-[11px]">
                                <th className="py-3 px-4">{t('projects.samples.sampleIdHeader', 'Sample Identifier')}</th>
                                <th className="py-3 px-4">{t('projects.samples.labHeader', 'Assigned Lab')}</th>
                                <th className="py-3 px-4">{t('projects.samples.statusHeader', 'Current Stage')}</th>
                                <th className="py-3 px-4">{t('projects.samples.arrivalHeader', 'Arrival / Date')}</th>
                                <th className="py-3 px-4 text-right">{t('projects.samples.actionHeader', 'Action')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-sf-divider/70">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-sf-muted">
                                        <div className="inline-flex items-center gap-2 text-xs">
                                            <RefreshCw className="w-4 h-4 animate-spin text-sf-primary" />
                                            <span>{t('projects.samples.loadingSamples', 'Loading project samples…')}</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : samples.length === 0 ? (
                                isFiltered ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center space-y-3">
                                            <Filter className="w-8 h-8 text-sf-muted mx-auto opacity-40" />
                                            <div className="space-y-1">
                                                <p className="text-sm font-semibold text-sf-text">
                                                    {t('projects.samples.noMatchingSamples', 'No samples match the selected filters')}
                                                </p>
                                                <p className="text-xs text-sf-muted max-w-sm mx-auto">
                                                    {searchQuery
                                                        ? t('projects.samples.noSearchMatchDesc', 'No samples matched your search query or stage filter. Try adjusting your search term or stage.')
                                                        : t('projects.samples.noStageMatchDesc', 'No samples in this project are currently in the selected stage.')}
                                                </p>
                                            </div>
                                            <div>
                                                <button
                                                    onClick={() => {
                                                        setInputValue('');
                                                        if (onClearFilters) {
                                                            onClearFilters();
                                                        } else {
                                                            onSearchChange?.('');
                                                            onSelectStage?.('all');
                                                        }
                                                    }}
                                                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-sf-border bg-sf-inset hover:bg-sf-hover text-sf-text transition-colors"
                                                >
                                                    {t('projects.samples.clearFilters', 'Clear all filters')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center space-y-2 text-sf-muted">
                                            <Beaker className="w-8 h-8 mx-auto opacity-40" />
                                            <p className="text-sm font-semibold text-sf-text">
                                                {t('projects.samples.noSamplesYet', 'No samples registered in this project yet')}
                                            </p>
                                            <p className="text-xs text-sf-muted max-w-sm mx-auto">
                                                {t('projects.samples.noSamplesDesc', 'Import a pre-registered manifest or sync from KoboToolbox to begin intake.')}
                                            </p>
                                        </td>
                                    </tr>
                                )
                            ) : (
                                samples.map((sample) => {
                                    const stageIdx = getSampleStageIndex(sample);
                                    const badgeClass = stageBadges[stageIdx] || stageBadges[0];
                                    const stageName = stageLabels[stageIdx] || sample.status;

                                    return (
                                        <tr key={sample.id} className="hover:bg-sf-hover/50 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="font-mono font-bold text-sf-text">
                                                    {sample.originalId || sample.id}
                                                </div>
                                                <div className="text-[11px] text-sf-muted font-mono">
                                                    {sample.labId
                                                        ? t('projects.samples.accession', { labId: sample.labId }, `Accession: ${sample.labId}`)
                                                        : t('projects.samples.notAssignedYet', 'Lab accession pending')}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-sf-text">
                                                {sample.assignedLab || project?.labId || '—'}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badgeClass}`}>
                                                    {stageName}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-sf-muted">
                                                {sample.receptionDate
                                                    ? new Date(sample.receptionDate).toLocaleDateString()
                                                    : <span className="text-sf-muted/60">{t('projects.samples.notReceived', 'Not received yet')}</span>}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {stageIdx === 0 ? (
                                                    <button
                                                        onClick={() => navigate(`/reception?search=${encodeURIComponent(sample.originalId || sample.id)}`)}
                                                        className="text-sf-primary hover:underline font-medium text-xs inline-flex items-center gap-1"
                                                    >
                                                        <span>{t('projects.samples.viewInReception', 'Reception →')}</span>
                                                    </button>
                                                ) : stageIdx === 4 ? (
                                                    <button
                                                        onClick={() => navigate(`/reports?sampleId=${encodeURIComponent(sample.id)}`)}
                                                        className="text-sf-primary hover:underline font-medium text-xs inline-flex items-center gap-1"
                                                    >
                                                        <span>{t('projects.samples.viewReport', 'Report →')}</span>
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => navigate(`/workbench?sampleId=${encodeURIComponent(sample.id)}`)}
                                                        className="text-sf-primary hover:underline font-medium text-xs inline-flex items-center gap-1"
                                                    >
                                                        <span>{t('projects.samples.viewWork', 'Workbench →')}</span>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 border-t border-sf-divider bg-sf-inset text-xs text-sf-muted">
                    <div className="flex items-center gap-2">
                        <span>
                            {t('projects.samples.showingRange', {
                                start: totalCount === 0 ? 0 : (page - 1) * limit + 1,
                                end: Math.min(page * limit, totalCount),
                                total: totalCount
                            }, 'Showing {{start}} to {{end}} of {{total}} samples')}
                        </span>
                        {isFiltered && totalCount > 0 && (
                            <span className="text-[11px] font-medium text-sf-primary bg-sf-surface px-2 py-0.5 rounded border border-sf-divider">
                                {t('projects.samples.filteredNotice', '(filtered)')}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs">{t('projects.samples.perPage', 'Rows:')}</span>
                            <select
                                value={limit}
                                onChange={(e) => onLimitChange?.(Number(e.target.value))}
                                className="text-xs rounded-lg border border-sf-border bg-sf-surface px-2 py-1 font-medium text-sf-text"
                                aria-label="Rows per page"
                            >
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value={200}>200</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => onPageChange?.(page - 1)}
                                disabled={page <= 1 || loading}
                                className="px-2.5 py-1 rounded-lg border border-sf-border bg-sf-surface hover:bg-sf-hover disabled:opacity-40 disabled:cursor-not-allowed font-medium text-xs text-sf-text transition-colors"
                            >
                                {t('common.previous', 'Previous')}
                            </button>
                            <span className="px-2 font-mono font-medium text-sf-text">
                                {page} / {totalPages}
                            </span>
                            <button
                                onClick={() => onPageChange?.(page + 1)}
                                disabled={page >= totalPages || loading}
                                className="px-2.5 py-1 rounded-lg border border-sf-border bg-sf-surface hover:bg-sf-hover disabled:opacity-40 disabled:cursor-not-allowed font-medium text-xs text-sf-text transition-colors"
                            >
                                {t('common.next', 'Next')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scientific Architecture Notice */}
            <div className="p-4 rounded-xl border border-sf-divider bg-sf-inset text-xs text-sf-muted">
                {t('projects.samples.canonicalNotice', 'Drying and preparation completion, analytical measurements, spectral file uploads and approval take place in the workbench. This page displays their authoritative coordinated state.')}
            </div>
        </div>
    );
}
