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
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Flatten all items across analysis groups
    const allItems = useMemo(() => {
        return groups.flatMap(g => g.items.map(i => ({
            ...i,
            analysis: i.analysis || g.analysis,
            analysisCode: i.analysisCode || g.analysis,
            analysisName: g.analysisName,
            groupCategory: g.category,
            editorKind: i.editorKind || (['SPEC_VIS_NIR', 'SPEC_MIR', 'SPEC_NIR', 'SPEC_FTIR'].includes(g.analysis) ? 'SPECTRAL' : (g.analysis === 'TEXTURE' ? 'TEXTURE' : (g.category === 'Operational Gates' ? 'OPERATIONAL' : 'NUMERIC'))),
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
                const matchParam = item.analysis?.toLowerCase().includes(q) || item.analysisName?.toLowerCase().includes(q);
                if (!matchDisplayId && !matchLabId && !matchId && !matchOrig && !matchParam) return false;
            }

            return true;
        });
    }, [allItems, statusFilter, searchQuery]);

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
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search by sample ID or method..."
                        className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-64"
                    />
                </div>
            </div>

            {/* Queue Table */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                <table className="w-full border-collapse text-left text-xs">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                            <th className="py-2.5 px-4 font-semibold">Sample ID</th>
                            <th className="py-2.5 px-4 font-semibold">Analysis Method</th>
                            <th className="py-2.5 px-4 font-semibold">Priority</th>
                            <th className="py-2.5 px-4 font-semibold">Prerequisites</th>
                            <th className="py-2.5 px-4 font-semibold">Execution Readiness</th>
                            <th className="py-2.5 px-4 font-semibold">Current State</th>
                            <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredItems.map((item) => {
                            const isSpectral = item.editorKind === 'SPECTRAL' || ['SPEC_VIS_NIR', 'SPEC_MIR', 'SPEC_NIR', 'SPEC_FTIR'].includes(item.analysis);
                            const hasDraft = !!item.draft;
                            const isRecorded = item.status === 'COMPLETED';

                            return (
                                <tr
                                    key={item.workItemId}
                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                                >
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                                {item.sampleDisplayId || item.labId || item.sampleId}
                                            </span>
                                            {item.sampleDisplayId && item.sampleId && item.sampleDisplayId !== item.sampleId && (
                                                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline" title={item.sampleId}>
                                                    ({item.sampleId.slice(0, 8)}…)
                                                </span>
                                            )}
                                        </div>
                                        {item.originalId && (
                                            <div className="text-[11px] text-slate-400 font-mono">
                                                {item.originalId}
                                            </div>
                                        )}
                                        {item.projectCode && (
                                            <span className="inline-block text-[10px] text-slate-500">
                                                {item.projectCode}
                                            </span>
                                        )}
                                    </td>

                                    <td className="py-3 px-4">
                                        <div className="font-medium text-slate-800 dark:text-slate-200">
                                            {item.analysisName || item.analysis}
                                        </div>
                                        <div className="text-[11px] text-slate-400">
                                            {item.analysis} · {item.groupCategory}
                                        </div>
                                    </td>

                                    <td className="py-3 px-4">
                                        {item.priority === 'HIGH' ? (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400">
                                                HIGH
                                            </span>
                                        ) : item.priority === 'URGENT' ? (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400">
                                                URGENT
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">Normal</span>
                                        )}
                                    </td>

                                    <td className="py-3 px-4">
                                        {item.category === 'Operational Gates' ? (
                                            <span className="text-[11px] text-slate-400 italic">Prerequisite task</span>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
                                                        item.dryingStatus === 'DONE' ? 'text-emerald-600' : 'text-amber-600'
                                                    }`}
                                                    title={`Drying: ${item.dryingStatus || 'PENDING'}`}
                                                >
                                                    <Droplets size={11} /> {item.dryingStatus === 'DONE' ? 'Dry ✓' : 'Dry …'}
                                                </span>
                                                <span
                                                    className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
                                                        item.preparationStatus === 'DONE' ? 'text-emerald-600' : 'text-amber-600'
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
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                                                <CheckCircle2 size={11} /> Ready
                                            </span>
                                        ) : (
                                            <div>
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                                                    <AlertTriangle size={11} /> Blocked
                                                </span>
                                                <p className="text-[10px] text-slate-500 mt-0.5 max-w-[180px] truncate">
                                                    {item.readiness?.reasons?.[0] || 'Prerequisites incomplete'}
                                                </p>
                                            </div>
                                        )}
                                    </td>

                                    <td className="py-3 px-4">
                                        {isSpectral ? (
                                            item.hasSpectrum || item.latestSpectralScan || isRecorded ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                                                    <span>✓ Scan recorded</span>
                                                    {item.latestSpectralScan?.qcStatus && (
                                                        <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                                                            item.latestSpectralScan.qcStatus === 'PASS' ? 'bg-emerald-200 text-emerald-900' :
                                                            item.latestSpectralScan.qcStatus === 'WARN' ? 'bg-amber-200 text-amber-900' :
                                                            'bg-rose-200 text-rose-900'
                                                        }`}>
                                                            {item.latestSpectralScan.qcStatus}
                                                        </span>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300">
                                                    <span>Scan required</span>
                                                </span>
                                            )
                                        ) : isRecorded ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                                                <span>✓ Recorded</span>
                                                {item.currentResult && <span className="font-mono font-bold">({item.currentResult})</span>}
                                            </span>
                                        ) : hasDraft ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300">
                                                <span>Draft:</span>
                                                <span className="font-mono font-semibold">{item.draft.value || 'saved'}</span>
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">Awaiting input</span>
                                        )}
                                    </td>

                                    <td className="py-3 px-4 text-right">
                                        {isSpectral ? (
                                            <button
                                                type="button"
                                                onClick={() => onOpenSpectralIntake(item)}
                                                className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 transition-colors inline-flex items-center gap-1"
                                            >
                                                <span>Spectra</span>
                                                <ArrowRight size={12} />
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => onOpenWorksheet(item.analysis, item.sampleId)}
                                                className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 transition-colors inline-flex items-center gap-1"
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
                                <td colSpan={7} className="py-8 text-center text-slate-400">
                                    No work items match the selected filter.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
