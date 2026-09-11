import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Shield, AlertTriangle, CheckCircle2, ArrowRight, RefreshCw, Clock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export default function AccessReviewModal({ isOpen, user, onClose, onSuccess, currentLabId }) {
    const { t } = useLanguage();
    const modalRef = useFocusTrap(isOpen, onClose);
    const [proposedRole, setProposedRole] = useState(user?.role || 'LAB_TECHNICIAN');
    const [reason, setReason] = useState('');
    const [confirmImpact, setConfirmImpact] = useState(false);
    const [assignableRoles, setAssignableRoles] = useState([]);
    const [preview, setPreview] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [conflictError, setConflictError] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && user) {
            setProposedRole(user.role);
            setReason('');
            setConfirmImpact(false);
            setConflictError(null);
            setError(null);
            fetchAssignableRoles();
            fetchPreview(user.role);
        }
    }, [isOpen, user]);

    const fetchAssignableRoles = async () => {
        try {
            const labQuery = currentLabId ? `?labId=${encodeURIComponent(currentLabId)}` : '';
            const res = await axios.get(`/api/access/assignable-roles${labQuery}`);
            if (res.data?.assignableRoles) {
                setAssignableRoles(res.data.assignableRoles);
            }
        } catch (err) {
            console.warn('Failed to load assignable roles', err);
        }
    };

    const fetchPreview = async (nextRole) => {
        if (!user) return;
        setLoadingPreview(true);
        setError(null);
        try {
            const res = await axios.post(`/api/users/${user.id}/access-preview`, {
                role: nextRole
            });
            setPreview(res.data?.preview || res.data);
            setConflictError(null);
        } catch (err) {
            console.error('Failed to get access preview:', err);
            const msg = err.response?.data?.message || err.response?.data?.error || err.message;
            setError(msg || 'Failed to preview access changes');
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleRoleChange = (newRole) => {
        setProposedRole(newRole);
        fetchPreview(newRole);
    };

    const handleApply = async () => {
        if (!reason.trim() || !confirmImpact) return;
        setSubmitting(true);
        setError(null);
        setConflictError(null);

        try {
            await axios.patch(`/api/users/${user.id}/access`, {
                changes: { role: proposedRole },
                reviewToken: preview?.reviewToken,
                reason: reason.trim()
            });

            if (onSuccess) {
                onSuccess({
                    message: `Access updated for ${user.name || user.username}.`,
                    openWorkItems: preview?.impact?.openWorkItems || 0
                });
            }
            onClose();
        } catch (err) {
            console.error('Failed to apply access changes:', err);
            if (err.response?.status === 409 || err.response?.data?.code === 'STALE_REVISION') {
                setConflictError('This record changed while you were reviewing it. Your proposed edits are preserved. Reload the current revision before reviewing again.');
            } else {
                const msg = err.response?.data?.message || err.response?.data?.error || err.message;
                setError(msg || 'Failed to apply access changes');
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || !user) return null;

    const currentRoleTitle = assignableRoles.find(r => r.role === user.role)?.displayName || user.role;
    const proposedRoleTitle = assignableRoles.find(r => r.role === proposedRole)?.displayName || proposedRole;
    const openTasks = preview?.impact?.openWorkItems ?? preview?.current?.openWorkCount ?? 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="access-review-title"
                className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-2xl border border-sf-divider max-h-[92vh] flex flex-col overflow-hidden"
            >
                {/* Modal Head */}
                <div className="p-6 border-b border-sf-divider flex items-center justify-between shrink-0">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-sf-muted">
                            {t('staffManagement.review.title', 'Pre-Change Access Review')}
                        </div>
                        <h2 id="access-review-title" className="text-xl font-black text-sf-text">
                            Review Access: {user.name || user.username}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-sf-raised rounded-xl transition text-sf-muted hover:text-sf-text">
                        <X size={18} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                    {conflictError && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2">
                            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-xs font-bold">
                                <AlertTriangle size={16} className="shrink-0" />
                                <span>{conflictError}</span>
                            </div>
                            <button
                                onClick={() => fetchPreview(proposedRole)}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                            >
                                <RefreshCw size={12} /> Reload Current Revision
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                            <AlertTriangle size={15} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Role Selection */}
                    <div>
                        <label className="block text-[11px] font-bold text-sf-muted mb-1.5 uppercase tracking-wider">
                            Proposed System Role
                        </label>
                        <select
                            value={proposedRole}
                            onChange={(e) => handleRoleChange(e.target.value)}
                            disabled={loadingPreview}
                            className="w-full px-3.5 py-2.5 bg-sf-canvas border border-sf-divider rounded-xl text-sm font-semibold text-sf-text focus:ring-2 focus:ring-sf-primary outline-none transition"
                        >
                            {assignableRoles.map(r => {
                                const roleVal = r.key || r.role;
                                return (
                                    <option key={roleVal} value={roleVal}>
                                        {r.displayName || roleVal}
                                    </option>
                                );
                            })}
                        </select>
                        <p className="text-xs text-sf-muted mt-1.5">
                            Only roles you can assign within this laboratory scope are offered.
                        </p>
                    </div>

                    {/* Two-Column Comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Current Column */}
                        <div className="p-4 rounded-xl bg-sf-canvas border border-sf-divider space-y-2.5">
                            <div className="text-[10px] font-black uppercase tracking-widest text-sf-muted">
                                Current Access
                            </div>
                            <div className="text-base font-bold text-sf-text">
                                {currentRoleTitle}
                            </div>
                            <ul className="text-xs text-sf-muted space-y-1.5 list-disc list-inside">
                                <li>Assigned to: {user.labId || 'Global scope'}</li>
                                <li>Prior results and reports keep original authorship</li>
                                <li>{openTasks > 0 ? `${openTasks} unfinished work assignments` : 'No open tasks'}</li>
                            </ul>
                        </div>

                        {/* Proposed Column */}
                        <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2.5">
                            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                Proposed Access
                            </div>
                            <div className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                                {proposedRoleTitle}
                            </div>
                            <ul className="text-xs text-emerald-800/90 dark:text-emerald-300 space-y-1.5 list-disc list-inside">
                                {preview?.proposed?.gainedCapabilities?.slice(0, 3).map((cap, i) => (
                                    <li key={i}>Gains: {cap.replace(/_/g, ' ').toLowerCase()}</li>
                                ))}
                                {preview?.proposed?.lostCapabilities?.slice(0, 3).map((cap, i) => (
                                    <li key={i} className="text-amber-700 dark:text-amber-300">Relinquishes: {cap.replace(/_/g, ' ').toLowerCase()}</li>
                                ))}
                                {(!preview?.proposed?.gainedCapabilities?.length && !preview?.proposed?.lostCapabilities?.length) && (
                                    <li>Permissions governed by updated role contract</li>
                                )}
                            </ul>
                        </div>
                    </div>

                    {/* Handover Notice */}
                    {openTasks > 0 && (
                        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
                            <strong className="font-bold flex items-center gap-1.5">
                                <AlertTriangle size={14} className="text-amber-600" />
                                Handover Needed ({openTasks} open assignments)
                            </strong>
                            <p>
                                Changing roles does not delete or reassign active tasks. Completed results retain their original author. The lab manager should reassign open items.
                            </p>
                        </div>
                    )}

                    {/* Non-reassignment & Session Note */}
                    <div className="text-xs text-sf-muted p-3 bg-sf-raised/40 rounded-xl border border-sf-divider">
                        Committing access changes will increment the user's security version (<code className="font-mono text-[11px]">tokenVersion</code>) to revoke stale sessions and ensure immediate RBAC enforcement.
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                            Reason for this change <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            rows={2}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Technician promoted to QA review role for ISO 17025 audit"
                            required
                            className="w-full p-3 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none transition resize-none"
                        />
                    </div>

                    {/* Confirmation Checkbox */}
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={confirmImpact}
                            onChange={(e) => setConfirmImpact(e.target.checked)}
                            className="mt-1 w-4 h-4 rounded text-sf-primary border-sf-divider focus:ring-sf-primary"
                        />
                        <span className="text-xs text-sf-muted font-medium">
                            I have reviewed the scope, capabilities diff, and any unfinished tasks that require handover.
                        </span>
                    </label>
                </div>

                {/* Modal Foot */}
                <div className="p-4 px-6 border-t border-sf-divider bg-sf-canvas/50 flex items-center justify-between shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-5 py-2.5 rounded-xl border border-sf-divider text-xs font-bold text-sf-muted hover:bg-sf-raised transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleApply}
                        disabled={submitting || !reason.trim() || !confirmImpact || !!conflictError}
                        className="px-6 py-2.5 bg-sf-primary text-white rounded-xl text-xs font-bold hover:bg-sf-primary/90 transition shadow-md shadow-sf-primary/20 disabled:opacity-50"
                    >
                        {submitting ? 'Applying Changes...' : 'Apply These Access Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
