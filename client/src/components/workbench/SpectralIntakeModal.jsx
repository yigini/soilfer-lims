import React, { useState, useMemo } from 'react';
import {
    X, Upload, FileText, CheckCircle2, AlertTriangle, ArrowRight,
    ArrowLeft, ShieldCheck, Activity, Eye, Check
} from 'lucide-react';

/**
 * SpectralIntakeModal
 * 4-step wizard for laboratory spectroscopy intake (VIS-NIR & MIR DRIFTS).
 * Steps:
 * 1. Identify run
 * 2. Match & inspect (signal curve, duplicate replicate decisions)
 * 3. Confirm import (explicit inclusion/exclusion, QC warning acknowledgment)
 * 4. Durable import receipt
 */
export default function SpectralIntakeModal({
    isOpen,
    onClose,
    onImportComplete,
    assignedWorkItems = [],
    modality = 'SPEC_MIR',
    eligibleEquipment = []
}) {
    const [step, setStep] = useState(1);
    const [selectedScanIdx, setSelectedScanIdx] = useState(0);
    const [confirmed, setConfirmed] = useState(false);
    const [warningAck, setWarningAck] = useState(false);
    const [selectedInstrument, setSelectedInstrument] = useState('');

    // Scans loaded into the wizard
    const [scans, setScans] = useState([]);

    if (!isOpen) return null;

    // Load assigned spectral samples as a demo / ready intake run
    const handleInitializeRun = () => {
        const spectralItems = assignedWorkItems.filter(i =>
            i.analysis === modality || i.category === 'Spectroscopy'
        );

        const initialScans = spectralItems.slice(0, 5).map((item, idx) => {
            const hasDuplicate = idx === 1; // Example scenario replicate
            return {
                id: `scan-${item.sampleId}-${idx}`,
                sourceId: item.sampleId,
                filename: `${item.sampleId}_${modality.toLowerCase()}.dx`,
                match: item.sampleId,
                workItemId: item.workItemId,
                replicateNo: hasDuplicate ? 1 : 1,
                action: hasDuplicate ? 'unresolved' : 'new',
                duplicate: hasDuplicate,
                verified: true,
                qcStatus: idx === 1 ? 'WARN' : 'PASS',
                qcFlags: idx === 1 ? ['HIGH_NOISE_WINDOW'] : [],
                imported: false
            };
        });

        if (initialScans.length === 0) {
            initialScans.push({
                id: 'scan-demo-1',
                sourceId: 'SMP-DEMO-01',
                filename: 'SMP-DEMO-01_mir.dx',
                match: 'SMP-DEMO-01',
                workItemId: null,
                replicateNo: 1,
                action: 'new',
                duplicate: false,
                verified: true,
                qcStatus: 'PASS',
                qcFlags: [],
                imported: false
            });
        }

        setScans(initialScans);
        setSelectedScanIdx(0);
        setStep(2);
    };

    const getScanStatus = (s) => {
        if (s.imported) {
            return { tone: 'text-emerald-600 bg-emerald-50', text: 'Imported', eligible: false, reason: 'Receipt retained' };
        }
        if (s.action === 'skip') {
            return { tone: 'text-slate-500 bg-slate-100', text: 'Skipped', eligible: false, reason: 'Replicate retained' };
        }
        if (!s.match || !s.verified) {
            return { tone: 'text-red-600 bg-red-50', text: 'Unresolved ID', eligible: false, reason: 'Match or verified correction required' };
        }
        if (s.action === 'unresolved') {
            return { tone: 'text-amber-600 bg-amber-50', text: 'Duplicate needs decision', eligible: false, reason: 'Replicate 1 already exists' };
        }
        if (s.qcStatus === 'WARN') {
            return { tone: 'text-amber-600 bg-amber-50', text: 'Ready (QC Warning)', eligible: true, reason: s.action === 'rep2' ? 'Replicate 2 · R1 preserved' : 'Exact match with noise flag' };
        }
        return { tone: 'text-emerald-600 bg-emerald-50', text: 'Ready to import', eligible: true, reason: s.action === 'rep2' ? 'Replicate 2 · R1 preserved' : 'Exact match · QC passed' };
    };

    const eligibleCandidates = scans.filter(s => getScanStatus(s).eligible);
    const hasWarnings = eligibleCandidates.some(s => s.qcStatus === 'WARN');

    const handleExecuteImport = () => {
        const updated = scans.map(s => {
            if (getScanStatus(s).eligible) {
                return { ...s, imported: true };
            }
            return s;
        });
        setScans(updated);
        setStep(4);
        if (onImportComplete) {
            onImportComplete(eligibleCandidates);
        }
    };

    // Render illustrative signal curve for selected scan
    const renderSignalCurve = () => {
        const points = [
            [20, 90], [50, 85], [80, 75], [110, 45], [140, 20], [170, 48],
            [200, 78], [230, 60], [260, 40], [290, 58], [320, 72], [350, 75]
        ];
        const pathData = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt[0]} ${pt[1]}`).join(' ');

        return (
            <svg className="w-full h-36 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-950" viewBox="0 0 370 120">
                <line x1="20" y1="10" x2="20" y2="100" stroke="#94a3b8" strokeWidth="1" />
                <line x1="20" y1="100" x2="350" y2="100" stroke="#94a3b8" strokeWidth="1" />
                <path d={pathData} fill="none" stroke="#3b82f6" strokeWidth="2" />
                <text x="20" y="115" fontSize="9" fill="#94a3b8">4000 cm⁻¹</text>
                <text x="310" y="115" fontSize="9" fill="#94a3b8">600 cm⁻¹</text>
                <text x="185" y="115" fontSize="9" fill="#94a3b8" textAnchor="middle">Wavenumber</text>
            </svg>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header & Step Ribbon */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <span className="text-[11px] text-emerald-600 font-semibold uppercase tracking-wider">
                            Spectroscopy Intake & QC
                        </span>
                        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                            {modality === 'SPEC_MIR' ? 'Mid-Infrared (MIR DRIFTS) Intake' : 'Visible & Near-Infrared (Vis-NIR) Intake'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Wizard Steps indicator */}
                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 text-xs font-medium">
                    {[
                        { num: 1, label: 'Identify Run' },
                        { num: 2, label: 'Match & Inspect' },
                        { num: 3, label: 'Confirm Import' },
                        { num: 4, label: 'Receipt' }
                    ].map(st => (
                        <div key={st.num} className={`flex items-center gap-1.5 ${step === st.num ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'}`}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] border
                                ${step === st.num ? 'border-emerald-600 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700' : 'border-slate-300 dark:border-slate-700 text-slate-400'}
                            `}>
                                {st.num}
                            </span>
                            <span>{st.label}</span>
                        </div>
                    ))}
                </div>

                {/* Step Body */}
                <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4 text-xs">
                    {step === 1 && (
                        <div className="flex flex-col gap-5">
                            <div className="p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl flex flex-col items-center justify-center text-center gap-2 bg-slate-50 dark:bg-slate-950">
                                <Upload size={32} className="text-blue-500 mb-1" />
                                <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                                    Load Instrument Batch Run
                                </h4>
                                <p className="text-slate-500 max-w-sm text-xs">
                                    Select spectrometer batch folder or load matching assigned spectral tasks directly from your queue.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleInitializeRun}
                                    className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                                >
                                    Load Assigned Queue Scans →
                                </button>
                            </div>

                            <div className="grid grid-cols-3 gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                                <div>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Method</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">
                                        {modality === 'SPEC_MIR' ? 'MIR DRIFTS 4000-600 cm⁻¹' : 'Vis-NIR 350-2500 nm'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Assigned Instrument</span>
                                    <select
                                        value={selectedInstrument}
                                        onChange={(e) => setSelectedInstrument(e.target.value)}
                                        className="w-full mt-0.5 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                    >
                                        <option value="">IR-04 Spectrometer</option>
                                        {eligibleEquipment.map(eq => (
                                            <option key={eq.id} value={eq.id}>{eq.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Prerequisites</span>
                                    <span className="font-medium text-emerald-600">✓ Drying & Prep Complete</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-2 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden flex flex-col">
                                <div className="p-3 bg-slate-100 dark:bg-slate-850 font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                                    <span>Spectral Scans ({scans.length})</span>
                                    <span className="text-[11px] text-emerald-600 font-bold">
                                        {eligibleCandidates.length} Eligible
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto">
                                    {scans.map((s, idx) => {
                                        const st = getScanStatus(s);
                                        const isSelected = selectedScanIdx === idx;
                                        return (
                                            <div
                                                key={s.id}
                                                onClick={() => setSelectedScanIdx(idx)}
                                                className={`p-3 flex flex-col gap-2 cursor-pointer transition-colors ${
                                                    isSelected ? 'bg-blue-50/70 dark:bg-blue-950/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                        {s.filename}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${st.tone}`}>
                                                        {st.text}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                                    <span>Target: {s.match || 'Unmatched'}</span>
                                                    <span>Replicate {s.action === 'rep2' ? 2 : 1}</span>
                                                </div>

                                                {/* Replicate duplicate selector */}
                                                {s.duplicate && (
                                                    <div className="mt-1 pt-1.5 border-t border-dashed border-slate-200 dark:border-slate-800 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                        <span className="text-[10px] text-amber-600 font-medium">Action:</span>
                                                        <select
                                                            value={s.action}
                                                            onChange={(e) => {
                                                                const next = [...scans];
                                                                next[idx].action = e.target.value;
                                                                setScans(next);
                                                            }}
                                                            className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px]"
                                                        >
                                                            <option value="unresolved">Choose decision...</option>
                                                            <option value="rep2">Add as Replicate 2 (Preserve R1)</option>
                                                            <option value="skip">Skip file (Keep existing)</option>
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Inspector & Signal Plot */}
                            <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col gap-2.5 bg-slate-50 dark:bg-slate-950">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Signal Curve Preview</span>
                                {renderSignalCurve()}
                                <div className="mt-2 text-xs">
                                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Selected File</span>
                                    <p className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate">
                                        {scans[selectedScanIdx]?.filename}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        QC Status: <strong className={scans[selectedScanIdx]?.qcStatus === 'WARN' ? 'text-amber-600' : 'text-emerald-600'}>
                                            {scans[selectedScanIdx]?.qcStatus}
                                        </strong>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="flex flex-col gap-4">
                            <div className="p-3.5 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 text-xs leading-relaxed">
                                You are about to import <strong>{eligibleCandidates.length} eligible spectral scans</strong>.
                                Scans are matched to assigned work items and will mark determinations as recorded.
                            </div>

                            <div className="border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800 max-h-56 overflow-y-auto">
                                {scans.map((s, idx) => {
                                    const st = getScanStatus(s);
                                    return (
                                        <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <FileText size={14} className="text-slate-400" />
                                                <span className="font-mono">{s.filename}</span>
                                                <span className="text-slate-400">→</span>
                                                <span className="font-bold">{s.match}</span>
                                                <span className="text-[11px] text-slate-500">
                                                    (R{s.action === 'rep2' ? 2 : 1})
                                                </span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${st.tone}`}>
                                                {st.text}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex flex-col gap-2 pt-2">
                                <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-800 dark:text-slate-200">
                                    <input
                                        type="checkbox"
                                        checked={confirmed}
                                        onChange={(e) => setConfirmed(e.target.checked)}
                                        className="w-4 h-4 rounded text-emerald-600"
                                    />
                                    <span>I verified the sample IDs, replicate numbers, and spectra match the assigned work items.</span>
                                </label>

                                {hasWarnings && (
                                    <label className="flex items-center gap-2 text-xs cursor-pointer text-amber-800 dark:text-amber-300">
                                        <input
                                            type="checkbox"
                                            checked={warningAck}
                                            onChange={(e) => setWarningAck(e.target.checked)}
                                            className="w-4 h-4 rounded text-amber-600"
                                        />
                                        <span>I acknowledged the signal warning. It will remain attached for the reviewer.</span>
                                    </label>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="p-6 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 text-center flex flex-col items-center gap-3">
                            <CheckCircle2 size={36} className="text-emerald-600 dark:text-emerald-400" />
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                Spectral Intake Receipt
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-md">
                                Successfully imported {eligibleCandidates.length} scans. Records have been created with full replicate provenance and linked to your queue determinations.
                            </p>
                            <div className="font-mono text-xs p-2 rounded bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700/60 mt-2">
                                Receipt ID: REC-SPEC-{Date.now()}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer buttons */}
                <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
                    {step > 1 && step < 4 ? (
                        <button
                            type="button"
                            onClick={() => setStep(step - 1)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                        >
                            <ArrowLeft size={13} /> Back
                        </button>
                    ) : <div />}

                    <div className="flex gap-2">
                        {step === 2 && (
                            <button
                                type="button"
                                onClick={() => setStep(3)}
                                disabled={!eligibleCandidates.length}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                            >
                                Review Import ({eligibleCandidates.length}) <ArrowRight size={13} />
                            </button>
                        )}

                        {step === 3 && (
                            <button
                                type="button"
                                onClick={handleExecuteImport}
                                disabled={!confirmed || (hasWarnings && !warningAck) || !eligibleCandidates.length}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                                Confirm & Import {eligibleCandidates.length} Scans
                            </button>
                        )}

                        {step === 4 && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 transition-colors"
                            >
                                Close & Return to Workbench
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
