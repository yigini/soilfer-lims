import checklists from '../../../../server/data/operationalChecklists.json';
import React from 'react';
import { CheckSquare, Square, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

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
    onConfirm = null
}) {
    const rawChecks = Array.isArray(checks) ? checks : [false, false, false];

    const fallbackSteps = analysis === 'DRYING' ? [
        'Sample container inspected and sample identity verified against intake record',
        'Sample spread evenly on clean drying tray and placed in drying facility (<= 40°C)',
        'Drying completed to constant weight and recorded in preparation log'
    ] : [
        'Sample identity and completed drying record verified',
        'Required preparation steps completed according to the applicable laboratory procedure',
        'Prepared material and retained portions labelled for their intended analyses'
    ];

    const sopSteps = checklists[analysis]?.steps || fallbackSteps;

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
                    <span>Legacy Completion — Evidence Gap</span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-tight">
                    Recorded as “Done” without procedural checklist evidence. Dependent result entry requires documented verification or an authorized new preparation attempt.
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
                        <span>Checklist Verified</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                        {savedReceipt.receiptId}
                    </span>
                </div>
                <div className="space-y-1 mt-0.5">
                    {sopSteps.map((step, idx) => (
                        <div key={idx} className="flex items-start gap-1.5 text-[11px] text-sf-text">
                            <CheckSquare size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>{step}</span>
                        </div>
                    ))}
                </div>
                <div className="text-[10px] text-sf-muted mt-1 border-t border-sf-divider pt-1">
                    Confirmed by {savedReceipt.recordedBy || 'Technician'} · {savedReceipt.recordedAt ? new Date(savedReceipt.recordedAt).toLocaleString() : 'Recorded'}
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
                            <span className="leading-snug">{step}</span>
                        </button>
                    );
                })}
            </div>

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
                            <span>Operational checklist complete</span>
                        </>
                    ) : (
                        <span>Checklist: {completedCount}/{sopSteps.length} confirmed</span>
                    )}
                </span>

                {isAllComplete && onConfirm && !disabled && (
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="px-2.5 py-1 bg-sf-primary hover:bg-sf-primary-hover text-sf-on-primary rounded text-xs font-bold shadow-sm transition-colors"
                    >
                        Confirm Complete
                    </button>
                )}
            </div>
        </div>
    );
}
