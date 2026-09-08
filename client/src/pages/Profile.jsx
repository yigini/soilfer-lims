import React, { useState, useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { useDialog } from '../context/DialogContext';
import { User, Lock, Bell, Mail, Shield, MapPin, Building2, Calendar, Sun } from 'lucide-react';
import axios from 'axios';
import MessagingCenter from '../components/messaging/MessagingCenter';

const Profile = () => {
    const { user, logout, updateUserPreferences } = useAuth();
    const { savedAppearance, setSavedAppearance } = useTheme();
    const { t } = useLanguage();
    const { showDialog } = useDialog();
    const [searchParams] = useSearchParams();

    // Initialize tab from URL or default to 'overview'
    const initialTab = searchParams.get('tab') || 'overview';
    const [activeTab, setActiveTab] = useState(initialTab);

    // Appearance State
    const [selectedPref, setSelectedPref] = useState(user?.themePreference || savedAppearance || 'light');
    const [savingPref, setSavingPref] = useState(false);
    const [appearanceStatus, setAppearanceStatus] = useState({ type: null, text: '' });

    useEffect(() => {
        if (user?.themePreference) {
            setSelectedPref(user.themePreference);
        } else if (savedAppearance) {
            setSelectedPref(savedAppearance);
        }
    }, [user?.themePreference, savedAppearance]);

    const handleSaveAppearance = async () => {
        setSavingPref(true);
        setAppearanceStatus({ type: null, text: '' });
        try {
            const res = await axios.patch('/api/auth/preferences', {
                themePreference: selectedPref
            });
            const newPref = res.data?.data?.themePreference || selectedPref;
            if (updateUserPreferences) {
                updateUserPreferences(newPref);
            }
            setSavedAppearance(newPref);
            setAppearanceStatus({
                type: 'success',
                text: t('appearance.savedSuccess', 'Appearance saved to your profile.')
            });
        } catch (err) {
            console.error('Failed to save appearance preference:', err);
            setAppearanceStatus({
                type: 'error',
                text: t('appearance.savedError', 'Could not save. Your saved appearance is unchanged.')
            });
        } finally {
            setSavingPref(false);
        }
    };

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    // Password Change State
    const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
    const [loading, setLoading] = useState(false);

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (passData.new.length < 8) {
            showDialog({ title: 'Error', message: 'New password must be at least 8 characters long.', type: 'error' });
            return;
        }
        if (passData.new !== passData.confirm) {
            showDialog({ title: 'Error', message: 'New passwords do not match.', type: 'error' });
            return;
        }

        setLoading(true);
        try {
            await axios.post('/api/auth/change-password', {
                currentPassword: passData.current,
                newPassword: passData.new
            });
            showDialog({
                title: 'Success',
                message: 'Password updated successfully. Please log in again.',
                type: 'success',
                confirmText: 'Log In',
                onConfirm: logout
            });
        } catch (err) {
            showDialog({
                title: 'Error',
                message: err.response?.data?.error || 'Failed to update password',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header Card */}
            <div className="card-base p-8 rounded-2xl shadow-sm border dark:border-gray-700 flex flex-col md:flex-row items-center gap-6">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl font-bold text-white shadow-lg">
                    {user.name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 text-center md:text-left space-y-2">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{user.name}</h1>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full font-medium">
                            <Shield size={14} /> {user.role?.replace(/_/g, ' ')}
                        </span>
                        {user.labId && (
                            <span className="flex items-center gap-1">
                                <Building2 size={14} /> {user.labId}
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            <Mail size={14} /> {user.email || user.username}
                        </span>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors ${activeTab === 'overview'
                        ? 'border-blue-600 text-blue-600 font-medium'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                >
                    <User size={18} /> Overview
                </button>
                <button
                    onClick={() => setActiveTab('security')}
                    className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors ${activeTab === 'security'
                        ? 'border-blue-600 text-blue-600 font-medium'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                >
                    <Lock size={18} /> Security
                </button>
                <button
                    onClick={() => setActiveTab('messaging')}
                    className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors ${activeTab === 'messaging'
                        ? 'border-sf-primary text-sf-primary font-medium'
                        : 'border-transparent text-sf-muted hover:text-sf-text'
                        }`}
                >
                    <Mail size={18} /> Messaging Center
                </button>
                <button
                    onClick={() => setActiveTab('appearance')}
                    className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors ${activeTab === 'appearance'
                        ? 'border-sf-primary text-sf-primary font-medium'
                        : 'border-transparent text-sf-muted hover:text-sf-text'
                        }`}
                >
                    <Sun size={18} /> {t('appearance.title', 'Appearance')}
                </button>
            </div>

            {/* Content Area */}
            {activeTab === 'messaging' ? (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <MessagingCenter initialMessageId={searchParams.get('id')} />
                </div>
            ) : (
                <div className="card-base p-8 rounded-2xl shadow-sm border dark:border-gray-700 min-h-[400px]">

                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">Account Details</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Username</span>
                                            <span className="font-medium text-gray-900 dark:text-gray-200">{user.username}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Full Name</span>
                                            <span className="font-medium text-gray-900 dark:text-gray-200">{user.name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Email Address</span>
                                            <span className="font-medium text-gray-900 dark:text-gray-200">{user.email}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Member Since</span>
                                            <span className="font-medium text-gray-900 dark:text-gray-200 flex items-center gap-1">
                                                <Calendar size={14} /> {new Date(user.createdAt || Date.now()).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2">Access Scope</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-gray-500 block mb-1">Assigned Laboratory</span>
                                            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700">
                                                <Building2 className="text-gray-400" size={18} />
                                                <span className="font-medium">{user.labId || 'Global Access'}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 block mb-1">Country Access</span>
                                            <div className="flex flex-wrap gap-2">
                                                {user.countries && user.countries.length > 0 ? (
                                                    user.countries.map(c => (
                                                        <span key={c} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-sm font-medium">
                                                            {c}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-gray-400 italic">No specific country restrictions</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SECURITY TAB */}
                    {activeTab === 'security' && (
                        <div className="max-w-md animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Change Password</h3>
                            <form onSubmit={handlePasswordChange} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Password</label>
                                    <input
                                        type="password"
                                        value={passData.current}
                                        onChange={e => setPassData({ ...passData, current: e.target.value })}
                                        className="input-base w-full p-3 rounded-lg border dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                                    <input
                                        type="password"
                                        value={passData.new}
                                        onChange={e => setPassData({ ...passData, new: e.target.value })}
                                        className="input-base w-full p-3 rounded-lg border dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
                                        placeholder="Min. 8 characters"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
                                    <input
                                        type="password"
                                        value={passData.confirm}
                                        onChange={e => setPassData({ ...passData, confirm: e.target.value })}
                                        className="input-base w-full p-3 rounded-lg border dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className={`px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-sm
                                            ${loading ? 'opacity-70 cursor-not-allowed' : ''}
                                        `}
                                    >
                                        {loading ? 'Updating...' : 'Update Password'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* APPEARANCE TAB */}
                    {activeTab === 'appearance' && (
                        <div className="space-y-6 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div>
                                <h3 className="text-lg font-bold text-sf-text mb-1">
                                    {t('appearance.profileHeading', 'Account appearance preference')}
                                </h3>
                                <p className="text-sm text-sf-muted">
                                    {t('appearance.profileDescription', 'Use this appearance whenever you sign in, on any device. You can still switch for one session from the header.')}
                                </p>
                            </div>

                            {appearanceStatus.text && (
                                <div
                                    role="status"
                                    className={`p-3.5 rounded-xl text-sm font-medium border ${
                                        appearanceStatus.type === 'success'
                                            ? 'bg-sf-success-bg text-sf-success border-sf-success/30'
                                            : 'bg-sf-danger-bg text-sf-danger border-sf-danger/30'
                                    }`}
                                >
                                    {appearanceStatus.text}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Light Option Card */}
                                <label
                                    className={`relative flex flex-col gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                        selectedPref === 'light'
                                            ? 'border-sf-primary bg-sf-selected/40 shadow-sm'
                                            : 'border-sf-divider bg-sf-surface hover:border-sf-control'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="appearance-preference"
                                                value="light"
                                                checked={selectedPref === 'light'}
                                                onChange={() => {
                                                    setSelectedPref('light');
                                                    setAppearanceStatus({ type: null, text: '' });
                                                }}
                                                className="accent-sf-primary w-4 h-4"
                                            />
                                            <span className="font-semibold text-sf-text text-sm">
                                                {t('appearance.light', 'Light')}
                                            </span>
                                        </div>
                                        {savedAppearance === 'light' && (
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sf-hover text-sf-muted">
                                                {t('appearance.defaultLabel', 'Default')}
                                            </span>
                                        )}
                                    </div>

                                    {/* Miniature Preview Light */}
                                    <div className="h-28 rounded-lg border border-[#D6DFDA] overflow-hidden grid grid-cols-4 bg-[#F4F6F5] select-none pointer-events-none">
                                        <div className="bg-[#FFFFFF] border-r border-[#D6DFDA] p-2 space-y-1.5">
                                            <div className="h-2 w-full bg-[#D6DFDA] rounded-sm" />
                                            <div className="h-2 w-3/4 bg-[#EAF0EC] rounded-sm" />
                                            <div className="h-2 w-2/3 bg-[#EAF0EC] rounded-sm" />
                                        </div>
                                        <div className="col-span-3 p-2.5 space-y-2">
                                            <div className="h-2.5 w-1/2 bg-[#276B51] rounded-sm" />
                                            <div className="h-12 bg-[#FFFFFF] border border-[#D6DFDA] rounded p-1.5 space-y-1">
                                                <div className="h-1.5 w-full bg-[#EAF0EC] rounded-sm" />
                                                <div className="h-1.5 w-4/5 bg-[#EAF0EC] rounded-sm" />
                                            </div>
                                        </div>
                                    </div>
                                </label>

                                {/* Dark Option Card */}
                                <label
                                    className={`relative flex flex-col gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                        selectedPref === 'dark'
                                            ? 'border-sf-primary bg-sf-selected/40 shadow-sm'
                                            : 'border-sf-divider bg-sf-surface hover:border-sf-control'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name="appearance-preference"
                                                value="dark"
                                                checked={selectedPref === 'dark'}
                                                onChange={() => {
                                                    setSelectedPref('dark');
                                                    setAppearanceStatus({ type: null, text: '' });
                                                }}
                                                className="accent-sf-primary w-4 h-4"
                                            />
                                            <span className="font-semibold text-sf-text text-sm">
                                                {t('appearance.dark', 'Dark · Graphite')}
                                            </span>
                                        </div>
                                        {savedAppearance === 'dark' && (
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sf-hover text-sf-muted">
                                                {t('appearance.defaultLabel', 'Default')}
                                            </span>
                                        )}
                                    </div>

                                    {/* Miniature Preview Dark */}
                                    <div className="h-28 rounded-lg border border-[#515B61] overflow-hidden grid grid-cols-4 bg-[#25282B] select-none pointer-events-none">
                                        <div className="bg-[#2E3236] border-r border-[#515B61] p-2 space-y-1.5">
                                            <div className="h-2 w-full bg-[#515B61] rounded-sm" />
                                            <div className="h-2 w-3/4 bg-[#3C4247] rounded-sm" />
                                            <div className="h-2 w-2/3 bg-[#3C4247] rounded-sm" />
                                        </div>
                                        <div className="col-span-3 p-2.5 space-y-2">
                                            <div className="h-2.5 w-1/2 bg-[#8ED3B8] rounded-sm" />
                                            <div className="h-12 bg-[#393E43] border border-[#515B61] rounded p-1.5 space-y-1">
                                                <div className="h-1.5 w-full bg-[#515B61] rounded-sm" />
                                                <div className="h-1.5 w-4/5 bg-[#515B61] rounded-sm" />
                                            </div>
                                        </div>
                                    </div>
                                </label>
                            </div>

                            <div className="pt-2 flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={handleSaveAppearance}
                                    disabled={savingPref}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    {savingPref ? (
                                        t('appearance.saving', 'Saving appearance...')
                                    ) : (
                                        t('appearance.saveButton', 'Save appearance')
                                    )}
                                </button>
                                {selectedPref !== savedAppearance && (
                                    <span className="text-xs text-sf-muted">
                                        Unsaved selection: {selectedPref === 'dark' ? 'Dark' : 'Light'}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Profile;
