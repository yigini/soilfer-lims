import React, { useState } from 'react';
import axios from 'axios';
import { X, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export default function SuspendUserModal({ isOpen, user, onClose, onSuccess }) {
    const { t } = useLanguage();
    const modalRef = useFocusTrap(isOpen, onClose);
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const isSuspending = user?.isActive !== false;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSuspending && !reason.trim()) {
            setError('A reason is required to suspend an account.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            if (isSuspending) {
                await axios.post(`/api/users/${user.id}/suspend`, {
                    reason: reason.trim()
                });
            } else {
                await axios.post(`/api/users/${user.id}/reactivate`);
            }

            if (onSuccess) {
                onSuccess(isSuspending ? 'User suspended successfully' : 'User reactivated successfully');
            }
            onClose();
        } catch (err) {
            console.error('Failed to change user suspension state:', err);
            const msg = err.response?.data?.message || err.response?.data?.error || err.message;
            if (err.response?.data?.code === 'LAST_ADMIN_PROTECTED' || err.response?.status === 403) {
                setError('Protected: Cannot suspend or demote the last remaining Super Administrator in the system.');
            } else {
                setError(msg || 'Operation failed');
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || !user) return null;

    return (
        <div className="fixed inset-0 !m-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200">
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="suspend-user-title"
                className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-md border border-sf-divider max-h-[calc(100dvh-1rem)] max-h-[calc(100vh-1rem)] sm:max-h-[92vh] flex flex-col min-h-0 overflow-hidden"
            >
                <div className="p-4 sm:p-6 border-b border-sf-divider flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${isSuspending ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600' : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600'}`}>
                            <ShieldAlert size={20} />
                        </div>
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-sf-muted">
                                {t('staffManagement.suspend.title', 'Emergency Staff Suspension')}
                            </div>
                            <h2 id="suspend-user-title" className="text-lg font-black text-sf-text">
                                {isSuspending ? 'Suspend Account' : 'Reactivate Account'}
                            </h2>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label={t('common.close', 'Close')} className="p-2 hover:bg-sf-raised rounded-xl transition text-sf-muted hover:text-sf-text">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar min-h-0">
                        {error && (
                            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                                <AlertTriangle size={15} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="text-xs text-sf-muted space-y-1.5">
                            <p>
                                Target user: <strong>{user.name || user.username}</strong> ({user.role})
                            </p>
                            {isSuspending ? (
                                <p>
                                    Suspending will immediately revoke all active sessions. Unfinished tasks remain attributed and must be reassigned. Past results keep their authorship.
                                </p>
                            ) : (
                                <p>
                                    Reactivating restores login capabilities. Previously revoked sessions remain invalid; user must log in again with their established credentials.
                                </p>
                            )}
                        </div>

                        {isSuspending && (
                            <div>
                                <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    Suspension Reason <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    rows={2}
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="e.g. Placement concluded / Security concern"
                                    required
                                    className="w-full p-3 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-rose-500 outline-none transition resize-none"
                                />
                            </div>
                        )}
                    </div>

                    <div className="p-3 sm:p-4 sm:px-6 border-t border-sf-divider bg-sf-canvas/50 flex items-center justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-5 py-2.5 rounded-xl border border-sf-divider text-xs font-bold text-sf-muted hover:bg-sf-raised transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || (isSuspending && !reason.trim())}
                            className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white transition shadow-md disabled:opacity-50 ${
                                isSuspending ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                            }`}
                        >
                            {submitting ? 'Processing...' : isSuspending ? 'Suspend Account' : 'Reactivate Account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
