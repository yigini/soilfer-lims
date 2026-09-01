import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { AlertTriangle, CheckCircle, XCircle, Droplet, Layers, Plus, Camera, ArrowLeft, User, Info, FileText, Printer, HelpCircle } from 'lucide-react';
import WalkInForm from '../components/reception/WalkInForm';
import ComplianceChecklist from '../components/reception/ComplianceChecklist';
import SampleMap from '../components/reception/SampleMap';
import QRScanner from '../components/common/QRScanner';
import InfoTooltip from '../components/common/InfoTooltip';

const Reception = () => {
    const { user, token } = useAuth();
    const { showDialog } = useDialog();
    const { t } = useLanguage();
    const location = useLocation();

    // --- MODE SELECTION ---
    const [mode, setMode] = useState(null); // 'PROJECT' | 'WALK_IN' | null
    const [sessionProject, setSessionProject] = useState(null);

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

    // Compliance & Notes
    const [checklistData, setChecklistData] = useState({ items: {}, nonConformance: false, reason: '' });
    const [intakeNotes, setIntakeNotes] = useState('');
    const [cocDeliveredBy, setCocDeliveredBy] = useState('');
    const [branding, setBranding] = useState(null);

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    // Walk-in Specific Data
    const [submitter, setSubmitter] = useState({ name: '', surname: '', phone: '', email: '', organization: '', contactMethod: 'Phone' });
    const [sampling, setSampling] = useState({
        date: new Date().toISOString().split('T')[0],
        depth: '',
        depthType: '0-20',
        location: '',
        coordinates: null, // { lat, lng, accuracy }
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
                setGroups(gRes.data);
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

    const resetForm = () => {
        setScanCode('');
        setSampleData(null);
        setChecklistData({ items: {}, nonConformance: false, reason: '' });
        setRemovals([]);
        setAdditions([]);
        setJustification('');
        setIntakeNotes('');
        setCocDeliveredBy('');

        if (mode === 'WALK_IN') {
            setSubmitter({ name: '', surname: '', phone: '', email: '', organization: '', contactMethod: 'Phone' });
            setSampling({
                date: new Date().toISOString().split('T')[0],
                depth: '',
                depthType: '0-20',
                location: '',
                coordinates: null,
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
        return hasSubmitter || hasSampling || hasAnalyses || hasNotes;
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
                timestamp: Date.now()
            };
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
        }, 10000);

        return () => clearInterval(timer);
    }, [mode, submitter, sampling, selectedGroup, additions, removals, checklistData, intakeNotes, result]);

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
        try {
            const res = await axios.get(`/api/samples`, { params: { originalId: trimmedCode, limit: 1 } });
            if (res.data.data && res.data.data.length > 0) {
                const found = res.data.data[0];

                const lockedStatuses = ['ACCEPTED', 'LAB_ID_ASSIGNED', 'PROCESSING', 'COMPLETED', 'APPROVED', 'ARCHIVED', 'DISPOSED'];

                if (lockedStatuses.includes(found.status)) {
                    showDialog({
                        type: 'error',
                        title: 'Intake Locked',
                        message: `Sample ${found.originalId} has already been approved (Status: ${found.status}) and cannot be modified by Reception.`
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
                            // Detect walk-in: explicit flag OR no project link
                            const isWalkInDraft = found.receptionData?.isWalkIn || (!found.projectId && !found.projectCode);
                            setMode(isWalkInDraft ? 'WALK_IN' : 'PROJECT');
                            if (isWalkInDraft) {
                                // For walk-ins, clear project context
                                setSessionProject(null);
                            } else {
                                setSessionProject(found.projectId || found.projectCode);
                            }
                            setSampleData(found);
                            // Populate form from receptionData
                            if (found.receptionData?.submitterDetails) setSubmitter(found.receptionData.submitterDetails);
                            if (found.receptionData?.samplingDetails) setSampling(found.receptionData.samplingDetails);

                            // Also try to extract coordinates from fieldMetadata if not already in samplingDetails
                            if (!found.receptionData?.samplingDetails?.coordinates && found.fieldMetadata) {
                                const fm = typeof found.fieldMetadata === 'string' ? JSON.parse(found.fieldMetadata) : found.fieldMetadata;
                                const lat = fm.latitude?.value || fm.lat?.value || fm.gps_latitude?.value;
                                const lng = fm.longitude?.value || fm.lng?.value || fm.gps_longitude?.value || fm.lon?.value;
                                if (lat && lng) {
                                    setSampling(prev => ({
                                        ...prev,
                                        coordinates: { lat: parseFloat(lat), lng: parseFloat(lng) },
                                        location: fm.location?.value || fm.site?.value || prev.location
                                    }));
                                }
                            }

                            if (found.receptionData?.checklist) setChecklistData(found.receptionData.checklist);
                            if (found.receptionData?.notes) setIntakeNotes(found.receptionData.notes);
                            if (found.receptionData?.coc?.deliveredBy) setCocDeliveredBy(found.receptionData.coc.deliveredBy);

                            // Analysis
                            if (found.analysisGroupIds?.[0]) setSelectedGroup(found.analysisGroupIds[0]);
                        }
                    });
                } else if (currentMode === 'PROJECT' && currentProject) {
                    if (found.projectId && found.projectId !== currentProject && found.projectCode !== currentProject) {
                        showDialog({
                            type: 'error',
                            title: 'Project Mismatch',
                            message: `Sample belongs to project ${found.projectId || found.projectCode}, but current session is ${currentProject}.`
                        });
                        setSampleData(null);
                        setLoading(false);
                        return;
                    }
                    setSampleData(found);

                    // Auto-apply project bundle if none selected
                    if (!selectedGroup) {
                        const pId = found.projectId || currentProject;
                        const proj = availableProjects.find(p => p.id === pId || p.code === pId);
                        if (proj?.defaultAnalysisBundle) setSelectedGroup(proj.defaultAnalysisBundle);
                    }
                } else {
                    setSampleData(found);
                    // Also auto-apply bundle for project samples caught in non-project mode
                    if (!selectedGroup && found.projectId) {
                        const proj = availableProjects.find(p => p.id === found.projectId || p.code === found.projectId);
                        if (proj?.defaultAnalysisBundle) setSelectedGroup(proj.defaultAnalysisBundle);
                    }
                }

            } else {
                if (currentMode === 'PROJECT') {
                    // Check if project allows open intake
                    const proj = availableProjects.find(p => p.id === currentProject);
                    if (proj && proj.projectType !== 'TEMPLATE_PREDEFINED_IDS') {
                        // Bypass manifest check for Open Intake projects
                        setSampleData({
                            originalId: trimmedCode,
                            isNew: true,
                            projectId: proj.id,
                            projectCode: proj.code
                        });
                        return;
                    }

                    // Try to check if it's an RBAC/Scope issue
                    try {
                        const globalCheck = await axios.get(`/api/samples`, { params: { search: trimmedCode, limit: 1, _checkScope: false } });
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
                        showDialog({
                            type: 'error',
                            title: 'Lookup Error',
                            message: `Sample ${trimmedCode} not found. Please check the ID or verify connectivity.`
                        });
                    }
                } else {
                    setSampleData({ originalId: trimmedCode, isNew: true });
                }
            }
        } catch (e) {
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

    // Debounced search effect
    useEffect(() => {
        if (mode !== 'PROJECT' || !scanCode || scanCode.length < 2) {
            setShowAutocomplete(false);
            return;
        }

        const timer = setTimeout(() => {
            handleAutocompleteSearch(scanCode);
        }, 300);

        return () => clearTimeout(timer);
    }, [scanCode, mode, sessionProject]);

    // Handle autocomplete selection
    const handleSelectAutocomplete = async (sample) => {
        setShowAutocomplete(false);
        setScanCode(sample.originalId);

        // Auto-select Project Default bundle if available
        const proj = availableProjects.find(p => p.id === sessionProject);
        if (proj?.defaultAnalysisBundle) {
            setSelectedGroup(proj.defaultAnalysisBundle);
        }

        // If sample has coordinates, we can show them on a map (store for later use)
        if (sample.coordinates) {
            setSampling(prev => ({
                ...prev,
                coordinates: sample.coordinates,
                location: sample.location || prev.location
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

        const unanswered = CHECKLIST_KEYS.filter(k => !checklistData.items?.[k]?.status);
        if (unanswered.length > 0) errors.push({ key: 'compliance', label: `Compliance checklist (${unanswered.length} unanswered)` });

        if (removals.length > 0 && !justification?.trim()) errors.push({ key: 'justification', label: 'Justification for removed analyses' });
        if (checklistData.nonConformance && !checklistData.reason?.trim()) errors.push({ key: 'ncReason', label: 'Non-conformance reason' });

        return errors;
    };

    const handleSubmit = async (decision, isDraft = false) => {
        // Skip validation for drafts
        if (!isDraft) {
            const errors = validateForm();
            if (errors.length > 0) {
                setValidationErrors(errors);
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

            receivedBy: user.username,
            labId: user.labId,
            coc: { deliveredBy: cocDeliveredBy, receivedBy: user.username, date: new Date().toISOString() },

            analysisGroupIds: selectedGroup ? [selectedGroup] : [],
            analysisAdditions: additions,
            analysisRemovals: removals,
            justification: removals.length > 0 ? justification : null,

            isWalkIn: mode === 'WALK_IN',
            projectId: mode === 'WALK_IN' ? null : (sessionProject || null),
            submitterDetails: (mode === 'WALK_IN' || sampleData?.isNew) ? submitter : null,
            samplingDetails: (mode === 'WALK_IN' || sampleData?.isNew) ? sampling : null,
            isDraft
        };

        try {
            const res = await axios.post('/api/reception/intake', payload);
            if (isDraft) {
                showDialog({
                    type: 'success',
                    title: 'Draft Saved',
                    message: "Available as Draft. You can resume it by looking up " + res.data.id + " or " + scanCode
                });
                setMode(null);
                resetForm();
            } else {
                setResult(res.data);
                localStorage.removeItem(AUTOSAVE_KEY);
            }
        } catch (err) {
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
            <div className="p-6 max-w-6xl mx-auto h-[90vh] flex flex-col justify-center animate-in fade-in zoom-in duration-300">
                <div className="text-center mb-6 md:mb-10">
                    <h1 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">Reception Console</h1>
                    <p className="text-gray-500">Select intake mode or resume a draft</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4 md:gap-8 mb-8 md:mb-12">
                    <button onClick={() => setMode('PROJECT')} className="p-6 md:p-10 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-transparent hover:border-blue-500 hover:shadow-xl group transition-all text-left relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Layers size={120} />
                        </div>
                        <div className="relative z-10">
                            <div className="bg-blue-100 dark:bg-blue-900/40 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                <Layers size={32} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Project Sample</h2>
                            <p className="text-gray-500 dark:text-gray-400">Scheduled samples (SoilFER, etc.)</p>
                        </div>
                    </button>

                    <button onClick={() => {
                        setMode('WALK_IN');
                        setSessionProject(null); // Clear project context for generic walk-in
                        const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
                        setScanCode(`EXT-${randomId}`);
                        setSampleData({ originalId: `EXT-${randomId}`, isNew: true });
                    }} className="p-6 md:p-10 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-transparent hover:border-purple-500 hover:shadow-xl group transition-all text-left relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <User size={120} />
                        </div>
                        <div className="relative z-10">
                            <div className="bg-purple-100 dark:bg-purple-900/40 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                                <User size={32} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Walk-in Sample</h2>
                            <p className="text-gray-500 dark:text-gray-400">Farmers & Individual clients</p>
                        </div>
                    </button>
                </div>

                {/* DRAFTS LIST */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex-1 max-h-[400px] flex flex-col">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center sticky top-0">
                        <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                            <FileText size={18} /> Incomplete Intakes (Drafts)
                        </h3>
                        <span className="text-xs font-bold bg-gray-200 dark:bg-gray-600 dark:text-gray-200 px-2 py-1 rounded-full">{drafts.length}</span>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 space-y-2">
                        {drafts.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 dark:text-gray-500">No drafts found.</div>
                        ) : (
                            drafts.map(d => (
                                <div key={d.id} className="flex items-center justify-between p-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl border border-transparent hover:border-blue-100 dark:hover:border-blue-800 transition-colors group cursor-pointer"
                                    onClick={() => {
                                        setScanCode(d.originalId);
                                        // Trigger lookup manually or effect? 
                                        // Since we are in render, we can't await here.
                                        // Better to set ScanCode then call handleLookup via button or helper.
                                        // We can modify handleLookup to accept an ID directly.
                                        handleLookup(d.originalId);
                                    }}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs">
                                            DFT
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                                {d.originalId}
                                                <span className="text-xs font-normal text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded capitalize">
                                                    {(d.receptionData?.isWalkIn || (!d.projectId && !d.projectCode)) ? 'Walk-in' : 'Project'}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
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
                                            className="text-gray-400 hover:text-red-600 font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-700 px-3 py-1.5 rounded border border-gray-200 dark:border-gray-600 hover:border-red-200 dark:hover:border-red-700 shadow-sm"
                                        >
                                            Discard
                                        </button>
                                        <button className="text-blue-600 dark:text-blue-400 font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-700 px-3 py-1.5 rounded border border-blue-200 dark:border-blue-800 shadow-sm">
                                            Resume
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
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
            <div className="p-4 md:p-10 max-w-2xl mx-auto animate-in slide-in-from-right">
                <button onClick={() => setMode(null)} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 font-medium"><ArrowLeft size={20} /> Back</button>
                <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Select Project Session</h2>
                    <div className="space-y-3">
                        {availableProjects.filter(p => p.status === 'ACTIVE').map(p => (
                            <button key={p.id} onClick={() => handleSelectProject(p)} className="w-full text-left p-4 border dark:border-gray-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-all flex flex-col group">
                                <div className="flex justify-between items-start">
                                    <span className="font-bold text-lg text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">{p.name || p.id}</span>
                                    <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded uppercase tracking-wider">Active</span>
                                </div>
                                <div className="flex gap-3 mt-1">
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{p.code}</div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">• {p.projectType === 'TEMPLATE_PREDEFINED_IDS' ? 'Template' : p.projectType === 'KOBO_LINKED' ? 'Kobo Linked' : 'Open Intake'}</div>
                                    {p.defaultAnalysisBundle && (
                                        <div className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">• Auto-Bundle: {p.defaultAnalysisBundle}</div>
                                    )}
                                </div>
                            </button>
                        ))}
                        {availableProjects.filter(p => p.status === 'ACTIVE').length === 0 && (
                            <div className="text-center py-10">
                                <p className="text-gray-500 font-medium">No active project sessions found.</p>
                                <p className="text-xs text-gray-400 mt-1">Projects must be ACTIVE to accept samples.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6 bg-slate-900 text-white p-4 rounded-xl shadow-lg">
                <div className="flex items-center gap-4">
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
                    }} className="bg-slate-700 hover:bg-slate-600 p-2 rounded transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">{t('reception.sessionActive', 'Session Active')}</div>
                        <div className="text-lg font-bold flex items-center gap-2">
                            {mode === 'PROJECT' || sessionProject ? <><Layers size={18} /> {t('common.project', 'Project')}: {sessionProject}</> : <><User size={18} /> {t('reception.walkInReception', 'Walk-in Reception')}</>}
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-xs text-slate-400">{t('reception.operator', 'Operator')} ({user.labId || 'Global'})</div>
                    <div className="font-medium">{user.name || user.username}</div>
                </div>
            </div>

            {/* LOOKUP with Autocomplete */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 relative">
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <input
                            value={scanCode}
                            onChange={(e) => setScanCode(e.target.value)}
                            placeholder={mode === 'PROJECT' ?
                                (availableProjects.find(p => p.id === sessionProject)?.projectType === 'TEMPLATE_PREDEFINED_IDS'
                                    ? t('reception.searchManifest', 'Search manifest by Sample ID...')
                                    : t('reception.scanOrEnter', 'Scan or Enter Sample ID to add...'))
                                : t('reception.enterSampleId', 'Enter Sample ID')}
                            className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-lg"
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    setShowAutocomplete(false);
                                    handleLookup();
                                }
                                if (e.key === 'Escape') setShowAutocomplete(false);
                            }}
                            onFocus={() => {
                                const proj = availableProjects.find(p => p.id === sessionProject);
                                if (scanCode.length >= 2 && mode === 'PROJECT' && proj?.projectType === 'TEMPLATE_PREDEFINED_IDS' && autocompleteResults.length > 0) {
                                    setShowAutocomplete(true);
                                }
                            }}
                        />

                        {/* Autocomplete Dropdown */}
                        {showAutocomplete && mode === 'PROJECT' && (
                            <div className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto mt-1">
                                {isSearching ? (
                                    <div className="p-4 text-center text-gray-500">{t('common.searching', 'Searching...')}</div>
                                ) : (
                                    null
                                )}
                                {!isSearching && autocompleteResults.length === 0 ? (
                                    <div className="p-4 text-center text-gray-400">{t('reception.noExpectedSamples', 'No EXPECTED samples found')}</div>
                                ) : (
                                    autocompleteResults.map(sample => (
                                        <div
                                            key={sample.id}
                                            onClick={() => handleSelectAutocomplete(sample)}
                                            className="p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer border-b last:border-0 dark:border-gray-700 flex items-center justify-between group"
                                        >
                                            <div>
                                                <div className="font-mono font-bold text-gray-900 dark:text-gray-100">{sample.originalId}</div>
                                                <div className="text-xs text-gray-500">
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
                    <button
                        onClick={() => setShowScanner(true)}
                        className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 p-3 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors border border-slate-300 dark:border-slate-600 flex items-center gap-2"
                        title={t('reception.scan', 'Scan')}
                    >
                        <Camera size={20} />
                        <span className="hidden sm:inline font-bold">{t('reception.scan', 'Scan')}</span>
                    </button>
                    <button
                        onClick={() => { setShowAutocomplete(false); handleLookup(); }}
                        disabled={!scanCode}
                        className="bg-blue-600 text-white px-8 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {t('reception.lookUp', 'Look Up')}
                    </button>
                </div>

                {mode === 'PROJECT' && (
                    <div className="mt-3 flex items-center justify-between">
                        <div className="text-xs text-gray-400">
                            {availableProjects.find(p => p.id === sessionProject)?.projectType === 'TEMPLATE_PREDEFINED_IDS'
                                ? "💡 Scheduled project: Verification against manifest required."
                                : "💡 Open intake: Register samples manually as they arrive."}
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
                            <Plus size={14} /> New Manual ID
                        </button>
                    </div>
                )}
            </div>

            {sampleData && !result && (
                <div className="grid lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">

                    {/* LEFT COLUMN: SAMPLE DATA */}
                    <div className="space-y-6">
                        {/* Map View */}
                        {(sampling.coordinates || sampleData?.receptionData?.samplingDetails?.coordinates) && (
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm animate-in fade-in slide-in-from-top-2">
                                <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">📍 Location Preview</h3>
                                <SampleMap
                                    coordinates={sampling.coordinates || sampleData?.receptionData?.samplingDetails?.coordinates}
                                    title={sampleData?.originalId || 'Sample Site'}
                                />
                            </div>
                        )}

                        {/* Show Manual Form for Walk-ins OR New Unlisted Project Samples */}
                        {(mode === 'WALK_IN' || sampleData?.isNew) ? (
                            <WalkInForm
                                submitter={submitter} setSubmitter={setSubmitter}
                                sampling={sampling} setSampling={setSampling}
                                groups={groups}
                                onPurposeSelect={handlePurposeSelect}
                                errors={validationErrors}
                            />
                        ) : (
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                                <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2"><Layers size={20} /> Project Sample Metadata</h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div><label className="text-gray-500">Original ID</label><div className="font-mono font-bold">{sampleData.originalId}</div></div>
                                        <div><label className="text-gray-500">Project Code</label><div className="font-mono">{sampleData.projectCode || sampleData.projectId || 'N/A'}</div></div>
                                        <div><label className="text-gray-500">Status</label><div className="badge bg-yellow-100 text-yellow-800 px-2 rounded w-fit">{sampleData.status}</div></div>
                                        <div><label className="text-gray-500">Collection Date</label><div>{(typeof sampleData.fieldMetadata?.collectionDate === 'object' ? sampleData.fieldMetadata?.collectionDate?.value : sampleData.fieldMetadata?.collectionDate) || 'N/A'}</div></div>
                                    </div>

                                    {sampleData.fieldMetadata && (
                                        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600 text-xs space-y-2">
                                            {Object.entries(sampleData.fieldMetadata).slice(0, 6).map(([k, v]) => {
                                                const displayVal = v && typeof v === 'object' ? (v.value ?? JSON.stringify(v)) : v;
                                                return (
                                                    <div key={k} className="flex justify-between border-b pb-1 last:border-0">
                                                        <span className="font-semibold capitalize text-gray-600">{k.replace(/([A-Z])/g, ' $1')}</span>
                                                        <span className="font-mono">{String(displayVal ?? '—')}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ANALYSIS SELECTION */}
                        <div
                            ref={analysisSectionRef}
                            className={`bg-white dark:bg-gray-800 p-6 rounded-xl border shadow-sm transition-all duration-500 ${analysisHighlight
                                ? 'border-blue-400 ring-2 ring-blue-200 shadow-blue-100 shadow-lg'
                                : validationErrors.some(e => e.key === 'analyses')
                                    ? 'border-red-400 ring-1 ring-red-200'
                                    : 'border-gray-200 dark:border-gray-700'
                                }`}
                        >
                            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                                <Droplet size={20} /> Requested Analysis
                                <InfoTooltip text="Choose a predefined package of tests (Bundle) or add individual tests as required by the client." />
                            </h3>

                            <label className="block text-sm font-semibold mb-2">
                                Select Bundle
                                <InfoTooltip text="Bundles are optimized groups of analyses defined for specific project needs." />
                            </label>
                            <select
                                value={selectedGroup}
                                onChange={e => { setSelectedGroup(e.target.value); setRemovals([]); setAdditions([]); }}
                                className="w-full p-3 border rounded bg-blue-50 dark:bg-blue-900/30 font-bold text-blue-800 dark:text-blue-300 mb-4"
                            >
                                <option value="">-- No Bundle --</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>

                            <div className="mb-4">
                                <label className="block text-sm font-semibold mb-1">Add Individual Test</label>
                                <div className="flex gap-2 relative">
                                    <input value={searchAnalysis} onChange={e => setSearchAnalysis(e.target.value)} placeholder="Search analysis code..." className="flex-1 p-2 border rounded" />
                                    {searchAnalysis && (
                                        <div className="absolute top-full left-0 w-full bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-lg rounded z-10 max-h-40 overflow-y-auto">
                                            {analyses.filter(a => !effectiveList.includes(a.code) && a.name.toLowerCase().includes(searchAnalysis.toLowerCase())).map(a => (
                                                <div key={a.code} onClick={() => { toggleAnalysis(a.code); setSearchAnalysis(''); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm">
                                                    {a.name} ({a.code})
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2 min-h-[40px] bg-gray-50 dark:bg-gray-700/50 p-3 rounded border dark:border-gray-600 inner-shadow">
                                {effectiveList.length === 0 && <span className="text-gray-400 text-sm italic">No analyses selected</span>}
                                {effectiveList.map(code => {
                                    const group = groups.find(g => g.id === selectedGroup);
                                    const isGroup = group?.analyses.includes(code);
                                    return (
                                        <div key={code} className={`flex items-center gap-1 px-3 py-1 rounded text-sm ${isGroup ? 'bg-white dark:bg-gray-700 border dark:border-gray-600 shadow-sm' : 'bg-green-100 dark:bg-green-900/40 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-300'}`}>
                                            <span className="font-bold">{code}</span>
                                            <button onClick={() => toggleAnalysis(code)} className="text-gray-400 hover:text-red-500 ml-1"><XCircle size={14} /></button>
                                        </div>
                                    )
                                })}
                                {removals.map(code => (
                                    <div key={code} className="flex items-center gap-1 px-2 py-1 rounded border border-red-200 bg-red-50 text-red-400 text-xs line-through">
                                        <span>{code}</span>
                                        <button onClick={() => toggleAnalysis(code)} className="text-gray-400"><Plus size={12} /></button>
                                    </div>
                                ))}
                            </div>

                            {removals.length > 0 && (
                                <textarea
                                    value={justification}
                                    onChange={e => setJustification(e.target.value)}
                                    placeholder="Required: Reason for removing tests..."
                                    className="w-full mt-3 p-2 border border-red-300 bg-red-50 rounded text-sm"
                                />
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: COMPLIANCE & SUBMIT */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <ComplianceChecklist
                                value={checklistData}
                                onChange={setChecklistData}
                                onNonConformance={(checked) => setChecklistData({ ...checklistData, nonConformance: checked })}
                                showIncomplete={validationErrors.some(e => e.key === 'compliance')}
                            />
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2"><Camera size={20} /> Documentation & Notes</h3>
                            <input
                                value={cocDeliveredBy} onChange={e => setCocDeliveredBy(e.target.value)}
                                placeholder="Chain of Custody: Delivered By"
                                className="w-full mb-3 p-2 border rounded"
                            />
                            <textarea
                                value={intakeNotes}
                                onChange={e => setIntakeNotes(e.target.value)}
                                placeholder="General Reception Notes..."
                                className="w-full p-2 border rounded h-24 resize-none"
                            />
                        </div>

                        {validationErrors.length > 0 && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 mb-2 animate-in fade-in slide-in-from-top-2">
                                <p className="text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-1.5">
                                    <AlertTriangle size={14} />
                                    {validationErrors.length} required {validationErrors.length === 1 ? 'field' : 'fields'} missing
                                </p>
                            </div>
                        )}
                        <div className="sticky bottom-4 z-10 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md p-3 rounded-2xl shadow-lg shadow-black/10 border border-gray-200 dark:border-gray-700">
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleDiscard()}
                                    disabled={loading}
                                    className="py-3 px-5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <XCircle size={18} /> {t('reception.discard', 'Discard')}
                                </button>

                                <button
                                    onClick={() => handleSubmit('ACCEPTED', true)}
                                    disabled={loading}
                                    className="py-3 px-5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <FileText size={18} /> {t('reception.saveDraft', 'Save Draft')}
                                </button>

                                <button
                                    onClick={() => handleSubmit('ACCEPTED')}
                                    disabled={loading || (checklistData.nonConformance && !checklistData.reason) || (removals.length > 0 && !justification)}
                                    className="flex-1 py-3 bg-emerald-600 text-white font-black rounded-xl shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center leading-tight transition-all active:scale-[0.98]"
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
            )}

            {/* RESULT MODAL */}
            {result && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300 no-print">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
                        {result.success ? (
                            <>
                                <div className="mx-auto w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 animate-in zoom-in duration-500">
                                    <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                        <CheckCircle size={32} className="text-white" />
                                    </div>
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 dark:text-gray-100 mb-2 tracking-tight uppercase">{t('reception.intakeConfirmed', 'Intake Confirmed!')}</h2>
                                <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">{t('reception.intakeConfirmedSubtitle', 'Sample identity established and records synchronized.')}</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-gray-700/50 rounded-3xl p-6 border border-slate-200 dark:border-gray-600 mb-8 text-left shadow-inner">
                                    {/* Left: QR Code */}
                                    <div className="flex flex-col items-center justify-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-slate-200 dark:border-gray-600 shadow-sm">
                                        <div className="w-32 h-32 border border-slate-100 p-1 rounded-xl">
                                            <img
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${result.labId}`}
                                                alt="QR"
                                                className="w-full h-full object-contain"
                                            />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Encoded: {result.labId}</span>
                                    </div>

                                    {/* Right: ID Data */}
                                    <div className="flex flex-col justify-center space-y-4">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('reception.permanentLabId', 'Permanent Lab ID')}</span>
                                            <div className="font-mono font-black text-3xl text-indigo-600 leading-none">{result.labId}</div>
                                        </div>
                                        <div className="space-y-1 pt-3 border-t border-slate-200">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('reception.originalSampleId', 'Scanning Code (Original)')}</span>
                                            <div className="font-mono font-bold text-slate-500 text-sm truncate" title={result.originalId}>{result.originalId}</div>
                                        </div>
                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase w-fit">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            {t('reception.readyForLab', 'Ready for Lab')}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => window.print()}
                                        className="flex flex-col items-center justify-center gap-2 py-5 bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 font-bold rounded-2xl border-2 border-indigo-100 dark:border-indigo-800 hover:border-indigo-600 hover:bg-slate-50 dark:hover:bg-gray-600 transition-all active:scale-95 shadow-sm group"
                                    >
                                        <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                                            <Printer size={24} />
                                        </div>
                                        <span className="text-sm">{t('reception.printTag', 'Print Tag')}</span>
                                    </button>
                                    <button
                                        onClick={resetForm}
                                        className="flex flex-col items-center justify-center gap-2 py-5 bg-slate-900 text-white font-bold rounded-2xl hover:bg-black transition-all active:scale-95 shadow-xl shadow-slate-900/20 group"
                                    >
                                        <div className="p-2 bg-slate-800 rounded-lg group-hover:bg-slate-700 transition-colors">
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
                                <p className="text-gray-600 mb-6">{result.message}</p>
                                <button onClick={() => setResult(null)} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors">
                                    {t('reception.tryAgain', 'Try Again')}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* PRINTABLE LABEL (Hidden unless printing) */}
            {result?.success && (
                <div className="print-only hidden">
                    <div className="w-[101mm] h-[54mm] bg-white p-4 border border-black flex flex-col font-sans">
                        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-2 mb-2">
                            <div>
                                <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                                    {branding?.title || 'SoilFER LIMS'}
                                </h1>
                                <p className="text-[10px] font-bold text-slate-500 uppercase">
                                    {branding?.organization || 'Reception Intake'}
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-[9px] font-bold text-white bg-slate-900 px-1.5 py-0.5 rounded uppercase mb-1 inline-block">
                                    Sample Label
                                </div>
                                <div className="text-[10px] font-mono font-bold text-slate-600">
                                    {new Date().toLocaleDateString()}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-1 gap-4 items-center">
                            {/* QR CODE - Now using Lab ID */}
                            <div className="w-24 h-24 bg-white border border-gray-200 p-1 rounded shadow-sm">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${result.labId}`}
                                    alt="QR"
                                    className="w-full h-full object-contain"
                                />
                            </div>

                            <div className="flex-1 space-y-2">
                                <div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Lab ID</div>
                                    <div className="text-2xl font-black font-mono leading-none text-slate-900">
                                        {result.labId}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Sample ID (Original)</div>
                                    <div className="text-[11px] font-bold text-slate-600 font-mono break-all">
                                        {result.originalId || sampleData?.originalId}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto pt-2 border-t border-dashed border-gray-300 flex justify-between items-end">
                            <div className="text-[8px] font-bold text-slate-400">
                                Collected: {sampling.date || 'N/A'}
                            </div>
                            <div className="text-[8px] font-black text-slate-900 uppercase">
                                {user.labId || 'Global Lab'}
                            </div>
                        </div>
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
        </div>
    );
};

export default Reception;
