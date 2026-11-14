import { useAnalysisNames } from '../../context/AnalysisCatalogueContext';
import React, { useState, useEffect } from 'react';
import CalculationEvidence from '../sample/CalculationEvidence';
import { useLanguage } from '../../context/LanguageContext';
import {
    ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck,
    Check, ArrowRight
} from 'lucide-react';

export function benchOrdered(items) {
    return [...items].sort((a, b) => {
        const position = row => Number.isFinite(row.rackPosition) ? row.rackPosition : Number.MAX_SAFE_INTEGER;
        return position(a) - position(b) || String(a.labSampleCode || '').localeCompare(String(b.labSampleCode || ''));
    });
}
const messages = item => [...(item.validation?.flags || []), ...(item.warnings || []), ...(item.reasons || [])]
    .map(value => typeof value === 'string' ? value : value?.message || value?.code).filter(Boolean);

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
    const { t } = useLanguage();
    const [confirmed, setConfirmed] = useState(false);

    const included = benchOrdered(previewData?.included || []);
    const excluded = benchOrdered(previewData?.excluded || []);
    useEffect(() => { setConfirmed(false); }, [previewData]);

    const valueText = item => {
        if (item.value !== null && item.value !== undefined && item.value !== '') return item.value;
        if (Array.isArray(item.values)) return item.values.join('/');
        if (item.values && ['sand', 'silt', 'clay'].some(key => Object.hasOwn(item.values, key)))
            return ['sand', 'silt', 'clay'].map(key => item.values[key] ?? '').join('/');
        if (Array.isArray(item.checks)) return t('benchErgonomics.checksCount', { checked: item.checks.filter(check => check === true).length, total: item.checks.length });
        return t('benchErgonomics.unknown');
    };

    const handleRecord = () => {
        if (!confirmed || !included.length) return;
        onCommit(included);
    };

    return (
        <div className="flex flex-col gap-5 max-w-4xl mx-auto py-2">
            {/* Header */}
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-sf-divider">
                <div>
                    <h3 className="text-lg font-bold text-sf-text">{t("workbenchUi.reviewDeterminationsBeforeRecording")}</h3>
                    <p className="text-xs text-sf-muted mt-0.5">{t("workbenchUi.verifyDeterminationsAndMetadataRecordingWritesDefensibleRe")}</p>
                </div>
                <button
                    type="button"
                    onClick={onBack}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border border-sf-divider hover:bg-sf-hover transition-colors flex items-center gap-1.5 text-sf-text"
                >
                    <ArrowLeft size={13} /> {t("workbenchUi.backToWorksheet")}</button>
            </div>

            {/* Counts Ribbon */}
            <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">{t("workbenchUi.eligibleToRecord")}</span>
                        <div className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">
                            {t(included.length === 1 ? "workbenchUi.itemOne" : "workbenchUi.itemMany", { count: included.length })}
                        </div>
                    </div>
                    <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400" />
                </div>

                <div className="p-3.5 rounded-xl border border-sf-divider bg-sf-surface flex items-center justify-between">
                    <div>
                        <span className="text-[10px] uppercase font-bold text-sf-muted">{t("workbenchUi.excludedIncomplete")}</span>
                        <div className="text-xl font-bold text-sf-text mt-0.5">
                            {t(excluded.length === 1 ? "workbenchUi.itemOne" : "workbenchUi.itemMany", { count: excluded.length })}
                        </div>
                    </div>
                    <AlertTriangle size={24} className="text-amber-500" />
                </div>
            </div>

            {/* Included Items List */}
            <div className="rounded-xl border border-sf-divider overflow-hidden bg-sf-surface">
                <div className="px-4 py-2.5 bg-sf-canvas/80 font-semibold text-sf-text text-xs flex items-center justify-between border-b border-sf-divider">
                    <span>{t("workbenchUi.includedDeterminationsCount", { count: included.length })}</span>
                    <span data-bench-verdict="pass" className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold rounded px-1"><CheckCircle2 size={16} aria-hidden="true" className="inline mr-1" />{t("workbenchUi.readyToRecord")}</span>
                </div>
                <div className="divide-y divide-sf-divider max-h-64 overflow-y-auto bg-sf-surface">
                    {included.map((item, idx) => (
                        <div key={item.workItemId || idx} data-testid="bench-completion-row" className="p-3 flex items-center justify-between text-xs">
                            <div>
                                <span className="font-bold text-sf-text font-mono">
                                    {item.labSampleCode || t('benchErgonomics.codeMissing')}
                                </span>
                                <span className="text-sf-muted mx-2">·</span>
                                <span className="text-sf-text font-medium">
                                    {getAnalysisDisplayName(item.analysis, item.analysisName)}
                                </span>
                                <span className="text-sf-muted text-[11px] ml-2">
                                    {t('benchErgonomics.position')}: {item.rackPosition ?? t('benchErgonomics.unknown')} {t("workbenchUi.basis")} {item.basis || t("workbenchUi.airDry")}{t("workbenchUi.rep")} {item.replicateNo || 1}
                                </span>
                                <CalculationEvidence evidence={item.calculationEvidence} t={t} />
                                {messages(item).length > 0 && <ul aria-label={t('benchErgonomics.flags')} data-bench-verdict="warning" className="mt-1 rounded p-1">
                                    {messages(item).map((message, index) => <li key={index}><AlertTriangle size={16} aria-hidden="true" className="inline mr-1" />{message}</li>)}
                                </ul>}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                    {valueText(item)}{!item.checks && <span className="ml-1">{item.displayUnit || t('benchErgonomics.unitUnknown')}</span>}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300">{t("workbenchUi.included")}</span>
                            </div>
                        </div>
                    ))}
                    {included.length === 0 && (
                        <div className="p-4 text-center text-xs text-sf-muted">
                            <span>{t("workbenchUi.noItemsMeetTheCompletionReadinessRequirements")}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Excluded Items (if any) */}
            {excluded.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 overflow-hidden bg-sf-surface">
                    <div className="px-4 py-2.5 bg-amber-500/10 font-semibold text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between border-b border-amber-500/20">
                        <span>{t("workbenchUi.excludedItemsCount", { count: excluded.length })}</span>
                        <span data-bench-verdict="warning" className="text-[11px] text-amber-800 dark:text-amber-300 font-bold rounded px-1"><AlertTriangle size={16} aria-hidden="true" className="inline mr-1" />{t("workbenchUi.remainsDraft")}</span>
                    </div>
                    <div className="divide-y divide-sf-divider max-h-48 overflow-y-auto bg-sf-surface">
                        {excluded.map((item, idx) => (
                            <div key={item.workItemId || idx} data-testid="bench-completion-row" className="p-3 flex items-center justify-between text-xs">
                                <div>
                                    <span className="font-bold text-sf-text font-mono">
                                        {item.labSampleCode || t('benchErgonomics.codeMissing')}
                                    </span>
                                    <span className="text-sf-muted mx-2">·</span>
                                    <span className="text-sf-muted">{getAnalysisDisplayName(item.analysis, item.analysisName)}</span>
                                    <div><span>{t('benchErgonomics.position')}: {item.rackPosition ?? t('benchErgonomics.unknown')} | {valueText(item)} {!item.checks && (item.displayUnit || t('benchErgonomics.unitUnknown'))}</span></div>
                                    <div className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                                        <span>• {messages(item).join('; ') || t('benchErgonomics.incomplete')}</span>
                                    </div>
                                </div>
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300">{t("controlCharts.excluded")}</span>
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
                        {t('benchErgonomics.confirm')}
                    </span>
                </label>

                <div className="flex items-center justify-between pt-2 border-t border-sf-divider">
                    <span className="text-xs text-sf-muted">
                        {t(included.length === 1 ? "workbenchUi.recordedOne" : "workbenchUi.recordedMany", { count: included.length })}</span>
                    <button
                        type="button"
                        onClick={handleRecord}
                        disabled={!confirmed || !included.length || isSubmitting}
                        className="px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                    >
                        {isSubmitting ? t("workbenchUi.recording") : t(included.length === 1 ? "workbenchUi.recordOne" : "workbenchUi.recordMany", { count: included.length })}
                        <ArrowRight size={13} />
                    </button>
                </div>
            </div>
        </div>
    );
}
