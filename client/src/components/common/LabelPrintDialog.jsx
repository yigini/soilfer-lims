import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';
import { Printer, X, Tag, CheckSquare, Square, Check, SlidersHorizontal, Eye } from 'lucide-react';

/**
 * LabelPrintDialog (RC-17)
 * Supports:
 * - Single sample (via `sample` prop)
 * - Batch of samples (via `samples` array prop)
 * - Dual format: Standard (101x54mm / 4"x2") and Compact (50x25mm / 2"x1" cryovial)
 * - 100% Offline QR code generation via `qrcode` (no third-party API dependencies)
 * - Thermal continuous printer page breaks (`@media print`)
 * - Auto-print trigger support
 */
const LabelPrintDialog = ({ isOpen, onClose, sample, samples, autoPrint = false }) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && onClose) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const [branding, setBranding] = useState(null);
    const [format, setFormat] = useState('STANDARD'); // 'STANDARD' (101x54mm) | 'COMPACT' (50x25mm)
    const [qrDataUrls, setQrDataUrls] = useState({});
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [filterStatus, setFilterStatus] = useState('ACCEPTED'); // 'ALL' | 'ACCEPTED'

    // Normalize samples array
    const sampleList = useMemo(() => {
        if (Array.isArray(samples) && samples.length > 0) {
            return samples;
        }
        if (sample) {
            return [sample];
        }
        return [];
    }, [sample, samples]);

    const CANONICAL_ACCEPTED_STATES = ['ACCEPTED', 'PROCESSING', 'SUBMITTED_PARTIAL', 'SUBMITTED_FULL', 'APPROVED', 'ARCHIVED'];

    // Initialize selection when dialog opens or samples change
    useEffect(() => {
        if (isOpen && sampleList.length > 0) {
            fetchBranding();

            // Default: select all accepted samples, or all if none are explicitly accepted
            const accepted = sampleList.filter(s => CANONICAL_ACCEPTED_STATES.includes(s.status));
            const toSelect = accepted.length > 0 ? accepted : sampleList;
            setSelectedIds(new Set(toSelect.map(s => s.id || s.labId || s.originalId)));
        }
    }, [isOpen, sampleList]);

    // Generate offline QR data URLs for all samples
    useEffect(() => {
        if (!isOpen || sampleList.length === 0) return;

        let isMounted = true;
        const generateQRs = async () => {
            const urls = {};
            for (const s of sampleList) {
                const isExpected = s.status === 'EXPECTED';
                const labId = isExpected ? 'Pending' : (s.labId || 'PENDING');
                const originalId = s.originalId || 'N/A';
                const qrText = isExpected ? originalId : labId;
                const key = s.id || s.labId || s.originalId;

                try {
                    const dataUrl = await QRCode.toDataURL(qrText, {
                        width: 180,
                        margin: 1,
                        color: { dark: '#000000', light: '#ffffff' },
                        errorCorrectionLevel: 'M'
                    });
                    urls[key] = dataUrl;
                } catch (e) {
                    console.warn(`Failed to generate offline QR for ${key}:`, e);
                }
            }
            if (isMounted) {
                setQrDataUrls(urls);
                if (autoPrint) {
                    setTimeout(() => window.print(), 400);
                }
            }
        };

        generateQRs();

        return () => {
            isMounted = false;
        };
    }, [isOpen, sampleList, autoPrint]);

    const fetchBranding = async () => {
        try {
            // S26: Try public branding endpoint first so non-admin technicians can get branding
            const res = await axios.get('/api/public/branding');
            if (res.data?.branding) {
                setBranding(res.data.branding);
                return;
            }
        } catch {}

        try {
            const res = await axios.get('/api/admin/settings');
            const settings = res.data?.data || res.data;
            if (settings?.branding) setBranding(settings.branding);
        } catch (e) {
            console.warn("Using default branding fallback", e);
            setBranding({ title: 'SoilFER LIMS', logoUrl: '/assets/img/logo-light.png' });
        }
    };

    if (!isOpen || sampleList.length === 0) return null;

    // Filter samples for printable list
    const printableSamples = sampleList.filter(s => {
        const key = s.id || s.labId || s.originalId;
        return selectedIds.has(key);
    });

    const toggleSampleSelect = (key) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handleSelectAll = () => {
        setSelectedIds(new Set(sampleList.map(s => s.id || s.labId || s.originalId)));
    };

    const handleSelectAcceptedOnly = () => {
        const accepted = sampleList.filter(s => CANONICAL_ACCEPTED_STATES.includes(s.status));
        setSelectedIds(new Set(accepted.map(s => s.id || s.labId || s.originalId)));
    };

    const handleClearSelection = () => {
        setSelectedIds(new Set());
    };

    const isBatch = sampleList.length > 1;
    const previewSample = printableSamples[0] || sampleList[0];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print overflow-y-auto">
            <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-sf-divider my-8">
                {/* Header */}
                <div className="p-4 border-b border-sf-divider flex justify-between items-center bg-gray-50/75 dark:bg-gray-800/75">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-sf-emerald flex items-center justify-center font-bold">
                            <Printer size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-sf-text flex items-center gap-2 text-base">
                                {isBatch ? `Print Batch Labels (${printableSamples.length} of ${sampleList.length})` : 'Print Sample Label'}
                            </h3>
                            <p className="text-xs text-sf-muted">
                                Thermal printer formatted with instant offline 2D matrix QR codes
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Format & Batch Controls */}
                <div className="px-6 py-3 bg-sf-canvas/40 border-b border-sf-divider flex flex-wrap items-center justify-between gap-3 text-xs">
                    {/* Format Toggle */}
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sf-muted">Format:</span>
                        <div className="inline-flex rounded-lg border border-sf-divider p-0.5 bg-sf-surface">
                            <button
                                type="button"
                                onClick={() => setFormat('STANDARD')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                                    format === 'STANDARD'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-sf-muted hover:text-gray-900'
                                }`}
                            >
                                Standard (101×54mm / 4"×2")
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormat('COMPACT')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                                    format === 'COMPACT'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-sf-muted hover:text-gray-900'
                                }`}
                            >
                                Vial / Tube (50×25mm)
                            </button>
                        </div>
                    </div>

                    {/* Batch Selection Strip */}
                    {isBatch && (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSelectAcceptedOnly}
                                className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded font-semibold hover:bg-emerald-100 transition-colors"
                            >
                                Accepted Only ({sampleList.filter(s => s.status !== 'REJECTED').length})
                            </button>
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="px-2 py-1 bg-sf-raised text-sf-text rounded font-semibold hover:bg-gray-200 transition-colors"
                            >
                                Select All ({sampleList.length})
                            </button>
                            <button
                                type="button"
                                onClick={handleClearSelection}
                                className="px-2 py-1 text-gray-500 hover:text-gray-700 font-semibold"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>

                {/* Batch Checklist (Collapsible / Scrollable if batch) */}
                {isBatch && (
                    <div className="px-6 py-3 max-h-36 overflow-y-auto border-b border-sf-divider bg-sf-surface divide-y dark:divide-gray-700 text-xs">
                        {sampleList.map((s, idx) => {
                            const key = s.id || s.labId || s.originalId;
                            const isSelected = selectedIds.has(key);
                            const isRejected = s.status === 'REJECTED';
                            return (
                                <label
                                    key={key}
                                    className={`flex items-center justify-between py-1.5 px-2 rounded cursor-pointer transition-colors ${
                                        isSelected ? 'bg-indigo-50/60 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-750'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSampleSelect(key)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="font-mono font-bold text-sf-text">
                                            {s.labId || s.originalId}
                                        </span>
                                        {s.originalId && s.originalId !== s.labId && (
                                            <span className="text-gray-400 font-mono">({s.originalId})</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isRejected ? (
                                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">REJECTED</span>
                                        ) : (
                                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold text-[10px]">ACCEPTED</span>
                                        )}
                                        <span className="text-gray-400 text-[11px]">{s.assignedLab || 'Lab'}</span>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                )}

                {/* Live Visual Print Preview */}
                <div className="p-6 bg-slate-100 dark:bg-slate-900 flex flex-col items-center justify-center gap-4">
                    <div className="flex items-center justify-between w-full max-w-lg text-[11px] font-bold text-sf-muted uppercase tracking-wider">
                        <span>Print Preview ({format === 'STANDARD' ? '101mm × 54mm' : '50mm × 25mm'})</span>
                        {isBatch && (
                            <span className="text-sf-emerald">
                                Showing 1 of {printableSamples.length} queued
                            </span>
                        )}
                    </div>

                    {/* PREVIEW CONTAINER */}
                    {previewSample && (
                        <div className="drop-shadow-xl">
                            {format === 'STANDARD' ? (
                                <StandardLabelCard
                                    sample={previewSample}
                                    branding={branding}
                                    qrDataUrl={qrDataUrls[previewSample.id || previewSample.labId || previewSample.originalId]}
                                />
                            ) : (
                                <CompactLabelCard
                                    sample={previewSample}
                                    branding={branding}
                                    qrDataUrl={qrDataUrls[previewSample.id || previewSample.labId || previewSample.originalId]}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Actions Footer */}
                <div className="p-4 border-t border-sf-divider flex justify-between items-center bg-gray-50/75 dark:bg-gray-800/75">
                    <div className="text-xs text-sf-muted">
                        {printableSamples.length === 0 ? (
                            <span className="text-rose-600 font-semibold">Please select at least 1 label to print.</span>
                        ) : (
                            <span>Ready to print <strong>{printableSamples.length}</strong> {printableSamples.length === 1 ? 'label' : 'labels'}.</span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 text-sf-muted font-bold hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors text-xs"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            disabled={printableSamples.length === 0}
                            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2 text-xs"
                        >
                            <Printer size={16} />
                            Print {printableSamples.length > 1 ? `${printableSamples.length} Labels` : 'Label'}
                        </button>
                    </div>
                </div>
            </div>

            {/* REAL PRINTABLE DOM CONTENT (Rendered only on print, with thermal page-break rules) */}
            <div className="print-only hidden">
                <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                        @page {
                            margin: 0;
                            size: ${format === 'STANDARD' ? '101mm 54mm' : '50mm 25mm'};
                        }
                        body {
                            margin: 0 !important;
                            padding: 0 !important;
                            background: white !important;
                        }
                        .print-only {
                            display: block !important;
                        }
                        .no-print {
                            display: none !important;
                        }
                        .sample-label-page {
                            page-break-after: always !important;
                            break-after: page !important;
                            display: flex !important;
                            align-items: center !important;
                            justify-content: center !important;
                            box-sizing: border-box !important;
                        }
                    }
                ` }} />

                {printableSamples.map((s, idx) => {
                    const key = s.id || s.labId || s.originalId;
                    const qrUrl = qrDataUrls[key];
                    return (
                        <div key={key} className="sample-label-page">
                            {format === 'STANDARD' ? (
                                <StandardLabelCard
                                    sample={s}
                                    branding={branding}
                                    qrDataUrl={qrUrl}
                                    isPrint={true}
                                />
                            ) : (
                                <CompactLabelCard
                                    sample={s}
                                    branding={branding}
                                    qrDataUrl={qrUrl}
                                    isPrint={true}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/**
 * Standard 101mm x 54mm (4" x 2") Sample / Bag Label
 */
const StandardLabelCard = ({ sample, branding, qrDataUrl, isPrint = false }) => {
    const isExpected = sample.status === 'EXPECTED';
    const labId = isExpected ? 'Pending' : (sample.labId || 'PENDING');
    const originalId = sample.originalId || 'N/A';
    const collectionDate = sample.samplingDetails?.date || sample.metadata?.date || sample.collectionDate || 'N/A';
    const assignedLab = sample.assignedLab || 'Global Lab';
    const projectCode = sample.projectCode || sample.projectId || 'Walk-in';

    return (
        <div
            className={`w-[101mm] h-[54mm] bg-white text-slate-900 p-3.5 border border-slate-300 shadow-sm flex flex-col font-sans select-none ${
                isPrint ? 'border-none p-2' : 'rounded'
            }`}
            style={{ boxSizing: 'border-box' }}
        >
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-1.5 mb-1.5">
                <div>
                    <h1 className="text-lg font-black uppercase tracking-tight text-slate-900 leading-tight line-clamp-1">
                        {branding?.title || 'SoilFER LIMS'}
                    </h1>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide line-clamp-1">
                        {branding?.organization || 'Reception Intake'} • {projectCode}
                    </p>
                </div>
                <div className="text-right shrink-0">
                    <div className="text-[8px] font-bold text-white bg-slate-900 px-1.5 py-0.5 rounded uppercase inline-block">
                        Intake
                    </div>
                    <div className="text-[9px] font-mono font-bold text-slate-600 mt-0.5">
                        {new Date().toISOString().split('T')[0]}
                    </div>
                </div>
            </div>

            {/* Core Body: QR Code + IDs */}
            <div className="flex flex-1 gap-3 items-center min-h-0">
                <div className="w-20 h-20 bg-white border border-slate-200 p-1 rounded shrink-0 flex items-center justify-center">
                    {qrDataUrl ? (
                        <img src={qrDataUrl} alt="QR" className="w-full h-full object-contain" />
                    ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[8px] text-slate-400">QR</div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="mb-1.5">
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Permanent Lab ID</div>
                        <div className="text-xl font-black font-mono leading-tight text-indigo-800 break-all">
                            {labId}
                        </div>
                    </div>
                    <div>
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Original Bag / Field ID</div>
                        <div className="text-[11px] font-bold text-slate-700 font-mono break-all line-clamp-2">
                            {originalId}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-1 border-t border-dashed border-slate-300 flex justify-between items-end text-[8px]">
                <div className="font-bold text-slate-500">
                    {collectionDate !== 'N/A' ? `Coll: ${collectionDate}` : `Rec: ${new Date().toLocaleDateString()}`}
                </div>
                <div className="font-black text-slate-900 uppercase">
                    {assignedLab}
                </div>
            </div>
        </div>
    );
};

/**
 * Compact 50mm x 25mm (2" x 1") Cryovial / Small Tube Label
 */
const CompactLabelCard = ({ sample, branding, qrDataUrl, isPrint = false }) => {
    const isExpected = sample.status === 'EXPECTED';
    const labId = isExpected ? 'Pending' : (sample.labId || 'PENDING');
    const originalId = sample.originalId || 'N/A';
    const assignedLab = sample.assignedLab || 'Lab';

    return (
        <div
            className={`w-[50mm] h-[25mm] bg-white text-slate-900 p-1.5 border border-slate-300 shadow-sm flex items-center gap-2 font-sans select-none ${
                isPrint ? 'border-none p-1' : 'rounded'
            }`}
            style={{ boxSizing: 'border-box' }}
        >
            {/* QR Code */}
            <div className="w-[20mm] h-[20mm] bg-white border border-slate-200 p-0.5 rounded shrink-0 flex items-center justify-center">
                {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR" className="w-full h-full object-contain" />
                ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[7px] text-slate-400">QR</div>
                )}
            </div>

            {/* Compact Monospace Details */}
            <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
                <div className="text-[7px] font-black text-slate-500 uppercase tracking-tight truncate leading-none">
                    {branding?.title || 'SoilFER'}
                </div>
                <div>
                    <div className="text-xs font-black font-mono leading-tight text-indigo-900 truncate">
                        {labId}
                    </div>
                    <div className="text-[8px] font-mono text-slate-600 truncate leading-tight">
                        {originalId}
                    </div>
                </div>
                <div className="text-[6.5px] font-bold text-slate-400 uppercase truncate leading-none">
                    {assignedLab} • {new Date().toISOString().split('T')[0]}
                </div>
            </div>
        </div>
    );
};

export default LabelPrintDialog;
