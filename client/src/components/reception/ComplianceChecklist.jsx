
import React from 'react';
import { AlertCircle, Check, X, HelpCircle, ShieldCheck, Minus } from 'lucide-react';
import InfoTooltip from '../common/InfoTooltip';

const CHECKLIST_ITEMS = [
    {
        key: 'container',
        label: 'Container Intact / Sealed',
        tooltip: 'Verify the sample bag or container is not torn, open, or leaking. Compromised containers may lead to contamination.',
        failHint: 'e.g. Bag torn, lid loose, visible leakage...'
    },
    {
        key: 'label',
        label: 'Label Legible & Matches ID',
        tooltip: 'Confirm the label on the container matches the scanned/entered Sample ID. Illegible labels risk misidentification.',
        failHint: 'e.g. Smudged ink, wrong ID on label...'
    },
    {
        key: 'quantity',
        label: 'Sample Quantity Sufficient',
        tooltip: 'Ensure there is enough material (~500g minimum) to perform all requested analyses.',
        failHint: 'e.g. Less than 200g, half-empty bag...'
    },
    {
        key: 'condition',
        label: 'Sample Condition (Dry, No Contam.)',
        tooltip: 'Check that the sample is air-dry and free of visible contaminants (rocks, roots, mold, excessive moisture).',
        failHint: 'e.g. Wet/muddy, contains large roots, mold...'
    },
    {
        key: 'coc',
        label: 'Chain of Custody Present',
        tooltip: 'A Chain of Custody document should accompany the sample, recording who collected and delivered it.',
        failHint: 'e.g. No CoC form, missing signatures...'
    }
];

const ComplianceChecklist = ({ value, onChange, onNonConformance, showIncomplete = false }) => {
    // value = { items: { container: { status: 'PASS'|'FAIL'|'NA'|undefined, note: '' } }, nonConformance: false, reason: '' }

    const setStatus = (key, status) => {
        const newItems = {
            ...value?.items,
            [key]: { ...value?.items?.[key], status }
        };
        const newValue = { ...value, items: newItems };
        onChange(newValue);

        // Auto-flag NC if any FAIL
        if (status === 'FAIL') {
            onNonConformance(true);
        }
    };

    const updateNote = (key, note) => {
        const newItems = {
            ...value?.items,
            [key]: { ...value?.items?.[key], note }
        };
        onChange({ ...value, items: newItems });
    };

    // Progress calculation
    const totalItems = CHECKLIST_ITEMS.length;
    const checkedCount = CHECKLIST_ITEMS.filter(
        item => value?.items?.[item.key]?.status && value?.items?.[item.key]?.status !== undefined
    ).length;
    const passCount = CHECKLIST_ITEMS.filter(
        item => value?.items?.[item.key]?.status === 'PASS'
    ).length;
    const failCount = CHECKLIST_ITEMS.filter(
        item => value?.items?.[item.key]?.status === 'FAIL'
    ).length;
    const pendingCount = totalItems - checkedCount;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    <ShieldCheck size={20} className="text-blue-600" /> Reception Compliance
                    <InfoTooltip text="Verify each item by clicking ✓ Pass or ✗ Fail. All items must be checked before completing the intake." />
                </h3>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                    {pendingCount > 0 ? (
                        <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full">
                            {pendingCount} pending
                        </span>
                    ) : failCount > 0 ? (
                        <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2.5 py-1 rounded-full">
                            {failCount} failed
                        </span>
                    ) : (
                        <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full">
                            All clear ✓
                        </span>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                {passCount > 0 && (
                    <div
                        className="h-full bg-emerald-400 transition-all duration-500"
                        style={{ width: `${(passCount / totalItems) * 100}%` }}
                    />
                )}
                {failCount > 0 && (
                    <div
                        className="h-full bg-red-400 transition-all duration-500"
                        style={{ width: `${(failCount / totalItems) * 100}%` }}
                    />
                )}
            </div>

            {/* Checklist items */}
            <div className="space-y-2">
                {CHECKLIST_ITEMS.map((item) => {
                    const status = value?.items?.[item.key]?.status; // undefined = not yet checked
                    const isPending = !status;
                    const isPass = status === 'PASS';
                    const isFail = status === 'FAIL';
                    const isNA = status === 'NA';

                    return (
                        <div
                            key={item.key}
                            className={`rounded-xl border transition-all duration-200 ${isPending
                                ? (showIncomplete ? 'border-red-400 ring-1 ring-red-200 bg-red-50/50 dark:bg-red-900/20' : 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20') :
                                isPass ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20' :
                                    isFail ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' :
                                        'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                                }`}
                        >
                            <div className="flex items-center gap-3 p-3">
                                {/* Label + tooltip */}
                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                    {isPending && (
                                        <div className="w-5 h-5 rounded-full border-2 border-dashed border-amber-300 flex-shrink-0" />
                                    )}
                                    {isPass && (
                                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                                            <Check size={12} className="text-white" strokeWidth={3} />
                                        </div>
                                    )}
                                    {isFail && (
                                        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                                            <X size={12} className="text-white" strokeWidth={3} />
                                        </div>
                                    )}
                                    {isNA && (
                                        <div className="w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center flex-shrink-0">
                                            <Minus size={12} className="text-white" strokeWidth={3} />
                                        </div>
                                    )}
                                    <span className={`font-medium text-sm truncate ${isFail ? 'text-red-800 dark:text-red-400' : isNA ? 'text-gray-500 dark:text-gray-400' : isPending ? 'text-amber-900 dark:text-amber-400' : 'text-gray-800 dark:text-gray-200'
                                        }`}>
                                        {item.label}
                                    </span>
                                    <InfoTooltip text={item.tooltip} />
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                        onClick={() => setStatus(item.key, 'PASS')}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1 ${isPass
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                                            }`}
                                        title="Mark as Pass"
                                    >
                                        <Check size={12} strokeWidth={3} /> OK
                                    </button>
                                    <button
                                        onClick={() => setStatus(item.key, 'FAIL')}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1 ${isFail
                                            ? 'bg-red-600 text-white shadow-sm'
                                            : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30'
                                            }`}
                                        title="Mark as Fail"
                                    >
                                        <X size={12} strokeWidth={3} /> Fail
                                    </button>
                                    <button
                                        onClick={() => setStatus(item.key, 'NA')}
                                        className={`px-1.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${isNA
                                            ? 'bg-gray-500 text-white shadow-sm'
                                            : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                            }`}
                                        title="Not Applicable"
                                    >
                                        N/A
                                    </button>
                                </div>
                            </div>

                            {/* Failure note input (slides in) */}
                            {isFail && (
                                <div className="px-3 pb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <input
                                        placeholder={item.failHint}
                                        className="w-full text-sm p-2 border border-red-200 dark:border-red-800 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-red-300 focus:border-red-300 outline-none placeholder:text-red-300 dark:placeholder:text-red-700 dark:text-gray-100"
                                        value={value?.items?.[item.key]?.note || ''}
                                        onChange={(e) => updateNote(item.key, e.target.value)}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Quick actions */}
            <div className="flex gap-2">
                <button
                    onClick={() => {
                        const newItems = {};
                        CHECKLIST_ITEMS.forEach(item => {
                            newItems[item.key] = { ...value?.items?.[item.key], status: 'PASS' };
                        });
                        onChange({ ...value, items: newItems });
                    }}
                    className="text-xs text-emerald-600 hover:text-emerald-800 font-bold px-2 py-1 rounded hover:bg-emerald-50 transition-colors"
                >
                    ✓ Mark all OK
                </button>
                <button
                    onClick={() => {
                        const newItems = {};
                        CHECKLIST_ITEMS.forEach(item => {
                            newItems[item.key] = { status: undefined, note: '' };
                        });
                        onChange({ ...value, items: newItems });
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 font-bold px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                >
                    Reset all
                </button>
            </div>

            {/* Non-Conformance flag */}
            <div className={`pt-4 border-t transition-colors ${value?.nonConformance ? 'border-red-200 dark:border-red-800' : 'border-gray-200 dark:border-gray-700'}`}>
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all ${value?.nonConformance
                    ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-red-200 hover:bg-red-50/30 dark:hover:bg-red-900/10'
                    }`}>
                    <input
                        type="checkbox"
                        checked={value?.nonConformance || false}
                        onChange={(e) => onNonConformance(e.target.checked)}
                        className="w-5 h-5 accent-red-600 rounded"
                    />
                    <div className="flex-1">
                        <span className={`font-bold text-sm ${value?.nonConformance ? 'text-red-700 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'}`}>
                            Flag as Non-Conformance
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Flags this sample for manager review before processing can begin
                        </p>
                    </div>
                    <AlertCircle size={18} className={value?.nonConformance ? 'text-red-500' : 'text-gray-300'} />
                </label>
                {value?.nonConformance && (
                    <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <label className="block text-xs font-bold text-red-600 mb-1 uppercase tracking-wider">
                            Non-Conformance Description *
                        </label>
                        <textarea
                            className="w-full p-3 border border-red-300 dark:border-red-800 bg-white dark:bg-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-red-300 outline-none placeholder:text-red-300 dark:placeholder:text-red-700 resize-none dark:text-gray-100"
                            placeholder="Describe the issue requiring attention..."
                            value={value?.reason || ''}
                            onChange={(e) => onChange({ ...value, reason: e.target.value })}
                            rows={3}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComplianceChecklist;
