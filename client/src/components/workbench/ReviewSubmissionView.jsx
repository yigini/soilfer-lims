import React, { useState, useEffect } from 'react';
import { Send, CheckCircle, ArrowRight, Layers, ArrowLeft } from 'lucide-react';

/**
 * ReviewSubmissionView
 * Step 2 of Two-Step Handoff: Review before submitting to reviewer.
 * Bundles recorded determinations by sample into sample-scoped submissions.
 * Distinguishes Full sample submission from Partial sample submission.
 */
export default function ReviewSubmissionView({
    eligibleSamples = [],
    onBack,
    onSubmit,
    isSubmitting = false
}) {
    const [selectedSamples, setSelectedSamples] = useState(
        eligibleSamples.map(s => s.sampleId)
    );
    const [confirmed, setConfirmed] = useState(false);
    const [submissionNote, setSubmissionNote] = useState('');

    useEffect(() => {
        if (eligibleSamples && eligibleSamples.length > 0) {
            setSelectedSamples(eligibleSamples.map(s => s.sampleId));
        }
    }, [eligibleSamples]);

    const toggleSample = (sId) => {
        if (selectedSamples.includes(sId)) {
            setSelectedSamples(selectedSamples.filter(id => id !== sId));
        } else {
            setSelectedSamples([...selectedSamples, sId]);
        }
    };

    const handleSubmit = () => {
        if (!confirmed || !selectedSamples.length) return;
        onSubmit(selectedSamples, submissionNote);
    };

    return (
        <div className="flex flex-col gap-5 max-w-4xl mx-auto py-2">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        Review & Submit Samples for Review
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Submission bundles completed determinations by sample and places them into the QA / Reviewer queue.
                    </p>
                </div>
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                    >
                        <ArrowLeft size={13} /> Back
                    </button>
                )}
            </div>

            {/* Explanation Notice */}
            <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 text-xs leading-relaxed">
                Samples submitted for review become read-only for technicians. The laboratory manager or assigned reviewer will inspect your determinations and make an accept or reanalysis decision.
            </div>

            {/* Samples List */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-200 text-xs flex items-center justify-between">
                    <span>Recorded Samples ({eligibleSamples.length})</span>
                    <span className="text-[11px] text-slate-500">Select samples to submit</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto bg-white dark:bg-slate-900">
                    {eligibleSamples.map((group) => {
                        const isChecked = selectedSamples.includes(group.sampleId);
                        return (
                            <div
                                key={group.sampleId}
                                onClick={() => toggleSample(group.sampleId)}
                                className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors text-xs ${
                                    isChecked ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}}
                                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <div>
                                        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-sm">
                                            {group.sampleId}
                                        </span>
                                        {group.originalId && (
                                            <span className="text-slate-400 ml-2">({group.originalId})</span>
                                        )}
                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                            {group.items?.map(i => i.analysis).join(', ') || 'Determinations'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-slate-500">
                                        {group.completedCount} / {group.totalCount} tests complete
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        group.submissionType === 'FULL'
                                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                                            : 'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300'
                                    }`}>
                                        {group.submissionType}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    {eligibleSamples.length === 0 && (
                        <div className="p-6 text-center text-xs text-slate-400">
                            No recorded samples are currently awaiting review submission. Record eligible worksheet items first.
                        </div>
                    )}
                </div>
            </div>

            {/* Submission Form & Notes */}
            {eligibleSamples.length > 0 && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex flex-col gap-3">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Submission Notes for Reviewer (optional):
                        </label>
                        <input
                            type="text"
                            value={submissionNote}
                            onChange={(e) => setSubmissionNote(e.target.value)}
                            placeholder="e.g. Batch run 4 complete; QC duplicate verified on SMP-102"
                            className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 cursor-pointer pt-1">
                        <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={(e) => setConfirmed(e.target.checked)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>
                            I confirm that the selected samples are complete and ready for managerial review.
                        </span>
                    </label>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-xs text-slate-500">
                            {selectedSamples.length} sample{selectedSamples.length === 1 ? '' : 's'} selected for handoff.
                        </span>
                        <button
                            type="button"
                            data-testid="submit-for-review-btn"
                            onClick={handleSubmit}
                            disabled={!confirmed || !selectedSamples.length || isSubmitting}
                            className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                            <Send size={13} />
                            {isSubmitting ? 'Submitting...' : `Submit ${selectedSamples.length} Sample${selectedSamples.length === 1 ? '' : 's'} for Review`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
