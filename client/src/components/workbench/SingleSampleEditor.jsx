import React, { useState } from 'react';
import { useAnalysisNames } from '../../context/AnalysisCatalogueContext';
import {
    ChevronLeft,
    ChevronRight,
    Save,
    CheckCircle2,
    AlertTriangle,
    Layers,
    Clock,
    Lock,
    TestTube2,
    HelpCircle
} from 'lucide-react';
import NumericEditor from './NumericEditor';
import TextureEditor from './TextureEditor';
import OperationalTaskEditor from './OperationalTaskEditor';
import clsx from 'clsx';

/**
 * SingleSampleEditor
 * Focused touch-friendly editor for phones & small screens (< 768px).
 * Displays "Sample X of N", large readable inputs, validation badges,
 * and quick sample index drawer.
 */
export default function SingleSampleEditor({
    activeGroup,
    items = [],
    currentIndex = 0,
    onIndexChange,
    onDraftChange,
    onConfirmOperation,
    onOpenSpectralIntake
}) {
    const getAnalysisDisplayName = useAnalysisNames();
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    if (!items || items.length === 0) {
        return (
            <div className="p-8 text-center bg-sf-surface border border-sf-divider rounded-2xl text-sf-muted text-xs">
                No samples assigned in this method run.
            </div>
        );
    }

    const currentItem = items[currentIndex] || items[0];
    const totalCount = items.length;

    const isTexture = ['TEXTURE', 'SOIL_PSD_TEXTURE', 'SOIL_TEXTURE', 'PSA', 'pSA', 'Particle Size Analysis'].includes(activeGroup?.analysis) || currentItem?.editorKind === 'TEXTURE';
    const isOperationalGate = activeGroup?.category === 'Operational Gates';
    const isSpectral = ['SPEC_VIS_NIR', 'SPEC_MIR', 'SPEC_NIR', 'SPEC_FTIR'].includes(activeGroup?.analysis) || currentItem?.editorKind === 'SPECTRAL';

    const handlePrev = () => {
        if (currentIndex > 0) {
            onIndexChange(currentIndex - 1);
        }
    };

    const handleNext = () => {
        if (currentIndex < totalCount - 1) {
            onIndexChange(currentIndex + 1);
        }
    };

    return (
        <div className="flex flex-col gap-3 max-w-lg mx-auto w-full">
            {/* Run & Progress Header */}
            <div className="bg-sf-surface border border-sf-divider rounded-2xl p-3 shadow-xs flex items-center justify-between">
                <button
                    onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                    className="flex items-center gap-2 text-left focus:outline-none"
                    aria-label="Open sample index selector"
                >
                    <div className="p-2 rounded-xl bg-sf-primary/10 text-sf-primary">
                        <Layers size={18} />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-sf-muted uppercase tracking-wider">
                            Sample {currentIndex + 1} of {totalCount}
                        </div>
                        <div className="text-xs font-bold text-sf-text flex items-center gap-1">
                            <span>{getAnalysisDisplayName(activeGroup?.analysis, activeGroup?.analysisName)}</span>
                            <span className="text-sf-muted text-[10px]">▾</span>
                        </div>
                    </div>
                </button>

                <div className="flex items-center gap-1">
                    <button
                        onClick={handlePrev}
                        disabled={currentIndex === 0}
                        className="p-2 rounded-xl border border-sf-divider bg-sf-inset text-sf-text disabled:opacity-40 active:scale-95"
                        aria-label="Previous sample"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        onClick={handleNext}
                        disabled={currentIndex === totalCount - 1}
                        className="p-2 rounded-xl border border-sf-divider bg-sf-inset text-sf-text disabled:opacity-40 active:scale-95"
                        aria-label="Next sample"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Quick Sample Selector Drawer */}
            {isDrawerOpen && (
                <div className="p-3 bg-sf-inset border border-sf-divider rounded-2xl max-h-48 overflow-y-auto space-y-1 shadow-inner animate-fadeIn">
                    <div className="text-[10px] font-bold uppercase text-sf-muted px-1 mb-1">
                        Jump to Sample:
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                        {items.map((it, idx) => (
                            <button
                                key={it.workItemId}
                                onClick={() => {
                                    onIndexChange(idx);
                                    setIsDrawerOpen(false);
                                }}
                                className={clsx(
                                    "p-2 rounded-xl text-xs font-mono text-left flex items-center justify-between border transition-all",
                                    idx === currentIndex
                                        ? "bg-sf-primary text-white border-sf-primary font-bold shadow-xs"
                                        : "bg-sf-surface text-sf-text border-sf-divider hover:bg-sf-hover"
                                )}
                            >
                                <span className="truncate">#{idx + 1} {it.sampleDisplayId || it.labId || it.originalId}</span>
                                {it.status === 'COMPLETED' && <CheckCircle2 size={12} className={idx === currentIndex ? 'text-white' : 'text-emerald-500'} />}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Specimen Identity Card */}
            <div className="bg-sf-surface border border-sf-divider rounded-2xl p-4 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                    <span className="sf-sample-id text-sm">
                        {currentItem.sampleDisplayId || currentItem.labId || currentItem.originalId || 'Sample'}
                    </span>
                    {currentItem.rackPosition != null && (
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-[var(--sf-blue-bg)] text-[var(--sf-blue)] border border-[var(--sf-blue)]/20">
                            Rack #{currentItem.rackPosition}
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-sf-muted pt-1">
                    {currentItem.originalId && (
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider">Field ID</span>
                            <span className="font-mono text-sf-text">{currentItem.originalId}</span>
                        </div>
                    )}
                    {currentItem.projectCode && (
                        <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider">Project</span>
                            <span className="text-sf-text truncate block">{currentItem.projectCode}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Editor Card */}
            <div className="bg-sf-surface border border-sf-divider rounded-2xl p-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-sf-divider pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-sf-text">
                        {isTexture ? 'Soil Texture Fractions' :
                         isOperationalGate ? 'Operational Checklist' :
                         isSpectral ? 'Spectroscopy Acquisition' :
                         `Determination (${activeGroup?.unit || 'Value'})`}
                    </span>
                    <span className={clsx(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        currentItem.status === 'COMPLETED' ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                        currentItem.isReady ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" :
                        "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    )}>
                        {currentItem.status}
                    </span>
                </div>

                {/* Editor Components */}
                {isTexture ? (
                    <TextureEditor
                        item={currentItem}
                        onDraftChange={(val) => onDraftChange(currentItem.workItemId, val)}
                    />
                ) : isOperationalGate ? (
                    <OperationalTaskEditor
                        item={currentItem}
                        onConfirmOperation={onConfirmOperation}
                    />
                ) : isSpectral ? (
                    <div className="p-4 text-center space-y-3 bg-sf-inset rounded-xl border border-sf-divider">
                        <p className="text-xs text-sf-muted">
                            Spectral files and metadata are captured through the Spectral Library intake.
                        </p>
                        <button
                            onClick={() => onOpenSpectralIntake(currentItem)}
                            className="btn-primary text-xs font-bold px-4 py-2.5"
                        >
                            Open Spectral Capture
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <NumericEditor
                            item={currentItem}
                            unit={activeGroup?.unit}
                            onDraftChange={(val) => onDraftChange(currentItem.workItemId, val)}
                        />
                    </div>
                )}
            </div>

            {/* Bottom Floating Navigation Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
                <button
                    onClick={handlePrev}
                    disabled={currentIndex === 0}
                    className="flex-1 py-3 px-4 rounded-xl border border-sf-divider bg-sf-surface hover:bg-sf-hover text-sf-text font-bold text-xs disabled:opacity-40 active:scale-95 transition-all"
                >
                    Previous
                </button>
                <button
                    onClick={handleNext}
                    disabled={currentIndex === totalCount - 1}
                    className="flex-1 btn-primary py-3 px-4 text-xs font-bold active:scale-95 transition-all"
                >
                    Save & Next
                </button>
            </div>
        </div>
    );
}
