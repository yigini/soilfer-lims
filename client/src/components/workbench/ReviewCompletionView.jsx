import { useAnalysisNames } from '../../context/AnalysisCatalogueContext';
import React, { useState } from 'react';
import {
    ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck,
    Check, ArrowRight
} from 'lucide-react';

/**
 * ReviewCompletionView
 * Step 1 of the Two-Step Handoff: Review before recording.
 * Provides explicit preflight itemization separating eligible determinations
 * from blocked/invalid items before atomic recording.
 */
export default function ReviewCompletionView({
    previewData,
    onBack,
    onCommit,
    isSubmitting = false
}) {
    const getAnalysisDisplayName = useAnalysisNames();
    const [confirmed, setConfirmed] = useState(false);

    const included = previewData?.included || [];
    const excluded = previewData?.excluded || [];

    const handleRecord = () => {
        if (!confirmed || !included.length) return;
        onCommit(included);
    };

    return (
        <div className="flex flex-col gap-5 max-w-4xl mx-auto py-2">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-sf-divider">
                <div>
                    <h3 className="text-lg font-bold text-sf-text">
                        Review Determinations Before Recording
                    </h3>
                    <p className="text-xs text-sf-muted mt-0.5">
                        Verify determinations and metadata. Recording writes defensible results and marks tasks completed, but does not submit for reviewer acceptance.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onBack}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-sf-divider hover:bg-sf-hover transition-colors flex items-center gap-1.5 text-sf-text"
                >
                    <ArrowLeft size={13} /> Back to Worksheet
                </button>
            </div>

            {/* Counts Ribbon */}
            <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">
                            Eligible to Record
                        </span>
                        <div className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">
                            {included.length} Item{included.length === 1 ? '' : 's'}
                        </div>
                    </div>
                    <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400" />
                </div>

                <div className="p-3.5 rounded-xl border border-sf-divider bg-sf-surface flex items-center justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-bold text-sf-muted">
                            Excluded / Incomplete
                        </span>
                        <div className="text-xl font-bold text-sf-text mt-0.5">
                            {excluded.length} Item{excluded.length === 1 ? '' : 's'}
                        </div>
                    </div>
                    <AlertTriangle size={24} className="text-amber-500" />
                </div>
            </div>

            {/* Included Items List */}
            <div className="rounded-xl border border-sf-divider overflow-hidden bg-sf-surface">
                <div className="px-4 py-2.5 bg-sf-canvas/80 font-semibold text-sf-text text-xs flex items-center justify-between border-b border-sf-divider">
                    <span>Included Determinations ({included.length})</span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">Ready to Record</span>
                </div>
                <div className="divide-y divide-sf-divider max-h-64 overflow-y-auto bg-sf-surface">
                    {included.map((item, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between text-xs">
                            <div>
                                <span className="font-bold text-sf-text font-mono">
                                    {item.sampleId}
                                </span>
                                <span className="text-sf-muted mx-2">·</span>
                                <span className="text-sf-text font-medium">
                                    {getAnalysisDisplayName(item.analysis, item.analysisName)}
                                </span>
                                <span className="text-sf-muted text-[11px] ml-2">
                                    (Basis: {item.basis || 'Air-dry'}, Rep: {item.replicateNo || 1})
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                    {item.value ?? (
                                        item.values ? (
                                            Array.isArray(item.values)
                                                ? item.values.join('/')
                                                : `${item.values.sand ?? ''}/${item.values.silt ?? ''}/${item.values.clay ?? ''}`
                                        ) : '3/3 checks'
                                    )}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">
                                    ✓ Included
                                </span>
                            </div>
                        </div>
                    ))}
                    {included.length === 0 && (
                        <div className="p-4 text-center text-xs text-sf-muted">
                            No items meet the completion readiness requirements.
                        </div>
                    )}
                </div>
            </div>

            {/* Excluded Items (if any) */}
            {excluded.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 overflow-hidden bg-sf-surface">
                    <div className="px-4 py-2.5 bg-amber-500/10 font-semibold text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between border-b border-amber-500/20">
                        <span>Excluded Items ({excluded.length})</span>
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">Remains Draft</span>
                    </div>
                    <div className="divide-y divide-sf-divider max-h-48 overflow-y-auto bg-sf-surface">
                        {excluded.map((item, idx) => (
                            <div key={idx} className="p-3 flex items-center justify-between text-xs">
                                <div>
                                    <span className="font-bold text-sf-text font-mono">
                                        {item.sampleId}
                                    </span>
                                    <span className="text-sf-muted mx-2">·</span>
                                    <span className="text-sf-muted">{getAnalysisDisplayName(item.analysis, item.analysisName)}</span>
                                    <div className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                                        • {item.reasons?.[0] || 'Prerequisites or validation incomplete'}
                                    </div>
                                </div>
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300">
                                    Excluded
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Checkbox and Action */}
            <div className="p-4 rounded-xl border border-sf-divider bg-sf-surface flex flex-col gap-3">
                <label className="flex items-center gap-2 text-xs text-sf-text cursor-pointer">
                    <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => setConfirmed(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                        I verified the sample IDs, determinations, basis, and replicate numbers shown above against raw bench data.
                    </span>
                </label>

                <div className="flex items-center justify-between pt-2 border-t border-sf-divider">
                    <span className="text-xs text-sf-muted">
                        {included.length} item{included.length === 1 ? '' : 's'} will be recorded.
                    </span>
                    <button
                        type="button"
                        onClick={handleRecord}
                        disabled={!confirmed || !included.length || isSubmitting}
                        className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                        {isSubmitting ? 'Recording...' : `Record ${included.length} Determination${included.length === 1 ? '' : 's'}`}
                        <ArrowRight size={13} />
                    </button>
                </div>
            </div>
        </div>
    );
}
