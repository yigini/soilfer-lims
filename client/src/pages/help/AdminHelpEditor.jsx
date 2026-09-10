import React, { useState, useEffect } from 'react';
import {
    FileEdit,
    Plus,
    Save,
    Send,
    CheckCircle2,
    AlertCircle,
    Building2,
    Globe,
    Lock,
    Search,
    RefreshCw,
    X,
    Loader2,
    Eye
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import clsx from 'clsx';

export const AdminHelpEditor = () => {
    const { user, hasPermission } = useAuth();
    const { t } = useLanguage();

    const isAuthorized = ['SUPER_ADMIN', 'LAB_MANAGER', 'MASTER_USER'].includes(user?.role);
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';

    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchFilter, setSearchFilter] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Editing Modal / Pane State
    const [activeArticle, setActiveArticle] = useState(null);
    const [editScope, setEditScope] = useState(isSuperAdmin ? 'global' : 'lab');
    const [editBody, setEditBody] = useState('');
    const [editCaution, setEditCaution] = useState('');
    const [editSuccess, setEditSuccess] = useState('');
    const [labNoteText, setLabNoteText] = useState('');
    const [saveStatus, setSaveStatus] = useState(null);
    const [inReview, setInReview] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const fetchArticles = () => {
        setLoading(true);
        axios.get('/api/help/admin/articles')
            .then(res => {
                if (res.data?.success) {
                    setArticles(res.data.articles || []);
                }
            })
            .catch(err => {
                console.warn('[ADMIN_HELP] Failed to load articles:', err.message);
            })
            .finally(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        if (isAuthorized) {
            fetchArticles();
        }
    }, [isAuthorized]);

    if (!isAuthorized) {
        return (
            <div id="hc-content" className="max-w-2xl mx-auto py-20 px-4 text-center space-y-4">
                <Lock size={48} className="mx-auto text-sf-muted" />
                <h1 className="text-xl font-black text-sf-text">Restricted Access</h1>
                <p className="text-xs text-sf-muted">
                    This section is reserved for authorized editors and laboratory managers.
                </p>
            </div>
        );
    }

    const openEditor = (article) => {
        setActiveArticle(article);
        setEditScope(isSuperAdmin ? 'global' : 'lab');
        setEditBody(article.summary || '');
        setLabNoteText(article.labNote?.noteText || '');
        setSaveStatus(null);
        setInReview(false);
    };

    const handleSaveDraft = async (e) => {
        e?.preventDefault();
        if (!activeArticle) return;
        setIsSaving(true);
        setSaveStatus(null);

        try {
            if (editScope === 'lab') {
                const res = await axios.put(`/api/help/admin/articles/${activeArticle.id}/lab-note`, {
                    noteText: labNoteText,
                    isActive: true
                });
                setSaveStatus({ error: false, message: 'Laboratory note saved successfully.' });
                fetchArticles();
            } else {
                const res = await axios.post(`/api/help/admin/articles/${activeArticle.id}/revisions`, {
                    expectedRevisionNumber: activeArticle.latestRevisionNumber,
                    title: activeArticle.title,
                    summary: editBody,
                    steps: [],
                    success: editSuccess,
                    caution: editCaution,
                    changeReason: 'Admin draft update'
                });
                setSaveStatus({
                    error: false,
                    message: 'Draft revision saved. No published article was changed until approved.'
                });
                fetchArticles();
            }
        } catch (err) {
            setSaveStatus({
                error: true,
                message: err.response?.data?.message || 'Failed to save draft revision.'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRequestReview = () => {
        setInReview(true);
        setSaveStatus({
            error: false,
            message: 'Revision submitted for scientific & language review. Publication stays unavailable until approved.'
        });
    };

    const handlePublish = async () => {
        if (!activeArticle) return;
        setIsSaving(true);
        try {
            await axios.post(`/api/help/admin/articles/${activeArticle.id}/publish`, {
                revisionNumber: activeArticle.latestRevisionNumber || 1,
                approvedLocales: ['en']
            });
            setSaveStatus({ error: false, message: 'Article revision published atomically.' });
            fetchArticles();
        } catch (err) {
            setSaveStatus({ error: true, message: err.response?.data?.message || 'Publication failed.' });
        } finally {
            setIsSaving(false);
        }
    };

    const filtered = articles.filter(a => {
        if (selectedCategory !== 'all' && a.category !== selectedCategory) return false;
        if (!searchFilter.trim()) return true;
        const q = searchFilter.toLowerCase();
        return a.id.toLowerCase().includes(q) || a.title.toLowerCase().includes(q);
    });

    return (
        <div className="min-h-screen bg-sf-canvas pb-20 p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-sf-primary uppercase tracking-wider">
                            <FileEdit size={14} />
                            <span>Knowledge Base Administration</span>
                        </div>
                        <h1 className="text-2xl font-black text-sf-text mt-1">
                            Help Content Governance
                        </h1>
                        <p className="text-xs text-sf-muted">
                            Manage versioned task guides, review statuses, and laboratory-specific procedural notes.
                        </p>
                    </div>

                    <button
                        onClick={fetchArticles}
                        className="p-2 rounded-xl border border-sf-divider bg-sf-surface text-sf-muted hover:text-sf-text text-xs font-bold inline-flex items-center gap-1.5 self-start"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        <span>Refresh</span>
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sf-muted w-4 h-4" />
                        <input
                            type="text"
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            placeholder="Filter articles by title or slug..."
                            className="w-full pl-9 pr-4 py-2 rounded-xl bg-sf-surface border border-sf-divider text-xs text-sf-text focus:outline-none focus:ring-2 focus:ring-sf-primary"
                        />
                    </div>

                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-sf-surface border border-sf-divider text-xs text-sf-text focus:outline-none"
                    >
                        <option value="all">All Categories</option>
                        <option value="start">Getting started</option>
                        <option value="intake">Receiving samples</option>
                        <option value="bench">Working at the bench</option>
                        <option value="review">Review & reports</option>
                        <option value="assets">Equipment & stock</option>
                        <option value="offline">Mobile & offline</option>
                        <option value="connect">Projects & connections</option>
                        <option value="manage">Managing the laboratory</option>
                    </select>
                </div>

                {/* Articles Table */}
                <div className="bg-sf-surface border border-sf-divider rounded-2xl shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-sf-inset border-b border-sf-divider font-bold text-sf-muted uppercase text-[10px]">
                                <tr>
                                    <th className="p-3.5">Article</th>
                                    <th className="p-3.5">Category</th>
                                    <th className="p-3.5">Published Rev</th>
                                    <th className="p-3.5">Locales (EN/ES/LAT/FR/PT)</th>
                                    <th className="p-3.5">Lab Note</th>
                                    <th className="p-3.5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sf-divider">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="text-center py-12 text-sf-muted">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-sf-primary mb-2" />
                                            <span>Loading articles...</span>
                                        </td>
                                    </tr>
                                ) : filtered.length > 0 ? (
                                    filtered.map(art => (
                                        <tr key={art.id} className="hover:bg-sf-hover transition-colors">
                                            <td className="p-3.5">
                                                <div className="font-bold text-sf-text">{art.title}</div>
                                                <div className="text-[11px] text-sf-muted font-mono">{art.id}</div>
                                            </td>
                                            <td className="p-3.5">
                                                <span className="capitalize font-medium text-sf-muted">{art.category}</span>
                                            </td>
                                            <td className="p-3.5 font-mono">
                                                v{art.currentRevisionNumber || 1}
                                            </td>
                                            <td className="p-3.5">
                                                <div className="flex items-center gap-1">
                                                    {['en', 'es', 'es-419', 'fr', 'pt'].map(loc => {
                                                        const st = art.locales[loc];
                                                        const isApp = st === 'APPROVED';
                                                        const isRev = st === 'IN_REVIEW' || st === 'EDITORIAL_DRAFT';
                                                        return (
                                                            <span
                                                                key={loc}
                                                                title={`${loc}: ${st}`}
                                                                className={clsx(
                                                                    "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
                                                                    isApp ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" :
                                                                        isRev ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" :
                                                                            "bg-sf-inset text-sf-muted"
                                                                )}
                                                            >
                                                                {loc}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                            <td className="p-3.5">
                                                {art.labNote ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                                        <Building2 size={12} />
                                                        <span>Active</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-sf-muted">None</span>
                                                )}
                                            </td>
                                            <td className="p-3.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditor(art)}
                                                    className="px-3 py-1.5 rounded-lg bg-sf-primary/10 text-sf-primary hover:bg-sf-primary/20 text-xs font-bold transition-colors"
                                                >
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="text-center py-12 text-sf-muted">
                                            No articles match filter.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Editing Slide-Over / Modal */}
            {activeArticle && (
                <div id="hc-sideeditor" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
                    <div className="w-full max-w-2xl bg-sf-surface border border-sf-divider rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-sf-divider pb-3">
                            <div>
                                <span className="text-[10px] font-bold text-sf-primary uppercase font-mono">{activeArticle.id}</span>
                                <h2 className="text-base font-black text-sf-text">{activeArticle.title}</h2>
                            </div>
                            <button
                                onClick={() => setActiveArticle(null)}
                                className="p-1.5 rounded-lg text-sf-muted hover:text-sf-text"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Scope Selector */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-sf-muted">Editing Scope</label>
                            <select
                                id="hc-editor-scope"
                                value={editScope}
                                onChange={(e) => setEditScope(e.target.value)}
                                className="w-full p-2.5 rounded-xl bg-sf-inset border border-sf-divider text-xs text-sf-text"
                            >
                                {isSuperAdmin && <option value="global">Global Article Guidance</option>}
                                <option value="lab">Laboratory-Local SOP Note ({user?.labId || 'Default Lab'})</option>
                            </select>
                        </div>

                        {/* Editor Form */}
                        {editScope === 'lab' ? (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-sf-text">
                                    Laboratory-Local Note (visible only to staff in {user?.labId || 'your lab'})
                                </label>
                                <textarea
                                    rows={5}
                                    value={labNoteText}
                                    onChange={(e) => setLabNoteText(e.target.value)}
                                    placeholder="Add specific local bench locations, contact details, or local preparation instructions..."
                                    className="w-full p-3 rounded-xl bg-sf-inset border border-sf-divider text-xs text-sf-text focus:ring-2 focus:ring-sf-primary"
                                />
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-sf-text">Summary Guidance</label>
                                    <textarea
                                        id="hc-edit-body"
                                        rows={4}
                                        value={editBody}
                                        onChange={(e) => {
                                            setEditBody(e.target.value);
                                            setInReview(false);
                                        }}
                                        className="w-full p-3 rounded-xl bg-sf-inset border border-sf-divider text-xs text-sf-text focus:ring-2 focus:ring-sf-primary"
                                    />
                                </div>
                            </div>
                        )}

                        {saveStatus && (
                            <div
                                id="hc-status"
                                className={clsx(
                                    "p-3 rounded-xl text-xs flex items-start gap-2",
                                    saveStatus.error
                                        ? "bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300"
                                        : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                                )}
                            >
                                {saveStatus.error ? <AlertCircle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
                                <span>{saveStatus.message}</span>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-3 border-t border-sf-divider">
                            <button
                                type="button"
                                onClick={() => setActiveArticle(null)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-sf-muted hover:text-sf-text"
                            >
                                Close
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    data-act="editor-save"
                                    onClick={handleSaveDraft}
                                    disabled={isSaving}
                                    className="px-4 py-2 rounded-xl bg-sf-surface border border-sf-divider hover:bg-sf-hover text-sf-text text-xs font-bold flex items-center gap-1.5 transition-colors"
                                >
                                    <Save size={14} />
                                    <span>{t('help.saveDraft', 'Save draft')}</span>
                                </button>

                                {editScope === 'global' && isSuperAdmin && (
                                    <>
                                        <button
                                            type="button"
                                            data-act="editor-review"
                                            disabled={inReview || isSaving}
                                            onClick={handleRequestReview}
                                            className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                                        >
                                            <Send size={14} />
                                            <span>{t('help.requestReview', 'Request review')}</span>
                                        </button>

                                        <button
                                            type="button"
                                            data-act="editor-publish"
                                            disabled={!inReview || isSaving}
                                            onClick={handlePublish}
                                            className="px-4 py-2 rounded-xl bg-sf-primary text-white text-xs font-bold hover:bg-sf-primary/90 disabled:opacity-40 flex items-center gap-1.5"
                                        >
                                            <CheckCircle2 size={14} />
                                            <span>{t('help.publish', 'Publish revision')}</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminHelpEditor;
