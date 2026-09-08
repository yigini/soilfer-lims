import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
    Search, Filter, X, Save, Loader2, ChevronRight, AlertCircle,
    CheckCircle2, ArrowLeft, Download, Upload, Check, Layout,
    FlaskConical, TestTube, FileText, Package, FolderGit2, Settings,
    Bell, HelpCircle, FileCheck2, Sparkles
} from 'lucide-react';
import { GROUP_DEFINITIONS, classifyTerminologyKey, getGroupDefinition, getAllGroupDefinitions } from '../lib/terminologyRegistry';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const ICON_MAP = {
    Layout,
    FlaskConical,
    TestTube,
    FileText,
    Package,
    FolderGit2,
    Settings,
    Bell,
    HelpCircle
};

const ITEMS_PER_PAGE = 25;

export const TranslationEditor = ({ language, onSave, onClose }) => {
    const { locale: currentAppLocale, t, availableLanguages = [] } = useLanguage();
    const { user } = useAuth();

    // Active Language & Scope State
    const [selectedLanguage, setSelectedLanguage] = useState(language);
    const [selectedScope, setSelectedScope] = useState(user?.role === 'SUPER_ADMIN' ? 'global' : (user?.labId ? 'lab' : 'global'));

    // Catalog & Drafts State
    const [catalog, setCatalog] = useState({});
    const [edits, setEdits] = useState({});
    const [reviewStatuses, setReviewStatuses] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [error, setError] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');

    // Navigation & Filtering State
    const [activeGroupId, setActiveGroupId] = useState(null);
    const [searchAll, setSearchAll] = useState('');
    const [groupSearch, setGroupSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('needs_attention'); // 'needs_attention', 'missing', 'needs_review', 'published', 'all'
    const [selectedModule, setSelectedModule] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);

    // Import Preview Modal State
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [importPreviewData, setImportPreviewData] = useState([]);

    // Fetch catalog when language changes
    const fetchCatalog = useCallback(async (langCode) => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`/api/admin/languages/${langCode}/catalog`);
            const catalogData = res.data?.data || res.data?.catalog || res.data || {};
            setCatalog(catalogData);

            // Initialize edits and reviewStatuses
            const initialEdits = {};
            const initialReviews = {};
            Object.entries(catalogData).forEach(([key, info]) => {
                initialEdits[key] = info.value || '';
                initialReviews[key] = info.reviewStatus || (info.value ? (langCode === 'en' ? 'certified' : 'reviewed') : 'missing');
            });
            setEdits(initialEdits);
            setReviewStatuses(initialReviews);
            setHasChanges(false);
        } catch (e) {
            console.error('Failed to fetch catalog:', e);
            setError(t('terminology.catalogFetchError', 'Failed to load translation catalog. Please try again.'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if (selectedLanguage?.code) {
            fetchCatalog(selectedLanguage.code);
        }
    }, [selectedLanguage?.code, fetchCatalog]);

    // Handle Language Switch from header
    const handleSwitchLanguage = (code) => {
        if (hasChanges) {
            const confirmed = window.confirm(t('terminology.unsavedWarning', 'You have unsaved changes. Switch language anyway?'));
            if (!confirmed) return;
        }
        const langObj = (availableLanguages || []).find(l => l.code === code) || { code, name: code };
        setSelectedLanguage(langObj);
    };

    // Calculate item classification and group mapping
    const groupedItems = useMemo(() => {
        const groups = {};
        GROUP_DEFINITIONS.forEach(def => {
            groups[def.id] = [];
        });

        Object.entries(catalog).forEach(([key, info]) => {
            const classification = info.primaryGroup ? info : classifyTerminologyKey(key);
            const groupId = classification.primaryGroup || 'unclassified';
            if (!groups[groupId]) groups[groupId] = [];

            const currentVal = edits[key] !== undefined ? edits[key] : (info.value || '');
            const isMissing = !(currentVal || '').trim();
            const revStatus = reviewStatuses[key] || (isMissing ? 'missing' : 'reviewed');
            const sourceChanged = Boolean(info.sourceChanged);

            groups[groupId].push({
                key,
                ...info,
                primaryGroup: groupId,
                module: classification.module || 'general',
                tags: classification.tags || [],
                value: currentVal,
                isMissing,
                reviewStatus: revStatus,
                sourceChanged
            });
        });

        return groups;
    }, [catalog, edits, reviewStatuses]);

    // Group Statistics (Reconciled to unique entries)
    const groupStats = useMemo(() => {
        const stats = {};
        let totalAll = 0;
        let missingAll = 0;
        let needsReviewAll = 0;
        let publishedAll = 0;

        GROUP_DEFINITIONS.forEach(def => {
            const items = groupedItems[def.id] || [];
            const total = items.length;
            const missing = items.filter(i => i.isMissing).length;
            const needsReview = items.filter(i => !i.isMissing && i.reviewStatus === 'needs_review').length;
            const sourceChanged = items.filter(i => i.sourceChanged).length;
            const published = items.filter(i => !i.isMissing && i.reviewStatus !== 'needs_review').length;
            const needsAttention = missing + needsReview + sourceChanged;
            const pct = total > 0 ? Math.round((published / total) * 100) : 0;

            stats[def.id] = {
                total,
                missing,
                needsReview,
                sourceChanged,
                needsAttention,
                published,
                pct
            };

            totalAll += total;
            missingAll += missing;
            needsReviewAll += needsReview;
            publishedAll += published;
        });

        stats.__overall = {
            total: totalAll,
            missing: missingAll,
            needsReview: needsReviewAll,
            published: publishedAll,
            pct: totalAll > 0 ? Math.round((publishedAll / totalAll) * 100) : 0
        };

        return stats;
    }, [groupedItems]);

    // Active Group Definition
    const activeGroupDef = useMemo(() => {
        if (!activeGroupId) return null;
        return getGroupDefinition(activeGroupId, currentAppLocale);
    }, [activeGroupId, currentAppLocale]);

    // Available submodules within active group
    const groupModules = useMemo(() => {
        if (!activeGroupId) return [];
        const items = groupedItems[activeGroupId] || [];
        const mods = new Set();
        items.forEach(i => {
            if (i.module) mods.add(i.module);
        });
        return Array.from(mods).sort();
    }, [activeGroupId, groupedItems]);

    // Filtered items in active group or global search
    const filteredItems = useMemo(() => {
        let items = [];

        if (searchAll.trim()) {
            // Global search across all groups
            const q = searchAll.toLowerCase();
            Object.values(groupedItems).forEach(groupList => {
                groupList.forEach(item => {
                    const matchesKey = item.key.toLowerCase().includes(q);
                    const matchesEn = (item.en || '').toLowerCase().includes(q);
                    const matchesVal = (edits[item.key] || '').toLowerCase().includes(q);
                    const matchesTag = item.tags.some(t => t.toLowerCase().includes(q));
                    if (matchesKey || matchesEn || matchesVal || matchesTag) {
                        items.push(item);
                    }
                });
            });
        } else if (activeGroupId) {
            items = groupedItems[activeGroupId] || [];

            // Filter by module subfilter
            if (selectedModule !== 'ALL') {
                items = items.filter(i => i.module === selectedModule);
            }

            // Filter by within-group search
            if (groupSearch.trim()) {
                const q = groupSearch.toLowerCase();
                items = items.filter(item =>
                    item.key.toLowerCase().includes(q) ||
                    (item.en || '').toLowerCase().includes(q) ||
                    (edits[item.key] || '').toLowerCase().includes(q)
                );
            }

            // Filter by status tab
            if (statusFilter === 'needs_attention') {
                items = items.filter(i => i.isMissing || i.reviewStatus === 'needs_review' || i.sourceChanged);
            } else if (statusFilter === 'missing') {
                items = items.filter(i => i.isMissing);
            } else if (statusFilter === 'needs_review') {
                items = items.filter(i => !i.isMissing && i.reviewStatus === 'needs_review');
            } else if (statusFilter === 'published') {
                items = items.filter(i => !i.isMissing && i.reviewStatus !== 'needs_review');
            }
        }

        return items;
    }, [searchAll, activeGroupId, groupedItems, selectedModule, groupSearch, statusFilter, edits]);

    // Pagination calculations
    const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE) || 1;
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredItems.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredItems, currentPage]);

    // Handle translation text edit
    const handleChange = (key, value) => {
        setEdits(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
        if (value.trim()) {
            setReviewStatuses(prev => ({
                ...prev,
                [key]: prev[key] === 'missing' ? 'needs_review' : prev[key]
            }));
        }
    };

    // Toggle single item review status
    const toggleReviewStatus = (key) => {
        setReviewStatuses(prev => {
            const current = prev[key];
            const next = current === 'published' || current === 'certified' ? 'needs_review' : 'published';
            return { ...prev, [key]: next };
        });
        setHasChanges(true);
    };

    // Mark all currently visible filtered items as reviewed
    const markAllVisibleAsReviewed = () => {
        const updates = {};
        filteredItems.forEach(item => {
            if ((edits[item.key] || '').trim()) {
                updates[item.key] = 'published';
            }
        });
        setReviewStatuses(prev => ({ ...prev, ...updates }));
        setHasChanges(true);
    };

    // Save handler: writes pending overrides to server
    const handleSave = async () => {
        setSaving(true);
        setError(null);
        setSuccessMsg('');
        try {
            const payload = {};
            Object.entries(edits).forEach(([key, val]) => {
                if ((val || '').trim()) {
                    payload[key] = val.trim();
                }
            });

            if (onSave) {
                await onSave(payload, selectedScope);
            } else {
                await axios.put(`/api/admin/languages/${selectedLanguage.code}`, { translations: payload, scope: selectedScope });
            }

            setHasChanges(false);
            setSuccessMsg(t('terminology.savedSuccess', 'All translations saved successfully.'));
            setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err) {
            console.error('Save failed:', err);
            setError(err.response?.data?.error || t('terminology.saveFailed', 'Failed to save translations. Your edits are preserved.'));
        } finally {
            setSaving(false);
        }
    };

    // Export current group or all items as JSON
    const handleExport = (format = 'json') => {
        const itemsToExport = activeGroupId ? (groupedItems[activeGroupId] || []) : Object.values(groupedItems).flat();
        const exportObj = {};
        itemsToExport.forEach(item => {
            exportObj[item.key] = edits[item.key] || item.en || '';
        });

        let dataStr, filename, mimeType;
        if (format === 'json') {
            dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj, null, 2));
            filename = `soilfer_${selectedLanguage.code}_${activeGroupId || 'all'}.json`;
            mimeType = 'application/json';
        } else {
            // CSV
            const rows = [['Key', 'English', `Translation (${selectedLanguage.name})`, 'Group', 'Status']];
            itemsToExport.forEach(item => {
                rows.push([
                    `"${item.key.replace(/"/g, '""')}"`,
                    `"${(item.en || '').replace(/"/g, '""')}"`,
                    `"${(edits[item.key] || '').replace(/"/g, '""')}"`,
                    item.primaryGroup,
                    item.reviewStatus
                ]);
            });
            dataStr = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.map(r => r.join(',')).join('\n'));
            filename = `soilfer_${selectedLanguage.code}_${activeGroupId || 'all'}.csv`;
            mimeType = 'text/csv';
        }

        const link = document.createElement('a');
        link.setAttribute('href', dataStr);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    // Open file picker for import
    const handleFileImport = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                let parsed = {};
                if (file.name.endsWith('.json')) {
                    parsed = JSON.parse(text);
                } else if (file.name.endsWith('.csv')) {
                    // Simple CSV parser
                    const lines = text.split(/\r?\n/);
                    lines.slice(1).forEach(line => {
                        const match = line.match(/^"?([^",]+)"?,.*?"?([^"]*)"?$/);
                        if (match) {
                            parsed[match[1]] = match[2];
                        }
                    });
                }

                // Prepare preview
                const preview = [];
                Object.entries(parsed).forEach(([key, newVal]) => {
                    if (catalog[key]) {
                        preview.push({
                            key,
                            oldVal: edits[key] || '',
                            newVal: String(newVal).trim(),
                            group: catalog[key].primaryGroup
                        });
                    }
                });

                setImportPreviewData(preview);
                setImportModalOpen(true);
            } catch (err) {
                alert('Failed to parse import file: ' + err.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    // Confirm import preview
    const applyImport = () => {
        const updates = {};
        importPreviewData.forEach(item => {
            updates[item.key] = item.newVal;
        });
        setEdits(prev => ({ ...prev, ...updates }));
        setHasChanges(true);
        setImportModalOpen(false);
        setImportPreviewData([]);
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-xs">
                <div className="bg-sf-surface p-10 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-sf-divider">
                    <Loader2 className="w-9 h-9 animate-spin text-sf-primary" />
                    <p className="text-sf-muted font-semibold text-sm">
                        {t('terminology.loadingCatalog', 'Loading Languages & Terminology catalog…')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-xs font-sans">
            <div className="bg-sf-surface rounded-2xl w-[96vw] max-w-7xl h-[92vh] flex flex-col shadow-2xl border border-sf-divider overflow-hidden">

                {/* Top Application Bar */}
                <div className="flex flex-wrap items-center justify-between px-6 py-4 border-b border-sf-divider bg-sf-canvas">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-sf-primary/10 text-sf-primary">
                            <Sparkles size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-lg font-bold text-sf-text">
                                    {t('terminology.title', 'Languages & Terminology')}
                                </h2>
                                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-sf-primary/10 text-sf-primary border border-sf-primary/20">
                                    {selectedLanguage.code}
                                </span>
                            </div>
                            <p className="text-xs text-sf-muted mt-0.5">
                                {t('terminology.subtitle', 'Organize, review, and localize laboratory definitions across the platform')}
                            </p>
                        </div>
                    </div>

                    {/* Language & Scope Selectors */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-sf-surface border border-sf-divider rounded-xl p-1 text-xs">
                            <span className="px-2.5 font-semibold text-sf-muted uppercase tracking-wider text-[10px]">
                                {t('terminology.languageLabel', 'Language')}
                            </span>
                            <select
                                value={selectedLanguage.code}
                                onChange={(e) => handleSwitchLanguage(e.target.value)}
                                className="bg-transparent text-sf-text font-semibold pr-4 py-1 outline-none cursor-pointer"
                            >
                                {(availableLanguages.length > 0 ? availableLanguages : [
                                    { code: 'en', name: 'English' },
                                    { code: 'es', name: 'Español' },
                                    { code: 'es-419', name: 'Español (América Latina)' },
                                    { code: 'fr', name: 'Français' },
                                    { code: 'pt', name: 'Português' }
                                ]).map(l => (
                                    <option key={l.code} value={l.code} className="bg-sf-surface text-sf-text">
                                        {l.name} ({l.code})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Scope Selector */}
                        <div className="flex items-center bg-sf-surface border border-sf-divider rounded-xl p-1 text-xs">
                            <span className="px-2.5 font-semibold text-sf-muted uppercase tracking-wider text-[10px]">
                                {t('terminology.scopeLabel', 'Scope')}
                            </span>
                            <select
                                value={selectedScope}
                                onChange={(e) => setSelectedScope(e.target.value)}
                                className="bg-transparent text-sf-text font-semibold pr-3 py-1 outline-none cursor-pointer"
                            >
                                <option value="global" disabled={user?.role !== 'SUPER_ADMIN'} className="bg-sf-surface text-sf-text">
                                    Global System {user?.role !== 'SUPER_ADMIN' ? `(${t('terminology.adminOnly', 'Super Admin Only')})` : ''}
                                </option>
                                {user?.labId && (
                                    <option value="lab" className="bg-sf-surface text-sf-text">Own Lab ({user.labId})</option>
                                )}
                            </select>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSave}
                            disabled={saving || !hasChanges}
                            className="btn-primary flex items-center gap-2 py-2 px-4 shadow-sm text-sm"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            <span>{saving ? t('common.saving', 'Saving…') : t('common.save', 'Save Changes')}</span>
                        </button>

                        {/* Close Modal Button */}
                        <button
                            onClick={() => {
                                if (hasChanges) {
                                    if (!window.confirm(t('terminology.unsavedWarning', 'You have unsaved changes. Close anyway?'))) return;
                                }
                                onClose();
                            }}
                            className="p-2 text-sf-muted hover:text-sf-text hover:bg-sf-hover rounded-xl transition-colors"
                            title={t('common.close', 'Close')}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Global Search & Alert Header */}
                <div className="px-6 py-2.5 bg-sf-surface border-b border-sf-divider flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-sf-muted" />
                        <input
                            type="text"
                            placeholder={t('terminology.searchAllPlaceholder', 'Search all terminology groups, keys, English text…')}
                            value={searchAll}
                            onChange={(e) => {
                                setSearchAll(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-sf-divider bg-sf-canvas text-sf-text focus:ring-2 focus:ring-sf-primary focus:border-transparent outline-none"
                        />
                        {searchAll && (
                            <button
                                onClick={() => setSearchAll('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sf-muted hover:text-sf-text text-xs"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                        {hasChanges && (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
                                <AlertCircle size={14} /> {t('terminology.unsavedChanges', 'Unsaved changes in draft')}
                            </span>
                        )}
                        {successMsg && (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                                <CheckCircle2 size={14} /> {successMsg}
                            </span>
                        )}
                        <span className="text-sf-muted">
                            {groupStats.__overall?.published || 0} / {groupStats.__overall?.total || 0} {t('terminology.publishedCount', 'published')} ({groupStats.__overall?.pct || 0}%)
                        </span>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mx-6 mt-3 p-3 bg-sf-danger-bg border border-sf-danger/30 text-sf-danger rounded-xl text-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                        <button onClick={() => setError(null)} className="text-sf-danger hover:underline">Dismiss</button>
                    </div>
                )}

                {/* Body Content: Main Groups Grid OR Group Detail View */}
                <div className="flex-1 overflow-y-auto p-6 bg-sf-canvas/50">

                    {/* VIEW 1: GLOBAL SEARCH RESULTS */}
                    {searchAll.trim() ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-sf-text flex items-center gap-2">
                                    <Search size={16} className="text-sf-primary" />
                                    {t('terminology.globalSearchResults', 'Global Search Results')} ({filteredItems.length})
                                </h3>
                                <button
                                    onClick={() => setSearchAll('')}
                                    className="text-xs text-sf-primary hover:underline"
                                >
                                    {t('terminology.backToOverview', 'Back to Groups Overview')}
                                </button>
                            </div>

                            {/* Terms Table */}
                            {renderTermsTable(paginatedItems, edits, reviewStatuses, handleChange, toggleReviewStatus, selectedLanguage, t, 'all', null, null)}

                            {/* Pagination */}
                            {renderPagination(currentPage, totalPages, filteredItems.length, setCurrentPage, t)}
                        </div>
                    ) : !activeGroupId ? (

                        /* VIEW 2: HUMAN-READABLE GROUPS OVERVIEW */
                        <div className="space-y-6 max-w-7xl mx-auto">
                            <div>
                                <h3 className="text-base font-bold text-sf-text">
                                    {t('terminology.groupsHeading', 'Terminology Groups')}
                                </h3>
                                <p className="text-xs text-sf-muted mt-0.5">
                                    {t('terminology.groupsSubheading', 'Select a group to review and edit localized terms. Items needing attention are prioritized.')}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {getAllGroupDefinitions(currentAppLocale).map(groupDef => {
                                    const st = groupStats[groupDef.id] || { total: 0, missing: 0, needsReview: 0, sourceChanged: 0, published: 0, pct: 0 };
                                    const IconComp = ICON_MAP[groupDef.icon] || Layout;

                                    // Hide unclassified if 0 items
                                    if (groupDef.id === 'unclassified' && st.total === 0) return null;

                                    return (
                                        <div
                                            key={groupDef.id}
                                            onClick={() => {
                                                setActiveGroupId(groupDef.id);
                                                setCurrentPage(1);
                                                setSelectedModule('ALL');
                                                setGroupSearch('');
                                                setStatusFilter(st.needsAttention > 0 ? 'needs_attention' : 'all');
                                            }}
                                            className="group relative bg-sf-surface border border-sf-divider rounded-2xl p-5 hover:border-sf-primary hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                                        >
                                            <div className="space-y-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="p-3 rounded-xl bg-sf-raised text-sf-primary group-hover:bg-sf-primary/10 transition-colors">
                                                        <IconComp size={22} />
                                                    </div>
                                                    {st.missing > 0 ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                            {st.missing} {t('terminology.missingBadge', 'missing')}
                                                        </span>
                                                    ) : st.needsReview > 0 ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                            {st.needsReview} {t('terminology.reviewBadge', 'in review')}
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                                            <Check size={12} /> {t('terminology.completedBadge', '100%')}
                                                        </span>
                                                    )}
                                                </div>

                                                <div>
                                                    <h4 className="text-sm font-bold text-sf-text group-hover:text-sf-primary transition-colors">
                                                        {groupDef.name}
                                                    </h4>
                                                    <p className="text-xs text-sf-muted mt-1 line-clamp-2 leading-relaxed">
                                                        {groupDef.description}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="pt-4 mt-4 border-t border-sf-divider space-y-2">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-sf-muted font-medium">
                                                        {st.published} / {st.total} {t('terminology.termsLabel', 'terms')}
                                                    </span>
                                                    <span className="font-bold text-sf-text">
                                                        {st.pct}%
                                                    </span>
                                                </div>
                                                <div className="w-full h-1.5 bg-sf-raised rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${
                                                            st.pct === 100 ? 'bg-emerald-500' : st.pct > 50 ? 'bg-sf-primary' : 'bg-amber-500'
                                                        }`}
                                                        style={{ width: `${st.pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    ) : (() => {
                        const activeGroupStats = groupStats[activeGroupId] || { total: 0, missing: 0, needsReview: 0, sourceChanged: 0, published: 0, needsAttention: 0, pct: 0 };
                        return (
                        /* VIEW 3: SINGLE GROUP EDIT VIEW */
                        <div className="space-y-4 max-w-7xl mx-auto">
                            {/* Group Header & Breadcrumb */}
                            <div className="flex flex-wrap items-center justify-between gap-4 bg-sf-surface p-4 rounded-2xl border border-sf-divider">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            setActiveGroupId(null);
                                            setCurrentPage(1);
                                        }}
                                        className="p-2 rounded-xl bg-sf-raised hover:bg-sf-hover text-sf-text transition-colors flex items-center gap-1.5 text-xs font-semibold"
                                    >
                                        <ArrowLeft size={16} />
                                        <span>{t('terminology.allGroups', 'All Groups')}</span>
                                    </button>
                                    <div className="h-4 w-px bg-sf-divider" />
                                    <div>
                                        <h3 className="text-sm font-bold text-sf-text flex items-center gap-2">
                                            <span>{activeGroupDef?.name}</span>
                                            <span className="text-xs font-normal text-sf-muted">
                                                ({filteredItems.length} of {activeGroupStats.total} {t('terminology.termsLabel', 'terms')})
                                            </span>
                                        </h3>
                                        <p className="text-xs text-sf-muted mt-0.5">
                                            {activeGroupDef?.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Group Toolbar: Export / Import / Review All */}
                                <div className="flex items-center gap-2">
                                    <label className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 cursor-pointer">
                                        <Upload size={14} />
                                        <span>{t('terminology.importBtn', 'Import')}</span>
                                        <input
                                            type="file"
                                            accept=".json,.csv"
                                            onChange={handleFileImport}
                                            className="hidden"
                                        />
                                    </label>
                                    <button
                                        onClick={() => handleExport('json')}
                                        className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
                                        title="Export Group to JSON"
                                    >
                                        <Download size={14} />
                                        <span>{t('terminology.exportJson', 'Export JSON')}</span>
                                    </button>
                                    <button
                                        onClick={() => handleExport('csv')}
                                        className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
                                        title="Export Group to CSV"
                                    >
                                        <Download size={14} />
                                        <span>{t('terminology.exportCsv', 'Export CSV')}</span>
                                    </button>
                                    {['SUPER_ADMIN', 'LAB_MANAGER'].includes(user?.role) && (
                                        <button
                                            onClick={markAllVisibleAsReviewed}
                                            className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                            title="Mark all filled items on this page as reviewed"
                                        >
                                            <FileCheck2 size={14} />
                                            <span>{t('terminology.markReviewed', 'Approve Visible')}</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Filters Bar: Status Tabs + Module Subfilters + In-group Search */}
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-sf-surface p-3 rounded-2xl border border-sf-divider">
                                {/* Status Filter Tabs */}
                                <div className="flex items-center gap-1.5">
                                    {[
                                        { id: 'needs_attention', label: t('terminology.filterNeedsAttention', 'Needs Attention'), count: activeGroupStats.needsAttention },
                                        { id: 'missing', label: t('terminology.filterMissing', 'Missing Only'), count: activeGroupStats.missing },
                                        { id: 'needs_review', label: t('terminology.filterInReview', 'In Review'), count: activeGroupStats.needsReview },
                                        { id: 'published', label: t('terminology.filterPublished', 'Published'), count: activeGroupStats.published },
                                        { id: 'all', label: t('terminology.filterAll', 'All Items'), count: activeGroupStats.total }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => {
                                                setStatusFilter(tab.id);
                                                setCurrentPage(1);
                                            }}
                                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                                                statusFilter === tab.id
                                                    ? 'bg-sf-primary text-white shadow-xs'
                                                    : 'text-sf-muted hover:text-sf-text hover:bg-sf-hover'
                                            }`}
                                        >
                                            <span>{tab.label}</span>
                                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                                                statusFilter === tab.id ? 'bg-white/20 text-white' : 'bg-sf-raised text-sf-muted'
                                            }`}>
                                                {tab.count !== undefined ? tab.count : 0}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                {/* Module Subfilter (if applicable) */}
                                {groupModules.length > 1 && (
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="text-sf-muted font-medium">{t('terminology.moduleFilter', 'Module')}:</span>
                                        <select
                                            value={selectedModule}
                                            onChange={(e) => {
                                                setSelectedModule(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            className="bg-sf-canvas border border-sf-divider rounded-xl px-2.5 py-1 text-xs text-sf-text font-semibold outline-none cursor-pointer"
                                        >
                                            <option value="ALL">{t('common.all', 'ALL')}</option>
                                            {groupModules.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* In-group Search */}
                                <div className="relative w-64">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sf-muted" />
                                    <input
                                        type="text"
                                        placeholder={t('terminology.searchInGroup', 'Filter within group…')}
                                        value={groupSearch}
                                        onChange={(e) => {
                                            setGroupSearch(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-sf-divider bg-sf-canvas text-sf-text outline-none"
                                    />
                                    {groupSearch && (
                                        <button
                                            onClick={() => setGroupSearch('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sf-muted hover:text-sf-text text-xs"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Terms Table */}
                            {renderTermsTable(paginatedItems, edits, reviewStatuses, handleChange, toggleReviewStatus, selectedLanguage, t, statusFilter, setStatusFilter, activeGroupStats)}

                            {/* Pagination */}
                            {renderPagination(currentPage, totalPages, filteredItems.length, setCurrentPage, t)}
                        </div>
                        );
                    })()}
                </div>

                {/* Import Preview Modal */}
                {importModalOpen && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60 backdrop-blur-xs">
                        <div className="bg-sf-surface rounded-2xl w-[90vw] max-w-2xl max-h-[80vh] flex flex-col shadow-2xl border border-sf-divider">
                            <div className="px-6 py-4 border-b border-sf-divider flex items-center justify-between">
                                <h3 className="text-sm font-bold text-sf-text flex items-center gap-2">
                                    <Upload size={18} className="text-sf-primary" />
                                    {t('terminology.importPreviewTitle', 'Import Translation Changes Preview')}
                                </h3>
                                <button onClick={() => setImportModalOpen(false)} className="text-sf-muted hover:text-sf-text">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-4 flex-1">
                                <p className="text-xs text-sf-muted">
                                    {t('terminology.importPreviewDesc', 'The following {count} terms will be updated in your working draft. You will still need to click Save Changes to persist to database.', { count: importPreviewData.length })}
                                </p>

                                <div className="border border-sf-divider rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-sf-raised border-b border-sf-divider font-semibold text-sf-muted">
                                            <tr>
                                                <th className="p-2.5">Key</th>
                                                <th className="p-2.5">Current Value</th>
                                                <th className="p-2.5">New Imported Value</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-sf-divider font-mono">
                                            {importPreviewData.map(item => (
                                                <tr key={item.key} className="hover:bg-sf-raised/50">
                                                    <td className="p-2.5 font-bold text-sf-text break-all">{item.key}</td>
                                                    <td className="p-2.5 text-sf-muted break-all">{item.oldVal || '—'}</td>
                                                    <td className="p-2.5 text-sf-primary font-semibold break-all">{item.newVal}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-sf-divider bg-sf-canvas flex justify-end gap-3">
                                <button
                                    onClick={() => setImportModalOpen(false)}
                                    className="btn-secondary text-xs py-2 px-4"
                                >
                                    {t('common.cancel', 'Cancel')}
                                </button>
                                <button
                                    onClick={applyImport}
                                    className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
                                >
                                    <Check size={14} />
                                    <span>{t('terminology.applyImport', 'Apply to Working Draft')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

// Helper: Render Terms Table
function renderTermsTable(items, edits, reviewStatuses, handleChange, toggleReviewStatus, selectedLanguage, t, statusFilter, setStatusFilter, activeGroupStats) {
    if (items.length === 0) {
        const isAllPublished = activeGroupStats && activeGroupStats.needsAttention === 0 && activeGroupStats.total > 0;
        return (
            <div className="bg-sf-surface border border-sf-divider rounded-2xl p-12 text-center space-y-3">
                <Search size={36} className="mx-auto text-sf-muted opacity-40" />
                <h4 className="text-sm font-bold text-sf-text">
                    {isAllPublished && statusFilter === 'needs_attention'
                        ? t('terminology.allPublishedHeading', 'All {count} terms in this group are translated and published!', { count: activeGroupStats.total })
                        : statusFilter === 'missing'
                            ? t('terminology.noMissing', 'No missing translations in this group.')
                            : t('terminology.noMatchingTerms', 'No matching terms found')}
                </h4>
                <p className="text-xs text-sf-muted max-w-sm mx-auto">
                    {isAllPublished && statusFilter === 'needs_attention'
                        ? t('terminology.allPublishedDesc', 'There are no items currently requiring attention. Switch to "All Items" or "Published" to view or update translations.')
                        : t('terminology.noMatchingTermsDesc', 'Try switching your filter tabs or adjusting your search keywords.')}
                </p>
                {setStatusFilter && (statusFilter === 'needs_attention' || statusFilter === 'missing') && (
                    <button
                        type="button"
                        onClick={() => setStatusFilter('all')}
                        className="btn-secondary text-xs px-4 py-2 mt-3 inline-flex items-center gap-2 font-semibold"
                    >
                        <span>{t('terminology.showAllItems', 'View All {count} Items', { count: activeGroupStats?.total || '' })}</span>
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="bg-sf-surface border border-sf-divider rounded-2xl overflow-hidden shadow-xs">
            <div className="divide-y divide-sf-divider">
                {items.map(item => {
                    const val = edits[item.key] !== undefined ? edits[item.key] : (item.value || '');
                    const isMissing = !(val || '').trim();
                    const rev = reviewStatuses[item.key] || (isMissing ? 'missing' : 'reviewed');

                    return (
                        <div
                            key={item.key}
                            className={`grid grid-cols-12 gap-4 p-4 hover:bg-sf-raised/40 transition-colors items-start ${
                                isMissing ? 'bg-amber-500/5' : ''
                            }`}
                        >
                            {/* Key & Tags Column */}
                            <div className="col-span-12 md:col-span-3 space-y-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <code className="text-xs font-mono font-bold text-sf-text break-all">
                                        {item.key}
                                    </code>
                                    {item.isDynamic && (
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-sans font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                            DB
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-[10px] font-mono text-sf-muted bg-sf-raised px-1.5 py-0.5 rounded">
                                        {item.module || 'general'}
                                    </span>
                                    {(item.tags || []).slice(0, 2).map(tag => (
                                        <span key={tag} className="text-[10px] text-sf-muted">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* English Baseline Column */}
                            <div className="col-span-12 md:col-span-4 space-y-1">
                                <div className="text-xs font-semibold text-sf-muted uppercase tracking-wider text-[10px]">
                                    {t('terminology.englishReference', 'English Reference')}
                                </div>
                                <div className="text-xs text-sf-text bg-sf-canvas p-2.5 rounded-xl border border-sf-divider leading-relaxed">
                                    {item.en || <span className="text-sf-muted italic">—</span>}
                                </div>
                            </div>

                            {/* Translation Input & Actions Column */}
                            <div className="col-span-12 md:col-span-5 space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-sf-muted uppercase tracking-wider text-[10px]">
                                        {selectedLanguage.name}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {isMissing ? (
                                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                                {t('terminology.statusMissing', 'Missing')}
                                            </span>
                                        ) : rev === 'needs_review' ? (
                                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                                {t('terminology.statusInReview', 'In Review')}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                                <Check size={11} /> {t('terminology.statusPublished', 'Published')}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => toggleReviewStatus(item.key)}
                                            disabled={isMissing}
                                            className="text-[11px] text-sf-primary hover:underline disabled:opacity-30 disabled:no-underline"
                                        >
                                            {rev === 'published' ? t('terminology.markReviewAction', 'Flag for Review') : t('terminology.approveAction', 'Approve')}
                                        </button>
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    value={val}
                                    onChange={(e) => handleChange(item.key, e.target.value)}
                                    placeholder={item.en || `Enter ${selectedLanguage.name} translation…`}
                                    className={`w-full px-3 py-2 text-xs rounded-xl border transition-colors outline-none bg-sf-surface text-sf-text ${
                                        isMissing
                                            ? 'border-amber-400/50 focus:ring-2 focus:ring-amber-400'
                                            : 'border-sf-divider focus:ring-2 focus:ring-sf-primary focus:border-transparent'
                                    }`}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Helper: Render Pagination Controls
function renderPagination(currentPage, totalPages, totalItems, setCurrentPage, t) {
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-between px-2 py-3 text-xs text-sf-muted">
            <div>
                {t('terminology.showingRange', 'Showing {start} to {end} of {total} items', {
                    start: (currentPage - 1) * ITEMS_PER_PAGE + 1,
                    end: Math.min(currentPage * ITEMS_PER_PAGE, totalItems),
                    total: totalItems
                })}
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
                >
                    {t('common.previous', 'Previous')}
                </button>
                <span className="font-semibold text-sf-text">
                    {currentPage} / {totalPages}
                </span>
                <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="btn-secondary text-xs py-1 px-3 disabled:opacity-40"
                >
                    {t('common.next', 'Next')}
                </button>
            </div>
        </div>
    );
}

export default TranslationEditor;
