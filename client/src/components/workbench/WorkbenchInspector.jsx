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
            <aside className="w-full lg:w-64 p-4 rounded-xl border border-sf-divider bg-sf-surface text-sf-muted text-xs flex items-center justify-center min-h-[300px]">
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
        <aside className="w-full lg:w-64 p-4 rounded-xl border border-sf-divider bg-sf-surface flex flex-col gap-4 text-xs shadow-sm">
            {/* Header / Identity */}
            <div>
                <span className="sf-kicker block mb-1">
                    Selected Sample
                </span>
                <div className="my-1.5">
                    <span className="sf-sample-id text-base px-2.5 py-1">
                        {sampleDisplayId || labId || originalId || 'Sample'}
                    </span>
                </div>
                {originalId && (
                    <p className="text-[11px] text-sf-muted font-mono truncate">Field ID: {originalId}</p>
                )}
                <p className="text-[11px] text-sf-muted mt-1 font-medium">
                    {getAnalysisDisplayName(analysis, methodDefinition?.name)}
                </p>
                {projectCode && (
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-sf-inset text-sf-muted border border-sf-divider">
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
            <div className="p-3 rounded-lg border border-sf-divider bg-sf-inset">
                <span className="text-[10px] uppercase font-bold text-sf-muted block mb-1.5 tracking-wider">
                    Execution Readiness
                </span>
                <div className="flex items-center gap-1.5 mb-1">
                    {readiness?.isReady ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--sf-success-bg)] text-[var(--sf-success)] border border-[var(--sf-success)]/20">
                            <CheckCircle2 size={11} /> Ready to Record
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--sf-warning-bg)] text-[var(--sf-warning)] border border-[var(--sf-warning)]/20">
                            <AlertTriangle size={11} /> Blocked
                        </span>
                    )}
                </div>
                {readiness?.reasons?.map((reason, i) => (
                    <p key={i} className="text-[11px] text-sf-muted leading-snug mt-1">
                        • {reason}
                    </p>
                ))}
            </div>

            {/* Prerequisite Trail */}
            <div className="border-t border-sf-divider pt-3">
                <span className="text-[10px] uppercase font-bold text-sf-muted block mb-2">
                    Prerequisite Trail
                </span>
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-sf-muted">Reception Intake:</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">✓ Accepted</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-sf-muted">Drying Gate:</span>
                        <span className={`font-medium ${dryingStatus === 'DONE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                            {dryingStatus === 'DONE' ? '✓ Completed' : dryingStatus || 'Pending'}
                        </span>
                    </div>
                    {!isOperationalGate && (
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-sf-muted">Preparation Gate:</span>
                            <span className={`font-medium ${preparationStatus === 'DONE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                                {preparationStatus === 'DONE' ? '✓ Completed' : preparationStatus || 'Pending'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Methodology Parameters */}
            {!isOperationalGate && (
                <div className="border-t border-sf-divider pt-3 flex flex-col gap-2.5">
                    <span className="text-[10px] uppercase font-bold text-sf-muted block">
                        Determination Identity
                    </span>

                    {/* Result Basis */}
                    <div>
                        <label className="block text-[11px] font-medium text-sf-muted mb-1">
                            Result Basis
                        </label>
                        <select
                            disabled={isLocked}
                            value={basis}
                            onChange={(e) => onUpdateMeta(workItemId, 'basis', e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-sf-divider bg-sf-canvas text-sf-text focus:outline-none focus:ring-1 focus:ring-sf-primary focus:border-sf-primary"
                        >
                            <option value="AIR_DRY">Air-dry (standard)</option>
                            <option value="OVEN_DRY">Oven-dry (105°C moisture-corrected)</option>
                            <option value="FIELD_MOIST">Field-moist</option>
                        </select>
                    </div>

                    {/* Replicate Number */}
                    <div>
                        <label className="block text-[11px] font-medium text-sf-muted mb-1">
                            Replicate Determination
                        </label>
                        <select
                            disabled={isLocked}
                            value={replicateNo}
                            onChange={(e) => onUpdateMeta(workItemId, 'replicateNo', Number(e.target.value))}
                            className="w-full px-2 py-1 text-xs rounded border border-sf-divider bg-sf-canvas text-sf-text focus:outline-none focus:ring-1 focus:ring-sf-primary focus:border-sf-primary"
                        >
                            <option value={1}>Replicate 1 (Primary)</option>
                            <option value={2}>Replicate 2 (Quality duplicate)</option>
                            <option value={3}>Replicate 3 (Triplicate)</option>
                        </select>
                    </div>

                    {/* Instrument Selector */}
                    <div>
                        <label className="block text-[11px] font-medium text-sf-muted mb-1">
                            Instrument Qualification
                        </label>
                        <select
                            disabled={isLocked || eligibleEquipment.length === 0}
                            value={selectedEquipId}
                            onChange={(e) => onUpdateMeta(workItemId, 'instrumentId', e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-sf-divider bg-sf-canvas text-sf-text focus:outline-none focus:ring-1 focus:ring-sf-primary focus:border-sf-primary"
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
                                <Wrench size={11} className="text-sf-muted" />
                                <span className="text-sf-muted">Calibration:</span>
                                <span className={`font-semibold ${
                                    selectedAsset.calibrationStatus === 'OK' ? 'text-emerald-600 dark:text-emerald-400' :
                                    selectedAsset.calibrationStatus === 'DUE_SOON' ? 'text-amber-600 dark:text-amber-400' :
                                    'text-rose-600 dark:text-rose-400'
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
                <div className="border-t border-sf-divider pt-3">
                    <button
                        type="button"
                        onClick={() => onDiscardDraft(workItemId)}
                        disabled={isDiscarding}
                        className="w-full py-1.5 px-2 rounded text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/10 flex items-center justify-center gap-1.5 transition-colors"
                    >
                        <Trash2 size={13} />
                        <span>Discard Local Draft</span>
                    </button>
                    <p className="text-[10px] text-sf-muted text-center mt-1">
                        Purges draft and returns item to Assigned status.
                    </p>
                </div>
            )}
        </aside>
    );
}
