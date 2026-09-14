import React, { useState } from 'react';
import axios from 'axios';
import { X, Upload, CheckCircle2, AlertTriangle, AlertCircle, FileText, FileSpreadsheet, ArrowRight, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
    getPendingManifest,
    setPendingManifest,
    deletePendingManifest
} from '../../services/pendingGovernanceStore';

import {
    MAX_FILE_SIZE,
    MAX_BATCH_ROWS,
    LOCALIZED_SAMPLE_HEADERS,
    detectIdColumns,
    extractIdsFromColumn
} from '../../utils/spreadsheetImport';

export {
    MAX_FILE_SIZE,
    MAX_BATCH_ROWS,
    LOCALIZED_SAMPLE_HEADERS,
    detectIdColumns,
    extractIdsFromColumn
};

export default function ImportPreviewModal({
    isOpen,
    onClose,
    project,
    onSuccess
}) {
    const { t } = useLanguage();
    const { user } = useAuth();
    const actorId = user?.id || 'anonymous';

    const [rawInput, setRawInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [previewResult, setPreviewResult] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [committing, setCommitting] = useState(false);

    const [unresolvedOp, setUnresolvedOp] = useState(() => (project?.id ? getPendingManifest(actorId, project.id) : null));

    // Retain unresolved operation across background prop refreshes and modal reopens for same actor
    React.useEffect(() => {
        if (isOpen && project?.id) {
            const existing = getPendingManifest(actorId, project.id);
            if (existing) {
                setUnresolvedOp(existing);
                if (!previewResult && existing.previewResult) {
                    setPreviewResult(existing.previewResult);
                }
                if (!rawInput && existing.rawInput) {
                    setRawInput(existing.rawInput);
                }
            } else {
                setUnresolvedOp(null);
            }
        } else if (!isOpen) {
            setUnresolvedOp(null);
        }
    }, [isOpen, project?.id, actorId]);

    const [uploadedFileInfo, setUploadedFileInfo] = useState(null);
    const [parsedSheetData, setParsedSheetData] = useState(null);

    // Invalidate sensitive visible state on account switch or logout
    React.useEffect(() => {
        setRawInput('');
        setPreviewResult(null);
        setErrorMessage('');
        setUnresolvedOp(null);
        setUploadedFileInfo(null);
        setParsedSheetData(null);
    }, [actorId]);

    React.useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !project) return null;

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Reset file input element so selecting the same file again triggers change
        e.target.value = '';

        if (file.size > MAX_FILE_SIZE) {
            setErrorMessage(t('projects.import.fileTooLarge', `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed limit of 5 MB.`));
            setRawInput('');
            setParsedSheetData(null);
            setUploadedFileInfo(null);
            setPreviewResult(null);
            return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                // raw: false ensures cellText is preserved, maintaining leading zeros in identifiers (e.g. '000124')
                const wb = XLSX.read(data, { type: 'array', raw: false, cellText: true });
                const wsname = wb.SheetNames[0];
                if (!wsname) {
                    setErrorMessage(t('projects.import.emptyFile', 'The selected spreadsheet file has no sheets.'));
                    setRawInput('');
                    setParsedSheetData(null);
                    setUploadedFileInfo(null);
                    setPreviewResult(null);
                    return;
                }

                const ws = wb.Sheets[wsname];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

                if (!rows || rows.length === 0) {
                    setErrorMessage(t('projects.import.emptyFile', 'The selected spreadsheet file is empty.'));
                    setRawInput('');
                    setParsedSheetData(null);
                    setUploadedFileInfo(null);
                    setPreviewResult(null);
                    return;
                }

                const headerRow = rows[0] || [];
                const matchingCols = detectIdColumns(headerRow);

                const isAmbiguous = matchingCols.length > 1;
                const headerDetected = matchingCols.length > 0;
                const detectedColIdx = matchingCols.length > 0 ? matchingCols[0] : 0;

                // Compute column descriptors for dropdown
                const columns = headerRow.map((colName, idx) => {
                    const name = String(colName || '').trim();
                    const letter = String.fromCharCode(65 + (idx % 26));
                    return {
                        index: idx,
                        label: name ? `Column ${letter}: "${name}"` : `Column ${letter}`,
                        headerText: name
                    };
                });

                // Extract IDs
                const extractRes = extractIdsFromColumn(rows, detectedColIdx, headerDetected);

                if (!extractRes.success) {
                    // Explicit failure: invalidate prior file & raw IDs, retain error
                    setErrorMessage(extractRes.error);
                    setRawInput('');
                    setParsedSheetData(null);
                    setUploadedFileInfo(null);
                    setPreviewResult(null);
                    return;
                }

                setParsedSheetData(rows);
                setUploadedFileInfo({
                    fileName: file.name,
                    columns,
                    selectedColIdx: detectedColIdx,
                    hasHeader: headerDetected,
                    isAmbiguous,
                    confirmed: !isAmbiguous
                });
                setRawInput(extractRes.ids.join('\n'));
                setPreviewResult(null);
                setErrorMessage('');
            } catch (err) {
                setErrorMessage(t('projects.import.readError', 'Failed to read spreadsheet file: ' + err.message));
                setRawInput('');
                setParsedSheetData(null);
                setUploadedFileInfo(null);
                setPreviewResult(null);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleColumnChange = (newColIdx) => {
        if (!parsedSheetData || !uploadedFileInfo) return;
        const colIdx = parseInt(newColIdx, 10);
        const extractRes = extractIdsFromColumn(parsedSheetData, colIdx, uploadedFileInfo.hasHeader);
        if (!extractRes.success) {
            setErrorMessage(extractRes.error);
            setRawInput('');
            setPreviewResult(null);
            setUploadedFileInfo(prev => ({ ...prev, selectedColIdx: colIdx, isAmbiguous: false, confirmed: true }));
            return;
        }
        setUploadedFileInfo(prev => ({ ...prev, selectedColIdx: colIdx, isAmbiguous: false, confirmed: true }));
        setRawInput(extractRes.ids.join('\n'));
        setPreviewResult(null);
        setErrorMessage('');
    };

    const handleHeaderToggle = (newHasHeader) => {
        if (!parsedSheetData || !uploadedFileInfo) return;
        const extractRes = extractIdsFromColumn(parsedSheetData, uploadedFileInfo.selectedColIdx, newHasHeader);
        if (!extractRes.success) {
            setErrorMessage(extractRes.error);
            setRawInput('');
            setPreviewResult(null);
            setUploadedFileInfo(prev => ({ ...prev, hasHeader: newHasHeader }));
            return;
        }
        setUploadedFileInfo(prev => ({ ...prev, hasHeader: newHasHeader }));
        setRawInput(extractRes.ids.join('\n'));
        setPreviewResult(null);
        setErrorMessage('');
    };

    const handleRunPreview = async () => {
        if (uploadedFileInfo?.isAmbiguous && !uploadedFileInfo?.confirmed) {
            setErrorMessage(t('projects.import.confirmColumnRequired', 'Multiple potential identifier columns detected. Please confirm the correct column before running preview.'));
            return;
        }

        const lines = rawInput
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean);

        if (lines.length === 0) {
            setErrorMessage(t('projects.import.enterIdsError', 'Please enter or upload at least one sample ID.'));
            return;
        }

        setLoading(true);
        setErrorMessage('');
        setPreviewResult(null);

        try {
            const res = await axios.post(`/api/projects/${project.id}/imports/preview`, {
                sampleIds: lines,
                targetLabId: project.labId || undefined
            });
            setPreviewResult(res.data);
        } catch (err) {
            setErrorMessage(err.response?.data?.message || err.response?.data?.error || 'Preview validation failed');
        } finally {
            setLoading(false);
        }
    };

    const handleRecoverUnresolved = async () => {
        if (!unresolvedOp || !project) return;
        setCommitting(true);
        setErrorMessage('');
        try {
            const res = await axios.get(`/api/projects/${project.id}/operations/${unresolvedOp.idempotencyKey}`);
            if (res.data?.receipt?.outcome) {
                deletePendingManifest(actorId, project.id);
                setUnresolvedOp(null);
                onSuccess?.(res.data.receipt.outcome);
                onClose();
                return;
            }
            setErrorMessage(t('projects.import.receiptNotFoundYet', 'No completed receipt recorded on server for this attempt. You may safely retry or discard.'));
        } catch (err) {
            if (err.response?.status === 404) {
                setErrorMessage(t('projects.import.receiptNotFoundYet', 'No completed receipt recorded on server for this attempt. You may safely retry or discard.'));
            } else {
                setErrorMessage(err.response?.data?.message || err.message || 'Failed to check operation receipt status');
            }
        } finally {
            setCommitting(false);
        }
    };

    const handleDiscardUnresolved = () => {
        if (project) {
            deletePendingManifest(actorId, project.id);
        }
        setUnresolvedOp(null);
        setErrorMessage('');
    };

    const handleCommit = async () => {
        if (!previewResult || !previewResult.validSampleIds || previewResult.validSampleIds.length === 0) {
            return;
        }

        const snapshot = {
            sampleIds: previewResult.validSampleIds,
            previewHash: previewResult.previewHash,
            previewToken: previewResult.previewToken,
            targetLabId: previewResult.destinationLabId || project.labId || undefined
        };

        const isSnapshotEqual = unresolvedOp?.snapshot &&
            JSON.stringify(unresolvedOp.snapshot.sampleIds) === JSON.stringify(snapshot.sampleIds) &&
            unresolvedOp.snapshot.previewHash === snapshot.previewHash &&
            unresolvedOp.snapshot.previewToken === snapshot.previewToken &&
            unresolvedOp.snapshot.targetLabId === snapshot.targetLabId;

        if (unresolvedOp && !isSnapshotEqual) {
            setErrorMessage(t('projects.import.unresolvedConflictNotice', 'A previous manifest registration attempt is still unconfirmed. Recover the previous outcome or click "Discard attempt" before submitting new values.'));
            return;
        }

        setCommitting(true);
        setErrorMessage('');

        const idempotencyKey = unresolvedOp
            ? unresolvedOp.idempotencyKey
            : (typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : (`man-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`));

        const expectedRevision = unresolvedOp?.expectedRevision !== undefined
            ? unresolvedOp.expectedRevision
            : (project.updatedAt ? String(new Date(project.updatedAt).getTime()) : null);

        const commandRecord = {
            idempotencyKey,
            projectId: project.id,
            snapshot: JSON.parse(JSON.stringify(snapshot)),
            expectedRevision,
            rawInput,
            previewResult,
            status: 'uncertain'
        };
        setPendingManifest(actorId, project.id, commandRecord);
        setUnresolvedOp(commandRecord);

        try {
            // If retrying an uncertain commit, attempt receipt lookup first
            if (unresolvedOp) {
                try {
                    const checkRes = await axios.get(`/api/projects/${project.id}/operations/${idempotencyKey}`);
                    if (checkRes.data?.receipt?.outcome) {
                        deletePendingManifest(actorId, project.id);
                        setUnresolvedOp(null);
                        onSuccess?.(checkRes.data.receipt.outcome);
                        onClose();
                        return;
                    }
                } catch (checkErr) {
                    // Receipt not found yet, proceed with manifest POST
                }
            }

            const headers = {
                'x-idempotency-key': idempotencyKey
            };
            if (commandRecord.expectedRevision) {
                headers['if-match'] = commandRecord.expectedRevision;
            }

            const res = await axios.post(`/api/projects/${project.id}/manifest`, {
                sampleIds: previewResult.validSampleIds,
                previewHash: previewResult.previewHash,
                previewToken: previewResult.previewToken,
                targetLabId: previewResult.destinationLabId || project.labId || undefined,
                idempotencyKey
            }, { headers });

            deletePendingManifest(actorId, project.id);
            setUnresolvedOp(null);
            onSuccess?.(res.data);
            onClose();
        } catch (err) {
            const status = err.response?.status;
            const errCode = err.response?.data?.code || err.response?.data?.error;
            if (status === 409 && (errCode === 'STALE_REVISION' || errCode === 'PREVIEW_STALE_REVISION')) {
                deletePendingManifest(actorId, project.id);
                setUnresolvedOp(null);
            }
            setErrorMessage(err.response?.data?.message || err.response?.data?.error || 'Failed to register manifest samples');
        } finally {
            setCommitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-sf-surface border border-sf-divider rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 my-auto">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-sf-divider">
                    <div>
                        <h2 className="text-lg font-bold text-sf-text">
                            {t('projects.import.modalTitle', 'Preview expected sample manifest')}
                        </h2>
                        <p className="text-xs text-sf-muted mt-0.5">
                            {t('projects.import.modalSubtitle', 'Validate identifiers, detect duplicates, and preview outcome before registration.')}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-sf-muted hover:text-sf-text p-1 rounded-lg" aria-label="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {errorMessage && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 text-red-800 dark:text-red-200 text-xs">
                        {errorMessage}
                    </div>
                )}

                {unresolvedOp && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                            <div className="flex-1">
                                <span className="font-semibold">{t('projects.import.unresolvedTitle', 'Unconfirmed previous registration attempt')}</span>
                                <p className="mt-0.5 text-[11px] text-amber-800/80 dark:text-amber-300/80">
                                    {t('projects.import.unresolvedDesc', 'A previous manifest registration attempt may have been processed by the server before the connection was interrupted.')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <button
                                type="button"
                                onClick={handleRecoverUnresolved}
                                disabled={committing || loading}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                            >
                                <RefreshCw className={`w-3 h-3 ${committing ? 'animate-spin' : ''}`} />
                                {t('projects.actions.recoverAttempt', 'Recover previous attempt')}
                            </button>
                            <button
                                type="button"
                                onClick={handleDiscardUnresolved}
                                disabled={committing || loading}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-amber-400/60 dark:border-amber-600/60 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 transition-colors"
                            >
                                {t('projects.actions.discardAttempt', 'Discard attempt')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Textarea or Upload */}
                {!previewResult && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-sf-text">
                                {t('projects.import.pasteIdsLabel', 'Field sample identifiers (one per line)')}
                            </label>
                            <label className="text-xs font-semibold text-sf-primary hover:underline cursor-pointer flex items-center gap-1">
                                <Upload className="w-3.5 h-3.5" />
                                <span>{t('projects.import.uploadExcel', 'Upload .xlsx file')}</span>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls, .csv"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </label>
                        </div>

                        {uploadedFileInfo && (
                            <div className="p-3 rounded-xl border border-sf-border bg-sf-inset space-y-2.5">
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 font-medium text-sf-text">
                                        <FileSpreadsheet className="w-4 h-4 text-sf-primary shrink-0" />
                                        <span className="truncate max-w-[280px]">{uploadedFileInfo.fileName}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUploadedFileInfo(null);
                                            setParsedSheetData(null);
                                            setRawInput('');
                                        }}
                                        className="text-[11px] text-sf-muted hover:text-red-600 transition-colors"
                                    >
                                        {t('common.clear', 'Clear file')}
                                    </button>
                                </div>

                                {uploadedFileInfo.isAmbiguous && !uploadedFileInfo.confirmed && (
                                    <div className="p-2.5 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                                        <div className="flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span className="font-semibold">{t('projects.import.ambiguousColsWarning', 'Multiple potential identifier columns detected. Please confirm the correct column.')}</span>
                                        </div>
                                        <div className="flex justify-end pt-1">
                                            <button
                                                type="button"
                                                onClick={() => setUploadedFileInfo(prev => ({ ...prev, isAmbiguous: false, confirmed: true }))}
                                                className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                                            >
                                                {t('projects.import.confirmColumnBtn', 'Confirm selected column')}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2 pt-1 border-t border-sf-divider">
                                    {uploadedFileInfo.columns.length > 1 && (
                                        <div className="flex items-center gap-2 text-xs">
                                            <label className="text-sf-muted whitespace-nowrap text-[11px]">
                                                {t('projects.import.columnSelect', 'Sample ID column:')}
                                            </label>
                                            <select
                                                value={uploadedFileInfo.selectedColIdx}
                                                onChange={(e) => handleColumnChange(e.target.value)}
                                                className="w-full text-xs rounded-lg border border-sf-border bg-sf-surface p-1 text-sf-text focus:ring-1 focus:ring-sf-primary focus:outline-none"
                                            >
                                                {uploadedFileInfo.columns.map(col => (
                                                    <option key={col.index} value={col.index}>
                                                        {col.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <label className="flex items-center gap-2 text-xs font-semibold text-sf-text cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={uploadedFileInfo.hasHeader}
                                            onChange={(e) => handleHeaderToggle(e.target.checked)}
                                            className="rounded border-sf-border text-sf-primary focus:ring-sf-primary"
                                        />
                                        <span>{t('projects.import.fileHasHeader', 'File includes header row (skip row 1)')}</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        <textarea
                            value={rawInput}
                            onChange={(e) => setRawInput(e.target.value)}
                            placeholder="GTM0021-1-1C&#10;GTM0022-1-1C&#10;000124"
                            rows={6}
                            className="w-full text-xs font-mono rounded-xl border border-sf-border bg-sf-inset p-3 text-sf-text placeholder:text-sf-muted focus:ring-2 focus:ring-sf-primary focus:outline-none"
                        />

                        <div className="p-3 rounded-xl border border-sf-divider bg-sf-inset text-[11px] text-sf-muted">
                            {t('projects.import.leadingZerosNotice', 'Leading zeros (e.g. "000124") and special alphanumeric characters are preserved exactly.')}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={onClose}
                                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-sf-border text-sf-muted hover:bg-sf-hover"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={handleRunPreview}
                                disabled={loading || !rawInput.trim() || (uploadedFileInfo?.isAmbiguous && !uploadedFileInfo?.confirmed)}
                                className="btn-primary text-xs"
                            >
                                {loading ? t('common.loading', 'Validating…') : t('projects.import.runValidation', 'Run preview validation →')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Preview Outcome Report */}
                {previewResult && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="p-2.5 rounded-xl border border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200">
                                <div className="text-lg font-bold">{previewResult.validCount}</div>
                                <div className="text-[11px] font-medium">{t('projects.import.readyToRegister', 'Ready as expected')}</div>
                            </div>
                            <div className="p-2.5 rounded-xl border border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200">
                                <div className="text-lg font-bold">{previewResult.conflictCount}</div>
                                <div className="text-[11px] font-medium">{t('projects.import.alreadyExists', 'Existing in DB')}</div>
                            </div>
                            <div className="p-2.5 rounded-xl border border-sf-divider bg-sf-inset text-sf-text">
                                <div className="text-lg font-bold">{previewResult.errorCount}</div>
                                <div className="text-[11px] font-medium">{t('projects.import.batchIssues', 'Duplicate/Blank')}</div>
                            </div>
                        </div>

                        {/* Outcomes Table */}
                        <div className="max-h-48 overflow-y-auto rounded-xl border border-sf-divider">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-sf-inset border-b border-sf-divider text-[11px] font-semibold text-sf-muted">
                                        <th className="py-2 px-3">{t('projects.import.sampleIdCol', 'Sample ID')}</th>
                                        <th className="py-2 px-3">{t('projects.import.outcomeCol', 'Validation Outcome')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sf-divider/70">
                                    {previewResult.conflicts?.map((c, i) => (
                                        <tr key={`c-${i}`} className="bg-amber-50/30 dark:bg-amber-950/10">
                                            <td className="py-1.5 px-3 font-mono font-medium text-sf-text">{c.sampleId}</td>
                                            <td className="py-1.5 px-3 text-amber-700 dark:text-amber-300 text-[11px]">
                                                {t('projects.import.conflictWithProj', { proj: c.existingProject || 'LIMS' }, 'Already in project {{proj}}')}
                                            </td>
                                        </tr>
                                    ))}
                                    {previewResult.errors?.map((err, i) => (
                                        <tr key={`e-${i}`} className="bg-red-50/30 dark:bg-red-950/10">
                                            <td className="py-1.5 px-3 font-mono font-medium text-sf-text">{err.sampleId || `Row ${err.row}`}</td>
                                            <td className="py-1.5 px-3 text-red-700 dark:text-red-300 text-[11px]">{err.message || err.error}</td>
                                        </tr>
                                    ))}
                                    {previewResult.validSampleIds?.slice(0, 10).map((id, i) => (
                                        <tr key={`v-${i}`}>
                                            <td className="py-1.5 px-3 font-mono font-medium text-sf-text">{id}</td>
                                            <td className="py-1.5 px-3 text-emerald-700 dark:text-emerald-300 text-[11px]">
                                                {t('projects.import.validOutcome', 'Ready as expected')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <button
                                onClick={() => setPreviewResult(null)}
                                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-sf-border text-sf-muted hover:bg-sf-hover"
                            >
                                {t('projects.import.editRows', '← Edit rows')}
                            </button>
                            <button
                                onClick={handleCommit}
                                disabled={committing || previewResult.validCount === 0}
                                className="btn-primary text-xs"
                            >
                                {committing
                                    ? t('common.loading', 'Registering…')
                                    : (unresolvedOp
                                        ? t('projects.import.retryRegistration', 'Retry registration')
                                        : t('projects.import.registerEligible', { count: previewResult.validCount }, 'Register {{count}} expected samples'))}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
