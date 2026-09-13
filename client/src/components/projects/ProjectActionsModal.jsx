import React, { useState } from 'react';
import axios from 'axios';
import { X, AlertCircle, AlertTriangle, CheckCircle2, Pause, Play, Archive, Trash2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function ProjectActionsModal({
    isOpen,
    onClose,
    project,
    counts,
    onSuccess
}) {
    const { t } = useLanguage();
    const [submitting, setSubmitting] = useState(false);
    const [actionType, setActionType] = useState('menu'); // 'menu' | 'pause' | 'archive' | 'delete'
    const [reason, setReason] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    if (!isOpen || !project) return null;

    const isPaused = project.status === 'PAUSED';
    const pendingExpected = counts?.awaitingArrival ?? 0;
    const pendingLabWork = (counts?.intakeInProgress ?? 0) + (counts?.labWork ?? 0) + (counts?.awaitingReview ?? 0);
    const totalRegistered = counts?.registered ?? 0;

    const canArchive = pendingExpected === 0 && pendingLabWork === 0;
    const canDelete = totalRegistered === 0;

    const handleTogglePause = async () => {
        if (!reason.trim()) {
            setErrorMessage(t('projects.modals.reasonRequired', 'A reason is required to modify admissions status.'));
            return;
        }

        setSubmitting(true);
        setErrorMessage('');
        try {
            const nextStatus = isPaused ? 'ACTIVE' : 'PAUSED';
            await axios.put(`/api/projects/${project.id}`, { status: nextStatus, reason });
            onSuccess?.(nextStatus === 'ACTIVE' ? 'PROJECT_RESUMED' : 'PROJECT_PAUSED');
            onClose();
        } catch (err) {
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
            await axios.post(`/api/projects/${project.id}/archive`, { reason });
            onSuccess?.('PROJECT_ARCHIVED');
            onClose();
        } catch (err) {
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
                                {submitting ? t('common.loading', 'Updating…') : t('common.confirm', 'Confirm transition')}
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
                                        {submitting ? t('common.loading', 'Archiving…') : t('projects.actions.confirmArchive', 'Archive project')}
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
