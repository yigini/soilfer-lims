import React, { useState, useRef, useEffect } from 'react';
import { 
    PackageCheck, Truck, FileText, AlertTriangle, CheckCircle, Plus, 
    Trash2, Edit3, Upload, ArrowLeft, Loader2, Layers, Check, RefreshCw,
    Scale, Droplet, Hash, Printer
} from 'lucide-react';
import axios from 'axios';
import BatchExceptionModal from './BatchExceptionModal';
import ComplianceChecklist from './ComplianceChecklist';
import IntakeContextFields from './IntakeContextFields';
import useIntakeRules, { intakeRulesErrorText } from './useIntakeRules';
import ManifestImportModal from './ManifestImportModal';
import LabelPrintDialog from '../common/LabelPrintDialog';
import { playSuccessChime, playErrorBuzz } from '../../utils/audioCues';
import { useLanguage } from '../../context/LanguageContext';

const BatchIntake = ({ 
    user, 
    availableProjects = [], 
    analysisGroups = [], 
    onBack, 
    onSuccess 
}) => {
    const { t } = useLanguage();
    // --- CONSIGNMENT HEADER STATE (RC-12) ---
    const [consignment, setConsignment] = useState({
        deliveryNoteRef: '',
        deliveredBy: '',
        deliveredAt: new Date().toISOString().slice(0, 16),
        declaredExpectedCount: '',
        notes: '',
        submitterName: '',
        submitterOrg: '',
        submitterPhone: '',
        submitterEmail: '',
        projectCode: availableProjects[0]?.code || ''
    });

    // --- BULK DEFAULTS (RC-13) ---
    const [defaults, setDefaults] = useState({
        receivedMass: '',
        moistureOnArrival: '',
        foreignMaterial: [],
        analysisBundle: analysisGroups[0]?.id || '',
        requiredAnalyses: analysisGroups[0]?.analyses || ['PH_H2O'],
        compositeRadiusM: '',
        samplingDetails: {},
        checklist: { items: {}, nonConformance: false, reason: '' }
    });

    const needsReceivingLab = user?.role === 'SUPER_ADMIN' && !user.labId && user.isActive !== false && user.status !== 'INACTIVE';
    const [selectedLab, setSelectedLab] = useState('');
    const [receivingLabs, setReceivingLabs] = useState([]);
    const [labsFailed, setLabsFailed] = useState(false);
    const receivingLabId = user?.labId || (needsReceivingLab ? selectedLab : undefined);
    const labRequired = needsReceivingLab && !receivingLabId;
    useEffect(() => {
        if (!needsReceivingLab) return;
        let current = true;
        axios.get('/api/labs/directory')
            .then(({ data }) => { if (current) setReceivingLabs(data.filter(lab => lab.isActive)); })
            .catch(() => { if (current) setLabsFailed(true); });
        return () => { current = false; };
    }, [needsReceivingLab]);

    const { rules: intakeRules, error: intakeRulesFailed } = useIntakeRules({ projectId: consignment.projectCode,
        isWalkIn: !consignment.projectCode, labId: receivingLabId, enabled: !labRequired });

    // --- SAMPLES LIST IN BATCH ---
    const [samples, setSamples] = useState([]);
    const [scanInput, setScanInput] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [bulkApplications, setBulkApplications] = useState([]);
    const [massRequirements, setMassRequirements] = useState({});
    const [massCheckFailed, setMassCheckFailed] = useState(false);
    const requirementKey = codes => JSON.stringify([...new Set(codes || [])].sort());
    const massKeys = JSON.stringify([...new Set(samples.filter(sample => sample.status !== 'REJECTED')
        .map(sample => requirementKey(sample.requiredAnalyses ?? defaults.requiredAnalyses)))]);

    useEffect(() => {
        let cancelled = false;
        if (labRequired) return;
        const keys = JSON.parse(massKeys);
        Promise.all(keys.map(async key => [key, (await axios.post('/api/reception/mass-check', {
            analysisCodes: JSON.parse(key), ...(needsReceivingLab && { assignedLab: receivingLabId })
        })).data]))
            .then(entries => { if (!cancelled) { setMassRequirements(Object.fromEntries(entries)); setMassCheckFailed(false); } })
            .catch(() => { if (!cancelled) setMassCheckFailed(true); });
        return () => { cancelled = true; };
    }, [massKeys, labRequired, needsReceivingLab, receivingLabId]);

    const hasMassDeficit = sample => sample.status !== 'REJECTED' && sample.receivedMass !== null && sample.receivedMass !== '' &&
        sample.receivedMass !== undefined && Number(sample.receivedMass) < massRequirements[requirementKey(sample.requiredAnalyses ?? defaults.requiredAnalyses)]?.totalRequiredMass;

    const handleApplyObservations = () => {
        const fields = {};
        if (defaults.receivedMass !== '') fields.receivedMass = Number(defaults.receivedMass);
        if (defaults.moistureOnArrival) fields.moistureOnArrival = defaults.moistureOnArrival;
        if (!samples.length || !Object.keys(fields).length) return;
        setSamples(previous => previous.map(sample => ({ ...sample, ...fields, massWarningAcknowledged: false })));
        setBulkApplications(previous => [...previous, { fields, sampleIds: samples.map(sample => sample.originalId) }]);
    };

    // --- MODALS ---
    const [editingSampleIdx, setEditingSampleIdx] = useState(null);
    const [isManifestModalOpen, setIsManifestModalOpen] = useState(false);
    const [submissionResult, setSubmissionResult] = useState(null);
    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);

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
        setSamples(previous => previous.map(sample => ({ ...sample, massWarningAcknowledged: false })));
    };

    // Fast Add / Scan Handler
    const handleAddSample = async (idToAdd) => {
        const cleanId = (idToAdd || scanInput).trim();
        if (!cleanId) return;

        // Duplicate check within batch
        if (samples.some(s => s.originalId.toLowerCase() === cleanId.toLowerCase())) {
            playErrorBuzz();
            alert(t('batchReception.alreadyScanned', { id: cleanId }));
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
                receivedMass: null,
                moistureOnArrival: null,
                massWarningAcknowledged: false,
                latitude: foundExpected?.coordinates?.lat ?? null,
                longitude: foundExpected?.coordinates?.lng ?? null,
                positionalUncertaintyM: foundExpected?.coordinates?.accuracy ?? null,
                sampleId: foundExpected?.id,
                siteName: foundExpected?.location || null,
                village: null,
                admin1: foundExpected?.country || null,
                intakePhotos: [],
                notes: ''
            };

            setSamples(prev => [newSample, ...prev]);
            setScanInput('');
            playSuccessChime();
        } finally {
            setIsScanning(false);
            scanInputRef.current?.focus();
        }
    };

    const handleRemoveSample = (index) => {
        const removedId = samples[index].originalId;
        setSamples(prev => prev.filter((_, i) => i !== index));
        setBulkApplications(previous => previous.map(action => ({ ...action, sampleIds: action.sampleIds.filter(id => id !== removedId) }))
            .filter(action => action.sampleIds.length));
    };

    const handleUpdateSample = (updatedSample) => {
        if (editingSampleIdx === null) return;
        setSamples(prev => {
            const copy = [...prev];
            copy[editingSampleIdx] = { ...updatedSample, massWarningAcknowledged:
                updatedSample.receivedMass === copy[editingSampleIdx].receivedMass && copy[editingSampleIdx].massWarningAcknowledged === true };
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
        if (labRequired) return;
        if (samples.length === 0) {
            alert(t('batchReception.noSamples'));
            return;
        }

        if (consignment.declaredExpectedCount.trim() && (!Number.isSafeInteger(Number(consignment.declaredExpectedCount)) || Number(consignment.declaredExpectedCount) < 1)) {
            alert(t('reception.expectedCountInvalid'));
            return;
        }
        setSubmitting(true);
        try {
            const payload = {
                ...(needsReceivingLab && { assignedLab: receivingLabId }),
                consignment: {
                    deliveryNoteRef: consignment.deliveryNoteRef.trim() || null,
                    deliveredBy: consignment.deliveredBy.trim() || null,
                    deliveredAt: consignment.deliveredAt || null,
                    ...(consignment.declaredExpectedCount.trim() ? { declaredExpectedCount: Number(consignment.declaredExpectedCount) } : {}),
                    notes: consignment.notes.trim() || null,
                    submitterName: consignment.submitterName.trim() || null,
                    submitterOrg: consignment.submitterOrg.trim() || null,
                    submitterPhone: consignment.submitterPhone.trim() || null,
                    submitterEmail: consignment.submitterEmail.trim() || null,
                    projectCode: consignment.projectCode || null
                },
                defaults: {
                    foreignMaterial: defaults.foreignMaterial,
                    requiredAnalyses: defaults.requiredAnalyses,
                    samplingDetails: defaults.samplingDetails,
                    compositeRadiusM: defaults.compositeRadiusM ? parseFloat(defaults.compositeRadiusM) : null,
                    checklist: defaults.checklist
                },
                samples,
                bulkApplications: bulkApplications.map(action => ({ ...action,
                    sampleIds: action.sampleIds.filter(id => samples.some(sample => sample.originalId === id))
                })).filter(action => action.sampleIds.length)
            };

            const res = await axios.post('/api/reception/consignments', payload);
            if (res.data.success) {
                playSuccessChime();
                setSubmissionResult(res.data);
                if (onSuccess) onSuccess(res.data);
            }
        } catch (err) {
            playErrorBuzz();
            console.error('Batch submission failed:', err);
            alert(t('batchIntake.submissionFailed', { message: err.response?.data?.message || err.response?.data?.error || err.message }));
        } finally {
            setSubmitting(false);
        }
    };

    const expectedNum = consignment.declaredExpectedCount.trim() ? Number(consignment.declaredExpectedCount) : null;
    const acceptedCount = samples.filter(s => s.status === 'ACCEPTED').length;
    const rejectedCount = samples.filter(s => s.status === 'REJECTED').length;

    // --- SUCCESS SCREEN ---
    if (submissionResult) {
        const csg = submissionResult.consignment;
        return (
            <div className="max-w-3xl mx-auto p-6 animate-in zoom-in-95 duration-300">
                <div className="bg-sf-surface rounded-3xl shadow-2xl border border-sf-divider overflow-hidden text-center p-8">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check size={36} />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-sf-text mb-1">
                        {t('batchReception.success')}
                    </h2>
                    <p className="text-sf-muted text-sm mb-6">
                        {t('batchReception.successDetail')}
                    </p>

                    {/* Receipt Badge */}
                    <div className="bg-sf-canvas p-4 rounded-2xl border border-sf-divider inline-block mb-6 text-left">
                        <div className="text-xs text-sf-muted font-bold uppercase tracking-wider">{t('batchReception.identifier')}</div>
                        <div className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400">{csg.code}</div>
                        <div className="text-xs text-sf-muted mt-1">
                            {t('batchReception.receiptDelivery', { waybill: csg.deliveryNoteRef || t('batchReception.none'), courier: csg.deliveredBy || t('batchReception.none') })}
                        </div>
                    </div>

                    <p className="text-sm text-sf-muted mb-4">{t('reception.declaredCount')}: {csg.declaredExpectedCount ?? t('reception.notDeclared')}</p>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-8">
                        <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100 dark:border-blue-900">
                            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{csg.sampleCount}</div>
                            <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">{t('batchReception.totalReceived')}</div>
                        </div>
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900">
                            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{csg.acceptedCount}</div>
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{t('status.ACCEPTED')}</div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-xl border border-red-100 dark:border-red-900">
                            <div className="text-2xl font-bold text-red-700 dark:text-red-300">{csg.rejectedCount}</div>
                            <div className="text-xs text-red-600 dark:text-red-400 font-medium">{t('status.REJECTED')}</div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="px-5 py-2.5 rounded-xl border border-sf-divider text-xs font-bold text-sf-text hover:bg-sf-canvas flex items-center gap-2"
                        >
                            <Printer size={16} /> {t('batchReception.printVoucher')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsLabelModalOpen(true)}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Printer size={16} /> {t('batchReception.printLabels', { count: csg.acceptedCount || samples.filter(s => s.status !== 'REJECTED').length })}
                        </button>
                        <button
                            type="button"
                            onClick={onBack}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                        >
                            {t('batchReception.completeReturn')}
                        </button>
                    </div>

                    {/* Batch Label Print Dialog (RC-17) */}
                    <LabelPrintDialog
                        isOpen={isLabelModalOpen}
                        onClose={() => setIsLabelModalOpen(false)}
                        samples={(submissionResult.samples || samples).map(s => ({
                            ...s,
                            assignedLab: s.assignedLab || user?.labId || null,
                            projectCode: s.projectCode || consignment.projectCode || null
                        }))}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
            {/* Top Navigation Bar */}
            <div className="flex justify-between items-center bg-sf-raised border border-sf-divider text-sf-text p-4 rounded-2xl shadow-md">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="bg-sf-surface hover:bg-sf-canvas border border-sf-divider p-2 rounded-xl transition-colors">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div className="text-xs text-sf-muted font-bold uppercase tracking-wider">{t('batchReception.intakeType')}</div>
                        <h2 className="text-lg font-bold">{t('batchReception.title')}</h2>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsManifestModalOpen(true)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                        <Upload size={14} /> {t('batchReception.importManifest')}
                    </button>
                </div>
            </div>

            {/* Consignment Delivery & Submitter Card */}
            <div className="bg-sf-surface rounded-2xl p-5 shadow-sm border border-sf-divider space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-sf-text border-b border-sf-divider pb-2">
                    <Truck size={18} className="text-blue-600" />
                    {t('batchReception.delivery')}
                </div>

                {needsReceivingLab && (
                    <div className="space-y-1 text-xs">
                        <label htmlFor="batch-receiving-lab" className="block font-bold text-sf-muted">{t('batchIntake.receivingLab')}</label>
                        <select id="batch-receiving-lab" required value={selectedLab} disabled={submitting}
                            onChange={event => {
                                setSelectedLab(event.target.value);
                                setMassRequirements({});
                                setMassCheckFailed(false);
                                setSamples(previous => previous.map(sample => ({ ...sample, massWarningAcknowledged: false })));
                            }}
                            className="w-full max-w-sm p-2 rounded-lg border border-sf-divider bg-sf-surface text-sf-text">
                            <option value="">{t('batchIntake.selectReceivingLab')}</option>
                            {receivingLabs.map(lab => <option key={lab.id} value={lab.id}>{lab.name} ({lab.code})</option>)}
                        </select>
                        {labsFailed && <p role="alert" className="text-amber-700">{t('batchIntake.receivingLabsFailed')}</p>}
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                    <div>
                        <label className="block font-bold text-sf-muted mb-1">
                            {t('batchReception.waybill')}
                        </label>
                        <input
                            type="text"
                            placeholder={t('batchReception.waybillExample')}
                            value={consignment.deliveryNoteRef}
                            onChange={(e) => setConsignment(prev => ({ ...prev, deliveryNoteRef: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-sf-text"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-sf-muted mb-1">
                            {t('batchReception.deliveredBy')}
                        </label>
                        <input
                            type="text"
                            placeholder={t('batchReception.deliveredBy')}
                            value={consignment.deliveredBy}
                            onChange={(e) => setConsignment(prev => ({ ...prev, deliveredBy: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-sf-text"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-sf-muted mb-1">
                            {t('batchReception.expectedBags')}
                        </label>
                        <input
                            type="number"
                            placeholder={t('reception.notDeclared')}
                            min="1"
                            step="1"
                            value={consignment.declaredExpectedCount}
                            onChange={(e) => setConsignment(prev => ({ ...prev, declaredExpectedCount: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-sf-text"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-sf-muted mb-1">
                            {t('batchReception.project')}
                        </label>
                        <select
                            value={consignment.projectCode}
                            onChange={(e) => setConsignment(prev => ({ ...prev, projectCode: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-sf-text"
                        >
                            <option value="">{t('batchReception.walkIn')}</option>
                            {availableProjects.map(p => (
                                <option key={p.id} value={p.code}>{p.name || p.code}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block font-bold text-sf-muted mb-1">
                            {t('batchReception.submitterName')}
                        </label>
                        <input
                            type="text"
                            placeholder={t('batchReception.submitterName')}
                            value={consignment.submitterName}
                            onChange={(e) => setConsignment(prev => ({ ...prev, submitterName: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-sf-text"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-sf-muted mb-1">
                            {t('batchReception.submitterOrg')}
                        </label>
                        <input
                            type="text"
                            placeholder={t('batchReception.submitterOrg')}
                            value={consignment.submitterOrg}
                            onChange={(e) => setConsignment(prev => ({ ...prev, submitterOrg: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-sf-text"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-sf-muted mb-1">
                            {t('batchReception.submitterPhone')}
                        </label>
                        <input
                            type="text"
                            placeholder="+502 ..."
                            value={consignment.submitterPhone}
                            onChange={(e) => setConsignment(prev => ({ ...prev, submitterPhone: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-sf-text"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-sf-muted mb-1">
                            {t('batchReception.submitterEmail')}
                        </label>
                        <input
                            type="email"
                            placeholder="email@domain.com"
                            value={consignment.submitterEmail}
                            onChange={(e) => setConsignment(prev => ({ ...prev, submitterEmail: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-sf-text"
                        />
                    </div>
                </div>
            </div>

            {/* Batch Defaults Strip */}
            <div className="bg-sf-canvas p-4 rounded-2xl border border-sf-divider flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2 text-sf-text font-bold">
                    <Layers size={16} className="text-blue-600" />
                    <span>{t('batchReception.defaults')}</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <span className="text-sf-muted">{t('batchReception.bundle')}</span>
                        <select
                            value={defaults.analysisBundle}
                            onChange={(e) => handleBundleChange(e.target.value)}
                            className="p-1.5 rounded-lg border border-sf-divider bg-sf-surface text-sf-text text-xs font-bold"
                        >
                            {analysisGroups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-sf-muted">{t('batchReception.standardMass')}</span>
                        <input
                            type="number"
                            min="0"
                            aria-label={t('batchIntake.massToApply')}
                            placeholder={t('batchIntake.notRecorded')}
                            value={defaults.receivedMass}
                            onChange={(e) => setDefaults(prev => ({ ...prev, receivedMass: e.target.value }))}
                            className="w-20 p-1.5 rounded-lg border border-sf-divider bg-sf-surface text-sf-text text-xs text-center font-bold"
                        />
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-sf-muted">{t('batchReception.moistureLabel')}</span>
                        <select
                            aria-label={t('batchIntake.moistureToApply')}
                            value={defaults.moistureOnArrival}
                            onChange={(e) => setDefaults(prev => ({ ...prev, moistureOnArrival: e.target.value }))}
                            className="p-1.5 rounded-lg border border-sf-divider bg-sf-surface text-sf-text text-xs"
                        >
                            <option value="">{t('batchIntake.notRecorded')}</option>
                            <option value="DRY">{t('batchReception.DRY')}</option>
                            <option value="MOIST">{t('batchReception.MOIST')}</option>
                            <option value="WET">{t('batchReception.WET')}</option>
                            <option value="SATURATED">{t('batchReception.SATURATED')}</option>
                        </select>
                    </div>


                </div>
            </div>

            <button type="button" onClick={handleApplyObservations}
                disabled={!samples.length || (defaults.receivedMass === '' && !defaults.moistureOnArrival)}
                className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50">
                {t('batchIntake.applyToAll')}
            </button>
            {massCheckFailed && <p className="text-amber-700 text-sm" role="alert">{t('batchIntake.massCheckFailed')}</p>}

            <section className="bg-sf-surface p-4 border rounded-xl space-y-4">
                <h3 className="font-semibold">{t('intakeRules.batchObservations')}</h3>
                <p>{t('intakeRules.batchHelp')}</p>
                {intakeRulesFailed && <p role="alert">{intakeRulesErrorText(intakeRulesFailed, t)}</p>}
                <ComplianceChecklist rules={intakeRules} value={defaults.checklist} onChange={checklist => setDefaults(previous => ({ ...previous, checklist }))} />
                <IntakeContextFields rules={intakeRules} sampling={defaults.samplingDetails} setSampling={update => setDefaults(previous => ({ ...previous,
                    samplingDetails: typeof update === 'function' ? update(previous.samplingDetails) : update }))} />
            </section>

            {/* Fast Rapid-Scan Intake Bar & Running Counter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Rapid Scan Input */}
                <div className="md:col-span-2 bg-sf-surface p-4 rounded-2xl shadow-sm border border-sf-divider flex items-center gap-3">
                    <input
                        ref={scanInputRef}
                        type="text"
                        placeholder={t('batchReception.scanPlaceholder')}
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddSample();
                            }
                        }}
                        className="flex-1 p-3 rounded-xl border border-sf-divider bg-sf-canvas font-mono text-sm font-bold text-sf-text focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                    <button
                        type="button"
                        onClick={() => handleAddSample()}
                        disabled={isScanning || !scanInput.trim()}
                        className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                        {isScanning ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        {t('samples.addSample')}
                    </button>
                </div>

                {/* Running Count Badge (RC-13) */}
                <div className="bg-sf-surface p-4 rounded-2xl shadow-sm border border-sf-divider flex items-center justify-between">
                    <div>
                        <div className="text-xs text-sf-muted font-bold uppercase tracking-wider">{t('batchReception.progress')}</div>
                        <div className="text-xl font-bold text-sf-text mt-0.5">
                            {samples.length} <span className="text-sm font-normal text-sf-muted">{expectedNum === null ? t('reception.notDeclared') : t('batchReception.expected', { count: expectedNum })}</span>
                        </div>
                        <div className="flex gap-2 text-[11px] mt-1 font-medium">
                            <span className="text-emerald-600 dark:text-emerald-400">{t('batchReception.acceptedCount', { count: acceptedCount })}</span>
                            {rejectedCount > 0 && (
                                <span className="text-red-600 dark:text-red-400 font-bold">• {t('batchReception.rejectedCount', { count: rejectedCount })}</span>
                            )}
                        </div>
                    </div>

                    {expectedNum !== null && Number.isInteger(expectedNum) && expectedNum > 0 && (
                        <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                            samples.length === expectedNum
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : samples.length < expectedNum
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                        }`}>
                            {samples.length === expectedNum ? t('batchReception.complete') : samples.length < expectedNum ? t('batchReception.missing', { count: expectedNum - samples.length }) : t('batchReception.extra', { count: samples.length - expectedNum })}
                        </div>
                    )}
                </div>
            </div>

            {/* High-Throughput Scanned Samples Table */}
            <div className="bg-sf-surface rounded-2xl shadow-sm border border-sf-divider overflow-hidden">
                <div className="p-4 border-b border-sf-divider flex justify-between items-center bg-sf-raised">
                    <h3 className="font-bold text-sm text-sf-text flex items-center gap-2">
                        <PackageCheck size={16} className="text-blue-600" />
                        {t('batchReception.scanned', { count: samples.length })}
                    </h3>

                    {samples.length > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                if (confirm(t('batchReception.clearConfirm'))) {
                                setSamples([]);
                                setBulkApplications([]);
                                }
                            }}
                            className="text-xs text-red-500 hover:text-red-700 font-bold"
                        >
                            {t('batchReception.clearAll')}
                        </button>
                    )}
                </div>

                <div className="max-h-[450px] overflow-y-auto">
                    {samples.length === 0 ? (
                        <div className="text-center py-16 text-sf-muted">
                            <PackageCheck size={40} className="mx-auto mb-2 opacity-30" />
                            <p className="font-medium text-sm">{t('batchReception.empty')}</p>
                            <p className="text-xs text-sf-muted mt-1">{t('batchReception.emptyHelp')}</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-sf-canvas text-sf-muted sticky top-0 font-bold">
                                <tr>
                                    <th className="p-3 w-12">#</th>
                                    <th className="p-3">{t('batchReception.sampleId')}</th>
                                    <th className="p-3">{t('adminSection.colStatus')}</th>
                                    <th className="p-3">{t('batchReception.mass')}</th>
                                    <th className="p-3">{t('batchReception.moisture')}</th>
                                    <th className="p-3">{t('batchReception.coordinates')}</th>
                                    <th className="p-3">{t('batchReception.exceptions')}</th>
                                    <th className="p-3 text-right">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sf-divider">
                                {samples.map((s, idx) => (
                                    <tr key={idx} className={`hover:bg-sf-canvas transition-colors ${s.status === 'REJECTED' ? 'bg-red-50/40 dark:bg-red-950/20' : ''}`}>
                                        <td className="p-3 text-sf-muted font-mono">{idx + 1}</td>
                                        <td className="p-3 font-mono font-bold text-sf-text">{s.originalId}</td>
                                        <td className="p-3">
                                            {s.status === 'REJECTED' ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 flex items-center gap-1 w-max">
                                                    <AlertTriangle size={10} /> {t('status.REJECTED')}
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1 w-max">
                                                    <CheckCircle size={10} /> {t('status.ACCEPTED')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-sf-text">
                                            {s.receivedMass !== null && s.receivedMass !== undefined && s.receivedMass !== '' ? <span className="font-mono">{s.receivedMass}g</span> :
                                                <span className="text-amber-700">{t('batchIntake.massNotRecorded')}</span>}
                                            {hasMassDeficit(s) && <div className="text-amber-700 mt-1" role="alert">
                                                <p>{t('batchIntake.massDeficit')} ({s.receivedMass}g / {massRequirements[requirementKey(s.requiredAnalyses ?? defaults.requiredAnalyses)].totalRequiredMass}g)</p>
                                                <label className="flex items-center gap-1 mt-1">
                                                    <input type="checkbox" checked={s.massWarningAcknowledged === true}
                                                        onChange={event => setSamples(previous => previous.map(row => row.originalId === s.originalId ?
                                                            { ...row, massWarningAcknowledged: event.target.checked } : row))} />
                                                    {t('batchIntake.acknowledgeMass')}
                                                </label>
                                            </div>}
                                        </td>
                                        <td className="p-3 capitalize text-sf-muted">{s.moistureOnArrival ? t('batchReception.' + s.moistureOnArrival, s.moistureOnArrival) : t('batchIntake.notRecorded')}</td>
                                        <td className="p-3 text-sf-muted">
                                            {s.latitude && s.longitude ? (
                                                <span className="font-mono">{s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}</span>
                                            ) : s.siteName ? (
                                                <span>{s.siteName}</span>
                                            ) : (
                                                <span className="text-sf-muted italic">{t('batchReception.none')}</span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            {s.status === 'REJECTED' ? (
                                                <div className="text-red-600 dark:text-red-400 font-medium text-[11px] truncate max-w-[200px]" title={s.rejectionReason}>
                                                    {s.rejectionReason || t('batchReception.nonConformance')}
                                                </div>
                                            ) : (
                                                <span className="text-sf-muted">—</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingSampleIdx(idx)}
                                                    className="p-1.5 rounded-lg hover:bg-sf-canvas text-sf-muted hover:text-sf-text transition-colors"
                                                    title={t('batchReception.editException')}
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSample(idx)}
                                                    className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 transition-colors"
                                                    title={t('batchReception.remove')}
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
                    <div className="p-4 bg-sf-canvas border-t border-sf-divider flex justify-between items-center">
                        <div className="text-xs text-sf-muted">
                            {t('batchReception.ready', { count: samples.length })}
                        </div>

                        <button
                            type="button"
                            onClick={handleSubmitBatch}
                            disabled={submitting || labRequired}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
                            {t('batchReception.submit', { count: samples.length })}
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
                    defaults={defaults}
                    projectId={consignment.projectCode}
                    labId={receivingLabId}
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
