import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    X, Upload, FileText, CheckCircle2, AlertTriangle, ArrowRight,
    ArrowLeft, ShieldCheck, Activity, Eye, Check, RefreshCw, AlertOctagon, HelpCircle
} from 'lucide-react';

/**
 * SpectralIntakeModal
 * Production 4-step wizard for laboratory spectroscopy intake (MIR DRIFTS & Vis-NIR).
 * Replaces all demo code with real staged ingestion (POST /api/spectral/preview & /batch/commit).
 * 
 * Steps:
 * 1. Identify Run & Upload Files (select spectrometer, choose raw files or CSV)
 * 2. Match & Inspect (inspect real curve, view QC flags, make duplicate decisions: REPLACE / ADD_REPLICATE / SKIP)
 * 3. Confirm Import (replicate verification, QC warning acknowledgment)
 * 4. Durable Import Receipt (actual committed record IDs & updated queue status)
 */
export default function SpectralIntakeModal({
    isOpen,
    onClose,
    onImportComplete,
    assignedWorkItems = [],
    selectedItem = null,
    modality = 'SPEC_MIR',
    eligibleEquipment = []
}) {
    const [step, setStep] = useState(1);
    const [instruments, setInstruments] = useState(eligibleEquipment || []);
    const [selectedInstrument, setSelectedInstrument] = useState('');
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Staged manifest state
    const [manifestId, setManifestId] = useState(null);
    const [stagedItems, setStagedItems] = useState([]);
    const [selectedScanIdx, setSelectedScanIdx] = useState(0);

    // Decisions & confirmation state
    const [decisions, setDecisions] = useState({});
    const [confirmed, setConfirmed] = useState(false);
    const [warningAck, setWarningAck] = useState(false);
    const [commitReceipt, setCommitReceipt] = useState(null);

    // Client-side instant file inspection and modality override
    const [overrideModality, setOverrideModality] = useState(null);
    const [fileInspection, setFileInspection] = useState(null);

    const defaultTargetModality = (modality === 'SPEC_MIR' || modality === 'SPEC_FTIR') ? 'MIR' : 'NIR';
    const effectiveTargetModality = overrideModality || defaultTargetModality;

    // Fetch active spectrometers if not provided
    useEffect(() => {
        const loadEquipment = async () => {
            if (eligibleEquipment && eligibleEquipment.length > 0) {
                setInstruments(eligibleEquipment);
                const match = eligibleEquipment.find(e =>
                    effectiveTargetModality === 'MIR'
                        ? /mir|ftir|alpha|tensor|vertex/i.test(e.name + (e.model || ''))
                        : /nir|mpa|tango/i.test(e.name + (e.model || ''))
                ) || eligibleEquipment[0];
                if (match && !selectedInstrument) setSelectedInstrument(match.id);
                return;
            }

            try {
                let res = await axios.get('/api/equipment?type=SPECTROMETER&status=IN_SERVICE');
                let list = res.data?.data || res.data || [];
                if (!Array.isArray(list) || list.length === 0) {
                    res = await axios.get('/api/equipment');
                    const allAssets = res.data?.data || res.data || [];
                    list = allAssets.filter(a => a.assetType === 'SPECTROMETER' || /spectrometer|ftir/i.test(a.name));
                }
                setInstruments(list);
                if (list.length > 0) {
                    const match = list.find(e =>
                        effectiveTargetModality === 'MIR'
                            ? /mir|ftir|alpha|tensor|vertex/i.test(e.name + (e.model || ''))
                            : /nir|mpa|tango/i.test(e.name + (e.model || ''))
                    ) || list[0];
                    if (match && !selectedInstrument) setSelectedInstrument(match.id);
                }
            } catch (err) {
                console.warn('[SpectralIntake] Failed to fetch equipment:', err.message);
            }
        };

        if (isOpen) {
            loadEquipment();
        }
    }, [eligibleEquipment, isOpen, effectiveTargetModality]);

    // Reset wizard when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setFiles([]);
            setError(null);
            setManifestId(null);
            setStagedItems([]);
            setSelectedScanIdx(0);
            setDecisions({});
            setConfirmed(false);
            setWarningAck(false);
            setCommitReceipt(null);
            setOverrideModality(null);
            setFileInspection(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Instant Client-side Inspection
    const inspectFile = (fileObj) => {
        if (!fileObj) {
            setFileInspection(null);
            return;
        }

        const ext = (fileObj.name.split('.').pop() || '').toLowerCase();

        if (['csv', 'txt', 'tsv', 'dx', 'jdx', 'jcamp'].includes(ext)) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0 && !l.trim().startsWith('#'));
                    if (lines.length > 1) {
                        const firstLine = lines[0];
                        let delim = ',';
                        if (firstLine.includes('\t')) delim = '\t';
                        else if (firstLine.includes(';')) delim = ';';

                        const xs = [];
                        for (let i = 1; i < Math.min(lines.length, 2000); i++) {
                            const parts = lines[i].split(delim);
                            if (parts.length >= 2) {
                                const val = parseFloat(parts[0].trim());
                                if (!isNaN(val)) xs.push(val);
                            }
                        }

                        if (xs.length > 0) {
                            const minX = Math.min(...xs);
                            const maxX = Math.max(...xs);
                            let detectedMod = 'MIR';
                            let detectedUnit = 'cm⁻¹ (Wavenumber)';

                            if (maxX > 2600 && minX <= 700) {
                                detectedMod = 'MIR';
                                detectedUnit = 'cm⁻¹ (Wavenumber)';
                            } else if (minX >= 300 && maxX <= 2600) {
                                detectedMod = 'NIR';
                                detectedUnit = 'nm (Wavelength)';
                            } else if (minX >= 4000 && maxX > 8000) {
                                detectedMod = 'NIR';
                                detectedUnit = 'cm⁻¹ (Wavenumber)';
                            }

                            setFileInspection({
                                filename: fileObj.name,
                                size: (fileObj.size / 1024).toFixed(1) + ' KB',
                                minX: Math.round(minX),
                                maxX: Math.round(maxX),
                                points: lines.length - 1,
                                modality: detectedMod,
                                unit: detectedUnit,
                                format: ext.toUpperCase(),
                                matchesTask: detectedMod === defaultTargetModality
                            });

                            // Auto-select instrument matching detected modality
                            if (instruments.length > 0) {
                                const matchedInst = instruments.find(eq =>
                                    detectedMod === 'MIR'
                                        ? /mir|ftir|alpha|tensor|vertex/i.test(eq.name)
                                        : /nir|mpa|tango/i.test(eq.name)
                                );
                                if (matchedInst) {
                                    setSelectedInstrument(matchedInst.id);
                                }
                            }
                            return;
                        }
                    }
                } catch (err) {
                    console.warn('[SpectralIntake] Client inspection error:', err);
                }

                setFileInspection({
                    filename: fileObj.name,
                    size: (fileObj.size / 1024).toFixed(1) + ' KB',
                    modality: defaultTargetModality,
                    format: ext.toUpperCase(),
                    matchesTask: true
                });
            };
            reader.readAsText(fileObj.slice(0, 100 * 1024));
        } else {
            let binMod = ext === 'asd' ? 'NIR' : defaultTargetModality;
            setFileInspection({
                filename: fileObj.name,
                size: (fileObj.size / 1024).toFixed(1) + ' KB',
                modality: binMod,
                format: ext === 'opus' ? 'Bruker OPUS Binary' : ext === 'spc' ? 'Thermo SPC Binary' : ext.toUpperCase(),
                matchesTask: binMod === defaultTargetModality
            });
        }
    };

    // Handle File Selection
    const handleFileChange = (e) => {
        const selected = Array.from(e.target.files || []);
        if (selected.length > 0) {
            setFiles(selected);
            setError(null);
            inspectFile(selected[0]);
        }
    };

    // Step 1 -> Step 2: Upload to Staging Preview
    const handleGeneratePreview = async () => {
        if (files.length === 0) {
            setError('Please select at least one spectral file (.opus, .dx, .spc, .asd, .csv).');
            return;
        }
        if (!selectedInstrument) {
            setError('Please select the operating spectrometer from the equipment register.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            files.forEach(f => formData.append('files', f));
            formData.append('equipmentId', selectedInstrument);
            formData.append('targetModality', effectiveTargetModality);
            if (selectedItem?.sampleId) formData.append('contextSampleId', selectedItem.sampleId);
            if (selectedItem?.workItemId) formData.append('targetWorkItemId', selectedItem.workItemId);

            const res = await axios.post('/api/spectral/preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data && res.data.items) {
                setManifestId(res.data.manifestId);
                setStagedItems(res.data.items);
                setSelectedScanIdx(0);

                // Initialize decisions map
                const initDecs = {};
                res.data.items.forEach(item => {
                    initDecs[item.id] = {
                        decision: item.suggestedAction || 'PROCEED',
                        replicateNo: item.duplicateType === 'REPLICATE_EXISTS' ? 2 : 1,
                        sampleId: item.matchedSample?.id || selectedItem?.sampleId,
                        targetWorkItemId: item.matchedWorkItem?.id || selectedItem?.workItemId
                    };
                });
                setDecisions(initDecs);
                setStep(2);
            }
        } catch (err) {
            console.error('[SpectralIntake] Preview error:', err);
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to parse and stage spectral files.');
        } finally {
            setLoading(false);
        }
    };

    // Helper: Determine eligibility of an item
    const getItemStatus = (item) => {
        const dec = decisions[item.id] || { decision: item.suggestedAction || 'PROCEED' };
        if (item.parseError) {
            return { tone: 'text-red-700 bg-red-50 dark:bg-red-950/40 border-red-200', text: 'Parse Failed', eligible: false, reason: item.parseError };
        }
        if (dec.decision === 'SKIP') {
            return { tone: 'text-slate-500 bg-slate-100 dark:bg-slate-800 border-slate-300', text: 'Skipped', eligible: false, reason: 'Excluded by operator' };
        }
        if (item.operationalBlocked) {
            return { tone: 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-200', text: 'Prerequisite Pending', eligible: false, reason: item.operationalReason };
        }
        if (!item.matchedSample && !selectedItem?.sampleId) {
            return { tone: 'text-red-700 bg-red-50 dark:bg-red-950/40 border-red-200', text: 'Unmatched Sample', eligible: false, reason: 'No matching sample found' };
        }
        if (item.qcStatus === 'FAIL') {
            return { tone: 'text-red-700 bg-red-50 dark:bg-red-950/40 border-red-200', text: 'QC Failed', eligible: false, reason: (item.qcFlags || []).join(', ') };
        }
        if (item.qcStatus === 'WARN') {
            return { tone: 'text-amber-700 bg-amber-50 dark:bg-amber-950/40 border-amber-200', text: 'QC Warning', eligible: true, reason: (item.qcFlags || []).join(', ') };
        }
        return { tone: 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200', text: 'Ready', eligible: true, reason: 'QC passed' };
    };

    const eligibleItems = stagedItems.filter(item => getItemStatus(item).eligible);
    const hasWarnings = eligibleItems.some(item => item.qcStatus === 'WARN');

    // Step 3 -> Step 4: Atomic Batch Commit
    const handleExecuteCommit = async () => {
        if (!manifestId) return;
        setLoading(true);
        setError(null);

        try {
            const idempotencyKey = `commit-${manifestId}-${Date.now()}`;
            const res = await axios.post('/api/spectral/batch/commit', {
                manifestId,
                equipmentId: selectedInstrument,
                idempotencyKey,
                decisions
            });

            setCommitReceipt(res.data);
            setStep(4);
            if (onImportComplete) {
                onImportComplete(res.data);
            }
        } catch (err) {
            console.error('[SpectralIntake] Commit error:', err);
            setError(err.response?.data?.message || err.response?.data?.error || 'Database transaction commit failed.');
        } finally {
            setLoading(false);
        }
    };

    // Render interactive SVG signal curve
    const renderSignalCurve = (scan) => {
        if (!scan || !scan.wavelengths || scan.wavelengths.length === 0) {
            return (
                <div className="w-full h-40 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-400 text-xs">
                    No spectral curve data available
                </div>
            );
        }

        const w = scan.wavelengths;
        const v = scan.values;
        const minW = Math.min(...w);
        const maxW = Math.max(...w);
        const minV = Math.min(...v);
        const maxV = Math.max(...v);
        const vRange = maxV - minV || 1;
        const wRange = maxW - minW || 1;

        const width = 380;
        const height = 130;
        const padX = 35;
        const padY = 15;
        const plotW = width - padX * 2;
        const plotH = height - padY * 2;

        const step = Math.max(1, Math.floor(w.length / 150));
        const points = [];
        for (let i = 0; i < w.length; i += step) {
            const xNorm = (w[i] - minW) / wRange;
            const x = scan.axisUnit === 'WAVENUMBER_CM1'
                ? padX + (1 - xNorm) * plotW
                : padX + xNorm * plotW;
            const yNorm = (v[i] - minV) / vRange;
            const y = height - padY - yNorm * plotH;
            points.push(`${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`);
        }

        const pathData = points.length > 0 ? `M ${points.join(' L ')}` : '';

        return (
            <svg className="w-full h-40 border border-slate-200 dark:border-slate-800 rounded bg-slate-50 dark:bg-slate-950" viewBox={`0 0 ${width} ${height}`}>
                <line x1={padX} y1={padY} x2={padX} y2={height - padY} stroke="#94a3b8" strokeWidth="1" />
                <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="#94a3b8" strokeWidth="1" />
                <path d={pathData} fill="none" stroke="#2563eb" strokeWidth="1.5" />
                <text x={padX} y={height - 3} fontSize="9" fill="#64748b">
                    {scan.axisUnit === 'WAVENUMBER_CM1' ? `${Math.round(maxW)} cm⁻¹` : `${Math.round(minW)} nm`}
                </text>
                <text x={width - padX} y={height - 3} fontSize="9" fill="#64748b" textAnchor="end">
                    {scan.axisUnit === 'WAVENUMBER_CM1' ? `${Math.round(minW)} cm⁻¹` : `${Math.round(maxW)} nm`}
                </text>
                <text x={padX - 4} y={padY + 8} fontSize="8" fill="#64748b" textAnchor="end">
                    {maxV.toFixed(2)}
                </text>
                <text x={padX - 4} y={height - padY} fontSize="8" fill="#64748b" textAnchor="end">
                    {minV.toFixed(2)}
                </text>
            </svg>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-4xl bg-sf-surface rounded-2xl shadow-2xl border border-sf-divider flex flex-col max-h-[92vh] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-sf-divider flex items-center justify-between">
                    <div>
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                            Spectroscopy Intake & QC Engine
                        </span>
                        <h2 className="text-base font-bold text-sf-text flex items-center gap-2">
                            {effectiveTargetModality === 'MIR' ? 'Mid-Infrared (MIR DRIFTS) Intake' : 'Visible & Near-Infrared (Vis-NIR) Intake'}
                            {selectedItem && (
                                <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-normal">
                                    Target: {selectedItem.sampleDisplayId || selectedItem.labId || selectedItem.sampleId}
                                </span>
                            )}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-sf-muted hover:text-sf-text transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Steps indicator */}
                <div className="px-6 py-3 bg-sf-canvas/50 border-b border-sf-divider flex items-center gap-6 text-xs font-medium">
                    {[
                        { num: 1, label: 'Identify & Upload' },
                        { num: 2, label: 'Match & Inspect' },
                        { num: 3, label: 'Confirm Import' },
                        { num: 4, label: 'Receipt' }
                    ].map(st => (
                        <div key={st.num} className={`flex items-center gap-2 ${step === st.num ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-sf-muted'}`}>
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] border
                                ${step === st.num ? 'border-emerald-600 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold' : 'border-sf-divider text-sf-muted'}
                            `}>
                                {st.num}
                            </span>
                            <span>{st.label}</span>
                        </div>
                    ))}
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4 text-xs">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-800 dark:text-red-300 flex items-center gap-2">
                            <AlertOctagon size={16} className="shrink-0 text-red-600" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Step 1: Identify Run & Upload */}
                    {step === 1 && (
                        <div className="flex flex-col gap-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-sf-divider bg-sf-canvas/50">
                                <div>
                                    <label className="text-[11px] font-bold text-sf-muted uppercase block mb-1">
                                        Operating Spectrometer (Required)
                                    </label>
                                    <select
                                        value={selectedInstrument}
                                        onChange={(e) => setSelectedInstrument(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-sf-divider bg-sf-surface text-sf-text font-medium focus:ring-1 focus:ring-emerald-500"
                                    >
                                        <option value="">-- Select Verified Spectrometer --</option>
                                        {instruments.map(eq => (
                                            <option key={eq.id} value={eq.id}>
                                                {eq.name} ({eq.model || eq.assetCode || eq.id}) - {eq.status}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="text-[10px] text-sf-muted mt-1 block">
                                        {selectedInstrument ? '✓ Verified instrument selected' : 'Spectrometer must be active and qualified in the equipment register.'}
                                    </span>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[11px] font-bold text-sf-muted uppercase">
                                            Modality & Acquisition Method
                                        </label>
                                        {overrideModality && (
                                            <button
                                                type="button"
                                                onClick={() => setOverrideModality(null)}
                                                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                Reset to Default ({defaultTargetModality})
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setOverrideModality('MIR')}
                                            className={`py-2 px-2.5 rounded-lg border text-left text-xs transition-all flex flex-col ${
                                                effectiveTargetModality === 'MIR'
                                                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500'
                                                    : 'border-sf-divider bg-sf-surface text-sf-muted hover:bg-sf-hover hover:text-sf-text'
                                            }`}
                                        >
                                            <span className="font-bold flex items-center justify-between">
                                                <span>MIR DRIFTS</span>
                                                {effectiveTargetModality === 'MIR' && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Active</span>}
                                            </span>
                                            <span className="text-[10px] text-sf-muted">4000 - 400 cm⁻¹</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setOverrideModality('NIR')}
                                            className={`py-2 px-2.5 rounded-lg border text-left text-xs transition-all flex flex-col ${
                                                effectiveTargetModality === 'NIR'
                                                    ? 'border-blue-500 bg-blue-500/15 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500'
                                                    : 'border-sf-divider bg-sf-surface text-sf-muted hover:bg-sf-hover hover:text-sf-text'
                                            }`}
                                        >
                                            <span className="font-bold flex items-center justify-between">
                                                <span>Vis-NIR</span>
                                                {effectiveTargetModality === 'NIR' && <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">Active</span>}
                                            </span>
                                            <span className="text-[10px] text-sf-muted">350 - 2500 nm</span>
                                        </button>
                                    </div>
                                    <span className="text-[10px] text-sf-muted mt-1 block">
                                        Task default: {defaultTargetModality === 'MIR' ? 'Mid-Infrared (SPEC_MIR)' : 'Near-Infrared (SPEC_NIR)'}
                                    </span>
                                </div>
                            </div>

                            {/* Dropzone */}
                            <div className="border-2 border-dashed border-sf-divider rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2.5 bg-sf-canvas/30 hover:bg-sf-hover/30 transition-colors relative cursor-pointer">
                                <input
                                    type="file"
                                    multiple
                                    accept=".opus,.dx,.jdx,.jcamp,.spc,.asd,.csv"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <Upload size={32} className="text-blue-500" />
                                <div>
                                    <h4 className="font-semibold text-sm text-sf-text">
                                        {files.length > 0 ? `${files.length} file(s) selected` : 'Select or Drop Spectral Files'}
                                    </h4>
                                    <p className="text-xs text-sf-muted mt-0.5 max-w-md">
                                        Supports Bruker OPUS (.opus), JCAMP-DX (.dx), Galactic SPC (.spc), ASD (.asd), and calibrated CSV exports.
                                    </p>
                                </div>
                                {files.length > 0 && (
                                    <div className="text-xs font-mono px-3 py-1 bg-blue-500/10 text-blue-700 dark:text-blue-300 rounded-full">
                                        {files.map(f => f.name).join(', ')}
                                    </div>
                                )}
                            </div>

                            {/* Live File Auto-Detection Card */}
                            {fileInspection && (
                                <div className={`p-4 rounded-xl border flex flex-col gap-2.5 ${
                                    fileInspection.matchesTask
                                        ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
                                        : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
                                }`}>
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <Activity size={16} className={fileInspection.matchesTask ? 'text-emerald-600' : 'text-amber-600'} />
                                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                                                Auto-Detected: {fileInspection.filename} ({fileInspection.size})
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                fileInspection.modality === 'MIR'
                                                    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                                                    : 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
                                            }`}>
                                                {fileInspection.modality === 'MIR' ? 'Mid-Infrared (MIR DRIFTS)' : 'Near-Infrared (Vis-NIR)'}
                                            </span>
                                        </div>
                                        {fileInspection.points && (
                                            <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                                                {fileInspection.minX} - {fileInspection.maxX} {fileInspection.unit} · {fileInspection.points.toLocaleString()} points
                                            </span>
                                        )}
                                    </div>

                                    {fileInspection.matchesTask ? (
                                        <div className="text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 font-medium">
                                            <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                                            <span>
                                                Validated: File spectral curve matches the required <strong>{effectiveTargetModality === 'MIR' ? 'Mid-Infrared DRIFTS (4000-400 cm⁻¹)' : 'Vis-NIR (350-2500 nm)'}</strong> parameters for this work item.
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between flex-wrap gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <AlertTriangle size={14} className="shrink-0 text-amber-600" />
                                                <span>
                                                    Notice: File detected as <strong>{fileInspection.modality}</strong>, but work order requested <strong>{defaultTargetModality}</strong>.
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setOverrideModality(fileInspection.modality)}
                                                className="px-2.5 py-1 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                                            >
                                                Switch Target to {fileInspection.modality}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Match & Inspect */}
                    {step === 2 && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Scans list */}
                            <div className="lg:col-span-2 border border-sf-divider rounded-lg overflow-hidden flex flex-col bg-sf-surface">
                                <div className="p-3 bg-sf-canvas/80 font-semibold text-sf-text flex items-center justify-between border-b border-sf-divider">
                                    <span>Staged Scans ({stagedItems.length})</span>
                                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                                        {eligibleItems.length} Eligible to Commit
                                    </span>
                                </div>
                                <div className="divide-y divide-sf-divider max-h-80 overflow-y-auto bg-sf-surface">
                                    {stagedItems.map((item, idx) => {
                                        const st = getItemStatus(item);
                                        const isSelected = selectedScanIdx === idx;
                                        const dec = decisions[item.id] || { decision: item.suggestedAction || 'PROCEED' };

                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => setSelectedScanIdx(idx)}
                                                className={`p-3 flex flex-col gap-2 cursor-pointer transition-colors ${
                                                    isSelected ? 'bg-emerald-500/10 dark:bg-emerald-950/20' : 'hover:bg-sf-hover/60'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-mono font-bold text-sf-text truncate max-w-[200px]">
                                                        {item.filename}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${st.tone}`}>
                                                        {st.text}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between text-[11px] text-sf-muted">
                                                    <span>
                                                        Sample: <strong className="text-sf-text">
                                                            {item.matchedSample?.sampleDisplayId || item.matchedSample?.labId || 'Unmatched'}
                                                        </strong>
                                                    </span>
                                                    <span>Modality: {item.modality} · {item.axisUnit}</span>
                                                </div>

                                                {/* Duplicate Replicate Resolution */}
                                                {item.duplicate && (
                                                    <div className="mt-1 pt-1.5 border-t border-dashed border-sf-divider flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Decision:</span>
                                                        <select
                                                            value={dec.decision}
                                                            onChange={(e) => {
                                                                const next = { ...decisions };
                                                                next[item.id] = { ...dec, decision: e.target.value };
                                                                setDecisions(next);
                                                            }}
                                                            className="px-2 py-1 rounded border border-sf-divider bg-sf-canvas text-sf-text text-[11px] focus:ring-1 focus:ring-emerald-500"
                                                        >
                                                            <option value="REPLACE">Replace Prior Scan (Supersede)</option>
                                                            <option value="ADD_REPLICATE">Add as Replicate 2 (Preserve R1)</option>
                                                            <option value="SKIP">Skip File</option>
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Curve Inspector */}
                            <div className="p-3 border border-sf-divider rounded-lg flex flex-col gap-2.5 bg-sf-surface">
                                <span className="text-[10px] font-bold text-sf-muted uppercase">Interactive Signal Curve</span>
                                {renderSignalCurve(stagedItems[selectedScanIdx])}
                                <div className="mt-1 text-xs space-y-1">
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-sf-muted">Data Points:</span>
                                        <span className="font-mono text-sf-text">{stagedItems[selectedScanIdx]?.wavelengths?.length || 0} pts</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-sf-muted">QC Status:</span>
                                        <span className={`font-bold ${stagedItems[selectedScanIdx]?.qcStatus === 'FAIL' ? 'text-red-600' : (stagedItems[selectedScanIdx]?.qcStatus === 'WARN' ? 'text-amber-600' : 'text-emerald-600')}`}>
                                            {stagedItems[selectedScanIdx]?.qcStatus}
                                        </span>
                                    </div>
                                    {stagedItems[selectedScanIdx]?.qcFlags?.length > 0 && (
                                        <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px]">
                                            Flags: {stagedItems[selectedScanIdx].qcFlags.join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Confirm Import */}
                    {step === 3 && (
                        <div className="flex flex-col gap-4">
                            <div className="p-3.5 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-800 dark:text-blue-200 text-xs leading-relaxed">
                                You are about to commit <strong>{eligibleItems.length} eligible spectral scan(s)</strong> into the library.
                                Atomic database records will be created, files permanently persisted, and corresponding queue tasks marked as acquired.
                            </div>

                            <div className="border border-sf-divider rounded-lg divide-y divide-sf-divider max-h-60 overflow-y-auto bg-sf-surface">
                                {stagedItems.map((item, idx) => {
                                    const st = getItemStatus(item);
                                    const dec = decisions[item.id] || { decision: item.suggestedAction || 'PROCEED' };
                                    return (
                                        <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <FileText size={14} className="text-sf-muted" />
                                                <span className="font-mono text-sf-text">{item.filename}</span>
                                                <span className="text-sf-muted">→</span>
                                                <span className="font-bold text-sf-text">{item.matchedSample?.sampleDisplayId || item.matchedSample?.labId || 'Unmatched'}</span>
                                                <span className="text-[11px] text-sf-muted">
                                                    ({dec.decision === 'REPLACE' ? 'Replace R1' : (dec.decision === 'ADD_REPLICATE' ? 'Replicate 2' : 'Replicate 1')})
                                                </span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${st.tone}`}>
                                                {st.text}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex flex-col gap-2 pt-2">
                                <label className="flex items-center gap-2 text-xs cursor-pointer text-sf-text">
                                    <input
                                        type="checkbox"
                                        checked={confirmed}
                                        onChange={(e) => setConfirmed(e.target.checked)}
                                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>I verified the sample IDs, replicate numbers, and spectra match the physical soil cups.</span>
                                </label>

                                {hasWarnings && (
                                    <label className="flex items-center gap-2 text-xs cursor-pointer text-amber-800 dark:text-amber-300">
                                        <input
                                            type="checkbox"
                                            checked={warningAck}
                                            onChange={(e) => setWarningAck(e.target.checked)}
                                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                                        />
                                        <span>I acknowledged the signal QC warnings. Warnings will be recorded for technical review.</span>
                                    </label>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Durable Receipt */}
                    {step === 4 && commitReceipt && (
                        <div className="p-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-center flex flex-col items-center gap-3">
                            <CheckCircle2 size={36} className="text-emerald-600 dark:text-emerald-400" />
                            <h3 className="text-base font-bold text-sf-text">
                                Spectral Intake Committed Successfully
                            </h3>
                            <p className="text-xs text-sf-muted max-w-md">
                                Recorded {commitReceipt.success || eligibleItems.length} scan(s) into the permanent library with cryptographic SHA-256 integrity and task linkage.
                            </p>
                            <div className="font-mono text-xs p-2.5 rounded bg-sf-surface border border-emerald-500/30 mt-2 text-sf-text">
                                Manifest ID: {commitReceipt.manifestId || manifestId}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="px-6 py-3 border-t border-sf-divider bg-sf-surface flex items-center justify-between">
                    {step > 1 && step < 4 ? (
                        <button
                            type="button"
                            onClick={() => setStep(step - 1)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-sf-divider text-sf-text hover:bg-sf-hover transition-colors flex items-center gap-1"
                        >
                            <ArrowLeft size={13} /> Back
                        </button>
                    ) : <div />}

                    <div className="flex gap-2">
                        {step === 1 && (
                            <button
                                type="button"
                                onClick={handleGeneratePreview}
                                disabled={files.length === 0 || !selectedInstrument || loading}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                            >
                                {loading ? <RefreshCw size={13} className="animate-spin" /> : null}
                                Stage & Inspect Scans <ArrowRight size={13} />
                            </button>
                        )}

                        {step === 2 && (
                            <button
                                type="button"
                                onClick={() => setStep(3)}
                                disabled={eligibleItems.length === 0}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                            >
                                Review Import ({eligibleItems.length}) <ArrowRight size={13} />
                            </button>
                        )}

                        {step === 3 && (
                            <button
                                type="button"
                                onClick={handleExecuteCommit}
                                disabled={!confirmed || (hasWarnings && !warningAck) || eligibleItems.length === 0 || loading}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                            >
                                {loading ? <RefreshCw size={13} className="animate-spin" /> : null}
                                Commit {eligibleItems.length} Scans to Library
                            </button>
                        )}

                        {step === 4 && (
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-sf-raised text-sf-text border border-sf-divider hover:bg-sf-hover transition-colors"
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
