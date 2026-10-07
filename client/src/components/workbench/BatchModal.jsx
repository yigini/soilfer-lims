import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { X, Layers, ShieldCheck, AlertTriangle, CheckCircle2, FlaskConical, PlusCircle } from 'lucide-react';
import { useAnalysisNames } from '../../context/AnalysisCatalogueContext';
import numberParse from '@lims/number-parse';
import NumberPreview from './NumberPreview';
import { useLanguage } from '../../context/LanguageContext';
import NativeRunPanel from './NativeRunPanel';

const EMPTY_QC_FORM = { blankVal: '', ctrlExpected: '', ctrlMeasured: '', dupVal1: '', dupVal2: '', duplicateOfPositionId: '' };

export default function BatchModal({
    isOpen,
    onClose,
    analysisCode = '',
    selectedWorkItemIds = [],
    onBatchUpdated
}) {
    const getAnalysisDisplayName = useAnalysisNames();
    const { t } = useLanguage();
    const qcError = (error, fallback) => {
        const code = error.response?.data?.code, message = error.response?.data?.error || error.message || fallback;
        return code ? t(`${code.startsWith('REFERENCE_') ? 'referenceMaterials' : 'qcRuns'}.errors.${code}`, message) : message;
    };
    const [activeTab, setActiveTab] = useState('create'); // 'create' | 'allocate' | 'qc'
    const [batches, setBatches] = useState([]);
    const [selectedBatchId, setSelectedBatchId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    // Form state for Create
    const [createForm, setCreateForm] = useState({
        id: '',
        profile: 'RACK_40',
        instrument: 'Metrohm 914 pH/Conductometer',
        notes: ''
    });

    // Form state for QC Evaluation
    const [qcForm, setQcForm] = useState({ ...EMPTY_QC_FORM });
    const [referenceMaterials, setReferenceMaterials] = useState([]);
    const [referenceLink, setReferenceLink] = useState({ referenceMaterialId: '', referenceUse: '' });
    const [referenceLoadError, setReferenceLoadError] = useState(false);
    const [extraQc, setExtraQc] = useState([]);
    const currentBatch = batches.find(b => b.id === selectedBatchId) || batches[0] || null;
    const native = currentBatch?.analytes?.length > 0 && currentBatch.analytes.every(row => row.provenance === 'NATIVE');
    let savedControl, savedEvaluation;
    try { savedEvaluation = typeof currentBatch?.qcResults === 'string' ? JSON.parse(currentBatch.qcResults) : currentBatch?.qcResults; savedControl = savedEvaluation?.controls?.[0]; }
    catch { /* Unreadable evidence is handled by the existing QC authority. */ }

    useEffect(() => {
        setQcForm({ ...EMPTY_QC_FORM });
        const required = currentBatch?.qcRequirements;
        const entries = [];
        for (const type of ['BLANK', 'CONTROL', 'DUPLICATE']) {
            const count = type === 'CONTROL' ? Math.max(required?.CONTROL?.required || 0, required?.LRM?.required || 0) : required?.[type]?.required || 0;
            for (let index = 1; index < count; index++) entries.push({ id: `${type}-${index}`, type, value: '', expected: '', measured: '', value1: '', value2: '', referenceMaterialId: '', referenceUse: '' });
        }
        setExtraQc(entries);
    }, [isOpen, selectedBatchId, currentBatch?.qcRequirements?.BLANK?.required, currentBatch?.qcRequirements?.CONTROL?.required,
        currentBatch?.qcRequirements?.LRM?.required, currentBatch?.qcRequirements?.DUPLICATE?.required]);

    useEffect(() => {
        let current = true;
        setReferenceMaterials([]); setReferenceLoadError(false);
        if (isOpen && currentBatch?.labId) axios.get('/api/reference-materials', { params: { labId: currentBatch.labId } })
            .then(response => { if (current) setReferenceMaterials(response.data.data || []); })
            .catch(() => { if (current) setReferenceLoadError(true); });
        return () => { current = false; };
    }, [isOpen, currentBatch?.labId]);
    useEffect(() => {
        setReferenceLink({ referenceMaterialId: savedControl?.referenceMaterialId || '', referenceUse: savedControl?.referenceUse || '' });
    }, [isOpen, selectedBatchId, savedControl?.referenceMaterialId, savedControl?.referenceUse]);

    const fetchBatches = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/qc/batches', {
                params: { analysis: analysisCode }
            });
            const data = res.data.data || [];
            setBatches(data);
            if (data.length > 0 && !selectedBatchId) {
                setSelectedBatchId(data[0].id);
            }
        } catch (err) {
            console.error('[BatchModal] Fetch batches error:', err);
        } finally {
            setLoading(false);
        }
    }, [analysisCode, selectedBatchId]);

    useEffect(() => {
        if (isOpen) {
            setError(null);
            setSuccessMsg(null);
            fetchBatches();
        }
    }, [isOpen, fetchBatches]);

    if (!isOpen) return null;

    const qcMeasurements = Object.fromEntries(Object.entries(qcForm).map(([field, raw]) => {
        const duplicate = field.startsWith('dup');
        const parsed = duplicate ? numberParse.parseDuplicateObservation(raw, currentBatch?.numberFormat) : numberParse.parseNumber(raw, currentBatch?.numberFormat);
        return [field, parsed.valid && (!parsed.qualifier || duplicate) ? (parsed.censored ? parsed.canonical : parsed.value) : NaN];
    }));
    const hasRules = !!currentBatch?.qcRequirements;
    const entered = raw => String(raw ?? '').trim() !== '';
    const includeBlank = !hasRules || entered(qcForm.blankVal);
    const includeControl = !hasRules || entered(qcForm.ctrlExpected) || entered(qcForm.ctrlMeasured) || !!referenceLink.referenceMaterialId;
    const includeDuplicate = !hasRules || entered(qcForm.dupVal1) || entered(qcForm.dupVal2);
    const sampleParents = (currentBatch?.analytes?.find(row => row.analysisCode === currentBatch.analysis)?.positions || currentBatch?.positions || [])
        .filter(row => row.kind === 'SAMPLE');
    const validParent = id => !sampleParents.length || sampleParents.some(row => row.id === id);
    const parentSelector = (value, onChange, testId) => sampleParents.length > 0 && <label className="grid gap-1 text-xs">
        {t('qcRuns.duplicateParent')}
        <select value={value || ''} onChange={e => onChange(e.target.value)} required data-testid={testId}
            className="p-2 rounded border border-sf-divider bg-sf-canvas text-sf-text">
            <option value="">{t('qcRuns.chooseDuplicateParent')}</option>
            {sampleParents.map(position => <option key={position.id} value={position.id}>
                {position.position} · {currentBatch.workItems?.find(item => item.sampleId === position.sampleId)?.sample?.originalId || position.sampleId}
            </option>)}
        </select>
    </label>;
    const sameLink = savedControl?.referenceMaterialId === referenceLink.referenceMaterialId && savedControl?.referenceUse === referenceLink.referenceUse;
    const payload = {
        blanks: includeBlank ? [{ value: qcMeasurements.blankVal, rawInput: { value: qcForm.blankVal } }] : [],
        controls: includeControl ? [{ ...(savedControl?.id && { id: savedControl.id }),
            ...(referenceLink.referenceMaterialId ? { ...referenceLink, ...(sameLink && { referenceValueId: savedControl.referenceValueId }) } : { expected: qcMeasurements.ctrlExpected }),
            measured: qcMeasurements.ctrlMeasured, rawInput: { expected: referenceLink.referenceMaterialId ? null : qcForm.ctrlExpected, measured: qcForm.ctrlMeasured } }] : [],
        duplicates: includeDuplicate ? [{ ...(qcForm.duplicateOfPositionId && { duplicateOfPositionId: qcForm.duplicateOfPositionId }),
            value1: qcMeasurements.dupVal1, value2: qcMeasurements.dupVal2, rawInput: { value1: qcForm.dupVal1, value2: qcForm.dupVal2 } }] : []
    };
    let extrasValid = true;
    const parseExtra = (raw, duplicate = false) => {
        const parsed = duplicate ? numberParse.parseDuplicateObservation(raw, currentBatch?.numberFormat) : numberParse.parseNumber(raw, currentBatch?.numberFormat);
        if (!parsed.valid || (parsed.qualifier && !duplicate)) extrasValid = false;
        return parsed.censored ? parsed.canonical : parsed.value;
    };
    for (const entry of extraQc) {
        if (entry.type === 'BLANK') payload.blanks.push({ value: parseExtra(entry.value), rawInput: { value: entry.value } });
        if (entry.type === 'DUPLICATE') {
            if (!validParent(entry.duplicateOfPositionId)) extrasValid = false;
            payload.duplicates.push({ ...(entry.duplicateOfPositionId && { duplicateOfPositionId: entry.duplicateOfPositionId }),
                value1: parseExtra(entry.value1, true), value2: parseExtra(entry.value2, true), rawInput: { value1: entry.value1, value2: entry.value2 } });
        }
        if (entry.type === 'CONTROL') {
            if (entry.referenceMaterialId && !['CRM', 'LRM'].includes(entry.referenceUse)) extrasValid = false;
            payload.controls.push({ ...(entry.referenceMaterialId ? { referenceMaterialId: entry.referenceMaterialId, referenceUse: entry.referenceUse } : { expected: parseExtra(entry.expected) }),
                measured: parseExtra(entry.measured), rawInput: { expected: entry.referenceMaterialId ? null : entry.expected, measured: entry.measured } });
        }
    }
    const validPrimary = (!includeBlank || Number.isFinite(qcMeasurements.blankVal)) &&
        (!includeControl || (Number.isFinite(qcMeasurements.ctrlMeasured) && (referenceLink.referenceMaterialId ? ['CRM', 'LRM'].includes(referenceLink.referenceUse) : Number.isFinite(qcMeasurements.ctrlExpected)))) &&
        (!includeDuplicate || validParent(qcForm.duplicateOfPositionId) && ['dupVal1', 'dupVal2'].every(field => numberParse.parseDuplicateObservation(qcForm[field], currentBatch?.numberFormat).valid));
    const counts = { BLANK: payload.blanks.length, CONTROL: payload.controls.length, DUPLICATE: payload.duplicates.length, LRM: payload.controls.filter(row => row.referenceUse !== 'CRM').length };
    const completeCounts = !hasRules || currentBatch.qcMode !== 'REQUIRED_BLOCKING' || Object.entries(currentBatch.qcRequirements).every(([type, row]) => counts[type] >= row.required);
    const qcFormComplete = validPrimary && extrasValid && completeCounts && Object.values(counts).some(count => count > 0);
    const updateExtra = (id, patch) => setExtraQc(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row));

    // Handle Create Batch
    const handleCreateBatch = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);
        try {
            setLoading(true);
            const payload = {
                analysis: analysisCode,
                profile: createForm.profile,
                instrument: createForm.instrument,
                notes: createForm.notes
            };
            if (createForm.id.trim()) {
                payload.id = createForm.id.trim();
            }

            const res = await axios.post('/api/qc/batches', payload);
            const created = res.data;
            setSuccessMsg(`Batch run "${created.id}" created successfully (${createForm.profile})`);
            setCreateForm({ id: '', profile: 'RACK_40', instrument: 'Metrohm 914 pH/Conductometer', notes: '' });
            await fetchBatches();
            setSelectedBatchId(created.id);
            setActiveTab('allocate');
            if (onBatchUpdated) onBatchUpdated();
        } catch (err) {
            setError(qcError(err, 'Failed to create batch'));
        } finally {
            setLoading(false);
        }
    };

    // Handle Allocate Selected Items
    const handleAllocate = async () => {
        if (!selectedBatchId) {
            setError('Please select a batch first.');
            return;
        }
        if (selectedWorkItemIds.length === 0) {
            setError('No samples selected in worksheet. Check sample rows first.');
            return;
        }

        setError(null);
        setSuccessMsg(null);
        try {
            setLoading(true);
            const res = await axios.post(`/api/qc/batches/${selectedBatchId}/items`, {
                workItemIds: selectedWorkItemIds
            });
            const added = res.data;
            const count = Object.keys(added.positions || {}).length;
            setSuccessMsg(`Successfully allocated ${count} sample(s) to rack positions in ${selectedBatchId}`);
            await fetchBatches();
            if (onBatchUpdated) onBatchUpdated();
        } catch (err) {
            const errMsg = qcError(err, 'Allocation failed');
            setError(`Boundary error (HTTP ${err.response?.status || 400}): ${errMsg}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle QC Evaluation
    const handleEvaluateQc = async () => {
        if (!selectedBatchId || loading || !qcFormComplete) return;
        setError(null);
        setSuccessMsg(null);
        try {
            setLoading(true);
            const res = await axios.post(`/api/qc/batches/${selectedBatchId}/evaluate`, payload);

            setSuccessMsg(res.data.batch?.result === 'NOT_REQUIRED' ? t('qcRuns.notRequired') : `QC evaluated: Status is now ${res.data.status}`);
            await fetchBatches();
            if (onBatchUpdated) onBatchUpdated();
        } catch (err) {
            setError(qcError(err, 'QC evaluation failed'));
        } finally {
            setLoading(false);
        }
    };

    // Handle Close Batch Attempt
    const handleCloseBatch = async () => {
        if (!selectedBatchId) return;
        setError(null);
        setSuccessMsg(null);
        try {
            setLoading(true);
            await axios.put(`/api/qc/batches/${selectedBatchId}`, { status: 'CLOSED' });
            setSuccessMsg('Batch closed successfully.');
            await fetchBatches();
        } catch (err) {
            const status = err.response?.status;
            const errMsg = qcError(err, 'Only Managers can close batches');
            setError(`HTTP ${status}: ${errMsg || 'Only Managers can close batches'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-sf-surface rounded-2xl shadow-2xl border border-sf-divider w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-sf-divider bg-sf-canvas/50">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Layers size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-sf-text">
                                Batch Run & QC Management
                            </h2>
                            <p className="text-xs text-sf-muted">
                                Method: <span className="font-semibold text-sf-text">{getAnalysisDisplayName(analysisCode)}</span> · Physical Rack Allocation & QC Controls
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-sf-muted hover:text-sf-text hover:bg-sf-hover transition-colors"
                        title="Close modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-sf-divider px-6 bg-sf-canvas/30">
                    {[
                        { id: 'create', label: 'Create Run / Batch' },
                        { id: 'allocate', label: `Allocate Samples (${selectedWorkItemIds.length} selected)` },
                        { id: 'qc', label: 'QC Measurements & State' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            data-testid={`batch-tab-${tab.id}`}
                            onClick={() => { setActiveTab(tab.id); setError(null); setSuccessMsg(null); }}
                            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                                activeTab === tab.id
                                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                                    : 'border-transparent text-sf-muted hover:text-sf-text'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Notifications */}
                {error && (
                    <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                        <span className="font-medium">{error}</span>
                    </div>
                )}
                {successMsg && (
                    <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                        <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                        <span className="font-medium">{successMsg}</span>
                    </div>
                )}

                {/* Content */}
                <div className="p-6 space-y-5">
                    {/* TAB 1: CREATE BATCH */}
                    {activeTab === 'create' && (
                        <form onSubmit={handleCreateBatch} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-sf-text mb-1">
                                        Run Profile Architecture *
                                    </label>
                                    <select
                                        value={createForm.profile}
                                        onChange={(e) => setCreateForm({ ...createForm, profile: e.target.value })}
                                        className="w-full text-xs p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sf-text focus:ring-1 focus:ring-emerald-500"
                                    >
                                        <option value="RACK_40">RACK_40 (40 Places: 36 Samples max, 4 QC slots)</option>
                                        <option value="MICROPLATE_96">MICROPLATE_96 (96 Wells: 92 Samples max, 4 QC slots)</option>
                                        <option value="CENTRIFUGE_24">CENTRIFUGE_24 (24 Tubes: 21 Samples max, 3 QC slots)</option>
                                    </select>
                                    <p className="text-[11px] text-sf-muted mt-1">
                                        Strict capacity enforcement: QC slots 1, 2, 20, 40 reserved.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-sf-text mb-1">
                                        Instrument Asset
                                    </label>
                                    <input
                                        type="text"
                                        value={createForm.instrument}
                                        onChange={(e) => setCreateForm({ ...createForm, instrument: e.target.value })}
                                        placeholder="e.g. Metrohm 914 pH/Conductometer"
                                        className="w-full text-xs p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sf-text focus:ring-1 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-sf-text mb-1">
                                    Custom Batch ID (Optional)
                                </label>
                                <input
                                    type="text"
                                    data-testid="batch-id-input"
                                    value={createForm.id}
                                    onChange={(e) => setCreateForm({ ...createForm, id: e.target.value })}
                                    placeholder="Leave blank for auto-generated BATCH-TIMESTAMP"
                                    className="w-full text-xs p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sf-text font-mono focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-sf-text mb-1">
                                    Run Notes
                                </label>
                                <textarea
                                    value={createForm.notes}
                                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                                    placeholder="Operational notes or calibration reference..."
                                    rows={2}
                                    className="w-full text-xs p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sf-text resize-none focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    data-testid="create-batch-btn"
                                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center gap-1.5 shadow transition-all"
                                >
                                    <PlusCircle size={15} />
                                    Create Batch Run
                                </button>
                            </div>
                        </form>
                    )}

                    {/* TAB 2: ALLOCATE SAMPLES */}
                    {activeTab === 'allocate' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-sf-text mb-1">
                                    Target Batch Run
                                </label>
                                {batches.length === 0 ? (
                                    <div className="p-4 rounded-xl bg-sf-canvas/50 text-center text-xs text-sf-muted">
                                        No active batches found for {analysisCode}. Switch to "Create Run" tab first.
                                    </div>
                                ) : (
                                    <select
                                        data-testid="allocate-batch-select"
                                        value={selectedBatchId}
                                        onChange={(e) => setSelectedBatchId(e.target.value)}
                                        className="w-full text-xs p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sf-text font-mono focus:ring-1 focus:ring-emerald-500"
                                    >
                                        {batches.map(b => (
                                            <option key={b.id} value={b.id}>
                                                {b.id} · {b.profile || 'RACK_40'} · Status: {b.status} · {b.workItems?.length || 0} samples
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {currentBatch && (
                                <div className="p-4 rounded-xl border border-sf-divider bg-sf-canvas/50 space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-sf-muted">Profile Architecture:</span>
                                        <span className="font-bold text-sf-text">{currentBatch.profile || 'RACK_40'} (Max {currentBatch.maxCapacity || 40})</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-sf-muted">Allocated Samples:</span>
                                        <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">
                                            {currentBatch.workItems?.length || 0} sample(s)
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-sf-muted">Physical Reserved QC Positions:</span>
                                        <span className="font-semibold text-sf-muted text-[11px]">
                                            #1 (BLANK), #2 (CONTROL), #20 (DUPLICATE), #40 (DUPLICATE)
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-sf-muted">Maximum Sample Capacity:</span>
                                        <span className="font-bold text-sf-text">
                                            {(currentBatch.maxCapacity || 40) - 4} samples
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div>
                                    <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                                        {selectedWorkItemIds.length} sample(s) selected in worksheet
                                    </div>
                                    <div className="text-[11px] text-sf-muted mt-0.5">
                                        Rack slots will be assigned sequentially respecting reserved QC positions.
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAllocate}
                                    disabled={loading || selectedWorkItemIds.length === 0 || !selectedBatchId}
                                    data-testid="allocate-batch-btn"
                                    className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white flex items-center gap-1.5 shadow transition-all shrink-0"
                                >
                                    <Layers size={14} />
                                    Allocate to Batch
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: QC MEASUREMENTS & STATE */}
                    {activeTab === 'qc' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-sf-text mb-1">
                                    Target Batch
                                </label>
                                <select
                                    data-testid="qc-batch-select"
                                    value={selectedBatchId}
                                    onChange={(e) => setSelectedBatchId(e.target.value)}
                                    className="w-full text-xs p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sf-text font-mono focus:ring-1 focus:ring-emerald-500"
                                >
                                    {batches.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.id} · Status: {b.status}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {currentBatch && (
                                <div className="flex items-center justify-between p-3 rounded-xl bg-sf-canvas/50 border border-sf-divider">
                                    <span className="text-xs text-sf-muted">Current QC Status:</span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        currentBatch.status === 'QC_PASS' ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300' :
                                        currentBatch.status === 'QC_FAIL' ? 'bg-red-500/15 text-red-800 dark:text-red-300' :
                                        currentBatch.status === 'CLOSED' ? 'bg-purple-500/15 text-purple-800 dark:text-purple-300' :
                                        'bg-sf-surface text-sf-muted'
                                    }`} data-testid="batch-qc-status-badge">
                                        {currentBatch.result === 'NOT_REQUIRED' || currentBatch.qcMode === 'OFF' ? t('qcRuns.notRequired') : currentBatch.status}
                                    </span>
                                </div>
                            )}
                            {savedEvaluation?.summary?.warnings?.length > 0 && <ul role="alert" className="text-xs text-amber-700 dark:text-amber-300" data-testid="qc-warnings">
                                {savedEvaluation.summary.warnings.map((warning, index) => <li key={index}>
                                    {t('qcRules.actions.WARN')} · {t(`qcRules.types.${warning.type}`)}
                                    {warning.required !== undefined && `: ${warning.found} / ${warning.required}`}
                                    {warning.criterion && ` · ${warning.criterion}`}
                                </li>)}
                            </ul>}

                            {native && <NativeRunPanel batch={currentBatch} referenceMaterials={referenceMaterials} loading={loading} setLoading={setLoading}
                                setError={setError} setSuccessMsg={setSuccessMsg} onChanged={async () => { await fetchBatches(); if (onBatchUpdated) onBatchUpdated(); }} />}
                            {!native && <div className="space-y-3 pt-2">
                                <h3 className="text-xs font-bold text-sf-text uppercase tracking-wider">
                                    {t('qcRules.measurements')}
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="p-3 rounded-xl border border-sf-divider bg-sf-surface">
                                        <label className="block text-[11px] font-bold text-sf-muted mb-1">
                                            {t('qcRules.types.BLANK')}
                                        </label>
                                        <input
                                            type="text"
                                            value={qcForm.blankVal}
                                            onChange={(e) => setQcForm({ ...qcForm, blankVal: e.target.value })}
                                            placeholder="0.00"
                                            className="w-full text-xs p-2 rounded-lg border border-sf-divider bg-sf-canvas text-sf-text font-mono focus:ring-1 focus:ring-emerald-500"
                                            data-testid="qc-blank-input"
                                        />
                                        <NumberPreview value={qcForm.blankVal} numberFormat={currentBatch?.numberFormat} />
                                    </div>

                                    <div className="p-3 rounded-xl border border-sf-divider bg-sf-surface">
                                        <label className="block text-[11px] font-bold text-sf-muted mb-1">
                                            {t('qcRules.types.CONTROL')}
                                        </label>
                                        <label className="grid gap-1 mb-2 text-xs">{t('referenceMaterials.controlMaterial')}
                                            <select data-testid="qc-reference-material" value={referenceLink.referenceMaterialId}
                                                onChange={e => setReferenceLink({ referenceMaterialId: e.target.value, referenceUse: '' })}
                                                className="p-2 rounded border border-sf-divider bg-sf-canvas text-sf-text">
                                                <option value="">{t('referenceMaterials.unlinked')}</option>
                                                {referenceMaterials.filter(row => ['CRM', 'LRM', 'CHECK_STANDARD'].includes(row.kind)).map(row => <option key={row.id} value={row.id}
                                                    disabled={!row.eligible && row.id !== savedControl?.referenceMaterialId}>
                                                    {row.code} · {row.lotNumber}{!row.eligible ? ` · ${t('referenceMaterials.ineligible')}` : ''}
                                                </option>)}
                                            </select>
                                        </label>
                                        {referenceLoadError && <p role="alert" className="text-xs text-red-600">{t('referenceMaterials.loadFailed')}</p>}
                                        {referenceLink.referenceMaterialId && <label className="grid gap-1 mb-2 text-xs">{t('referenceMaterials.referenceUse')}
                                            <select data-testid="qc-reference-use" value={referenceLink.referenceUse} onChange={e => setReferenceLink({ ...referenceLink, referenceUse: e.target.value })}
                                                className="p-2 rounded border border-sf-divider bg-sf-canvas text-sf-text">
                                                <option value="">{t('referenceMaterials.choose')}</option><option value="CRM">{t('referenceMaterials.kinds.CRM')}</option><option value="LRM">{t('referenceMaterials.kinds.LRM')}</option>
                                            </select><span className="text-sf-muted">{t('referenceMaterials.expectedFromCertificate')}</span>
                                        </label>}
                                        <div className="flex gap-1.5">
                                            <input
                                                type="text"
                                                value={qcForm.ctrlExpected}
                                                onChange={(e) => setQcForm({ ...qcForm, ctrlExpected: e.target.value })}
                                                placeholder="Exp"
                                                title="Expected"
                                                className="w-1/2 text-xs p-2 rounded-lg border border-sf-divider bg-sf-canvas text-sf-text font-mono focus:ring-1 focus:ring-emerald-500"
                                                data-testid="qc-ctrl-exp-input"
                                                disabled={!!referenceLink.referenceMaterialId}
                                            />
                                            <NumberPreview value={qcForm.ctrlExpected} numberFormat={currentBatch?.numberFormat} />
                                            <input
                                                type="text"
                                                value={qcForm.ctrlMeasured}
                                                onChange={(e) => setQcForm({ ...qcForm, ctrlMeasured: e.target.value })}
                                                placeholder="Meas"
                                                title="Measured"
                                                className="w-1/2 text-xs p-2 rounded-lg border border-sf-divider bg-sf-canvas text-sf-text font-mono focus:ring-1 focus:ring-emerald-500"
                                                data-testid="qc-ctrl-meas-input"
                                            />
                                            <NumberPreview value={qcForm.ctrlMeasured} numberFormat={currentBatch?.numberFormat} />
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-xl border border-sf-divider bg-sf-surface">
                                        <label className="block text-[11px] font-bold text-sf-muted mb-1">
                                            {t('qcRules.types.DUPLICATE')}
                                        </label>
                                        <div className="flex gap-1.5">
                                            <input
                                                type="text"
                                                value={qcForm.dupVal1}
                                                onChange={(e) => setQcForm({ ...qcForm, dupVal1: e.target.value })}
                                                placeholder="Val 1"
                                                className="w-1/2 text-xs p-2 rounded-lg border border-sf-divider bg-sf-canvas text-sf-text font-mono focus:ring-1 focus:ring-emerald-500"
                                                data-testid="qc-dup1-input"
                                            />
                                            <NumberPreview value={qcForm.dupVal1} numberFormat={currentBatch?.numberFormat} duplicateObservation />
                                            <input
                                                type="text"
                                                value={qcForm.dupVal2}
                                                onChange={(e) => setQcForm({ ...qcForm, dupVal2: e.target.value })}
                                                placeholder="Val 2"
                                                className="w-1/2 text-xs p-2 rounded-lg border border-sf-divider bg-sf-canvas text-sf-text font-mono focus:ring-1 focus:ring-emerald-500"
                                                data-testid="qc-dup2-input"
                                            />
                                            <NumberPreview value={qcForm.dupVal2} numberFormat={currentBatch?.numberFormat} duplicateObservation />
                                        </div>
                                        {parentSelector(qcForm.duplicateOfPositionId, duplicateOfPositionId => setQcForm({ ...qcForm, duplicateOfPositionId }), 'qc-duplicate-parent')}
                                    </div>
                                </div>
                                {hasRules && <div className="text-xs space-y-1" data-testid="qc-required-counts">
                                    {Object.entries(currentBatch.qcRequirements).map(([type, row]) => <p key={type}>
                                        {t(`qcRules.types.${type}`)}: {counts[type]} / {row.required} {t('qcRules.required')}
                                        {row.source === 'NOT_USED' && ` · ${t('qcRules.optional')}`}
                                    </p>)}
                                    <p>{t('qcRules.deferredHelp')}</p>
                                </div>}
                                {extraQc.map((row, index) => <fieldset key={row.id} className="p-3 border border-sf-divider rounded-xl space-y-2">
                                    <legend className="text-xs">{t(`qcRules.types.${row.type}`)} · {index + 2}</legend>
                                    {row.type === 'DUPLICATE' && parentSelector(row.duplicateOfPositionId,
                                        duplicateOfPositionId => updateExtra(row.id, { duplicateOfPositionId }), `qc-extra-DUPLICATE-${index}-parent`)}
                                    {row.type === 'CONTROL' && <>
                                        <label className="grid gap-1 text-xs">{t('referenceMaterials.controlMaterial')}
                                            <select value={row.referenceMaterialId} onChange={e => updateExtra(row.id, { referenceMaterialId: e.target.value, referenceUse: '' })}>
                                                <option value="">{t('referenceMaterials.unlinked')}</option>
                                                {referenceMaterials.filter(material => ['CRM', 'LRM', 'CHECK_STANDARD'].includes(material.kind)).map(material =>
                                                    <option key={material.id} value={material.id} disabled={!material.eligible}>{material.code} · {material.lotNumber}</option>)}
                                            </select>
                                        </label>
                                        {row.referenceMaterialId && <label className="grid gap-1 text-xs">{t('referenceMaterials.referenceUse')}
                                            <select value={row.referenceUse} onChange={e => updateExtra(row.id, { referenceUse: e.target.value })}>
                                                <option value="">{t('referenceMaterials.choose')}</option>{['CRM', 'LRM'].map(use => <option key={use} value={use}>{t(`referenceMaterials.kinds.${use}`)}</option>)}
                                            </select>
                                        </label>}
                                    </>}
                                    {(row.type === 'BLANK' ? ['value'] : row.type === 'DUPLICATE' ? ['value1', 'value2'] : row.referenceMaterialId ? ['measured'] : ['expected', 'measured']).map(field =>
                                        <label key={field} className="grid gap-1 text-xs">{t(`qcRules.fields.${field}`)}
                                            <input type="text" value={row[field]} data-testid={`qc-extra-${row.type}-${index}-${field}`}
                                                onChange={e => updateExtra(row.id, { [field]: e.target.value })} className="p-2 rounded border border-sf-divider bg-sf-canvas" />
                                            <NumberPreview value={row[field]} numberFormat={currentBatch?.numberFormat} duplicateObservation={row.type === 'DUPLICATE'} />
                                        </label>)}
                                    <button type="button" onClick={() => setExtraQc(rows => rows.filter(entry => entry.id !== row.id))}>{t('policies.remove')}</button>
                                </fieldset>)}
                                <div className="flex gap-2 flex-wrap">{['BLANK', 'DUPLICATE', 'CONTROL'].map(type => <button key={type} type="button" data-testid={`qc-add-${type}`}
                                    onClick={() => setExtraQc(rows => [...rows, { id: `${type}-${Date.now()}-${rows.length}`, type, value: '', value1: '', value2: '', expected: '', measured: '', referenceMaterialId: '', referenceUse: '' }])}
                                    className="px-3 py-2 border border-sf-divider rounded text-xs">{t('qcRules.add')} {t(`qcRules.types.${type}`)}</button>)}</div>
                            </div>}

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-sf-divider">
                                <button
                                    type="button"
                                    onClick={handleCloseBatch}
                                    disabled={loading}
                                    data-testid="close-batch-btn"
                                    className="px-4 py-2 rounded-xl text-xs font-bold border border-sf-divider text-sf-text hover:bg-sf-hover transition-colors"
                                >
                                    Close Batch
                                </button>

                                <button
                                    type="button"
                                    onClick={handleEvaluateQc}
                                    disabled={native || loading || !selectedBatchId || !qcFormComplete}
                                    data-testid="evaluate-qc-btn"
                                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center gap-1.5 shadow transition-all"
                                >
                                    <ShieldCheck size={15} />
                                    Evaluate QC Policy
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
