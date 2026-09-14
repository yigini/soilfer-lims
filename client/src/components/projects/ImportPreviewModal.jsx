import React, { useState } from 'react';
import axios from 'axios';
import { X, Upload, CheckCircle2, AlertTriangle, AlertCircle, FileText, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLanguage } from '../../context/LanguageContext';

export default function ImportPreviewModal({
    isOpen,
    onClose,
    project,
    onSuccess
}) {
    const { t } = useLanguage();
    const [rawInput, setRawInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [previewResult, setPreviewResult] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [committing, setCommitting] = useState(false);

    if (!isOpen || !project) return null;

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                const ids = data
                    .map(row => String(row[0] || '').trim())
                    .filter(id => id && id.toLowerCase() !== 'sample id' && id.toLowerCase() !== 'sample_id');

                setRawInput(ids.join('\n'));
                setPreviewResult(null);
                setErrorMessage('');
            } catch (err) {
                setErrorMessage('Failed to read spreadsheet file');
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleRunPreview = async () => {
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
                sampleIds: lines
            });
            setPreviewResult(res.data);
        } catch (err) {
            setErrorMessage(err.response?.data?.message || err.response?.data?.error || 'Preview validation failed');
        } finally {
            setLoading(false);
        }
    };

    const handleCommit = async () => {
        if (!previewResult || !previewResult.validSampleIds || previewResult.validSampleIds.length === 0) {
            return;
        }

        setCommitting(true);
        setErrorMessage('');

        try {
            const res = await axios.post(`/api/projects/${project.id}/manifest`, {
                sampleIds: previewResult.validSampleIds
            });
            onSuccess?.(res.data);
            onClose();
        } catch (err) {
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
                    <button onClick={onClose} className="text-sf-muted hover:text-sf-text p-1 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {errorMessage && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 text-red-800 dark:text-red-200 text-xs">
                        {errorMessage}
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
                                disabled={loading || !rawInput.trim()}
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
                                    : t('projects.import.registerEligible', { count: previewResult.validCount }, 'Register {{count}} expected samples')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
