import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { X, Layers, ShieldCheck, AlertTriangle, CheckCircle2, FlaskConical, PlusCircle } from 'lucide-react';
import { useAnalysisNames } from '../../context/AnalysisCatalogueContext';

export default function BatchModal({
    isOpen,
    onClose,
    analysisCode = '',
    selectedWorkItemIds = [],
    onBatchUpdated
}) {
    const getAnalysisDisplayName = useAnalysisNames();
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
    const [qcForm, setQcForm] = useState({
        blankVal: '0.02',
        ctrlExpected: '7.00',
        ctrlMeasured: '7.03',
        dupVal1: '6.85',
        dupVal2: '6.87'
    });

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

    const currentBatch = batches.find(b => b.id === selectedBatchId) || batches[0] || null;

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
            setError(err.response?.data?.error || err.message || 'Failed to create batch');
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
            const errMsg = err.response?.data?.error || err.message || 'Allocation failed';
            setError(`Boundary error (HTTP ${err.response?.status || 400}): ${errMsg}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle QC Evaluation
    const handleEvaluateQc = async () => {
        if (!selectedBatchId) return;
        setError(null);
        setSuccessMsg(null);
        try {
            setLoading(true);
            const blanks = qcForm.blankVal ? [{ value: parseFloat(qcForm.blankVal) }] : [];
            const controls = qcForm.ctrlExpected && qcForm.ctrlMeasured ? [{
                expected: parseFloat(qcForm.ctrlExpected),
                measured: parseFloat(qcForm.ctrlMeasured)
            }] : [];
            const duplicates = qcForm.dupVal1 && qcForm.dupVal2 ? [{
                value1: parseFloat(qcForm.dupVal1),
                value2: parseFloat(qcForm.dupVal2)
            }] : [];

            const res = await axios.put(`/api/qc/batches/${selectedBatchId}`, {
                blanks,
                controls,
                duplicates
            });

            setSuccessMsg(`QC evaluated: Status is now ${res.data.status}`);
            await fetchBatches();
            if (onBatchUpdated) onBatchUpdated();
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'QC evaluation failed');
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
            const errMsg = err.response?.data?.error || err.message;
            setError(`HTTP ${status}: ${errMsg || 'Only Managers can close batches'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                            <Layers size={20} />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                                Batch Run & QC Management
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Method: <span className="font-semibold text-slate-700 dark:text-slate-300">{getAnalysisDisplayName(analysisCode)}</span> · Physical Rack Allocation & QC Controls
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Close modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/30 dark:bg-slate-800/10">
                    {[
                        { id: 'create', label: 'Create Run / Batch' },
                        { id: 'allocate', label: `Allocate Samples (${selectedWorkItemIds.length} selected)` },
                        { id: 'qc', label: 'QC Measurements & State' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setError(null); setSuccessMsg(null); }}
                            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                                activeTab === tab.id
                                    ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Notifications */}
                {error && (
                    <div className="mx-6 mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                        <span className="font-medium">{error}</span>
                    </div>
                )}
                {successMsg && (
                    <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-200">
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
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Run Profile Architecture *
                                    </label>
                                    <select
                                        value={createForm.profile}
                                        onChange={(e) => setCreateForm({ ...createForm, profile: e.target.value })}
                                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500"
                                    >
                                        <option value="RACK_40">RACK_40 (40 Places: 36 Samples max, 4 QC slots)</option>
                                        <option value="MICROPLATE_96">MICROPLATE_96 (96 Wells: 92 Samples max, 4 QC slots)</option>
                                        <option value="CENTRIFUGE_24">CENTRIFUGE_24 (24 Tubes: 21 Samples max, 3 QC slots)</option>
                                    </select>
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Strict capacity enforcement: QC slots 1, 2, 20, 40 reserved.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Instrument Asset
                                    </label>
                                    <input
                                        type="text"
                                        value={createForm.instrument}
                                        onChange={(e) => setCreateForm({ ...createForm, instrument: e.target.value })}
                                        placeholder="e.g. Metrohm 914 pH/Conductometer"
                                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Custom Batch ID (Optional)
                                </label>
                                <input
                                    type="text"
                                    data-testid="batch-id-input"
                                    value={createForm.id}
                                    onChange={(e) => setCreateForm({ ...createForm, id: e.target.value })}
                                    placeholder="Leave blank for auto-generated BATCH-TIMESTAMP"
                                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Run Notes
                                </label>
                                <textarea
                                    value={createForm.notes}
                                    onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                                    placeholder="Operational notes or calibration reference..."
                                    rows={2}
                                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 resize-none"
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
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Target Batch Run
                                </label>
                                {batches.length === 0 ? (
                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-500">
                                        No active batches found for {analysisCode}. Switch to "Create Run" tab first.
                                    </div>
                                ) : (
                                    <select
                                        data-testid="allocate-batch-select"
                                        value={selectedBatchId}
                                        onChange={(e) => setSelectedBatchId(e.target.value)}
                                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
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
                                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Profile Architecture:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{currentBatch.profile || 'RACK_40'} (Max {currentBatch.maxCapacity || 40})</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Allocated Samples:</span>
                                        <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">
                                            {currentBatch.workItems?.length || 0} sample(s)
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Physical Reserved QC Positions:</span>
                                        <span className="font-semibold text-slate-600 dark:text-slate-400 text-[11px]">
                                            #1 (BLANK), #2 (CONTROL), #20 (DUPLICATE), #40 (DUPLICATE)
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Maximum Sample Capacity:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            {(currentBatch.maxCapacity || 40) - 4} samples
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div>
                                    <div className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                                        {selectedWorkItemIds.length} sample(s) selected in worksheet
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
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
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                    Target Batch
                                </label>
                                <select
                                    data-testid="qc-batch-select"
                                    value={selectedBatchId}
                                    onChange={(e) => setSelectedBatchId(e.target.value)}
                                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                                >
                                    {batches.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.id} · Status: {b.status}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {currentBatch && (
                                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                                    <span className="text-xs text-slate-500">Current QC Status:</span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                        currentBatch.status === 'QC_PASS' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                                        currentBatch.status === 'QC_FAIL' ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300' :
                                        currentBatch.status === 'CLOSED' ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' :
                                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                    }`} data-testid="batch-qc-status-badge">
                                        {currentBatch.status}
                                    </span>
                                </div>
                            )}

                            <div className="space-y-3 pt-2">
                                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                                    Required QC Slot Determinations
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40">
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                            Reagent Blank (Slot #1)
                                        </label>
                                        <input
                                            type="text"
                                            value={qcForm.blankVal}
                                            onChange={(e) => setQcForm({ ...qcForm, blankVal: e.target.value })}
                                            placeholder="0.00"
                                            className="w-full text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 font-mono"
                                            data-testid="qc-blank-input"
                                        />
                                    </div>

                                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40">
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                            CRM Control (Slot #2)
                                        </label>
                                        <div className="flex gap-1.5">
                                            <input
                                                type="text"
                                                value={qcForm.ctrlExpected}
                                                onChange={(e) => setQcForm({ ...qcForm, ctrlExpected: e.target.value })}
                                                placeholder="Exp"
                                                title="Expected"
                                                className="w-1/2 text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 font-mono"
                                                data-testid="qc-ctrl-exp-input"
                                            />
                                            <input
                                                type="text"
                                                value={qcForm.ctrlMeasured}
                                                onChange={(e) => setQcForm({ ...qcForm, ctrlMeasured: e.target.value })}
                                                placeholder="Meas"
                                                title="Measured"
                                                className="w-1/2 text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 font-mono"
                                                data-testid="qc-ctrl-meas-input"
                                            />
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40">
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                            Duplicate Pair (Slot #20)
                                        </label>
                                        <div className="flex gap-1.5">
                                            <input
                                                type="text"
                                                value={qcForm.dupVal1}
                                                onChange={(e) => setQcForm({ ...qcForm, dupVal1: e.target.value })}
                                                placeholder="Val 1"
                                                className="w-1/2 text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 font-mono"
                                                data-testid="qc-dup1-input"
                                            />
                                            <input
                                                type="text"
                                                value={qcForm.dupVal2}
                                                onChange={(e) => setQcForm({ ...qcForm, dupVal2: e.target.value })}
                                                placeholder="Val 2"
                                                className="w-1/2 text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-600 font-mono"
                                                data-testid="qc-dup2-input"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={handleCloseBatch}
                                    disabled={loading}
                                    data-testid="close-batch-btn"
                                    className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Close Batch
                                </button>

                                <button
                                    type="button"
                                    onClick={handleEvaluateQc}
                                    disabled={loading}
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
