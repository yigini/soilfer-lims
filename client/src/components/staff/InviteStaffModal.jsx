import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Mail, User, Shield, CheckCircle2, Copy, AlertTriangle, Clock } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function InviteStaffModal({ isOpen, onClose, onSuccess, defaultLabId, availableLabs = [] }) {
    const { t } = useLanguage();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('LAB_TECHNICIAN');
    const [labId, setLabId] = useState(defaultLabId || '');
    const [assignableRoles, setAssignableRoles] = useState([]);
    const [loadingRoles, setLoadingRoles] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [invitationResult, setInvitationResult] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setName('');
            setEmail('');
            setRole('LAB_TECHNICIAN');
            setLabId(defaultLabId || '');
            setError(null);
            setInvitationResult(null);
            setCopied(false);
            fetchRoles(defaultLabId);
        }
    }, [isOpen, defaultLabId]);

    const fetchRoles = async (targetLab) => {
        setLoadingRoles(true);
        try {
            const url = targetLab ? `/api/access/assignable-roles?labId=${encodeURIComponent(targetLab)}` : '/api/access/assignable-roles';
            const res = await axios.get(url);
            if (res.data?.assignableRoles) {
                setAssignableRoles(res.data.assignableRoles);
                if (res.data.assignableRoles.length > 0) {
                    const hasTech = res.data.assignableRoles.some(r => r.role === 'LAB_TECHNICIAN');
                    setRole(hasTech ? 'LAB_TECHNICIAN' : res.data.assignableRoles[0].role);
                }
            }
        } catch (err) {
            setAssignableRoles([
                { role: 'LAB_TECHNICIAN', displayName: 'Laboratory Technician', description: 'Record assigned work through workbench' },
                { role: 'SAMPLE_RECEPTION', displayName: 'Intake Officer', description: 'Intake and sample registration' },
                { role: 'AUDIT_USER', displayName: 'Quality & Audit Officer', description: 'Read-only QA and compliance review' },
                { role: 'VIEWER', displayName: 'Viewer', description: 'Read-only directory access' }
            ]);
        } finally {
            setLoadingRoles(false);
        }
    };

    const handleLabChange = (newLabId) => {
        setLabId(newLabId);
        fetchRoles(newLabId);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !email.trim()) {
            setError('Full name and work email are required.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const res = await axios.post('/api/staff/invitations', {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                role,
                labId: labId || null
            });

            setInvitationResult(res.data?.invitation || res.data);
            if (onSuccess) onSuccess();
        } catch (err) {
            console.error('Failed to create invitation:', err);
            const msg = err.response?.data?.message || err.response?.data?.error || err.message;
            setError(msg || 'Failed to prepare invitation');
        } finally {
            setSubmitting(false);
        }
    };

    const copyActivationUrl = () => {
        const url = invitationResult?.activationUrl || `${window.location.origin}/activate?token=${invitationResult?.token}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-lg border border-sf-divider overflow-hidden">
                <div className="p-6 border-b border-sf-divider flex items-center justify-between">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                            Named Staff Onboarding
                        </div>
                        <h2 className="text-xl font-black text-sf-text">Invite a Team Member</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-sf-raised rounded-xl transition text-sf-muted hover:text-sf-text">
                        <X size={18} />
                    </button>
                </div>

                {invitationResult ? (
                    <div className="p-6 space-y-5">
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-start gap-3">
                            <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <div className="text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                                <strong className="font-bold block text-sm">Invitation Created</strong>
                                <p>
                                    A single-use, cryptographically verified invitation token was generated for <strong>{name}</strong> ({email}).
                                    No plain-text or shared passwords are ever created.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-sf-muted block">
                                One-Time Activation Link
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    readOnly
                                    value={invitationResult.activationUrl || `${window.location.origin}/activate?token=${invitationResult.token}`}
                                    className="w-full font-mono text-xs p-3 bg-sf-canvas border border-sf-divider rounded-xl text-sf-text truncate"
                                />
                                <button
                                    onClick={copyActivationUrl}
                                    className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shrink-0"
                                >
                                    <Copy size={14} />
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-sf-muted mt-2">
                                <Clock size={13} />
                                <span>Expires in 24 hours. The recipient will set their own password upon activation.</span>
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

                        <div>
                            <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                Full Name <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <User size={16} className="absolute left-3.5 top-3.5 text-sf-muted" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. María González"
                                    required
                                    className="w-full pl-10 pr-3 py-2.5 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none transition"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                Verified Work Email <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3.5 top-3.5 text-sf-muted" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="e.g. mgonzalez@soilfer.org"
                                    required
                                    className="w-full pl-10 pr-3 py-2.5 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none transition"
                                />
                            </div>
                        </div>

                        {availableLabs.length > 1 && (
                            <div>
                                <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    Laboratory Scope
                                </label>
                                <select
                                    value={labId}
                                    onChange={(e) => handleLabChange(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none transition"
                                >
                                    <option value="">No specific laboratory (Global)</option>
                                    {availableLabs.map(l => (
                                        <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                Assigned System Role <span className="text-rose-500">*</span>
                            </label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                                disabled={loadingRoles}
                                className="w-full px-3 py-2.5 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none transition"
                            >
                                {assignableRoles.map(r => (
                                    <option key={r.role} value={r.role}>
                                        {r.displayName || r.role}
                                    </option>
                                ))}
                            </select>
                            <div className="mt-1.5 text-xs text-sf-muted">
                                {assignableRoles.find(r => r.role === role)?.description || 'Role permissions are governed strictly by the server RBAC policy.'}
                            </div>
                        </div>

                        <div className="p-3 bg-sf-raised/50 rounded-xl border border-sf-divider text-[11px] text-sf-muted flex items-start gap-2">
                            <Shield size={15} className="shrink-0 text-sf-primary mt-0.5" />
                            <span>
                                An activation link with a 24-hour expiry will be generated. The invitee will securely configure their personal credentials upon first access.
                            </span>
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
                                disabled={submitting || !name.trim() || !email.trim()}
                                className="px-6 py-2.5 bg-sf-primary text-white rounded-xl text-xs font-bold hover:bg-sf-primary/90 transition shadow-md shadow-sf-primary/20 disabled:opacity-50"
                            >
                                {submitting ? 'Generating...' : 'Prepare Invitation'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
