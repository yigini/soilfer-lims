import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Filter, Search, Clipboard, ArrowRight, CheckCircle2,
    AlertTriangle, Sparkles, Check
} from 'lucide-react';
import NumericEditor from './NumericEditor';
import TextureEditor from './TextureEditor';
import OperationalTaskEditor from './OperationalTaskEditor';
import WorkbenchInspector from './WorkbenchInspector';
import PastePreviewModal from './PastePreviewModal';

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
    onSelectGroup,
    onDraftChange,
    onUpdateItemMeta,
    onDiscardDraft,
    onResolveConflict,
    onReviewRecord,
    onOpenSpectralIntake,
    isDiscarding = false
}) {
    const items = activeGroup?.items || [];
    const [selectedItemId, setSelectedItemId] = useState(() => {
        if (initialSampleId && items.length > 0) {
            const found = items.find(i => i.sampleId === initialSampleId || i.originalId === initialSampleId || i.labId === initialSampleId || i.sampleDisplayId === initialSampleId);
            if (found) return found.workItemId;
        }
        return null;
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);

    useEffect(() => {
        if (initialSampleId && items.length > 0) {
            const found = items.find(i => i.sampleId === initialSampleId || i.originalId === initialSampleId || i.labId === initialSampleId || i.sampleDisplayId === initialSampleId);
            if (found) setSelectedItemId(found.workItemId);
        }
    }, [initialSampleId, items]);

    const isTexture = activeGroup?.analysis === 'TEXTURE';
    const isOperationalGate = activeGroup?.category === 'Operational Gates';
    const isSpectral = ['SPEC_VIS_NIR', 'SPEC_MIR', 'SPEC_NIR', 'SPEC_FTIR'].includes(activeGroup?.analysis) || activeGroup?.items?.some(i => i.editorKind === 'SPECTRAL');

    // Filter items by search
    const filteredItems = useMemo(() => {
        if (!searchQuery) return items;
        const q = searchQuery.toLowerCase();
        return items.filter(i =>
            (i.sampleDisplayId && i.sampleDisplayId.toLowerCase().includes(q)) ||
            (i.labId && i.labId.toLowerCase().includes(q)) ||
            (i.sampleId && i.sampleId.toLowerCase().includes(q)) ||
            (i.originalId && i.originalId.toLowerCase().includes(q))
        );
    }, [items, searchQuery]);

    // Active inspected item
    const inspectedItem = useMemo(() => {
        if (!selectedItemId && filteredItems.length > 0) {
            return filteredItems[0];
        }
        return filteredItems.find(i => i.workItemId === selectedItemId) || filteredItems[0] || null;
    }, [filteredItems, selectedItemId]);

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
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <span>Analysis Method:</span>
                        <select
                            value={activeGroup?.analysis || ''}
                            onChange={(e) => onSelectGroup(e.target.value)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                            {allGroups.map(g => (
                                <option key={g.analysis} value={g.analysis}>
                                    {g.analysisName || g.analysis} ({g.items.length})
                                </option>
                            ))}
                        </select>
                    </label>

                    {!isSpectral && !isOperationalGate && (
                        <button
                            type="button"
                            onClick={() => setIsPasteModalOpen(true)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-slate-700 dark:text-slate-300"
                        >
                            <Clipboard size={13} />
                            <span>Paste Values</span>
                        </button>
                    )}
                </div>

                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Find sample ID..."
                        className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-56"
                    />
                </div>
            </div>

            {/* Method Banner */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between flex-wrap gap-2 text-xs">
                <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{activeGroup?.analysisName || activeGroup?.analysis}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {activeGroup?.analysis}
                        </span>
                    </h3>
                    <p className="text-slate-500 text-[11px] mt-0.5">
                        {activeGroup?.category} {activeGroup?.unit ? `· Target unit: ${activeGroup.unit}` : ''}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {activeGroup?.unit && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            Unit: {activeGroup.unit}
                        </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                        {filteredItems.length} assigned sample{filteredItems.length === 1 ? '' : 's'}
                    </span>
                </div>
            </div>

            {/* Main Work Area: Table + Docked 240px Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                {/* Worksheet Table (3 cols) */}
                <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                                    <th className="py-2.5 px-3 w-8">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={toggleSelectAll}
                                            aria-label="Select all rows"
                                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                        />
                                    </th>
                                    <th className="py-2.5 px-3 font-semibold min-w-[130px]">Sample</th>
                                    <th className="py-2.5 px-3 font-semibold min-w-[220px]">
                                        {isTexture ? 'Fractions (Sand / Silt / Clay %)' :
                                         isOperationalGate ? 'SOP Verification' :
                                         isSpectral ? 'Spectra Acquisition Status' :
                                         `Determination (${activeGroup?.unit || 'value'})`}
                                    </th>
                                    <th className="py-2.5 px-3 font-semibold min-w-[120px]">Readiness & State</th>
                                    <th className="py-2.5 px-3 font-semibold text-right w-20">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredItems.map((item, idx) => {
                                    const isSelected = item.workItemId === inspectedItem?.workItemId;
                                    const isChecked = selectedRows.has(item.workItemId);
                                    const draft = item.draft;
                                    const hasConflict = !!draft?.conflictValue;
                                    const isRecorded = item.status === 'COMPLETED';

                                    return (
                                        <tr
                                            key={item.workItemId}
                                            onClick={() => setSelectedItemId(item.workItemId)}
                                            className={`cursor-pointer transition-colors ${
                                                isSelected
                                                    ? 'bg-blue-50/50 dark:bg-blue-950/20'
                                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                            }`}
                                        >
                                            <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleRowSelect(item.workItemId)}
                                                    aria-label={`Select ${item.sampleDisplayId || item.sampleId}`}
                                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                                />
                                            </td>

                                            <td className="py-3 px-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                                        {item.sampleDisplayId || item.labId || item.originalId || 'Sample'}
                                                    </span>
                                                </div>
                                                {item.originalId && (
                                                    <div className="text-[11px] text-slate-400 font-mono">
                                                        Field: {item.originalId}
                                                    </div>
                                                )}
                                                {item.projectCode && (
                                                    <span className="text-[10px] text-slate-400">
                                                        {item.projectCode}
                                                    </span>
                                                )}
                                            </td>

                                            <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                                                {isTexture ? (
                                                    <TextureEditor
                                                        values={draft?.values || []}
                                                        onChange={(vals) => onDraftChange(item.workItemId, null, { values: vals })}
                                                        sampleId={item.sampleId}
                                                        onEnterNext={() => handleEnterNext(idx)}
                                                    />
                                                ) : isOperationalGate ? (
                                                    <OperationalTaskEditor
                                                        analysis={item.analysis}
                                                        checks={draft?.checks || [false, false, false]}
                                                        onChange={(chk) => onDraftChange(item.workItemId, null, { checks: chk })}
                                                        sampleId={item.sampleId}
                                                    />
                                                ) : isSpectral ? (
                                                    <div className="flex items-center gap-2">
                                                        {item.latestSpectralScan || item.hasSpectrum || isRecorded ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                                                    item.latestSpectralScan?.qcStatus === 'PASS' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' :
                                                                    item.latestSpectralScan?.qcStatus === 'WARN' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' :
                                                                    'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                                                                }`}>
                                                                    ✓ {item.latestSpectralScan?.qcStatus ? `QC: ${item.latestSpectralScan.qcStatus}` : 'Scan Recorded'}
                                                                </span>
                                                                {item.latestSpectralScan?.id && (
                                                                    <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                                                                        {item.latestSpectralScan.id}
                                                                    </span>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onOpenSpectralIntake && onOpenSpectralIntake(item)}
                                                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium transition-colors"
                                                                >
                                                                    Inspect / Rescan
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded font-medium border border-amber-200 dark:border-amber-800">
                                                                    Spectrum required
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onOpenSpectralIntake && onOpenSpectralIntake(item)}
                                                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                                                                >
                                                                    Upload spectra →
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <NumericEditor
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
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                                                                <CheckCircle2 size={10} /> Ready
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
                                                                <AlertTriangle size={10} /> Blocked
                                                            </span>
                                                        )}

                                                        {hasConflict ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                                                Conflict
                                                            </span>
                                                        ) : isRecorded ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                                                                Recorded
                                                            </span>
                                                        ) : draft ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700">
                                                                Draft saved
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400">
                                                                Pending
                                                            </span>
                                                        )}
                                                    </div>

                                                    {item.readiness && !item.readiness.isReady && (
                                                        <span className="text-[10px] text-slate-400 max-w-xs truncate">
                                                            {item.readiness.reasons?.[0]}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-3 px-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedItemId(item.workItemId)}
                                                    className="px-2 py-1 rounded text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 font-medium transition-colors"
                                                >
                                                    Inspect →
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredItems.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-slate-400">
                                            No samples found matching your filter.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
                        <span className="text-slate-500">
                            <strong>{selectedRows.size}</strong> selected · Press <kbd className="px-1 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono">Enter</kbd> to advance to next row
                        </span>

                        <button
                            type="button"
                            onClick={() => onReviewRecord(Array.from(selectedRows))}
                            disabled={selectedRows.size === 0}
                            className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                            <span>Review Completion ({selectedRows.size})</span>
                            <ArrowRight size={13} />
                        </button>
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

            {/* Paste Preview Modal */}
            <PastePreviewModal
                isOpen={isPasteModalOpen}
                onClose={() => setIsPasteModalOpen(false)}
                onApply={handlePasteApply}
                currentItems={items}
                analysisCode={activeGroup?.analysis || ''}
            />
        </div>
    );
}
