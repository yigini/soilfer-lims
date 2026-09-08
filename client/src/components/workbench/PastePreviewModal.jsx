import { useAnalysisNames } from '../../context/AnalysisCatalogueContext';
import React, { useState, useMemo } from 'react';
import { X, Clipboard, Check, AlertTriangle, AlertCircle } from 'lucide-react';

/**
 * PastePreviewModal
 * Tab-separated batch paste preview tool.
 * Resolves sample IDs against the current method queue and provides an itemized
 * preview with duplicate, unassigned, and invalid exclusion flags before applying drafts.
 */
export default function PastePreviewModal({
    isOpen,
    onClose,
    onApply,
    currentItems = [],
    analysisCode = ''
}) {
    const getAnalysisDisplayName = useAnalysisNames();
    const [pasteText, setPasteText] = useState('');
    const [previewRows, setPreviewRows] = useState(null);

    const itemLookup = useMemo(() => {
        const map = {};
        currentItems.forEach(item => {
            map[item.sampleId] = item;
            if (item.originalId) map[item.originalId] = item;
        });
        return map;
    }, [currentItems]);

    if (!isOpen) return null;

    const handlePreview = () => {
        const lines = pasteText.split(/\r?\n/).filter(l => l.trim().length > 0);
        const seen = new Set();
        const counts = {};

        // First pass: identify duplicates in pasted text
        lines.forEach(line => {
            const parts = line.split('\t');
            const id = (parts[0] || '').trim();
            if (id) counts[id] = (counts[id] || 0) + 1;
        });

        // Second pass: evaluate each line against work items and validation
        const parsed = lines.map((line, idx) => {
            const parts = line.split('\t');
            const id = (parts[0] || '').trim();
            const val = (parts[1] || '').trim();

            let error = '';
            if (parts.length < 2 || !id || !val) {
                error = 'Expected tab-separated format: SampleID<tab>Value';
            } else if (counts[id] > 1) {
                error = 'Duplicate Sample ID in paste block';
            } else {
                const item = itemLookup[id];
                if (!item) {
                    error = `No matching assigned ${getAnalysisDisplayName(analysisCode)} task`;
                } else if (['SUBMITTED', 'ACCEPTED', 'WAIVED'].includes(item.status)) {
                    error = `Item is sealed (${item.status})`;
                } else if (item.readiness && !item.readiness.isReady) {
                    error = item.readiness.reasons?.[0] || 'Prerequisites blocked';
                } else {
                    const cleanNum = val.replace(',', '.').replace(/^[<>=\s]+/, '');
                    if (isNaN(Number(cleanNum))) {
                        error = 'Invalid numeric format';
                    }
                }
            }

            return {
                index: idx,
                id,
                value: val,
                item: itemLookup[id],
                error
            };
        });

        setPreviewRows(parsed);
    };

    const validRows = previewRows ? previewRows.filter(r => !r.error && r.item) : [];

    const handleApplyMatched = () => {
        if (!validRows.length) return;
        const updates = validRows.map(r => ({
            workItemId: r.item.workItemId,
            value: r.value
        }));
        onApply(updates);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-2xl bg-sf-surface rounded-2xl shadow-2xl border border-sf-divider flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-sf-divider flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clipboard className="text-emerald-600 dark:text-emerald-400" size={18} />
                        <h3 className="text-base font-bold text-sf-text">
                            Batch Paste Preview — {getAnalysisDisplayName(analysisCode)}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-sf-muted hover:text-sf-text transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4 text-xs">
                    <div>
                        <p className="text-sf-muted mb-2 leading-relaxed">
                            Paste rows directly from your spreadsheet (Excel, CSV, or Google Sheets).
                            Format must be two columns separated by a tab: <strong>Sample ID</strong> and <strong>Result Value</strong>.
                        </p>
                        <textarea
                            rows={4}
                            value={pasteText}
                            onChange={(e) => setPasteText(e.target.value)}
                            placeholder="SMP-001	6.45&#10;SMP-002	7.12&#10;SMP-003	<0.50"
                            className="w-full p-3 font-mono text-xs rounded-lg border border-sf-divider bg-sf-canvas text-sf-text focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                    </div>

                    <div className="flex justify-start">
                        <button
                            type="button"
                            onClick={handlePreview}
                            disabled={!pasteText.trim()}
                            className="px-4 py-2 rounded-lg text-xs font-semibold bg-sf-raised text-sf-text border border-sf-divider hover:bg-sf-hover transition-colors disabled:opacity-50"
                        >
                            Preview Matches & Exclusions
                        </button>
                    </div>

                    {/* Preview Table */}
                    {previewRows && (
                        <div className="border border-sf-divider rounded-lg overflow-hidden flex flex-col mt-2">
                            <div className="px-3 py-2 bg-sf-canvas/80 font-semibold text-sf-muted flex items-center justify-between text-[11px] border-b border-sf-divider">
                                <span>Preview Results ({previewRows.length} rows parsed)</span>
                                <div className="flex gap-2">
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                        {validRows.length} Matched
                                    </span>
                                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                                        {previewRows.length - validRows.length} Excluded
                                    </span>
                                </div>
                            </div>
                            <div className="max-h-56 overflow-y-auto divide-y divide-sf-divider">
                                {previewRows.map((r, i) => (
                                    <div key={i} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="font-mono font-medium text-sf-text">
                                                {r.id}
                                            </span>
                                            <span className="text-sf-muted">→</span>
                                            <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                                                {r.value}
                                            </span>
                                        </div>
                                        <div>
                                            {r.error ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-700 dark:text-red-300">
                                                    <AlertCircle size={10} /> {r.error}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                                    <Check size={10} /> Matched
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-sf-divider bg-sf-surface flex items-center justify-between">
                    <span className="text-xs text-sf-muted">
                        Pasting updates local drafts only. Nothing is recorded or submitted.
                    </span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-sf-divider text-sf-text hover:bg-sf-hover transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleApplyMatched}
                            disabled={!validRows.length}
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                            Apply {validRows.length} Matched Drafts
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
