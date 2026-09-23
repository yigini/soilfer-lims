import { useAnalysisNames } from '../../context/AnalysisCatalogueContext';
import React, { useState, useMemo } from 'react';
import {
    Search, Filter, CheckCircle2, AlertTriangle, ArrowRight,
    Droplets, FlaskConical, Radio, Clock, Sparkles
} from 'lucide-react';

/**
 * WorkbenchQueue
 * Unified technician queue listing assigned numeric analyses, texture fractions,
 * preparation tasks, and spectroscopy.
 * Provides quick status filtering and direct navigation into specialized editors.
 */
export default function WorkbenchQueue({
    groups = [],
    onOpenWorksheet,
    onOpenSpectralIntake,
    searchQuery = '',
    onSearchChange
}) {
    const getAnalysisDisplayName = useAnalysisNames();
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Flatten all items across analysis groups
    const allItems = useMemo(() => {
        return groups.flatMap(g => g.items.map(i => ({
            ...i,
            analysis: i.analysis || g.analysis,
            analysisCode: i.analysisCode || g.analysis,
            analysisName: g.analysisName,
            groupCategory: g.category,
            editorKind: i.editorKind || (['SPEC_VIS_NIR', 'SPEC_MIR', 'SPEC_NIR', 'SPEC_FTIR'].includes(g.analysis) ? 'SPECTRAL' : (['TEXTURE', 'SOIL_PSD_TEXTURE', 'SOIL_TEXTURE', 'PSA', 'pSA', 'Particle Size Analysis'].includes(g.analysis) ? 'TEXTURE' : (g.category === 'Operational Gates' ? 'OPERATIONAL' : 'NUMERIC'))),
            eligibleEquipment: g.eligibleEquipment || []
        })));
    }, [groups]);

    const filteredItems = useMemo(() => {
        return allItems.filter(item => {
            // Status filter
            if (statusFilter === 'READY') {
                if (!item.readiness?.isReady || item.status === 'COMPLETED') return false;
            } else if (statusFilter === 'ATTENTION') {
                if (item.readiness?.isReady || item.status === 'COMPLETED') return false;
            } else if (statusFilter === 'RECORDED') {
                if (item.status !== 'COMPLETED') return false;
            }

            // Text search
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchDisplayId = item.sampleDisplayId?.toLowerCase().includes(q);
                const matchLabId = item.labId?.toLowerCase().includes(q);
                const matchId = item.sampleId?.toLowerCase().includes(q);
                const matchOrig = item.originalId?.toLowerCase().includes(q);
                const matchWorkItemId = item.workItemId?.toLowerCase().includes(q) || item.id?.toLowerCase().includes(q);
                const matchParam = item.analysis?.toLowerCase().includes(q) || item.analysisCode?.toLowerCase().includes(q) || getAnalysisDisplayName(item.analysis, item.analysisName).toLowerCase().includes(q);
                const matchMethod = item.methodologyName?.toLowerCase().includes(q) || item.methodologyStandard?.toLowerCase().includes(q);
                const matchProject = item.projectCode?.toLowerCase().includes(q);
                if (!matchDisplayId && !matchLabId && !matchId && !matchOrig && !matchParam && !matchMethod && !matchWorkItemId && !matchProject) return false;
            }

            return true;
        });
    }, [allItems, statusFilter, searchQuery, getAnalysisDisplayName]);

    const stats = useMemo(() => {
        return {
            total: allItems.length,
            ready: allItems.filter(i => i.readiness?.isReady && i.status !== 'COMPLETED').length,
            attention: allItems.filter(i => !i.readiness?.isReady && i.status !== 'COMPLETED').length,
            recorded: allItems.filter(i => i.status === 'COMPLETED').length
        };
    }, [allItems]);

    return (
        <div className="flex flex-col gap-4">
            {/* Toolbar & Filters */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                        { id: 'ALL', label: `All Work (${stats.total})` },
                        { id: 'READY', label: `Ready to Record (${stats.ready})` },
                        { id: 'ATTENTION', label: `Needs Attention (${stats.attention})` },
                        { id: 'RECORDED', label: `Ready to Submit (${stats.recorded})` }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setStatusFilter(tab.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                statusFilter === tab.id
                                    ? 'bg-emerald-600 text-white font-semibold'
                                    : 'bg-sf-surface text-sf-muted hover:bg-sf-hover hover:text-sf-text border border-sf-divider'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-sf-muted" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search by sample ID or method..."
                        className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-sf-divider bg-sf-surface text-sf-text placeholder:text-sf-muted focus:outline-none focus:ring-1 focus:ring-emerald-500 w-64"
                    />
                </div>
            </div>

            {/* Queue Table */}
            <div className="rounded-xl border border-sf-divider overflow-hidden bg-sf-surface">
                <table className="w-full border-collapse text-left text-xs">
                    <thead>
                        <tr className="bg-sf-canvas/80 text-sf-muted border-b border-sf-divider">
                            <th className="py-2.5 px-4 font-semibold">Sample ID</th>
                            <th className="py-2.5 px-4 font-semibold">Analysis Method</th>
                            <th className="py-2.5 px-4 font-semibold">Priority</th>
                            <th className="py-2.5 px-4 font-semibold">Prerequisites</th>
                            <th className="py-2.5 px-4 font-semibold">Execution Readiness</th>
                            <th className="py-2.5 px-4 font-semibold">Current State</th>
                            <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-sf-divider">
                        {filteredItems.map((item) => {
                            const isSpectral = item.editorKind === 'SPECTRAL' || ['SPEC_VIS_NIR', 'SPEC_MIR', 'SPEC_NIR', 'SPEC_FTIR'].includes(item.analysis);
                            const hasDraft = !!item.draft;
                            const isRecorded = item.status === 'COMPLETED';

                            return (
                                <tr
                                    key={item.workItemId}
                                    className="hover:bg-sf-hover/60 transition-colors"
                                >
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono font-bold text-sf-text">
                                                {item.sampleDisplayId || item.labId || item.originalId || 'Sample'}
                                            </span>
                                        </div>
                                        {item.originalId && (
                                            <div className="text-[11px] text-sf-muted font-mono">
                                                Field: {item.originalId}
                                            </div>
                                        )}
                                        {item.projectCode && (
                                            <span className="inline-block text-[10px] text-sf-muted">
                                                {item.projectCode}
                                            </span>
                                        )}
                                    </td>

                                    <td className="py-3 px-4">
                                        <div className="font-medium text-sf-text">
                                            {getAnalysisDisplayName(item.analysis, item.analysisName)}
                                        </div>
                                        <div className="text-[11px] text-sf-muted">
                                            {item.groupCategory}
                                        </div>
                                    </td>

                                    <td className="py-3 px-4">
                                        {item.priority === 'HIGH' ? (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500/15 text-orange-700 dark:text-orange-400">
                                                HIGH
                                            </span>
                                        ) : item.priority === 'URGENT' ? (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-700 dark:text-red-400">
                                                URGENT
                                            </span>
                                        ) : (
                                            <span className="text-sf-muted">Normal</span>
                                        )}
                                    </td>

                                    <td className="py-3 px-4">
                                        {item.category === 'Operational Gates' ? (
                                            <span className="text-[11px] text-sf-muted italic">Prerequisite task</span>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
                                                        item.dryingStatus === 'DONE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                                                    }`}
                                                    title={`Drying: ${item.dryingStatus || 'PENDING'}`}
                                                >
                                                    <Droplets size={11} /> {item.dryingStatus === 'DONE' ? 'Dry ✓' : 'Dry …'}
                                                </span>
                                                <span
                                                    className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
                                                        item.preparationStatus === 'DONE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                                                    }`}
                                                    title={`Preparation: ${item.preparationStatus || 'PENDING'}`}
                                                >
                                                    <FlaskConical size={11} /> {item.preparationStatus === 'DONE' ? 'Prep ✓' : 'Prep …'}
                                                </span>
                                            </div>
                                        )}
                                    </td>

                                    <td className="py-3 px-4">
                                        {item.readiness?.isReady ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                                <CheckCircle2 size={11} /> Ready
                                            </span>
                                        ) : (
                                            <div>
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                                    <AlertTriangle size={11} /> Blocked
                                                </span>
                                                <p className="text-[10px] text-sf-muted mt-0.5 max-w-[180px] truncate">
                                                    {item.readiness?.reasons?.[0] || 'Prerequisites incomplete'}
                                                </p>
                                            </div>
                                        )}
                                    </td>

                                    <td className="py-3 px-4">
                                        {isSpectral ? (
                                            item.hasSpectrum || item.latestSpectralScan || isRecorded ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
                                                    <span>✓ Scan recorded</span>
                                                    {item.latestSpectralScan?.qcStatus && (
                                                        <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                                                            item.latestSpectralScan.qcStatus === 'PASS' ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200' :
                                                            item.latestSpectralScan.qcStatus === 'WARN' ? 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200' :
                                                            'bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200'
                                                        }`}>
                                                            {item.latestSpectralScan.qcStatus}
                                                        </span>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                                    <span>Scan required</span>
                                                </span>
                                            )
                                        ) : isRecorded ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
                                                <span>✓ Recorded</span>
                                                {item.currentResult && <span className="font-mono font-bold">({item.currentResult})</span>}
                                            </span>
                                        ) : hasDraft ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/15 text-blue-800 dark:text-blue-300">
                                                <span>Draft:</span>
                                                <span className="font-mono font-semibold">{item.draft.value || 'saved'}</span>
                                            </span>
                                        ) : (
                                            <span className="text-sf-muted">Awaiting input</span>
                                        )}
                                    </td>

                                    <td className="py-3 px-4 text-right">
                                        {isSpectral ? (
                                            <button
                                                type="button"
                                                onClick={() => onOpenSpectralIntake(item)}
                                                className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 transition-colors inline-flex items-center gap-1 border border-blue-200 dark:border-blue-900/50"
                                            >
                                                <span>Spectra</span>
                                                <ArrowRight size={12} />
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => onOpenWorksheet(item.analysis, item.sampleId)}
                                                className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition-colors inline-flex items-center gap-1 border border-emerald-200 dark:border-emerald-900/50"
                                            >
                                                <span>Open</span>
                                                <ArrowRight size={12} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}

                        {filteredItems.length === 0 && (
                            <tr>
                                <td colSpan={7} className="py-8 text-center text-sf-muted">
                                    {searchQuery ? `No work items match "${searchQuery}".` : 'No work items match the selected filter.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
