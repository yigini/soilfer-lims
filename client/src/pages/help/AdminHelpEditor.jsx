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
    Eye,
    Trash2,
    ShieldCheck
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import clsx from 'clsx';

export const AdminHelpEditor = () => {
    const { user, hasPermission } = useAuth();
    const { t } = useLanguage();

    const canEditGlobal = user?.role === 'SUPER_ADMIN' || (hasPermission && hasPermission('HELP_EDIT_GLOBAL'));
    const canPublishGlobal = user?.role === 'SUPER_ADMIN' || (hasPermission && hasPermission('HELP_PUBLISH_GLOBAL'));
    const canEditLab = user?.role === 'SUPER_ADMIN' || user?.role === 'LAB_MANAGER' || (hasPermission && hasPermission('HELP_EDIT_LAB'));
    const isAuthorized = canEditGlobal || canPublishGlobal || canEditLab;

    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchFilter, setSearchFilter] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Structured Editing State
    const [activeArticle, setActiveArticle] = useState(null);
    const [editScope, setEditScope] = useState(canEditGlobal ? 'global' : 'lab');
    const [editTitle, setEditTitle] = useState('');
    const [editSummary, setEditSummary] = useState('');
    const [editSteps, setEditSteps] = useState([]);
    const [editSuccess, setEditSuccess] = useState('');
    const [editCaution, setEditCaution] = useState('');
    const [editChangeReason, setEditChangeReason] = useState('');
    const [labNoteText, setLabNoteText] = useState('');
    const [currentReviewStatus, setCurrentReviewStatus] = useState('EDITORIAL_DRAFT');
    const [saveStatus, setSaveStatus] = useState(null);
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
        setEditScope(canEditGlobal ? 'global' : 'lab');
        setEditTitle(article.title || '');
        setEditSummary(article.summary || '');
        setEditSteps(Array.isArray(article.steps) ? [...article.steps] : []);
        setEditSuccess(article.success || '');
        setEditCaution(article.caution || '');
        setEditChangeReason('');
        setLabNoteText(article.labNote?.noteText || '');
        setCurrentReviewStatus(article.locales?.en || 'EDITORIAL_DRAFT');
        setSaveStatus(null);
    };

    const handleSaveDraft = async (e) => {
        e?.preventDefault();
        if (!activeArticle) return;
        setIsSaving(true);
        setSaveStatus(null);

        try {
            if (editScope === 'lab') {
                await axios.put(`/api/help/admin/articles/${activeArticle.id}/lab-note`, {
                    noteText: labNoteText,
                    isActive: true
                });
                setSaveStatus({ error: false, message: 'Laboratory note saved successfully.' });
                fetchArticles();
            } else {
                const cleanedSteps = editSteps.filter(s => typeof s === 'string' && s.trim());
                await axios.post(`/api/help/admin/articles/${activeArticle.id}/revisions`, {
                    expectedRevisionNumber: activeArticle.latestRevisionNumber,
                    title: editTitle,
                    summary: editSummary,
                    steps: cleanedSteps,
                    success: editSuccess,
                    caution: editCaution,
                    changeReason: editChangeReason || 'Updated draft revision'
                });
                setCurrentReviewStatus('EDITORIAL_DRAFT');
                setSaveStatus({
                    error: false,
                    message: 'Draft revision created. Changes remain unpublished until approved.'
                });
                fetchArticles();
            }
        } catch (err) {
            setSaveStatus({
                error: true,
                message: err.response?.data?.message || err.response?.data?.error || 'Failed to save draft revision.'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleRequestReview = async () => {
        if (!activeArticle) return;
        setIsSaving(true);
        setSaveStatus(null);
        try {
            await axios.post(`/api/help/admin/articles/${activeArticle.id}/request-review`, {
                revisionNumber: activeArticle.latestRevisionNumber,
                locales: ['en']
            });
            setCurrentReviewStatus('IN_REVIEW');
            setSaveStatus({
                error: false,
                message: 'Revision submitted for scientific & language review (status: IN_REVIEW).'
            });
            fetchArticles();
        } catch (err) {
            setSaveStatus({
                error: true,
                message: err.response?.data?.message || err.response?.data?.error || 'Failed to submit review request.'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleApprove = async () => {
        if (!activeArticle) return;
        setIsSaving(true);
        setSaveStatus(null);
        try {
            await axios.post(`/api/help/admin/articles/${activeArticle.id}/approve`, {
                revisionNumber: activeArticle.latestRevisionNumber,
                locale: 'en'
            });
            setCurrentReviewStatus('APPROVED');
            setSaveStatus({
                error: false,
                message: 'Revision approved for publication (status: APPROVED).'
            });
            fetchArticles();
        } catch (err) {
            setSaveStatus({
                error: true,
                message: err.response?.data?.message || err.response?.data?.error || 'Failed to approve revision.'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handlePublish = async () => {
        if (!activeArticle) return;
        setIsSaving(true);
        setSaveStatus(null);
        try {
            await axios.post(`/api/help/admin/articles/${activeArticle.id}/publish`, {
                revisionNumber: activeArticle.latestRevisionNumber || 1,
                approvedLocales: ['en']
            });
            setCurrentReviewStatus('PUBLISHED');
            setSaveStatus({
                error: false,
                message: 'Article revision published atomically.'
            });
            fetchArticles();
        } catch (err) {
            setSaveStatus({
                error: true,
                message: err.response?.data?.message || err.response?.data?.error || 'Publication failed.'
            });
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
                    <div className="w-full max-w-3xl bg-sf-surface border border-sf-divider rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                        {/* Header with real revision & review status */}
                        <div className="flex items-start justify-between border-b border-sf-divider pb-3">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-sf-primary uppercase font-mono">{activeArticle.id}</span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sf-inset text-sf-muted">
                                        Rev {activeArticle.latestRevisionNumber || 1}
                                    </span>
                                    <span className={clsx(
                                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                        currentReviewStatus === 'APPROVED' ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" :
                                        currentReviewStatus === 'IN_REVIEW' ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" :
                                        currentReviewStatus === 'PUBLISHED' ? "bg-blue-500/20 text-blue-700 dark:text-blue-300" :
                                        "bg-sf-inset text-sf-muted"
                                    )}>
                                        {currentReviewStatus === 'APPROVED' ? 'Approved' :
                                         currentReviewStatus === 'IN_REVIEW' ? 'In Review' :
                                         currentReviewStatus === 'PUBLISHED' ? 'Published' : 'Editorial Draft'}
                                    </span>
                                </div>
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
                                {canEditGlobal && <option value="global">Global Article Guidance (v{activeArticle.latestRevisionNumber || 1})</option>}
                                {canEditLab && <option value="lab">Laboratory-Local SOP Note ({user?.labId || 'Default Lab'})</option>}
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
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-sf-text">Article Title</label>
                                    <input
                                        type="text"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        placeholder="Article title..."
                                        className="w-full p-2.5 rounded-xl bg-sf-inset border border-sf-divider text-xs text-sf-text font-semibold focus:ring-2 focus:ring-sf-primary"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-sf-text">Summary Guidance</label>
                                    <textarea
                                        id="hc-edit-body"
                                        rows={3}
                                        value={editSummary}
                                        onChange={(e) => setEditSummary(e.target.value)}
                                        placeholder="Brief overview explaining what this task accomplishes..."
                                        className="w-full p-3 rounded-xl bg-sf-inset border border-sf-divider text-xs text-sf-text focus:ring-2 focus:ring-sf-primary"
                                    />
                                </div>

                                {/* Structured Procedure Steps */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-sf-text">
                                            Procedure Steps ({editSteps.length})
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setEditSteps(prev => [...prev, ''])}
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-sf-primary hover:underline"
                                        >
                                            <Plus size={13} />
                                            <span>Add Step</span>
                                        </button>
                                    </div>
                                    {editSteps.map((step, idx) => (
                                        <div key={idx} className="flex items-start gap-2">
                                            <span className="w-6 h-6 rounded-full bg-sf-inset border border-sf-divider text-[11px] font-bold flex items-center justify-center shrink-0 mt-1">
                                                {idx + 1}
                                            </span>
                                            <textarea
                                                rows={2}
                                                value={step}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setEditSteps(prev => {
                                                        const next = [...prev];
                                                        next[idx] = val;
                                                        return next;
                                                    });
                                                }}
                                                placeholder={`Step ${idx + 1} instructions...`}
                                                className="flex-1 p-2 rounded-xl bg-sf-inset border border-sf-divider text-xs text-sf-text focus:ring-2 focus:ring-sf-primary"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setEditSteps(prev => prev.filter((_, i) => i !== idx))}
                                                className="p-1.5 rounded-lg text-sf-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors mt-1"
                                                title="Remove step"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-sf-text">Success Criteria</label>
                                        <textarea
                                            rows={2}
                                            value={editSuccess}
                                            onChange={(e) => setEditSuccess(e.target.value)}
                                            placeholder="What does success look like..."
                                            className="w-full p-2.5 rounded-xl bg-sf-inset border border-sf-divider text-xs text-sf-text focus:ring-2 focus:ring-sf-primary"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-sf-text">Precaution / Caution</label>
                                        <textarea
                                            rows={2}
                                            value={editCaution}
                                            onChange={(e) => setEditCaution(e.target.value)}
                                            placeholder="Critical warnings or tips to keep in mind..."
                                            className="w-full p-2.5 rounded-xl bg-sf-inset border border-sf-divider text-xs text-sf-text focus:ring-2 focus:ring-sf-primary"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-sf-text">Change Reason</label>
                                    <input
                                        type="text"
                                        value={editChangeReason}
                                        onChange={(e) => setEditChangeReason(e.target.value)}
                                        placeholder="Why is this revision being updated (e.g., ISO method adjustment)..."
                                        className="w-full p-2 rounded-xl bg-sf-inset border border-sf-divider text-xs text-sf-text focus:ring-2 focus:ring-sf-primary"
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

                        {/* Action Buttons with Real Governance Workflow */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-sf-divider">
                            <button
                                type="button"
                                onClick={() => setActiveArticle(null)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-sf-muted hover:text-sf-text"
                            >
                                Close
                            </button>

                            <div className="flex flex-wrap items-center gap-2">
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

                                {editScope === 'global' && canEditGlobal && (
                                    <button
                                        type="button"
                                        data-act="editor-review"
                                        disabled={currentReviewStatus === 'IN_REVIEW' || currentReviewStatus === 'APPROVED' || isSaving}
                                        onClick={handleRequestReview}
                                        className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                                        title={currentReviewStatus === 'IN_REVIEW' ? 'Already in review' : 'Submit for review'}
                                    >
                                        <Send size={14} />
                                        <span>{t('help.requestReview', 'Request review')}</span>
                                    </button>
                                )}

                                {editScope === 'global' && canPublishGlobal && (
                                    <>
                                        <button
                                            type="button"
                                            data-act="editor-approve"
                                            disabled={currentReviewStatus !== 'IN_REVIEW' || isSaving}
                                            onClick={handleApprove}
                                            className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                                            title="Approve revision after scientific review"
                                        >
                                            <ShieldCheck size={14} />
                                            <span>Approve Revision</span>
                                        </button>

                                        <button
                                            type="button"
                                            data-act="editor-publish"
                                            disabled={currentReviewStatus !== 'APPROVED' || isSaving}
                                            onClick={handlePublish}
                                            className="px-4 py-2 rounded-xl bg-sf-primary text-white text-xs font-bold hover:bg-sf-primary/90 disabled:opacity-40 flex items-center gap-1.5"
                                            title={currentReviewStatus !== 'APPROVED' ? 'Requires approval before publication' : 'Publish atomically to production'}
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
