import React, { useState } from 'react';
import axios from 'axios';
import { X, KeyRound, Copy, CheckCircle2, AlertTriangle, Clock, ShieldAlert } from 'lucide-react';

export default function RecoveryLinkModal({ isOpen, user, onClose, onSuccess }) {
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [recoveryData, setRecoveryData] = useState(null);
    const [copied, setCopied] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reason.trim()) {
            setError('A recorded reason is required to issue an emergency recovery grant.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const res = await axios.post(`/api/users/${user.id}/recovery`, {
                reason: reason.trim()
            });
            setRecoveryData(res.data?.recovery || res.data);
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Failed to issue recovery link:', err);
            const msg = err.response?.data?.message || err.response?.data?.error || err.message;
            setError(msg || 'Failed to generate recovery link');
        } finally {
            setSubmitting(false);
        }
    };

    const copyLink = () => {
        const url = recoveryData?.recoveryUrl || `${window.location.origin}/recovery?token=${recoveryData?.token}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    if (!isOpen || !user) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-lg border border-sf-divider overflow-hidden">
                <div className="p-6 border-b border-sf-divider flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                            Emergency Account Access
                        </div>
                        <h2 className="text-xl font-black text-sf-text">One-Time Recovery Link</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-sf-raised rounded-xl transition text-sf-muted hover:text-sf-text">
                        <X size={18} />
                    </button>
                </div>

                {recoveryData ? (
                    <div className="p-6 space-y-5">
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-start gap-3">
                            <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <div className="text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                                <strong className="font-bold block text-sm">Recovery Link Generated</strong>
                                <p>
                                    A single-use, 30-minute recovery token was created for <strong>{user.name || user.username}</strong>.
                                    Prior sessions were invalidated. The user will be required to establish a fresh credential.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-sf-muted block">
                                One-Time Access URL
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    readOnly
                                    value={recoveryData.recoveryUrl || `${window.location.origin}/recovery?token=${recoveryData.token}`}
                                    className="w-full font-mono text-xs p-3 bg-sf-canvas border border-sf-divider rounded-xl text-sf-text truncate"
                                />
                                <button
                                    onClick={copyLink}
                                    className="px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shrink-0"
                                >
                                    <Copy size={14} />
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-sf-muted mt-2">
                                <Clock size={13} />
                                <span>Expires in 30 minutes. Single-use only. Deliver via verified direct channel.</span>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-sf-divider flex justify-end">
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 bg-sf-primary text-white rounded-xl font-bold text-xs hover:bg-sf-primary/90 transition"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                                <AlertTriangle size={15} className="shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="p-3.5 bg-sf-raised/50 rounded-xl border border-sf-divider text-xs text-sf-muted space-y-1">
                            <p>
                                Recovering access for <strong>{user.name || user.username}</strong> ({user.email || user.username}).
                            </p>
                            <p className="text-[11px]">
                                Static password reset is disabled. This generates an audited, single-use, time-limited recovery link adhering to OWASP security guidelines.
                            </p>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                Reason for Recovery Grant <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                rows={2}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="e.g. Technician misplaced password on field assignment"
                                required
                                className="w-full p-3 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-amber-500 outline-none transition resize-none"
                            />
                        </div>

                        <div className="pt-3 border-t border-sf-divider flex items-center justify-end gap-3">
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
                                disabled={submitting || !reason.trim()}
                                className="px-6 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition shadow-md shadow-amber-600/20 disabled:opacity-50"
                            >
                                {submitting ? 'Generating...' : 'Issue Recovery Link'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
