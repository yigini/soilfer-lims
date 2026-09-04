import React, { useState, useRef, useEffect } from 'react';
import { 
    PackageCheck, Truck, FileText, AlertTriangle, CheckCircle, Plus, 
    Trash2, Edit3, Upload, ArrowLeft, Loader2, Layers, Check, RefreshCw,
    Scale, Droplet, Hash, Printer
} from 'lucide-react';
import axios from 'axios';
import BatchExceptionModal from './BatchExceptionModal';
import ManifestImportModal from './ManifestImportModal';

const BatchIntake = ({ 
    user, 
    availableProjects = [], 
    analysisGroups = [], 
    onBack, 
    onSuccess 
}) => {
    // --- CONSIGNMENT HEADER STATE (RC-12) ---
    const [consignment, setConsignment] = useState({
        deliveryNoteRef: '',
        deliveredBy: '',
        deliveredAt: new Date().toISOString().slice(0, 16),
        expectedCount: '',
        notes: '',
        submitterName: '',
        submitterOrg: '',
        submitterPhone: '',
        submitterEmail: '',
        projectCode: availableProjects[0]?.code || ''
    });

    // --- BULK DEFAULTS (RC-13) ---
    const [defaults, setDefaults] = useState({
        receivedMass: 500,
        moistureOnArrival: 'MOIST',
        foreignMaterial: [],
        analysisBundle: analysisGroups[0]?.id || '',
        requiredAnalyses: analysisGroups[0]?.analyses || ['PH_H2O'],
        compositeRadiusM: '',
        depthTopCm: 0,
        depthBottomCm: 20,
        checklist: {
            container: { status: 'PASS' },
            label: { status: 'PASS' },
            quantity: { status: 'PASS' },
            condition: { status: 'PASS' },
            coc: { status: 'PASS' }
        }
    });

    // --- SAMPLES LIST IN BATCH ---
    const [samples, setSamples] = useState([]);
    const [scanInput, setScanInput] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // --- MODALS ---
    const [editingSampleIdx, setEditingSampleIdx] = useState(null);
    const [isManifestModalOpen, setIsManifestModalOpen] = useState(false);
    const [submissionResult, setSubmissionResult] = useState(null);

    const scanInputRef = useRef(null);

    useEffect(() => {
        // Auto-focus the scan bar on mount
        scanInputRef.current?.focus();
    }, []);

    // Sync bundle selection to analyses
    const handleBundleChange = (groupId) => {
        const group = analysisGroups.find(g => g.id === groupId);
        setDefaults(prev => ({
            ...prev,
            analysisBundle: groupId,
            requiredAnalyses: group ? group.analyses : ['PH_H2O']
        }));
    };

    // Fast Add / Scan Handler
    const handleAddSample = async (idToAdd) => {
        const cleanId = (idToAdd || scanInput).trim();
        if (!cleanId) return;

        // Duplicate check within batch
        if (samples.some(s => s.originalId.toLowerCase() === cleanId.toLowerCase())) {
            alert(`Sample "${cleanId}" is already scanned in this consignment batch.`);
            setScanInput('');
            return;
        }

        setIsScanning(true);
        try {
            // Optional lookup against project expected samples
            let foundExpected = null;
            if (consignment.projectCode) {
                try {
                    const lookupRes = await axios.get('/api/samples/expected', {
                        params: { q: cleanId, projectId: consignment.projectCode, limit: 1 }
                    });
                    if (Array.isArray(lookupRes.data) && lookupRes.data.length > 0) {
                        const hit = lookupRes.data.find(h => h.originalId?.toLowerCase() === cleanId.toLowerCase());
                        if (hit) foundExpected = hit;
                    }
                } catch (e) {
                    // non-fatal lookup error
                }
            }

            const newSample = {
                originalId: cleanId,
                status: 'ACCEPTED',
                rejectionReason: null,
                receivedMass: defaults.receivedMass,
                moistureOnArrival: defaults.moistureOnArrival,
                latitude: foundExpected?.coordinates?.lat || null,
                longitude: foundExpected?.coordinates?.lng || null,
                positionalUncertaintyM: foundExpected?.coordinates?.accuracy || (foundExpected?.coordinates ? 10 : null),
                depthTopCm: defaults.depthTopCm,
                depthBottomCm: defaults.depthBottomCm,
                siteName: foundExpected?.location || null,
                village: null,
                admin1: foundExpected?.country || null,
                intakePhotos: [],
                notes: ''
            };

            setSamples(prev => [newSample, ...prev]);
            setScanInput('');
        } finally {
            setIsScanning(false);
            scanInputRef.current?.focus();
        }
    };

    const handleRemoveSample = (index) => {
        setSamples(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdateSample = (updatedSample) => {
        if (editingSampleIdx === null) return;
        setSamples(prev => {
            const copy = [...prev];
            copy[editingSampleIdx] = updatedSample;
            return copy;
        });
    };

    const handleImportFromManifest = (importedList) => {
        // Merge with deduplication
        setSamples(prev => {
            const existingIds = new Set(prev.map(s => s.originalId.toLowerCase()));
            const newToAdd = importedList.filter(s => !existingIds.has(s.originalId.toLowerCase()));
            return [...newToAdd, ...prev];
        });
    };

    // Atomic Consignment Submission (RC-12, RC-13, RC-14)
    const handleSubmitBatch = async () => {
        if (samples.length === 0) {
            alert('Please scan or import at least one sample.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                consignment: {
                    deliveryNoteRef: consignment.deliveryNoteRef.trim() || null,
                    deliveredBy: consignment.deliveredBy.trim() || null,
                    deliveredAt: consignment.deliveredAt || null,
                    expectedCount: parseInt(consignment.expectedCount) || samples.length,
                    notes: consignment.notes.trim() || null,
                    submitterName: consignment.submitterName.trim() || null,
                    submitterOrg: consignment.submitterOrg.trim() || null,
                    submitterPhone: consignment.submitterPhone.trim() || null,
                    submitterEmail: consignment.submitterEmail.trim() || null,
                    projectCode: consignment.projectCode || null
                },
                defaults: {
                    receivedMass: parseFloat(defaults.receivedMass) || 500,
                    moistureOnArrival: defaults.moistureOnArrival,
                    foreignMaterial: defaults.foreignMaterial,
                    requiredAnalyses: defaults.requiredAnalyses,
                    depthTopCm: defaults.depthTopCm,
                    depthBottomCm: defaults.depthBottomCm,
                    compositeRadiusM: defaults.compositeRadiusM ? parseFloat(defaults.compositeRadiusM) : null,
                    checklist: defaults.checklist
                },
                samples
            };

            const res = await axios.post('/api/reception/consignments', payload);
            if (res.data.success) {
                setSubmissionResult(res.data);
                if (onSuccess) onSuccess(res.data);
            }
        } catch (err) {
            console.error('Batch submission failed:', err);
            alert('Consignment submission failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    const expectedNum = parseInt(consignment.expectedCount) || 0;
    const acceptedCount = samples.filter(s => s.status === 'ACCEPTED').length;
    const rejectedCount = samples.filter(s => s.status === 'REJECTED').length;

    // --- SUCCESS SCREEN ---
    if (submissionResult) {
        const csg = submissionResult.consignment;
        return (
            <div className="max-w-3xl mx-auto p-6 animate-in zoom-in-95 duration-300">
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden text-center p-8">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check size={36} />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                        Consignment Received Successfully
                    </h2>
                    <p className="text-gray-500 text-sm mb-6">
                        All samples have been processed and registered into the laboratory database.
                    </p>

                    {/* Receipt Badge */}
                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 inline-block mb-6 text-left">
                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Consignment Identifier</div>
                        <div className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400">{csg.code}</div>
                        <div className="text-xs text-gray-500 mt-1">
                            Waybill: {csg.deliveryNoteRef || 'N/A'} • Courier: {csg.deliveredBy || 'N/A'}
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
                        <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100 dark:border-blue-900">
                            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{csg.sampleCount}</div>
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total Received</div>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900">
                            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{csg.acceptedCount}</div>
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Accepted</div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-100 dark:border-red-900">
                            <div className="text-2xl font-bold text-red-700 dark:text-red-300">{csg.rejectedCount}</div>
                            <div className="text-xs text-red-600 dark:text-red-400 font-medium">Rejected</div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-center gap-3">
                        <button
                            onClick={() => window.print()}
                            className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                            <Printer size={16} /> Print Consignment Voucher
                        </button>
                        <button
                            onClick={onBack}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                        >
                            Complete & Return
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
            {/* Top Navigation Bar */}
            <div className="flex justify-between items-center bg-slate-900 text-white p-4 rounded-2xl shadow-lg">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="bg-slate-800 hover:bg-slate-700 p-2 rounded-xl transition-colors">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Archetype B / C Intake</div>
                        <h2 className="text-lg font-bold">Consignment & High-Throughput Batch Reception</h2>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsManifestModalOpen(true)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                        <Upload size={14} /> Import Client Manifest (CSV/XLSX)
                    </button>
                </div>
            </div>

            {/* Consignment Delivery & Submitter Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 pb-2">
                    <Truck size={18} className="text-blue-600" />
                    Delivery & Consignment Information
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                    <div>
                        <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Delivery Note / Waybill Ref
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. WAYBILL-9921"
                            value={consignment.deliveryNoteRef}
                            onChange={(e) => setConsignment(prev => ({ ...prev, deliveryNoteRef: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Delivered By (Courier / Driver)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. DHL / Carlos Mendizabal"
                            value={consignment.deliveredBy}
                            onChange={(e) => setConsignment(prev => ({ ...prev, deliveredBy: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Expected Bag Count (on Manifest)
                        </label>
                        <input
                            type="number"
                            placeholder="e.g. 40"
                            value={consignment.expectedCount}
                            onChange={(e) => setConsignment(prev => ({ ...prev, expectedCount: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Project Affiliation
                        </label>
                        <select
                            value={consignment.projectCode}
                            onChange={(e) => setConsignment(prev => ({ ...prev, projectCode: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        >
                            <option value="">-- Generic / Walk-In Consignment --</option>
                            {availableProjects.map(p => (
                                <option key={p.id} value={p.code}>{p.name || p.code}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Submitter Contact Name
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Dr. Roberto Arbenz"
                            value={consignment.submitterName}
                            onChange={(e) => setConsignment(prev => ({ ...prev, submitterName: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Submitter Organization
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. ICTA / University"
                            value={consignment.submitterOrg}
                            onChange={(e) => setConsignment(prev => ({ ...prev, submitterOrg: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Submitter Phone
                        </label>
                        <input
                            type="text"
                            placeholder="+502 ..."
                            value={consignment.submitterPhone}
                            onChange={(e) => setConsignment(prev => ({ ...prev, submitterPhone: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Submitter Email
                        </label>
                        <input
                            type="email"
                            placeholder="email@domain.com"
                            value={consignment.submitterEmail}
                            onChange={(e) => setConsignment(prev => ({ ...prev, submitterEmail: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        />
                    </div>
                </div>
            </div>

            {/* Batch Defaults Strip */}
            <div className="bg-slate-50 dark:bg-gray-850 p-4 rounded-2xl border border-slate-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold">
                    <Layers size={16} className="text-blue-600" />
                    <span>Batch Defaults:</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <span className="text-gray-500">Bundle:</span>
                        <select
                            value={defaults.analysisBundle}
                            onChange={(e) => handleBundleChange(e.target.value)}
                            className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs font-bold"
                        >
                            {analysisGroups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-gray-500">Std Mass (g):</span>
                        <input
                            type="number"
                            value={defaults.receivedMass}
                            onChange={(e) => setDefaults(prev => ({ ...prev, receivedMass: e.target.value }))}
                            className="w-20 p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs text-center font-bold"
                        />
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-gray-500">Moisture:</span>
                        <select
                            value={defaults.moistureOnArrival}
                            onChange={(e) => setDefaults(prev => ({ ...prev, moistureOnArrival: e.target.value }))}
                            className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs"
                        >
                            <option value="DRY">Dry</option>
                            <option value="MOIST">Moist</option>
                            <option value="WET">Wet</option>
                            <option value="SATURATED">Saturated</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-gray-500">Depths:</span>
                        <input
                            type="number"
                            value={defaults.depthTopCm}
                            onChange={(e) => setDefaults(prev => ({ ...prev, depthTopCm: e.target.value }))}
                            className="w-14 p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs text-center"
                        />
                        <span>-</span>
                        <input
                            type="number"
                            value={defaults.depthBottomCm}
                            onChange={(e) => setDefaults(prev => ({ ...prev, depthBottomCm: e.target.value }))}
                            className="w-14 p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs text-center"
                        />
                        <span>cm</span>
                    </div>
                </div>
            </div>

            {/* Fast Rapid-Scan Intake Bar & Running Counter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Rapid Scan Input */}
                <div className="md:col-span-2 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-3">
                    <input
                        ref={scanInputRef}
                        type="text"
                        placeholder="Scan or type Sample Barcode / ID (Press Enter to add)..."
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddSample();
                            }
                        }}
                        className="flex-1 p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 font-mono text-sm font-bold text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <button
                        type="button"
                        onClick={() => handleAddSample()}
                        disabled={isScanning || !scanInput.trim()}
                        className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                        {isScanning ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        Add Sample
                    </button>
                </div>

                {/* Running Count Badge (RC-13) */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <div>
                        <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Consignment Progress</div>
                        <div className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                            {samples.length} <span className="text-sm font-normal text-gray-400">/ {expectedNum > 0 ? expectedNum : '—'} expected</span>
                        </div>
                        <div className="flex gap-2 text-[11px] mt-1 font-medium">
                            <span className="text-emerald-600 dark:text-emerald-400">{acceptedCount} Accepted</span>
                            {rejectedCount > 0 && (
                                <span className="text-red-600 dark:text-red-400 font-bold">• {rejectedCount} Rejected (Exception)</span>
                            )}
                        </div>
                    </div>

                    {expectedNum > 0 && (
                        <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                            samples.length === expectedNum
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : samples.length < expectedNum
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                        }`}>
                            {samples.length === expectedNum ? 'Complete' : samples.length < expectedNum ? `${expectedNum - samples.length} missing` : `+${samples.length - expectedNum} extra`}
                        </div>
                    )}
                </div>
            </div>

            {/* High-Throughput Scanned Samples Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50/70 dark:bg-gray-800">
                    <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <PackageCheck size={16} className="text-blue-600" />
                        Scanned Samples ({samples.length})
                    </h3>

                    {samples.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                if (confirm('Are you sure you want to clear all scanned samples in this batch?')) {
                                    setSamples([]);
                                }
                            }}
                            className="text-xs text-red-500 hover:text-red-700 font-bold"
                        >
                            Clear All
                        </button>
                    )}
                </div>

                <div className="max-h-[450px] overflow-y-auto">
                    {samples.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <PackageCheck size={40} className="mx-auto mb-2 opacity-30" />
                            <p className="font-medium text-sm">No samples added yet.</p>
                            <p className="text-xs text-gray-400 mt-1">Scan barcodes above or click "Import Client Manifest".</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 sticky top-0 font-bold">
                                <tr>
                                    <th className="p-3 w-12">#</th>
                                    <th className="p-3">Sample ID</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3">Mass</th>
                                    <th className="p-3">Moisture</th>
                                    <th className="p-3">Coordinates / Site</th>
                                    <th className="p-3">Exceptions / Evidence</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {samples.map((s, idx) => (
                                    <tr key={idx} className={`hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${s.status === 'REJECTED' ? 'bg-red-50/40 dark:bg-red-950/20' : ''}`}>
                                        <td className="p-3 text-gray-400 font-mono">{idx + 1}</td>
                                        <td className="p-3 font-mono font-bold text-gray-900 dark:text-gray-100">{s.originalId}</td>
                                        <td className="p-3">
                                            {s.status === 'REJECTED' ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 flex items-center gap-1 w-max">
                                                    <AlertTriangle size={10} /> REJECTED
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1 w-max">
                                                    <CheckCircle size={10} /> ACCEPTED
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 font-mono">{s.receivedMass ? `${s.receivedMass}g` : '—'}</td>
                                        <td className="p-3 capitalize text-gray-600 dark:text-gray-400">{s.moistureOnArrival?.toLowerCase() || 'moist'}</td>
                                        <td className="p-3 text-gray-600 dark:text-gray-400">
                                            {s.latitude && s.longitude ? (
                                                <span className="font-mono">{s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}</span>
                                            ) : s.siteName ? (
                                                <span>{s.siteName}</span>
                                            ) : (
                                                <span className="text-gray-400 italic">None</span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            {s.status === 'REJECTED' ? (
                                                <div className="text-red-600 dark:text-red-400 font-medium text-[11px] truncate max-w-[200px]" title={s.rejectionReason}>
                                                    {s.rejectionReason || 'Non-conformance'}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingSampleIdx(idx)}
                                                    className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                                                    title="Edit / Record Exception"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSample(idx)}
                                                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 transition-colors"
                                                    title="Remove"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Submit Bar */}
                {samples.length > 0 && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                            Ready to batch receive <strong className="text-gray-900 dark:text-gray-100">{samples.length} samples</strong> into Consignment.
                        </div>

                        <button
                            type="button"
                            onClick={handleSubmitBatch}
                            disabled={submitting}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
                            Submit Consignment ({samples.length} Samples)
                        </button>
                    </div>
                )}
            </div>

            {/* Exception Override Modal (RC-14) */}
            {editingSampleIdx !== null && (
                <BatchExceptionModal
                    isOpen={true}
                    sample={samples[editingSampleIdx]}
                    index={editingSampleIdx}
                    onClose={() => setEditingSampleIdx(null)}
                    onSave={handleUpdateSample}
                />
            )}

            {/* Manifest Import Modal (RC-15) */}
            <ManifestImportModal
                isOpen={isManifestModalOpen}
                onClose={() => setIsManifestModalOpen(false)}
                onImport={handleImportFromManifest}
            />
        </div>
    );
};

export default BatchIntake;
