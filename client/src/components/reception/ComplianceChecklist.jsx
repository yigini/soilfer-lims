
import React from 'react';
import { AlertCircle, Check, X, HelpCircle, ShieldCheck, Minus, Camera, Loader2 } from 'lucide-react';
import InfoTooltip from '../common/InfoTooltip';
import { useLanguage } from '../../context/LanguageContext';

const ComplianceChecklist = ({
    value,
    onChange,
    onNonConformance,
    showIncomplete = false,
    photos = [],
    onUploadPhoto,
    onRemovePhoto,
    uploadingPhoto = false,
    isWalkIn = false
}) => {
    const { t } = useLanguage();

    const CHECKLIST_ITEMS = [
        {
            key: 'container',
            label: t('reception.containerIntact', 'Container Intact / Sealed'),
            tooltip: t('reception.containerTooltip', 'Verify the sample bag or container is not torn, open, or leaking. Compromised containers may lead to contamination.'),
            failHint: 'e.g. Bag torn, lid loose, visible leakage...'
        },
        {
            key: 'label',
            label: t('reception.labelLegible', 'Label Legible & Matches ID'),
            tooltip: t('reception.labelTooltip', 'Confirm the label on the container matches the scanned/entered Sample ID. Illegible labels risk misidentification.'),
            failHint: 'e.g. Smudged ink, wrong ID on label...'
        },
        {
            key: 'quantity',
            label: t('reception.quantitySufficient', 'Sample Quantity Sufficient'),
            tooltip: t('reception.quantityTooltip', 'Ensure there is enough material (~500g minimum) to perform all requested analyses.'),
            failHint: 'e.g. Less than 200g, half-empty bag...'
        },
        {
            key: 'condition',
            label: t('reception.conditionDry', 'Sample Condition (Dry, No Contam.)'),
            tooltip: t('reception.conditionTooltip', 'Check that the sample is air-dry and free of visible contaminants (rocks, roots, mold, excessive moisture).'),
            failHint: 'e.g. Wet/muddy, contains large roots, mold...'
        },
        {
            key: 'coc',
            label: t('reception.cocPresent', 'Chain of Custody Present'),
            tooltip: t('reception.cocTooltip', 'A Chain of Custody document should accompany the sample, recording who collected and delivered it.'),
            failHint: 'e.g. No CoC form, missing signatures...'
        }
    ];

    // Helper: N/A is strictly prohibited for standard criteria, and permitted for CoC only when isWalkIn is true
    const isNAAllowed = (key) => key === 'coc' && Boolean(isWalkIn);

    // value = { items: { container: { status: 'PASS'|'FAIL'|'NA'|undefined, note: '' } }, nonConformance: false, reason: '' }

    const setStatus = (key, status) => {
        if (status === 'NA' && !isNAAllowed(key)) {
            console.warn(`[ComplianceChecklist] N/A is not permitted for criterion: ${key}`);
            return;
        }

        const currentItems = value?.items || {};
        const newItems = {
            ...currentItems,
            [key]: { ...currentItems[key], status }
        };
        const anyFail = Object.values(newItems).some(it => it?.status === 'FAIL');
        const wasFailBefore = Object.values(currentItems).some(it => it?.status === 'FAIL');

        // Check if an independent other-problem was recorded or active
        const hasOther = Boolean(value?.otherProblem || (wasFailBefore && !anyFail && value?.reason?.trim() && value?.otherProblem !== false));

        // Atomically determine non-conformance flag:
        // If any item is FAIL, nonConformance must be true.
        // If an item was corrected from FAIL and now zero items fail:
        // preserve nonConformance only if an other problem was recorded.
        let newNC = false;
        if (anyFail) {
            newNC = true;
        } else if (hasOther) {
            newNC = true;
        }

        const newValue = {
            ...value,
            items: newItems,
            nonConformance: newNC,
            otherProblem: hasOther ? true : (anyFail ? value?.otherProblem : false)
        };

        // Single atomic state update to prevent stale-closure parent overwrite (#117, #113)
        onChange(newValue);
    };

    const updateNote = (key, note) => {
        const currentItems = value?.items || {};
        const newItems = {
            ...currentItems,
            [key]: { ...currentItems[key], note }
        };
        onChange({ ...value, items: newItems });
    };

    // Progress calculation & compliance assessment
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
    const anyFail = failCount > 0;
    const hasUnanswered = pendingCount > 0;

    // Derived routine compliant outcome:
    // All items checked, none failed, and every item is either PASS or permitted NA (#113)
    const allCompliant = !hasUnanswered && !anyFail && CHECKLIST_ITEMS.every(item => {
        const s = value?.items?.[item.key]?.status;
        return s === 'PASS' || (s === 'NA' && isNAAllowed(item.key));
    });

    // Explicit other-problem route (uncovered by checklist):
    const hasOtherProblem = Boolean(value?.otherProblem || (!anyFail && value?.reason?.trim()));

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-sf-text flex items-center gap-2">
                    <ShieldCheck size={20} className="text-blue-600" /> {t('reception.receptionCompliance', 'Reception Compliance')}
                    <InfoTooltip text={t('reception.complianceTooltip', 'Verify each item by clicking ✓ Pass or ✗ Fail. All items must be checked before completing the intake.')} />
                </h3>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                    {pendingCount > 0 ? (
                        <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full">
                            {t('reception.pendingCount', { count: pendingCount }, `${pendingCount} pending`)}
                        </span>
                    ) : failCount > 0 ? (
                        <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2.5 py-1 rounded-full">
                            {t('reception.failedCount', { count: failCount }, `${failCount} failed`)}
                        </span>
                    ) : (
                        <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full">
                            {t('reception.allClear', 'All clear ✓')}
                        </span>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-sf-canvas rounded-full overflow-hidden flex">
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
                                        'border-sf-divider bg-sf-surface'
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
                                    <span className={`font-medium text-sm truncate ${isFail ? 'text-red-800 dark:text-red-400' : isNA ? 'text-sf-muted' : isPending ? 'text-amber-900 dark:text-amber-400' : 'text-sf-text'
                                        }`}>
                                        {item.label}
                                    </span>
                                    {isFail && (
                                        <span className="text-[10px] font-black uppercase text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                            <X size={10} strokeWidth={3} /> Fail
                                        </span>
                                    )}
                                    {isPass && (
                                        <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                            <Check size={10} strokeWidth={3} /> OK
                                        </span>
                                    )}
                                    <InfoTooltip text={item.tooltip} />
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-1 flex-shrink-0" role="radiogroup" aria-label={item.label}>
                                    <button
                                        type="button"
                                        role="radio"
                                        aria-checked={isPass}
                                        aria-label={`${item.label}: OK`}
                                        onClick={() => setStatus(item.key, 'PASS')}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1 ${isPass
                                            ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                                            : 'bg-sf-surface border border-sf-divider text-sf-muted hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                                            }`}
                                        title="Mark as Pass"
                                    >
                                        <Check size={12} strokeWidth={3} /> OK
                                    </button>
                                    <button
                                        type="button"
                                        role="radio"
                                        aria-checked={isFail}
                                        aria-label={`${item.label}: Fail`}
                                        onClick={() => setStatus(item.key, 'FAIL')}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center gap-1 ${isFail
                                            ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-400'
                                            : 'bg-sf-surface border border-sf-divider text-sf-muted hover:border-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30'
                                            }`}
                                        title="Mark as Fail"
                                    >
                                        <X size={12} strokeWidth={3} /> Fail
                                    </button>
                                    <button
                                        type="button"
                                        role="radio"
                                        aria-checked={isNA}
                                        aria-label={`${item.label}: N/A`}
                                        disabled={!isNAAllowed(item.key)}
                                        onClick={() => isNAAllowed(item.key) && setStatus(item.key, 'NA')}
                                        className={`px-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            !isNAAllowed(item.key)
                                                ? 'opacity-30 cursor-not-allowed bg-sf-surface border border-sf-divider text-sf-muted'
                                                : isNA
                                                    ? 'bg-gray-500 text-white shadow-sm ring-2 ring-gray-400 active:scale-95'
                                                    : 'bg-sf-surface border border-sf-divider text-sf-muted hover:border-sf-divider hover:text-sf-text active:scale-95'
                                        }`}
                                        title={!isNAAllowed(item.key)
                                            ? (item.key === 'coc'
                                                ? t('reception.cocNAShipmentDisabled', 'Chain of Custody N/A is permitted only for informal walk-in drop-offs')
                                                : t('reception.naNotPermitted', 'N/A is not permitted for mandatory reception criteria'))
                                            : 'Not Applicable'}
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
                                        className="w-full text-sm p-2 border border-red-200 dark:border-red-800 bg-sf-surface text-sf-text rounded-lg focus:ring-2 focus:ring-red-300 focus:border-red-300 outline-none placeholder:text-red-300 dark:placeholder:text-red-700"
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
                        const hasOther = Boolean(value?.otherProblem || (!anyFail && value?.reason?.trim()));
                        onChange({
                            ...value,
                            items: newItems,
                            nonConformance: hasOther,
                            otherProblem: hasOther,
                            reason: hasOther ? (value?.reason || '') : ''
                        });
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
                        onChange({ ...value, items: newItems, nonConformance: false, otherProblem: false, reason: '' });
                    }}
                    className="text-xs text-sf-muted hover:text-sf-text font-bold px-2 py-1 rounded hover:bg-sf-canvas transition-colors"
                >
                    Reset all
                </button>
            </div>

            {/* Routine Non-Conformance control (#113) */}
            <div className={`pt-4 border-t transition-colors ${(value?.nonConformance && anyFail) ? 'border-red-200 dark:border-red-800' : 'border-sf-divider'}`}>
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 border-dashed transition-all ${
                    allCompliant
                        ? 'border-sf-divider bg-sf-surface/50 opacity-50 cursor-not-allowed text-sf-muted'
                        : (value?.nonConformance && anyFail)
                            ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 cursor-pointer'
                            : 'border-sf-divider hover:border-red-200 hover:bg-red-50/30 dark:hover:bg-red-900/10 cursor-pointer'
                    }`}
                    title={allCompliant ? t('reception.ncDisabledAllCompliant', 'All quality checks are compliant. Routine non-conformance is unavailable.') : (!anyFail && hasUnanswered) ? t('reception.ncDisabledIncomplete', 'Complete checklist or mark failed criteria to enable routine non-conformance.') : undefined}
                >
                    <input
                        type="checkbox"
                        aria-label="Flag as Non-Conformance"
                        data-testid="routine-nc-checkbox"
                        checked={Boolean(value?.nonConformance && anyFail)}
                        disabled={allCompliant || !anyFail}
                        onChange={(e) => {
                            if (allCompliant || !anyFail) return;
                            const newNC = anyFail ? true : e.target.checked;
                            const newValue = {
                                ...value,
                                nonConformance: newNC
                            };
                            onChange(newValue);
                            if (onNonConformance) {
                                onNonConformance(newNC);
                            }
                        }}
                        className="w-5 h-5 accent-red-600 rounded cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm ${allCompliant ? 'text-sf-muted' : (value?.nonConformance && anyFail) ? 'text-red-700 dark:text-red-400' : 'text-sf-muted'}`}>
                                {t('reception.flagNonConformance', 'Flag as Non-Conformance')}
                            </span>
                            {allCompliant && (
                                <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 rounded">
                                    {t('reception.routineCompliant', 'Routine Compliant Outcome')}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-sf-muted mt-0.5">
                            {allCompliant
                                ? t('reception.ncDisabledHint', 'All quality checks are compliant. Routine non-conformance is unavailable.')
                                : anyFail
                                    ? t('reception.ncFailedHint', 'Flags this sample for manager review or rejection due to failed checklist criteria')
                                    : t('reception.ncRoutineHint', 'Flags this sample for manager review before processing can begin')}
                        </p>
                    </div>
                    <AlertCircle size={18} className={(value?.nonConformance && anyFail) ? 'text-red-500' : 'text-sf-muted'} />
                </label>

                {/* Routine Non-Conformance Description (Active when items fail) */}
                {value?.nonConformance && anyFail && (
                    <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                        <label className="block text-xs font-bold text-red-600 mb-1 uppercase tracking-wider">
                            {t('reception.nonConformanceDescription', 'Non-Conformance Description *')}
                        </label>
                        <textarea
                            data-testid="routine-nc-description"
                            className="w-full p-3 border border-red-300 dark:border-red-800 bg-sf-surface text-sf-text rounded-xl text-sm focus:ring-2 focus:ring-red-300 outline-none placeholder:text-red-300 dark:placeholder:text-red-700 resize-none"
                            placeholder={t('reception.describeIssue', 'Describe the issue requiring attention...')}
                            value={value?.reason || ''}
                            onChange={(e) => onChange({ ...value, reason: e.target.value })}
                            rows={3}
                        />
                    </div>
                )}

                {/* Clearly separate: Other problem not covered by checklist (#113) */}
                <div className="pt-3 mt-3 border-t border-sf-divider">
                    <div className={`rounded-xl border transition-all ${
                        hasOtherProblem
                            ? 'border-amber-400 dark:border-amber-600 bg-amber-50/50 dark:bg-amber-900/20'
                            : 'border-sf-divider bg-sf-surface hover:border-amber-200 dark:hover:border-amber-800/40'
                    }`}>
                        <label className="flex items-center gap-3 p-3 cursor-pointer">
                            <input
                                type="checkbox"
                                id="other-problem-toggle"
                                aria-label="Other problem not covered by checklist"
                                data-testid="other-problem-checkbox"
                                checked={hasOtherProblem}
                                onChange={(e) => {
                                    const checked = e.target.checked;
                                    const newNC = checked ? true : anyFail;
                                    const newValue = {
                                        ...value,
                                        otherProblem: checked,
                                        nonConformance: newNC,
                                        reason: checked ? (value?.reason || '') : (anyFail ? value?.reason : '')
                                    };
                                    onChange(newValue);
                                    if (onNonConformance) {
                                        onNonConformance(newNC);
                                    }
                                }}
                                className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className={`font-bold text-sm ${
                                        hasOtherProblem ? 'text-amber-800 dark:text-amber-300' : 'text-sf-muted'
                                    }`}>
                                        {t('reception.otherProblemTitle', 'Other problem not covered by checklist')}
                                    </span>
                                    {hasOtherProblem && (
                                        <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-2 py-0.5 rounded">
                                            {t('reception.uncoveredException', 'Uncovered Exception')}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-sf-muted mt-0.5">
                                    {t('reception.otherProblemHint', 'Report exceptional sample defects or anomalies outside standard quality checks (requires manager authorization)')}
                                </p>
                            </div>
                            <HelpCircle size={18} className={hasOtherProblem ? 'text-amber-600' : 'text-sf-muted'} />
                        </label>

                        {hasOtherProblem && (
                            <div className="p-3 pt-0 animate-in fade-in slide-in-from-top-1 duration-200">
                                <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 mb-1 uppercase tracking-wider">
                                    {t('reception.otherProblemDescription', 'Problem Description (Outside Checklist Criteria) *')}
                                </label>
                                <textarea
                                    id="other-problem-description"
                                    data-testid="other-problem-description"
                                    className="w-full p-2.5 border border-amber-300 dark:border-amber-700 bg-sf-surface text-sf-text rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none placeholder:text-amber-400/60 resize-none"
                                    placeholder={t('reception.otherProblemPlaceholder', 'Describe the specific sample condition, odor, contamination, or defect outside standard criteria...')}
                                    value={value?.reason || ''}
                                    onChange={(e) => {
                                        const newReason = e.target.value;
                                        onChange({
                                            ...value,
                                            otherProblem: true,
                                            reason: newReason,
                                            nonConformance: true
                                        });
                                    }}
                                    rows={2}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Photographic Evidence Attachment */}
                {(value?.nonConformance || hasOtherProblem) && (
                    <div className="mt-3 pt-2 border-t border-red-100 dark:border-red-900/30">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Camera size={14} /> Photographic Evidence ({photos.length})
                            </label>
                            {onUploadPhoto && (
                                <label className="cursor-pointer bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 px-2.5 py-1 rounded-lg text-xs font-bold hover:bg-red-200 dark:hover:bg-red-900/60 flex items-center gap-1 transition-colors">
                                    {uploadingPhoto ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                                    <span>{uploadingPhoto ? 'Uploading...' : 'Attach Photo'}</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        disabled={uploadingPhoto}
                                        onChange={onUploadPhoto}
                                    />
                                </label>
                            )}
                        </div>

                        {photos.length > 0 ? (
                            <div className="grid grid-cols-4 gap-2 pt-1">
                                {photos.map((url, idx) => (
                                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-red-200 dark:border-red-800 aspect-video bg-sf-canvas shadow-sm">
                                        <img src={url} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
                                        {onRemovePhoto && (
                                            <button
                                                type="button"
                                                onClick={() => onRemovePhoto(idx)}
                                                className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                                title="Remove"
                                            >
                                                <X size={10} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-[11px] text-sf-muted italic">No non-conformance photos attached yet.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComplianceChecklist;
