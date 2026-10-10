import { useAnalysisNames } from '../../context/AnalysisCatalogueContext';
import React, { useState, useMemo } from 'react';
import { X, Clipboard, Check, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import delimitedText from '@lims/delimited-text';
import numberParse from '@lims/number-parse';

/**
 * PastePreviewModal
 * Delimited batch paste preview tool.
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
    const { t } = useLanguage();
    const [pasteText, setPasteText] = useState('');
    const [previewed, setPreviewed] = useState(false);
    const [delimiter, setDelimiter] = useState('AUTO');

    const itemLookup = useMemo(() => {
        const map = new Map();
        currentItems.forEach(item => {
            if (!item.workItemId) return;
            for (const value of [item.sampleId, item.originalId, item.sampleLabId, item.sampleDisplayId]) {
                if (typeof value !== 'string' || !value.trim()) continue;
                const key = value.trim(), candidates = map.get(key) || new Map();
                candidates.set(item.workItemId, item); map.set(key, candidates);
            }
        });
        return map;
    }, [currentItems]);

    const previewRows = useMemo(() => {
        if (!previewed) return null;
        const rows = delimiter === 'AUTO' ? delimitedText.parsePastedRows(pasteText).rows
            : delimitedText.parseDelimited(pasteText, delimiter);
        const idCounts = new Map(), taskCounts = new Map();
        const resolved = rows.map(row => {
            const id = (row.cells[0] || '').trim(), candidates = [...(itemLookup.get(id)?.values() || [])];
            const item = candidates.length === 1 ? candidates[0] : null;
            idCounts.set(id, (idCounts.get(id) || 0) + 1);
            if (item) taskCounts.set(item.workItemId, (taskCounts.get(item.workItemId) || 0) + 1);
            return { ...row, id, item, ambiguous: candidates.length > 1 };
        });
        return resolved.map((row, idx) => {
            const { id, item } = row, val = row.cells[1] ?? '';

            let error = '';
            if (row.error || row.cells.length !== 2 || !id || !val.trim()) {
                error = t('pastePreview.formatError');
            } else if (idCounts.get(id) > 1 || item && taskCounts.get(item.workItemId) > 1) {
                error = t('pastePreview.duplicate');
            } else if (row.ambiguous) {
                error = t('pastePreview.ambiguousId');
            } else {
                if (!item) {
                    error = t('pastePreview.unmatched', { analysis: getAnalysisDisplayName(analysisCode) });
                } else if (['SUBMITTED', 'ACCEPTED', 'WAIVED', 'CANCELLED'].includes(item.status)) {
                    error = t('pastePreview.sealed', { status: item.status });
                } else if (item.readiness && !item.readiness.isReady) {
                    error = item.readiness.reasons?.[0] || t('pastePreview.blocked');
                } else if (!numberParse.parseNumber(val, item.numberFormat).valid) {
                    error = t('pastePreview.invalidNumber');
                }
            }

            return {
                index: idx,
                id,
                value: val,
                item,
                error
            };
        });
    }, [previewed, pasteText, delimiter, itemLookup, t, getAnalysisDisplayName, analysisCode]);

    if (!isOpen) return null;

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
                            {t('pastePreview.title', { analysis: getAnalysisDisplayName(analysisCode) })}
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
                            {t('pastePreview.help')}
                        </p>
                        <label className="block text-sf-muted mb-2">{t('pastePreview.separator')}
                            <select data-testid="paste-delimiter" value={delimiter} onChange={event => { setDelimiter(event.target.value); setPreviewed(false); }}
                                className="ml-2 rounded border border-sf-divider bg-sf-canvas p-1 text-sf-text">
                                <option value="AUTO">{t('pastePreview.auto')}</option>
                                <option value={'\t'}>{t('pastePreview.tab')}</option>
                                <option value=",">{t('pastePreview.comma')}</option>
                                <option value=";">{t('pastePreview.semicolon')}</option>
                            </select>
                        </label>
                        <textarea
                            data-testid="paste-input"
                            rows={4}
                            value={pasteText}
                            onChange={(e) => { setPasteText(e.target.value); setPreviewed(false); }}
                            placeholder="SMP-001	6.45&#10;SMP-002	7.12&#10;SMP-003	<0.50"
                            className="w-full p-3 font-mono text-xs rounded-lg border border-sf-divider bg-sf-canvas text-sf-text focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                    </div>

                    <div className="flex justify-start">
                        <button
                            type="button"
                            data-testid="paste-preview"
                            onClick={() => setPreviewed(true)}
                            disabled={!pasteText.trim()}
                            className="px-4 py-2 rounded-lg text-xs font-semibold bg-sf-raised text-sf-text border border-sf-divider hover:bg-sf-hover transition-colors disabled:opacity-50"
                        >
                            {t('pastePreview.preview')}
                        </button>
                    </div>

                    {/* Preview Table */}
                    {previewRows && (
                        <div className="border border-sf-divider rounded-lg overflow-hidden flex flex-col mt-2">
                            <div className="px-3 py-2 bg-sf-canvas/80 font-semibold text-sf-muted flex items-center justify-between text-[11px] border-b border-sf-divider">
                                <span>{t('pastePreview.summary', { count: previewRows.length })}</span>
                                <div className="flex gap-2">
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                        {t('pastePreview.matched', { count: validRows.length })}
                                    </span>
                                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                                        {t('pastePreview.excluded', { count: previewRows.length - validRows.length })}
                                    </span>
                                </div>
                            </div>
                            <div className="max-h-56 overflow-y-auto divide-y divide-sf-divider">
                                {previewRows.map((r, i) => (
                                    <div key={i} data-testid={`paste-row-${i}`} data-valid={!r.error} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
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
                                                    <Check size={10} /> {t('pastePreview.matchedRow')}
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
                        {t('pastePreview.draftNotice')}
                    </span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-sf-divider text-sf-text hover:bg-sf-hover transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            type="button"
                            data-testid="paste-apply"
                            onClick={handleApplyMatched}
                            disabled={!validRows.length}
                            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                        >
                            {t('pastePreview.apply', { count: validRows.length })}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
