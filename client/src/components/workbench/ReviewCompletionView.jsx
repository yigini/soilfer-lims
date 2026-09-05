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
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        Review Determinations Before Recording
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Verify determinations and metadata. Recording writes defensible results and marks tasks completed, but does not submit for reviewer acceptance.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onBack}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                    <ArrowLeft size={13} /> Back to Worksheet
                </button>
            </div>

            {/* Counts Ribbon */}
            <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between">
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

                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500">
                            Excluded / Incomplete
                        </span>
                        <div className="text-xl font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                            {excluded.length} Item{excluded.length === 1 ? '' : 's'}
                        </div>
                    </div>
                    <AlertTriangle size={24} className="text-amber-500" />
                </div>
            </div>

            {/* Included Items List */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 text-xs flex items-center justify-between">
                    <span>Included Determinations ({included.length})</span>
                    <span className="text-[11px] text-emerald-600 font-bold">Ready to Record</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto bg-white dark:bg-slate-900">
                    {included.map((item, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between text-xs">
                            <div>
                                <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                                    {item.sampleId}
                                </span>
                                <span className="text-slate-400 mx-2">·</span>
                                <span className="text-slate-600 dark:text-slate-300 font-medium">
                                    {item.analysis}
                                </span>
                                <span className="text-slate-400 text-[11px] ml-2">
                                    (Basis: {item.basis || 'Air-dry'}, Rep: {item.replicateNo || 1})
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                    {item.value ?? (item.values ? item.values.join('/') : '3/3 checks')}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                                    ✓ Included
                                </span>
                            </div>
                        </div>
                    ))}
                    {included.length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-400">
                            No items meet the completion readiness requirements.
                        </div>
                    )}
                </div>
            </div>

            {/* Excluded Items (if any) */}
            {excluded.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 overflow-hidden">
                    <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 font-semibold text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
                        <span>Excluded Items ({excluded.length})</span>
                        <span className="text-[11px] text-amber-600 font-bold">Remains Draft</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto bg-white dark:bg-slate-900">
                        {excluded.map((item, idx) => (
                            <div key={idx} className="p-3 flex items-center justify-between text-xs">
                                <div>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                                        {item.sampleId}
                                    </span>
                                    <span className="text-slate-400 mx-2">·</span>
                                    <span className="text-slate-500">{item.analysis}</span>
                                    <div className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                                        • {item.reasons?.[0] || 'Prerequisites or validation incomplete'}
                                    </div>
                                </div>
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
                                    Excluded
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Checkbox and Action */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex flex-col gap-3">
                <label className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 cursor-pointer">
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

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-xs text-slate-500">
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
