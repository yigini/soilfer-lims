import { useAnalysisNames } from '../context/AnalysisCatalogueContext';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { AlertTriangle, CheckCircle, XCircle, Droplet, Droplets, Scale, Layers, Plus, Camera, ArrowLeft, User, Info, FileText, Printer, HelpCircle, Loader2, X, RefreshCw, MapPin, PackageCheck, ShieldCheck, Clock } from 'lucide-react';
import QRCode from 'qrcode';
import WalkInForm from '../components/reception/WalkInForm';
import ComplianceChecklist from '../components/reception/ComplianceChecklist';
import SampleMap from '../components/reception/SampleMap';
import FieldProvenanceCard from '../components/reception/FieldProvenanceCard';
import BatchIntake from '../components/reception/BatchIntake';
import WedgeModeBar from '../components/reception/WedgeModeBar';
import KeyboardShortcutsModal from '../components/reception/KeyboardShortcutsModal';
import LabelPrintDialog from '../components/common/LabelPrintDialog';
import QRScanner from '../components/common/QRScanner';
import InfoTooltip from '../components/common/InfoTooltip';
import { playSuccessChime, playErrorBuzz, playNoticeChime, isAudioEnabled, setAudioEnabled } from '../utils/audioCues';
import { resolveCoordinates } from '../utils/coordinateResolver';
import { recordSyncOperation } from '../services/offline/syncEngine';


const Reception = () => {
    const getAnalysisDisplayName = useAnalysisNames();
    const { user, token } = useAuth();
    const { showDialog } = useDialog();
    const { t } = useLanguage();
    const location = useLocation();

    // Configured laboratory default coordinates (#114)
    const LAB_DEFAULT_COORDINATES = {
        'LAB-GTM-01': [14.6349, -90.5069], // Guatemala City
        'LAB-ZWE-01': [-17.8292, 31.0522], // Harare, Zimbabwe
        'HARARE': [-17.8292, 31.0522],
        'GTM': [14.6349, -90.5069]
    };

    const labCoordinates = useMemo(() => {
        if (user?.labCoordinates) return user.labCoordinates;
        if (user?.labId && LAB_DEFAULT_COORDINATES[user.labId]) return LAB_DEFAULT_COORDINATES[user.labId];
        if (user?.lab?.location) return user.lab.location;
        return null;
    }, [user?.labCoordinates, user?.labId, user?.lab?.location]);

    // --- MODE SELECTION ---
    const [mode, setMode] = useState(null); // 'PROJECT' | 'WALK_IN' | null
    const [sessionProject, setSessionProject] = useState(null);
    const [mobileStep, setMobileStep] = useState('identify'); // 'identify' | 'condition' | 'analyses' | 'receipt'

    // Enforce N/A policy cleanup when switching intake mode (#113)
    useEffect(() => {
        if (mode !== 'WALK_IN' && checklistData?.items?.coc?.status === 'NA') {
            setChecklistData(prev => ({
                ...prev,
                items: {
                    ...prev?.items,
                    coc: { ...prev?.items?.coc, status: undefined }
                }
            }));
        }
    }, [mode, checklistData?.items?.coc?.status]);

    // --- STAGE D: HARDWARE WEDGE SCANNER & DESK ERGONOMICS (RC-16, RC-17, RC-18) ---
    const [isWedgeMode, setIsWedgeMode] = useState(() => localStorage.getItem('lims_wedge_mode') === 'true');
    const [wedgeSuffix, setWedgeSuffix] = useState(() => localStorage.getItem('lims_wedge_suffix') || 'ENTER');
    const [soundEnabled, setSoundEnabled] = useState(() => isAudioEnabled());
    const [autoRefocus, setAutoRefocus] = useState(() => localStorage.getItem('lims_wedge_refocus') !== 'false');
    const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
    const [isLabelPrintOpen, setIsLabelPrintOpen] = useState(false);
    const scanInputRef = useRef(null);

    // --- DATA LOADING ---
    const [groups, setGroups] = useState([]);
    const [analyses, setAnalyses] = useState([]);
    const [availableProjects, setAvailableProjects] = useState([]);

    // --- AUTOCOMPLETE STATE (Project Mode) ---
    const [autocompleteResults, setAutocompleteResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showAutocomplete, setShowAutocomplete] = useState(false);

    // --- FORM DATA ---
    const [scanCode, setScanCode] = useState('');
    const [sampleData, setSampleData] = useState(null);

    // Stage A: Desk-Only Facts
    const [receivedMass, setReceivedMass] = useState('');
    const [massWarningAcknowledged, setMassWarningAcknowledged] = useState(false);
    const [moistureOnArrival, setMoistureOnArrival] = useState('MOIST');
    const [foreignMaterial, setForeignMaterial] = useState([]);
    const [intakePhotos, setIntakePhotos] = useState([]);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [isResubmission, setIsResubmission] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState(null);

    // Stage B: Location & Spatial Outlier
    const [geometryOutlierWarning, setGeometryOutlierWarning] = useState(null);

    // Compliance & Notes
    const [checklistData, setChecklistData] = useState({ items: {}, nonConformance: false, reason: '' });
    const [intakeNotes, setIntakeNotes] = useState('');
    const [branding, setBranding] = useState(null);

    // Stage E: Structured Chain of Custody & Handover (RC-19)
    const [custodyHandoverAt, setCustodyHandoverAt] = useState(() => new Date().toISOString().slice(0, 16));
    const [custodyCarrierName, setCustodyCarrierName] = useState('');
    const [custodyTrackingNumber, setCustodyTrackingNumber] = useState('');
    const [custodySenderSignature, setCustodySenderSignature] = useState('');
    const [custodyCounterSigned, setCustodyCounterSigned] = useState(true);

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [resultQrUrl, setResultQrUrl] = useState('');

    // Offline QR Code generation when Lab ID is minted
    useEffect(() => {
        if (result?.labId) {
            QRCode.toDataURL(String(result.labId), { width: 180, margin: 1 })
                .then(url => setResultQrUrl(url))
                .catch(() => setResultQrUrl(''));
        } else {
            setResultQrUrl('');
        }
    }, [result?.labId]);

    // Walk-in Specific Data
    const [submitter, setSubmitter] = useState({ name: '', surname: '', phone: '', email: '', organization: '', contactMethod: 'Phone' });
    const [sampling, setSampling] = useState({
        date: new Date().toISOString().split('T')[0],
        depth: '',
        depthType: '',
        depthMin: null,
        depthMax: null,
        depthTopCm: null,
        depthBottomCm: null,
        location: '',
        coordinates: null, // { lat, lng, accuracy, elevation }
        positionalUncertaintyM: null,
        locationSource: null,
        compositeRadiusM: null,
        landUse: '',
        crop: '',
        previousCrop: '',
        management: '',
        captureMethod: 'MAP_PIN',
        locationConfidence: null,
        siteName: '',
        areaVillage: '',
        district: '',
        landmark: '',
        locationUncertaintyReason: '',
        purpose: '',
        isComposite: false,
        subsamples: '',
        urgency: 'Normal'
    });


    // Analysis Selection State
    const [selectedGroup, setSelectedGroup] = useState('');
    const [additions, setAdditions] = useState([]); // List of codes
    const [removals, setRemovals] = useState([]); // List of codes
    const [showScanner, setShowScanner] = useState(false);
    const [justification, setJustification] = useState('');

    // UI Helpers
    const [searchAnalysis, setSearchAnalysis] = useState('');
    const analysisSectionRef = useRef(null);
    const [analysisHighlight, setAnalysisHighlight] = useState(false);
    const [validationErrors, setValidationErrors] = useState([]);

    const [hasRanLookup, setHasRanLookup] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const originalId = params.get('originalId');
        const modeParam = params.get('mode');
        const projectIdParam = params.get('projectId');

        if (originalId && !hasRanLookup && groups.length > 0) {
            setScanCode(originalId);
            setMode('PROJECT');
            if (projectIdParam) setSessionProject(projectIdParam);
            handleLookup(originalId, 'PROJECT', projectIdParam);
            setHasRanLookup(true);
        } else if (modeParam === 'WALK_IN' && !mode) {
            setMode('WALK_IN');
            const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
            setScanCode(`EXT-${randomId}`);
            setSampleData({ originalId: `EXT-${randomId}`, isNew: true });
        }
    }, [location.search, hasRanLookup, groups]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [gRes, aRes, pRes] = await Promise.all([
                    axios.get('/api/config/groups'),
                    axios.get('/api/config/analyses'),
                    axios.get('/api/projects')
                ]);
                setGroups(gRes.data.filter(g => g.orderable));
                setAnalyses(aRes.data);
                setAvailableProjects(Array.isArray(pRes.data) ? pRes.data : pRes.data.data || []);

                // Fetch Branding
                try {
                    const bRes = await axios.get('/api/admin/settings');
                    const settings = bRes.data?.data || bRes.data;
                    if (settings?.branding) setBranding(settings.branding);
                } catch (be) { console.warn("Failed to fetch branding", be); }
            } catch (e) {
                console.error(e);
            }
        };
        fetchData();
    }, []);

    // Stage B: Canonical coordinate resolution across all formats (RC-09)
    const resolvedCoordinates = useMemo(() => {
        if (mode === 'WALK_IN' || sampleData?.isNew) {
            if (!sampling.coordinates) return null;
            return resolveCoordinates({ coordinates: sampling.coordinates });
        }
        return resolveCoordinates({
            ...sampleData,
            coordinates: sampling.coordinates || undefined
        });
    }, [sampleData, sampling.coordinates, mode]);

    // Stage B: Batch geometry outlier detection (RC-10)
    useEffect(() => {
        const checkOutlier = async () => {
            const proj = sessionProject || sampleData?.projectCode || sampleData?.projectId;
            if (!proj || !resolvedCoordinates?.lat || !resolvedCoordinates?.lng) {
                setGeometryOutlierWarning(null);
                return;
            }
            try {
                const res = await axios.get('/api/reception/batch-geometry-check', {
                    params: {
                        projectId: proj,
                        lat: resolvedCoordinates.lat,
                        lng: resolvedCoordinates.lng,
                        sampleId: sampleData?.id
                    }
                });
                if (res.data?.isOutlier) {
                    setGeometryOutlierWarning(res.data.warning);
                } else {
                    setGeometryOutlierWarning(null);
                }
            } catch (err) {
                console.warn('Batch geometry check failed', err);
            }
        };
        checkOutlier();
    }, [resolvedCoordinates, sessionProject, sampleData]);

    // --- STAGE D: HARDWARE WEDGE SCANNER & DESK ERGONOMICS (RC-16, RC-17, RC-18) ---
    const handleToggleWedgeMode = (enabled) => {
        setIsWedgeMode(enabled);
        localStorage.setItem('lims_wedge_mode', String(enabled));
        if (enabled && scanInputRef.current) {
            scanInputRef.current.focus();
        }
    };

    const handleChangeSuffix = (suffix) => {
        setWedgeSuffix(suffix);
        localStorage.setItem('lims_wedge_suffix', suffix);
    };

    const handleToggleSound = (enabled) => {
        setSoundEnabled(enabled);
        setAudioEnabled(enabled);
    };

    const handleToggleAutoRefocus = (enabled) => {
        setAutoRefocus(enabled);
        localStorage.setItem('lims_wedge_refocus', String(enabled));
    };

    // Stage D: Auto-refocus persistence in Wedge Fast Mode (RC-16)
    useEffect(() => {
        if (!isWedgeMode || !autoRefocus) return;

        const handleBlur = () => {
            setTimeout(() => {
                const active = document.activeElement;
                const isFormInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
                const isDialogOrModal = active && active.closest && (active.closest('.fixed') || active.closest('[role="dialog"]'));
                if (!isFormInput && !isDialogOrModal && scanInputRef.current) {
                    scanInputRef.current.focus();
                }
            }, 60);
        };

        window.addEventListener('focusout', handleBlur);
        return () => window.removeEventListener('focusout', handleBlur);
    }, [isWedgeMode, autoRefocus]);

    // Stage D: Global Keyboard Navigation Shortcuts (RC-18)
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // Escape: Close modals or clear warning
            if (e.key === 'Escape') {
                if (isShortcutsOpen) {
                    setIsShortcutsOpen(false);
                    return;
                }
                if (isLabelPrintOpen) {
                    setIsLabelPrintOpen(false);
                    return;
                }
                if (duplicateWarning) {
                    setDuplicateWarning(null);
                    return;
                }
            }

            // Alt+1: Project Mode
            if (e.altKey && e.key === '1') {
                e.preventDefault();
                setMode('PROJECT');
                return;
            }
            // Alt+2: Walk-in Mode
            if (e.altKey && e.key === '2') {
                e.preventDefault();
                setMode('WALK_IN');
                setSessionProject(null);
                const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
                setScanCode(`EXT-${randomId}`);
                setSampleData({ originalId: `EXT-${randomId}`, isNew: true });
                return;
            }
            // Alt+3: Consignment Batch Mode
            if (e.altKey && e.key === '3') {
                e.preventDefault();
                setMode('CONSIGNMENT');
                return;
            }
            // Alt+W: Toggle Wedge Fast Mode
            if (e.altKey && (e.key === 'w' || e.key === 'W')) {
                e.preventDefault();
                handleToggleWedgeMode(!isWedgeMode);
                playNoticeChime();
                return;
            }
            // Ctrl+Enter: Complete Intake
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                if (sampleData && !result && !loading) {
                    e.preventDefault();
                    handleSubmit('ACCEPTED');
                    return;
                }
            }
            // Ctrl+P: Print Label
            if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
                if (result?.success) {
                    e.preventDefault();
                    setIsLabelPrintOpen(true);
                    return;
                }
            }
            // ?: Open keyboard shortcuts help when not typing in text field
            if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
                e.preventDefault();
                setIsShortcutsOpen(prev => !prev);
                return;
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isShortcutsOpen, isLabelPrintOpen, duplicateWarning, sampleData, result, loading, isWedgeMode]);

    // Stage E: Deep link lookup for immutable sampleId or originalId from dashboard
    useEffect(() => {
        if (!token) return;
        const params = new URLSearchParams(location.search);
        const sampleId = params.get('sampleId') || params.get('id');
        const code = params.get('code') || params.get('originalId');

        if (sampleId) {
            axios.get(`/api/samples/${sampleId}`, { headers: { Authorization: `Bearer ${token}` } })
                .then(res => {
                    if (res.data) {
                        const s = res.data;
                        setMode(s.isWalkIn ? 'WALK_IN' : 'PROJECT');
                        setSampleData(s);
                        setScanCode(s.originalId || s.id);
                        populateDeskFacts(s);
                    }
                })
                .catch(err => console.error('[Reception] Failed to load sample from URL param:', err));
        } else if (code) {
            handleLookup(code);
        }
    }, [location.search, token]);

    const resetForm = () => {
        setScanCode('');
        setSampleData(null);
        setMobileStep('identify');
        setChecklistData({ items: {}, nonConformance: false, reason: '' });
        setRemovals([]);
        setAdditions([]);
        setTimeout(() => scanInputRef.current?.focus(), 50);
        setJustification('');
        setIntakeNotes('');
        setCustodyHandoverAt(new Date().toISOString().slice(0, 16));
        setCustodyCarrierName('');
        setCustodyTrackingNumber('');
        setCustodySenderSignature('');
        setCustodyCounterSigned(true);
        setResultQrUrl('');

        // Stage A
        setReceivedMass('');
        setMassWarningAcknowledged(false);
        setMoistureOnArrival('MOIST');
        setForeignMaterial([]);
        setIntakePhotos([]);
        setIsResubmission(false);
        setDuplicateWarning(null);

        // Stage B
        setGeometryOutlierWarning(null);

        if (mode === 'WALK_IN') {
            setSubmitter({ name: '', surname: '', phone: '', email: '', organization: '', contactMethod: 'Phone' });
            setSampling({
                date: new Date().toISOString().split('T')[0],
                depth: '',
                depthType: '',
                depthMin: null,
                depthMax: null,
                depthTopCm: null,
                depthBottomCm: null,
                location: '',
                coordinates: null,
                positionalUncertaintyM: null,
                locationSource: null,
                compositeRadiusM: null,
                captureMethod: 'MAP_PIN',
                locationConfidence: null,
                siteName: '',
                areaVillage: '',
                district: '',
                landmark: '',
                locationUncertaintyReason: '',
                landUse: '',
                crop: '',
                previousCrop: '',
                management: '',
                purpose: '',
                isComposite: false,
                subsamples: '',
                urgency: 'Normal'
            });
        }
        setResult(null);
        localStorage.removeItem(AUTOSAVE_KEY); // Clear local autosave when resetting/discarding
    };

    // --- AUTOSAVE & DRAFTS ---
    const AUTOSAVE_KEY = 'limsi_intake_autosave';

    const isSubstantialDraft = (data) => {
        if (!data) return false;
        const hasSubmitter = data.submitter && (data.submitter.name || data.submitter.phone || data.submitter.organization || data.submitter.email);
        const hasSampling = data.sampling && (data.sampling.location || data.sampling.coordinates || data.sampling.crop || data.sampling.purpose);
        const hasAnalyses = data.selectedGroup || (data.additions && data.additions.length > 0);
        const hasNotes = !!data.intakeNotes;
        const hasDeskFacts = !!data.receivedMass || (data.intakePhotos && data.intakePhotos.length > 0);
        return hasSubmitter || hasSampling || hasAnalyses || hasNotes || hasDeskFacts;
    };

    // Load from Autosave on Mount
    useEffect(() => {
        const saved = localStorage.getItem(AUTOSAVE_KEY);
        if (saved && mode === 'WALK_IN' && !sampleData?.id) {
            try {
                const data = JSON.parse(saved);

                // Only prompt if there is actual input to restore
                if (!isSubstantialDraft(data)) {
                    localStorage.removeItem(AUTOSAVE_KEY);
                    return;
                }

                showDialog({
                    type: 'confirm',
                    title: 'Restore Draft?',
                    message: 'Found an unfinished intake form. Would you like to restore it?',
                    confirmText: 'Restore',
                    cancelText: 'Discard Draft', // Explicitly offer to discard
                    onConfirm: () => {
                        setSubmitter(data.submitter || submitter);
                        setSampling(data.sampling || sampling);
                        setSelectedGroup(data.selectedGroup || '');
                        setAdditions(data.additions || []);
                        setRemovals(data.removals || []);
                        setChecklistData(data.checklistData || checklistData);
                        setIntakeNotes(data.intakeNotes || '');
                        if (data.receivedMass) setReceivedMass(data.receivedMass);
                        if (data.massWarningAcknowledged) setMassWarningAcknowledged(data.massWarningAcknowledged);
                        if (data.moistureOnArrival) setMoistureOnArrival(data.moistureOnArrival);
                        if (data.foreignMaterial) setForeignMaterial(data.foreignMaterial);
                        if (data.intakePhotos) setIntakePhotos(data.intakePhotos);
                        if (data.isResubmission) setIsResubmission(data.isResubmission);
                    },
                    onCancel: () => {
                        // If they cancel restoration, we assume they want to start fresh
                        localStorage.removeItem(AUTOSAVE_KEY);
                    }
                });
            } catch (e) {
                console.error("Autosave restore failed", e);
            }
        }
    }, [mode]);

    // Save to LocalStorage every 10s
    useEffect(() => {
        if (mode !== 'WALK_IN' || result) return; // Don't autosave project mode yet or if finished

        const timer = setInterval(() => {
            const data = {
                submitter,
                sampling,
                selectedGroup,
                additions,
                removals,
                checklistData,
                intakeNotes,
                receivedMass,
                massWarningAcknowledged,
                moistureOnArrival,
                foreignMaterial,
                intakePhotos,
                isResubmission,
                timestamp: Date.now()
            };
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
        }, 10000);

        return () => clearInterval(timer);
    }, [mode, submitter, sampling, selectedGroup, additions, removals, checklistData, intakeNotes, receivedMass, massWarningAcknowledged, moistureOnArrival, foreignMaterial, intakePhotos, isResubmission, result]);

    const populateDeskFacts = (targetSample) => {
        if (!targetSample) return;
        const recData = targetSample.receptionData ? (typeof targetSample.receptionData === 'string' ? JSON.parse(targetSample.receptionData) : targetSample.receptionData) : null;
        const meta = targetSample.metadata ? (typeof targetSample.metadata === 'string' ? JSON.parse(targetSample.metadata) : targetSample.metadata) : null;

        const savedChecklist = recData?.checklist || meta?.nonConformance?.checklist;
        if (savedChecklist) {
            setChecklistData(savedChecklist);
        }

        const mass = targetSample.receivedMass ?? recData?.receivedMass;
        if (mass != null) setReceivedMass(String(mass));

        const massAck = targetSample.massWarningAcknowledged ?? recData?.massWarningAcknowledged;
        if (massAck != null) setMassWarningAcknowledged(!!massAck);

        const moisture = targetSample.moistureOnArrival || recData?.moistureOnArrival;
        if (moisture) setMoistureOnArrival(moisture);

        const fmRaw = targetSample.foreignMaterial || recData?.foreignMaterial;
        if (fmRaw) {
            try {
                const parsedFm = typeof fmRaw === 'string' ? JSON.parse(fmRaw) : fmRaw;
                setForeignMaterial(Array.isArray(parsedFm) ? parsedFm : [parsedFm]);
            } catch {
                setForeignMaterial([String(fmRaw)]);
            }
        }

        const photosRaw = targetSample.intakePhotos || recData?.intakePhotos || recData?.photos;
        if (photosRaw) {
            try {
                const parsedPhotos = typeof photosRaw === 'string' ? JSON.parse(photosRaw) : photosRaw;
                setIntakePhotos(Array.isArray(parsedPhotos) ? parsedPhotos : [parsedPhotos]);
            } catch {
                setIntakePhotos([]);
            }
        }

        const resub = targetSample.isResubmission ?? recData?.isResubmission;
        if (resub != null) setIsResubmission(!!resub);
    };

    const handleLookup = async (codeOverride, modeOverride, projectOverride) => {
        // Handle case where codeOverride might be a React Event object
        const finalCode = (typeof codeOverride === 'string' ? codeOverride : scanCode) || '';
        const trimmedCode = String(finalCode).trim();
        const currentMode = modeOverride || mode;
        const currentProject = projectOverride || sessionProject;

        if (!trimmedCode) return;
        if (typeof codeOverride === 'string') setScanCode(trimmedCode);

        setLoading(true);
        setResult(null);

        // Check for duplicate / prior receipts (RC-04)
        try {
            const dupRes = await axios.get('/api/reception/check-duplicate', {
                params: { originalId: trimmedCode },
                headers: { Authorization: `Bearer ${token}` }
            });
            if (dupRes.data?.isPriorReceipt) {
                playNoticeChime();
                setDuplicateWarning({
                    sample: dupRes.data.sample,
                    originalId: trimmedCode,
                    isPriorReceipt: true
                });
            } else {
                setDuplicateWarning(null);
            }
        } catch (err) {
            console.warn('[handleLookup] Duplicate check error:', err);
        }

        // Reset intermediate form state to prevent stale carryover between samples
        setDuplicateWarning(null);
        setGeometryOutlierWarning(null);
        setReceivedMass('');
        setMassWarningAcknowledged(false);
        setMoistureOnArrival('MOIST');
        setForeignMaterial([]);
        setIntakePhotos([]);
        setIsResubmission(false);
        setChecklistData({ items: {}, nonConformance: false, reason: '' });
        setIntakeNotes('');
        setAdditions([]);
        setRemovals([]);
        setJustification('');
        setSelectedGroup('');
        setCustodyCarrierName('');
        setCustodyTrackingNumber('');
        setCustodySenderSignature('');
        setCustodyHandoverAt(new Date().toISOString().slice(0, 16));
        setCustodyCounterSigned(true);
        setSampling({
            date: new Date().toISOString().split('T')[0],
            depth: '',
            depthType: '',
            depthMin: null,
            depthMax: null,
            depthTopCm: null,
            depthBottomCm: null,
            location: '',
            coordinates: null,
            positionalUncertaintyM: null,
            locationSource: null,
            compositeRadiusM: null,
            captureMethod: 'MAP_PIN',
            locationConfidence: null,
            siteName: '',
            areaVillage: '',
            district: '',
            landmark: '',
            locationUncertaintyReason: '',
            landUse: '',
            crop: '',
            previousCrop: '',
            management: '',
            purpose: '',
            isComposite: false,
            subsamples: '',
            urgency: 'Normal'
        });

        try {
            let found = null;
            try {
                const contextRes = await axios.get('/api/reception/sample-context', {
                    params: { originalId: trimmedCode },
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                if (contextRes.data?.success && contextRes.data?.sample) {
                    found = contextRes.data.sample;
                }
            } catch (ctxErr) {
                if (ctxErr.response?.status === 403) {
                    playErrorBuzz();
                    showDialog({
                        type: 'error',
                        title: 'Access Denied',
                        message: ctxErr.response.data?.message || `Access denied: sample ${trimmedCode} belongs to another laboratory.`
                    });
                    setSampleData(null);
                    setLoading(false);
                    return;
                }
                // Fallback to general lookup if sample-context returns 404 or fails
                try {
                    const fallbackRes = await axios.get('/api/samples', { params: { originalId: trimmedCode, limit: 1 } });
                    if (fallbackRes.data?.data?.length > 0) {
                        found = fallbackRes.data.data[0];
                    }
                } catch { /* ignore fallback error */ }
            }

            if (found) {
                const lockedStatuses = ['ACCEPTED', 'LAB_ID_ASSIGNED', 'PROCESSING', 'COMPLETED', 'APPROVED', 'ARCHIVED', 'DISPOSED', 'RECEIVED_REJECTED'];

                if (lockedStatuses.includes(found.status)) {
                    playErrorBuzz();
                    showDialog({
                        type: 'error',
                        title: 'Intake Locked',
                        message: `Sample ${found.originalId} is in status '${found.status}' and cannot be modified by Reception.`
                    });
                    setSampleData(null);
                    setLoading(false);
                    return;
                }

                if (found.status === 'DRAFT' || found.status === 'RECEIVED') {
                    // RESUME DRAFT / REVISE RECEIVED
                    const isSubmitted = found.status === 'RECEIVED';
                    showDialog({
                        type: 'confirm',
                        title: isSubmitted ? 'Revise Intake?' : 'Resume Draft?',
                        message: isSubmitted
                            ? `Sample ${found.originalId} is already RECEIVED but not yet approved by a manager. Would you like to make changes?`
                            : `Would you like to resume the draft for ${found.originalId}?`,
                        confirmText: 'Yes, Open',
                        onConfirm: () => {
                            playSuccessChime();
                            // Detect walk-in: explicit flag OR no project link
                            const isWalkInDraft = found.receptionData?.isWalkIn || (!found.projectId && !found.projectCode);
                            setMode(isWalkInDraft ? 'WALK_IN' : 'PROJECT');
                            if (isWalkInDraft) {
                                setSessionProject(null);
                            } else {
                                setSessionProject(found.projectId || found.projectCode);
                            }
                            setSampleData(found);

                            const recData = found.receptionData ? (typeof found.receptionData === 'string' ? JSON.parse(found.receptionData) : found.receptionData) : null;
                            const meta = found.metadata ? (typeof found.metadata === 'string' ? JSON.parse(found.metadata) : found.metadata) : null;

                            // Populate form from receptionData
                            if (recData?.submitterDetails) setSubmitter(recData.submitterDetails);
                            if (recData?.samplingDetails) {
                                setSampling(prev => ({
                                    ...prev,
                                    ...recData.samplingDetails
                                }));
                            }

                            // Canonical coordinate resolution
                            const resolved = resolveCoordinates(found);
                            if (resolved.isRecorded) {
                                setSampling(prev => ({
                                    ...prev,
                                    coordinates: {
                                        lat: resolved.lat,
                                        lng: resolved.lng,
                                        elevation: resolved.elevation,
                                        accuracy: resolved.accuracy
                                    },
                                    location: resolved.locationDescription || prev.location,
                                    positionalUncertaintyM: resolved.accuracy || prev.positionalUncertaintyM,
                                    locationSource: resolved.source || prev.locationSource,
                                    locationConfidence: resolved.confidence || prev.locationConfidence
                                }));
                            }

                            const savedChecklist = recData?.checklist || meta?.nonConformance?.checklist;
                            if (savedChecklist) setChecklistData(savedChecklist);
                            if (recData?.notes || found.notes) setIntakeNotes(recData?.notes || found.notes || '');

                            // Chain of Custody
                            const coc = recData?.coc || {};
                            if (found.custodyCarrierName || coc.deliveredBy) setCustodyCarrierName(found.custodyCarrierName || coc.deliveredBy);
                            if (found.custodyTrackingNumber || coc.trackingNumber) setCustodyTrackingNumber(found.custodyTrackingNumber || coc.trackingNumber);
                            if (found.custodySenderSignature || coc.senderSignature) setCustodySenderSignature(found.custodySenderSignature || coc.senderSignature);
                            if (found.custodyHandoverAt || coc.date) {
                                const dt = new Date(found.custodyHandoverAt || coc.date);
                                if (!isNaN(dt.getTime())) setCustodyHandoverAt(dt.toISOString().slice(0, 16));
                            }

                            // Analysis group, additions, removals, justification
                            const grp = (Array.isArray(found.analysisGroupIds) && found.analysisGroupIds[0])
                                || recData?.analysisGroupIds?.[0]
                                || (Array.isArray(recData?.analysisGroupIds) && recData.analysisGroupIds[0]);
                            if (grp) setSelectedGroup(grp);

                            if (Array.isArray(recData?.analysisAdditions)) setAdditions(recData.analysisAdditions);
                            if (Array.isArray(recData?.analysisRemovals)) setRemovals(recData.analysisRemovals);
                            if (recData?.analysisJustification) setJustification(recData.analysisJustification);

                            // Stage A Desk Facts
                            populateDeskFacts(found);
                        }
                    });
                } else if (currentMode === 'PROJECT' && currentProject) {
                    if (found.projectId && found.projectId !== currentProject && found.projectCode !== currentProject) {
                        playErrorBuzz();
                        showDialog({
                            type: 'error',
                            title: 'Project Mismatch',
                            message: `Sample belongs to project ${found.projectId || found.projectCode}, but current session is ${currentProject}.`
                        });
                        setSampleData(null);
                        setLoading(false);
                        return;
                    }
                    playSuccessChime();
                    setSampleData(found);
                    populateDeskFacts(found);

                    // Canonical coordinate resolution for EXPECTED
                    const resolved = resolveCoordinates(found);
                    if (resolved.isRecorded) {
                        setSampling(prev => ({
                            ...prev,
                            coordinates: {
                                lat: resolved.lat,
                                lng: resolved.lng,
                                elevation: resolved.elevation,
                                accuracy: resolved.accuracy
                            },
                            location: resolved.locationDescription || prev.location,
                            positionalUncertaintyM: resolved.accuracy || prev.positionalUncertaintyM,
                            locationSource: resolved.source || prev.locationSource,
                            locationConfidence: resolved.confidence || prev.locationConfidence
                        }));
                    }

                    // Auto-apply project bundle if none selected
                    if (!selectedGroup) {
                        const pId = found.projectId || currentProject;
                        const proj = availableProjects.find(p => p.id === pId || p.code === pId);
                        if (proj?.defaultAnalysisBundle) setSelectedGroup(proj.defaultAnalysisBundle);
                    }
                } else {
                    playSuccessChime();
                    setSampleData(found);
                    populateDeskFacts(found);

                    const resolved = resolveCoordinates(found);
                    if (resolved.isRecorded) {
                        setSampling(prev => ({
                            ...prev,
                            coordinates: {
                                lat: resolved.lat,
                                lng: resolved.lng,
                                elevation: resolved.elevation,
                                accuracy: resolved.accuracy
                            },
                            location: resolved.locationDescription || prev.location
                        }));
                    }

                    // Also auto-apply bundle for project samples caught in non-project mode
                    if (!selectedGroup && found.projectId) {
                        const proj = availableProjects.find(p => p.id === found.projectId || p.code === found.projectId);
                        if (proj?.defaultAnalysisBundle) setSelectedGroup(proj.defaultAnalysisBundle);
                    }
                }

            } else {
                if (currentMode === 'PROJECT') {
                    // Check if project allows open intake
                    const proj = availableProjects.find(p => p.id === currentProject || p.code === currentProject);
                    const isSoilFer = (proj?.projectType === 'SOILFER_V1') || (proj?.code && (proj.code.startsWith('SOILFER-') || proj.code === 'SOILFER'));
                    const isKoboLinked = proj?.projectType === 'KOBO_LINKED';
                    const isOpenIntake = proj?.projectType === 'OPEN_INTAKE' || (!isSoilFer && !isKoboLinked && proj?.projectType !== 'TEMPLATE_PREDEFINED_IDS');

                    if (proj && isOpenIntake) {
                        // Bypass manifest check only for genuine Open Intake projects
                        playSuccessChime();
                        setSampleData({
                            originalId: trimmedCode,
                            isNew: true,
                            projectId: proj.id,
                            projectCode: proj.code
                        });
                        return;
                    }

                    if (proj && (isSoilFer || isKoboLinked)) {
                        playErrorBuzz();
                        showDialog({
                            type: 'error',
                            title: 'Sample Not Found',
                            message: `Sample ${trimmedCode} is not registered in project ${proj.code}. SoilFER country projects require Kobo synchronization or an authorized reception exception record.`
                        });
                        return;
                    }

                    // Try to check if it's an RBAC/Scope issue
                    try {
                        const globalCheck = await axios.get(`/api/samples`, { params: { search: trimmedCode, limit: 1, _checkScope: false } });
                        playErrorBuzz();
                        if (globalCheck.data.data?.length > 0) {
                            const foreign = globalCheck.data.data[0];
                            showDialog({
                                type: 'error',
                                title: 'Access Denied',
                                message: `Sample ${trimmedCode} exists but belongs to ${foreign.assignedLab} / ${foreign.projectCode}. You are currently in ${user.labId}.`
                            });
                        } else {
                            showDialog({
                                type: 'error',
                                title: 'Not Found',
                                message: `Sample ${trimmedCode} not found in the manifest for ${proj?.name || currentProject}. Please check the ID or verify the project type.`
                            });
                        }
                    } catch (err) {
                        playErrorBuzz();
                        showDialog({
                            type: 'error',
                            title: 'Lookup Error',
                            message: `Sample ${trimmedCode} not found. Please check the ID or verify connectivity.`
                        });
                    }
                } else {
                    playSuccessChime();
                    setSampleData({ originalId: trimmedCode, isNew: true });
                }
            }
        } catch (e) {
            playErrorBuzz();
            console.error(e);
            showDialog({ type: 'error', title: 'Error', message: 'Lookup failed' });
        } finally {
            setLoading(false);
        }
    };

    // Helper to apply project defaults
    useEffect(() => {
        if (sessionProject && availableProjects.length > 0 && mode === 'PROJECT') {
            const proj = availableProjects.find(p => p.id === sessionProject);
            if (proj?.defaultAnalysisBundle) {
                console.log(`[DEBUG] Applying Default Project Bundle: ${proj.defaultAnalysisBundle}`);
                setSelectedGroup(proj.defaultAnalysisBundle);
            }
        }
    }, [sessionProject, availableProjects, mode]);

    // --- AUTOCOMPLETE SEARCH (Project Mode) ---
    const handleAutocompleteSearch = async (searchTerm) => {
        if (!searchTerm || searchTerm.length < 2 || mode !== 'PROJECT') {
            setAutocompleteResults([]);
            setShowAutocomplete(false);
            return;
        }

        setIsSearching(true);
        setShowAutocomplete(true);
        console.log(`[DEBUG] Searching autocomplete for: "${searchTerm}" in project: ${sessionProject}`);

        try {
            const params = { q: searchTerm, limit: 10 };
            if (sessionProject) params.projectId = sessionProject;

            const res = await axios.get('/api/samples/expected', { params });
            console.log(`[DEBUG] Autocomplete results:`, res.data);
            setAutocompleteResults(res.data || []);
            // Always keep open if we are in this function (meaning search was attempted)
            setShowAutocomplete(true);
        } catch (e) {
            console.error('Autocomplete search failed:', e);
            setAutocompleteResults([]);
            setShowAutocomplete(false);
        } finally {
            setIsSearching(false);
        }
    };

    // Debounced search effect (bypassed in Wedge Fast Mode to prevent race conditions with barcode scanners)
    useEffect(() => {
        if (mode !== 'PROJECT' || isWedgeMode || !scanCode || scanCode.length < 2) {
            setShowAutocomplete(false);
            return;
        }

        const timer = setTimeout(() => {
            handleAutocompleteSearch(scanCode);
        }, 300);

        return () => clearTimeout(timer);
    }, [scanCode, mode, sessionProject, isWedgeMode]);

    // Handle autocomplete selection
    const handleSelectAutocomplete = async (sample) => {
        setShowAutocomplete(false);
        setScanCode(sample.originalId);

        // Auto-select Project Default bundle if available
        const proj = availableProjects.find(p => p.id === sessionProject);
        if (proj?.defaultAnalysisBundle) {
            setSelectedGroup(proj.defaultAnalysisBundle);
        }

        // If sample has recorded coordinates, parse via resolveCoordinates
        const resolved = resolveCoordinates(sample);
        if (resolved.isRecorded) {
            setSampling(prev => ({
                ...prev,
                coordinates: {
                    lat: resolved.lat,
                    lng: resolved.lng,
                    elevation: resolved.elevation,
                    accuracy: resolved.accuracy
                },
                location: resolved.locationDescription || prev.location
            }));
        }

        // Proceed to lookup the full sample data
        handleLookup(sample.originalId, 'PROJECT', sessionProject);
    };

    // --- ANALYSIS LOGIC ---
    const toggleAnalysis = (code) => {
        const group = groups.find(g => g.id === selectedGroup);
        const isInGroup = group?.analyses.includes(code);

        if (isInGroup) {
            if (removals.includes(code)) setRemovals(removals.filter(r => r !== code));
            else setRemovals([...removals, code]);
        } else {
            if (additions.includes(code)) setAdditions(additions.filter(a => a !== code));
            else setAdditions([...additions, code]);
        }
    };

    const effectiveList = (() => {
        const group = groups.find(g => g.id === selectedGroup);
        const set = new Set(group?.analyses || []);
        removals.forEach(r => set.delete(r));
        additions.forEach(a => set.add(a));
        return Array.from(set);
    })();

    // --- RC-01: MASS SUFFICIENCY CALCULATION ---
    const massRequirementBreakdown = effectiveList.map(code => {
        const a = analyses.find(item => item.code === code);
        return {
            code,
            name: a?.name || code,
            massRequired: a?.sampleMassRequired != null ? a.sampleMassRequired : 10.0
        };
    });
    const totalAnalyticalMass = massRequirementBreakdown.reduce((sum, item) => sum + item.massRequired, 0);
    const retentionBuffer = 100.0;
    const totalRequiredMass = effectiveList.length > 0 ? (totalAnalyticalMass + retentionBuffer) : 0;
    const parsedReceivedMass = parseFloat(receivedMass) || 0;
    const massDeficit = (parsedReceivedMass > 0 && totalRequiredMass > parsedReceivedMass)
        ? Math.round((totalRequiredMass - parsedReceivedMass) * 10) / 10
        : 0;
    const isMassDeficient = parsedReceivedMass > 0 && massDeficit > 0;

    // --- RC-03: PHOTO UPLOAD HANDLERS ---
    const handlePhotoUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('photos', files[i]);
        }

        setUploadingPhoto(true);
        try {
            const res = await axios.post('/api/reception/upload-photo', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });
            if (res.data?.urls) {
                setIntakePhotos(prev => [...prev, ...res.data.urls]);
            } else if (res.data?.url) {
                setIntakePhotos(prev => [...prev, res.data.url]);
            }
        } catch (err) {
            showDialog({
                type: 'error',
                title: 'Upload Failed',
                message: err.response?.data?.error || err.message || 'Failed to upload photo.'
            });
        } finally {
            setUploadingPhoto(false);
            e.target.value = '';
        }
    };

    const handleRemovePhoto = (indexToRemove) => {
        setIntakePhotos(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    // --- PURPOSE → ANALYSIS SCROLL + HIGHLIGHT ---
    const handlePurposeSelect = (purposeVal, suggestedGroupId) => {
        // Auto-select the matching group if one was suggested
        if (suggestedGroupId && groups.find(g => g.id === suggestedGroupId)) {
            setSelectedGroup(suggestedGroupId);
            setRemovals([]);
            setAdditions([]);
        }

        // Scroll to analysis section
        setTimeout(() => {
            analysisSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Flash highlight
            setAnalysisHighlight(true);
            setTimeout(() => setAnalysisHighlight(false), 2000);
        }, 100);
    };

    const handleDiscard = async (targetId = null) => {
        const idToDelete = targetId || sampleData?.id;

        // No saved record — just clear the form
        if (!idToDelete) {
            showDialog({
                type: 'confirm',
                title: 'Discard Changes?',
                message: 'Are you sure? All unsaved form data will be lost.',
                confirmText: 'Yes, Discard',
                onConfirm: () => resetForm()
            });
            return;
        }

        showDialog({
            type: 'confirm',
            title: 'Discard Intake?',
            message: 'Are you sure you want to permanently discard this intake? This will delete the record from the database.',
            confirmText: 'Yes, Discard',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await axios.post('/api/reception/discard', { id: idToDelete }, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    showDialog({ type: 'success', title: 'Discarded', message: 'Intake record has been deleted.' });

                    if (targetId) {
                        fetchDrafts(); // Refresh drafts list if we deleted from the dashboard
                    } else {
                        resetForm();
                    }
                } catch (e) {
                    showDialog({ type: 'error', title: 'Discard Failed', message: e.response?.data?.error || e.message });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const CHECKLIST_KEYS = ['container', 'label', 'quantity', 'condition', 'coc'];

    const validateForm = () => {
        const errors = [];
        const isWalkInOrNew = mode === 'WALK_IN' || sampleData?.isNew;

        // Walk-in / new sample fields
        if (isWalkInOrNew) {
            if (!submitter.name?.trim()) errors.push({ key: 'submitter.name', label: 'Submitter first name' });
            if (!submitter.phone?.trim()) errors.push({ key: 'submitter.phone', label: 'Submitter phone number' });
            // Location validation: GPS present → OK; else need two text anchors (areaVillage + landmark)
            const hasGPS = sampling.coordinates?.lat && sampling.coordinates?.lng;
            if (!hasGPS) {
                if (!sampling.areaVillage?.trim()) errors.push({ key: 'areaVillage', label: 'Area/Village (required when no GPS)' });
                if (!sampling.landmark?.trim()) errors.push({ key: 'landmark', label: 'Nearest landmark (required when no GPS)' });
                if (!sampling.areaVillage?.trim() && !sampling.landmark?.trim() && !sampling.location?.trim()) {
                    errors.push({ key: 'location', label: 'Sample location (GPS, or area + landmark)' });
                }
            }
            // Low confidence requires reason
            if (sampling.locationConfidence === 'LOW' && !sampling.locationUncertaintyReason?.trim()) {
                errors.push({ key: 'uncertaintyReason', label: 'Reason for low location confidence' });
            }
            if (!sampling.depthType) errors.push({ key: 'depth', label: 'Sampling depth' });
            if (!sampling.purpose) errors.push({ key: 'purpose', label: 'Purpose of testing' });
        }

        // Universal fields (both modes)
        if (effectiveList.length === 0) errors.push({ key: 'analyses', label: 'At least one analysis must be selected' });

        // RC-01: Received Mass validation
        const massNum = parseFloat(receivedMass);
        if (!receivedMass || isNaN(massNum) || massNum <= 0) {
            errors.push({ key: 'receivedMass', label: 'Received sample mass (grams) is required' });
        } else if (isMassDeficient && !massWarningAcknowledged) {
            errors.push({ key: 'massDeficit', label: `Mass deficit (${massDeficit}g) must be acknowledged` });
        }

        const unanswered = CHECKLIST_KEYS.filter(k => !checklistData.items?.[k]?.status);
        if (unanswered.length > 0) errors.push({ key: 'compliance', label: `Compliance checklist (${unanswered.length} unanswered)` });

        if (removals.length > 0 && !justification?.trim()) errors.push({ key: 'justification', label: 'Justification for removed analyses' });
        if (checklistData.nonConformance && !checklistData.reason?.trim()) errors.push({ key: 'ncReason', label: 'Non-conformance reason' });

        return errors;
    };

    const handleSubmit = async (decision, isDraft = false) => {
        // Skip validation for drafts
        if (!isDraft) {
            const hasFailedChecks = Object.values(checklistData?.items || {}).some(it => it?.status === 'FAIL') || Boolean(checklistData?.nonConformance);
            const isManager = ['SUPER_ADMIN', 'ADMIN', 'LAB_MANAGER'].includes(user?.role);

            if (decision === 'ACCEPTED' && hasFailedChecks && !isManager) {
                playErrorBuzz();
                showDialog({
                    type: 'error',
                    title: 'Manager Authorization Required',
                    message: 'Sample has failed compliance checks. Acceptance requires laboratory manager authorization. Please request manager exception or reject the sample.'
                });
                return;
            }

            const errors = validateForm();
            if (errors.length > 0) {
                playErrorBuzz();
                setValidationErrors(errors);
                const firstErrorKey = errors[0].key;
                const targetElement = document.querySelector(`[data-field-key="${firstErrorKey}"]`) || document.querySelector(`[name="${firstErrorKey}"]`);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    targetElement.focus?.();
                }
                showDialog({
                    type: 'error',
                    title: 'Missing Required Fields',
                    message: errors.map(e => `• ${e.label}`).join('\n')
                });
                return;
            }
        }
        setValidationErrors([]);
        setLoading(true);

        const payload = {
            originalId: scanCode,
            decision: isDraft ? 'DRAFT' : (decision === 'REJECTED' ? 'REJECTED' : 'ACCEPTED'),
            checklist: checklistData,
            notes: intakeNotes,
            ncReason: checklistData.nonConformance ? checklistData.reason : null,
            exceptionReason: checklistData.nonConformance ? checklistData.reason : null,

            receivedBy: user.username,
            labId: user.labId,

            // Stage E: Chain of Custody (RC-19)
            custodyHandoverAt: custodyHandoverAt ? new Date(custodyHandoverAt).toISOString() : new Date().toISOString(),
            custodyCarrierName: custodyCarrierName.trim() || null,
            custodyTrackingNumber: custodyTrackingNumber.trim() || null,
            custodySenderSignature: custodySenderSignature.trim() || null,
            receivingOfficerSignature: custodyCounterSigned ? `CONFIRMED:${user.username}:${new Date().toISOString()}` : null,
            coc: {
                deliveredBy: custodyCarrierName.trim() || null,
                receivedBy: user.username,
                date: custodyHandoverAt ? new Date(custodyHandoverAt).toISOString() : new Date().toISOString(),
                trackingNumber: custodyTrackingNumber.trim() || null,
                senderSignature: custodySenderSignature.trim() || null,
                counterSigned: custodyCounterSigned
            },

            analysisGroupIds: selectedGroup ? [selectedGroup] : [],
            analysisAdditions: additions,
            analysisRemovals: removals,
            justification: removals.length > 0 ? justification : null,

            isWalkIn: mode === 'WALK_IN',
            projectId: mode === 'WALK_IN' ? null : (sessionProject || null),
            submitterDetails: (mode === 'WALK_IN' || sampleData?.isNew) ? submitter : null,
            samplingDetails: (mode === 'WALK_IN' || sampleData?.isNew) ? sampling : null,
            isDraft,

            // Stage A: Desk-Only Facts
            receivedMass: receivedMass ? parseFloat(receivedMass) : null,
            massWarningAcknowledged: !!massWarningAcknowledged,
            moistureOnArrival: moistureOnArrival || null,
            foreignMaterial: foreignMaterial.length > 0 ? foreignMaterial : null,
            intakePhotos: intakePhotos,
            isResubmission: !!isResubmission,

            // Stage B: Location & Provenance
            coordinates: sampling.coordinates || null,
            positionalUncertaintyM: sampling.positionalUncertaintyM ? parseFloat(sampling.positionalUncertaintyM) : null,
            locationSource: sampling.locationSource || sampling.captureMethod || null,
            compositeRadiusM: sampling.compositeRadiusM ? parseFloat(sampling.compositeRadiusM) : null
        };

        try {
            const res = await axios.post('/api/reception/intake', payload);
            if (isDraft) {
                playSuccessChime();
                showDialog({
                    type: 'success',
                    title: 'Draft Saved',
                    message: "Available as Draft. You can resume it by looking up " + res.data.id + " or " + scanCode
                });
                setMode(null);
                resetForm();
            } else {
                playSuccessChime();
                setResult(res.data);
                if (!res.data.rejected) {
                    setIsLabelPrintOpen(true);
                }
                localStorage.removeItem(AUTOSAVE_KEY);
            }
        } catch (err) {
            // Offline outbox fallback if disconnected or server unreachable
            if (!navigator.onLine || !err.response) {
                try {
                    await recordSyncOperation({
                        type: 'RECORD_INTAKE',
                        target: { originalId: scanCode },
                        payload
                    });
                    playNoticeChime();
                    setResult({
                        success: true,
                        labId: 'OFFLINE-' + scanCode,
                        originalId: scanCode,
                        status: 'RECEIVED_OFFLINE',
                        custodyHandoverAt: payload.custodyHandoverAt,
                        custodyCarrierName: payload.custodyCarrierName,
                        custodyTrackingNumber: payload.custodyTrackingNumber,
                        receivingOfficerName: user.name || user.username
                    });
                    showDialog({
                        type: 'info',
                        title: 'Offline Intake Queued',
                        message: `Intake for sample ${scanCode} queued locally in offline storage. It will synchronize automatically when online.`
                    });
                    localStorage.removeItem(AUTOSAVE_KEY);
                    setLoading(false);
                    return;
                } catch (queueErr) {
                    console.error('Failed to queue offline intake operation', queueErr);
                }
            }
            playErrorBuzz();
            setResult({ success: false, message: err.response?.data?.message || 'Intake failed' });
        }
        setLoading(false);
    };

    // --- RENDER ---

    // Drafts
    const [drafts, setDrafts] = useState([]);

    const fetchDrafts = async () => {
        try {
            const res = await axios.get('/api/samples', { params: { status: 'DRAFT', limit: 50, sort: 'updatedAt', order: 'desc' } });
            setDrafts(res.data.data || []);
        } catch (e) {
            console.error("Failed to fetch drafts", e);
        }
    };

    useEffect(() => {
        fetchDrafts();
    }, [mode]); // Re-fetch when mode changes (e.g. returning from a draft)

    // ... (rest of code)

    if (!mode) {
        return (
            <div className="p-4 md:p-6 max-w-6xl mx-auto min-h-[90vh] flex flex-col justify-center animate-in fade-in zoom-in duration-300" data-tour="reception-container">
                <div className="hidden md:block">
                    <WedgeModeBar
                        isWedgeMode={isWedgeMode}
                        onToggleWedgeMode={handleToggleWedgeMode}
                        wedgeSuffix={wedgeSuffix}
                        onChangeSuffix={handleChangeSuffix}
                        soundEnabled={soundEnabled}
                        onToggleSound={handleToggleSound}
                        onOpenShortcuts={() => setIsShortcutsOpen(true)}
                        autoRefocus={autoRefocus}
                        onToggleAutoRefocus={handleToggleAutoRefocus}
                    />
                </div>

                <div className="text-center mb-6 md:mb-10">
                    <h1 className="text-2xl md:text-4xl font-bold text-sf-text mb-2">{t('receptionConsole.consoleTitle', 'Reception Console')}</h1>
                    <p className="text-sf-muted">{t('receptionConsole.selectMode', 'Select intake mode or resume a draft')}</p>
                </div>

                <div className="grid md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12">
                    <button onClick={() => setMode('PROJECT')} className="p-6 md:p-8 bg-sf-surface rounded-2xl shadow-md border border-sf-divider hover:border-blue-500 hover:shadow-xl group transition-all text-left relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Layers size={100} />
                        </div>
                        <div className="relative z-10">
                            <div className="bg-blue-100 dark:bg-blue-900/40 w-14 h-14 rounded-2xl flex items-center justify-center mb-5 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                <Layers size={28} />
                            </div>
                            <h2 className="text-xl font-bold text-sf-text mb-1">{t('receptionConsole.projectSampleTitle', 'Project Sample')}</h2>
                            <p className="text-xs text-sf-muted">{t('receptionConsole.projectSampleDesc', 'Scheduled samples (SoilFER campaigns)')}</p>
                        </div>
                    </button>

                    <button onClick={() => {
                        setMode('WALK_IN');
                        setSessionProject(null); // Clear project context for generic walk-in
                        const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
                        setScanCode(`EXT-${randomId}`);
                        setSampleData({ originalId: `EXT-${randomId}`, isNew: true });
                    }} className="p-6 md:p-8 bg-sf-surface rounded-2xl shadow-md border border-sf-divider hover:border-purple-500 hover:shadow-xl group transition-all text-left relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <User size={100} />
                        </div>
                        <div className="relative z-10">
                            <div className="bg-purple-100 dark:bg-purple-900/40 w-14 h-14 rounded-2xl flex items-center justify-center mb-5 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                                <User size={28} />
                            </div>
                            <h2 className="text-xl font-bold text-sf-text mb-1">{t('receptionConsole.walkInSampleTitle', 'Walk-in Sample')}</h2>
                            <p className="text-xs text-sf-muted">{t('receptionConsole.walkInSampleDesc', 'Farmers & Individual walk-in clients')}</p>
                        </div>
                    </button>

                    <button onClick={() => setMode('CONSIGNMENT')} className="p-6 md:p-8 bg-sf-surface rounded-2xl shadow-md border border-sf-divider hover:border-emerald-500 hover:shadow-xl group transition-all text-left relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <PackageCheck size={100} />
                        </div>
                        <div className="relative z-10">
                            <div className="bg-emerald-100 dark:bg-emerald-950/40 w-14 h-14 rounded-2xl flex items-center justify-center mb-5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                                <PackageCheck size={28} />
                            </div>
                            <h2 className="text-xl font-bold text-sf-text mb-1">{t('receptionConsole.consignmentBatchTitle', 'Consignment Batch')}</h2>
                            <p className="text-xs text-sf-muted">{t('receptionConsole.consignmentBatchDesc', 'Couriers, manifests & bulk field campaigns')}</p>
                        </div>
                    </button>
                </div>

                {/* DRAFTS LIST */}
                <div className="bg-sf-surface rounded-2xl shadow-sm border border-sf-divider overflow-hidden flex-1 max-h-[400px] flex flex-col">
                    <div className="p-4 border-b border-sf-divider bg-sf-canvas flex justify-between items-center sticky top-0">
                        <h3 className="font-bold text-sf-text flex items-center gap-2">
                            <FileText size={18} /> {t('receptionConsole.incompleteIntakes', 'Incomplete Intakes (Drafts)')}
                        </h3>
                        <span className="text-xs font-bold bg-sf-raised text-sf-muted px-2 py-1 rounded-full border border-sf-divider">{drafts.length}</span>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-2">
                        {drafts.length === 0 ? (
                            <div className="text-center py-10 text-sf-muted">{t('receptionConsole.noDrafts', 'No drafts found.')}</div>
                        ) : (
                            drafts.map(d => (
                                <div key={d.id} className="flex items-center justify-between p-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl border border-transparent hover:border-blue-100 dark:hover:border-blue-800 transition-colors group cursor-pointer"
                                    onClick={() => {
                                        setScanCode(d.originalId);
                                        handleLookup(d.originalId);
                                    }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs">
                                            DFT
                                        </div>
                                        <div>
                                            <div className="font-bold text-sf-text flex items-center gap-2">
                                                {d.originalId}
                                                <span className="text-xs font-normal text-sf-muted bg-sf-canvas px-1.5 py-0.5 rounded capitalize border border-sf-divider">
                                                    {(d.receptionData?.isWalkIn || (!d.projectId && !d.projectCode)) ? 'Walk-in' : 'Project'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-sf-muted">
                                                {new Date(d.updatedAt || d.createdAt).toLocaleString()} • {d.receptionData?.submitterDetails?.name || 'Unknown Submitter'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDiscard(d.id);
                                            }}
                                            className="text-sf-muted hover:text-red-600 font-bold text-sm md:opacity-0 group-hover:opacity-100 transition-opacity bg-sf-surface px-3 py-1.5 rounded border border-sf-divider hover:border-red-200 dark:hover:border-red-700 shadow-sm touch-target"
                                        >
                                            {t('receptionConsole.discard', 'Discard')}
                                        </button>
                                        <button className="text-blue-600 dark:text-blue-400 font-bold text-sm md:opacity-0 group-hover:opacity-100 transition-opacity bg-sf-surface px-3 py-1.5 rounded border border-blue-200 dark:border-blue-800 shadow-sm touch-target">
                                            {t('receptionConsole.resume', 'Resume')}
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <KeyboardShortcutsModal
                    isOpen={isShortcutsOpen}
                    onClose={() => setIsShortcutsOpen(false)}
                />
            </div>
        );
    }

    if (mode === 'CONSIGNMENT') {
        return (
            <BatchIntake
                user={user}
                availableProjects={availableProjects}
                analysisGroups={groups}
                onBack={() => setMode(null)}
                onSuccess={() => {
                    fetchDrafts();
                }}
            />
        );
    }

    const handleSelectProject = (proj) => {
        setSessionProject(proj.id);
        if (proj.defaultAnalysisBundle) {
            setSelectedGroup(proj.defaultAnalysisBundle);
        }
    };

    if (mode === 'PROJECT' && !sessionProject) {
        return (
            <div className="p-4 md:p-10 max-w-2xl mx-auto animate-in slide-in-from-right" data-tour="reception-container">
                <button onClick={() => setMode(null)} className="flex items-center gap-2 text-sf-muted hover:text-sf-text mb-6 font-medium"><ArrowLeft size={20} /> Back</button>
                <div className="bg-sf-surface p-8 rounded-xl shadow-xl border border-sf-divider">
                    <h2 className="text-2xl font-bold text-sf-text mb-6">{t('receptionConsole.selectProjectSession', 'Select Project Session')}</h2>
                    <div className="space-y-3">
                        {availableProjects.filter(p => p.status === 'ACTIVE').map(p => (
                            <button key={p.id} onClick={() => handleSelectProject(p)} className="w-full text-left p-4 border border-sf-divider bg-sf-surface rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col group">
                                <div className="flex justify-between items-start">
                                    <span className="font-bold text-lg text-sf-text group-hover:text-blue-700 dark:group-hover:text-blue-400">{p.name || p.id}</span>
                                    <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded uppercase tracking-wider">Active</span>
                                </div>
                                <div className="flex gap-3 mt-1">
                                    <div className="text-[10px] text-sf-muted font-bold uppercase tracking-widest">{p.code}</div>
                                    <div className="text-[10px] text-sf-muted font-bold uppercase tracking-widest">• {p.projectType === 'TEMPLATE_PREDEFINED_IDS' ? t('receptionConsole.template', 'Template') : p.projectType === 'KOBO_LINKED' ? t('receptionConsole.koboLinked', 'Kobo Linked') : t('receptionConsole.openIntake', 'Open Intake')}</div>
                                    {p.defaultAnalysisBundle && (
                                        <div className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">• Auto-Bundle: {p.defaultAnalysisBundle}</div>
                                    )}
                                </div>
                            </button>
                        ))}
                        {availableProjects.filter(p => p.status === 'ACTIVE').length === 0 && (
                            <div className="text-center py-10">
                                <p className="text-sf-muted font-medium">{t('receptionConsole.noActiveProjects', 'No active project sessions found.')}</p>
                                <p className="text-xs text-sf-muted mt-1">{t('receptionConsole.activeProjectsRequired', 'Projects must be ACTIVE to accept samples.')}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto" data-tour="reception-container">
            {/* STAGE D: WEDGE SCANNER TOOLBAR (RC-16) - Desktop Workstations */}
            <div className="hidden md:block">
                <WedgeModeBar
                    isWedgeMode={isWedgeMode}
                    onToggleWedgeMode={handleToggleWedgeMode}
                    wedgeSuffix={wedgeSuffix}
                    onChangeSuffix={handleChangeSuffix}
                    soundEnabled={soundEnabled}
                    onToggleSound={handleToggleSound}
                    onOpenShortcuts={() => setIsShortcutsOpen(true)}
                    autoRefocus={autoRefocus}
                    onToggleAutoRefocus={handleToggleAutoRefocus}
                />
            </div>

            {/* HEADER */}
            <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-3 mb-4 sm:mb-6 bg-sf-raised border border-sf-divider text-sf-text p-3 sm:p-4 rounded-xl shadow-md">
                <div className="flex items-center gap-3 sm:gap-4">
                    <button onClick={() => {
                        showDialog({
                            type: 'confirm',
                            title: t('reception.endSessionTitle', 'End Session?'),
                            message: t('reception.endSessionMsg', 'Are you sure you want to end this reception session? Any unsaved changes will be lost.'),
                            confirmText: t('reception.endSessionConfirm', 'End Session'),
                            onConfirm: () => {
                                setMode(null);
                                setSessionProject(null);
                                resetForm();
                            }
                        });
                    }} className="bg-sf-surface hover:bg-sf-canvas border border-sf-divider p-2 rounded-lg transition-colors text-sf-text touch-target">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="text-[10px] sm:text-xs text-sf-muted uppercase font-bold tracking-wider">{t('reception.sessionActive', 'Session Active')}</div>
                        <div className="text-base sm:text-lg font-bold flex items-center gap-2">
                            {mode === 'PROJECT' || sessionProject ? <><Layers size={18} /> {t('common.project', 'Project')}: {sessionProject}</> : <><User size={18} /> {t('reception.walkInReception', 'Walk-in Reception')}</>}
                        </div>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <div className="text-[10px] sm:text-xs text-sf-muted">{t('reception.operator', 'Operator')} ({user.labId || 'Global'})</div>
                    <div className="text-sm sm:text-base font-medium">{user.name || user.username}</div>
                </div>
            </div>

            {/* LOOKUP with Autocomplete */}
            <div className="bg-sf-surface p-4 sm:p-6 rounded-xl shadow-sm border border-sf-divider mb-4 sm:mb-6 relative">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <div className="flex-1 relative">
                        <input
                            ref={scanInputRef}
                            value={scanCode}
                            onChange={(e) => setScanCode(e.target.value)}
                            placeholder={mode === 'PROJECT' ?
                                (availableProjects.find(p => p.id === sessionProject)?.projectType === 'TEMPLATE_PREDEFINED_IDS'
                                    ? t('reception.searchManifest', 'Search manifest by Sample ID...')
                                    : t('reception.scanOrEnter', 'Scan or Enter Sample ID to add...'))
                                : t('reception.enterSampleId', 'Enter Sample ID')}
                            className={`w-full p-3 border rounded-lg focus:ring-2 font-mono text-lg transition-all ${
                                isWedgeMode 
                                    ? 'border-amber-400 focus:ring-amber-500 bg-amber-50/20 dark:bg-amber-950/10 text-sf-text' 
                                    : 'border-sf-divider bg-sf-surface text-sf-text focus:ring-blue-500'
                            }`}
                            onKeyDown={e => {
                                const isEnterMatch = (wedgeSuffix === 'ENTER' || wedgeSuffix === 'BOTH') && e.key === 'Enter';
                                const isTabMatch = (wedgeSuffix === 'TAB' || wedgeSuffix === 'BOTH') && e.key === 'Tab';

                                if (isEnterMatch || isTabMatch) {
                                    e.preventDefault();
                                    setShowAutocomplete(false);
                                    handleLookup();
                                } else if (e.key === 'Escape') {
                                    setShowAutocomplete(false);
                                }
                            }}
                            onFocus={() => {
                                if (!isWedgeMode) {
                                    const proj = availableProjects.find(p => p.id === sessionProject);
                                    if (scanCode.length >= 2 && mode === 'PROJECT' && proj?.projectType === 'TEMPLATE_PREDEFINED_IDS' && autocompleteResults.length > 0) {
                                        setShowAutocomplete(true);
                                    }
                                }
                            }}
                        />

                        {/* Autocomplete Dropdown */}
                        {showAutocomplete && mode === 'PROJECT' && (
                            <div className="absolute top-full left-0 right-0 bg-sf-surface border border-sf-divider rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto mt-1">
                                {isSearching ? (
                                    <div className="p-4 text-center text-sf-muted">{t('common.searching', 'Searching...')}</div>
                                ) : (
                                    null
                                )}
                                {!isSearching && autocompleteResults.length === 0 ? (
                                    <div className="p-4 text-center text-sf-muted">{t('reception.noExpectedSamples', 'No EXPECTED samples found')}</div>
                                ) : (
                                    autocompleteResults.map(sample => (
                                        <div
                                            key={sample.id}
                                            onClick={() => handleSelectAutocomplete(sample)}
                                            className="p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer border-b last:border-0 border-sf-divider flex items-center justify-between group"
                                        >
                                            <div>
                                                <div className="font-mono font-bold text-sf-text">{sample.originalId}</div>
                                                <div className="text-xs text-sf-muted">
                                                    {sample.projectCode} • {sample.location || sample.country || 'Unknown Location'}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {sample.coordinates && (
                                                    <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">📍 GPS</span>
                                                )}
                                                <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full uppercase">
                                                    {sample.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button
                            onClick={() => setShowScanner(true)}
                            className="flex-1 sm:flex-none justify-center bg-sf-surface text-sf-muted hover:text-sf-text p-3 rounded-lg hover:bg-sf-canvas transition-colors border border-sf-divider flex items-center gap-2 touch-target"
                            title={t('reception.scan', 'Scan')}
                        >
                            <Camera size={20} />
                            <span className="font-bold">{t('reception.scan', 'Scan')}</span>
                        </button>
                        <button
                            onClick={() => { setShowAutocomplete(false); handleLookup(); }}
                            disabled={!scanCode}
                            className="flex-1 sm:flex-none justify-center bg-blue-600 text-white px-5 sm:px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 touch-target"
                        >
                            {t('reception.lookUp', 'Look Up')}
                        </button>
                    </div>
                </div>

                {mode === 'PROJECT' && (
                    <div className="mt-3 flex items-center justify-between">
                        <div className="text-xs text-sf-muted">
                            {availableProjects.find(p => p.id === sessionProject)?.projectType === 'TEMPLATE_PREDEFINED_IDS'
                                ? t('receptionConsole.scheduledNotice', '💡 Scheduled project: Verification against manifest required.')
                                : t('receptionConsole.openIntakeNotice', '💡 Open intake: Register samples manually as they arrive.')}
                        </div>
                        <button
                            onClick={() => {
                                // DON'T switch mode, just set a new sample data
                                const proj = availableProjects.find(p => p.id === sessionProject);
                                const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
                                setScanCode(`EXT-${randomId}`);
                                setSampleData({
                                    originalId: `EXT-${randomId}`,
                                    isNew: true,
                                    projectId: proj?.id,
                                    projectCode: proj?.code
                                });
                            }}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 text-sm font-bold flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-lg transition-colors"
                        >
                            <Plus size={14} /> {t('receptionConsole.newManualId', 'New Manual ID')}
                        </button>
                    </div>
                )}
            </div>

            {/* DUPLICATE / RE-SUBMISSION DETECTION BANNER (RC-04) */}
            {duplicateWarning && (
                <div className="bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-400 dark:border-amber-600 rounded-xl p-4 mb-6 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={24} />
                            <div>
                                <h4 className="font-bold text-amber-900 dark:text-amber-200 text-base flex items-center gap-2">
                                    <span>{t('receptionConsole.duplicateDetected', `Prior Receipt Detected for ${duplicateWarning.sample.originalId}`, { id: duplicateWarning.sample.originalId })}</span>
                                    {duplicateWarning.sample.labId && (
                                        <span className="font-mono text-xs bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 px-2 py-0.5 rounded">
                                            Lab ID: {duplicateWarning.sample.labId}
                                        </span>
                                    )}
                                </h4>
                                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                                    {t('receptionConsole.duplicatePreviouslyReceived', 'This sample ID was previously received on')}{' '}
                                    <strong>{duplicateWarning.sample.receptionDate ? new Date(duplicateWarning.sample.receptionDate).toLocaleDateString() : 'a prior date'}</strong>
                                    {' '}(Status: <span className="font-bold uppercase">{duplicateWarning.sample.status}</span>
                                    {duplicateWarning.sample.assignedLab ? ` • Lab: ${duplicateWarning.sample.assignedLab}` : ''}).
                                </p>
                                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                                    {t('receptionConsole.duplicateResubmissionHint', 'If this is a physical re-submission for re-testing or supplementary analyses, confirm as a Re-submission.')}
                                </p>
                                <div className="mt-3 flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsResubmission(true);
                                            setDuplicateWarning(null);
                                        }}
                                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                                    >
                                        {t('receptionConsole.confirmResubmission', '✓ Confirm as Re-submission')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDuplicateWarning(null);
                                            resetForm();
                                        }}
                                        className="px-3 py-1.5 bg-sf-surface border border-sf-divider text-sf-text rounded-lg text-xs font-medium hover:bg-sf-canvas transition-colors"
                                    >
                                        {t('receptionConsole.cancelClearId', 'Cancel / Clear ID')}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setDuplicateWarning(null)}
                            className="text-amber-500 hover:text-amber-700"
                            title="Dismiss"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            {sampleData && !result && (
                <>
                    {/* MOBILE STEP NAVIGATION (Phone viewports < md) */}
                    <div className="md:hidden flex items-center justify-between gap-1 p-1 bg-sf-raised rounded-xl border border-sf-divider mb-4 sticky top-14 z-20 shadow-sm">
                        {[
                            { id: 'identify', label: t('receptionConsole.stepIdentify', '1. ID & Field'), icon: Layers },
                            { id: 'condition', label: t('receptionConsole.stepCondition', '2. Condition'), icon: Scale },
                            { id: 'analyses', label: t('receptionConsole.stepAnalyses', '3. Analyses'), icon: FileText },
                            { id: 'receipt', label: t('receptionConsole.stepReceipt', '4. Handover'), icon: ShieldCheck }
                        ].map(step => {
                            const Icon = step.icon;
                            const isActive = mobileStep === step.id;
                            return (
                                <button
                                    key={step.id}
                                    type="button"
                                    onClick={() => setMobileStep(step.id)}
                                    className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold transition-all text-center flex flex-col items-center gap-0.5 touch-target ${
                                        isActive
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'text-sf-muted hover:text-sf-text hover:bg-sf-surface'
                                    }`}
                                >
                                    <Icon size={14} />
                                    <span className="text-[10px] leading-tight truncate">{step.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="grid lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">

                        {/* LEFT COLUMN: SAMPLE DATA */}
                        <div className="space-y-6">
                            {/* STEP 1: IDENTIFY & FIELD PROVENANCE */}
                            <div className={`${mobileStep === 'identify' ? 'block space-y-6' : 'hidden'} md:block md:space-y-6`}>
                                {/* Map View - Persistent for Project mode (RC-09) */}
                                {mode !== 'WALK_IN' && !sampleData?.isNew && (
                                    <div className="bg-sf-surface p-4 rounded-xl border border-sf-divider shadow-sm animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="font-bold text-sf-text flex items-center gap-2 text-sm">
                                                <MapPin size={16} /> Location Preview
                                            </h3>
                                            {resolvedCoordinates && (
                                                <span className="text-[11px] font-mono text-sf-muted">
                                                    {parseFloat(resolvedCoordinates.lat).toFixed(4)}&deg;, {parseFloat(resolvedCoordinates.lng).toFixed(4)}&deg;
                                                </span>
                                            )}
                                        </div>
                                        <SampleMap
                                            coordinates={resolvedCoordinates}
                                            title={sampleData?.originalId || 'Sample Site'}
                                            uncertaintyM={resolvedCoordinates?.accuracy || resolvedCoordinates?.positionalUncertaintyM}
                                        />
                                    </div>
                                )}

                                {/* Batch Geometry Outlier Warning Alert (RC-10) */}
                                {geometryOutlierWarning && (
                                    <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200 shadow-sm">
                                        <AlertTriangle size={18} className="text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                                        <div>
                                            <strong className="block font-bold mb-0.5">Spatial Outlier Detected (RC-10)</strong>
                                            <p className="leading-relaxed">{geometryOutlierWarning}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Show Manual Form for Walk-ins OR Field Provenance Card for Project Samples (RC-09) */}
                                {(mode === 'WALK_IN' || sampleData?.isNew) ? (
                                    <WalkInForm
                                        submitter={submitter} setSubmitter={setSubmitter}
                                        sampling={sampling} setSampling={setSampling}
                                        groups={groups}
                                        onPurposeSelect={handlePurposeSelect}
                                        errors={validationErrors}
                                        labCoordinates={labCoordinates}
                                    />
                                ) : (
                                    <FieldProvenanceCard
                                        sampleData={sampleData}
                                        coordinates={resolvedCoordinates}
                                    />
                                )}

                                {/* Mobile Next Action */}
                                <div className="md:hidden pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setMobileStep('condition')}
                                        className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 touch-target"
                                    >
                                        <span>Next: Condition & Evidence</span>
                                        <span>&rarr;</span>
                                    </button>
                                </div>
                            </div>

                            {/* STEP 3: ANALYSIS SELECTION */}
                            <div className={`${mobileStep === 'analyses' ? 'block' : 'hidden'} md:block`}>
                                <div
                                    ref={analysisSectionRef}
                            className={`bg-sf-surface p-6 rounded-xl border shadow-sm transition-all duration-500 ${analysisHighlight
                                ? 'border-blue-400 ring-2 ring-blue-200 shadow-blue-100 shadow-lg'
                                : validationErrors.some(e => e.key === 'analyses')
                                    ? 'border-red-400 ring-1 ring-red-200'
                                    : 'border-sf-divider'
                                }`}
                        >
                            <h3 className="font-bold text-sf-text mb-4 flex items-center gap-2">
                                <Droplet size={20} /> Requested Analysis
                                <InfoTooltip text="Choose a predefined package of tests (Bundle) or add individual tests as required by the client." />
                            </h3>

                            <label className="block text-sm font-semibold text-sf-text mb-2">
                                Select Bundle
                                <InfoTooltip text="Bundles are optimized groups of analyses defined for specific project needs." />
                            </label>
                            <select
                                value={selectedGroup}
                                onChange={e => { setSelectedGroup(e.target.value); setRemovals([]); setAdditions([]); }}
                                className="w-full p-3 border rounded bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 font-bold text-blue-800 dark:text-blue-300 mb-4"
                            >
                                <option value="">-- No Bundle --</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>

                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-sf-text mb-1">Add Individual Test</label>
                                <div className="flex gap-2 relative">
                                    <input value={searchAnalysis} onChange={e => setSearchAnalysis(e.target.value)} placeholder="Search analysis code..." className="flex-1 p-2 border border-sf-divider rounded bg-sf-surface text-sf-text" />
                                    {searchAnalysis && (
                                        <div className="absolute top-full left-0 w-full bg-sf-surface border border-sf-divider shadow-lg rounded z-10 max-h-40 overflow-y-auto">
                                            {analyses.filter(a => a.orderable && !effectiveList.includes(a.code) && a.name.toLowerCase().includes(searchAnalysis.toLowerCase())).map(a => (
                                                <div key={a.code} onClick={() => { toggleAnalysis(a.code); setSearchAnalysis(''); }} className="p-2 hover:bg-sf-raised cursor-pointer text-sm text-sf-text">
                                                    {getAnalysisDisplayName(a.code, a.name)}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 min-h-[40px] bg-sf-canvas p-3 rounded border border-sf-divider inner-shadow">
                                {effectiveList.length === 0 && <span className="text-sf-muted text-sm italic">No analyses selected</span>}
                                {effectiveList.map(code => {
                                    const group = groups.find(g => g.id === selectedGroup);
                                    const isGroup = group?.analyses.includes(code);
                                    return (
                                        <div key={code} className={`flex items-center gap-1 px-3 py-1 rounded text-sm ${isGroup ? 'bg-sf-surface border border-sf-divider shadow-sm text-sf-text' : 'bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-300'}`}>
                                            <span className="font-bold">{code}</span>
                                            <button onClick={() => toggleAnalysis(code)} className="text-sf-muted hover:text-red-500 ml-1"><XCircle size={14} /></button>
                                        </div>
                                    )
                                })}
                                {removals.map(code => (
                                    <div key={code} className="flex items-center gap-1 px-2 py-1 rounded border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-500 text-xs line-through">
                                        <span>{code}</span>
                                        <button onClick={() => toggleAnalysis(code)} className="text-sf-muted"><Plus size={12} /></button>
                                    </div>
                                ))}
                            </div>

                            {removals.length > 0 && (
                                <textarea
                                    value={justification}
                                    onChange={e => setJustification(e.target.value)}
                                    placeholder="Required: Reason for removing tests..."
                                    className="w-full mt-3 p-2 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 rounded text-sm text-sf-text"
                                />
                            )}
                        </div>

                        {/* Mobile Step 3 Navigation */}
                        <div className="md:hidden pt-4 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setMobileStep('condition')}
                                className="py-3 px-4 bg-sf-surface border border-sf-divider text-sf-text font-bold rounded-xl hover:bg-sf-canvas transition-colors touch-target"
                            >
                                &larr; Back
                            </button>
                            <button
                                type="button"
                                onClick={() => setMobileStep('receipt')}
                                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition-all flex items-center justify-center gap-2 touch-target"
                            >
                                <span>Next: Custody & Submit</span>
                                <span>&rarr;</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: DESK FACTS, COMPLIANCE & SUBMIT */}
                <div className="space-y-6">

                    {/* STEP 2: CONDITION, FACTS & COMPLIANCE */}
                    <div className={`${mobileStep === 'condition' ? 'block space-y-6' : 'hidden'} md:block md:space-y-6`}>

                        {/* PHYSICAL ARRIVAL STATE & DESK FACTS (RC-01, RC-02, RC-03) */}
                        <div className="bg-sf-surface p-6 rounded-xl border border-sf-divider shadow-sm space-y-5">
                            <div className="flex items-center justify-between border-b border-sf-divider pb-3">
                                <h3 className="font-bold text-sf-text flex items-center gap-2">
                                    <Scale size={20} className="text-indigo-600 dark:text-indigo-400" />
                                    <span>Physical Arrival State & Desk Facts</span>
                                    <InfoTooltip text="Desk-level observations recorded as the physical sample bag arrives at reception, prior to drying or grinding." />
                                </h3>
                                {isResubmission && (
                                    <span className="text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                                        Re-submission
                                    </span>
                                )}
                            </div>

                            {/* RC-01: Received Sample Mass & Live Sufficiency Meter */}
                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-sm font-semibold text-sf-text flex items-center gap-1.5">
                                        Received Sample Mass (g) *
                                        <InfoTooltip text="Weigh physical bag on desk scale. System verifies sufficient material for ordered tests + 100g standard archive retention." />
                                    </label>
                                    <span className="text-xs font-mono text-sf-muted">
                                        Req: {totalRequiredMass}g ({totalAnalyticalMass}g tests + {retentionBuffer}g archive)
                                    </span>
                                </div>
                                <div className="relative">
                                    <input
                                        data-field-key="receivedMass"
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={receivedMass}
                                        onChange={(e) => {
                                            setReceivedMass(e.target.value);
                                            setMassWarningAcknowledged(false);
                                        }}
                                        placeholder="e.g. 500.0"
                                        className={`w-full p-2.5 pl-3 pr-10 border rounded-lg font-mono text-base outline-none transition-all ${
                                            validationErrors.some(e => e.key === 'receivedMass')
                                                ? 'border-red-400 ring-2 ring-red-200 bg-red-50/50 dark:bg-red-900/20 text-sf-text'
                                                : isMassDeficient
                                                    ? 'border-amber-400 ring-1 ring-amber-200 bg-amber-50/30 dark:bg-amber-900/20 text-sf-text'
                                                    : parsedReceivedMass >= totalRequiredMass && totalRequiredMass > 0
                                                        ? 'border-emerald-400 ring-1 ring-emerald-200 bg-emerald-50/30 dark:bg-emerald-900/20 text-sf-text'
                                                        : 'border-sf-divider bg-sf-surface text-sf-text'
                                        }`}
                                    />
                                    <span className="absolute right-3 top-2.5 font-bold text-sf-muted text-sm">g</span>
                                </div>

                                {/* Live Sufficiency Meter */}
                                {parsedReceivedMass > 0 && totalRequiredMass > 0 && (
                                    <div className="space-y-2 mt-2">
                                        <div className="h-2 w-full bg-sf-canvas rounded-full overflow-hidden flex">
                                            <div
                                                className={`h-full transition-all duration-300 ${
                                                    isMassDeficient ? 'bg-amber-500' : 'bg-emerald-500'
                                                }`}
                                                style={{ width: `${Math.min(100, Math.round((parsedReceivedMass / totalRequiredMass) * 100))}%` }}
                                            />
                                        </div>

                                        {isMassDeficient ? (
                                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 space-y-2">
                                                <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300 text-xs">
                                                    <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <span className="font-bold">Mass Deficit: {massDeficit}g deficit.</span>
                                                        <p className="text-sf-muted mt-0.5">
                                                            Required: {totalRequiredMass}g ({totalAnalyticalMass}g for {effectiveList.length} test{effectiveList.length === 1 ? '' : 's'} + {retentionBuffer}g retention buffer). Received: {parsedReceivedMass}g.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="text-[11px] text-sf-muted border-t border-amber-200 dark:border-amber-800/50 pt-1.5 flex flex-wrap gap-1.5 items-center">
                                                    <span className="font-semibold">Tests at risk:</span>
                                                    {massRequirementBreakdown.map(b => (
                                                        <span key={b.code} className="bg-sf-surface px-1.5 py-0.5 rounded border border-sf-divider font-mono text-[10px] text-sf-text">
                                                            {getAnalysisDisplayName(b.code)}: {b.massRequired}g
                                                        </span>
                                                    ))}
                                                </div>

                                                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={massWarningAcknowledged}
                                                        onChange={(e) => setMassWarningAcknowledged(e.target.checked)}
                                                        className="w-4 h-4 rounded text-amber-600 accent-amber-600"
                                                    />
                                                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                                                        Acknowledge analytical mass deficit & proceed with intake at risk
                                                    </span>
                                                </label>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                                                <CheckCircle size={14} className="text-emerald-600" />
                                                <span>Sufficient analytical mass ({parsedReceivedMass}g available, surplus of {Math.round((parsedReceivedMass - totalRequiredMass) * 10) / 10}g).</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* RC-02: Moisture State on Arrival */}
                            <div>
                                <label className="text-sm font-semibold text-sf-text mb-1.5 flex items-center gap-1.5">
                                    <Droplets size={16} className="text-blue-500" /> Moisture on Arrival
                                    <InfoTooltip text="Desk assessment of raw sample moisture prior to lab drying protocol." />
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { id: 'DRY', label: 'Dry', hint: 'Air-dry / Crumbles' },
                                        { id: 'MOIST', label: 'Moist', hint: 'Damp to touch' },
                                        { id: 'WET', label: 'Wet', hint: 'Sticky / Clumpy' },
                                        { id: 'SATURATED', label: 'Saturated', hint: 'Slurry / Free water' }
                                    ].map(m => {
                                        const isSelected = moistureOnArrival === m.id;
                                        return (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setMoistureOnArrival(m.id)}
                                                className={`p-2 rounded-lg border text-center transition-all ${
                                                    isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-bold'
                                                        : 'bg-sf-surface border-sf-divider text-sf-text hover:border-blue-400'
                                                }`}
                                            >
                                                <div className="text-xs font-semibold">{m.label}</div>
                                                <div className={`text-[10px] truncate ${isSelected ? 'text-blue-100' : 'text-sf-muted'}`}>{m.hint}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* RC-02: Foreign Material Inclusions */}
                            <div>
                                <label className="text-sm font-semibold text-sf-text mb-1.5 flex items-center gap-1.5">
                                    <Layers size={16} className="text-amber-500" /> Foreign Material Inclusions
                                    <InfoTooltip text="Check any non-soil inclusions visible in the sample bag upon receipt." />
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { id: 'stones', label: 'Stones / Gravel' },
                                        { id: 'roots', label: 'Roots / Plant Debris' },
                                        { id: 'plastic', label: 'Plastic / Synthetics' },
                                        { id: 'other', label: 'Other Inclusions' },
                                        { id: 'removed', label: 'Foreign Material Removed' }
                                    ].map(item => {
                                        const isChecked = foreignMaterial.includes(item.id);
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => {
                                                    if (isChecked) {
                                                        setForeignMaterial(foreignMaterial.filter(f => f !== item.id));
                                                    } else {
                                                        setForeignMaterial([...foreignMaterial, item.id]);
                                                    }
                                                }}
                                                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                                    isChecked
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                        : 'bg-sf-surface border-sf-divider text-sf-text hover:border-sf-muted'
                                                }`}
                                            >
                                                <span>{isChecked ? '✓' : '+'}</span>
                                                <span>{item.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* RC-03: Intake Photographs */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm font-semibold text-sf-text flex items-center gap-1.5">
                                        <Camera size={16} className="text-purple-500" /> Intake Photographs ({intakePhotos.length})
                                        <InfoTooltip text="Upload photos of bag condition, legible field labels, physical defects, or bag tags." />
                                    </label>
                                    <label className="cursor-pointer bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700 px-3 py-1 rounded-lg text-xs font-bold hover:bg-purple-100 dark:hover:bg-purple-900/50 flex items-center gap-1.5 transition-colors">
                                        {uploadingPhoto ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                                        <span>{uploadingPhoto ? 'Uploading...' : 'Add Photo'}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            disabled={uploadingPhoto}
                                            onChange={handlePhotoUpload}
                                        />
                                    </label>
                                </div>

                                {intakePhotos.length > 0 ? (
                                    <div className="grid grid-cols-4 gap-2 pt-1">
                                        {intakePhotos.map((url, idx) => (
                                            <div key={idx} className="relative group rounded-lg overflow-hidden border border-sf-divider aspect-video bg-sf-canvas shadow-sm">
                                                <img src={url} alt={`Intake ${idx + 1}`} className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePhoto(idx)}
                                                    className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
                                                    title="Remove"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-sf-muted italic">No intake photos attached yet.</p>
                                )}
                            </div>
                        </div>

                        <div className="bg-sf-surface p-6 rounded-xl border border-sf-divider shadow-sm">
                            <ComplianceChecklist
                                value={checklistData}
                                onChange={setChecklistData}
                                onNonConformance={(checked) => setChecklistData(prev => ({ ...prev, nonConformance: checked }))}
                                isWalkIn={mode === 'WALK_IN'}
                                showIncomplete={validationErrors.some(e => e.key === 'compliance')}
                                photos={intakePhotos}
                                onUploadPhoto={handlePhotoUpload}
                                onRemovePhoto={handleRemovePhoto}
                                uploadingPhoto={uploadingPhoto}
                            />
                        </div>

                        {/* Mobile Step 2 Navigation */}
                        <div className="md:hidden pt-2 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setMobileStep('identify')}
                                className="py-3 px-4 bg-sf-surface border border-sf-divider text-sf-text font-bold rounded-xl hover:bg-sf-canvas transition-colors touch-target"
                            >
                                &larr; Back
                            </button>
                            <button
                                type="button"
                                onClick={() => setMobileStep('analyses')}
                                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition-all flex items-center justify-center gap-2 touch-target"
                            >
                                <span>Next: Analyses Selection</span>
                                <span>&rarr;</span>
                            </button>
                        </div>
                    </div>

                    {/* STEP 4: CHAIN OF CUSTODY, NOTES & SUBMIT */}
                    <div className={`${mobileStep === 'receipt' ? 'block space-y-6' : 'hidden'} md:block md:space-y-6`}>
                        {/* Mobile Back to Analyses button */}
                        <div className="md:hidden pb-1">
                            <button
                                type="button"
                                onClick={() => setMobileStep('analyses')}
                                className="text-xs text-sf-muted hover:text-sf-text font-semibold flex items-center gap-1 touch-target"
                            >
                                &larr; Return to Step 3: Analyses
                            </button>
                        </div>

                        {/* STAGE E: CHAIN OF CUSTODY & VERIFICATION (RC-19) */}
                        <div className="bg-sf-surface p-6 rounded-xl border border-sf-divider shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-sf-divider pb-3">
                                <h3 className="font-bold text-sf-text flex items-center gap-2">
                                    <ShieldCheck size={20} className="text-indigo-600 dark:text-indigo-400" />
                                    <span>Chain of Custody & Physical Handover</span>
                                </h3>
                                <span className="text-[10px] font-mono uppercase bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800 font-semibold">
                                    RC-19 Immutable Handover
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-sf-text mb-1 flex items-center gap-1">
                                        <Clock size={13} className="text-sf-muted" />
                                        <span>Handover Timestamp</span>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={custodyHandoverAt}
                                        onChange={e => setCustodyHandoverAt(e.target.value)}
                                        className="w-full p-2.5 text-sm bg-sf-canvas border border-sf-divider text-sf-text rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        title="Physical date and time the sample was physically handed over at desk"
                                    />
                                    <span className="text-[10px] text-sf-muted block mt-0.5">Physical custody handover (distinct from entry time)</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-sf-text mb-1">
                                        Carrier / Delivered By
                                    </label>
                                    <input
                                        type="text"
                                        value={custodyCarrierName}
                                        onChange={e => setCustodyCarrierName(e.target.value)}
                                        placeholder="Courier, driver, extension agent, or client"
                                        className="w-full p-2.5 text-sm bg-sf-canvas border border-sf-divider text-sf-text rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-sf-text mb-1">
                                        Waybill / Tracking / Delivery Note #
                                    </label>
                                    <input
                                        type="text"
                                        value={custodyTrackingNumber}
                                        onChange={e => setCustodyTrackingNumber(e.target.value)}
                                        placeholder="e.g. WB-992834, DN-2026-04"
                                        className="w-full p-2.5 text-sm bg-sf-canvas border border-sf-divider text-sf-text rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-sf-text mb-1">
                                        Deliverer / Submitter Signature Confirmation
                                    </label>
                                    <input
                                        type="text"
                                        value={custodySenderSignature}
                                        onChange={e => setCustodySenderSignature(e.target.value)}
                                        placeholder="Printed name or delivery signature token"
                                        className="w-full p-2.5 text-sm bg-sf-canvas border border-sf-divider text-sf-text rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Receiving Officer Counter-Signature */}
                            <div className="bg-sf-canvas p-3 rounded-lg border border-sf-divider flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
                                        {user?.username ? user.username.slice(0, 2).toUpperCase() : 'RO'}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-sf-text">
                                            Receiving Officer: <span className="text-indigo-600 dark:text-indigo-400">{user?.name || user?.username}</span> ({user?.labId || 'Desk'})
                                        </div>
                                        <div className="text-[11px] text-sf-muted">Authenticated custody receiver counter-signature</div>
                                    </div>
                                </div>
                                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-sf-text">
                                    <input
                                        type="checkbox"
                                        checked={custodyCounterSigned}
                                        onChange={e => setCustodyCounterSigned(e.target.checked)}
                                        className="rounded border-sf-divider text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                    />
                                    <span>Officer Sign-Off Confirmed</span>
                                </label>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-sf-text mb-1">
                                    General Reception & Sample Notes
                                </label>
                                <textarea
                                    value={intakeNotes}
                                    onChange={e => setIntakeNotes(e.target.value)}
                                    placeholder="Enter physical observations, special handling notes, or delivery observations..."
                                    className="w-full p-2.5 border border-sf-divider rounded-lg bg-sf-canvas text-sf-text h-20 resize-none text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>
                        </div>


                        {validationErrors.length > 0 && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-2 animate-in fade-in slide-in-from-top-2">
                                <p className="text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-1.5">
                                    <AlertTriangle size={14} />
                                    {validationErrors.length} required {validationErrors.length === 1 ? 'field' : 'fields'} missing
                                </p>
                            </div>
                        )}
                        {/* Sticky Bottom Submit Bar */}
                        <div className="sticky bottom-[calc(4.5rem+var(--sf-sab))] md:bottom-4 z-10 bg-sf-surface/95 backdrop-blur-md p-3 rounded-2xl shadow-lg shadow-black/10 border border-sf-divider">
                            <div className="flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3">
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button
                                        onClick={() => handleDiscard()}
                                        disabled={loading}
                                        className="flex-1 sm:flex-none py-3 px-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 transition-all flex items-center justify-center gap-1.5 active:scale-95 touch-target text-xs"
                                    >
                                        <XCircle size={16} /> {t('reception.discard', 'Discard')}
                                    </button>

                                    <button
                                        onClick={() => handleSubmit('ACCEPTED', true)}
                                        disabled={loading}
                                        className="flex-1 sm:flex-none py-3 px-4 bg-sf-raised text-sf-text font-bold rounded-xl border border-sf-divider hover:bg-sf-canvas transition-all flex items-center justify-center gap-1.5 active:scale-95 touch-target text-xs"
                                    >
                                        <FileText size={16} /> {t('reception.saveDraft', 'Save Draft')}
                                    </button>
                                </div>

                                {checklistData.nonConformance && (
                                    <button
                                        type="button"
                                        onClick={() => handleSubmit('REJECTED')}
                                        disabled={loading || !checklistData.reason}
                                        className="w-full sm:w-auto py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2 active:scale-95 touch-target text-xs"
                                        title="Reject sample due to non-conformance"
                                    >
                                        <AlertTriangle size={16} />
                                        <span>Reject Sample</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => handleSubmit('ACCEPTED')}
                                    disabled={loading || (checklistData.nonConformance && !checklistData.reason) || (removals.length > 0 && !justification)}
                                    className="w-full sm:flex-1 py-3 bg-emerald-600 text-white font-black rounded-xl shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center leading-tight transition-all active:scale-[0.98] touch-target"
                                >
                                    <div className="flex items-center gap-2">
                                        <CheckCircle size={18} />
                                        <span>{loading ? t('common.processing', 'Processing...') : t('reception.completeIntake', 'Complete Intake')}</span>
                                    </div>
                                    <span className="text-[10px] opacity-80 uppercase tracking-widest mt-0.5 font-bold">{t('reception.syncAndPrint', 'Synchronize & Print Label')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )}

            {/* RESULT MODAL */}
            {result && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300 no-print">
                    <div className="bg-sf-surface p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-sf-divider">
                        {result.success && (result.rejected || result.status === 'RECEIVED_REJECTED') ? (
                            <>
                                <div className="mx-auto w-24 h-24 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-500">
                                    <div className="w-16 h-16 bg-rose-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-600/30">
                                        <AlertTriangle size={32} className="text-white" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-black text-sf-text mb-1 tracking-tight uppercase">Non-Conformance Recorded</h2>
                                <p className="text-rose-600 dark:text-rose-400 mb-6 font-semibold text-xs">
                                    Sample rejected at reception desk and recorded as <span className="font-mono px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/50 rounded font-bold">RECEIVED_REJECTED</span>
                                </p>

                                <div className="space-y-3 bg-sf-canvas rounded-2xl p-4 border border-sf-divider mb-6 text-left text-xs shadow-inner">
                                    <div className="flex justify-between items-center pb-2 border-b border-sf-divider">
                                        <span className="text-sf-muted font-medium">Sample Identifier:</span>
                                        <span className="font-mono font-bold text-sf-text">{result.originalId}</span>
                                    </div>
                                    <div className="pb-2 border-b border-sf-divider">
                                        <span className="text-sf-muted font-medium block mb-1">Rejection Reason:</span>
                                        <div className="p-2 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 rounded border border-rose-200 dark:border-rose-900 font-semibold text-xs">
                                            {result.rejectionReason || 'Sample non-conformance recorded during physical intake.'}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                                        <div>
                                            <span className="text-sf-muted block">Carrier / Courier:</span>
                                            <span className="font-semibold text-sf-text">{result.custodyCarrierName || 'Direct Delivery'}</span>
                                        </div>
                                        <div>
                                            <span className="text-sf-muted block">Waybill / Tracking:</span>
                                            <span className="font-semibold text-sf-text">{result.custodyTrackingNumber || 'None'}</span>
                                        </div>
                                        <div>
                                            <span className="text-sf-muted block">Receiving Officer:</span>
                                            <span className="font-semibold text-sf-text">{result.receivingOfficerName || user.username}</span>
                                        </div>
                                        <div>
                                            <span className="text-sf-muted block">Handover Time:</span>
                                            <span className="font-semibold text-sf-text">
                                                {result.custodyHandoverAt ? new Date(result.custodyHandoverAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recorded'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => window.print()}
                                        className="py-3 px-4 bg-sf-surface text-rose-600 dark:text-rose-400 font-bold rounded-xl border border-rose-300 dark:border-rose-800 hover:bg-sf-canvas transition-all flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        <Printer size={16} /> Print Slip
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="py-3 px-4 bg-sf-raised text-sf-text font-bold rounded-xl border border-sf-divider hover:bg-sf-canvas transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                                    >
                                        <Plus size={16} /> Next Sample
                                    </button>
                                </div>
                            </>
                        ) : result.success ? (
                            <>
                                <div className="mx-auto w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-500">
                                    <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                        <CheckCircle size={32} className="text-white" />
                                    </div>
                                </div>
                                <h2 className="text-3xl font-black text-sf-text mb-2 tracking-tight uppercase">{t('reception.intakeConfirmed', 'Intake Confirmed!')}</h2>
                                <p className="text-sf-muted mb-8 font-medium">{t('reception.intakeConfirmedSubtitle', 'Sample identity established and records synchronized.')}</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-sf-canvas rounded-3xl p-6 border border-sf-divider mb-8 text-left shadow-inner">
                                    {/* Left: QR Code - Keep white background for camera scanability */}
                                    <div className="flex flex-col items-center justify-center gap-3 bg-sf-surface p-4 rounded-2xl border border-sf-divider shadow-sm">
                                        <div className="w-32 h-32 border border-sf-divider bg-white p-1 rounded-xl">
                                            {resultQrUrl ? (
                                                <img
                                                    src={resultQrUrl}
                                                    alt="QR"
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs text-slate-700 font-mono">
                                                    {result.labId}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-black text-sf-muted uppercase tracking-widest whitespace-nowrap">Encoded: {result.labId}</span>
                                    </div>

                                    {/* Right: ID Data */}
                                    <div className="flex flex-col justify-center space-y-4">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black text-sf-muted uppercase tracking-widest">{t('reception.permanentLabId', 'Permanent Lab ID')}</span>
                                            <div className="font-mono font-black text-3xl text-indigo-600 dark:text-indigo-400 leading-none">{result.labId}</div>
                                        </div>
                                        <div className="space-y-1 pt-3 border-t border-sf-divider">
                                            <span className="text-[9px] font-black text-sf-muted uppercase tracking-widest">{t('reception.originalSampleId', 'Scanning Code (Original)')}</span>
                                            <div className="font-mono font-bold text-sf-muted text-sm truncate" title={result.originalId}>{result.originalId}</div>
                                        </div>
                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase w-fit">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            {t('reception.readyForLab', 'Ready for Lab')}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsLabelPrintOpen(true)}
                                        className="flex flex-col items-center justify-center gap-2 py-5 bg-sf-surface text-indigo-600 dark:text-indigo-400 font-bold rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 hover:border-indigo-500 hover:bg-sf-raised transition-all active:scale-95 shadow-sm group"
                                    >
                                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/60 transition-colors">
                                            <Printer size={24} />
                                        </div>
                                        <span className="text-sm">{t('reception.printTag', 'Print Label')}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="flex flex-col items-center justify-center gap-2 py-5 bg-sf-raised text-sf-text font-bold rounded-2xl border border-sf-divider hover:bg-sf-canvas transition-all active:scale-95 shadow-md group"
                                    >
                                        <div className="p-2 bg-sf-canvas rounded-lg group-hover:bg-sf-surface transition-colors">
                                            <Plus size={24} />
                                        </div>
                                        <span className="text-sm">{t('reception.nextSample', 'Next Sample')}</span>
                                    </button>
                                </div>
                            </>

                        ) : (
                            <>
                                <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                                    <XCircle size={40} className="text-red-600" />
                                </div>
                                <h2 className="text-2xl font-bold text-red-600 mb-2">{t('reception.intakeFailed', 'Intake Failed')}</h2>
                                <p className="text-sf-muted mb-6">{result.message}</p>
                                <button onClick={() => setResult(null)} className="w-full py-4 bg-sf-raised text-sf-text font-bold rounded-xl border border-sf-divider hover:bg-sf-canvas transition-colors">
                                    {t('reception.tryAgain', 'Try Again')}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* SCANNER MODAL */}
            {showScanner && (
                <QRScanner
                    onScan={(data) => {
                        setScanCode(data);
                        setShowScanner(false);
                        // Brief timeout to ensure scanCode state is updated before lookup
                        setTimeout(() => handleLookup(data), 100);
                    }}
                    onClose={() => setShowScanner(false)}
                />
            )}

            {/* STAGE D: KEYBOARD SHORTCUTS MODAL (RC-18) */}
            <KeyboardShortcutsModal
                isOpen={isShortcutsOpen}
                onClose={() => setIsShortcutsOpen(false)}
            />

            {/* STAGE D: IMMEDIATE OFFLINE LABEL PRINT DIALOG (RC-17) */}
            <LabelPrintDialog
                isOpen={isLabelPrintOpen}
                onClose={() => setIsLabelPrintOpen(false)}
                sample={result?.success ? {
                    id: result.id,
                    labId: result.labId,
                    originalId: result.originalId || sampleData?.originalId,
                    assignedLab: user?.labId,
                    projectCode: sessionProject || sampleData?.projectCode,
                    samplingDetails: sampling,
                    status: 'ACCEPTED'
                } : null}
            />
        </div>
    );
};

export default Reception;
