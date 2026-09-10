import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Clock,
    Share2,
    Printer,
    ThumbsUp,
    ThumbsDown,
    Building2,
    CheckCircle2,
    ShieldAlert,
    AlertCircle,
    ChevronRight,
    Loader2,
    Check,
    WifiOff,
    Lock
} from 'lucide-react';
import helpClientService from '../../services/helpClientService';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import clsx from 'clsx';

export const ArticleReader = () => {
    const { articleId } = useParams();
    const { t, locale } = useLanguage();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorState, setErrorState] = useState(null);
    const [feedbackStatus, setFeedbackStatus] = useState(null);
    const [copied, setCopied] = useState(false);
    const [linkModalOpen, setLinkModalOpen] = useState(false);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setFeedbackStatus(null);
        setErrorState(null);
        setCopied(false);
        setArticle(null);

        helpClientService.getArticleById(articleId, { locale, user })
            .then(res => {
                if (!isMounted) return;
                if (res?.forbidden) {
                    setErrorState({ code: 403, message: res.error || t('help.accessDenied', 'Access denied to this guidance.') });
                    setArticle(null);
                } else if (res?.notFound || !res?.article) {
                    setErrorState({ code: 404, message: t('help.notFound', 'Article not found or not published.') });
                    setArticle(null);
                } else {
                    setArticle({
                        ...res.article,
                        isOffline: !!res.isOffline,
                        lastSync: res.lastSync
                    });
                }
            })
            .catch(err => {
                console.warn('[ARTICLE_READER] Failed to load article:', err.message);
                if (isMounted) {
                    setErrorState({ code: 500, message: err.message });
                    setArticle(null);
                }
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [articleId, locale, user, t]);

    // Handle feedback submission with truthful online / offline status
    const handleFeedback = (useful) => {
        if (!article) return;
        helpClientService.recordFeedback({
            articleId: article.id,
            revisionId: article.revisionId || article.revisionNumber || null,
            locale,
            useful,
            comment: '',
            category: article.category,
            user
        })
            .then(res => {
                if (res?.data?.offlineQueued) {
                    setFeedbackStatus(t('help.offlineFeedbackQueued', 'You are offline. Your feedback has been saved locally on this device and will be submitted when connection is restored.'));
                } else {
                    setFeedbackStatus(
                        useful
                            ? t('help.feedbackUseful', 'Thank you! Your feedback helps improve laboratory instructions. This action does not send records or personal data.')
                            : t('help.feedbackNotUseful', 'Thank you for letting us know. You can also contact your lab manager to report a wording issue.')
                    );
                }
            })
            .catch(err => {
                console.warn('[ARTICLE_READER] Feedback recording error:', err);
                setFeedbackStatus(t('help.feedbackError', 'Could not submit feedback at this time. Please try again later.'));
            });
    };

    const cleanArticleUrl = `${window.location.origin}/help/articles/${articleId}`;

    const handleCopyLink = () => {
        navigator.clipboard?.writeText(cleanArticleUrl);
        setCopied(true);
        setLinkModalOpen(true);
        setTimeout(() => setCopied(false), 3000);
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-sf-muted gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-sf-primary" />
                <span className="text-xs">{t('common.loading', 'Loading article...')}</span>
            </div>
        );
    }

    if (errorState?.code === 403) {
        return (
            <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
                    <Lock size={28} />
                </div>
                <h2 className="text-lg font-bold text-sf-text">{t('help.restrictedTitle', 'Restricted Operational Guidance')}</h2>
                <p className="text-xs text-sf-muted max-w-md mx-auto">
                    {errorState.message || t('help.restrictedBody', 'This article requires an authenticated account with appropriate laboratory privileges.')}
                </p>
                <Link to="/help" className="inline-flex items-center gap-1 text-xs font-bold text-sf-primary hover:underline">
                    <ArrowLeft size={14} />
                    <span>{t('help.centre', 'Return to Help Centre')}</span>
                </Link>
            </div>
        );
    }

    if (!article || errorState?.code === 404) {
        return (
            <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
                <AlertCircle size={40} className="mx-auto text-amber-500" />
                <h2 className="text-lg font-bold text-sf-text">{t('help.notFoundTitle', 'Article Not Found')}</h2>
                <p className="text-xs text-sf-muted">
                    {t('help.notFoundDesc', 'This article may not be published yet, or is not accessible in your current scope.')}
                </p>
                <Link to="/help" className="inline-flex items-center gap-1 text-xs font-bold text-sf-primary hover:underline">
                    <ArrowLeft size={14} />
                    <span>{t('help.centre', 'Return to Help Centre')}</span>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-sf-canvas pb-20">
            {/* Top Navigation & Breadcrumbs */}
            <div className="bg-sf-surface border-b border-sf-divider py-4 px-4 md:px-8">
                <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs text-sf-muted truncate">
                        <Link to="/help" className="hover:text-sf-primary transition-colors">
                            {t('help.centre', 'Help Centre')}
                        </Link>
                        <ChevronRight size={12} />
                        <Link to={`/help/topics/${article.category}`} className="hover:text-sf-primary transition-colors capitalize">
                            {t(`help.categories.${article.category}`, article.category)}
                        </Link>
                        <ChevronRight size={12} />
                        <span className="text-sf-text font-medium truncate">{article.title}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            data-act="article-link"
                            onClick={handleCopyLink}
                            className="p-2 rounded-xl text-sf-muted hover:text-sf-text hover:bg-sf-hover border border-sf-divider text-xs font-bold flex items-center gap-1.5 transition-colors"
                            title="Copy clean article link"
                        >
                            {copied ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} />}
                            <span className="hidden sm:inline">{t('help.share', 'Share')}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handlePrint}
                            className="p-2 rounded-xl text-sf-muted hover:text-sf-text hover:bg-sf-hover border border-sf-divider text-xs font-bold flex items-center gap-1.5 transition-colors"
                            title="Print guidance"
                        >
                            <Printer size={14} />
                            <span className="hidden sm:inline">{t('help.print', 'Print')}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Article Content */}
            <main className="max-w-3xl mx-auto px-4 md:px-8 py-8 space-y-8">
                {/* Offline Cached Notice */}
                {article.isOffline && (
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                        <WifiOff size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>{t('help.offlineNotice', 'Offline mode: reading locally synchronized copy.')}</span>
                    </div>
                )}

                {/* Fallback Notice for Unreviewed Translation */}
                {article.isFallback && (
                    <div className="hc-notice p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
                        <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <div>
                            <div className="font-bold mb-0.5">{t('help.translationNotice', 'Translation Notice')}</div>
                            <div>{article.localeNotice}</div>
                        </div>
                    </div>
                )}

                {/* Header info */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-sf-muted flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-sf-primary/10 text-sf-primary font-bold uppercase text-[10px]">
                            {article.kind}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {article.minutes} {t('help.minutesShort', 'min')}
                        </span>
                        <span>•</span>
                        <span>{t('help.reviewLead', 'Review lead')}: {article.reviewOwner}</span>
                    </div>

                    <h1 className="text-2xl md:text-3xl font-black text-sf-text tracking-tight">
                        {article.title}
                    </h1>

                    <p className="text-sm md:text-base text-sf-muted leading-relaxed font-medium hc-lead">
                        {article.summary}
                    </p>
                </div>

                {/* Numbered Steps */}
                {article.steps?.length > 0 && (
                    <section className="space-y-3">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-sf-muted">
                            {t('help.drawer.steps', 'Required Steps')}
                        </h2>
                        <ol className="space-y-3">
                            {article.steps.map((step, idx) => (
                                <li
                                    key={idx}
                                    className="p-4 rounded-2xl bg-sf-surface border border-sf-divider flex items-start gap-3 text-xs md:text-sm text-sf-text shadow-2xs"
                                >
                                    <span className="w-6 h-6 rounded-full bg-sf-primary/10 text-sf-primary font-black flex items-center justify-center shrink-0 text-xs mt-0.5">
                                        {idx + 1}
                                    </span>
                                    <span className="leading-relaxed">{step}</span>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}

                {/* Success Criteria */}
                {article.success && (
                    <section className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs md:text-sm flex items-start gap-3">
                        <CheckCircle2 size={20} className="shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                        <div className="space-y-1">
                            <div className="font-bold">{t('help.drawer.success', 'What success looks like')}</div>
                            <div className="leading-relaxed">{article.success}</div>
                        </div>
                    </section>
                )}

                {/* Precaution / Caution */}
                {article.caution && (
                    <section className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs md:text-sm flex items-start gap-3">
                        <ShieldAlert size={20} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <div className="space-y-1">
                            <div className="font-bold">{t('help.drawer.caution', 'Keep in mind')}</div>
                            <div className="leading-relaxed">{article.caution}</div>
                        </div>
                    </section>
                )}

                {/* Lab-Specific Local Guidance Note */}
                {article.labNote && (
                    <section className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-900 dark:text-blue-200 text-xs md:text-sm space-y-1">
                        <div className="flex items-center gap-2 font-bold">
                            <Building2 size={16} className="text-blue-600 dark:text-blue-400" />
                            <span>{t('help.localNote', "Your laboratory's guidance")}</span>
                        </div>
                        <div className="leading-relaxed text-sf-text">{article.labNote.noteText}</div>
                    </section>
                )}

                {/* Feedback Widget */}
                <div className="pt-6 border-t border-sf-divider space-y-3">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-sf-surface border border-sf-divider">
                        <span className="font-bold text-xs text-sf-text">
                            {t('help.feedbackPrompt', 'Was this guidance helpful?')}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                data-act="feedback-yes"
                                onClick={() => handleFeedback(true)}
                                className="px-3 py-1.5 rounded-xl border border-sf-divider hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-600 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                                <ThumbsUp size={13} />
                                <span>{t('help.yes', 'Yes')}</span>
                            </button>
                            <button
                                type="button"
                                data-act="feedback-no"
                                onClick={() => handleFeedback(false)}
                                className="px-3 py-1.5 rounded-xl border border-sf-divider hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-600 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                            >
                                <ThumbsDown size={13} />
                                <span>{t('help.no', 'No')}</span>
                            </button>
                        </div>
                    </div>

                    {feedbackStatus && (
                        <div id="hc-status" className="p-3 bg-sf-inset rounded-xl text-[11px] text-sf-muted text-center animate-fadeIn">
                            {feedbackStatus}
                        </div>
                    )}
                </div>

                {/* Related Articles */}
                {article.relatedArticles?.length > 0 && (
                    <div className="pt-4 border-t border-sf-divider space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-sf-muted">
                            {t('help.relatedGuidance', 'Related Guidance')}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 hc-article">
                            {article.relatedArticles.map(rel => (
                                <Link
                                    key={rel.id}
                                    to={`/help/articles/${rel.id}`}
                                    data-article={rel.id}
                                    className="p-3 rounded-xl bg-sf-surface border border-sf-divider hover:border-sf-primary/40 hover:bg-sf-hover transition-all group"
                                >
                                    <div className="font-bold text-xs text-sf-text group-hover:text-sf-primary transition-colors">
                                        {rel.title}
                                    </div>
                                    <div className="text-[11px] text-sf-muted line-clamp-1 mt-0.5">
                                        {rel.summary}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* Share Link Modal */}
            {linkModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
                    <div className="w-full max-w-sm bg-sf-surface border border-sf-divider rounded-2xl shadow-2xl p-5 space-y-3">
                        <div className="font-bold text-sm text-sf-text">{t('help.linkCopied', 'Article link copied')}</div>
                        <input
                            type="text"
                            readOnly
                            aria-label="Article link"
                            value={cleanArticleUrl}
                            className="w-full p-2.5 rounded-xl bg-sf-inset border border-sf-divider text-xs text-sf-text select-all"
                        />
                        <button
                            type="button"
                            onClick={() => setLinkModalOpen(false)}
                            className="w-full py-2 rounded-xl bg-sf-primary text-white text-xs font-bold"
                        >
                            {t('common.done', 'Done')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ArticleReader;
