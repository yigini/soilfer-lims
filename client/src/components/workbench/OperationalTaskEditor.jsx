import React from 'react';
import { CheckSquare, Square, CheckCircle2 } from 'lucide-react';

/**
 * OperationalTaskEditor
 * SOP verification checklist editor for operational tasks (Drying & Preparation).
 * Guarantees that operational completion uses verifiable checklist evidence rather
 * than invented numeric results.
 */
export default function OperationalTaskEditor({
    analysis,
    checks = [false, false, false],
    onChange,
    disabled = false,
    sampleId = ''
}) {
    const rawChecks = Array.isArray(checks) ? checks : [false, false, false];

    const sopSteps = analysis === 'DRYING' ? [
        'Sample intake identity & batch bar-code verified',
        'Drying cabinet/oven maintained at 40°C ± 2°C',
        'Sample dried to constant mass and cooling protocol completed'
    ] : [
        'Dried sample identity & condition verified',
        'Crushed, milled, and sieved through 2.0 mm mesh',
        'Sub-sampling split and storage container labeled'
    ];

    const toggleCheck = (index) => {
        if (disabled) return;
        const next = [...rawChecks];
        while (next.length < sopSteps.length) next.push(false);
        next[index] = !next[index];
        onChange(next);
    };

    const completedCount = rawChecks.filter(Boolean).length;
    const isAllComplete = completedCount === sopSteps.length;

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
                                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                }
                                ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                            `}
                        >
                            <span className="mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                                {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                            </span>
                            <span className="leading-snug">{step}</span>
                        </button>
                    );
                })}
            </div>

            <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium
                    ${isAllComplete
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                    }`}
                >
                    {isAllComplete ? (
                        <>
                            <CheckCircle2 size={12} />
                            <span>SOP Checklist Complete (3/3)</span>
                        </>
                    ) : (
                        <span>Checklist: {completedCount}/{sopSteps.length} confirmed</span>
                    )}
                </span>
            </div>
        </div>
    );
}
