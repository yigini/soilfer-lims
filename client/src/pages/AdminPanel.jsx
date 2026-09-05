import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Globe, Palette, Users, FlaskConical, ShieldCheck, Key } from 'lucide-react';
import AnalysisConfig from '../components/AnalysisConfig';
import AuditLogs from './AuditLogs';
import UsersComponent from './Users';
import BrandingManager from '../components/admin/BrandingManager';
import ApiKeyManager from '../components/admin/ApiKeyManager';
import TranslationEditor from '../components/TranslationEditor';
import { useLanguage } from '../context/LanguageContext';
import { useDialog } from '../context/DialogContext';
import { useAuth } from '../context/AuthContext';

const AdminPanel = () => {
    const { t } = useLanguage();
    const { showDialog } = useDialog();
    const { user, hasPermission } = useAuth();

    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    const isMasterUser = user?.role === 'MASTER_USER';
    const isLabManager = user?.role === 'LAB_MANAGER';

    const canManageBranding = isSuperAdmin || isMasterUser || isLabManager || hasPermission('MANAGE_BRANDING');
    const canManageAnalyses = isSuperAdmin || isMasterUser || isLabManager || hasPermission('MANAGE_ANALYSES');
    const canViewAudit = isSuperAdmin || isMasterUser || isLabManager || hasPermission('VIEW_AUDIT');
    const canManageApiKeys = isSuperAdmin || isMasterUser || isLabManager;
    const canManageUsers = isSuperAdmin || isMasterUser || isLabManager || hasPermission('MANAGE_USERS');

    const [activeTab, setActiveTab] = useState(() => {
        if (canManageBranding) return 'branding';
        if (canManageAnalyses) return 'lab-config';
        if (canManageUsers) return 'users';
        if (canViewAudit) return 'audit';
        return 'lab-config';
    });
    const [languages, setLanguages] = useState([]);

    const [labSettings, setLabSettings] = useState(null);

    useEffect(() => {
        if (canManageBranding) {
            fetchLanguages();
        }
        fetchSettings();
    }, [canManageBranding]);

    const fetchSettings = async () => {
        try {
            const res = await axios.get('/api/admin/settings');
            // New contract: data is under res.data.data; fallback for old format
            setLabSettings(res.data.data || res.data);
        } catch (e) {
            console.error('Failed to fetch settings:', e);
        }
    };

    const fetchLanguages = async () => {
        try {
            const res = await axios.get('/api/admin/languages');
            // New contract: data is under res.data.data; fallback for old format
            const langs = res.data.data || res.data;
            setLanguages(Array.isArray(langs) ? langs : []);
        } catch (e) {
            console.error('Failed to fetch languages:', e.message);
        }
    };

    // Language Management State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newLang, setNewLang] = useState({ name: '', code: '' });
    const [editorOpen, setEditorOpen] = useState(false);
    const [activeLang, setActiveLang] = useState(null);

    const handleAddLanguage = async () => {
        try {
            await axios.post('/api/admin/languages', newLang);
            setIsAddModalOpen(false);
            setNewLang({ name: '', code: '' });
            fetchLanguages();
        } catch (e) {
            showDialog({
                title: 'Error',
                message: e.response?.data?.error || 'Failed to add language',
                type: 'error'
            });
        }
    };

    const handleDeleteLanguage = async (code) => {
        showDialog({
            title: 'Delete Language?',
            message: 'Are you sure you want to delete this language? This action cannot be undone.',
            type: 'confirm',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/admin/languages/${code}`);
                    fetchLanguages();
                } catch (e) {
                    showDialog({ title: 'Error', message: 'Failed to delete language', type: 'error' });
                }
            }
        });
    };

    const handleSetDefault = async (code) => {
        try {
            await axios.put(`/api/admin/languages/${code}/default`);
            fetchLanguages();
            fetchSettings();
        } catch (e) {
            const msg = e.response?.data?.details || e.response?.data?.error || 'Failed to set default language';
            showDialog({ title: 'Error', message: msg, type: 'error' });
        }
    };

    const handleSaveTranslations = async (translationsFromEditor) => {
        try {
            await axios.put(`/api/admin/languages/${activeLang.code}`, { translations: translationsFromEditor });
            setEditorOpen(false);
            fetchLanguages();
            showDialog({ title: 'Success', message: 'Translations saved successfully!', type: 'success' });
        } catch (e) {
            showDialog({ title: 'Error', message: 'Failed to save translations', type: 'error' });
        }
    };

    return (
        <div className="flex flex-col h-full font-sans">
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100 mb-5">{t('admin.title', 'Administration Panel')}</h1>

            <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto pb-px">
                {canManageBranding && (
                    <>
                        <button
                            onClick={() => setActiveTab('branding')}
                            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'branding' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                        >
                            <Palette size={17} /> {t('admin.branding', 'Branding & Identity')}
                        </button>
                        <button
                            onClick={() => setActiveTab('languages')}
                            className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'languages' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                        >
                            <Globe size={17} /> {t('admin.languages', 'Languages & Localization')}
                        </button>
                    </>
                )}
                {canManageAnalyses && (
                    <button
                        onClick={() => setActiveTab('lab-config')}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'lab-config' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        <FlaskConical size={17} /> {t('admin.analysis', 'Analysis Configuration')}
                    </button>
                )}
                {canViewAudit && (
                    <button
                        onClick={() => setActiveTab('audit')}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'audit' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        <ShieldCheck size={17} /> Audit & Security
                    </button>
                )}
                {canManageApiKeys && (
                    <button
                        onClick={() => setActiveTab('api-keys')}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'api-keys' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        <Key size={17} /> National SIS & Data Exchange
                    </button>
                )}
                {canManageUsers && (
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs font-bold transition-all whitespace-nowrap ml-auto ${activeTab === 'users' ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                    >
                        <Users size={17} /> Laboratory Staff
                    </button>
                )}
            </div>

            <div className={`flex-1 overflow-y-auto ${activeTab === 'branding' || activeTab === 'lab-config' ? 'p-0' : 'card-base rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6'}`}>

                {activeTab === 'branding' && <BrandingManager />}

                {activeTab === 'languages' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-blue-800 dark:text-blue-300 text-sm flex-1 mr-4">
                                Manage system languages. <strong>Default</strong> language is served to visitors before login.
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                            >
                                + Add Language
                            </button>
                        </div>

                        <table className="w-full text-left border dark:border-gray-700 rounded-lg overflow-hidden">
                            <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                                <tr>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300">Code</th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300">Name</th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300">Status</th>
                                    <th className="p-3 font-semibold text-gray-600 dark:text-gray-300 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {languages.map(l => (
                                    <tr key={l.code} className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="p-3 font-mono text-sm">{l.code}</td>
                                        <td className="p-3 font-medium">{l.name}</td>
                                        <td className="p-3">
                                            {(labSettings?.branding?.defaultLanguage ? labSettings.branding.defaultLanguage === l.code : l.isDefault) ? (
                                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full border border-green-200">Default</span>
                                            ) : (
                                                <button
                                                    onClick={() => handleSetDefault(l.code)}
                                                    className="text-gray-400 hover:text-blue-600 text-xs border border-gray-300 px-2 py-1 rounded hover:border-blue-500"
                                                >
                                                    Set Default
                                                </button>
                                            )}
                                        </td>
                                        <td className="p-3 text-right space-x-3">
                                            <button
                                                onClick={() => { setActiveLang(l); setEditorOpen(true); }}
                                                className="text-blue-600 hover:underline text-sm font-medium"
                                            >
                                                Edit Translations
                                            </button>
                                            {!l.isDefault && (
                                                <button
                                                    onClick={() => handleDeleteLanguage(l.code)}
                                                    className="text-red-500 hover:text-red-700 text-sm"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Add Modal */}
                        {isAddModalOpen && (
                            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                                <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
                                    <h3 className="text-lg font-bold mb-4">Add New Language</h3>
                                    <div className="space-y-3">
                                        <input
                                            placeholder="Name (e.g. German)"
                                            className="w-full p-2 border rounded"
                                            value={newLang.name}
                                            onChange={e => setNewLang({ ...newLang, name: e.target.value })}
                                        />
                                        <input
                                            placeholder="ISO Code (e.g. de)"
                                            className="w-full p-2 border rounded"
                                            value={newLang.code}
                                            onChange={e => setNewLang({ ...newLang, code: e.target.value })}
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2 mt-4">
                                        <button onClick={() => setIsAddModalOpen(false)} className="px-3 py-1 text-gray-500">Cancel</button>
                                        <button onClick={handleAddLanguage} className="px-3 py-1 bg-blue-600 text-white rounded">Add</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Translation Editor Modal */}
                        {editorOpen && activeLang && (
                            <TranslationEditor
                                language={activeLang}
                                onSave={handleSaveTranslations}
                                onClose={() => setEditorOpen(false)}
                            />
                        )}
                    </div>
                )}


                {activeTab === 'lab-config' && <AnalysisConfig />}
                {activeTab === 'audit' && (
                    <div className="-m-8">
                        <AuditLogs />
                    </div>
                )}
                {activeTab === 'api-keys' && <ApiKeyManager />}
                {activeTab === 'users' && (
                    <div className="-m-8 p-8">
                        <UsersComponent />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPanel;
