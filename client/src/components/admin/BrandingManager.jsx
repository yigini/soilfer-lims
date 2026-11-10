import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Save, Upload, Globe, Palette, Clock, Mail, Layout, Type, Image as ImageIcon, Eye } from 'lucide-react';
import { useDialog } from '../../context/DialogContext';
import { useLanguage } from '../../context/LanguageContext';

const BrandingManager = () => {
    const { t } = useLanguage();
    const { showDialog } = useDialog();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);
    const [languages, setLanguages] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        title: 'SoilFER LIMS',
        colors: { primary: '#047857', secondary: '#111827', accent: '#D97706' },
        logoUrl: '/assets/img/logo-light.png', // Default
        tagline: 'Global & Local Laboratory Information Management System',
        organization: 'FAO Global Soil Partnership / SoilFER Programme',
        contactEmail: '',
        defaultLanguage: 'en',
        dateFormat: 'YYYY-MM-DD',
        footerText: 'SoilFER-LIMS · Aligned with FAO Global Soil Partnership & GLOSOLAN',
        cesiumToken: ''
    });

    useEffect(() => {
        fetchSettings();
        fetchLanguages();
    }, []);

    const fetchLanguages = async () => {
        try {
            const res = await axios.get('/api/admin/languages');
            const langs = res.data?.data || res.data;
            setLanguages(Array.isArray(langs) ? langs : []);
        } catch (e) {
            console.error('Failed to fetch languages:', e);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await axios.get('/api/admin/settings');
            const settings = res.data?.data || res.data;
            if (settings.branding) {
                setFormData(prev => ({
                    ...prev,
                    ...settings.branding,
                    // Ensure colors object exists
                    colors: settings.branding.colors || prev.colors
                }));
            }
            setIsLoading(false);
        } catch (e) {
            console.error(e);
            setIsLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleColorChange = (key, value) => {
        setFormData(prev => ({
            ...prev,
            colors: { ...prev.colors, [key]: value }
        }));
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                showDialog({
                    title: t('adminDetails.fileTooLarge'),
                    message: t('adminDetails.imageSize'),
                    type: 'error'
                });
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, logoUrl: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveLogo = () => {
        setFormData(prev => ({ ...prev, logoUrl: '' }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await axios.put('/api/admin/settings/branding', {
                ...formData
            });
            showDialog({
                title: t('adminDetails.brandingSaved'),
                message: t('adminDetails.brandingSavedHelp'),
                type: 'success'
            });
        } catch (e) {
            showDialog({
                title: t('common.error'),
                message: e.response?.data?.details || e.response?.data?.error || e.message || t('adminDetails.brandingSaveFailed'),
                type: 'error'
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="p-12 text-center text-gray-500">{t('adminDetails.loadingSettings')}</div>;
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-sf-text flex items-center gap-2">
                        <Palette className="text-blue-600" size={28} />
                        {t('adminLanguageSettings.branding')}
                    </h2>
                    <p className="text-sf-muted mt-1">
                        {t('adminLanguageSettings.brandingDescription')}
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-lg shadow-blue-600/20 active:scale-95 transition-all disabled:opacity-50"
                >
                    {isSaving ? <span className="animate-spin">⌛</span> : <Save size={18} />}
                    {t('common.save')}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Settings */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Visual Identity Section */}
                    <div className="card-base bg-sf-surface rounded-xl shadow-sm border border-sf-divider overflow-hidden">
                        <div className="p-6 border-b border-sf-divider bg-sf-canvas">
                            <h3 className="text-lg font-semibold text-sf-text flex items-center gap-2">
                                <Layout size={20} className="text-gray-500" />
                                {t('adminLanguageSettings.visualIdentity')}
                            </h3>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Logo */}
                            <div className="flex items-start gap-6">
                                <div
                                    className="w-32 h-32 rounded-2xl bg-sf-raised flex items-center justify-center border-2 border-dashed border-sf-divider group hover:border-blue-500 transition-colors cursor-pointer relative overflow-hidden"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {formData.logoUrl ? (
                                        <img
                                            src={formData.logoUrl}
                                            alt={t('adminDetails.logo')}
                                            className="w-20 h-20 object-contain group-hover:opacity-100 transition-opacity"
                                            onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.classList.add('error-image'); }}
                                        />
                                    ) : (
                                        <ImageIcon className="text-gray-400" size={32} />
                                    )}

                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Upload className="text-white" size={24} />
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        accept="image/png, image/jpeg, image/svg+xml"
                                        className="hidden"
                                    />
                                </div>
                                <div className="flex-1 space-y-3">
                                    <label className="block text-sm font-medium text-sf-muted">{t('adminDetails.labLogo')}</label>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-4 py-2 bg-white dark:bg-gray-700 border border-sf-divider rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            {t('adminDetails.uploadNew')}
                                        </button>
                                        <button
                                            onClick={handleRemoveLogo}
                                            className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            {t('adminDetails.remove')}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        {t('adminDetails.logoDimensions')} <br />
                                        {t('adminDetails.logoFormats')}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-sf-divider">
                                <div>
                                    <label className="block text-sm font-medium text-sf-muted mb-2">{t('adminDetails.primaryColor')}</label>
                                    <div className="flex items-center gap-2 p-1.5 border border-sf-divider rounded-lg bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-blue-500">
                                        <input
                                            type="color"
                                            value={formData.colors.primary}
                                            onChange={(e) => handleColorChange('primary', e.target.value)}
                                            className="w-8 h-8 rounded cursor-pointer border-none bg-transparent p-0"
                                        />
                                        <input
                                            type="text"
                                            value={formData.colors.primary}
                                            onChange={(e) => handleColorChange('primary', e.target.value)}
                                            className="flex-1 bg-transparent border-none text-sm font-mono uppercase focus:ring-0"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-sf-muted mb-2">{t('adminDetails.secondaryColor')}</label>
                                    <div className="flex items-center gap-2 p-1.5 border border-sf-divider rounded-lg bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-blue-500">
                                        <input
                                            type="color"
                                            value={formData.colors.secondary}
                                            onChange={(e) => handleColorChange('secondary', e.target.value)}
                                            className="w-8 h-8 rounded cursor-pointer border-none bg-transparent p-0"
                                        />
                                        <input
                                            type="text"
                                            value={formData.colors.secondary}
                                            onChange={(e) => handleColorChange('secondary', e.target.value)}
                                            className="flex-1 bg-transparent border-none text-sm font-mono uppercase focus:ring-0"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-sf-canvas border border-sf-divider rounded-xl text-xs text-sf-muted leading-relaxed">
                                <span className="font-bold text-sf-text">{t('adminDetails.note')}</span> {t('adminDetails.colorNote')} <strong>{t('adminDetails.appearanceTheme')}</strong> {t('adminDetails.colorNoteTab')}
                            </div>
                        </div>
                    </div>

                    {/* Lab Info Section */}
                    <div className="card-base bg-sf-surface rounded-xl shadow-sm border border-sf-divider overflow-hidden">
                        <div className="p-6 border-b border-sf-divider bg-sf-canvas">
                            <h3 className="text-lg font-semibold text-sf-text flex items-center gap-2">
                                <Type size={20} className="text-gray-500" />
                                {t('adminDetails.organizationDetails')}
                            </h3>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-sf-muted">{t('adminDetails.brandingLabName')}</label>
                                    <input
                                        type="text"
                                        className="w-full h-10 px-3 rounded-lg border border-sf-divider bg-sf-surface text-sf-text focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        placeholder={t('adminDetails.labTitleExample')}
                                        value={formData.title}
                                        onChange={(e) => handleChange('title', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-sf-muted">{t('adminDetails.legalName')}</label>
                                    <input
                                        type="text"
                                        className="w-full h-10 px-3 rounded-lg border border-sf-divider bg-sf-surface text-sf-text focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        placeholder={t('adminDetails.legalNameExample')}
                                        value={formData.organization}
                                        onChange={(e) => handleChange('organization', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-sf-muted">{t('adminDetails.tagline')}</label>
                                <input
                                    type="text"
                                    className="w-full h-10 px-3 rounded-lg border border-sf-divider bg-sf-surface text-sf-text focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder={t('adminDetails.taglineExample')}
                                    value={formData.tagline}
                                    onChange={(e) => handleChange('tagline', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-sf-muted">{t('adminDetails.contactEmail')}</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="email"
                                        className="w-full h-10 pl-9 pr-3 rounded-lg border border-sf-divider bg-sf-surface text-sf-text focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        placeholder="support@lab.com"
                                        value={formData.contactEmail}
                                        onChange={(e) => handleChange('contactEmail', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-sf-muted">{t('adminDetails.footer')}</label>
                                <textarea
                                    rows="2"
                                    className="w-full p-3 rounded-lg border border-sf-divider bg-sf-surface text-sf-text focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                    placeholder={t('adminDetails.footerExample')}
                                    value={formData.footerText}
                                    onChange={(e) => handleChange('footerText', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Regional Settings */}
                    <div className="card-base bg-sf-surface rounded-xl shadow-sm border border-sf-divider overflow-hidden">
                        <div className="p-6 border-b border-sf-divider bg-sf-canvas">
                            <h3 className="text-lg font-semibold text-sf-text flex items-center gap-2">
                                <Globe size={20} className="text-gray-500" />
                                {t('adminDetails.localization')}
                            </h3>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-sf-muted">{t('adminDetails.defaultLanguage')}</label>
                                    <select
                                        className="w-full h-10 px-3 rounded-lg border border-sf-divider bg-sf-surface text-sf-text focus:ring-2 focus:ring-blue-500"
                                        value={formData.defaultLanguage}
                                        onChange={(e) => handleChange('defaultLanguage', e.target.value)}
                                    >
                                        {languages && languages.length > 0 ? (
                                            languages.map(lang => (
                                                <option key={lang.code} value={lang.code}>{lang.name}</option>
                                            ))
                                        ) : (
                                            <option value="" disabled>{t('adminDetails.noLanguages')}</option>
                                        )}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-sf-muted">{t('adminDetails.dateFormat')}</label>
                                    <select
                                        className="w-full h-10 px-3 rounded-lg border border-sf-divider bg-sf-surface text-sf-text focus:ring-2 focus:ring-blue-500"
                                        value={formData.dateFormat}
                                        onChange={(e) => handleChange('dateFormat', e.target.value)}
                                    >
                                        <option value="YYYY-MM-DD">{t('adminDetails.isoDate')}</option>
                                        <option value="DD/MM/YYYY">{t('adminDetails.dateEuropean')}</option>
                                        <option value="MM/DD/YYYY">{t('adminDetails.dateUS')}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg flex gap-3">
                                <Clock className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={18} />
                                <div>
                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-300">{t('adminDetails.autoTimezone')}</p>
                                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                                        {t('adminDetails.autoTimezoneHelp')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Integrations */}
                    <div className="card-base bg-sf-surface rounded-xl shadow-sm border border-sf-divider overflow-hidden">
                        <div className="p-6 border-b border-sf-divider bg-sf-canvas">
                            <h3 className="text-lg font-semibold text-sf-text flex items-center gap-2">
                                <Globe size={20} className="text-gray-500" />
                                {t('adminDetails.integrations')}
                            </h3>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-sf-muted">{t('adminDetails.cesiumAccess')}</label>
                                <p className="text-xs text-sf-muted mb-1">
                                    {t('adminDetails.cesiumAccessHelp')} <a href="https://ion.cesium.com/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ion.cesium.com/tokens</a>
                                </p>
                                <input
                                    type="text"
                                    className="w-full h-10 px-3 rounded-lg border border-sf-divider bg-sf-surface text-sf-text focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-xs"
                                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                    value={formData.cesiumToken || ''}
                                    onChange={(e) => handleChange('cesiumToken', e.target.value)}
                                />
                            </div>

                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg flex gap-3">
                                <Globe className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={18} />
                                <div>
                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-300">{t('adminDetails.globeViewer')}</p>
                                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                                        {t('adminDetails.globeHelp')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Preview */}
                <div className="lg:col-span-1">
                    <div className="sticky top-6">
                        <h4 className="text-sm font-bold text-sf-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Eye size={16} /> {t('adminDetails.livePreview')}
                        </h4>

                        <div className="bg-sf-surface rounded-xl shadow-lg border border-sf-divider overflow-hidden transform transition-all duration-300">
                            {/* Mock Header */}
                            <div className="h-16 flex items-center px-4 border-b border-sf-divider"
                                style={{ borderTop: `4px solid ${formData.colors.primary}` }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                                        {formData.logoUrl ? (
                                            <img src={formData.logoUrl} alt={t('adminDetails.logo')} className="w-6 h-6 object-contain" />
                                        ) : (
                                            <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                                        )}
                                    </div>
                                    <span className="font-bold text-sf-text truncate max-w-[150px]">
                                        {formData.title || 'LIMS'}
                                    </span>
                                </div>
                                <div className="ml-auto flex gap-2">
                                    <div className="w-8 h-8 rounded-full bg-sf-raised"></div>
                                    <div className="w-8 h-8 rounded-full bg-sf-raised"></div>
                                </div>
                            </div>

                            {/* Mock Sidebar & Content Layout */}
                            <div className="flex h-64">
                                {/* Mock Sidebar */}
                                <div className="w-16 bg-sf-canvas border-r border-sf-divider flex flex-col items-center py-4 gap-4">
                                    <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: formData.colors.primary }}></div>
                                    <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                                    <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                                </div>

                                {/* Mock Main Content */}
                                <div className="flex-1 p-4 bg-gray-50/50 dark:bg-black/20">
                                    <h1 className="text-xl font-bold text-sf-text mb-2">{t('adminDetails.dashboard')}</h1>
                                    <div className="p-4 bg-sf-surface rounded-lg shadow-sm border border-sf-divider mb-4">
                                        <p className="text-sm text-gray-500 mb-1">{t('adminDetails.welcomeBack')}</p>
                                        <p className="font-medium text-sf-text">{formData.organization || t('adminDetails.organizationPreview')}</p>
                                    </div>

                                    <button className="px-4 py-2 rounded text-white text-sm font-medium w-full" style={{ backgroundColor: formData.colors.primary }}>
                                        {t('adminDetails.primaryButton')}
                                    </button>
                                    <button className="mt-2 px-4 py-2 rounded text-white text-sm font-medium w-full" style={{ backgroundColor: formData.colors.secondary }}>
                                        {t('adminDetails.secondaryButton')}
                                    </button>
                                </div>
                            </div>

                            {/* Mock Footer */}
                            <div className="py-2 px-4 bg-gray-100 dark:bg-gray-950 border-t border-sf-divider text-[10px] text-center text-gray-500">
                                {formData.footerText || '© 2026 LIMS'}
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-xs text-blue-800 dark:text-blue-300">
                                <strong>{t('adminDetails.tip')}</strong> {t('adminDetails.contrastHelp')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrandingManager;
