import checklists from '../../../../server/data/operationalChecklists.json';
import React from 'react';
import { CheckSquare, Square, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import PreparationRecordFields from './PreparationRecordFields';
import { useLanguage } from '../../context/LanguageContext';

/**
 * OperationalTaskEditor
 * SOP verification checklist editor for operational tasks (Drying & Preparation).
 * Guarantees that operational completion uses verifiable checklist evidence rather
 * than invented numeric results. Displays durable receipts and flags evidence gaps.
 */
export default function OperationalTaskEditor({
    analysis,
    checks = [false, false, false],
    onChange,
    disabled = false,
    sampleId = '',
    savedReceipt = null,
    isEvidenceGap = false,
    onConfirm = null,
    preparationSteps = null,
    records = [],
    onRecordsChange = null,
    equipment = []
}) {
    const { t } = useLanguage();
    const rawChecks = Array.isArray(checks) ? checks : [false, false, false];

    const fallbackSteps = analysis === 'DRYING' ? [
        t('workbenchRare.checklist.fallbackDRYING0'),
        t('workbenchRare.checklist.fallbackDRYING1'),
        t('workbenchRare.checklist.fallbackDRYING2')
    ] : [
        t('workbenchRare.checklist.PREPARATION0'),
        t('workbenchRare.checklist.PREPARATION1'),
        t('workbenchRare.checklist.PREPARATION2')
    ];

    const sopSteps = checklists[analysis]?.steps || fallbackSteps;

    const displayStep = (step, index) => checklists[analysis]?.steps
        ? t(`workbenchRare.checklist.${analysis}${index}`) : step;

    const toggleCheck = (index) => {
        if (disabled || savedReceipt) return;
        const next = [...rawChecks];
        while (next.length < sopSteps.length) next.push(false);
        next[index] = !next[index];
        if (onChange) onChange(next);
    };

    const completedCount = rawChecks.filter(c => c === true).length;
    const isAllComplete = sopSteps.length > 0 && completedCount === sopSteps.length;

    // 1. Evidence Gap State (Legacy "Done" with no checklist)
    if (isEvidenceGap) {
        return (
            <div className="flex flex-col gap-2 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                    <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{t('workbenchRare.evidenceGap')}</span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-tight">
                    {t('workbenchRare.evidenceGapDescription')}
                </p>
            </div>
        );
    }

    // 2. Verified Saved Receipt State
    if (savedReceipt) {
        return (
            <div className="flex flex-col gap-2 p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs">
                <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" />
                        <span>{t('workbenchRare.checklistVerified')}</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                        {savedReceipt.receiptId}
                    </span>
                </div>
                <div className="space-y-1 mt-0.5">
                    {sopSteps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-[11px] text-sf-text">
                            <CheckSquare size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>{displayStep(step, idx)}</span>
                        </div>
                    ))}
                </div>
                {(savedReceipt.preparationRecords || []).map(row => (
                    <div key={row.id} className="text-[10px] text-sf-text font-mono">
                        {[row.gateCode && t(`workbench.preparationRecord.steps.${row.gateCode}`, row.gateCode), row.method && t(`workbench.preparationRecord.methods.${row.method}`, row.method), row.temperatureC != null && `${row.temperatureC} °C`, row.sieveMm != null && `${row.sieveMm} mm`,
                            row.coarseFractionPct != null && `${row.coarseFractionPct} %`, row.grindMm != null && `${row.grindMm} mm`,
                            `${row.durationMinutes} min`].filter(Boolean).join(' · ')}
                    </div>
                ))}
                <div className="text-[10px] text-sf-muted mt-1 border-t border-sf-divider pt-1">
                    {t('workbenchRare.confirmedBy', { actor: savedReceipt.recordedBy || t('workbenchRare.technician'), date: savedReceipt.recordedAt ? new Date(savedReceipt.recordedAt).toLocaleString() : t('workbenchRare.recorded') })}
                </div>
            </div>
        );
    }

    // 3. Active Technician Checklist Execution
    return (
        <div className="flex flex-col gap-2 py-1">
            <div className="flex flex-col gap-1.5">
                {sopSteps.map((step, idx) => {
                    const isChecked = !!rawChecks[idx];
                    return (
                        <button
                            type="button"
                            key={idx}
                            onClick={() => toggleCheck(idx)}
                            disabled={disabled}
                            className={`flex items-start gap-2 text-left p-1.5 rounded transition-colors text-xs
                                ${isChecked
                                    ? 'bg-sf-primary/10 text-sf-text'
                                    : 'hover:bg-sf-hover text-sf-muted hover:text-sf-text'
                                }
                                ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                            `}
                        >
                            <span className="mt-0.5 text-sf-primary flex-shrink-0">
                                {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                            </span>
                            <span className="leading-snug">{displayStep(step, idx)}</span>
                        </button>
                    );
                })}
            </div>

            <PreparationRecordFields steps={preparationSteps || (analysis === 'DRYING' ? ['DRYING'] : [])} records={records}
                onChange={onRecordsChange} equipment={equipment} disabled={disabled} />

            <div className="flex items-center justify-between gap-2 mt-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium
                    ${isAllComplete
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    }`}
                >
                    {isAllComplete ? (
                        <>
                            <CheckCircle2 size={12} />
                            <span>{t('workbenchRare.checklistComplete')}</span>
                        </>
                    ) : (
                        <span>{t('workbenchRare.checklistCount', { count: completedCount, total: sopSteps.length })}</span>
                    )}
                </span>

                {isAllComplete && onConfirm && !disabled && (
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="px-2.5 py-1 bg-sf-primary hover:bg-sf-primary-hover text-sf-on-primary rounded text-xs font-bold shadow-sm transition-colors"
                    >
                        {t('plainLabels.confirmWorkDone')}
                    </button>
                )}
            </div>
        </div>
    );
}
