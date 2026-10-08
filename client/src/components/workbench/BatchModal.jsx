import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { X, Layers, AlertTriangle, CheckCircle2, PlusCircle } from 'lucide-react';
import { useAnalysisNames } from '../../context/AnalysisCatalogueContext';
import { useLanguage } from '../../context/LanguageContext';
import QcRunHistory, { isNativeRun } from './QcRunHistory';
import { useAuth } from '../../context/AuthContext';


export default function BatchModal({
    isOpen,
    onClose,
    analysisCode = '',
    selectedWorkItemIds = [],
    selectedWorkItems = [],
    onBatchUpdated,
    onOpenWorksheet = null
}) {
    const getAnalysisDisplayName = useAnalysisNames();
    const { t } = useLanguage();
    const { hasPermission } = useAuth();
    const canEditQc = hasPermission?.('CHANGE_STATUS') === true;
    const qcError = (error, fallback) => {
        const code = error.response?.data?.code, message = error.response?.data?.error || error.message || fallback;
        return code ? t(`${code === 'QC_RUN_PROFILE_ONLY_STORED' || code === 'QC_WORK_ITEMS_REQUIRED' ? 'qcMembership' : code.startsWith('REFERENCE_') ? 'referenceMaterials' : 'qcRuns'}.errors.${code}`, message) : message;
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
        instrument: '',
        notes: ''
    });
    const [methods, setMethods] = useState([]);
    const [methodId, setMethodId] = useState('');
    const [methodsLoading, setMethodsLoading] = useState(false);
    const [methodsError, setMethodsError] = useState(false);
    const members = selectedWorkItemIds.map(id => selectedWorkItems.find(item => (item.workItemId || item.id) === id));
    const membershipKnown = members.every(Boolean);
    const recordedMethods = [...new Set(members.map(item => item?.methodologyId).filter(Boolean))];
    const recordedMethod = recordedMethods.length === 1 ? recordedMethods[0] : null;
    const needsMethod = !recordedMethod;
    const offeredMethods = methods.filter(method => method.analysisCode === analysisCode);
    const creationBlocked = !canEditQc || !selectedWorkItemIds.length || !membershipKnown || recordedMethods.length > 1 ||
        needsMethod && (methodsLoading || methodsError || !offeredMethods.some(method => method.id === methodId));

    const currentBatch = batches.find(b => b.id === selectedBatchId) || batches[0] || null;
    const native = isNativeRun(currentBatch);

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

    useEffect(() => {
        if (!isOpen) return;
        let current = true;
        setMethods([]); setMethodId(''); setMethodsError(false); setMethodsLoading(true);
        axios.get('/api/config/methodologies').then(response => {
            if (current) setMethods(Array.isArray(response.data) ? response.data : response.data.data || []);
        }).catch(() => { if (current) setMethodsError(true); })
            .finally(() => { if (current) setMethodsLoading(false); });
        return () => { current = false; };
    }, [isOpen, analysisCode]);

    if (!isOpen) return null;

    // Handle Create Batch
    const handleCreateBatch = async (e) => {
        e.preventDefault();
        if (loading || creationBlocked) return;
        setError(null);
        setSuccessMsg(null);
        try {
            setLoading(true);
            const payload = {
                analysis: analysisCode,
                workItemIds: selectedWorkItemIds,
                analyses: [{ analysisCode, ...((needsMethod || members.some(item => !item.methodologyId)) && { methodologyId: recordedMethod || methodId }) }],
                instrument: createForm.instrument,
                notes: createForm.notes
            };
            if (createForm.id.trim()) {
                payload.id = createForm.id.trim();
            }

            const res = await axios.post('/api/qc/batches', payload);
            const created = res.data;
            setSuccessMsg(t('qcMembership.created'));
            setCreateForm({ id: '', instrument: '', notes: '' });
            await fetchBatches();
            setSelectedBatchId(created.id);
            setActiveTab('qc');
            if (onBatchUpdated) onBatchUpdated();
            onOpenWorksheet?.(created.id);
        } catch (err) {
            setError(qcError(err, t('qcMembership.createFailed')));
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

    // Handle Close Batch Attempt
    const handleCloseBatch = async () => {
        if (!selectedBatchId || loading || !native || !canEditQc) return;
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
                                        {t('qcMembership.membership')}
                                    </label>
                                    <p data-testid="batch-membership-count">{selectedWorkItemIds.length} · {t('qcMembership.selectedWork')}</p>
                                    {!selectedWorkItemIds.length && <p data-testid="batch-membership-required">{t('qcMembership.selectWork')}</p>}
                                    {!membershipKnown && <p>{t('qcMembership.reloadWork')}</p>}
                                    {recordedMethods.length > 1 && <p data-testid="batch-method-conflict">{t('qcMembership.methodConflict')}</p>}
                                    {recordedMethod && <p data-testid="batch-recorded-method">{t('qcMembership.recordedMethod')} · {methods.find(method => method.id === recordedMethod)?.name || recordedMethod}</p>}
                                    {needsMethod && recordedMethods.length === 0 && <>
                                        <label htmlFor="batch-run-method">{t('qcMembership.method')}</label>
                                        <select id="batch-run-method" data-testid="batch-method-select" value={methodId}
                                            disabled={methodsLoading || methodsError || !offeredMethods.length}
                                            onChange={event => setMethodId(event.target.value)}
                                            className="w-full text-xs p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sf-text">
                                            <option value="">{t('qcMembership.chooseMethod')}</option>
                                            {offeredMethods.map(method => <option key={method.id} value={method.id}>{method.name}</option>)}
                                        </select>
                                        {methodsLoading && <p>{t('qcMembership.loadingMethods')}</p>}
                                        {methodsError && <p data-testid="batch-method-unavailable">{t('qcMembership.methodsUnavailable')}</p>}
                                        {!methodsLoading && !methodsError && !offeredMethods.length && <p data-testid="batch-method-none">{t('qcMembership.noMethods')}</p>}
                                    </>}
                                    <p className="text-[11px] text-sf-muted mt-1">
                                        {t('qcWorksheet.serverSequence')}
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
                                        placeholder={t('qcMembership.instrumentPlaceholder')}
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
                                    disabled={loading || creationBlocked}
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
                                                {b.id} · {b.runProfile?.name || b.profile || t('qcWorksheet.notStored')} · Status: {b.status} · {b.workItems?.length || 0} samples
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {currentBatch && (
                                <div className="p-4 rounded-xl border border-sf-divider bg-sf-canvas/50 space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-sf-muted">Profile Architecture:</span>
                                        <span className="font-bold text-sf-text">{currentBatch.runProfile?.name || currentBatch.profile || t('qcWorksheet.notStored')} (Max {currentBatch.maxCapacity ?? t('qcWorksheet.notStored')})</span>
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
                                            {currentBatch.positions?.filter(row => row.kind !== 'SAMPLE').map(row => `${row.position} (${row.kind})`).join(', ') || t('qcWorksheet.notStored')}
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
                            {currentBatch && <QcRunHistory batch={currentBatch} onOpenWorksheet={onOpenWorksheet}
                                loading={loading} setLoading={setLoading} setError={setError}
                                onChanged={async () => { await fetchBatches(); await onBatchUpdated?.(); }} />}

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-sf-divider">
                                <button
                                    type="button"
                                    onClick={handleCloseBatch}
                                    disabled={loading || !native || !canEditQc}
                                    data-testid="close-batch-btn"
                                    className="px-4 py-2 rounded-xl text-xs font-bold border border-sf-divider text-sf-text hover:bg-sf-hover transition-colors"
                                >
                                    Close Batch
                                </button>


                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
