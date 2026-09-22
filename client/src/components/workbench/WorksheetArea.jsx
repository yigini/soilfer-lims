import { useAnalysisNames } from '../../context/AnalysisCatalogueContext';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Filter, Search, Clipboard, ArrowRight, CheckCircle2,
    AlertTriangle, Sparkles, Check, Layers, LayoutList, Table as TableIcon
} from 'lucide-react';
import NumericEditor from './NumericEditor';
import TextureEditor from './TextureEditor';
import OperationalTaskEditor from './OperationalTaskEditor';
import WorkbenchInspector from './WorkbenchInspector';
import PastePreviewModal from './PastePreviewModal';
import BatchModal from './BatchModal';
import SingleSampleEditor from './SingleSampleEditor';
import { useHelp } from '../../context/HelpContext';

/**
 * WorksheetArea
 * High-performance laboratory worksheet.
 * Renders method-aware editors, row-level readiness and save indicators,
 * docked 240px contextual inspector, and native keyboard Enter navigation.
 */
export default function WorksheetArea({
    activeGroup,
    allGroups = [],
    initialSampleId = null,
    initialWorkItemId = null,
    onSelectGroup,
    onDraftChange,
    onUpdateItemMeta,
    onDiscardDraft,
    onResolveConflict,
    onReviewRecord,
    onConfirmOperation = null,
    onOpenSpectralIntake,
    onBatchUpdated,
    isDiscarding = false
}) {
    const { registerBlockers, clearBlockers } = useHelp();
    const getAnalysisDisplayName = useAnalysisNames();
    const items = activeGroup?.items || [];
    const [selectedItemId, setSelectedItemId] = useState(() => {
        if (initialWorkItemId && items.length > 0) {
            const matchWi = items.find(i => i.id === initialWorkItemId || i.workItemId === initialWorkItemId);
            if (matchWi) return matchWi.workItemId || matchWi.id;
        }
        if (initialSampleId && items.length > 0) {
            const found = items.find(i => i.sampleId === initialSampleId || i.originalId === initialSampleId || i.labId === initialSampleId || i.sampleDisplayId === initialSampleId);
            if (found) return found.workItemId;
        }
        return null;
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [viewMode, setViewMode] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768) ? 'single' : 'table');

    useEffect(() => {
        if (initialWorkItemId && items.length > 0) {
            const matchWi = items.find(i => i.id === initialWorkItemId || i.workItemId === initialWorkItemId);
            if (matchWi) {
                setSelectedItemId(matchWi.workItemId || matchWi.id);
                return;
            }
        }
        if (initialSampleId && items.length > 0) {
            const found = items.find(i => i.sampleId === initialSampleId || i.originalId === initialSampleId || i.labId === initialSampleId || i.sampleDisplayId === initialSampleId);
            if (found) setSelectedItemId(found.workItemId);
        }
    }, [initialWorkItemId, initialSampleId, items]);

    const isTexture = ['TEXTURE', 'SOIL_PSD_TEXTURE', 'SOIL_TEXTURE', 'PSA', 'pSA', 'Particle Size Analysis'].includes(activeGroup?.analysis) || activeGroup?.items?.some(i => i.editorKind === 'TEXTURE');
    const isOperationalGate = activeGroup?.category === 'Operational Gates';
    const isSpectral = ['SPEC_VIS_NIR', 'SPEC_MIR', 'SPEC_NIR', 'SPEC_FTIR'].includes(activeGroup?.analysis) || activeGroup?.items?.some(i => i.editorKind === 'SPECTRAL');

    // Filter items by search and sort stably by rackPosition
    const filteredItems = useMemo(() => {
        let list = items;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(i =>
                (i.sampleDisplayId && i.sampleDisplayId.toLowerCase().includes(q)) ||
                (i.labId && i.labId.toLowerCase().includes(q)) ||
                (i.sampleId && i.sampleId.toLowerCase().includes(q)) ||
                (i.originalId && i.originalId.toLowerCase().includes(q))
            );
        }
        return [...list].sort((a, b) => {
            const posA = typeof a.rackPosition === 'number' ? a.rackPosition : null;
            const posB = typeof b.rackPosition === 'number' ? b.rackPosition : null;
            if (posA !== null && posB !== null) return posA - posB;
            if (posA !== null) return -1;
            if (posB !== null) return 1;
            return 0;
        });
    }, [items, searchQuery]);

    // Active inspected item
    const inspectedItem = useMemo(() => {
        if (!selectedItemId && filteredItems.length > 0) {
            return filteredItems[0];
        }
        return filteredItems.find(i => i.workItemId === selectedItemId) || filteredItems[0] || null;
    }, [filteredItems, selectedItemId]);

    // Synchronize execution readiness blockers with contextual help
    useEffect(() => {
        if (inspectedItem?.readiness && !inspectedItem.readiness.isReady) {
            const rawBlockers = inspectedItem.readiness.blockers || [];
            let codes = [...rawBlockers];
            if (codes.length === 0 && Array.isArray(inspectedItem.readiness.reasons)) {
                codes = inspectedItem.readiness.reasons.map(r => {
                    const low = r.toLowerCase();
                    if (low.includes('drying')) return 'DRYING_PREREQUISITE_BLOCKED';
                    if (low.includes('prep') || low.includes('siev')) return 'PREPARATION_PREREQUISITE_BLOCKED';
                    if (low.includes('instrument') || low.includes('calibrat')) return 'INSTRUMENT_REQUIRED';
                    if (low.includes('hold')) return 'SAMPLE_ON_HOLD';
                    if (low.includes('reject')) return 'SAMPLE_REJECTED';
                    return 'SAMPLE_STATUS_INELIGIBLE';
                });
            }
            registerBlockers(codes);
        } else {
            clearBlockers();
        }
        return () => {
            clearBlockers();
        };
    }, [inspectedItem, registerBlockers, clearBlockers]);

    // Select all handler
    const allSelected = filteredItems.length > 0 && filteredItems.every(i => selectedRows.has(i.workItemId));
    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(filteredItems.map(i => i.workItemId)));
        }
    };

    const toggleRowSelect = (workItemId) => {
        const next = new Set(selectedRows);
        if (next.has(workItemId)) {
            next.delete(workItemId);
        } else {
            next.add(workItemId);
        }
        setSelectedRows(next);
    };

    const handlePasteApply = (pastedUpdates) => {
        pastedUpdates.forEach(update => {
            onDraftChange(update.workItemId, update.value);
        });
    };

    const handleEnterNext = (currentIndex) => {
        const nextItem = filteredItems[currentIndex + 1];
        if (nextItem) {
            setSelectedItemId(nextItem.workItemId);
            // Focus next input element
            const el = document.querySelector(`[aria-label="${nextItem.sampleId} determination"]`);
            if (el) el.focus();
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-3 pb-2">
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-sf-text">
                        <span>Work type:</span>
                        <select
                            value={activeGroup?.analysis || ''}
                            onChange={(e) => onSelectGroup(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-sf-divider bg-sf-surface text-sf-text text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sf-primary"
                        >
                            {allGroups.map(g => (
                                <option key={g.analysis} value={g.analysis}>
                                    {getAnalysisDisplayName(g.analysis, g.analysisName)} ({g.items.length})
                                </option>
                            ))}
                        </select>
                    </label>

                    {!isSpectral && !isOperationalGate && (
                        <>
                            <button
                                type="button"
                                onClick={() => setIsPasteModalOpen(true)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-sf-divider bg-sf-surface hover:bg-sf-hover transition-colors flex items-center gap-1.5 text-sf-text"
                            >
                                <Clipboard size={13} />
                                <span>Paste Values</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsBatchModalOpen(true)}
                                data-testid="open-batch-modal-btn"
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-sf-divider bg-sf-surface hover:bg-sf-hover transition-colors flex items-center gap-1.5 text-sf-text"
                            >
                                <Layers size={13} />
                                <span>Batch & QC Runs</span>
                            </button>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setViewMode(prev => prev === 'single' ? 'table' : 'single')}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-sf-divider bg-sf-surface hover:bg-sf-hover transition-colors flex items-center gap-1.5 text-sf-text"
                        title={viewMode === 'single' ? 'Switch to Batch Table' : 'Switch to Single Sample Card'}
                    >
                        {viewMode === 'single' ? <TableIcon size={13} /> : <LayoutList size={13} />}
                        <span>{viewMode === 'single' ? 'Table View' : 'Card View'}</span>
                    </button>

                    <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-2.5 text-sf-muted" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Find sample ID..."
                            className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-sf-divider bg-sf-surface text-sf-text placeholder:text-sf-muted focus:outline-none focus:ring-1 focus:ring-sf-primary w-44 sm:w-56"
                        />
                    </div>
                </div>
            </div>

            {/* Method Banner (SoilFER Signature Earth Accent) */}
            <div className="sf-method-banner p-4 flex items-center justify-between flex-wrap gap-3 text-xs mb-4">
                <div>
                    <h3 className="font-bold text-base text-[var(--sf-earth)] flex items-center gap-2">
                        <span>{getAnalysisDisplayName(activeGroup?.analysis, activeGroup?.analysisName)}</span>
                    </h3>
                    <p className="text-sf-muted text-xs mt-0.5">
                        {activeGroup?.category} {activeGroup?.unit ? `· Target unit: ${activeGroup.unit}` : ''}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {activeGroup?.unit && (
                        <span className="px-2.5 py-1 rounded text-xs font-semibold bg-sf-surface text-sf-text border border-sf-divider shadow-xs">
                            Unit: {activeGroup.unit}
                        </span>
                    )}
                    <span className="px-2.5 py-1 rounded text-xs font-semibold bg-sf-surface text-sf-text border border-sf-divider shadow-xs">
                        {filteredItems.length} assigned sample{filteredItems.length === 1 ? '' : 's'}
                    </span>
                </div>
            </div>

            {viewMode === 'single' ? (
                <SingleSampleEditor
                    activeGroup={activeGroup}
                    items={filteredItems}
                    currentIndex={Math.max(0, filteredItems.findIndex(i => i.workItemId === inspectedItem?.workItemId))}
                    onIndexChange={(idx) => {
                        if (filteredItems[idx]) setSelectedItemId(filteredItems[idx].workItemId);
                    }}
                    onDraftChange={onDraftChange}
                    onConfirmOperation={onConfirmOperation}
                    onOpenSpectralIntake={onOpenSpectralIntake}
                />
            ) : (
                /* Main Work Area: Table + Docked 240px Inspector */
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                    {/* Worksheet Table (3 cols) */}
                    <div className="lg:col-span-3 rounded-xl border border-sf-divider overflow-hidden bg-sf-surface flex flex-col shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="bg-sf-inset text-sf-muted border-b border-sf-divider">
                                    <th className="py-2.5 px-3 w-8">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={toggleSelectAll}
                                            aria-label="Select all rows"
                                            className="w-4 h-4 rounded text-sf-primary focus:ring-sf-primary"
                                        />
                                    </th>
                                    <th className="py-2.5 px-3 font-semibold min-w-[130px]">Sample</th>
                                    <th className="py-2.5 px-3 font-semibold min-w-[220px]">
                                        {isTexture ? 'Fractions (Sand / Silt / Clay %)' :
                                         isOperationalGate ? 'Completion checklist' :
                                         isSpectral ? 'Spectra Acquisition Status' :
                                         `Determination (${activeGroup?.unit || 'value'})`}
                                    </th>
                                    <th className="py-2.5 px-3 font-semibold min-w-[120px]">Readiness & State</th>
                                    <th className="py-2.5 px-3 font-semibold text-right w-20">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sf-divider">
                                {filteredItems.map((item, idx) => {
                                    const isSelected = item.workItemId === inspectedItem?.workItemId;
                                    const isChecked = selectedRows.has(item.workItemId);
                                    const draft = item.draft;
                                    const hasConflict = !!draft?.conflictValue;
                                    const isRecorded = item.status === 'COMPLETED';

                                    let savedChecks = null;
                                    let savedReceipt = null;
                                    if (item.currentResult) {
                                        try {
                                            const parsed = typeof item.currentResult === 'string' ? JSON.parse(item.currentResult) : item.currentResult;
                                            if (parsed && Array.isArray(parsed.checklist)) {
                                                savedChecks = parsed.checklist;
                                                savedReceipt = parsed;
                                            }
                                        } catch (e) {
                                            // Non-JSON string, e.g. legacy bare "Done"
                                        }
                                    }
                                    const isEvidenceGap = isOperationalGate && isRecorded && !savedReceipt;

                                    return (
                                        <tr
                                            key={item.workItemId}
                                            onClick={() => setSelectedItemId(item.workItemId)}
                                            className={`cursor-pointer transition-colors ${
                                                isSelected
                                                    ? 'bg-[var(--sf-selected)] shadow-[inset_3px_0_0_var(--sf-primary)]'
                                                    : 'hover:bg-sf-hover/60'
                                            }`}
                                        >
                                            <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleRowSelect(item.workItemId)}
                                                    aria-label={`Select ${item.sampleDisplayId || item.sampleId}`}
                                                    className="w-4 h-4 rounded text-sf-primary focus:ring-sf-primary"
                                                />
                                            </td>

                                            <td className="py-3 px-3">
                                                <div className="flex items-center gap-1.5">
                                                    {item.rackPosition != null && (
                                                        <span
                                                            data-testid={`rack-pos-${item.workItemId}`}
                                                            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--sf-blue-bg)] text-[var(--sf-blue)] border border-[var(--sf-blue)]/20 shrink-0"
                                                            title={`Rack Position ${item.rackPosition}${item.batchId ? ` (Batch: ${item.batchId})` : ''}`}
                                                        >
                                                            #{item.rackPosition}
                                                        </span>
                                                    )}
                                                    <span className="sf-sample-id">
                                                        {item.sampleDisplayId || item.labId || item.originalId || 'Sample'}
                                                    </span>
                                                </div>
                                                {item.originalId && (
                                                    <div className="text-[11px] text-sf-muted font-mono mt-0.5">
                                                        Field: {item.originalId}
                                                    </div>
                                                )}
                                                {item.projectCode && (
                                                    <span className="text-[10px] text-sf-muted">
                                                        {item.projectCode}
                                                    </span>
                                                )}
                                            </td>

                                            <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                                                {isTexture ? (
                                                    <TextureEditor
                                                        disabled={!item.readiness?.isReady || isRecorded}
                                                        values={draft?.values || []}
                                                        tolerance={activeGroup?.validation?.tolerance ?? null}
                                                        onChange={(vals) => onDraftChange(item.workItemId, null, { values: vals })}
                                                        sampleId={item.sampleId}
                                                        onEnterNext={() => handleEnterNext(idx)}
                                                    />
                                                ) : isOperationalGate ? (
                                                    <OperationalTaskEditor
                                                        disabled={!item.readiness?.isReady || isRecorded}
                                                        analysis={item.analysis}
                                                        checks={draft?.checks || savedChecks || [false, false, false]}
                                                        savedReceipt={savedReceipt}
                                                        isEvidenceGap={isEvidenceGap}
                                                        onChange={(chk) => onDraftChange(item.workItemId, null, { checks: chk })}
                                                        sampleId={item.sampleId}
                                                        onConfirm={() => onConfirmOperation && onConfirmOperation(item.workItemId, draft?.checks || [true, true, true])}
                                                    />
                                                ) : isSpectral ? (
                                                    <div className="flex items-center gap-2">
                                                        {item.latestSpectralScan || item.hasSpectrum || isRecorded ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                                    item.latestSpectralScan?.qcStatus === 'PASS' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' :
                                                                    item.latestSpectralScan?.qcStatus === 'WARN' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' :
                                                                    'bg-sf-primary/15 text-sf-primary'
                                                                }`}>
                                                                    ✓ {item.latestSpectralScan?.qcStatus ? `QC: ${item.latestSpectralScan.qcStatus}` : 'Scan Recorded'}
                                                                </span>
                                                                {item.latestSpectralScan?.id && (
                                                                    <span className="text-[10px] font-mono text-sf-muted hidden sm:inline">
                                                                        {item.latestSpectralScan.id}
                                                                    </span>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onOpenSpectralIntake && onOpenSpectralIntake(item)}
                                                                    className="px-2 py-1 bg-sf-raised hover:bg-sf-hover text-sf-text rounded text-xs font-medium transition-colors border border-sf-divider"
                                                                >
                                                                    Inspect / Rescan
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded font-medium border border-amber-500/20">
                                                                    Spectrum required
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onOpenSpectralIntake && onOpenSpectralIntake(item)}
                                                                    disabled={!item.readiness?.isReady || isRecorded}
                                                                    className="px-2.5 py-1 bg-sf-primary hover:bg-sf-primary-hover text-sf-on-primary rounded text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                                                                >
                                                                    Upload spectra →
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <NumericEditor
                                                        disabled={!item.readiness?.isReady || isRecorded}
                                                        value={draft?.value ?? item.currentResult ?? ''}
                                                        onChange={(val) => onDraftChange(item.workItemId, val)}
                                                        unit={activeGroup?.unit || ''}
                                                        placeholder="0.00"
                                                        ariaLabel={`${item.sampleDisplayId || item.sampleId} determination`}
                                                        onEnterNext={() => handleEnterNext(idx)}
                                                    />
                                                )}
                                            </td>

                                            <td className="py-3 px-3">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {item.readiness?.isReady ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                                                <CheckCircle2 size={10} /> Ready
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                                                <AlertTriangle size={10} /> Blocked
                                                            </span>
                                                        )}

                                                        {hasConflict ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                                                                Conflict
                                                            </span>
                                                        ) : isRecorded ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                                                Recorded
                                                            </span>
                                                        ) : draft ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sf-primary/15 text-sf-primary">
                                                                Draft saved
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-sf-muted">
                                                                Pending
                                                            </span>
                                                        )}
                                                    </div>

                                                    {item.readiness && !item.readiness.isReady && (
                                                        <span className="text-[10px] text-sf-muted max-w-xs truncate">
                                                            {item.readiness.reasons?.[0]}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-3 px-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedItemId(item.workItemId)}
                                                    className="px-2 py-1 rounded text-xs text-sf-primary hover:underline font-medium transition-colors"
                                                >
                                                    Inspect →
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredItems.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-sf-muted">
                                            No samples found matching your filter.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="p-3 bg-sf-raised border-t border-sf-divider flex items-center justify-between flex-wrap gap-2 text-xs">
                        <span className="text-sf-muted">
                            <strong className="text-sf-text">{selectedRows.size}</strong> selected · Press <kbd className="px-1 py-0.5 rounded border border-sf-divider bg-sf-surface text-sf-text font-mono">Enter</kbd> to advance to next row
                        </span>

                        {isOperationalGate ? (
                            <button
                                type="button"
                                onClick={() => {
                                    selectedRows.forEach(wiId => {
                                        const target = items.find(i => i.workItemId === wiId);
                                        const checksToConfirm = target?.draft?.checks || [true, true, true];
                                        if (onConfirmOperation) {
                                            onConfirmOperation(wiId, checksToConfirm);
                                        }
                                    });
                                }}
                                disabled={selectedRows.size === 0}
                                className="px-4 py-2 rounded-lg text-xs font-semibold bg-sf-primary text-sf-on-primary hover:bg-sf-primary-hover disabled:opacity-50 transition-colors flex items-center gap-1.5"
                            >
                                <CheckCircle2 size={13} />
                                <span>Confirm {activeGroup?.analysisName || 'Preparation'} Complete ({selectedRows.size})</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onReviewRecord(Array.from(selectedRows))}
                                disabled={selectedRows.size === 0}
                                className="px-4 py-2 rounded-lg text-xs font-semibold bg-sf-primary text-sf-on-primary hover:bg-sf-primary-hover disabled:opacity-50 transition-colors flex items-center gap-1.5"
                            >
                                <span>Review Completion ({selectedRows.size})</span>
                                <ArrowRight size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Docked Inspector (1 col) */}
                <WorkbenchInspector
                    selectedItem={inspectedItem}
                    methodDefinition={activeGroup}
                    eligibleEquipment={activeGroup?.eligibleEquipment || []}
                    onUpdateMeta={onUpdateItemMeta}
                    onDiscardDraft={onDiscardDraft}
                    onResolveConflict={onResolveConflict}
                    isDiscarding={isDiscarding}
                />
            </div>
            )}

            {/* Paste Preview Modal */}
            <PastePreviewModal
                isOpen={isPasteModalOpen}
                onClose={() => setIsPasteModalOpen(false)}
                onApply={handlePasteApply}
                currentItems={items}
                analysisCode={activeGroup?.analysis || ''}
            />

            {/* Batch & QC Modal */}
            <BatchModal
                isOpen={isBatchModalOpen}
                onClose={() => setIsBatchModalOpen(false)}
                analysisCode={activeGroup?.analysis || ''}
                selectedWorkItemIds={Array.from(selectedRows)}
                onBatchUpdated={onBatchUpdated}
            />
        </div>
    );
}
