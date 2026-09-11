import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Shield, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export default function ActivateAccount() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [invitation, setInvitation] = useState(null);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [formError, setFormError] = useState('');

    useEffect(() => {
        if (!token) {
            setError('Missing invitation token in link.');
            setLoading(false);
            return;
        }

        const verifyToken = async () => {
            try {
                const res = await axios.get(`/api/auth/invitation/${encodeURIComponent(token)}`);
                setInvitation(res.data);
                const suggested = res.data.email ? res.data.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') : '';
                setUsername(suggested);
            } catch (err) {
                setError(err.response?.data?.message || 'Invalid or expired invitation token.');
            } finally {
                setLoading(false);
            }
        };

        verifyToken();
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');

        if (!username.trim() || username.length < 3) {
            setFormError('Username must be at least 3 characters long.');
            return;
        }

        if (!password || password.length < 8) {
            setFormError('Password must be at least 8 characters long.');
            return;
        }

        if (password !== confirmPassword) {
            setFormError('Passwords do not match.');
            return;
        }

        setSubmitting(true);
        try {
            await axios.post('/api/auth/activate', {
                token,
                username: username.trim(),
                password
            });
            setSuccess(true);
        } catch (err) {
            setFormError(err.response?.data?.message || 'Failed to activate account. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-sf-canvas p-4">
                <div className="flex flex-col items-center gap-3 text-sf-primary">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-xs font-bold text-sf-muted uppercase tracking-widest">Verifying invitation...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-sf-canvas p-4">
                <div className="max-w-md w-full bg-sf-surface border border-sf-divider rounded-2xl p-6 shadow-xl text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 mx-auto flex items-center justify-center">
                        <AlertCircle size={24} />
                    </div>
                    <h2 className="text-xl font-black text-sf-text">Invalid Invitation</h2>
                    <p className="text-xs text-sf-muted">{error}</p>
                    <div className="pt-2">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sf-primary text-white rounded-xl text-xs font-bold hover:bg-sf-primary/90 transition"
                        >
                            Go to Sign In <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-sf-canvas p-4">
                <div className="max-w-md w-full bg-sf-surface border border-sf-divider rounded-2xl p-6 shadow-xl text-center space-y-4 animate-in fade-in">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 mx-auto flex items-center justify-center">
                        <CheckCircle2 size={24} />
                    </div>
                    <h2 className="text-xl font-black text-sf-text">Account Activated!</h2>
                    <p className="text-xs text-sf-muted">
                        Welcome to SoilFER LIMS, <strong>{invitation?.name}</strong>. Your account has been registered and is now active.
                    </p>
                    <div className="pt-2">
                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sf-primary text-white rounded-xl text-xs font-bold hover:bg-sf-primary/90 transition"
                        >
                            Sign In to Workbench <ArrowRight size={14} />
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-sf-canvas p-4">
            <div className="max-w-md w-full bg-sf-surface border border-sf-divider rounded-2xl p-6 sm:p-8 shadow-xl space-y-6 animate-in fade-in">
                <div className="text-center space-y-2">
                    <div className="inline-flex p-3 rounded-2xl bg-sf-primary/10 text-sf-primary mb-1">
                        <Shield size={28} />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-sf-text">Activate Your Account</h1>
                    <p className="text-xs text-sf-muted">
                        You have been invited to join <strong>{invitation?.labName || 'SoilFER Laboratory'}</strong> as a{' '}
                        <span className="font-semibold text-sf-text">{invitation?.role}</span>.
                    </p>
                </div>

                {formError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                        <AlertCircle size={15} className="shrink-0" />
                        <span>{formError}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                            Full Name
                        </label>
                        <input
                            type="text"
                            value={invitation?.name || ''}
                            disabled
                            className="w-full px-3.5 py-2.5 bg-sf-canvas border border-sf-divider rounded-xl text-xs text-sf-muted cursor-not-allowed"
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={invitation?.email || ''}
                            disabled
                            className="w-full px-3.5 py-2.5 bg-sf-canvas border border-sf-divider rounded-xl text-xs text-sf-muted cursor-not-allowed"
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                            Choose Username <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            minLength={3}
                            placeholder="e.g. marcos_tech"
                            className="w-full px-3.5 py-2.5 bg-sf-canvas border border-sf-divider rounded-xl text-xs text-sf-text focus:ring-2 focus:ring-sf-primary outline-none transition font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                            Set Password <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            placeholder="At least 8 characters"
                            className="w-full px-3.5 py-2.5 bg-sf-canvas border border-sf-divider rounded-xl text-xs text-sf-text focus:ring-2 focus:ring-sf-primary outline-none transition"
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                            Confirm Password <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={8}
                            placeholder="Confirm your password"
                            className="w-full px-3.5 py-2.5 bg-sf-canvas border border-sf-divider rounded-xl text-xs text-sf-text focus:ring-2 focus:ring-sf-primary outline-none transition"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-3 bg-sf-primary hover:bg-sf-primary/90 text-white rounded-xl text-xs font-bold transition shadow-md shadow-sf-primary/20 flex items-center justify-center gap-2 mt-6"
                    >
                        {submitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" /> Activating Account...
                            </>
                        ) : (
                            <>
                                Complete Activation & Sign In <ArrowRight size={15} />
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
