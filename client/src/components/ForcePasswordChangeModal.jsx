
import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';
import { useDialog } from '../context/DialogContext';

const ForcePasswordChangeModal = () => {
    const { user, logout } = useAuth();
    const { showDialog } = useDialog();

    // Safety check - if no user or no flag, don't render (though parent should handle strict conditional)
    if (!user || !user.mustChangePassword) return null;

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 8) {
            setError('New password must be at least 8 characters long');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await axios.post('/api/auth/change-password', {
                currentPassword,
                newPassword
            });

            showDialog({
                title: 'Password Changed',
                message: 'Your password has been updated successfully. Please log in with your new password.',
                type: 'success',
                confirmText: 'Log In Again',
                onConfirm: () => {
                    logout(); // Force re-login with clean state
                }
            });

        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Failed to change password');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-stone-900/95 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform animate-in zoom-in-95 duration-300 border border-emerald-100 dark:border-emerald-900/30">

                {/* Header */}
                <div className="bg-gradient-to-br from-emerald-800 to-green-950 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                    <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md border border-white/20 shadow-xl">
                        <Lock className="text-white" size={40} />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-2 leading-tight">Security Update Required</h2>
                    <p className="text-emerald-100/80 text-sm font-medium">
                        Your password was reset by an administrator. Please establish a private password to continue.
                    </p>
                </div>

                <div className="p-8">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-xl flex items-start gap-3 shadow-sm">
                            <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={18} />
                            <p className="text-sm text-red-700 dark:text-red-300 font-bold">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">Current Temporary Password</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                className="w-full p-4 bg-stone-50 dark:bg-gray-900 border-2 border-transparent focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl outline-none transition-all font-semibold"
                                placeholder="Enter temp password"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">New Private Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full p-4 bg-stone-50 dark:bg-gray-900 border-2 border-transparent focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl outline-none transition-all font-semibold"
                                placeholder="Min. 8 characters"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400 ml-1">Confirm New Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className="w-full p-4 bg-stone-50 dark:bg-gray-900 border-2 border-transparent focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 rounded-2xl outline-none transition-all font-semibold"
                                placeholder="Repeat new password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-4 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-700/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0
                                ${loading ? 'opacity-75 cursor-not-allowed' : ''}
                            `}
                        >
                            {loading ? 'Securing Account...' : 'Update & Access System'}
                        </button>
                    </form>

                    <button
                        onClick={logout}
                        className="w-full mt-6 py-2 text-sm font-bold text-gray-400 hover:text-emerald-600 transition-colors"
                    >
                        Cancel & Sign Out
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForcePasswordChangeModal;
