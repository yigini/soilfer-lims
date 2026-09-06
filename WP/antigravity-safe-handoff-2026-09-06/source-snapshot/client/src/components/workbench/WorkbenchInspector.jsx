import { useAnalysisNames } from '../../context/AnalysisCatalogueContext';
import React from 'react';
import {
    CheckCircle2, AlertTriangle, XCircle, Clock, ShieldCheck,
    FlaskConical, Trash2, Wrench
} from 'lucide-react';
import ConflictComparePanel from './ConflictComparePanel';

/**
 * WorkbenchInspector
 * Contextual side panel docked at 240px displaying:
 * - Selected determination metadata
 * - Prerequisite trail (Intake, Drying, Preparation)
 * - Instrument qualification & calibration health
 * - Basis and replicate parameters
 * - Concurrency conflict comparison & discard actions
 */
export default function WorkbenchInspector({
    selectedItem,
    methodDefinition,
    eligibleEquipment = [],
    onUpdateMeta,
    onDiscardDraft,
    onResolveConflict,
    isDiscarding = false
}) {
    const getAnalysisDisplayName = useAnalysisNames();
    if (!selectedItem) {
        return (
            <aside className="w-full lg:w-64 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 text-xs flex items-center justify-center min-h-[300px]">
                <span>Select a row to inspect sample context and metadata.</span>
            </aside>
        );
    }

    const {
        workItemId,
        sampleId,
        sampleDisplayId,
        labId,
        originalId,
        projectCode,
        analysis,
        status,
        dryingStatus,
        preparationStatus,
        readiness,
        draft
    } = selectedItem;

    const hasConflict = !!draft?.conflictValue;
    const isLocked = !readiness?.isReady || ['COMPLETED', 'SUBMITTED', 'ACCEPTED', 'WAIVED'].includes(status);
    const isOperationalGate = selectedItem.editorKind === 'OPERATIONAL' || ['DRYING', 'PREPARATION'].includes(analysis) || selectedItem.category === 'Operational Gates';

    const basis = draft?.basis || 'AIR_DRY';
    const replicateNo = draft?.replicateNo || 1;
    const selectedEquipId = draft?.instrumentId || selectedItem.equipmentId || '';

    const selectedAsset = eligibleEquipment.find(e => e.id === selectedEquipId);

    return (
        <aside className="w-full lg:w-64 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-4 text-xs">
            {/* Header / Identity */}
            <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Selected Sample
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                    {sampleDisplayId || labId || originalId || 'Sample'}
                </h3>
                {originalId && (
                    <p className="text-[11px] text-slate-500 truncate">Field ID: {originalId}</p>
                )}
                <p className="text-[11px] text-slate-500 mt-0.5">
                    {getAnalysisDisplayName(analysis, methodDefinition?.name)}
                </p>
                {projectCode && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {projectCode}
                    </span>
                )}
            </div>

            {/* Conflict Compare Panel */}
            {hasConflict && (
                <ConflictComparePanel
                    localValue={draft.value}
                    serverValue={draft.conflictValue}
                    onUseServer={() => onResolveConflict(workItemId, 'USE_SERVER')}
                    onKeepLocal={(reason) => onResolveConflict(workItemId, 'KEEP_LOCAL', reason)}
                />
            )}

            {/* Readiness Summary */}
            <div className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-800/50">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5">
                    Execution Readiness
                </span>
                <div className="flex items-center gap-1.5 mb-1">
                    {readiness?.isReady ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 size={11} /> Ready to Record
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
                            <AlertTriangle size={11} /> Blocked
                        </span>
                    )}
                </div>
                {readiness?.reasons?.map((reason, i) => (
                    <p key={i} className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug mt-1">
                        • {reason}
                    </p>
                ))}
            </div>

            {/* Prerequisite Trail */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2">
                    Prerequisite Trail
                </span>
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 dark:text-slate-400">Reception Intake:</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">✓ Accepted</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 dark:text-slate-400">Drying Gate:</span>
                        <span className={`font-medium ${dryingStatus === 'DONE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                            {dryingStatus === 'DONE' ? '✓ Completed' : dryingStatus || 'Pending'}
                        </span>
                    </div>
                    {!isOperationalGate && (
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-600 dark:text-slate-400">Preparation Gate:</span>
                            <span className={`font-medium ${preparationStatus === 'DONE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                                {preparationStatus === 'DONE' ? '✓ Completed' : preparationStatus || 'Pending'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Methodology Parameters */}
            {!isOperationalGate && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-3 flex flex-col gap-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Determination Identity
                    </span>

                    {/* Result Basis */}
                    <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Result Basis
                        </label>
                        <select
                            disabled={isLocked}
                            value={basis}
                            onChange={(e) => onUpdateMeta(workItemId, 'basis', e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                            <option value="AIR_DRY">Air-dry (standard)</option>
                            <option value="OVEN_DRY">Oven-dry (105°C moisture-corrected)</option>
                            <option value="FIELD_MOIST">Field-moist</option>
                        </select>
                    </div>

                    {/* Replicate Number */}
                    <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Replicate Determination
                        </label>
                        <select
                            disabled={isLocked}
                            value={replicateNo}
                            onChange={(e) => onUpdateMeta(workItemId, 'replicateNo', Number(e.target.value))}
                            className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                            <option value={1}>Replicate 1 (Primary)</option>
                            <option value={2}>Replicate 2 (Quality duplicate)</option>
                            <option value={3}>Replicate 3 (Triplicate)</option>
                        </select>
                    </div>

                    {/* Instrument Selector */}
                    <div>
                        <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Instrument Qualification
                        </label>
                        <select
                            disabled={isLocked || eligibleEquipment.length === 0}
                            value={selectedEquipId}
                            onChange={(e) => onUpdateMeta(workItemId, 'instrumentId', e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                            <option value="">-- Select Instrument --</option>
                            {eligibleEquipment.map(eq => (
                                <option key={eq.id} value={eq.id}>
                                    {eq.name} ({eq.calibrationStatus})
                                </option>
                            ))}
                        </select>

                        {/* Calibration Indicator */}
                        {selectedAsset && (
                            <div className="flex items-center gap-1 mt-1 text-[11px]">
                                <Wrench size={11} className="text-slate-400" />
                                <span className="text-slate-500">Calibration:</span>
                                <span className={`font-semibold ${
                                    selectedAsset.calibrationStatus === 'OK' ? 'text-emerald-600' :
                                    selectedAsset.calibrationStatus === 'DUE_SOON' ? 'text-amber-600' :
                                    'text-red-600'
                                }`}>
                                    {selectedAsset.calibrationStatus}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Discard Draft Action */}
            {draft && !isLocked && (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                    <button
                        type="button"
                        onClick={() => onDiscardDraft(workItemId)}
                        disabled={isDiscarding}
                        className="w-full py-1.5 px-2 rounded text-xs font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center justify-center gap-1.5 transition-colors"
                    >
                        <Trash2 size={13} />
                        <span>Discard Local Draft</span>
                    </button>
                    <p className="text-[10px] text-slate-400 text-center mt-1">
                        Purges draft and returns item to Assigned status.
                    </p>
                </div>
            )}
        </aside>
    );
}
