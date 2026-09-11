import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, PauseCircle, PlayCircle, Archive, AlertTriangle, CheckCircle2, Shield } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export default function LabLifecycleModal({ isOpen, lab, targetState, onClose, onSuccess }) {
    const { t } = useLanguage();
    const modalRef = useFocusTrap(isOpen, onClose);
    const [preview, setPreview] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [reason, setReason] = useState('');
    const [confirmReviewed, setConfirmReviewed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const isPausing = targetState === 'PAUSED';
    const isResuming = targetState === 'ACTIVE';
    const isRetiring = targetState === 'RETIRED';

    useEffect(() => {
        if (isOpen && lab && targetState) {
            setReason('');
            setConfirmReviewed(false);
            setError(null);
            fetchPreview();
        }
    }, [isOpen, lab, targetState]);

    const fetchPreview = async () => {
        setLoadingPreview(true);
        setError(null);
        try {
            const res = await axios.post(`/api/labs/${lab.id}/lifecycle-preview`, { targetState });
            setPreview(res.data?.preview || res.data);
        } catch (err) {
            console.error('Failed to get lifecycle preview:', err);
            const msg = err.response?.data?.message || err.response?.data?.error || err.message;
            setError(msg || 'Failed to evaluate lifecycle transition');
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleConfirm = async () => {
        if (!reason.trim() || !confirmReviewed) return;
        setSubmitting(true);
        setError(null);

        try {
            await axios.post(`/api/labs/${lab.id}/lifecycle`, {
                targetState,
                reason: reason.trim(),
                reviewToken: preview?.reviewToken
            });

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to execute lifecycle transition:', err);
            const msg = err.response?.data?.message || err.response?.data?.error || err.message;
            setError(msg || 'Failed to update laboratory state');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen || !lab) return null;

    const title = isPausing ? 'Review Pausing Laboratory' : isResuming ? 'Resume Laboratory Operations' : 'Retire Laboratory';

    return (
        <div className="fixed inset-0 !m-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-200">
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="lab-lifecycle-title"
                className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-2xl border border-sf-divider max-h-[calc(100dvh-1rem)] max-h-[calc(100vh-1rem)] sm:max-h-[92vh] flex flex-col min-h-0 overflow-hidden"
            >
                <div className="p-4 sm:p-6 border-b border-sf-divider flex items-center justify-between shrink-0">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-sf-muted">
                            {t('lifecycle.title', 'Laboratory Operational Lifecycle')}
                        </div>
                        <h2 id="lab-lifecycle-title" className="text-lg sm:text-xl font-black text-sf-text">{title}</h2>
                    </div>
                    <button onClick={onClose} aria-label={t('common.close', 'Close')} className="p-2 hover:bg-sf-raised rounded-xl transition text-sf-muted hover:text-sf-text">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1 custom-scrollbar min-h-0">
                    {error && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                            <AlertTriangle size={15} className="shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="p-4 bg-sf-canvas border border-sf-divider rounded-xl">
                        <div className="text-sm font-bold text-sf-text">{lab.name}</div>
                        <div className="text-xs text-sf-muted font-mono">{lab.code} · {lab.country}</div>
                    </div>

                    {/* Two-Column Comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-sf-canvas border border-sf-divider space-y-2">
                            <div className="text-[10px] font-black uppercase tracking-widest text-sf-muted">
                                {isPausing ? 'What Pauses' : isResuming ? 'What Resumes' : 'What Retires'}
                            </div>
                            <ul className="text-xs text-sf-muted space-y-1.5 list-disc list-inside">
                                {isPausing ? (
                                    <>
                                        <li>New sample intake and assignments held</li>
                                        <li>Result entry and operational writes paused</li>
                                        <li>Integrations follow paused policy</li>
                                    </>
                                ) : isResuming ? (
                                    <>
                                        <li>Active authorized staff can resume bench work</li>
                                        <li>Normal intake and verification restored</li>
                                        <li>Workflow readiness policies re-engaged</li>
                                    </>
                                ) : (
                                    <>
                                        <li>Laboratory placed in permanent read-only archive</li>
                                        <li>All remaining active assignments must be resolved</li>
                                    </>
                                )}
                            </ul>
                        </div>

                        <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2">
                            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                                What Stays Preserved
                            </div>
                            <ul className="text-xs text-emerald-800/90 dark:text-emerald-300 space-y-1.5 list-disc list-inside">
                                <li>All samples, raw evidence and signed reports</li>
                                <li><strong>Staff accounts untouched</strong> (Anti-cascade safety)</li>
                                <li>Historical attempts and original authors</li>
                                <li>Quarantined drafts remain recoverable</li>
                            </ul>
                        </div>
                    </div>

                    {/* Anti-Cascade Banner */}
                    <div className="p-3.5 bg-sf-raised/50 rounded-xl border border-sf-divider text-xs text-sf-muted flex items-start gap-2.5">
                        <Shield size={16} className="text-sf-primary shrink-0 mt-0.5" />
                        <div>
                            <strong className="text-sf-text font-bold block mb-0.5">Anti-Cascade Safety Active</strong>
                            {isPausing
                                ? 'Pausing this lab does not deactivate staff user accounts. Team members retain their credentials and can inspect historical records.'
                                : isResuming
                                    ? 'Resuming this lab restores facility access. Any staff accounts that were individually disabled will remain disabled.'
                                    : 'Retirement preserves historical chain of custody. Zero sample loss invariant is enforced.'}
                        </div>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                            Lifecycle Change Reason <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                            rows={2}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Scheduled facility renovation / Annual recalibration shutdown"
                            required
                            className="w-full p-3 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none transition resize-none"
                        />
                    </div>

                    {/* Confirmation Checkbox */}
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={confirmReviewed}
                            onChange={(e) => setConfirmReviewed(e.target.checked)}
                            className="mt-1 w-4 h-4 rounded text-sf-primary border-sf-divider focus:ring-sf-primary"
                        />
                        <span className="text-xs text-sf-muted font-medium">
                            I have reviewed the operational impact, anti-cascade protections, and administrator recovery route.
                        </span>
                    </label>
                </div>

                <div className="p-3 sm:p-4 sm:px-6 border-t border-sf-divider bg-sf-canvas/50 flex items-center justify-between shrink-0">
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
                        onClick={handleConfirm}
                        disabled={submitting || !reason.trim() || !confirmReviewed}
                        className={`px-6 py-2.5 rounded-xl text-xs font-bold text-white transition shadow-md disabled:opacity-50 ${
                            isPausing ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' : isRetiring ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                        }`}
                    >
                        {submitting ? 'Executing...' : isPausing ? 'Pause Laboratory' : isResuming ? 'Resume Laboratory' : 'Retire Laboratory'}
                    </button>
                </div>
            </div>
        </div>
    );
}
