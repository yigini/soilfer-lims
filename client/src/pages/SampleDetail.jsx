import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getStatusLabel } from '../utils/i18nHelper';
import { useDialog } from '../context/DialogContext';
import { useNotifications } from '../context/NotificationContext';
import ContextPanel from '../components/sample/ContextPanel';
import WorkItemsTable from '../components/sample/WorkItemsTable';
import SubmissionPanel from '../components/sample/SubmissionPanel';
import CollapsibleDrawer from '../components/sample/CollapsibleDrawer';
import FieldSummary from '../components/sample/FieldSummary';
import FieldMetadataCard from '../components/sample/FieldMetadataCard';
import FieldMap from '../components/sample/FieldMap';
import SampleSummary from '../components/sample/SampleSummary'; // NEW
import IntakeRequestCard from '../components/sample/IntakeRequestCard'; // NEW
import WorkflowProgressBar from '../components/sample/WorkflowProgressBar'; // Phase 3
import AnalysisUpdateModal from '../components/sample/AnalysisUpdateModal';
import LabelPrintDialog from '../components/common/LabelPrintDialog';
import ReportContent from '../components/report/ReportContent';
import SampleTimeline from '../components/SampleTimeline';
import { FileText, XCircle, Printer, Clock } from 'lucide-react';

const SampleDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token, user } = useAuth();
    const { showDialog } = useDialog();
    const { subscribeToEvent } = useNotifications();
    const { t } = useLanguage();

    // State
    const [sample, setSample] = useState(null);
    const [workItems, setWorkItems] = useState([]);
    const [history, setHistory] = useState([]);
    const [workflowSummary, setWorkflowSummary] = useState(null);  // Phase 3: Workflow Engine data

    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const workspaceTableRef = useRef(null);

    // UI State
    const [showFieldMetadata, setShowFieldMetadata] = useState(false);
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('sampleViewMode') || 'WORKSPACE');
    const [showContextPanel, setShowContextPanel] = useState(false);
    const [printTarget, setPrintTarget] = useState(null);
    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [existingReport, setExistingReport] = useState(null);
    const [reportModal, setReportModal] = useState(null);

    // Persist Mode
    useEffect(() => {
        localStorage.setItem('sampleViewMode', viewMode);
    }, [viewMode]);

    // Fetch Data
    const fetchData = useCallback(async () => {
        try {
            const res = await axios.get(`/api/samples/${id}/detail`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Normalize response
            const sampleData = res.data.sample || res.data;
            sampleData.hasKoboConnection = res.data.hasKoboConnection || false;
            setSample(sampleData);
            setWorkItems(res.data.workItems || []);
            setHistory(res.data.auditLog || []);
            setWorkflowSummary(res.data.workflowSummary || null);  // Phase 3: Workflow Engine

        } catch (err) {
            console.error(err);
            if (err.response?.status === 404) showDialog({ type: 'error', title: t('common.error', 'Error'), message: t('sampleDetail.noSampleFound', 'Sample not found') });
        } finally {
            setLoading(false);
        }
    }, [id, token]);

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
        fetchData();
        checkReport();
    }, [fetchData, checkReport]);

    // WP-27: Assemble chronological timeline events from audit log and sample history
    const timelineHistory = React.useMemo(() => {
        const events = [];
        const sampleHistory = Array.isArray(sample?.history)
            ? sample.history
            : (typeof sample?.history === 'string' ? JSON.parse(sample?.history || '[]') : []);

        sampleHistory.forEach(h => {
            events.push({
                status: h.status,
                performedBy: h.changedBy || h.user || 'System',
                timestamp: h.timestamp,
                reason: h.note || h.reason || ''
            });
        });

        (history || []).forEach(a => {
            if (a.action?.includes('STATUS') || a.action?.includes('SAMPLE_') || a.action?.includes('GATE') || a.action === 'UPDATE') {
                events.push({
                    status: a.after?.status || a.action,
                    performedBy: a.performedByName || a.performedBy || 'System',
                    timestamp: a.timestamp,
                    reason: a.details || ''
                });
            }
        });

        return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }, [sample, history]);

    // ─── Real-time: subscribe to WORKITEM_CHANGED events (draft + completion) ───
    useEffect(() => {
        if (!subscribeToEvent || !id) return;
        const unsubscribe = subscribeToEvent('WORKITEM_CHANGED', (data) => {
            if (!data.sampleIds?.includes(id)) return;

            if (data.action === 'DRAFT_SAVE' && data.updates) {
                // Inline patch: show draft values without full refetch
                setWorkItems(prev => prev.map(wi => {
                    const update = data.updates.find(u => u.workItemId === wi.id);
                    if (!update) return wi;
                    return {
                        ...wi,
                        result: update.result ?? wi.result,
                        status: update.status ?? wi.status,
                        _isDraft: true,
                        _draftBy: data.updatedBy,
                        _draftAt: data.updatedAt
                    };
                }));
            } else {
                // Completion or other: full refetch
                console.log('[SampleDetail] Real-time completion update, refreshing...');
                fetchData();
            }
        });
        return unsubscribe;
    }, [subscribeToEvent, id, fetchData]);

    // Confirm Modal State (Yes/No)
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    // Info Modal State (Alerts/Errors)
    const [infoModal, setInfoModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

    // Generic Action Wrapper
    const requestConfirmation = (title, message, action) => {
        setConfirmModal({
            isOpen: true,
            title,
            message,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false })); // Close Confirm first
                await action();
            }
        });
    };

    // Helper for Persistent Alerts
    const showInfo = (title, message, type = 'info') => {
        // Map error type
        const modalType = title.toLowerCase().includes('error') || title.toLowerCase().includes('fail') ? 'error' :
            title.toLowerCase().includes('success') ? 'success' : 'info';

        setInfoModal({
            isOpen: true,
            title,
            message,
            type: modalType
        });
    };

    const handleUpdateStatus = async (itemId, status, result, options = {}) => {
        try {
            await axios.put(`/api/work/${itemId}/status`, {
                status,
                result,
                equipmentId: options.equipmentId
            });
            fetchData();
        } catch (err) {
            console.error("Update failed", err);
            showInfo(t('common.error', 'Update Failed'), err.response?.data?.error || err.message);
        }
    };

    const handleCreateSubmission = async (type, workItemIds) => {
        if (!workItemIds || workItemIds.length === 0) return showInfo(t('common.error', 'Selection Empty'), t('forms.noItemsSelected', 'No items selected'));

        requestConfirmation(t('common.confirm', 'Confirm'), t('forms.confirmSubmission', `Confirm submission of ${workItemIds.length} items?`), async () => {
            try {
                await axios.post('/api/submissions', {
                    sampleId: id,
                    type,
                    workItemIds
                });
                showInfo(t('common.success', 'Success'), t('forms.submissionCreated', 'Submission Created!'));
                fetchData();
            } catch (err) {
                console.error("Submission failed", err);
                showInfo(t('common.error', 'Error'), err.response?.data?.error || err.message);
            }
        });
    };

    const handleReviewSubmission = async (submissionId, status, note) => {
        try {
            await axios.post(`/api/submissions/${submissionId}/review`, { status, note });
            showInfo(t('common.success', 'Success'), t('forms.reviewSubmitted', 'Review Submitted'));
            fetchData();
        } catch (err) {
            console.error("Review failed", err);
            showInfo(t('common.error', 'Error'), err.response?.data?.error || err.message);
        }
    };

    const handleReviewItem = async (itemId, status) => {
        try {
            await axios.post(`/api/work/${itemId}/review`, { status, note: 'Inline Manager Review' });
            fetchData();
        } catch (err) {
            console.error("Item review failed", err);
            showInfo(t('common.error', 'Error'), err.response?.data?.error || err.message);
        }
    };

    const handleReviewBulk = async (itemIds, status) => {
        try {
            await axios.post(`/api/work/review/bulk`, { workItemIds: itemIds, status, note: 'Bulk Manager Review' });
            showInfo(t('common.success', 'Success'), t('forms.bulkReviewSuccess', `Successfully reviewed ${itemIds.length} items.`));
            fetchData();
        } catch (err) {
            console.error("Bulk review failed", err);
            showInfo(t('common.error', 'Error'), err.response?.data?.error || err.message);
        }
    };

    const handleApproveIntake = async () => {
        requestConfirmation(t('sampleDetail.approveIntake', 'Approve Intake'), t('forms.confirmIntakeApproval', 'Confirm Intake Approval? This will finalize the record and generate laboratory work items.'), async () => {
            try {
                // Finding #10: Use dedicated /accept endpoint for proper metadata + work item generation
                await axios.post(`/api/samples/${sample.id}/accept`);
                showInfo(t('common.success', 'Success'), t('forms.intakeApproved', 'Sample Approved for Laboratory Processing!'));
                fetchData();
            } catch (e) {
                showInfo(t('common.error', 'Error'), e.response?.data?.error || e.message);
            }
        });
    };

    const handleUndoIntake = async () => {
        requestConfirmation(t('sampleDetail.undoIntake', 'Undo Intake'), t('forms.confirmUndoIntake', '⚠️ UNDO INTAKE? \n\nThis will:\n1. Revert status to RECEIVED\n2. Delete all generated Work Items\n3. Preserve the Lab ID for re-processing'), async () => {
            try {
                await axios.post(`/api/samples/${sample.id}/undo-intake`);
                showInfo(t('common.success', 'Success'), t('forms.intakeUndone', 'Intake Undone. Sample reverted to RECEIVED.'));
                fetchData();
            } catch (e) {
                showInfo(t('common.error', 'Error'), e.response?.data?.error || e.message);
            }
        });
    };

    const handleUpdateMetadata = async (metadata) => {
        try {
            await axios.put(`/api/samples/${sample.id}/metadata`, { metadata });
            showInfo(t('common.success', 'Success'), t('forms.metadataUpdated', 'Metadata Updated Successfully!'));
            fetchData();
        } catch (e) {
            showInfo(t('common.error', 'Error'), e.response?.data?.error || e.message);
        }
    };

    const handleGenerateReport = async () => {
        requestConfirmation('Generate Report', 'Generate an official soil analysis report for this sample? This will snapshot the current results.', async () => {
            try {
                const res = await axios.post(`/api/reports/generate/${id}`, {}, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                setExistingReport(res.data);
                showInfo(t('common.success', 'Success'), 'Report generated successfully!');
                // Auto-open the report
                const full = await axios.get(`/api/reports/${res.data.id}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                setReportModal(full.data);
            } catch (e) {
                showInfo(t('common.error', 'Error'), e.response?.data?.error || 'Failed to generate report');
            }
        });
    };

    const handleViewReport = async () => {
        try {
            const reportId = existingReport?.id;
            if (!reportId) return;
            const res = await axios.get(`/api/reports/${reportId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            setReportModal(res.data);
        } catch (e) {
            showInfo(t('common.error', 'Error'), 'Failed to load report');
        }
    };


    const handleFinalApproval = async () => {
        // Debugging Click
        requestConfirmation(t('sampleDetail.finalApproval', 'Final Approval'), t('forms.confirmFinalApproval', 'Approve Sample and Mark as Completed/Archived?'), async () => {
            try {
                // Smart Logic: If Archiving/Disposal is ALREADY accepted, jump to final state.
                const archivingItem = workItems.find(w => (w.analysis === 'ARCHIVING' || w.analysis === 'ARCH') && w.status === 'ACCEPTED');
                const disposalItem = workItems.find(w => (w.analysis === 'DISPOSAL' || w.analysis === 'DISP') && w.status === 'ACCEPTED');

                let targetStatus = 'APPROVED';
                if (archivingItem) targetStatus = 'ARCHIVED';
                if (disposalItem) targetStatus = 'DISPOSED';

                // WORKAROUND: Legacy Server Logic requires passing through APPROVED before ARCHIVED
                // Check if current status is NOT Approved, but target IS Final
                if (['ARCHIVED', 'DISPOSED'].includes(targetStatus) && sample.status !== 'APPROVED') {
                    // Step 1: Intermediate Approval
                    try {
                        await axios.put(`/api/samples/${id}/status`, { status: 'APPROVED', reason: 'Intermediate Step for Archiving' });
                    } catch (ignore) {
                        // Ignore if it fails? No, if it fails maybe because it's already approved or something.
                        // But mostly strict validation.
                        console.warn("Intermediate approval failed or skipped", ignore);
                    }
                }

                // Step 2: Final Status
                await axios.put(`/api/samples/${id}/status`, { status: targetStatus });

                showInfo(t('common.success', 'Success'), `${t('samples.title', 'Sample')} → ${getStatusLabel(targetStatus, t)}`);
                fetchData();
            } catch (err) {
                console.error("Approval failed", err);
                showInfo(t('common.error', 'Error'), err.response?.data?.error || err.message);
            }
        });
    };

    const handleUndoApproval = async () => {
        requestConfirmation(t('sampleDetail.undoApproval', 'Undo Approval'), t('forms.confirmUndoApproval', 'Undo Final Approval? Sample will return to ACCEPTED state.'), async () => {
            try {
                await axios.post(`/api/samples/${id}/undo-approve`);
                showInfo(t('common.success', 'Success'), t('forms.approvalUndone', 'Approval Undone. Reverted to ACCEPTED.'));
                fetchData();
            } catch (err) {
                showInfo(t('common.error', 'Error'), err.response?.data?.error || err.message);
            }
        });
    };

    const handleArchive = async () => {
        try {
            await axios.post(`/api/samples/${id}/archive`, {});
            showDialog({
                type: 'success',
                title: t('forms.archiveCreated', 'Archive Request Created'),
                message: t('forms.archiveMessage', 'Archive task created. Please assign a technician in the table below.')
            });
            await fetchData();
            workspaceTableRef.current?.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
            if (err.response?.status === 400) {
                // Already exists - just scroll
                workspaceTableRef.current?.scrollIntoView({ behavior: 'smooth' });
            } else {
                showDialog({
                    type: 'error',
                    title: t('common.error', 'Archive Failed'),
                    message: err.response?.data?.error || err.message
                });
            }
        }
    };

    const handleDispose = async () => {
        try {
            await axios.post(`/api/samples/${id}/dispose`, {});
            showDialog({
                type: 'success',
                title: t('forms.disposalCreated', 'Disposal Request Created'),
                message: t('forms.disposalMessage', 'Disposal task created. Please assign a technician in the table below.')
            });
            await fetchData();
            workspaceTableRef.current?.scrollIntoView({ behavior: 'smooth' });
        } catch (err) {
            if (err.response?.status === 400) {
                // Already exists - just scroll
                workspaceTableRef.current?.scrollIntoView({ behavior: 'smooth' });
            } else {
                showDialog({
                    type: 'error',
                    title: t('common.error', 'Disposal Failed'),
                    message: err.response?.data?.error || err.message
                });
            }
        }
    };


    if (loading) return <div className="p-8 text-center text-gray-500">{t('sampleDetail.loading', 'Loading sample details...')}</div>;
    if (!sample) return <div className="p-8 text-center text-red-500">{t('sampleDetail.noSampleFound', 'Sample not found')}</div>;

    // Derived State
    const dryingStatus = workItems.find(w => w.analysis === 'DRYING')?.status || 'PENDING';
    const prepStatus = workItems.find(w => w.analysis === 'PREPARATION')?.status || 'PENDING';
    const archivingStatus = workItems.find(w => w.analysis === 'ARCHIVING' || w.analysis === 'ARCH')?.status || null;

    // Fix: ACCPETED also means done (verified)
    // Fix: ACCPETED or SUBMITTED also means done enough to open next gate
    const isDryingDone = ['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(dryingStatus);
    const isPrepDone = ['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(prepStatus);
    const gatesLockedByDrying = !isDryingDone;
    // Preparation is locked if Drying not done
    // Other analyses are locked if Preparation not done

    // Check for unassigned items (excluding post-analytical)
    const activeWorkItems = workItems.filter(w => w.category !== 'Post-Analytical');
    const hasUnassigned = activeWorkItems.some(w => !w.assignedTo);

    // allAccepted should only count ANALYTICAL items, not Post-Analytical itself
    const analyticalItems = workItems.filter(w => !['Operational Gates', 'Post-Analytical'].includes(w.category));
    const allAccepted = analyticalItems.length > 0 && analyticalItems.every(w => ['ACCEPTED', 'WAIVED'].includes(w.status));
    const isApproved = ['APPROVED', 'ARCHIVING_PENDING', 'DISPOSAL_PENDING', 'ARCHIVED', 'DISPOSED'].includes(sample.status);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-2 md:p-6 text-left relative flex overflow-x-hidden">
            {/* Main Content Area - FULL WIDTH */}
            <div className={`flex-1 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] w-full max-w-[100vw] ${drawerOpen ? 'md:mr-96 md:opacity-90 md:scale-[0.99] md:translate-x-[-10px]' : 'md:mr-12'} md:pr-8`}>

                {/* 1. Header & Summary */}
                <div className="relative z-10">
                    <SampleSummary
                        sample={sample}
                        user={user}
                        dryingStatus={dryingStatus}
                        prepStatus={prepStatus}
                        archivingStatus={archivingStatus}
                        showContextPanel={showContextPanel}
                        setShowContextPanel={setShowContextPanel}
                        drawerOpen={drawerOpen}
                        setDrawerOpen={setDrawerOpen}
                        onApproveIntake={handleApproveIntake}
                        onUndoIntake={handleUndoIntake} // NEW
                        onReviewBulk={handleReviewBulk}
                        onFinalApproval={handleFinalApproval}
                        onUndoApproval={handleUndoApproval}
                        onArchive={handleArchive}
                        onDispose={handleDispose}
                        onPrintLabel={() => setPrintTarget(sample)}
                        onEditAnalysis={() => setIsAnalysisModalOpen(true)}
                        onGenerateReport={handleGenerateReport}
                        onViewReport={handleViewReport}
                        hasReport={!!existingReport}
                        allAccepted={allAccepted}
                        isApproved={isApproved}
                    />
                </div>

                <LabelPrintDialog
                    isOpen={!!printTarget}
                    onClose={() => setPrintTarget(null)}
                    sample={printTarget}
                />

                <AnalysisUpdateModal
                    sample={sample}
                    isOpen={isAnalysisModalOpen}
                    onClose={() => setIsAnalysisModalOpen(false)}
                    onUpdateSuccess={() => {
                        fetchData();
                        showInfo(t('common.success', 'Success'), t('forms.analysisUpdated', 'Analysis requirements updated. New work items generated.'));
                    }}
                />

                {/* NEW: Workflow Progress Bar (Phase 3) */}
                {workflowSummary && sample.status !== 'RECEIVED' && sample.status !== 'EXPECTED' && (
                    <WorkflowProgressBar workflowSummary={workflowSummary} />
                )}

                {/* 2. INTAKE REQUEST CARD (Only for RECEIVED samples) */}
                <IntakeRequestCard sample={sample} />

                {/* 3. FIELD DATA STRIP */}
                <FieldSummary
                    sample={sample}
                    showMetadata={showFieldMetadata}
                    onToggleMetadata={() => setShowFieldMetadata(!showFieldMetadata)}
                />

                {/* 4. EXPANDABLE METADATA CARD */}
                {showFieldMetadata && (
                    <div className="mb-6 space-y-4 animate-in slide-in-from-top-2">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
                            <FieldMetadataCard
                                sample={sample}
                                canEdit={['INTAKE_OFFICER', 'LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role)}
                                onUpdateMetadata={handleUpdateMetadata}
                            />
                        </div>
                        <div className="h-[250px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
                            <FieldMap sample={sample} />
                        </div>
                    </div>
                )}

                {/* 5. CONTEXT PANEL (LEGACY/TOGGLE) */}
                {showContextPanel && (
                    <div className="mb-4 animate-in slide-in-from-top-2">
                        <ContextPanel sample={sample} isActive={true} />
                    </div>
                )}

                {/* 6. ANALYTICAL WORKSPACE / TIMELINE */}
                {sample.status !== 'RECEIVED' && (
                    <div className="flex flex-col gap-6">
                        {/* View Mode Switcher */}
                        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
                            <button
                                onClick={() => setViewMode('WORKSPACE')}
                                className={`px-4 py-2 font-bold text-sm rounded-lg transition-colors ${
                                    viewMode === 'WORKSPACE'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                {t('sampleDetail.workspace', 'Analytical Workspace')}
                            </button>
                            <button
                                onClick={() => setViewMode('TIMELINE')}
                                className={`px-4 py-2 font-bold text-sm rounded-lg flex items-center gap-2 transition-colors ${
                                    viewMode === 'TIMELINE'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                <Clock size={16} />
                                {t('sampleDetail.timeline', 'Workflow Timeline')}
                            </button>
                        </div>

                        {viewMode === 'TIMELINE' ? (
                            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                <SampleTimeline
                                    currentStatus={sample.status}
                                    history={timelineHistory}
                                    className="border-0 p-0"
                                />
                            </div>
                        ) : (
                            <>
                                {/* Warning Banner - Only show if totally blocked from initial analysis */}
                                {!isDryingDone && sample.status !== 'RECEIVED' && (
                                    <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-3 mb-4">
                                        <span className="p-1 bg-orange-100 rounded-full">⚠️</span>
                                        <span>
                                            {['EXPECTED', 'COLLECTED'].includes(sample.status)
                                                ? t('workflow.analysisLockedReceive', 'ANALYSIS LOCKED: Sample should be RECEIVED first.')
                                                : t('workflow.analysisLockedDrying', 'ANALYSIS LOCKED: Drying must be COMPLETED first.')
                                            }
                                        </span>
                                    </div>
                                )}

                                {/* The Table */}
                                <div ref={workspaceTableRef} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[400px]">
                                    <WorkItemsTable
                                        workItems={workItems}
                                        isGateOpen={isDryingDone}
                                        onUpdateStatus={handleUpdateStatus}
                                        onAssignmentSuccess={fetchData}
                                        onReview={handleReviewItem}
                                        onReviewBulk={handleReviewBulk}
                                    />
                                </div>

                                {/* Submission Panel */}
                                <SubmissionPanel
                                    submissions={history.filter(h => h.entity === 'SUBMISSION')}
                                    workItems={workItems}
                                    onCreateSubmission={handleCreateSubmission}
                                    onReviewSubmission={handleReviewSubmission}
                                    onReviewItem={handleReviewItem}
                                />
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Collapsible History Drawer - OVERLAY */}
            <CollapsibleDrawer
                history={history}
                isOpen={drawerOpen}
                onToggle={() => setDrawerOpen(!drawerOpen)}
            />

            {/* CUSTOM CONFIRM RESULT MODAL (YES/NO) */}
            {confirmModal.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                            {confirmModal.title}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-6 whitespace-pre-wrap">
                            {confirmModal.message}
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                                className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                onClick={confirmModal.onConfirm}
                                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg transition-all transform hover:scale-105"
                            >
                                {t('common.confirm', 'Confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* INFO / ERROR MODAL (OK ONLY) */}
            {infoModal.isOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-3 mb-2">
                            {infoModal.type === 'error' ? (
                                <div className="text-red-500"><div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center font-bold">!</div></div>
                            ) : infoModal.type === 'success' ? (
                                <div className="text-green-500"><div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center font-bold">✓</div></div>
                            ) : null}
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {infoModal.title}
                            </h3>
                        </div>

                        <p className="text-gray-600 dark:text-gray-300 mb-6 whitespace-pre-wrap">
                            {infoModal.message}
                        </p>

                        <div className="flex items-center justify-end">
                            <button
                                onClick={() => setInfoModal({ ...infoModal, isOpen: false })}
                                className={`px-5 py-2 rounded-lg font-bold shadow-lg transition-all transform hover:scale-105 ${infoModal.type === 'error' ? 'bg-red-600 hover:bg-red-700 text-white' :
                                    infoModal.type === 'success' ? 'bg-green-600 hover:bg-green-700 text-white' :
                                        'bg-indigo-600 hover:bg-indigo-700 text-white'
                                    }`}
                            >
                                {t('common.ok', 'OK')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── REPORT VIEWER MODAL ─── */}
            {reportModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-white dark:from-gray-800 dark:to-gray-800 no-print">
                            <div>
                                <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                                    <FileText size={20} className="text-indigo-600" />
                                    Report — {reportModal.sampleLabId || reportModal.sampleId?.slice(0, 8)}
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">Version {reportModal.version} • Generated {reportModal.generatedAt ? new Date(reportModal.generatedAt).toLocaleDateString('en-GB') : '—'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => window.print()} className="p-2.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 transition-colors" title="Print">
                                    <Printer size={20} />
                                </button>
                                <button onClick={() => setReportModal(null)} className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-gray-500 transition-colors">
                                    <XCircle size={24} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-gray-900">
                            <ReportContent data={reportModal.content ? (typeof reportModal.content === 'string' ? JSON.parse(reportModal.content) : reportModal.content) : reportModal} showActions />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SampleDetail;
