import { useAnalysisNames } from '../context/AnalysisCatalogueContext';
import { workItemEvidenceText } from '../utils/workItemEvidence';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getStatusLabel } from '../utils/i18nHelper';
import { useDialog } from '../context/DialogContext';
import { useNotifications } from '../context/NotificationContext';
import WorkItemsTable from '../components/sample/WorkItemsTable';
import FieldMetadataCard from '../components/sample/FieldMetadataCard';
import FieldMap from '../components/sample/FieldMap';
import IntakeRequestCard from '../components/sample/IntakeRequestCard';
import AnalysisUpdateModal from '../components/sample/AnalysisUpdateModal';
import LabelPrintDialog from '../components/common/LabelPrintDialog';
import ReportContent from '../components/report/ReportContent';
import SpectraViewer from '../components/SpectraViewer';
import StorageMovementModal from '../components/sample/StorageMovementModal';
import EvidenceInspectionModal from '../components/sample/EvidenceInspectionModal';

import {
    ArrowLeft,
    ArrowRight,
    Eye,
    Printer,
    Map,
    Sliders,
    MoreHorizontal,
    AlertTriangle,
    CheckCircle,
    FileText,
    Layers,
    ShieldCheck,
    History as HistoryIcon,
    Package,
    Clock,
    XCircle,
    RefreshCw,
    AlertCircle,
    Check,
    X,
    RotateCcw
} from 'lucide-react';

const SampleDetail = ({ initialWorkspace = null, initialSample = null }) => {
    const getAnalysisDisplayName = useAnalysisNames();
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { token, user } = useAuth();
    const { showDialog } = useDialog();
    const { subscribeToEvent } = useNotifications();
    const { t } = useLanguage();

    // Data State
    const [workspace, setWorkspace] = useState(initialWorkspace);
    const [sample, setSample] = useState(initialSample);
    const [workItems, setWorkItems] = useState(initialWorkspace?.workItems || []);
    const [history, setHistory] = useState([]);
    const [existingReport, setExistingReport] = useState(null);
    const [loading, setLoading] = useState(!initialWorkspace);
    const [refreshing, setRefreshing] = useState(false);

    // Active Workspace Tab: 'work', 'review', 'request', 'reports', 'history'
    const [activeTab, setActiveTab] = useState(() => {
        const queryParams = new URLSearchParams(location.search);
        return queryParams.get('tab') || 'work';
    });
    const [selectedSubmissionId, setSelectedSubmissionId] = useState(() => {
        const queryParams = new URLSearchParams(location.search);
        return queryParams.get('submissionId') || null;
    });
    const [selectedWorkItemIds, setSelectedWorkItemIds] = useState([]);

    // Clear selections when transitioning across samples or contexts
    useEffect(() => {
        setSelectedWorkItemIds([]);
    }, [id]);

    // Reconcile selections against current workItems and assignment eligibility
    useEffect(() => {
        setSelectedWorkItemIds(prev => {
            if (!prev || prev.length === 0) return prev;
            const currentEligibleIds = new Set(
                (workItems || [])
                    .filter(item =>
                        !['COMPLETED', 'SUBMITTED', 'ACCEPTED'].includes(item.status) &&
                        !(item.analysis === 'ARCHIVING' && workItems.some(wi => wi.analysis === 'DISPOSAL' && wi.assignedTo)) &&
                        !(item.analysis === 'DISPOSAL' && workItems.some(wi => wi.analysis === 'ARCHIVING' && wi.assignedTo))
                    )
                    .map(item => item.id)
            );
            const reconciled = prev.filter(itemId => currentEligibleIds.has(itemId));
            if (reconciled.length === prev.length && reconciled.every((v, i) => v === prev[i])) {
                return prev;
            }
            return reconciled;
        });
    }, [workItems]);

    // Extract active method context from searchParams or returnTo
    const searchParams = new URLSearchParams(location.search);
    const directAnalysis = searchParams.get('analysis') || searchParams.get('method');
    const returnTo = searchParams.get('returnTo');
    let returnAnalysis = null;
    if (returnTo) {
        try {
            const parsedUrl = new URL(returnTo, window.location.origin);
            returnAnalysis = parsedUrl.searchParams.get('analysis') || parsedUrl.searchParams.get('method');
        } catch (e) {
            const match = returnTo.match(/[?&](?:analysis|method)=([^&]+)/);
            if (match) returnAnalysis = decodeURIComponent(match[1]);
        }
    }
    const activeMethodContext = directAnalysis || returnAnalysis || null;

    // Focus & open scoped sample assignment controls without leaving sample page (#119)
    const handleFocusAssignment = () => {
        setActiveTab('work');
        const currentParams = new URLSearchParams(location.search);
        currentParams.set('tab', 'work');
        navigate({ search: `?${currentParams.toString()}` }, { replace: true });

        const unassigned = workItems
            .filter(w => !w.assignedTo && ['NOT_ASSIGNED', 'PENDING', 'UNASSIGNED'].includes(w.status))
            .map(w => w.id);

        if (unassigned.length > 0) {
            setSelectedWorkItemIds(unassigned);
        }

        setTimeout(() => {
            const el = document.getElementById('ordered-analyses-table');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 60);
    };

    // Sync tab and submissionId from external/browser navigation
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const urlTab = queryParams.get('tab');
        const urlSub = queryParams.get('submissionId');
        if (urlTab && urlTab !== activeTab) {
            setActiveTab(urlTab);
        }
        if (urlSub !== selectedSubmissionId) {
            setSelectedSubmissionId(urlSub);
        }
    }, [location.search]);

    // Sub-view / modal state
    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [printTarget, setPrintTarget] = useState(null);
    const [reportModal, setReportModal] = useState(null);
    const [selectedSpectraScan, setSelectedSpectraScan] = useState(null);
    const [storageModalOpen, setStorageModalOpen] = useState(false);
    const [inspectedItem, setInspectedItem] = useState(null);
    const [showFieldMetadata, setShowFieldMetadata] = useState(false);
    const [moreActionsOpen, setMoreActionsOpen] = useState(false);
    const moreActionsRef = useRef(null);

    // Review Tab Checkbox State
    const [reviewChecked, setReviewChecked] = useState(false);
    const [returningSubmissionId, setReturningSubmissionId] = useState(null);
    const [returnReason, setReturnReason] = useState('');

    // Confirmation & Alert Modals
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [infoModal, setInfoModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
    const [undoApprovalModal, setUndoApprovalModal] = useState({ isOpen: false, reason: '' });
    const [amendmentModal, setAmendmentModal] = useState({ isOpen: false, type: 'CLERICAL', reason: '', impact: '' });

    // Sync Tab to URL
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('tab') !== activeTab) {
            params.set('tab', activeTab);
            navigate({ search: params.toString() }, { replace: true });
        }
    }, [activeTab, location.search, navigate]);

    // Close More Actions on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (moreActionsRef.current && !moreActionsRef.current.contains(e.target)) {
                setMoreActionsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Dismiss active modals on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                if (infoModal?.isOpen) setInfoModal(prev => ({ ...prev, isOpen: false }));
                else if (confirmModal?.isOpen) setConfirmModal(prev => ({ ...prev, isOpen: false }));
                else if (amendmentModal?.isOpen) setAmendmentModal(prev => ({ ...prev, isOpen: false }));
                else if (undoApprovalModal?.isOpen) setUndoApprovalModal(prev => ({ ...prev, isOpen: false }));
                else if (returningSubmissionId) { setReturningSubmissionId(null); setReturnReason(''); }
                else if (reportModal) setReportModal(null);
                else if (selectedSpectraScan) setSelectedSpectraScan(null);
                else if (moreActionsOpen) setMoreActionsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [infoModal, confirmModal, amendmentModal, undoApprovalModal, returningSubmissionId, reportModal, selectedSpectraScan, moreActionsOpen]);

    // Generic Action Wrapper
    const requestConfirmation = (title, message, action) => {
        setConfirmModal({
            isOpen: true,
            title,
            message,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                await action();
            }
        });
    };

    const showInfo = (title, message, type = 'info') => {
        const modalType = title.toLowerCase().includes('error') || title.toLowerCase().includes('fail') ? 'error' :
            title.toLowerCase().includes('success') ? 'success' : 'info';
        setInfoModal({ isOpen: true, title, message, type: modalType });
    };

    // ─── Fetch Workspace Projection ───
    const fetchWorkspaceData = useCallback(async (isSilent = false) => {
        if (!id) return;
        if (!isSilent) setRefreshing(true);
        try {
            const [wsRes, detailRes] = await Promise.allSettled([
                axios.get(`/api/samples/${id}/workspace`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                }),
                axios.get(`/api/samples/${id}/detail`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                })
            ]);

            if (wsRes.status === 'fulfilled') {
                const wsData = wsRes.value.data;
                setWorkspace(wsData);
                setWorkItems(wsData.workItems || []);
            }

            if (detailRes.status === 'fulfilled') {
                const sampleData = detailRes.value.data.sample || detailRes.value.data;
                sampleData.hasKoboConnection = detailRes.value.data.hasKoboConnection || false;
                setSample(sampleData);
                setHistory(detailRes.value.data.auditLog || []);
                if (!wsRes.value?.data) {
                    setWorkItems(detailRes.value.data.workItems || []);
                }
            } else if (wsRes.status === 'rejected') {
                const err = wsRes.reason;
                if (err.response?.status === 404) {
                    showDialog({ type: 'error', title: t('common.error', 'Error'), message: t('sampleDetail.noSampleFound', 'Sample not found') });
                } else if (err.response?.status === 403) {
                    showDialog({ type: 'error', title: t('common.error', 'Forbidden'), message: 'Sample is outside your authorized laboratory scope.' });
                }
            }
        } catch (err) {
            console.error('[fetchWorkspaceData] Error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [id, token, showDialog, t]);

    // Check for existing report
    const checkReport = useCallback(async () => {
        if (!id) return;
        try {
            const res = await axios.get(`/api/reports/sample/${id}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            setExistingReport(res.data || null);
        } catch {
            setExistingReport(null);
        }
    }, [id, token]);

    useEffect(() => {
        fetchWorkspaceData();
        checkReport();
    }, [fetchWorkspaceData, checkReport]);

    // Real-time Event Subscription
    useEffect(() => {
        if (!subscribeToEvent || !id) return;
        const unsubscribe = subscribeToEvent('WORKITEM_CHANGED', (data) => {
            const affectedIds = data.sampleIds || (data.sampleId ? [data.sampleId] : []);
            if (!affectedIds.includes(id)) return;
            console.log('[SampleDetail] Received WORKITEM_CHANGED, refreshing workspace projection...');
            fetchWorkspaceData(true);
            checkReport();
        });
        return unsubscribe;
    }, [subscribeToEvent, id, fetchWorkspaceData, checkReport]);

    // Role-aware context
    const userRole = user?.role || 'VIEWER';
    const isManager = ['LAB_MANAGER', 'SUPER_ADMIN', 'MASTER_USER'].includes(userRole);
    const isTech = userRole === 'LAB_TECHNICIAN';
    const isReception = ['SAMPLE_RECEPTION', 'LAB_MANAGER', 'SUPER_ADMIN', 'MASTER_USER'].includes(userRole);

    const roleBadgeText = useMemo(() => {
        if (isManager) return 'Lab manager · review authority';
        if (isTech) return `Technician · ${user?.name || user?.username || 'Analyst'}`;
        if (isReception) return 'Reception · intake authority';
        return 'Auditor · read only';
    }, [isManager, isTech, isReception, user]);

    // ─── Actions & Handlers ───
    const handleUpdateStatus = async (itemId, status, result, options = {}) => {
        try {
            await axios.put(`/api/work/${itemId}/status`, {
                status,
                result,
                equipmentId: options.equipmentId
            });
            fetchWorkspaceData(true);
        } catch (err) {
            console.error('Update failed', err);
            showInfo(t('common.error', 'Update Failed'), err.response?.data?.error || err.message);
        }
    };

    const handleReviewItem = async (itemId, status, note = 'Item review decision') => {
        try {
            await axios.post(`/api/work/${itemId}/review`, { status, note });
            fetchWorkspaceData(true);
        } catch (err) {
            console.error('Item review failed', err);
            showInfo(t('common.error', 'Error'), err.response?.data?.error || err.message);
        }
    };

    const handleReviewBulk = async (itemIds, status) => {
        try {
            await axios.post(`/api/work/review/bulk`, { workItemIds: itemIds, status, note: 'Bulk Review' });
            showInfo(t('common.success', 'Success'), `Successfully reviewed ${itemIds.length} items.`);
            fetchWorkspaceData(true);
        } catch (err) {
            console.error('Bulk review failed', err);
            showInfo(t('common.error', 'Error'), err.response?.data?.error || err.message);
        }
    };

    const handleUndoIntake = async () => {
        requestConfirmation(t('sampleDetail.undoIntake', 'Undo Intake'), '⚠️ UNDO INTAKE? \n\nThis will:\n1. Revert status to RECEIVED\n2. Delete generated Work Items\n3. Preserve the Lab ID for re-processing', async () => {
            try {
                await axios.post(`/api/samples/${id}/undo-intake`);
                showInfo(t('common.success', 'Success'), 'Intake Undone. Sample reverted to RECEIVED.');
                fetchWorkspaceData();
            } catch (e) {
                showInfo(t('common.error', 'Error'), e.response?.data?.error || e.message);
            }
        });
    };

    const handleUpdateMetadata = async (metadata) => {
        try {
            await axios.put(`/api/samples/${id}/metadata`, { metadata });
            showInfo(t('common.success', 'Success'), 'Metadata Updated Successfully!');
            fetchWorkspaceData(true);
        } catch (e) {
            showInfo(t('common.error', 'Error'), e.response?.data?.error || e.message);
        }
    };

    const handleGenerateReport = async () => {
        requestConfirmation('Generate & Release Report', 'Authorize and release an official analysis report? This will create an immutable version snapshot.', async () => {
            try {
                const res = await axios.post(`/api/reports/generate/${id}`, {}, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                setExistingReport(res.data);
                showInfo(t('common.success', 'Success'), `Report v${res.data.version || 1} released successfully!`);
                fetchWorkspaceData();
                const full = await axios.get(`/api/reports/${res.data.id}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                setReportModal(full.data);
            } catch (e) {
                showInfo(t('common.error', 'Error'), e.response?.data?.error || 'Failed to generate report');
            }
        });
    };

    const handleViewReport = async (reportId) => {
        try {
            const targetId = reportId || existingReport?.id || workspace?.currentReleasedReport?.id;
            if (!targetId) return;
            const res = await axios.get(`/api/reports/${targetId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            setReportModal(res.data);
        } catch (e) {
            showInfo(t('common.error', 'Error'), 'Failed to load report');
        }
    };

    const handleApproveSample = async () => {
        try {
            await axios.post(`/api/samples/${id}/approve`, {});
            showInfo(t('common.success', 'Success'), 'Sample approved successfully.');
            fetchWorkspaceData(true);
        } catch (err) {
            showInfo(t('common.error', 'Approval Failed'), err.response?.data?.error || err.message);
        }
    };

    const handleArchive = async () => {
        try {
            await axios.post(`/api/samples/${id}/archive`, {});
            showInfo(t('common.success', 'Success'), 'Sample archived successfully.');
            fetchWorkspaceData();
        } catch (err) {
            showInfo(t('common.error', 'Archive Failed'), err.response?.data?.error || err.message);
        }
    };

    const handleDispose = async () => {
        requestConfirmation('Dispose Sample Material', 'Permanently authorize disposal for this sample material? Disposed material is physically immutable.', async () => {
            try {
                await axios.post(`/api/samples/${id}/dispose`, {});
                showInfo(t('common.success', 'Success'), 'Sample marked as DISPOSED.');
                fetchWorkspaceData();
            } catch (err) {
                showInfo(t('common.error', 'Disposal Failed'), err.response?.data?.error || err.message);
            }
        });
    };

    const handleOpenSpectra = (item) => {
        let modality = 'NIR';
        if (item.analysis === 'SPEC_MIR' || item.analysis === 'MIR Soil Spectra') modality = 'MIR';
        axios.get('/api/spectral', { params: { modality, sampleId: id } })
            .then(res => {
                const scans = res.data.data;
                if (!scans || scans.length === 0) {
                    showInfo('No Data', `No spectral scan found for ${getAnalysisDisplayName(item.analysis, item.analysisName)}.`);
                    return;
                }
                const scan = scans.find(s => s.workItemId === item.id) || scans[0];
                axios.get(`/api/spectral/${scan.id}`).then(d => {
                    setSelectedSpectraScan(d.data);
                });
            })
            .catch(e => showInfo('Error', e.message));
    };

    if (loading && !workspace && !sample) {
        return <div className="p-12 text-center text-sf-muted bg-sf-canvas min-h-screen">{t('sampleDetail.loading', 'Loading sample workspace...')}</div>;
    }

    // Normalized Identity
    const identity = workspace?.identity || {
        id: sample?.id || id,
        labSampleCode: sample?.labId || 'Not assigned',
        fieldId: sample?.originalId || '—',
        matrix: sample?.matrix || 'SOIL',
        status: sample?.status || 'UNKNOWN',
        priority: sample?.priority || 'NORMAL',
        project: sample?.project || null,
        projectCode: sample?.projectCode || '',
        assignedLab: sample?.assignedLab || '—',
        dates: {
            receivedDateDisplay: sample?.receptionDate ? new Date(sample.receptionDate).toLocaleDateString() : (sample?.status === 'EXPECTED' ? 'Not yet received' : '—')
        }
    };

    const counters = workspace?.counters || {
        ordered: workItems.filter(w => !w.isGate && w.category !== 'Operational Gates').length,
        recorded: workItems.filter(w => ['COMPLETED', 'SUBMITTED', 'ACCEPTED'].includes(w.status)).length,
        submitted: workItems.filter(w => w.status === 'SUBMITTED').length,
        accepted: workItems.filter(w => w.status === 'ACCEPTED').length,
        omitted: workItems.filter(w => w.status === 'WAIVED').length,
        blocked: 0,
        derived: 0,
        unassigned: 0
    };

    const materialCustody = workspace?.materialCustody || {
        storageLocation: 'Not recorded',
        receivedMass: sample?.receivedMass,
        isDisposed: sample?.status === 'DISPOSED',
        isArchived: sample?.status === 'ARCHIVED'
    };

    const integrity = workspace?.integrity || {
        hasHistoricalGap: false,
        historicalGapCount: 0,
        issues: []
    };

    const capabilities = workspace?.capabilities || {
        canManageAnalyses: { allowed: isManager && !materialCustody.isDisposed },
        canReview: { allowed: isManager && counters.submitted > 0 },
        canReleaseReport: { allowed: isManager && !integrity.hasHistoricalGap && counters.accepted > 0 },
        canArchive: { allowed: isManager && sample?.status === 'APPROVED' },
        canDispose: { allowed: isManager && ['APPROVED', 'ARCHIVED'].includes(sample?.status) },
        canAmend: { allowed: isManager && ['APPROVED', 'ARCHIVED', 'DISPOSED'].includes(sample?.status) }
    };

    const nextAction = workspace?.nextAction || {
        label: 'View sample workspace',
        action: 'VIEW'
    };

    const currentReleasedReport = workspace?.currentReleasedReport || existingReport;

    return (
        <div className="min-h-screen bg-sf-canvas p-3 sm:p-6 text-left transition-colors duration-200">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* ─── 1. BREADCRUMB & CONTEXT ─── */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-sf-muted">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const returnTo = new URLSearchParams(location.search).get('returnTo');
                                if (returnTo) navigate(returnTo);
                                else navigate('/samples');
                            }}
                            className="inline-flex items-center gap-1 font-bold text-sf-muted hover:text-sf-primary transition-colors"
                        >
                            <ArrowLeft size={14} /> {new URLSearchParams(location.search).get('returnTo')?.includes('manager-queue') ? 'Back to queue' : 'Back to samples'}
                        </button>
                        <span>/</span>
                        <span>Sample workspace</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {activeMethodContext && (
                            <span className="inline-flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800 text-xs">
                                Queue Method: <strong>{getAnalysisDisplayName(activeMethodContext)}</strong>
                            </span>
                        )}
                        {refreshing && <RefreshCw size={13} className="animate-spin text-sf-primary" />}
                        <span className="font-semibold text-sf-muted bg-sf-raised px-2.5 py-1 rounded-full border border-sf-divider">
                            {roleBadgeText}
                        </span>
                    </div>
                </div>

                {/* ─── 2. ALWAYS-VISIBLE HEADER ─── */}
                <header className="bg-sf-surface rounded-2xl shadow-sm border border-sf-divider overflow-hidden">
                    {/* Decorative Soil-Band Brand Rule (Signature Identity) */}
                    <div className="sf-brand-rule w-full" aria-hidden="true" />

                    <div className="p-5 sm:p-6">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            {/* Identity Details (Laboratory Record Label) */}
                            <div className="border-l-4 border-l-[var(--sf-earth)] pl-4 space-y-1">
                                <div className="sf-kicker">Laboratory sample</div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <h1 className="text-2xl sm:text-3xl font-mono font-bold text-sf-text tracking-tight">
                                        {identity.labSampleCode !== 'Not assigned' ? identity.labSampleCode : identity.fieldId}
                                    </h1>
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--sf-blue-bg)] text-[var(--sf-blue)] border border-[var(--sf-blue)]/20">
                                        {identity.assignedLab}
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                        identity.status === 'APPROVED' || identity.status === 'ARCHIVED' ? 'bg-[var(--sf-success-bg)] text-[var(--sf-success)] border-[var(--sf-success)]/30' :
                                        identity.status === 'DISPOSED' ? 'bg-sf-inset text-sf-muted border-sf-divider' :
                                        'bg-[var(--sf-blue-bg)] text-[var(--sf-blue)] border-[var(--sf-blue)]/30'
                                    }`}>
                                        {getStatusLabel(identity.status, t)}
                                    </span>
                                    {identity.priority && identity.priority !== 'NORMAL' && (
                                        <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-[var(--sf-danger-bg)] text-[var(--sf-danger)] border border-[var(--sf-danger)]/30">
                                            {identity.priority}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-sf-muted font-mono">
                                    Canonical UUID: <span className="text-sf-text">{identity.id}</span>
                                    {identity.fieldId && identity.fieldId !== identity.labSampleCode && (
                                        <span className="ml-3">Field ID: <strong className="text-sf-text">{identity.fieldId}</strong></span>
                                    )}
                                </p>
                            </div>

                            {/* Prominent Action Bar (Top Right) */}
                            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                                {/* Primary Next Action Button */}
                                {nextAction?.action !== 'VIEW' && nextAction?.action !== 'VIEW_REPORT' && (
                                    <button
                                        onClick={() => {
                                            if (nextAction.action === 'RECEIVE') setReceiveModalOpen(true);
                                            else if (nextAction.action === 'ACCEPT_INTAKE') setAcceptIntakeModalOpen(true);
                                            else if (nextAction.action === 'ASSIGN') {
                                                handleFocusAssignment();
                                            }
                                            else if (nextAction.action === 'REVIEW') {
                                                setActiveTab('review');
                                                navigate({ search: `?tab=review` });
                                            }
                                            else if (nextAction.action === 'APPROVE') handleApproveSample();
                                            else if (nextAction.action === 'RELEASE_REPORT') setReportModalOpen(true);
                                            else if (nextAction.action === 'PREPARATION') setActiveTab('work');
                                        }}
                                        className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--sf-primary)] hover:brightness-95 text-[var(--sf-on-primary)] flex items-center gap-2 shadow-sm transition-all animate-pulse"
                                    >
                                        <ArrowRight size={14} />
                                        {nextAction.label}
                                    </button>
                                )}

                                {/* Manage Analyses */}
                                {capabilities.canManageAnalyses?.allowed && (
                                    <button
                                        onClick={() => setIsAnalysisModalOpen(true)}
                                        className="px-3 py-2 rounded-xl text-xs font-semibold border border-sf-divider hover:bg-sf-hover text-sf-text flex items-center gap-1.5 transition-colors"
                                    >
                                        <Sliders size={14} className="text-sf-primary" />
                                        Manage analyses
                                    </button>
                                )}

                                {/* Print Label */}
                                <button
                                    onClick={() => setPrintTarget(sample || { id, labId: identity?.labSampleCode, originalId: identity?.fieldId, receptionDate: sample?.receptionDate || sample?.custodyHandoverAt || null, custodyHandoverAt: sample?.custodyHandoverAt || null, collectionDate: sample?.collectionDate || identity?.collectionDate || null, status: sample?.status })}
                                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-sf-divider hover:bg-sf-hover text-sf-text flex items-center gap-1.5 transition-colors"
                                >
                                    <Printer size={14} className="text-sf-primary" />
                                    Print label
                                </button>

                                {/* Workflow Map */}
                                <button
                                    onClick={() => navigate(`/workflow-map?sampleId=${id}`)}
                                    className="px-3 py-2 rounded-xl text-xs font-semibold border border-sf-divider hover:bg-sf-hover text-sf-text flex items-center gap-1.5 transition-colors"
                                >
                                    <Map size={14} className="text-[var(--sf-earth)]" />
                                    Workflow map
                                </button>

                                {/* View Report vN shortcut */}
                                {currentReleasedReport && (
                                    <button
                                        onClick={() => handleViewReport(currentReleasedReport.id)}
                                        className="px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--sf-success-bg)] text-[var(--sf-success)] border border-[var(--sf-success)]/30 hover:brightness-95 flex items-center gap-1.5 transition-colors"
                                    >
                                        <FileText size={14} />
                                        View report v{currentReleasedReport.version || 1}
                                    </button>
                                )}

                                {/* Open in Workbench Shortcut */}
                                <button
                                    onClick={() => navigate(`/workbench?sampleId=${sample?.id || id}`)}
                                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--sf-selected)] text-sf-primary border border-sf-divider hover:bg-sf-hover flex items-center gap-1.5 transition-colors"
                                    title="Open sample tasks in Technician Workbench"
                                >
                                    <span>Open in Workbench →</span>
                                </button>

                                {/* Final Approve Sample Button */}
                                {isManager && identity.status !== 'APPROVED' && (() => {
                                    const isFinalApprovalAllowed = capabilities?.canFinalApprove ? capabilities.canFinalApprove.allowed : false;
                                    const blockReason = capabilities?.canFinalApprove?.reason || (capabilities?.canFinalApprove?.blockers && capabilities.canFinalApprove.blockers[0]) || '';
                                    return (
                                        <button
                                            onClick={handleApproveSample}
                                            data-testid="final-approve-sample-btn"
                                            disabled={!isFinalApprovalAllowed}
                                            title={!isFinalApprovalAllowed ? `Approval blocked: ${blockReason}` : 'Authorize final completion for this sample'}
                                            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm ${
                                                !isFinalApprovalAllowed
                                                    ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-sf-divider opacity-70'
                                                    : 'bg-sf-primary hover:brightness-95 text-sf-on-primary'
                                            }`}
                                        >
                                            <ShieldCheck size={14} />
                                            Final approve sample
                                        </button>
                                    );
                                })()}

                                {/* More Actions Dropdown */}
                                <div className="relative" ref={moreActionsRef}>
                                    <button
                                        onClick={() => setMoreActionsOpen(!moreActionsOpen)}
                                        className="p-2 rounded-xl border border-sf-divider hover:bg-sf-hover text-sf-muted transition-colors"
                                        title="More actions"
                                    >
                                        <MoreHorizontal size={16} />
                                    </button>

                                    {moreActionsOpen && (
                                        <div className="absolute right-0 mt-2 w-56 bg-sf-surface rounded-xl shadow-xl border border-sf-divider py-1.5 z-50 animate-in fade-in slide-in-from-top-2">
                                            {capabilities.canArchive?.allowed && (
                                                <button
                                                    onClick={() => { setMoreActionsOpen(false); handleArchive(); }}
                                                    className="w-full text-left px-4 py-2 text-xs font-semibold text-sf-text hover:bg-sf-hover flex items-center gap-2"
                                                >
                                                    <Package size={14} /> Archive sample
                                                </button>
                                            )}
                                            {capabilities.canDispose?.allowed && (
                                                <button
                                                    onClick={() => { setMoreActionsOpen(false); handleDispose(); }}
                                                    className="w-full text-left px-4 py-2 text-xs font-semibold text-[var(--sf-danger)] hover:bg-[var(--sf-danger-bg)] flex items-center gap-2"
                                                >
                                                    <XCircle size={14} /> Dispose material
                                                </button>
                                            )}
                                            {identity.status === 'RECEIVED' && isReception && (
                                                <button
                                                    onClick={() => { setMoreActionsOpen(false); handleUndoIntake(); }}
                                                    className="w-full text-left px-4 py-2 text-xs font-semibold text-[var(--sf-warning)] hover:bg-[var(--sf-warning-bg)] flex items-center gap-2"
                                                >
                                                    <RotateCcw size={14} /> Undo intake
                                                </button>
                                            )}
                                            {['APPROVED', 'ARCHIVED'].includes(identity.status) && isManager && (
                                                <button
                                                    onClick={() => { setMoreActionsOpen(false); setUndoApprovalModal({ isOpen: true, reason: '' }); }}
                                                    className="w-full text-left px-4 py-2 text-xs font-semibold text-[var(--sf-earth)] hover:bg-[var(--sf-earth-bg)] flex items-center gap-2"
                                                >
                                                    <RotateCcw size={14} /> Undo final approval
                                                </button>
                                            )}
                                            {capabilities.canAmend?.allowed && (
                                                <button
                                                    onClick={() => { setMoreActionsOpen(false); setAmendmentModal({ isOpen: true, type: 'CLERICAL', reason: '', impact: '' }); }}
                                                    className="w-full text-left px-4 py-2 text-xs font-semibold text-[var(--sf-blue)] hover:bg-[var(--sf-blue-bg)] flex items-center gap-2"
                                                >
                                                    <FileText size={14} /> Start report amendment
                                                </button>
                                            )}
                                            <button
                                                onClick={() => { setMoreActionsOpen(false); fetchWorkspaceData(); }}
                                                className="w-full text-left px-4 py-2 text-xs font-semibold text-sf-muted hover:bg-sf-hover flex items-center gap-2"
                                            >
                                                <RefreshCw size={14} /> Refresh projection
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Four Column Laboratory Record Metadata Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 mt-4 border-t border-sf-divider">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-sf-muted tracking-wider block mb-0.5">Project</span>
                                <strong className="text-xs text-sf-text font-semibold">{identity.project?.name || identity.projectCode || 'None'}</strong>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-bold text-sf-muted tracking-wider block mb-0.5">Matrix</span>
                                <strong className="text-xs text-sf-text font-semibold">{identity.matrix}</strong>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-bold text-sf-muted tracking-wider block mb-0.5">Received mass</span>
                                <strong className="text-xs text-sf-text font-semibold">{materialCustody.receivedMass ? `${materialCustody.receivedMass} g` : 'Not recorded'}</strong>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-bold text-sf-muted tracking-wider block mb-0.5">Storage location</span>
                                <strong className="text-xs text-sf-text font-semibold">{materialCustody.storageLocation || 'Not recorded'}</strong>
                            </div>
                        </div>
                    </div>

                    {/* Operational Summary Sub-row */}
                    <div className="px-5 sm:px-6 py-3 bg-sf-inset border-t border-sf-divider flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2 font-medium text-sf-muted">
                            <span className="font-semibold text-sf-text">{getStatusLabel(identity.status, t)}</span>
                            <span>·</span>
                            <span><strong>{counters.ordered}</strong> ordered analyses</span>
                            {counters.derived > 0 && (
                                <>
                                    <span>·</span>
                                    <span className="text-sf-muted"><strong>{counters.derived}</strong> derived fractions</span>
                                </>
                            )}
                            <span>·</span>
                            <span><strong>{counters.accepted}</strong> verified results</span>
                            {counters.submitted > 0 && (
                                <>
                                    <span>·</span>
                                    <span className="text-[var(--sf-primary)] font-bold"><strong>{counters.submitted}</strong> submitted for review</span>
                                </>
                            )}
                            {counters.blocked > 0 && (
                                <>
                                    <span>·</span>
                                    <span className="text-[var(--sf-warning)] font-bold">review blocked</span>
                                </>
                            )}
                        </div>
                        <div className="text-sf-muted">
                            {materialCustody.isDisposed ? (
                                <span className="text-[var(--sf-danger)] font-semibold">Material: disposed · no retained aliquot</span>
                            ) : (
                                <span>Material: {materialCustody.receivedMass ? `${materialCustody.receivedMass} g` : 'Not recorded'} · Location: <strong>{materialCustody.storageLocation || 'Not recorded'}</strong></span>
                            )}
                        </div>
                    </div>
                </header>

                {/* ─── 3. ORDER INTEGRITY WARNING (W001: Order Revision vs Tasks Mismatch) ─── */}
                {(workspace?.orderIntegrityWarning || workspace?.order?.warning) && (
                    <div className="p-4 sm:p-5 bg-[var(--sf-danger-bg)] border-l-4 border-l-[var(--sf-danger)] rounded-xl shadow-sm text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 font-bold text-[var(--sf-danger)]">
                                    <AlertTriangle size={18} className="text-[var(--sf-danger)] flex-shrink-0" />
                                    <span>Order & Analysis Discrepancy Detected</span>
                                </div>
                                <p className="text-xs text-sf-text leading-relaxed">
                                    {(workspace?.orderIntegrityWarning || workspace?.order?.warning)?.message}
                                </p>
                            </div>
                            {isManager && (
                                <button
                                    onClick={() => setIsAnalysisModalOpen(true)}
                                    className="px-3.5 py-1.5 bg-[var(--sf-danger)] hover:brightness-95 text-white rounded-lg text-xs font-bold shadow transition-colors flex-shrink-0"
                                >
                                    Reconcile analyses
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── 3B. HISTORICAL EVIDENCE GAP ALERT (Finding S003) ─── */}
                {integrity.hasHistoricalGap && (
                    <div className="p-4 sm:p-5 bg-[var(--sf-warning-bg)] border-l-4 border-l-[var(--sf-warning)] rounded-xl shadow-sm text-left">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 font-bold text-[var(--sf-warning)]">
                                    <AlertTriangle size={18} className="text-[var(--sf-warning)] flex-shrink-0" />
                                    Historical approval — evidence needs verification
                                </div>
                                <p className="text-xs text-sf-text leading-relaxed">
                                    {integrity.historicalGapCount} analysis record(s) are marked ACCEPTED without linked raw results, valid spectral scans, or an authorized waiver. Report release is blocked until records are verified.
                                </p>
                            </div>
                            <button
                                onClick={() => setActiveTab('work')}
                                className="px-3.5 py-1.5 bg-[var(--sf-warning)] hover:brightness-95 text-white rounded-lg text-xs font-bold shadow transition-colors flex-shrink-0"
                            >
                                Inspect work & evidence
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── 4. OPERATIONAL NEXT ACTION BANNER ─── */}
                <div className="bg-[var(--sf-selected)] rounded-xl p-4 sm:p-5 border border-sf-divider border-l-4 border-l-sf-primary flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                    <div className="space-y-0.5">
                        <span className="sf-kicker">Recommended Next Action</span>
                        <h3 className="font-bold text-sf-text text-base">
                            {integrity.hasHistoricalGap ? 'Resolve the historical evidence gap' : nextAction.label}
                        </h3>
                        <p className="text-xs text-sf-muted">
                            {integrity.hasHistoricalGap ? 'Manager · Inspect recorded acceptance decisions and verify original physical records.' :
                             counters.submitted > 0 ? 'Manager · Inspect submitted evidence and QC before accepting.' :
                             identity.status === 'EXPECTED' ? 'Reception · Confirm physical specimen condition, label, and requested methods.' :
                             currentReleasedReport ? 'Report v' + (currentReleasedReport.version || 1) + ' is the released record. Subsequent changes require an amendment.' :
                             (nextAction.action === 'ASSIGN' || (counters.unassigned > 0 && isManager)) ? 'Manager · Assign unassigned analytical tasks to laboratory technicians for testing.' :
                             'Technician · Record laboratory results and submit package for managerial review.'}
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            if (integrity.hasHistoricalGap) setActiveTab('work');
                            else if (counters.submitted > 0) setActiveTab('review');
                            else if (identity.status === 'EXPECTED' || identity.status === 'RECEIVED') setActiveTab('request');
                            else if (currentReleasedReport) handleViewReport();
                            else if (counters.accepted >= counters.ordered && counters.ordered > 0) setActiveTab('reports');
                            else if (nextAction.action === 'ASSIGN' || (counters.unassigned > 0 && isManager)) handleFocusAssignment();
                            else setActiveTab('work');
                        }}
                        className="px-5 py-2.5 bg-sf-primary text-sf-on-primary hover:brightness-95 rounded-xl text-xs font-bold shadow-sm transition-all flex-shrink-0"
                    >
                        {integrity.hasHistoricalGap ? 'Inspect evidence' :
                         counters.submitted > 0 ? 'Review submission' :
                         identity.status === 'EXPECTED' ? 'Review intake' :
                         currentReleasedReport ? 'View report' :
                         counters.accepted >= counters.ordered && counters.ordered > 0 ? 'Preview report' :
                         (nextAction.action === 'ASSIGN' || (counters.unassigned > 0 && isManager)) ? 'Assign to technician' :
                         'Open worksheet'}
                    </button>
                </div>

                {/* ─── 5. FIVE TABS NAVIGATION ─── */}
                <nav className="flex items-center gap-1 border-b border-sf-divider overflow-x-auto" aria-label="Sample sections">
                    <button
                        onClick={() => setActiveTab('work')}
                        className={`px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                            activeTab === 'work' ? 'border-sf-primary text-sf-primary font-bold' : 'border-transparent text-sf-muted hover:text-sf-text'
                        }`}
                    >
                        <Layers size={15} />
                        Work & results
                        <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-sf-inset text-sf-muted border border-sf-divider">
                            {counters.ordered}
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('review')}
                        className={`px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                            activeTab === 'review' ? 'border-sf-primary text-sf-primary font-bold' : 'border-transparent text-sf-muted hover:text-sf-text'
                        }`}
                    >
                        <ShieldCheck size={15} />
                        Review
                        {counters.submitted > 0 && (
                            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-[var(--sf-blue-bg)] text-[var(--sf-blue)] font-bold border border-[var(--sf-blue)]/20">
                                {counters.submitted}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('request')}
                        className={`px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                            activeTab === 'request' ? 'border-sf-primary text-sf-primary font-bold' : 'border-transparent text-sf-muted hover:text-sf-text'
                        }`}
                    >
                        <Package size={15} />
                        Sample & request
                    </button>

                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                            activeTab === 'reports' ? 'border-sf-primary text-sf-primary font-bold' : 'border-transparent text-sf-muted hover:text-sf-text'
                        }`}
                    >
                        <FileText size={15} />
                        Reports
                        {workspace?.reports?.length > 0 && (
                            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-[var(--sf-success-bg)] text-[var(--sf-success)] font-bold border border-[var(--sf-success)]/20">
                                {workspace.reports.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                            activeTab === 'history' ? 'border-sf-primary text-sf-primary font-bold' : 'border-transparent text-sf-muted hover:text-sf-text'
                        }`}
                    >
                        <HistoryIcon size={15} />
                        History
                    </button>
                </nav>

                {/* ─── 6. TAB CONTENT PANELS ─── */}

                {activeTab === 'work' && (
                    <div className="space-y-6">
                        {/* Preparation Gates Card */}
                        <div className="bg-sf-surface rounded-2xl p-5 border border-sf-divider shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-sf-muted">{t('sampleDetail.prepPrerequisites', 'Preparation Prerequisites')}</h3>
                                <button
                                    onClick={() => navigate(`/workbench?sampleId=${sample?.id || id}`)}
                                    className="text-xs font-semibold text-sf-emerald hover:underline flex items-center gap-1"
                                >
                                    <span>{t('sampleDetail.executeInWorkbench', 'Execute in Workbench →')}</span>
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-sf-canvas border border-sf-divider flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-sf-text text-sm">{t('dynamic.gate.DRYING.name', t('workflow.airDrying', 'Air Drying'))}</div>
                                        <div className="text-xs text-sf-muted mt-0.5">
                                            {workspace?.operationalGates?.drying?.receipt?.schemaVersion || 'operational-checklist-v1'} · {t('sampleDetail.constantWeight', 'Constant weight')}
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                        workspace?.operationalGates?.drying?.isDone || sample?.dryingStatus === 'DONE'
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                    }`}>
                                        {workspace?.operationalGates?.drying?.isDone || sample?.dryingStatus === 'DONE' ? t('status.COMPLETED', 'Completed') : t('status.PENDING', 'Pending')}
                                    </span>
                                </div>

                                <div className="p-4 rounded-xl bg-sf-canvas border border-sf-divider flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-sf-text text-sm">{t('dynamic.gate.PREPARATION.name', t('workflow.samplePreparation', 'Sample Preparation'))}</div>
                                        <div className="text-xs text-sf-muted mt-0.5">
                                            {workspace?.operationalGates?.preparation?.receipt?.schemaVersion || 'operational-checklist-v1'} · {t('sampleDetail.homogenizedFraction', 'Homogenized fraction')}
                                        </div>
                                    </div>
                                    {(() => {
                                        const isPrepDone = workspace?.operationalGates?.preparation?.isDone || sample?.preparationStatus === 'DONE';
                                        const hasReceipt = !!workspace?.operationalGates?.preparation?.receipt?.receiptId;
                                        const isGap = isPrepDone && !hasReceipt;

                                        if (isGap) {
                                            return (
                                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 flex items-center gap-1">
                                                    <AlertTriangle size={12} />
                                                    {t('sampleDetail.evidenceNeedsVerification', 'Evidence needs verification')}
                                                </span>
                                            );
                                        }

                                        return (
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                                isPrepDone
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                            }`}>
                                                {isPrepDone ? t('status.COMPLETED', 'Completed') : t('status.PENDING', 'Pending')}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Ordered Analyses Table */}
                        <div id="ordered-analyses-table" className="bg-sf-surface rounded-2xl shadow-sm border border-sf-divider overflow-hidden">
                            <div className="p-4 border-b border-sf-divider flex flex-wrap items-center justify-between gap-3">
                                <h3 className="font-bold text-sf-text text-sm flex items-center gap-2">
                                    <span>Ordered Analyses ({counters.ordered ?? workItems.filter(w => !w.isGate && w.category !== 'Operational Gates').length})</span>
                                    {counters.derived > 0 && (
                                        <span className="text-xs font-normal text-sf-muted">
                                            (+{counters.derived} derived fraction{counters.derived > 1 ? 's' : ''})
                                        </span>
                                    )}
                                    {activeMethodContext && (
                                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                                            Queue Context: {getAnalysisDisplayName(activeMethodContext)}
                                        </span>
                                    )}
                                </h3>
                                <div className="text-xs text-sf-muted flex items-center gap-2">
                                    {counters.unassigned > 0 && (
                                        <span className="text-amber-600 font-semibold bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                                            {counters.unassigned} unassigned
                                        </span>
                                    )}
                                    <span>{isTech ? 'Showing all analyses (assigned highlighted)' : 'All analytical tasks visible'}</span>
                                </div>
                            </div>

                            <WorkItemsTable
                                workItems={workItems}
                                isGateOpen={workspace?.operationalGates?.allGatesPassed || (sample?.dryingStatus === 'DONE' && sample?.preparationStatus === 'DONE')}
                                onUpdateStatus={handleUpdateStatus}
                                onAssignmentSuccess={() => fetchWorkspaceData(true)}
                                onReview={handleReviewItem}
                                onReviewBulk={handleReviewBulk}
                                selectedWorkItemIds={selectedWorkItemIds}
                                onSelectionChange={setSelectedWorkItemIds}
                                methodContext={activeMethodContext}
                                sampleId={identity.id || id}
                            />
                        </div>

                        {/* Review Coverage & Counters Card */}
                        <div className="bg-sf-surface rounded-2xl p-5 border border-sf-divider shadow-sm">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-sf-muted mb-3">Scientific Review Coverage</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-center">
                                <div className="p-3 bg-sf-canvas rounded-xl">
                                    <div className="text-xl font-bold text-sf-text">{counters.ordered}</div>
                                    <div className="text-[11px] text-sf-muted uppercase font-semibold">Ordered</div>
                                </div>
                                <div className="p-3 bg-sf-canvas rounded-xl">
                                    <div className="text-xl font-bold text-blue-600">{counters.recorded}</div>
                                    <div className="text-[11px] text-sf-muted uppercase font-semibold">Recorded</div>
                                </div>
                                <div className="p-3 bg-sf-canvas rounded-xl">
                                    <div className="text-xl font-bold text-purple-600">{counters.submitted}</div>
                                    <div className="text-[11px] text-sf-muted uppercase font-semibold">Submitted</div>
                                </div>
                                <div className="p-3 bg-sf-canvas rounded-xl">
                                    <div className="text-xl font-bold text-emerald-600">{counters.accepted}</div>
                                    <div className="text-[11px] text-sf-muted uppercase font-semibold">Accepted</div>
                                </div>
                                <div className="p-3 bg-sf-canvas rounded-xl">
                                    <div className="text-xl font-bold text-gray-500">{counters.omitted}</div>
                                    <div className="text-[11px] text-sf-muted uppercase font-semibold">Omitted</div>
                                </div>
                                <div className="p-3 bg-sf-canvas rounded-xl">
                                    <div className="text-xl font-bold text-amber-600">{counters.blocked}</div>
                                    <div className="text-[11px] text-sf-muted uppercase font-semibold">Blocked</div>
                                </div>
                            </div>
                            <p className="text-xs text-sf-muted mt-3 text-center">
                                Only submitted evidence can be reviewed and accepted. Blanket approval without submitted evidence is prohibited.
                            </p>
                        </div>
                    </div>
                )}

                {/* TAB 2: REVIEW */}
                {activeTab === 'review' && (
                    <div className="space-y-6">
                        {counters.submitted === 0 ? (
                            <div className="bg-sf-surface rounded-2xl p-8 border border-sf-divider text-center space-y-4 shadow-sm">
                                <div className="w-12 h-12 rounded-full bg-sf-raised flex items-center justify-center mx-auto text-sf-muted">
                                    <ShieldCheck size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sf-text text-base">No reviewable submission pending</h3>
                                    <p className="text-xs text-sf-muted max-w-md mx-auto mt-1">
                                        {integrity.hasHistoricalGap
                                            ? 'Accepted labels do not establish that testing or submission occurred. Investigate the original records.'
                                            : 'Recorded laboratory work must be frozen and submitted by an analyst before managerial review can proceed.'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setActiveTab('work')}
                                    className="px-4 py-2 bg-sf-canvas text-sf-emerald border border-sf-divider rounded-xl text-xs font-bold hover:bg-sf-raised transition-colors"
                                >
                                    View work & evidence
                                </button>
                            </div>
                        ) : (
                            <div className="bg-sf-surface rounded-2xl p-6 border border-sf-divider shadow-sm space-y-6">
                                <div className="flex flex-wrap justify-between items-center gap-3 border-b border-sf-divider pb-4">
                                    <div>
                                        <h3 className="text-base font-bold text-sf-text flex items-center gap-2">
                                            <ShieldCheck size={20} className="text-purple-600" />
                                            Review Submitted Package ({counters.submitted} item(s))
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Freeze snapshot • Inspect evidence, method revisions, and batch QC status
                                        </p>
                                    </div>
                                    <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold text-xs rounded-full">
                                        Awaiting review
                                    </span>
                                </div>

                                {/* Items awaiting review */}
                                <div className="space-y-3">
                                    {workItems.filter(w => w.status === 'SUBMITTED').map(item => (
                                        <div key={item.id} className="p-4 rounded-xl border border-sf-divider bg-sf-canvas flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sf-text text-sm">{getAnalysisDisplayName(item.analysis, item.analysisName)}</span>
                                                    <span className="text-xs text-gray-400">({item.category || 'Analytical'})</span>
                                                </div>
                                                <div className="text-xs text-gray-500 flex flex-wrap gap-3">
                                                    <span>Assigned: <strong>{item.assigneeName || item.assignedTo || 'Technician'}</strong></span>
                                                    <span>Method: <strong>{item.methodology?.name || 'Standard'}</strong></span>
                                                    <span>QC: <strong className={item.qcStatus === 'QC_FAIL' ? 'text-red-500' : 'text-emerald-500'}>{item.qcStatus || 'PASS'}</strong></span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="font-mono font-bold text-base text-sf-text">
                                                    {workItemEvidenceText(item)}
                                                </div>
                                                <button
                                                    onClick={() => setInspectedItem(item)}
                                                    className="px-3 py-1.5 bg-sf-surface border border-sf-divider rounded-lg text-xs font-bold hover:bg-sf-raised text-sf-text transition-colors"
                                                >
                                                    Inspect
                                                </button>
                                                {isManager && (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleReviewItem(item.id, 'ACCEPTED')}
                                                            className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors"
                                                            title="Accept Item"
                                                        >
                                                            <Check size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setReturningSubmissionId(item.id);
                                                                setReturnReason('');
                                                            }}
                                                            className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                                            title="Return for correction"
                                                        >
                                                            <X size={16} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Confirmation & Bulk Accept */}
                                {isManager && (
                                    <div className="pt-4 border-t border-sf-divider space-y-4">
                                        <label className="flex items-start gap-3 cursor-pointer text-xs text-sf-muted">
                                            <input
                                                type="checkbox"
                                                checked={reviewChecked}
                                                onChange={(e) => setReviewChecked(e.target.checked)}
                                                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span>I have independently checked the submitted raw evidence, instrument qualifications, and QC batch results for these items.</span>
                                        </label>

                                        <div className="flex flex-wrap items-center justify-end gap-3">
                                            <button
                                                onClick={() => {
                                                    const subItems = workItems.filter(w => w.status === 'SUBMITTED');
                                                    handleReviewBulk(subItems.map(i => i.id), 'ACCEPTED');
                                                }}
                                                disabled={!reviewChecked}
                                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow transition-colors"
                                            >
                                                Accept {counters.submitted} submitted result(s)
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 3: SAMPLE & REQUEST */}
                {activeTab === 'request' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Request & Identity Card */}
                            <div className="bg-sf-surface rounded-2xl p-6 border border-sf-divider shadow-sm space-y-4">
                                <h3 className="font-bold text-sf-text text-base">Request & Laboratory Accession</h3>
                                <div className="space-y-3 text-xs">
                                    <div className="flex justify-between py-1.5 border-b border-sf-divider">
                                        <span className="text-sf-muted">Accession Code</span>
                                        <span className="font-bold font-mono">{identity.labSampleCode}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-sf-divider">
                                        <span className="text-sf-muted">Field Sample ID</span>
                                        <span className="font-bold font-mono">{identity.fieldId}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-sf-divider">
                                        <span className="text-sf-muted">Date Received</span>
                                        <span className="font-semibold">{identity.dates?.receivedDateDisplay || 'Not yet received'}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-sf-divider">
                                        <span className="text-sf-muted">Owning Laboratory</span>
                                        <span className="font-semibold">{identity.assignedLab}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-sf-divider">
                                        <span className="text-sf-muted">Client / Submitter</span>
                                        <span className="font-semibold">{workspace?.identity?.clientName || 'Not recorded'}</span>
                                    </div>
                                </div>

                                {capabilities.canManageAnalyses?.allowed && (
                                    <button
                                        onClick={() => setIsAnalysisModalOpen(true)}
                                        className="w-full py-2 bg-sf-canvas hover:bg-sf-raised text-sf-text rounded-xl text-xs font-bold border border-sf-divider transition-colors"
                                    >
                                        Change requested analyses (Revision {workspace?.order?.revisionNumber || 1})
                                    </button>
                                )}
                            </div>

                            {/* Physical Material & Custody */}
                            <div className="bg-sf-surface rounded-2xl p-6 border border-sf-divider shadow-sm space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-sf-text text-base">Physical Material & Custody</h3>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                        materialCustody.isDisposed ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                        {materialCustody.isDisposed ? 'DISPOSED' : materialCustody.isArchived ? 'ARCHIVED' : 'ACTIVE'}
                                    </span>
                                </div>

                                <div className="space-y-3 text-xs">
                                    <div className="flex justify-between py-1.5 border-b border-sf-divider">
                                        <span className="text-sf-muted">Available Mass</span>
                                        <span className="font-semibold">{materialCustody.receivedMass ? `${materialCustody.receivedMass} g` : 'Not recorded'}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-sf-divider">
                                        <span className="text-sf-muted">Storage Location</span>
                                        <span className="font-bold font-mono">{materialCustody.storageLocation || 'Not recorded'}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-sf-divider">
                                        <span className="text-sf-muted">Custody Carrier</span>
                                        <span className="font-semibold">{materialCustody.carrierName || 'Not recorded'}</span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-sf-divider">
                                        <span className="text-sf-muted">Receiving Officer</span>
                                        <span className="font-semibold">{materialCustody.receivingOfficerName || 'Not recorded'}</span>
                                    </div>
                                </div>

                                {!materialCustody.isDisposed && (
                                    <button
                                        onClick={() => setStorageModalOpen(true)}
                                        className="w-full py-2 bg-sf-canvas text-sf-emerald border border-sf-divider hover:bg-sf-raised rounded-xl text-xs font-bold transition-colors"
                                    >
                                        Record storage movement
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Intake Condition Card */}
                        <IntakeRequestCard sample={sample || identity} />

                        {/* Expandable Field Metadata & Map */}
                        <div className="bg-sf-surface rounded-2xl p-6 border border-sf-divider shadow-sm space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-sf-text text-sm">Field Collection Metadata & Coordinates</h3>
                                    <p className="text-xs text-sf-muted">Source provenance and GPS location map</p>
                                </div>
                                <button
                                    onClick={() => setShowFieldMetadata(!showFieldMetadata)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-sf-divider hover:bg-sf-raised text-sf-text transition-colors"
                                >
                                    {showFieldMetadata ? 'Hide details' : 'View full field data'}
                                </button>
                            </div>

                            {showFieldMetadata && (
                                <div className="space-y-4 pt-3 border-t border-sf-divider">
                                    <FieldMetadataCard
                                        sample={sample || identity}
                                        canEdit={['INTAKE_OFFICER', 'LAB_MANAGER', 'SUPER_ADMIN'].includes(userRole)}
                                        onUpdateMetadata={handleUpdateMetadata}
                                    />
                                    <div className="h-[250px] rounded-xl overflow-hidden border border-sf-divider">
                                        <FieldMap sample={sample || identity} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 4: REPORTS */}
                {activeTab === 'reports' && (
                    <div className="space-y-6">
                        <div className="bg-sf-surface rounded-2xl p-6 border border-sf-divider shadow-sm space-y-6">
                            <div className="flex flex-wrap justify-between items-center gap-3 border-b border-sf-divider pb-4">
                                <div>
                                    <h3 className="font-bold text-sf-text text-base">Analytical Report Releases</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">Immutable certificate snapshots authorized by laboratory sign-off</p>
                                </div>
                                {currentReleasedReport ? (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                        Report v{currentReleasedReport.version || 1} Released
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-sf-raised text-sf-muted border border-sf-divider">
                                        DRAFT • Not Released
                                    </span>
                                )}
                            </div>

                            {/* Release Eligibility Check */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 bg-sf-canvas rounded-xl border border-sf-divider">
                                    <span className="block text-[11px] uppercase font-bold text-gray-400 mb-1">Coverage Status</span>
                                    <div className="font-bold text-sf-text text-sm">
                                        {counters.accepted} of {counters.ordered} required results reviewed & accepted
                                    </div>
                                </div>
                                <div className="p-4 bg-sf-canvas rounded-xl border border-sf-divider">
                                    <span className="block text-[11px] uppercase font-bold text-gray-400 mb-1">Release Integrity Check</span>
                                    <div className="font-bold text-sm">
                                        {integrity.hasHistoricalGap ? (
                                            <span className="text-amber-600 flex items-center gap-1.5">
                                                <AlertTriangle size={15} /> Blocked by historical evidence gap
                                            </span>
                                        ) : counters.submitted > 0 ? (
                                            <span className="text-purple-600 flex items-center gap-1.5">
                                                <Clock size={15} /> Blocked: {counters.submitted} review(s) pending
                                            </span>
                                        ) : counters.accepted > 0 && counters.accepted >= counters.ordered ? (
                                            <span className="text-emerald-600 flex items-center gap-1.5">
                                                <CheckCircle size={15} /> Ready for official release
                                            </span>
                                        ) : (
                                            <span className="text-sf-muted">Incomplete laboratory analysis</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Release / View Actions */}
                            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-sf-divider">
                                {currentReleasedReport ? (
                                    <>
                                        <button
                                            onClick={() => handleViewReport(currentReleasedReport.id)}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition-colors"
                                        >
                                            <Eye size={14} /> View Report v{currentReleasedReport.version || 1}
                                        </button>
                                        {isManager && (
                                            <button
                                                onClick={() => setAmendmentModal({ isOpen: true, type: 'CLERICAL', reason: '', impact: '' })}
                                                className="px-4 py-2 border border-sf-divider hover:bg-sf-raised text-sf-text rounded-xl text-xs font-bold transition-colors"
                                            >
                                                Start amendment
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <button
                                        onClick={handleGenerateReport}
                                        disabled={!capabilities.canReleaseReport?.allowed}
                                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-md transition-all"
                                    >
                                        Authorize & release report
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 5: HISTORY */}
                {activeTab === 'history' && (
                    <div className="bg-sf-surface rounded-2xl p-6 border border-sf-divider shadow-sm space-y-4">
                        <h3 className="font-bold text-sf-text text-base">Traceable Event Audit Trail</h3>
                        <div className="divide-y divide-sf-divider text-xs">
                            {history && history.length > 0 ? (
                                history.map((event, idx) => (
                                    <div key={event.id || idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="space-y-0.5">
                                            <div className="font-bold text-sf-text flex items-center gap-2">
                                                <span>{event.action || event.entity}</span>
                                                {event.action?.includes('BULK') && (
                                                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.2 rounded font-mono">
                                                        bulk verification required
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-gray-500">{event.details || 'Action completed'}</div>
                                        </div>
                                        <div className="text-gray-400 font-mono text-[11px] sm:text-right">
                                            <div>{event.performedBy || 'System'}</div>
                                            <div>{event.timestamp ? new Date(event.timestamp).toLocaleString() : '—'}</div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-8 text-center text-gray-400 italic">No events recorded in audit log.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ─── MODALS & UTILITIES ─── */}

            {/* Label Print Dialog */}
            <LabelPrintDialog
                isOpen={!!printTarget}
                onClose={() => setPrintTarget(null)}
                sample={printTarget}
            />

            {/* Analysis Update Modal */}
            <AnalysisUpdateModal
                sample={sample || identity}
                isOpen={isAnalysisModalOpen}
                onClose={() => setIsAnalysisModalOpen(false)}
                onUpdateSuccess={() => {
                    fetchWorkspaceData();
                    showInfo(t('common.success', 'Success'), 'Analysis requirements updated. Order revision committed.');
                }}
            />

            {/* Storage Movement Modal */}
            <StorageMovementModal
                sampleId={id}
                currentLocation={materialCustody.storageLocation}
                isOpen={storageModalOpen}
                onClose={() => setStorageModalOpen(false)}
                onSuccess={() => {
                    fetchWorkspaceData(true);
                    showInfo(t('common.success', 'Success'), 'Storage movement recorded.');
                }}
            />

            {/* Evidence Inspection Modal */}
            <EvidenceInspectionModal
                item={inspectedItem}
                sample={sample || identity}
                isOpen={!!inspectedItem}
                onClose={() => setInspectedItem(null)}
                onViewSpectra={handleOpenSpectra}
            />

            {/* Spectra Viewer Modal */}
            {selectedSpectraScan && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
                    <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-sf-divider">
                        <div className="px-6 py-4 border-b border-sf-divider flex justify-between items-center">
                            <h3 className="font-bold text-sf-text">Linked Spectral Scan — {selectedSpectraScan.sampleId}</h3>
                            <button onClick={() => setSelectedSpectraScan(null)} className="p-1 hover:bg-sf-raised rounded text-sf-muted"><X size={20} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <SpectraViewer scan={selectedSpectraScan} />
                        </div>
                    </div>
                </div>
            )}

            {/* Report Viewer Modal */}
            {reportModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[130] flex items-center justify-center p-4">
                    <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-sf-divider">
                        <div className="px-6 py-4 border-b border-sf-divider flex justify-between items-center bg-sf-surface no-print">
                            <div>
                                <h2 className="text-xl font-black text-sf-text flex items-center gap-2">
                                    <FileText size={20} className="text-indigo-600" />
                                    Report — {reportModal.sampleLabId || reportModal.sampleId?.slice(0, 8)}
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">Version {reportModal.version} • Generated {reportModal.generatedAt ? new Date(reportModal.generatedAt).toLocaleDateString('en-GB') : '—'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => window.print()} className="p-2.5 hover:bg-sf-raised rounded-xl text-sf-emerald transition-colors" title="Print">
                                    <Printer size={20} />
                                </button>
                                <button onClick={() => setReportModal(null)} className="p-2.5 hover:bg-sf-raised rounded-xl text-sf-muted transition-colors">
                                    <XCircle size={24} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 bg-sf-canvas" data-surface="paper">
                            <ReportContent data={reportModal.content ? (typeof reportModal.content === 'string' ? JSON.parse(reportModal.content) : reportModal.content) : reportModal} showActions />
                        </div>
                    </div>
                </div>
            )}

            {/* Return for Correction Modal */}
            {returningSubmissionId && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-md p-6 border border-sf-divider">
                        <h3 className="text-lg font-bold text-sf-text mb-2">Return Item for Correction</h3>
                        <p className="text-xs text-gray-500 mb-4">Under laboratory review policy, a mandatory reason is required to return a submitted result.</p>
                        <textarea
                            value={returnReason}
                            onChange={(e) => setReturnReason(e.target.value)}
                            placeholder="Enter specific correction requirements (e.g., Re-check dilution factor, baseline drift on scan)..."
                            className="w-full text-xs p-3 rounded-lg border border-sf-divider bg-sf-canvas text-sf-text outline-none resize-none h-24 mb-4 focus:border-sf-emerald"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setReturningSubmissionId(null)}
                                className="px-4 py-2 text-xs font-bold text-sf-muted hover:bg-sf-raised rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!returnReason.trim()) return;
                                    await handleReviewItem(returningSubmissionId, 'REANALYSIS_REQUIRED', returnReason.trim());
                                    setReturningSubmissionId(null);
                                }}
                                disabled={!returnReason.trim()}
                                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
                            >
                                Confirm Return
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reopening / Undo Approval Modal */}
            {undoApprovalModal.isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-md p-6 border border-sf-divider">
                        <h3 className="text-lg font-bold text-sf-text mb-2">Undo Final Approval</h3>
                        <p className="text-xs text-gray-500 mb-4">Reverting approval will return the sample to PROCESSING. To maintain defensible audit traceability, a mandatory reason is required.</p>
                        <textarea
                            value={undoApprovalModal.reason}
                            onChange={(e) => setUndoApprovalModal(prev => ({ ...prev, reason: e.target.value }))}
                            placeholder="Enter mandatory reason (e.g., Client requested re-analysis, QC verification issue)..."
                            className="w-full text-xs p-3 rounded-lg border border-sf-divider bg-sf-canvas text-sf-text outline-none resize-none h-24 mb-4 focus:border-sf-emerald"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setUndoApprovalModal({ isOpen: false, reason: '' })}
                                className="px-4 py-2 text-xs font-bold text-sf-muted hover:bg-sf-raised rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    const reason = undoApprovalModal.reason.trim();
                                    if (!reason) return;
                                    try {
                                        await axios.post(`/api/samples/${id}/undo-approve`, { reason });
                                        setUndoApprovalModal({ isOpen: false, reason: '' });
                                        showInfo(t('common.success', 'Success'), 'Approval Undone. Reverted to PROCESSING.');
                                        fetchWorkspaceData();
                                    } catch (err) {
                                        showInfo(t('common.error', 'Error'), err.response?.data?.error || err.message);
                                    }
                                }}
                                disabled={!undoApprovalModal.reason.trim()}
                                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
                            >
                                Reopen Sample
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Amendment Modal */}
            {amendmentModal.isOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-md p-6 border border-sf-divider">
                        <h3 className="text-lg font-bold text-sf-text mb-2">Open Report Amendment</h3>
                        <p className="text-xs text-gray-500 mb-4">Original released reports remain preserved as immutable snapshots. Amendments create traceable superseding records.</p>
                        <div className="space-y-3 mb-4">
                            <div>
                                <label className="block text-xs font-bold text-sf-muted mb-1">Amendment Type</label>
                                <select
                                    value={amendmentModal.type}
                                    onChange={(e) => setAmendmentModal(prev => ({ ...prev, type: e.target.value }))}
                                    className="w-full text-xs p-2 rounded-lg border border-sf-divider bg-sf-canvas text-sf-text focus:border-sf-emerald"
                                >
                                    <option value="CLERICAL">Clerical / Typo correction</option>
                                    <option value="SCIENTIFIC">Scientific / Result recalculation</option>
                                    <option value="SUPPLEMENTAL">Supplemental testing requested</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-sf-muted mb-1">Reason for Amendment *</label>
                                <textarea
                                    value={amendmentModal.reason}
                                    onChange={(e) => setAmendmentModal(prev => ({ ...prev, reason: e.target.value }))}
                                    placeholder="Describe specific reasons and affected parameters..."
                                    className="w-full text-xs p-2.5 rounded-lg border border-sf-divider bg-sf-canvas text-sf-text focus:border-sf-emerald resize-none h-20"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setAmendmentModal({ isOpen: false, type: 'CLERICAL', reason: '', impact: '' })}
                                className="px-4 py-2 text-xs font-bold text-sf-muted hover:bg-sf-raised rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    const reason = amendmentModal.reason.trim();
                                    if (!reason) return;
                                    try {
                                        await axios.post(`/api/samples/${id}/amendments`, {
                                            type: amendmentModal.type,
                                            reason
                                        });
                                        setAmendmentModal({ isOpen: false, type: 'CLERICAL', reason: '', impact: '' });
                                        showInfo(t('common.success', 'Success'), 'Amendment recorded. Ready for updated report release.');
                                        fetchWorkspaceData();
                                    } catch (err) {
                                        showInfo(t('common.error', 'Error'), err.response?.data?.error || err.message);
                                    }
                                }}
                                disabled={!amendmentModal.reason.trim()}
                                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
                            >
                                Record Amendment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* General Confirm Modal */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-md p-6 border border-sf-divider">
                        <h3 className="text-lg font-bold text-sf-text mb-2">{confirmModal.title}</h3>
                        <p className="text-xs text-sf-muted mb-6 whitespace-pre-wrap">{confirmModal.message}</p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                                className="px-4 py-2 text-xs font-bold text-sf-muted hover:bg-sf-raised rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmModal.onConfirm}
                                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Info / Alert Modal */}
            {infoModal.isOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-md p-6 border border-sf-divider">
                        <div className="flex items-center gap-2 mb-2">
                            {infoModal.type === 'error' ? (
                                <AlertCircle size={20} className="text-red-500" />
                            ) : (
                                <CheckCircle size={20} className="text-emerald-500" />
                            )}
                            <h3 className="text-lg font-bold text-sf-text">{infoModal.title}</h3>
                        </div>
                        <p className="text-xs text-sf-muted mb-6 whitespace-pre-wrap">{infoModal.message}</p>
                        <div className="flex justify-end">
                            <button
                                onClick={() => setInfoModal({ ...infoModal, isOpen: false })}
                                className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SampleDetail;
