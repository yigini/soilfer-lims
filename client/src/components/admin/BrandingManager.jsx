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

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        colors: { primary: '#3b82f6', secondary: '#1e40af', accent: '#60a5fa' },
        logoUrl: '/assets/img/logo.png', // Default
        tagline: '',
        organization: '',
        contactEmail: '',
        defaultLanguage: 'en',
        dateFormat: 'YYYY-MM-DD',
        footerText: '',
        cesiumToken: ''
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await axios.get('/api/admin/settings');
            if (res.data.branding) {
                setFormData(prev => ({
                    ...prev,
                    ...res.data.branding,
                    // Ensure colors object exists
                    colors: res.data.branding.colors || prev.colors
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
                    title: 'File too large',
                    message: 'Please select an image under 2MB.',
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
                title: 'Branding Updated',
                message: 'Your branding settings have been saved. Refresh the page to see changes.',
                type: 'success'
            });
        } catch (e) {
            showDialog({
                title: 'Error',
                message: 'Failed to save branding settings',
                type: 'error'
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="p-12 text-center text-gray-500">Loading settings...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Palette className="text-blue-600" size={28} />
                        Branding & Identity
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Customize the look and feel of your laboratory information management system.
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
                    <div className="card-base bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Layout size={20} className="text-gray-500" />
                                Visual Identity
                            </h3>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Logo */}
                            <div className="flex items-start gap-6">
                                <div
                                    className="w-32 h-32 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 group hover:border-blue-500 transition-colors cursor-pointer relative overflow-hidden"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {formData.logoUrl ? (
                                        <img
                                            src={formData.logoUrl}
                                            alt="Logo"
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
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Laboratory Logo</label>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                        >
                                            Upload New
                                        </button>
                                        <button
                                            onClick={handleRemoveLogo}
                                            className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        Suggested dimensions: 200x200px. <br />
                                        Supports PNG, SVG, or JPG. Max file size 2MB.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Primary Color</label>
                                    <div className="flex items-center gap-2 p-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-blue-500">
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
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Secondary Color</label>
                                    <div className="flex items-center gap-2 p-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-blue-500">
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
                        </div>
                    </div>

                    {/* Lab Info Section */}
                    <div className="card-base bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Type size={20} className="text-gray-500" />
                                Organization Details
                            </h3>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Lab Name (App Title)</label>
                                    <input
                                        type="text"
                                        className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        placeholder="e.g. SoilFER LIMS"
                                        value={formData.title}
                                        onChange={(e) => handleChange('title', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Organization Legal Name</label>
                                    <input
                                        type="text"
                                        className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        placeholder="e.g. National Soil Institute"
                                        value={formData.organization}
                                        onChange={(e) => handleChange('organization', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tagline / Subtitle</label>
                                <input
                                    type="text"
                                    className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="e.g. Advanced Analysis & Research Platform"
                                    value={formData.tagline}
                                    onChange={(e) => handleChange('tagline', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Contact Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="email"
                                        className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        placeholder="support@lab.com"
                                        value={formData.contactEmail}
                                        onChange={(e) => handleChange('contactEmail', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Footer Text</label>
                                <textarea
                                    rows="2"
                                    className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                    placeholder="© 2026 Your Laboratory. All rights reserved."
                                    value={formData.footerText}
                                    onChange={(e) => handleChange('footerText', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Regional Settings */}
                    <div className="card-base bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Globe size={20} className="text-gray-500" />
                                Localization
                            </h3>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Default Language</label>
                                    <select
                                        className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                        value={formData.defaultLanguage}
                                        onChange={(e) => handleChange('defaultLanguage', e.target.value)}
                                    >
                                        <option value="en">English (US)</option>
                                        <option value="es">Español</option>
                                        <option value="fr">Français</option>
                                        <option value="pt">Português</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date Format</label>
                                    <select
                                        className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                        value={formData.dateFormat}
                                        onChange={(e) => handleChange('dateFormat', e.target.value)}
                                    >
                                        <option value="YYYY-MM-DD">ISO (2026-02-03)</option>
                                        <option value="DD/MM/YYYY">European (03/02/2026)</option>
                                        <option value="MM/DD/YYYY">US (02/03/2026)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg flex gap-3">
                                <Clock className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={18} />
                                <div>
                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-300">Automatic Timezone Handling</p>
                                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                                        The system automatically detects user timezones. All timestamps are stored in UTC and converted to local time for display.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Integrations */}
                    <div className="card-base bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <Globe size={20} className="text-gray-500" />
                                Integrations
                            </h3>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cesium Ion Access Token</label>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                    Used for the 3D Globe sample location viewer. Get your token from <a href="https://ion.cesium.com/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ion.cesium.com/tokens</a>
                                </p>
                                <input
                                    type="text"
                                    className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-xs"
                                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                    value={formData.cesiumToken || ''}
                                    onChange={(e) => handleChange('cesiumToken', e.target.value)}
                                />
                            </div>

                            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg flex gap-3">
                                <Globe className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={18} />
                                <div>
                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-300">3D Globe Viewer</p>
                                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                                        When a valid Cesium token is set, samples with GPS coordinates will be viewable on an interactive 3D globe accessible from the navigation menu.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Preview */}
                <div className="lg:col-span-1">
                    <div className="sticky top-6">
                        <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Eye size={16} /> Live Preview
                        </h4>

                        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 overflow-hidden transform transition-all duration-300">
                            {/* Mock Header */}
                            <div className="h-16 flex items-center px-4 border-b border-gray-200 dark:border-gray-800"
                                style={{ borderTop: `4px solid ${formData.colors.primary}` }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                                        {formData.logoUrl ? (
                                            <img src={formData.logoUrl} alt="Logo" className="w-6 h-6 object-contain" />
                                        ) : (
                                            <div className="w-4 h-4 rounded-full bg-gray-400"></div>
                                        )}
                                    </div>
                                    <span className="font-bold text-gray-900 dark:text-white truncate max-w-[150px]">
                                        {formData.title || 'LIMS'}
                                    </span>
                                </div>
                                <div className="ml-auto flex gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800"></div>
                                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800"></div>
                                </div>
                            </div>

                            {/* Mock Sidebar & Content Layout */}
                            <div className="flex h-64">
                                {/* Mock Sidebar */}
                                <div className="w-16 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-4 gap-4">
                                    <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: formData.colors.primary }}></div>
                                    <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                                    <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
                                </div>

                                {/* Mock Main Content */}
                                <div className="flex-1 p-4 bg-gray-50/50 dark:bg-black/20">
                                    <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Dashboard</h1>
                                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
                                        <p className="text-sm text-gray-500 mb-1">Welcome back,</p>
                                        <p className="font-medium text-gray-900 dark:text-white">{formData.organization || 'Organization Name'}</p>
                                    </div>

                                    <button className="px-4 py-2 rounded text-white text-sm font-medium w-full" style={{ backgroundColor: formData.colors.primary }}>
                                        Primary Button
                                    </button>
                                    <button className="mt-2 px-4 py-2 rounded text-white text-sm font-medium w-full" style={{ backgroundColor: formData.colors.secondary }}>
                                        Secondary Button
                                    </button>
                                </div>
                            </div>

                            {/* Mock Footer */}
                            <div className="py-2 px-4 bg-gray-100 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 text-[10px] text-center text-gray-500">
                                {formData.footerText || '© 2026 LIMS'}
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-xs text-blue-800 dark:text-blue-300">
                                <strong>Tip:</strong> Ensure your primary and secondary colors have enough contrast for accessibility.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrandingManager;
