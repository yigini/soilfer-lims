import React, { useState } from 'react';
import axios from 'axios';
import { X, AlertCircle, AlertTriangle, CheckCircle2, Pause, Play, Archive, Trash2, Settings } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function ProjectActionsModal({
    isOpen,
    onClose,
    project,
    counts,
    onSuccess,
    initialActionType = 'menu'
}) {
    const { t } = useLanguage();
    const [submitting, setSubmitting] = useState(false);
    const [actionType, setActionType] = useState(initialActionType); // 'menu' | 'edit' | 'pause' | 'archive' | 'delete'
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
            commandRef.current = null;
        }
    }, [isOpen, initialActionType, project]);

    const commandRef = React.useRef(null);

    // Invalidate retained command key whenever form inputs are modified
    React.useEffect(() => {
        commandRef.current = null;
    }, [editName, editClient, editDescription, editExpectedCount, editDeadline, editBundle, editStatus, reason]);

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
    }, [isOpen, actionType]);

    if (!isOpen || !project) return null;

    const isPaused = project.status === 'PAUSED';
    const isDraft = project.status === 'DRAFT' || project.status === 'PENDING_MANIFEST';
    const pendingExpected = counts?.awaitingArrival ?? 0;
    const pendingLabWork = (counts?.intakeInProgress ?? 0) + (counts?.labWork ?? 0) + (counts?.awaitingReview ?? 0);
    const totalRegistered = counts?.registered ?? 0;

    const canArchive = pendingExpected === 0 && pendingLabWork === 0;
    const canDelete = totalRegistered === 0;

    const handleSaveSettings = async (e) => {
        e?.preventDefault?.();
        if (!editName.trim()) {
            setErrorMessage(t('projects.create.nameRequired', 'Project name is required.'));
            return;
        }

        setSubmitting(true);
        setErrorMessage('');
        try {
            const payload = {
                name: editName.trim(),
                client: editClient.trim(),
                description: editDescription.trim(),
                expectedSampleCount: editExpectedCount ? parseInt(editExpectedCount, 10) : 0,
                deliveryDeadline: editDeadline || null,
                defaultAnalysisBundle: editBundle || null,
                status: editStatus
            };

            let idempotencyKey;
            let isRetry = false;
            if (commandRef.current && commandRef.current.action === 'edit' && JSON.stringify(commandRef.current.snapshot) === JSON.stringify(payload)) {
                idempotencyKey = commandRef.current.key;
                isRetry = true;
            } else {
                idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : (`proj-upd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
                commandRef.current = {
                    key: idempotencyKey,
                    action: 'edit',
                    snapshot: JSON.parse(JSON.stringify(payload))
                };
            }

            // If retrying an uncertain command, resolve existing receipt first
            if (isRetry) {
                try {
                    const receiptRes = await axios.get(`/api/projects/${project.id}/operations/${idempotencyKey}`);
                    if (receiptRes.data?.receipt?.outcome) {
                        commandRef.current = null;
                        onSuccess?.('PROJECT_UPDATED');
                        onClose();
                        return;
                    }
                } catch (receiptErr) {
                    // No receipt recorded yet, proceed to execute mutation
                }
            }

            const headers = {
                'x-idempotency-key': idempotencyKey
            };
            if (project.updatedAt) {
                headers['if-match'] = String(new Date(project.updatedAt).getTime());
            }

            await axios.put(`/api/projects/${project.id}`, { ...payload, idempotencyKey }, { headers });
            commandRef.current = null;
            onSuccess?.('PROJECT_UPDATED');
            onClose();
        } catch (err) {
            const status = err.response?.status;
            const errCode = err.response?.data?.code || err.response?.data?.error;
            if (status === 409 && (errCode === 'STALE_REVISION' || errCode === 'PREVIEW_STALE_REVISION')) {
                commandRef.current = null;
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

        setSubmitting(true);
        setErrorMessage('');
        try {
            const nextStatus = isPaused ? 'ACTIVE' : 'PAUSED';
            const payload = { status: nextStatus, reason: reason.trim() };

            let idempotencyKey;
            let isRetry = false;
            if (commandRef.current && commandRef.current.action === 'pause' && JSON.stringify(commandRef.current.snapshot) === JSON.stringify(payload)) {
                idempotencyKey = commandRef.current.key;
                isRetry = true;
            } else {
                idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : (`proj-pause-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
                commandRef.current = {
                    key: idempotencyKey,
                    action: 'pause',
                    snapshot: JSON.parse(JSON.stringify(payload))
                };
            }

            if (isRetry) {
                try {
                    const receiptRes = await axios.get(`/api/projects/${project.id}/operations/${idempotencyKey}`);
                    if (receiptRes.data?.receipt?.outcome) {
                        commandRef.current = null;
                        onSuccess?.(nextStatus === 'ACTIVE' ? 'PROJECT_RESUMED' : 'PROJECT_PAUSED');
                        onClose();
                        return;
                    }
                } catch (receiptErr) {
                    // No receipt yet, execute mutation
                }
            }

            const headers = {
                'x-idempotency-key': idempotencyKey
            };
            if (project.updatedAt) {
                headers['if-match'] = String(new Date(project.updatedAt).getTime());
            }

            await axios.put(`/api/projects/${project.id}`, { ...payload, idempotencyKey }, { headers });
            commandRef.current = null;
            onSuccess?.(nextStatus === 'ACTIVE' ? 'PROJECT_RESUMED' : 'PROJECT_PAUSED');
            onClose();
        } catch (err) {
            const status = err.response?.status;
            const errCode = err.response?.data?.code || err.response?.data?.error;
            if (status === 409 && (errCode === 'STALE_REVISION' || errCode === 'PREVIEW_STALE_REVISION')) {
                commandRef.current = null;
            }
            setErrorMessage(err.response?.data?.message || err.response?.data?.error || 'Failed to update status');
        } finally {
            setSubmitting(false);
        }
    };

    const handleArchive = async () => {
        if (!canArchive) return;
        setSubmitting(true);
        setErrorMessage('');
        try {
            const payload = { reason: reason.trim() };

            let idempotencyKey;
            let isRetry = false;
            if (commandRef.current && commandRef.current.action === 'archive' && JSON.stringify(commandRef.current.snapshot) === JSON.stringify(payload)) {
                idempotencyKey = commandRef.current.key;
                isRetry = true;
            } else {
                idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : (`proj-arch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
                commandRef.current = {
                    key: idempotencyKey,
                    action: 'archive',
                    snapshot: JSON.parse(JSON.stringify(payload))
                };
            }

            if (isRetry) {
                try {
                    const receiptRes = await axios.get(`/api/projects/${project.id}/operations/${idempotencyKey}`);
                    if (receiptRes.data?.receipt?.outcome) {
                        commandRef.current = null;
                        onSuccess?.('PROJECT_ARCHIVED');
                        onClose();
                        return;
                    }
                } catch (receiptErr) {
                    // No receipt yet, execute mutation
                }
            }

            const headers = {
                'x-idempotency-key': idempotencyKey
            };
            if (project.updatedAt) {
                headers['if-match'] = String(new Date(project.updatedAt).getTime());
            }

            await axios.post(`/api/projects/${project.id}/archive`, { ...payload, idempotencyKey }, { headers });
            commandRef.current = null;
            onSuccess?.('PROJECT_ARCHIVED');
            onClose();
        } catch (err) {
            const status = err.response?.status;
            const errCode = err.response?.data?.code || err.response?.data?.error;
            if (status === 409 && (errCode === 'STALE_REVISION' || errCode === 'PREVIEW_STALE_REVISION')) {
                commandRef.current = null;
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-sf-surface border border-sf-divider rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-sf-divider">
                    <h2 className="text-lg font-bold text-sf-text">
                        {actionType === 'menu' && t('projects.actions.modalTitle', 'Project governance actions')}
                        {actionType === 'edit' && t('projects.actions.editSettingsTitle', 'Edit project settings & plan')}
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

                            {/* Option 1: Pause / Resume */}
                            <button
                                onClick={() => { setActionType('pause'); setReason(''); }}
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
                                onClick={() => { setActionType('archive'); setReason(''); }}
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
                                {submitting ? t('common.loading', 'Saving…') : (commandRef.current?.action === 'edit' ? t('common.retry', 'Retry saving') : t('common.save', 'Save changes'))}
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
                                {submitting ? t('common.loading', 'Updating…') : (commandRef.current?.action === 'pause' ? t('common.retry', 'Retry transition') : t('common.confirm', 'Confirm transition'))}
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
                                        {submitting ? t('common.loading', 'Archiving…') : (commandRef.current?.action === 'archive' ? t('common.retry', 'Retry archive') : t('projects.actions.confirmArchive', 'Archive project'))}
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
            </div>
        </div>
    );
}
