import React, { useState } from 'react';
import axios from 'axios';
import { X, AlertCircle, AlertTriangle, CheckCircle2, Pause, Play, Archive, Trash2, Settings, RefreshCw, Building2, Shield, Users, Lock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
    getPendingOperation,
    setPendingOperation,
    deletePendingOperation,
    findPendingOperationForProject
} from '../../services/pendingGovernanceStore';

export default function ProjectActionsModal({
    isOpen,
    onClose,
    project,
    counts,
    onSuccess,
    initialActionType = 'menu'
}) {
    const { t } = useLanguage();
    const { user } = useAuth();
    const actorId = user?.id || 'anonymous';

    const [submitting, setSubmitting] = useState(false);
    const [actionType, setActionType] = useState(initialActionType); // 'menu' | 'edit' | 'pause' | 'archive' | 'delete' | 'lab-access'
    const [reason, setReason] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Edit project settings state
    const [editName, setEditName] = useState(project?.name || '');
    const [editClient, setEditClient] = useState(project?.client || '');
    const [editDescription, setEditDescription] = useState(project?.description || '');
    const [editExpectedCount, setEditExpectedCount] = useState(project?.expectedSampleCount || '');
    const [editDeadline, setEditDeadline] = useState(project?.deliveryDeadline ? String(project.deliveryDeadline).split('T')[0] : '');
    const [editBundle, setEditBundle] = useState(project?.defaultAnalysisBundle || '');
    const [editStatus, setEditStatus] = useState(project?.status || 'ACTIVE');
    const [catalogueGroups, setCatalogueGroups] = useState([]);

    // Lab-access governance state
    const [labAccessData, setLabAccessData] = useState(null);
    const [allLabs, setAllLabs] = useState([]);
    const [selectedServicingIds, setSelectedServicingIds] = useState([]);
    const [serverServicingIds, setServerServicingIds] = useState([]);
    const [labAccessLoading, setLabAccessLoading] = useState(false);
    const [labAccessError, setLabAccessError] = useState('');
    const [labAccessReason, setLabAccessReason] = useState('');
    const [blockerNotice, setBlockerNotice] = useState(null);

    const findActiveOp = () => {
        if (!project) return null;
        if (actionType && actionType !== 'menu') {
            const specific = getPendingOperation(actorId, project.id, actionType);
            if (specific) return specific;
        }
        return findPendingOperationForProject(actorId, project.id);
    };
    const [unresolvedOp, setUnresolvedOp] = useState(findActiveOp);

    React.useEffect(() => {
        if (isOpen) {
            setActionType(initialActionType);
            setEditName(project?.name || '');
            setEditClient(project?.client || '');
            setEditDescription(project?.description || '');
            setEditExpectedCount(project?.expectedSampleCount || '');
            setEditDeadline(project?.deliveryDeadline ? String(project.deliveryDeadline).split('T')[0] : '');
            setEditBundle(project?.defaultAnalysisBundle || '');
            setEditStatus(project?.status || 'ACTIVE');
            setErrorMessage('');
            setReason('');
            setLabAccessReason('');
            setBlockerNotice(null);
            setLabAccessError('');
        }
    }, [isOpen, initialActionType]);

    // Retain unresolved operation across background prop refreshes and modal reopens for the same actor
    React.useEffect(() => {
        if (isOpen && project) {
            const active = findActiveOp();
            setUnresolvedOp(active);
            if (active && active.action === 'archive' && active.snapshot?.reason && !reason) {
                setReason(active.snapshot.reason);
            }
            if (active && active.action === 'pause' && active.snapshot?.reason && !reason) {
                setReason(active.snapshot.reason);
            }
            if (active && active.action === 'lab-access') {
                if (active.snapshot?.reason && !labAccessReason) {
                    setLabAccessReason(active.snapshot.reason);
                }
                if (Array.isArray(active.snapshot?.servicingLabIds)) {
                    setSelectedServicingIds(active.snapshot.servicingLabIds);
                }
            }
        } else if (!isOpen) {
            setUnresolvedOp(null);
            setLabAccessData(null);
            setSelectedServicingIds([]);
            setServerServicingIds([]);
            setLabAccessLoading(false);
            setLabAccessError('');
        }
    }, [isOpen, project?.id, actionType, actorId]);

    const activeRequestIdRef = React.useRef(0);

    // Invalidate sensitive visible state on account switch or logout
    React.useEffect(() => {
        activeRequestIdRef.current += 1;
        setReason('');
        setLabAccessReason('');
        setBlockerNotice(null);
        setErrorMessage('');
        setUnresolvedOp(null);
        setLabAccessData(null);
        setSelectedServicingIds([]);
        setServerServicingIds([]);
        setLabAccessLoading(false);
        setLabAccessError('');
    }, [actorId]);

    const fetchLabAccessData = React.useCallback(() => {
        if (!project) return;
        activeRequestIdRef.current += 1;
        const thisReqId = activeRequestIdRef.current;
        const currentProjectId = project.id;
        const currentActorId = actorId;

        setLabAccessLoading(true);
        setLabAccessError('');
        setBlockerNotice(null);

        Promise.all([
            axios.get(`/api/projects/${currentProjectId}/lab-access`),
            axios.get('/api/labs')
        ])
        .then(([accessRes, labsRes]) => {
            if (activeRequestIdRef.current !== thisReqId) return;

            setLabAccessData(accessRes.data);
            const sList = accessRes.data?.servicingLabIds || [];
            setServerServicingIds(sList);

            // Preserve unresolvedOp snapshot if one exists for lab-access!
            const pending = getPendingOperation(currentActorId, currentProjectId, 'lab-access');
            if (pending && Array.isArray(pending.snapshot?.servicingLabIds)) {
                setSelectedServicingIds(pending.snapshot.servicingLabIds);
                if (pending.snapshot.reason) {
                    setLabAccessReason(pending.snapshot.reason);
                }
            } else {
                setSelectedServicingIds(sList);
            }

            if (Array.isArray(labsRes.data)) {
                setAllLabs(labsRes.data);
            }
            setLabAccessLoading(false);
        })
        .catch(err => {
            if (activeRequestIdRef.current !== thisReqId) return;
            console.warn('[ProjectActionsModal] Failed to load lab access:', err.message);
            setLabAccessError(err.response?.data?.message || err.message || 'Failed to load laboratory access directory');
            setLabAccessLoading(false);
        });
    }, [project, actorId]);

    React.useEffect(() => {
        if (isOpen && actionType === 'edit') {
            axios.get('/api/config/groups')
                .then(res => {
                    if (Array.isArray(res.data)) {
                        setCatalogueGroups(res.data);
                    }
                })
                .catch(err => {
                    console.warn('[ProjectActionsModal] Failed to load analysis groups:', err.message);
                });
        }

        if (isOpen && (actionType === 'lab-access' || initialActionType === 'lab-access') && project) {
            fetchLabAccessData();
        }
    }, [isOpen, actionType, initialActionType, project?.id, fetchLabAccessData]);

    if (!isOpen || !project) return null;

    const isPaused = project.status === 'PAUSED';
    const isDraft = project.status === 'DRAFT' || project.status === 'PENDING_MANIFEST';
    const pendingExpected = counts?.awaitingArrival ?? 0;
    const pendingLabWork = (counts?.intakeInProgress ?? 0) + (counts?.labWork ?? 0) + (counts?.awaitingReview ?? 0);
    const totalRegistered = counts?.registered ?? 0;

    const canArchive = pendingExpected === 0 && pendingLabWork === 0;
    const canDelete = totalRegistered === 0;

    // Explicit recovery of an unresolved command receipt
    const handleRecoverUnresolved = async () => {
        if (!unresolvedOp || !project) return;
        setSubmitting(true);
        setErrorMessage('');
        try {
            const res = await axios.get(`/api/projects/${project.id}/operations/${unresolvedOp.idempotencyKey}`);
            if (res.data?.receipt?.outcome) {
                deletePendingOperation(actorId, project.id, unresolvedOp.action);
                setUnresolvedOp(null);
                onSuccess?.(unresolvedOp.action === 'archive' ? 'PROJECT_ARCHIVED' : (unresolvedOp.action === 'pause' ? 'PROJECT_PAUSED' : 'PROJECT_UPDATED'));
                onClose();
                return;
            }
            setErrorMessage(t('projects.actions.receiptNotFoundYet', 'No completed receipt recorded on server for this attempt. You may safely retry or discard.'));
        } catch (err) {
            if (err.response?.status === 404) {
                setErrorMessage(t('projects.actions.receiptNotFoundYet', 'No completed receipt recorded on server for this attempt. You may safely retry or discard.'));
            } else {
                setErrorMessage(err.response?.data?.message || err.message || 'Failed to check operation receipt status');
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Discard unresolved command identity to intentionally start a fresh operation
    const handleDiscardUnresolved = () => {
        if (unresolvedOp?.action && project) {
            deletePendingOperation(actorId, project.id, unresolvedOp.action);
        }
        setUnresolvedOp(null);
        setErrorMessage('');
        if (unresolvedOp?.action === 'archive') {
            setReason('');
        }
    };

    const handleSaveSettings = async (e) => {
        e?.preventDefault?.();
        if (!editName.trim()) {
            setErrorMessage(t('projects.create.nameRequired', 'Project name is required.'));
            return;
        }

        const payload = {
            name: editName.trim(),
            client: editClient.trim(),
            description: editDescription.trim(),
            expectedSampleCount: editExpectedCount ? parseInt(editExpectedCount, 10) : 0,
            deliveryDeadline: editDeadline || null,
            defaultAnalysisBundle: editBundle || null,
            status: editStatus
        };

        // If an unresolved command exists with different parameters, require explicit choice
        if (unresolvedOp && JSON.stringify(unresolvedOp.snapshot) !== JSON.stringify(payload)) {
            setErrorMessage(t('projects.actions.unresolvedConflictNotice', 'A previous settings update is still unconfirmed. Recover the previous outcome or click "Discard previous attempt" before submitting new values.'));
            return;
        }

        setSubmitting(true);
        setErrorMessage('');

        const idempotencyKey = unresolvedOp
            ? unresolvedOp.idempotencyKey
            : (typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : (`proj-upd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`));

        const expectedRevision = unresolvedOp?.expectedRevision !== undefined
            ? unresolvedOp.expectedRevision
            : (project.updatedAt ? String(new Date(project.updatedAt).getTime()) : null);

        // Mark in-flight/uncertain
        const commandRecord = {
            idempotencyKey,
            action: 'edit',
            projectId: project.id,
            snapshot: JSON.parse(JSON.stringify(payload)),
            expectedRevision,
            status: 'uncertain'
        };
        setPendingOperation(actorId, project.id, 'edit', commandRecord);
        setUnresolvedOp(commandRecord);

        try {
            // If retrying, resolve existing receipt first
            if (unresolvedOp) {
                try {
                    const receiptRes = await axios.get(`/api/projects/${project.id}/operations/${idempotencyKey}`);
                    if (receiptRes.data?.receipt?.outcome) {
                        deletePendingOperation(actorId, project.id, 'edit');
                        setUnresolvedOp(null);
                        onSuccess?.('PROJECT_UPDATED');
                        onClose();
                        return;
                    }
                } catch (receiptErr) {
                    // No receipt on server yet, proceed with mutation
                }
            }

            const headers = {
                'x-idempotency-key': idempotencyKey
            };
            if (commandRecord.expectedRevision) {
                headers['if-match'] = commandRecord.expectedRevision;
            }

            await axios.put(`/api/projects/${project.id}`, { ...payload, idempotencyKey }, { headers });
            deletePendingOperation(actorId, project.id, 'edit');
            setUnresolvedOp(null);
            onSuccess?.('PROJECT_UPDATED');
            onClose();
        } catch (err) {
            const status = err.response?.status;
            const errCode = err.response?.data?.code || err.response?.data?.error;
            if (status === 409 && (errCode === 'STALE_REVISION' || errCode === 'PREVIEW_STALE_REVISION')) {
                deletePendingOperation(actorId, project.id, 'edit');
                setUnresolvedOp(null);
            }
            setErrorMessage(err.response?.data?.message || err.response?.data?.error || 'Failed to update project settings');
        } finally {
            setSubmitting(false);
        }
    };

    const handleTogglePause = async () => {
        if (!reason.trim()) {
            setErrorMessage(t('projects.modals.reasonRequired', 'A reason is required to modify admissions status.'));
            return;
        }

        const nextStatus = isPaused ? 'ACTIVE' : 'PAUSED';
        const payload = { status: nextStatus, reason: reason.trim() };

        if (unresolvedOp && JSON.stringify(unresolvedOp.snapshot) !== JSON.stringify(payload)) {
            setErrorMessage(t('projects.actions.unresolvedConflictNotice', 'A previous status transition is still unconfirmed. Recover the previous outcome or click "Discard previous attempt" before submitting new values.'));
            return;
        }

        setSubmitting(true);
        setErrorMessage('');

        const idempotencyKey = unresolvedOp
            ? unresolvedOp.idempotencyKey
            : (typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : (`proj-pause-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`));

        const expectedRevision = unresolvedOp?.expectedRevision !== undefined
            ? unresolvedOp.expectedRevision
            : (project.updatedAt ? String(new Date(project.updatedAt).getTime()) : null);

        const commandRecord = {
            idempotencyKey,
            action: 'pause',
            projectId: project.id,
            snapshot: JSON.parse(JSON.stringify(payload)),
            expectedRevision,
            status: 'uncertain'
        };
        setPendingOperation(actorId, project.id, 'pause', commandRecord);
        setUnresolvedOp(commandRecord);

        try {
            if (unresolvedOp) {
                try {
                    const receiptRes = await axios.get(`/api/projects/${project.id}/operations/${idempotencyKey}`);
                    if (receiptRes.data?.receipt?.outcome) {
                        deletePendingOperation(actorId, project.id, 'pause');
                        setUnresolvedOp(null);
                        onSuccess?.(nextStatus === 'ACTIVE' ? 'PROJECT_RESUMED' : 'PROJECT_PAUSED');
                        onClose();
                        return;
                    }
                } catch (receiptErr) {
                    // Proceed with PUT
                }
            }

            const headers = {
                'x-idempotency-key': idempotencyKey
            };
            if (commandRecord.expectedRevision) {
                headers['if-match'] = commandRecord.expectedRevision;
            }

            await axios.put(`/api/projects/${project.id}`, { ...payload, idempotencyKey }, { headers });
            deletePendingOperation(actorId, project.id, 'pause');
            setUnresolvedOp(null);
            onSuccess?.(nextStatus === 'ACTIVE' ? 'PROJECT_RESUMED' : 'PROJECT_PAUSED');
            onClose();
        } catch (err) {
            const status = err.response?.status;
            const errCode = err.response?.data?.code || err.response?.data?.error;
            if (status === 409 && (errCode === 'STALE_REVISION' || errCode === 'PREVIEW_STALE_REVISION')) {
                deletePendingOperation(actorId, project.id, 'pause');
                setUnresolvedOp(null);
            }
            setErrorMessage(err.response?.data?.message || err.response?.data?.error || 'Failed to update status');
        } finally {
            setSubmitting(false);
        }
    };

    const handleArchive = async () => {
        if (!canArchive) return;

        const payload = { reason: reason.trim() };

        if (unresolvedOp && JSON.stringify(unresolvedOp.snapshot) !== JSON.stringify(payload)) {
            setErrorMessage(t('projects.actions.unresolvedConflictNotice', 'A previous archival request is still unconfirmed. Recover the previous outcome or click "Discard previous attempt" before submitting new values.'));
            return;
        }

        setSubmitting(true);
        setErrorMessage('');

        const idempotencyKey = unresolvedOp
            ? unresolvedOp.idempotencyKey
            : (typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : (`proj-arch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`));

        const expectedRevision = unresolvedOp?.expectedRevision !== undefined
            ? unresolvedOp.expectedRevision
            : (project.updatedAt ? String(new Date(project.updatedAt).getTime()) : null);

        const commandRecord = {
            idempotencyKey,
            action: 'archive',
            projectId: project.id,
            snapshot: JSON.parse(JSON.stringify(payload)),
            expectedRevision,
            status: 'uncertain'
        };
        setPendingOperation(actorId, project.id, 'archive', commandRecord);
        setUnresolvedOp(commandRecord);

        try {
            if (unresolvedOp) {
                try {
                    const receiptRes = await axios.get(`/api/projects/${project.id}/operations/${idempotencyKey}`);
                    if (receiptRes.data?.receipt?.outcome) {
                        deletePendingOperation(actorId, project.id, 'archive');
                        setUnresolvedOp(null);
                        onSuccess?.('PROJECT_ARCHIVED');
                        onClose();
                        return;
                    }
                } catch (receiptErr) {
                    // Proceed with POST
                }
            }

            const headers = {
                'x-idempotency-key': idempotencyKey
            };
            if (commandRecord.expectedRevision) {
                headers['if-match'] = commandRecord.expectedRevision;
            }

            await axios.post(`/api/projects/${project.id}/archive`, { ...payload, idempotencyKey }, { headers });
            deletePendingOperation(actorId, project.id, 'archive');
            setUnresolvedOp(null);
            onSuccess?.('PROJECT_ARCHIVED');
            onClose();
        } catch (err) {
            const status = err.response?.status;
            const errCode = err.response?.data?.code || err.response?.data?.error;
            if (status === 409 && (errCode === 'STALE_REVISION' || errCode === 'PREVIEW_STALE_REVISION')) {
                deletePendingOperation(actorId, project.id, 'archive');
                setUnresolvedOp(null);
            }
            setErrorMessage(err.response?.data?.message || err.response?.data?.error || 'Failed to archive project');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!canDelete) return;
        setSubmitting(true);
        setErrorMessage('');
        try {
            await axios.delete(`/api/projects/${project.id}`);
            onSuccess?.('PROJECT_DELETED');
            onClose();
        } catch (err) {
            setErrorMessage(err.response?.data?.message || err.response?.data?.error || 'Failed to delete empty project');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleServicingLab = (labId) => {
        setSelectedServicingIds(prev => {
            if (prev.includes(labId)) {
                return prev.filter(id => id !== labId);
            } else {
                return [...prev, labId];
            }
        });
        setBlockerNotice(null);
        setErrorMessage('');
    };

    const handleSaveLabAccess = async (e) => {
        e?.preventDefault();
        if (!project) return;

        const isDataLoadedForCurrentProject = labAccessData && String(labAccessData.projectId) === String(project.id);
        const canManageAccess = labAccessData?.canManage === true;

        if (!isDataLoadedForCurrentProject || !canManageAccess || labAccessLoading || !!labAccessError) {
            setErrorMessage(t('projects.actions.notReadyToSaveAccess', 'Laboratory access directory must be loaded and authorized before saving changes.'));
            return;
        }

        if (!labAccessReason.trim()) {
            setErrorMessage(t('projects.actions.labAccessReasonRequired', 'Please provide an operational reason for changing laboratory access.'));
            return;
        }

        const payload = {
            servicingLabIds: selectedServicingIds,
            reason: labAccessReason.trim()
        };

        if (unresolvedOp && unresolvedOp.action === 'lab-access' && JSON.stringify(unresolvedOp.snapshot) !== JSON.stringify(payload)) {
            setErrorMessage(t('projects.actions.unresolvedConflictNotice', 'A previous request is still unconfirmed. Recover the previous outcome or click "Discard previous attempt" before submitting new values.'));
            return;
        }

        setSubmitting(true);
        setErrorMessage('');
        setBlockerNotice(null);

        const idempotencyKey = unresolvedOp
            ? unresolvedOp.idempotencyKey
            : (typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : (`proj-lab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`));

        const expectedRevision = unresolvedOp?.expectedRevision !== undefined
            ? unresolvedOp.expectedRevision
            : (project.updatedAt ? String(new Date(project.updatedAt).getTime()) : null);

        const commandRecord = {
            idempotencyKey,
            action: 'lab-access',
            projectId: project.id,
            snapshot: JSON.parse(JSON.stringify(payload)),
            expectedRevision,
            status: 'uncertain'
        };
        setPendingOperation(actorId, project.id, 'lab-access', commandRecord);
        setUnresolvedOp(commandRecord);

        try {
            if (unresolvedOp) {
                try {
                    const receiptRes = await axios.get(`/api/projects/${project.id}/operations/${idempotencyKey}`);
                    if (receiptRes.data?.receipt?.outcome) {
                        deletePendingOperation(actorId, project.id, 'lab-access');
                        setUnresolvedOp(null);
                        onSuccess?.('LAB_ACCESS_UPDATED');
                        onClose();
                        return;
                    }
                } catch (receiptErr) {
                    // Proceed with PATCH
                }
            }

            const headers = {
                'x-idempotency-key': idempotencyKey
            };
            if (commandRecord.expectedRevision) {
                headers['if-match'] = commandRecord.expectedRevision;
            }

            await axios.patch(`/api/projects/${project.id}/lab-access`, { ...payload, idempotencyKey }, { headers });
            deletePendingOperation(actorId, project.id, 'lab-access');
            setUnresolvedOp(null);
            onSuccess?.('LAB_ACCESS_UPDATED');
            onClose();
        } catch (err) {
            const status = err.response?.status;
            const errCode = err.response?.data?.code || err.response?.data?.error;
            const errMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to update laboratory access';
            const details = err.response?.data?.details;

            // Definitive client rejections (4xx except 408 Request Timeout and 429 Too Many Requests)
            // are known server verdicts, not uncertain network outcomes. Clear unresolvedOp so user is not blocked.
            const isDefinitiveRejection = status && status >= 400 && status < 500 && status !== 408 && status !== 429;
            if (isDefinitiveRejection) {
                deletePendingOperation(actorId, project.id, 'lab-access');
                setUnresolvedOp(null);
            }

            if (errCode === 'CANNOT_REMOVE_LAB_WITH_ACTIVE_WORK') {
                const sampleCount = details?.activeSamples ?? (errMsg.match(/(\d+)\s+active sample/i)?.[1] || '1');
                const workCount = details?.activeWorkItems ?? (errMsg.match(/(\d+)\s+active work item/i)?.[1] || '0');
                setBlockerNotice({
                    message: errMsg,
                    sampleCount,
                    workCount,
                    detail: t('projects.actions.resolveWorkNotice', 'Outstanding samples or analytical work items exist at the removed laboratory. Transfer or complete active work in the Samples or Tech Workbench tabs before removing access.')
                });
            }
            if (status === 409 && (errCode === 'STALE_REVISION' || errCode === 'PREVIEW_STALE_REVISION')) {
                deletePendingOperation(actorId, project.id, 'lab-access');
                setUnresolvedOp(null);
            }
            setErrorMessage(errMsg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-sf-surface border border-sf-divider rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-sf-divider">
                    <h2 className="text-lg font-bold text-sf-text">
                        {actionType === 'menu' && t('projects.actions.modalTitle', 'Project governance actions')}
                        {actionType === 'edit' && t('projects.actions.editSettingsTitle', 'Edit project settings & plan')}
                        {actionType === 'lab-access' && t('projects.actions.labAccessTitle', 'Servicing laboratories & access')}
                        {actionType === 'pause' && (isPaused ? t('projects.actions.resumeTitle', 'Resume new admissions') : t('projects.actions.pauseTitle', 'Pause new admissions'))}
                        {actionType === 'archive' && t('projects.actions.archiveTitle', 'Review archival readiness')}
                        {actionType === 'delete' && t('projects.actions.deleteTitle', 'Delete empty project')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-sf-muted hover:text-sf-text p-1 rounded-lg"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {errorMessage && (
                    <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 text-red-800 dark:text-red-200 text-xs">
                        {errorMessage}
                    </div>
                )}

                {unresolvedOp && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 text-amber-900 dark:text-amber-200 text-xs space-y-2">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                            <div className="flex-1">
                                <span className="font-semibold">{t('projects.actions.unresolvedTitle', 'Unconfirmed previous attempt')}</span>
                                <p className="mt-0.5 text-[11px] text-amber-800/80 dark:text-amber-300/80">
                                    {t('projects.actions.unresolvedDesc', 'A previous attempt for this operation may have been processed by the server before the connection was interrupted.')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <button
                                type="button"
                                onClick={handleRecoverUnresolved}
                                disabled={submitting}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                            >
                                <RefreshCw className={`w-3 h-3 ${submitting ? 'animate-spin' : ''}`} />
                                {t('projects.actions.recoverAttempt', 'Recover previous attempt')}
                            </button>
                            <button
                                type="button"
                                onClick={handleDiscardUnresolved}
                                disabled={submitting}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-amber-400/60 dark:border-amber-600/60 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 transition-colors"
                            >
                                {t('projects.actions.discardAttempt', 'Discard attempt')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Subview: Menu */}
                {actionType === 'menu' && (
                    <div className="space-y-3 pt-1">
                        <p className="text-xs text-sf-muted">
                            {t('projects.actions.menuDesc', 'Project governance coordinates admissions and access. It never approves or completes laboratory measurements.')}
                        </p>

                        <div className="space-y-2">
                            {/* Option 0: Edit Settings & Plan */}
                            <button
                                onClick={() => {
                                    setActionType('edit');
                                    setEditName(project.name || '');
                                    setEditClient(project.client || '');
                                    setEditDescription(project.description || '');
                                    setEditExpectedCount(project.expectedSampleCount || '');
                                    setEditDeadline(project.deliveryDeadline ? String(project.deliveryDeadline).split('T')[0] : '');
                                    setEditBundle(project.defaultAnalysisBundle || '');
                                    setEditStatus(project.status || 'ACTIVE');
                                    setErrorMessage('');
                                }}
                                className="w-full text-left p-3.5 rounded-xl border border-sf-divider bg-sf-inset hover:bg-sf-hover transition-colors flex items-start gap-3"
                            >
                                <Settings className="w-5 h-5 text-sf-primary mt-0.5" />
                                <div>
                                    <div className="font-bold text-xs text-sf-text">
                                        {t('projects.actions.editSettingsBtn', 'Edit project settings & analysis plan')}
                                    </div>
                                    <div className="text-[11px] text-sf-muted mt-0.5">
                                        {t('projects.actions.editSettingsSub', 'Update metadata, client organization, deadlines, and default analysis package from the catalogue.')}
                                    </div>
                                </div>
                            </button>

                            {/* Option: Manage Servicing Laboratories & Access */}
                            <button
                                onClick={() => {
                                    setActionType('lab-access');
                                    const active = findActiveOp();
                                    setLabAccessReason(active?.action === 'lab-access' ? active.snapshot?.reason || '' : '');
                                }}
                                className="w-full text-left p-3.5 rounded-xl border border-sf-divider bg-sf-inset hover:bg-sf-hover transition-colors flex items-start gap-3"
                            >
                                <Building2 className="w-5 h-5 text-sf-primary mt-0.5" />
                                <div>
                                    <div className="font-bold text-xs text-sf-text">
                                        {t('projects.actions.manageLabAccessBtn', 'Manage servicing laboratories & access')}
                                    </div>
                                    <div className="text-[11px] text-sf-muted mt-0.5">
                                        {t('projects.actions.manageLabAccessSub', 'Configure authorized partner laboratories, review active work blockers, and update servicing scope.')}
                                    </div>
                                </div>
                            </button>

                            {/* Option 1: Pause / Resume */}
                            <button
                                onClick={() => {
                                    setActionType('pause');
                                    const active = findActiveOp();
                                    setReason(active?.action === 'pause' ? active.snapshot?.reason || '' : '');
                                }}
                                className="w-full text-left p-3.5 rounded-xl border border-sf-divider bg-sf-inset hover:bg-sf-hover transition-colors flex items-start gap-3"
                            >
                                {isPaused ? <Play className="w-5 h-5 text-emerald-600 mt-0.5" /> : <Pause className="w-5 h-5 text-amber-600 mt-0.5" />}
                                <div>
                                    <div className="font-bold text-xs text-sf-text">
                                        {isPaused ? t('projects.actions.resumeBtn', 'Resume new admissions') : t('projects.actions.pauseBtn', 'Pause new admissions')}
                                    </div>
                                    <div className="text-[11px] text-sf-muted mt-0.5">
                                        {t('projects.actions.pauseSub', 'Existing received samples continue through routine laboratory checks.')}
                                    </div>
                                </div>
                            </button>

                            {/* Option 2: Archive Readiness */}
                            <button
                                onClick={() => {
                                    setActionType('archive');
                                    const active = findActiveOp();
                                    setReason(active?.action === 'archive' ? active.snapshot?.reason || '' : '');
                                }}
                                className="w-full text-left p-3.5 rounded-xl border border-sf-divider bg-sf-inset hover:bg-sf-hover transition-colors flex items-start gap-3"
                            >
                                <Archive className="w-5 h-5 text-sf-muted mt-0.5" />
                                <div>
                                    <div className="font-bold text-xs text-sf-text">
                                        {t('projects.actions.archiveBtn', 'Review archival readiness')}
                                    </div>
                                    <div className="text-[11px] text-sf-muted mt-0.5">
                                        {t('projects.actions.archiveSub', 'Verify unresolved samples, active work, and external sync before closing.')}
                                    </div>
                                </div>
                            </button>

                            {/* Option 3: Delete Empty (only if 0 samples) */}
                            {totalRegistered === 0 && (
                                <button
                                    onClick={() => { setActionType('delete'); setReason(''); }}
                                    className="w-full text-left p-3.5 rounded-xl border border-red-200 dark:border-red-950 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/50 transition-colors flex items-start gap-3 text-red-700 dark:text-red-300"
                                >
                                    <Trash2 className="w-5 h-5 text-red-600 mt-0.5" />
                                    <div>
                                        <div className="font-bold text-xs">
                                            {t('projects.actions.deleteBtn', 'Move empty project to trash')}
                                        </div>
                                        <div className="text-[11px] opacity-80 mt-0.5">
                                            {t('projects.actions.deleteSub', 'Allowed only because zero samples have ever been registered to this draft.')}
                                        </div>
                                    </div>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Subview: Edit Settings & Plan */}
                {actionType === 'edit' && (
                    <form onSubmit={handleSaveSettings} className="space-y-3.5 pt-1">
                        <div>
                            <label className="block text-xs font-semibold text-sf-text mb-1">
                                {t('projects.create.nameLabel', 'Project name *')}
                            </label>
                            <input
                                type="text"
                                required
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full text-xs rounded-xl border border-sf-border bg-sf-inset px-3 py-2 text-sf-text placeholder:text-sf-muted focus:ring-2 focus:ring-sf-primary focus:outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-sf-text mb-1">
                                    {t('projects.create.clientLabel', 'Client / Partner organization')}
                                </label>
                                <input
                                    type="text"
                                    value={editClient}
                                    onChange={(e) => setEditClient(e.target.value)}
                                    className="w-full text-xs rounded-xl border border-sf-border bg-sf-inset px-3 py-2 text-sf-text placeholder:text-sf-muted focus:ring-2 focus:ring-sf-primary focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-sf-text mb-1">
                                    {t('projects.overview.nextDelivery', 'Delivery deadline')}
                                </label>
                                <input
                                    type="date"
                                    value={editDeadline}
                                    onChange={(e) => setEditDeadline(e.target.value)}
                                    className="w-full text-xs rounded-xl border border-sf-border bg-sf-inset px-3 py-2 text-sf-text focus:ring-2 focus:ring-sf-primary focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-sf-text mb-1">
                                    {t('projects.create.targetCountLabel', 'Expected sample count')}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={editExpectedCount}
                                    onChange={(e) => setEditExpectedCount(e.target.value)}
                                    className="w-full text-xs rounded-xl border border-sf-border bg-sf-inset px-3 py-2 text-sf-text focus:ring-2 focus:ring-sf-primary focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-sf-text mb-1">
                                    {t('projects.overview.defaultPlan', 'Default analysis package')}
                                </label>
                                <select
                                    value={editBundle}
                                    onChange={(e) => setEditBundle(e.target.value)}
                                    className="w-full text-xs rounded-xl border border-sf-border bg-sf-inset px-3 py-2 text-sf-text focus:ring-2 focus:ring-sf-primary focus:outline-none"
                                >
                                    <option value="">{t('projects.plan.noBundleTitle', 'No analysis bundle assigned')}</option>
                                    {catalogueGroups.map(g => (
                                        <option key={g.id || g.name} value={g.id || g.name}>
                                            {g.name} ({Array.isArray(g.analyses) ? g.analyses.length : 0} methods)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-sf-text mb-1">
                                {t('projects.create.descriptionLabel', 'Description / Notes')}
                            </label>
                            <textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                rows={2}
                                className="w-full text-xs rounded-xl border border-sf-border bg-sf-inset px-3 py-2 text-sf-text placeholder:text-sf-muted focus:ring-2 focus:ring-sf-primary focus:outline-none"
                            />
                        </div>

                        {isDraft && (
                            <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 text-xs space-y-2">
                                <label className="flex items-center gap-2 font-semibold text-sf-text cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editStatus === 'ACTIVE'}
                                        onChange={(e) => setEditStatus(e.target.checked ? 'ACTIVE' : 'DRAFT')}
                                        className="rounded border-sf-border text-sf-primary focus:ring-sf-primary"
                                    />
                                    <span>{t('projects.actions.activateProjectLabel', 'Activate project for admissions')}</span>
                                </label>
                                <p className="text-[11px] text-sf-muted">
                                    {t('projects.actions.activateProjectDesc', 'Check this box when initial setup is complete and the project is ready to receive sample manifests and intake.')}
                                </p>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setActionType('menu')}
                                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-sf-border text-sf-muted hover:bg-sf-hover"
                            >
                                {t('common.back', 'Back')}
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="btn-primary text-xs"
                            >
                                {submitting ? t('common.loading', 'Saving…') : (unresolvedOp?.action === 'edit' ? t('projects.actions.retrySaving', 'Retry saving') : t('common.save', 'Save changes'))}
                            </button>
                        </div>
                    </form>
                )}

                {/* Subview: Pause / Resume Admissions */}
                {actionType === 'pause' && (
                    <div className="space-y-4 pt-1">
                        <div className="p-3.5 rounded-xl bg-sf-inset border border-sf-divider text-xs text-sf-muted space-y-1">
                            <strong className="text-sf-text font-semibold block">
                                {isPaused ? t('projects.actions.resumingNotice', 'Resuming admissions') : t('projects.actions.pausingNotice', 'Pausing admissions')}
                            </strong>
                            <p>
                                {isPaused
                                    ? t('projects.actions.resumingDesc', 'New expected samples and reception intake will be permitted again. Prior laboratory work remains completely untouched.')
                                    : t('projects.actions.pausingDesc', 'New sample reception and manifest imports will be paused. Already received samples remain actionable in the workbench.')}
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-sf-text mb-1">
                                {t('projects.actions.reasonLabel', 'Reason for status transition (required)')}
                            </label>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder={t('projects.actions.reasonPlaceholder', 'e.g. Temporary field shipment delay until next month…')}
                                rows={3}
                                className="w-full text-xs rounded-xl border border-sf-border bg-sf-inset p-3 text-sf-text placeholder:text-sf-muted focus:ring-2 focus:ring-sf-primary focus:outline-none"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setActionType('menu')}
                                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-sf-border text-sf-muted hover:bg-sf-hover"
                            >
                                {t('common.back', 'Back')}
                            </button>
                            <button
                                onClick={handleTogglePause}
                                disabled={submitting || !reason.trim()}
                                className="btn-primary text-xs"
                            >
                                {submitting ? t('common.loading', 'Updating…') : (unresolvedOp?.action === 'pause' ? t('projects.actions.retryTransition', 'Retry transition') : t('common.confirm', 'Confirm transition'))}
                            </button>
                        </div>
                    </div>
                )}

                {/* Subview: Archival Readiness */}
                {actionType === 'archive' && (
                    <div className="space-y-4 pt-1">
                        {!canArchive ? (
                            <div className="space-y-3">
                                <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <strong className="font-bold block">
                                            {t('projects.actions.archiveBlocked', 'This project is not ready to archive.')}
                                        </strong>
                                        <p className="mt-0.5">
                                            {t('projects.actions.archiveBlockedDesc', 'Archival cannot be used as an analytical shortcut. All expected and in-progress samples must be accounted for first.')}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2 text-xs">
                                    <div className="flex justify-between py-2 border-b border-sf-divider">
                                        <span className="text-sf-muted">{t('projects.actions.expectedToReconcile', 'Expected unaccounted samples')}</span>
                                        <strong className={`font-bold ${pendingExpected > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                            {pendingExpected}
                                        </strong>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-sf-divider">
                                        <span className="text-sf-muted">{t('projects.actions.labWorkToResolve', 'Intake, analysis, or review in progress')}</span>
                                        <strong className={`font-bold ${pendingLabWork > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                            {pendingLabWork}
                                        </strong>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        onClick={() => setActionType('menu')}
                                        className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-sf-border text-sf-muted hover:bg-sf-hover"
                                    >
                                        {t('common.back', 'Back')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 text-xs flex items-start gap-2.5">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                        <strong className="font-bold block">
                                            {t('projects.actions.archiveReady', 'Project is eligible for archival.')}
                                        </strong>
                                        <p className="mt-0.5">
                                            {t('projects.actions.archiveReadyDesc', 'Zero pending expected samples and zero active unreviewed measurements. Released reports and historical access remain preserved.')}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-sf-text mb-1">
                                        {t('projects.actions.reasonLabel', 'Reason for archival (required)')}
                                    </label>
                                    <textarea
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder={t('projects.actions.archiveReasonPlaceholder', 'e.g. Sampling season concluded and all certificates released…')}
                                        rows={3}
                                        className="w-full text-xs rounded-xl border border-sf-border bg-sf-inset p-3 text-sf-text placeholder:text-sf-muted focus:ring-2 focus:ring-sf-primary focus:outline-none"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        onClick={() => setActionType('menu')}
                                        className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-sf-border text-sf-muted hover:bg-sf-hover"
                                    >
                                        {t('common.back', 'Back')}
                                    </button>
                                    <button
                                        onClick={handleArchive}
                                        disabled={submitting || !reason.trim()}
                                        className="btn-primary text-xs"
                                    >
                                        {submitting ? t('common.loading', 'Archiving…') : (unresolvedOp?.action === 'archive' ? t('projects.actions.retryArchive', 'Retry archive') : t('projects.actions.confirmArchive', 'Archive project'))}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Subview: Delete Empty Project */}
                {actionType === 'delete' && (
                    <div className="space-y-4 pt-1">
                        <div className="p-3.5 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 text-xs">
                            <strong className="font-bold block">
                                {t('projects.actions.deleteWarningTitle', 'Move empty project to trash')}
                            </strong>
                            <p className="mt-0.5">
                                {t('projects.actions.deleteWarningDesc', 'This action will soft-delete this draft project. It is permitted only because no samples were ever registered to it.')}
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                onClick={() => setActionType('menu')}
                                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-sf-border text-sf-muted hover:bg-sf-hover"
                            >
                                {t('common.back', 'Back')}
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={submitting}
                                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                            >
                                {submitting ? t('common.loading', 'Deleting…') : t('common.delete', 'Confirm delete')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Subview: Servicing Laboratories & Access */}
                {actionType === 'lab-access' && (
                    <div className="space-y-4 pt-1">
                        {labAccessLoading ? (
                            <div className="p-8 flex flex-col items-center justify-center gap-3 text-sf-muted text-xs">
                                <RefreshCw className="w-6 h-6 animate-spin text-sf-primary" />
                                <span>{t('projects.actions.loadingLabAccess', 'Loading laboratory access directory…')}</span>
                            </div>
                        ) : labAccessError ? (
                            <div className="p-4 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200 text-xs space-y-3">
                                <div className="flex items-start gap-2.5">
                                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                    <div>
                                        <strong className="font-bold block">{t('projects.actions.loadFailedTitle', 'Failed to load laboratory access')}</strong>
                                        <p className="mt-0.5 text-[11px]">{labAccessError}</p>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setActionType('menu')}
                                        className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-sf-border text-sf-muted hover:bg-sf-hover"
                                    >
                                        {t('common.back', 'Back')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={fetchLabAccessData}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 flex items-center gap-1.5"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        {t('common.retry', 'Retry')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSaveLabAccess} className="space-y-4">
                                <div className="p-3.5 rounded-xl bg-sf-inset border border-sf-divider text-xs space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sf-muted font-medium">{t('projects.actions.coordinatingOwnerLabel', 'Primary Coordinating Owner:')}</span>
                                        <span className="inline-flex items-center gap-1 font-bold text-sf-primary bg-sf-primary/10 px-2 py-0.5 rounded-md border border-sf-primary/20">
                                            <Shield className="w-3.5 h-3.5" />
                                            {(() => {
                                                const ownerId = project.labId || labAccessData?.ownerLabId;
                                                const ownerLab = allLabs.find(l => l.id === ownerId || l.code === ownerId);
                                                return ownerLab ? `${ownerLab.name} (${ownerLab.code || ownerLab.id})` : (ownerId || t('common.none', 'None'));
                                            })()}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-sf-muted">
                                        {t('projects.actions.ownerImmutableNote', 'The primary owner laboratory is established at project creation and cannot be removed through servicing management.')}
                                    </p>
                                </div>

                                {/* Blocker Alert if removal blocked */}
                                {blockerNotice && (
                                    <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs space-y-2.5">
                                        <div className="flex items-start gap-2">
                                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                            <div>
                                                <strong className="font-bold block">{t('projects.actions.removalBlockedTitle', 'Cannot remove laboratory with active work')}</strong>
                                                <p className="mt-0.5 text-[11px]">{blockerNotice.message}</p>
                                            </div>
                                        </div>
                                        <p className="text-[11px] opacity-90 pl-7">{blockerNotice.detail}</p>
                                        <div className="pl-7 pt-1">
                                            <a
                                                href={`/tech-workbench?projectCode=${encodeURIComponent(project.code || project.id)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-semibold text-sf-primary hover:underline inline-flex items-center gap-1"
                                            >
                                                {t('projects.actions.goToWorkbench', 'Open Tech Workbench to complete or transfer work')} &rarr;
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Servicing Labs Selection */}
                                <div className="space-y-2">
                                    <label className="block text-xs font-semibold text-sf-text">
                                        {t('projects.actions.servicingLabsLabel', 'Authorized servicing laboratories')}
                                    </label>
                                    <p className="text-[11px] text-sf-muted">
                                        {t('projects.actions.servicingLabsDesc', 'Select analytical facilities authorized to receive and process samples for this project.')}
                                    </p>

                                    <div className="max-h-52 overflow-y-auto space-y-1.5 p-2 rounded-xl border border-sf-border bg-sf-inset">
                                        {allLabs
                                            .filter(l => l.id !== (project.labId || labAccessData?.ownerLabId))
                                            .map(lab => {
                                                const isSelected = selectedServicingIds.includes(lab.id);
                                                const isInactive = lab.isActive === false;
                                                // An inactive lab can be deselected (removed), but an unselected inactive lab cannot be selected (added).
                                                const canToggle = !submitting && (!isInactive || isSelected);
                                                return (
                                                    <label
                                                        key={lab.id}
                                                        className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                                                            canToggle ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                                                        } ${
                                                            isSelected
                                                                ? 'bg-sf-surface border-sf-primary/40 shadow-xs'
                                                                : 'bg-sf-surface/50 border-sf-divider hover:bg-sf-surface'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                disabled={!canToggle}
                                                                onChange={() => canToggle && handleToggleServicingLab(lab.id)}
                                                                className="rounded border-sf-border text-sf-primary focus:ring-sf-primary"
                                                            />
                                                            <div>
                                                                <div className="font-bold text-xs text-sf-text">{lab.name || lab.code || lab.id}</div>
                                                                <div className="text-[11px] text-sf-muted font-mono">{lab.code || lab.id} · {lab.country || '—'}</div>
                                                            </div>
                                                        </div>
                                                        {isInactive && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold">
                                                                {t('common.inactive', 'Inactive')}
                                                            </span>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                        {allLabs.filter(l => l.id !== (project.labId || labAccessData?.ownerLabId)).length === 0 && (
                                            <div className="p-4 text-center text-xs text-sf-muted">
                                                {t('projects.actions.noOtherLabs', 'No other active laboratories available in directory.')}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Reason field (required for audit) */}
                                <div>
                                    <label className="block text-xs font-semibold text-sf-text mb-1">
                                        {t('projects.actions.reasonForChange', 'Reason for membership change (required)')}
                                    </label>
                                    <textarea
                                        value={labAccessReason}
                                        onChange={(e) => setLabAccessReason(e.target.value)}
                                        placeholder={t('projects.actions.labAccessPlaceholder', 'e.g. Authorized regional servicing assignment for Phase 2 intake…')}
                                        rows={3}
                                        className="w-full text-xs rounded-xl border border-sf-border bg-sf-inset p-3 text-sf-text placeholder:text-sf-muted focus:ring-2 focus:ring-sf-primary focus:outline-none"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setActionType('menu')}
                                        className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-sf-border text-sf-muted hover:bg-sf-hover"
                                    >
                                        {t('common.back', 'Back')}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={
                                            submitting ||
                                            labAccessLoading ||
                                            !!labAccessError ||
                                            !labAccessReason.trim() ||
                                            !labAccessData ||
                                            String(labAccessData.projectId) !== String(project.id) ||
                                            labAccessData.canManage !== true
                                        }
                                        className="btn-primary text-xs flex items-center gap-1.5"
                                    >
                                        {submitting ? t('common.loading', 'Saving…') : (unresolvedOp?.action === 'lab-access' ? t('projects.actions.retrySave', 'Retry save') : t('projects.actions.saveLabAccessBtn', 'Save laboratory access'))}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
