import React, { useState, useRef, useEffect } from 'react';
import {
    PackageCheck, Truck, FileText, AlertTriangle, CheckCircle, Plus,
    Trash2, Edit3, Upload, ArrowLeft, Loader2, Layers, Check, RefreshCw,
    Scale, Droplet, Hash, Printer
} from 'lucide-react';
import axios from 'axios';
import {useLanguage} from '../../context/LanguageContext';
import {formCriteria,pinFor,draftScope} from './intakeForm';
import BatchExceptionModal from './BatchExceptionModal';
import ManifestImportModal from './ManifestImportModal';
import LabelPrintDialog from '../common/LabelPrintDialog';
import { playSuccessChime, playErrorBuzz } from '../../utils/audioCues';

const BatchIntake = ({
    user,
    availableProjects = [],
    analysisGroups = [],
    onBack,
    onSuccess
}) => {
    const {t}=useLanguage();
    const [selectedRows,setSelectedRows]=useState(new Set());
    const [bulkConfirmed,setBulkConfirmed]=useState(false);
    const commandRef=useRef(null);
    const draftKey='limsi_consignment_v2:'+JSON.stringify([String(user?.id),user?.labId]);
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
        receivedMass:'',moistureOnArrival:'',foreignMaterial:[],analysisBundle:'',requiredAnalyses:[],compositeRadiusM:'',depthTopCm:'',depthBottomCm:''
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
            requiredAnalyses: group ? (typeof group.analyses === 'string' ? JSON.parse(group.analyses) : group.analyses) : []
        }));
    };

    useEffect(()=>{
        try {const stored=JSON.parse(localStorage.getItem(draftKey));if(stored?.ownerId===String(user?.id)&&stored.labId===user?.labId&&window.confirm(t('intakeRules.restoreHint'))) {setConsignment(stored.consignment);setDefaults(stored.defaults);setSamples(stored.samples);setBulkConfirmed(stored.bulkConfirmed || false);}} catch {}
    },[draftKey]);
    useEffect(()=>{if(!samples.length || submissionResult) return;try {localStorage.setItem(draftKey,JSON.stringify({ownerId:String(user?.id),labId:user?.labId,consignment,defaults,samples,bulkConfirmed,savedAt:Date.now()}));}catch{}},[consignment,defaults,samples,bulkConfirmed,submissionResult]);
    const resolveRow=async row=>{
        const key='limsi_intake_form:'+draftScope(user,{projectId:consignment.projectCode || null,origin:'PROJECT_SAMPLE',matrix:row.matrix||'SOIL'},row.originalId,null);
        let data;
        try {
            try {data=(await axios.get('/api/reception/sample-context',{params:{originalId:row.originalId}})).data;}
            catch(err) {if(err.response?.status!==404) throw err;data=(await axios.get('/api/reception/sample-context',{params:{projectId:consignment.projectCode || undefined,origin:consignment.projectCode ? 'PROJECT_SAMPLE' : 'DESK_WALKIN',matrix:row.matrix||'SOIL'}})).data;}
            try {localStorage.setItem(key,JSON.stringify({ownerId:String(user.id),labId:user.labId,data}));}catch{}
        } catch(err) {if(err.response) throw err;const cached=JSON.parse(localStorage.getItem(key)||'null');if(cached?.ownerId!==String(user.id)||cached.labId!==user.labId) throw err;data=cached.data;}
        const specimen=data.sample || {},rd=typeof specimen.receptionData === 'string' ? JSON.parse(specimen.receptionData) : specimen.receptionData || {};
        return {...row,sampleId:specimen.id,expectedUpdatedAt:specimen.updatedAt,projectId:specimen.projectId || data.intakeTemplate.context.projectId,
            isWalkIn:data.intakeTemplate.context.origin==='DESK_WALKIN',matrix:data.intakeTemplate.context.matrix,
            receivedMass:row.receivedMass ?? specimen.receivedMass ?? undefined,moistureOnArrival:row.moistureOnArrival ?? specimen.moistureOnArrival ?? undefined,
            foreignMaterial:row.foreignMaterial ?? (typeof specimen.foreignMaterial === 'string' ? JSON.parse(specimen.foreignMaterial) : specimen.foreignMaterial) ?? undefined,
            requiredAnalyses:row.requiredAnalyses ?? (typeof specimen.requiredAnalyses === 'string' ? JSON.parse(specimen.requiredAnalyses) : specimen.requiredAnalyses) ?? undefined,
            analysisGroupIds:row.analysisGroupIds ?? (typeof specimen.analysisGroupIds === 'string' ? JSON.parse(specimen.analysisGroupIds) : specimen.analysisGroupIds) ?? undefined,
            latitude:row.latitude ?? specimen.latitude ?? specimen.coordinates?.lat ?? undefined,longitude:row.longitude ?? specimen.longitude ?? specimen.coordinates?.lng ?? undefined,
            positionalUncertaintyM:row.positionalUncertaintyM ?? specimen.positionalUncertaintyM ?? undefined,
            depthTopCm:row.depthTopCm ?? specimen.depthTopCm ?? undefined,depthBottomCm:row.depthBottomCm ?? specimen.depthBottomCm ?? undefined,
            intakePhotos:row.intakePhotos || (specimen.intakePhotos ? typeof specimen.intakePhotos==='string' ? JSON.parse(specimen.intakePhotos) : specimen.intakePhotos : []),
            checklist:row.checklist || rd.intakeTemplate?.checklist || rd.checklist || {items:{}},contextAnswers:row.contextAnswers || rd.intakeTemplate?.contextAnswers || {},
            intakeTemplate:pinFor(data.intakeTemplate),_form:data.intakeTemplate};
    };
    const confirmObserved=()=>{
        if(!selectedRows.size || !window.confirm(t('intakeRules.bulkHint'))) return;
        setSamples(prev=>prev.map(row=>{
            if(!selectedRows.has(row.originalId) || row.status==='REJECTED') return row;
            const items={...row.checklist?.items};
            for(const rule of formCriteria(row._form)) if(rule.allowed.includes('PASS') && !['FAIL','NA'].includes(items[rule.id]?.status)) items[rule.id]={...items[rule.id],status:'PASS'};
            return {...row,checklist:{...row.checklist,items},bulkAttestation:{confirmed:true,criterionIds:formCriteria(row._form).map(rule=>rule.id)}};
        }));setBulkConfirmed(true);
    };

    // Fast Add / Scan Handler
    const handleAddSample = async (idToAdd) => {
        const cleanId = (idToAdd || scanInput).trim();
        if (!cleanId) return;

        // Duplicate check within batch
        if (samples.some(s => s.originalId.toLowerCase() === cleanId.toLowerCase())) {
            playErrorBuzz();
            alert(`Sample "${cleanId}" is already scanned in this consignment batch.`);
            setScanInput('');
            return;
        }

        setIsScanning(true);
        try {
            const newSample=await resolveRow({originalId:cleanId,status:'ACCEPTED',rejectionReason:null,notes:''});

            setSamples(prev => [newSample, ...prev]);
            setScanInput('');
            playSuccessChime();
        } catch(err) {playErrorBuzz();alert((err.response?.data?.code || t('intakeRules.loadFailed'))+' · '+t('intakeRules.inputKept'));} finally {
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

    const handleImportFromManifest=async importedList=>{
        setIsScanning(true);
        try {
            const existing=new Set(samples.map(row=>row.originalId.toLowerCase()));
            const resolved=[];
            for(const row of importedList.filter(row=>!existing.has(row.originalId.toLowerCase()))) resolved.push(await resolveRow(row));
            setSamples(prev=>[...resolved,...prev]);
        } catch(err) {alert((err.response?.data?.code || t('intakeRules.loadFailed'))+' · '+t('intakeRules.inputKept'));}
        finally {setIsScanning(false);}
    };

    // Atomic Consignment Submission (RC-12, RC-13, RC-14)
    const handleSubmitBatch = async () => {
        if (samples.length === 0) {
            alert('Please scan or import at least one sample.');
            return;
        }

        if(!navigator.onLine) {alert(t('intakeRules.batchLocal'));return;}
        if(samples.some(row=>!row._form)) {alert(t('intakeRules.resolveBeforeAccept'));return;}
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
                    receivedMass: defaults.receivedMass === '' ? undefined : defaults.receivedMass,
                    moistureOnArrival: defaults.moistureOnArrival || undefined,
                    foreignMaterial: defaults.foreignMaterial.length ? defaults.foreignMaterial : undefined,
                    requiredAnalyses: defaults.analysisBundle ? defaults.requiredAnalyses : undefined,
                    depthTopCm: defaults.depthTopCm === '' ? undefined : defaults.depthTopCm,
                    depthBottomCm: defaults.depthBottomCm === '' ? undefined : defaults.depthBottomCm,
                    compositeRadiusM: defaults.compositeRadiusM === '' ? undefined : defaults.compositeRadiusM
                },
                bulkAttestation:bulkConfirmed ? {confirmed:true} : undefined,
                samples:samples.map(({_form,...row})=>defaults.analysisBundle ? {...row,requiredAnalyses:[...new Set([...(row.requiredAnalyses || []),...defaults.requiredAnalyses])],analysisGroupIds:[...new Set([...(row.analysisGroupIds || []),defaults.analysisBundle])]} : row)
            };

            const semantic=JSON.stringify(payload);if(!commandRef.current || commandRef.current.semantic!==semantic) commandRef.current={semantic,id:crypto.randomUUID()};
            payload.operationId=commandRef.current.id;
            const res = await axios.post('/api/reception/consignments', payload);
            if (res.data.success) {
                playSuccessChime();
                setSubmissionResult(res.data);localStorage.removeItem(draftKey);
                if (onSuccess) onSuccess(res.data);
            }
        } catch (err) {
            playErrorBuzz();
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
                <div className="bg-sf-surface rounded-3xl shadow-2xl border border-sf-divider overflow-hidden text-center p-8">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check size={36} />
                    </div>

                    <h2 className="text-2xl font-bold text-sf-text mb-1">
                        Consignment Received Successfully
                    </h2>
                    <p className="text-sf-muted text-sm mb-6">
                        All samples have been processed and registered into the laboratory database.
                    </p>

                    {/* Receipt Badge */}
                    <div className="bg-sf-canvas p-4 rounded-2xl border border-sf-divider inline-block mb-6 text-left">
                        <div className="text-xs text-sf-muted font-bold uppercase tracking-wider">Consignment Identifier</div>
                        <div className="text-2xl font-mono font-bold text-blue-600 dark:text-blue-400">{csg.code}</div>
                        <div className="text-xs text-sf-muted mt-1">
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
                    <div className="flex flex-wrap justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="px-5 py-2.5 rounded-xl border border-sf-divider text-xs font-bold text-sf-text hover:bg-sf-canvas flex items-center gap-2"
                        >
                            <Printer size={16} /> Print Consignment Voucher
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsLabelModalOpen(true)}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md flex items-center gap-2 transition-all active:scale-95"
                        >
                            <Printer size={16} /> Print Sample Labels ({csg.acceptedCount || samples.filter(s => s.status !== 'REJECTED').length})
                        </button>
                        <button
                            type="button"
                            onClick={onBack}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                        >
                            Complete & Return
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
                        <div className="text-xs text-sf-muted font-bold uppercase tracking-wider">Archetype B / C Intake</div>
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
            <div className="bg-sf-surface rounded-2xl p-5 shadow-sm border border-sf-divider space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-sf-text border-b border-sf-divider pb-2">
                    <Truck size={18} className="text-blue-600" />
                    Delivery & Consignment Information
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                    <div>
                        <label className="block font-bold text-sf-muted mb-1">
                            Delivery Note / Waybill Ref
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. WAYBILL-9921"
                            value={consignment.deliveryNoteRef}
                            onChange={(e) => setConsignment(prev => ({ ...prev, deliveryNoteRef: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-sf-text"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-sf-muted mb-1">
                            Delivered By (Courier / Driver)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. DHL / Carlos Mendizabal"
                            value={consignment.deliveredBy}
                            onChange={(e) => setConsignment(prev => ({ ...prev, deliveredBy: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-sf-text"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-sf-muted mb-1">
                            Expected Bag Count (on Manifest)
                        </label>
                        <input
                            type="number"
                            placeholder="e.g. 40"
                            value={consignment.expectedCount}
                            onChange={(e) => setConsignment(prev => ({ ...prev, expectedCount: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-sf-text"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-sf-muted mb-1">
                            Project Affiliation
                        </label>
                        <select
                            value={consignment.projectCode}
                            onChange={(e) => setConsignment(prev => ({ ...prev, projectCode: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-sf-text"
                        >
                            <option value="">-- Generic / Walk-In Consignment --</option>
                            {availableProjects.map(p => (
                                <option key={p.id} value={p.code}>{p.name || p.code}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block font-bold text-sf-muted mb-1">
                            Submitter Contact Name
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Dr. Roberto Arbenz"
                            value={consignment.submitterName}
                            onChange={(e) => setConsignment(prev => ({ ...prev, submitterName: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-sf-text"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-sf-muted mb-1">
                            Submitter Organization
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. ICTA / University"
                            value={consignment.submitterOrg}
                            onChange={(e) => setConsignment(prev => ({ ...prev, submitterOrg: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-sf-text"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-sf-muted mb-1">
                            Submitter Phone
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
                            Submitter Email
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
                    <span>Batch Defaults:</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <span className="text-sf-muted">Bundle:</span>
                        <select
                            value={defaults.analysisBundle}
                            onChange={(e) => handleBundleChange(e.target.value)}
                            className="p-1.5 rounded-lg border border-sf-divider bg-sf-surface text-sf-text text-xs font-bold"
                        >
                            <option value="">{t('intakeRules.choose')}</option>{analysisGroups.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-sf-muted">Std Mass (g):</span>
                        <input
                            type="number"
                            value={defaults.receivedMass}
                            onChange={(e) => setDefaults(prev => ({ ...prev, receivedMass: e.target.value }))}
                            className="w-20 p-1.5 rounded-lg border border-sf-divider bg-sf-surface text-sf-text text-xs text-center font-bold"
                        />
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-sf-muted">Moisture:</span>
                        <select
                            value={defaults.moistureOnArrival}
                            onChange={(e) => setDefaults(prev => ({ ...prev, moistureOnArrival: e.target.value }))}
                            className="p-1.5 rounded-lg border border-sf-divider bg-sf-surface text-sf-text text-xs"
                        >
                            <option value="">{t('intakeRules.unrecorded')}</option><option value="DRY">{t('intakeRules.moisture.DRY')}</option>
                            <option value="MOIST">Moist</option>
                            <option value="WET">Wet</option>

                        </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-sf-muted">Depths:</span>
                        <input
                            type="number"
                            value={defaults.depthTopCm}
                            onChange={(e) => setDefaults(prev => ({ ...prev, depthTopCm: e.target.value }))}
                            className="w-14 p-1.5 rounded-lg border border-sf-divider bg-sf-surface text-sf-text text-xs text-center"
                        />
                        <span>-</span>
                        <input
                            type="number"
                            value={defaults.depthBottomCm}
                            onChange={(e) => setDefaults(prev => ({ ...prev, depthBottomCm: e.target.value }))}
                            className="w-14 p-1.5 rounded-lg border border-sf-divider bg-sf-surface text-sf-text text-xs text-center"
                        />
                        <span>cm</span>
                    </div>
                </div>
            </div>

            {/* Fast Rapid-Scan Intake Bar & Running Counter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Rapid Scan Input */}
                <div className="md:col-span-2 bg-sf-surface p-4 rounded-2xl shadow-sm border border-sf-divider flex items-center gap-3">
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
                        className="flex-1 p-3 rounded-xl border border-sf-divider bg-sf-canvas font-mono text-sm font-bold text-sf-text focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
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
                <div className="bg-sf-surface p-4 rounded-2xl shadow-sm border border-sf-divider flex items-center justify-between">
                    <div>
                        <div className="text-xs text-sf-muted font-bold uppercase tracking-wider">Consignment Progress</div>
                        <div className="text-xl font-bold text-sf-text mt-0.5">
                            {samples.length} <span className="text-sm font-normal text-sf-muted">/ {expectedNum > 0 ? expectedNum : '—'} expected</span>
                        </div>
                        <div className="flex gap-2 text-[11px] mt-1 font-medium">
                            <span className="text-emerald-600 dark:text-emerald-400">{acceptedCount} {t('intakeRules.planned')}</span>
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

            {samples.length > 0 && <div className="rounded-xl bg-sf-canvas border border-sf-divider p-4 space-y-2"><p className="text-sm text-sf-muted">{t('intakeRules.bulkHint')}</p><button type="button" disabled={!selectedRows.size} onClick={confirmObserved} className="px-4 py-2 rounded-lg bg-sf-primary text-white disabled:opacity-50">{t('intakeRules.bulkConfirm')} ({selectedRows.size})</button></div>}
            {/* High-Throughput Scanned Samples Table */}
            <div className="bg-sf-surface rounded-2xl shadow-sm border border-sf-divider overflow-hidden">
                <div className="p-4 border-b border-sf-divider flex justify-between items-center bg-sf-raised">
                    <h3 className="font-bold text-sm text-sf-text flex items-center gap-2">
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

                <div className="max-h-[450px] overflow-auto">
                    {samples.length === 0 ? (
                        <div className="text-center py-16 text-sf-muted">
                            <PackageCheck size={40} className="mx-auto mb-2 opacity-30" />
                            <p className="font-medium text-sm">No samples added yet.</p>
                            <p className="text-xs text-sf-muted mt-1">Scan barcodes above or click "Import Client Manifest".</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-sf-canvas text-sf-muted sticky top-0 font-bold">
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
                            <tbody className="divide-y divide-sf-divider">
                                {samples.map((s, idx) => (
                                    <tr key={idx} className={`hover:bg-sf-canvas transition-colors ${s.status === 'REJECTED' ? 'bg-red-50/40 dark:bg-red-950/20' : ''}`}>
                                        <td className="p-3 text-sf-muted font-mono"><input type="checkbox" aria-label={s.originalId} checked={selectedRows.has(s.originalId)} onChange={e=>setSelectedRows(prev=>{const next=new Set(prev);e.target.checked ? next.add(s.originalId):next.delete(s.originalId);return next;})}/> {idx + 1}</td>
                                        <td className="p-3 font-mono font-bold text-sf-text">{s.originalId}<span className="block font-sans font-normal text-sf-muted">{s._form?.name} · {t('intakeRules.version')} {s._form?.version} · {formCriteria(s._form).filter(rule=>rule.required && !s.checklist?.items?.[rule.id]?.status).length} {t('intakeRules.unrecorded')}</span></td>
                                        <td className="p-3">
                                            {s.status === 'REJECTED' ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 flex items-center gap-1 w-max">
                                                    <AlertTriangle size={10} /> REJECTED
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1 w-max">
                                                    <CheckCircle size={10} /> {t('intakeRules.planned')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 font-mono text-sf-text">{s.receivedMass !== undefined && s.receivedMass !== null && s.receivedMass !== '' ? `${s.receivedMass}g` : '—'}</td>
                                        <td className="p-3 capitalize text-sf-muted">{s.moistureOnArrival ? t('intakeRules.moisture.'+s.moistureOnArrival) : t('intakeRules.unrecorded')}</td>
                                        <td className="p-3 text-sf-muted">
                                            {s.latitude != null && s.longitude != null ? (
                                                <span className="font-mono">{s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}</span>
                                            ) : s.siteName ? (
                                                <span>{s.siteName}</span>
                                            ) : (
                                                <span className="text-sf-muted italic">None</span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            {s.status === 'REJECTED' ? (
                                                <div className="text-red-600 dark:text-red-400 font-medium text-[11px] truncate max-w-[200px]" title={s.rejectionReason}>
                                                    {s.rejectionReason || 'Non-conformance'}
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
                    <div className="p-4 bg-sf-canvas border-t border-sf-divider flex justify-between items-center">
                        <div className="text-xs text-sf-muted">
                            Ready to batch receive <strong className="text-sf-text">{samples.length} samples</strong> into Consignment.
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
