import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Search, Filter, X, Save, Loader2, ChevronDown, ChevronRight, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * Sectioned Translation Editor — Phase 3
 * 
 * Fetches the full catalog from `GET /api/admin/languages/:code/catalog`
 * Groups keys into sections by prefix, supports search + "missing only" filter,
 * and saves overrides back to the DB via `PUT /api/admin/languages/:code`.
 */

const SECTION_CONFIG = [
    { prefix: 'nav.', label: 'Navigation & Sidebar', icon: '🧭' },
    { prefix: 'reception.', label: 'Sample Reception & Intake', icon: '📥' },
    { prefix: 'samples.', label: 'Samples & Registry', icon: '🧪' },
    { prefix: 'projects.', label: 'Projects & Campaigns', icon: '📁' },
    { prefix: 'users.', label: 'Staff & User Management', icon: '👥' },
    { prefix: 'equipment.', label: 'Equipment & Calibration', icon: '🔬' },
    { prefix: 'inventory.', label: 'Inventory & Reagents', icon: '📦' },
    { prefix: 'spectral.', label: 'Spectroscopy & Proximal Sensing', icon: '🌈' },
    { prefix: 'datasheet.', label: 'Data Sheets & Analytical Entry', icon: '📋' },
    { prefix: 'reports.', label: 'Result Reports & Certificates', icon: '📊' },
    { prefix: 'labs.', label: 'Laboratory Network & Facilities', icon: '🏢' },
    { prefix: 'about.', label: 'About SoilFER & Resource Partners', icon: 'ℹ️' },
    { prefix: 'admin.', label: 'Admin Panel & Settings', icon: '⚙️' },
    { prefix: 'common.', label: 'Common Buttons & Actions', icon: '🔤' },
    { prefix: 'ui.', label: 'UI Badges & Indicators', icon: '🖥️' },
    { prefix: 'header.', label: 'Header & User Menu', icon: '📌' },
    { prefix: 'footer.', label: 'Footer & Meta', icon: '📎' },
    { prefix: 'dynamic.analysis.', label: 'Analyses (Dynamic Methods)', icon: '🔬' },
    { prefix: 'dynamic.gate.', label: 'Workflow Gates (Dynamic)', icon: '🚪' },
    { prefix: 'dynamic.category.', label: 'Categories (Dynamic)', icon: '📂' },
    { prefix: 'dynamic.status.', label: 'Statuses (Dynamic)', icon: '📊' },
    { prefix: 'dynamic.equipmentType.', label: 'Equipment Types (Dynamic)', icon: '🔧' },
    { prefix: 'dynamic.', label: 'Other Dynamic Database Keys', icon: '⚡' },
];

const classifyKey = (key) => {
    for (const sec of SECTION_CONFIG) {
        if (key.startsWith(sec.prefix)) return sec.label;
    }
    return 'Other';
};

export const TranslationEditor = ({ language, onSave, onClose }) => {
    const [catalog, setCatalog] = useState({});
    const [edits, setEdits] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [missingOnly, setMissingOnly] = useState(false);
    const [collapsedSections, setCollapsedSections] = useState({});
    const [hasChanges, setHasChanges] = useState(false);
    const [error, setError] = useState(null);

    // Fetch catalog on mount
    useEffect(() => {
        const fetchCatalog = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await axios.get(`/api/admin/languages/${language.code}/catalog`);
                // New contract: catalog is under res.data.data
                const catalogData = res.data.data || res.data.catalog || res.data;
                setCatalog(catalogData);

                // Initialize edits from catalog values
                const initial = {};
                Object.entries(catalogData).forEach(([key, info]) => {
                    initial[key] = info.value || '';
                });
                setEdits(initial);
            } catch (e) {
                console.error('Failed to fetch catalog:', e);
                setError('Failed to load translation catalog. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        fetchCatalog();
    }, [language.code]);

    // Group keys into sections
    const sections = useMemo(() => {
        const groups = {};
        Object.entries(catalog).forEach(([key, info]) => {
            const section = classifyKey(key);
            if (!groups[section]) groups[section] = [];
            groups[section].push({ key, ...info });
        });

        // Sort sections by SECTION_CONFIG order
        const ordered = SECTION_CONFIG.map(s => s.label).filter(label => groups[label]);
        if (groups['Other']) ordered.push('Other');

        return ordered.map(label => ({
            label,
            icon: SECTION_CONFIG.find(s => s.label === label)?.icon || '📄',
            keys: groups[label] || []
        }));
    }, [catalog]);

    // Filtered keys per section
    const filteredSections = useMemo(() => {
        return sections.map(section => {
            let filtered = section.keys;

            if (search) {
                const q = search.toLowerCase();
                filtered = filtered.filter(item =>
                    item.key.toLowerCase().includes(q) ||
                    (item.en || '').toLowerCase().includes(q) ||
                    (edits[item.key] || '').toLowerCase().includes(q)
                );
            }

            if (missingOnly) {
                filtered = filtered.filter(item => !(edits[item.key] || '').trim());
            }

            return { ...section, keys: filtered };
        }).filter(s => s.keys.length > 0);
    }, [sections, search, missingOnly, edits]);

    // Stats
    const stats = useMemo(() => {
        const total = Object.keys(catalog).length;
        const translated = Object.values(edits).filter(v => (v || '').trim()).length;
        const missing = total - translated;
        const pct = total > 0 ? Math.round((translated / total) * 100) : 0;
        return { total, translated, missing, pct };
    }, [catalog, edits]);

    const handleChange = (key, value) => {
        setEdits(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Only save non-empty overrides
            const overrides = {};
            Object.entries(edits).forEach(([key, value]) => {
                if ((value || '').trim()) {
                    overrides[key] = value;
                }
            });
            await onSave(overrides);
            setHasChanges(false);
        } catch (e) {
            console.error('Save failed:', e);
        } finally {
            setSaving(false);
        }
    };

    const toggleSection = (label) => {
        setCollapsedSections(prev => ({ ...prev, [label]: !prev[label] }));
    };

    const getSectionStats = (keys) => {
        const total = keys.length;
        const translated = keys.filter(k => (edits[k.key] || '').trim()).length;
        return { total, translated, pct: total > 0 ? Math.round((translated / total) * 100) : 0 };
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-sf-surface p-12 rounded-xl shadow-2xl flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-sf-muted font-medium">Loading translation catalog…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-sf-surface rounded-xl w-[95vw] max-w-7xl h-[90vh] flex flex-col shadow-2xl border border-sf-divider">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-sf-divider bg-sf-canvas rounded-t-xl">
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-sf-text flex items-center gap-2">
                                Translation Editor — {language.name}
                                <span className="text-sm font-mono text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-0.5 rounded">
                                    {language.code}
                                </span>
                            </h2>
                            <p className="text-sm text-sf-muted mt-0.5">
                                Translate from English → {language.name}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {hasChanges && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                <AlertCircle size={14} /> Unsaved changes
                            </span>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex items-center gap-4 px-6 py-3 border-b border-sf-divider bg-sf-surface">
                    {/* Progress bar */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${stats.pct}%` }}
                            />
                        </div>
                        <span className="text-xs font-medium text-sf-muted whitespace-nowrap">
                            {stats.translated}/{stats.total} ({stats.pct}%)
                        </span>
                    </div>

                    <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />

                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search keys, English text, or translations…"
                            className="w-full pl-9 pr-3 py-2 text-sm border border-sf-divider rounded-lg bg-white dark:bg-gray-700 text-sf-text focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Missing filter */}
                    <button
                        onClick={() => setMissingOnly(!missingOnly)}
                        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${missingOnly
                            ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
                            : 'border-sf-divider text-sf-muted hover:bg-sf-raised'
                            }`}
                    >
                        <Filter size={14} />
                        {missingOnly ? `Missing (${stats.missing})` : 'Show Missing Only'}
                    </button>
                </div>

                {/* Error banner */}
                {error && (
                    <div className="mx-6 mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {filteredSections.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <Search size={48} className="mb-4 opacity-50" />
                            <p className="text-lg font-medium">No matching keys</p>
                            <p className="text-sm">Try adjusting your search or filter criteria.</p>
                        </div>
                    ) : (
                        filteredSections.map(section => {
                            const isCollapsed = collapsedSections[section.label];
                            const sectionStats = getSectionStats(section.keys);

                            return (
                                <div key={section.label} className="mb-4">
                                    {/* Section Header */}
                                    <button
                                        onClick={() => toggleSection(section.label)}
                                        className="w-full flex items-center gap-3 px-4 py-3 bg-sf-raised/50 rounded-lg hover:bg-gray-150 dark:hover:bg-gray-700 transition-colors group"
                                    >
                                        {isCollapsed ? <ChevronRight size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                        <span className="text-lg">{section.icon}</span>
                                        <span className="font-semibold text-sf-text">
                                            {section.label}
                                        </span>
                                        <span className="text-xs text-sf-muted">
                                            ({section.keys.length} keys)
                                        </span>
                                        <div className="ml-auto flex items-center gap-2">
                                            <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${sectionStats.pct === 100 ? 'bg-green-500' : sectionStats.pct > 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                                                    style={{ width: `${sectionStats.pct}%` }}
                                                />
                                            </div>
                                            <span className={`text-xs font-medium ${sectionStats.pct === 100 ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                                                {sectionStats.pct === 100 ? (
                                                    <CheckCircle2 size={14} className="inline" />
                                                ) : (
                                                    `${sectionStats.pct}%`
                                                )}
                                            </span>
                                        </div>
                                    </button>

                                    {/* Section Keys */}
                                    {!isCollapsed && (
                                        <div className="mt-1 space-y-0.5">
                                            {section.keys.map(item => (
                                                <div
                                                    key={item.key}
                                                    className={`grid grid-cols-12 gap-3 px-4 py-2.5 rounded-lg hover:bg-sf-raised/30 transition-colors ${!(edits[item.key] || '').trim() ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                                                        }`}
                                                >
                                                    {/* Key */}
                                                    <div className="col-span-3 flex items-start pt-2">
                                                        <code className="text-xs font-mono text-sf-muted break-all leading-tight">
                                                            {item.key}
                                                            {item.isDynamic && (
                                                                <span className="ml-1.5 inline-flex px-1 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 text-[10px] rounded font-sans font-medium">
                                                                    DB
                                                                </span>
                                                            )}
                                                        </code>
                                                    </div>

                                                    {/* English Source */}
                                                    <div className="col-span-4 flex items-start pt-2">
                                                        <div className="text-sm text-sf-muted bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded border border-blue-100 dark:border-blue-800/50 w-full">
                                                            {item.en || <span className="text-gray-400 italic">—</span>}
                                                        </div>
                                                    </div>

                                                    {/* Translation Input */}
                                                    <div className="col-span-5">
                                                        <input
                                                            type="text"
                                                            className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors bg-white dark:bg-gray-700 text-sf-text ${!(edits[item.key] || '').trim()
                                                                ? 'border-amber-300 dark:border-amber-700 focus:ring-2 focus:ring-amber-400'
                                                                : 'border-sf-divider focus:ring-2 focus:ring-blue-500'
                                                                }`}
                                                            value={edits[item.key] || ''}
                                                            onChange={e => handleChange(item.key, e.target.value)}
                                                            placeholder={item.en || `Enter ${language.name} translation…`}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-sf-divider bg-sf-canvas rounded-b-xl">
                    <div className="text-sm text-sf-muted">
                        💡 Leave fields empty to fall back to English
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sf-muted hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !hasChanges}
                            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {saving ? 'Saving…' : 'Save Translations'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TranslationEditor;
