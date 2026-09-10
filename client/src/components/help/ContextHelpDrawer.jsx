import React, { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    X,
    ArrowLeft,
    HelpCircle,
    AlertCircle,
    FileText,
    ExternalLink,
    Clock,
    ChevronRight,
    Loader2,
    Building2,
    CheckCircle2,
    ShieldAlert
} from 'lucide-react';
import axios from 'axios';
import { useHelp } from '../../context/HelpContext';
import { useLanguage } from '../../context/LanguageContext';
import clsx from 'clsx';

export const ContextHelpDrawer = () => {
    const {
        isDrawerOpen,
        drawerArticleId,
        activeBlockers,
        closeDrawer,
        drillDownArticle,
        navigateBackInDrawer
    } = useHelp();

    const { t, locale } = useLanguage();
    const location = useLocation();

    const [contextData, setContextData] = useState(null);
    const [articleData, setArticleData] = useState(null);
    const [loadingContext, setLoadingContext] = useState(false);
    const [loadingArticle, setLoadingArticle] = useState(false);
    const drawerRef = useRef(null);

    // Escape key listener to close drawer
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isDrawerOpen) {
                closeDrawer();
            }
        };
        if (isDrawerOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isDrawerOpen, closeDrawer]);

    // Fetch page contextual help when opened or route/blockers change
    useEffect(() => {
        if (!isDrawerOpen) return;

        let isMounted = true;
        setLoadingContext(true);

        axios.get('/api/help/context', {
            params: {
                route: location.pathname,
                blockers: activeBlockers.length > 0 ? JSON.stringify(activeBlockers) : undefined,
                locale
            }
        })
            .then(res => {
                if (isMounted && res.data?.success) {
                    setContextData(res.data);
                }
            })
            .catch(err => {
                console.warn('[CONTEXT_HELP] Failed to load context:', err.message);
            })
            .finally(() => {
                if (isMounted) setLoadingContext(false);
            });

        return () => { isMounted = false; };
    }, [isDrawerOpen, location.pathname, activeBlockers, locale]);

    // Fetch single article if drilled down inside drawer
    useEffect(() => {
        if (!isDrawerOpen || !drawerArticleId) {
            setArticleData(null);
            return;
        }

        let isMounted = true;
        setLoadingArticle(true);

        axios.get(`/api/help/articles/${drawerArticleId}`, { params: { locale } })
            .then(res => {
                if (isMounted && res.data?.success) {
                    setArticleData(res.data.article);
                }
            })
            .catch(err => {
                console.warn('[CONTEXT_HELP] Failed to load article:', err.message);
            })
            .finally(() => {
                if (isMounted) setLoadingArticle(false);
            });

        return () => { isMounted = false; };
    }, [isDrawerOpen, drawerArticleId, locale]);

    if (!isDrawerOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 animate-fadeIn"
                onClick={closeDrawer}
                aria-hidden="true"
            />

            {/* Slide-out Panel */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                <div
                    ref={drawerRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="context-help-title"
                    className="w-screen max-w-md bg-sf-surface border-l border-sf-divider shadow-2xl flex flex-col transition-transform duration-300 animate-slideLeft"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-sf-divider bg-sf-canvas flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {drawerArticleId ? (
                                <button
                                    type="button"
                                    onClick={navigateBackInDrawer}
                                    className="p-1.5 rounded-lg text-sf-muted hover:text-sf-text hover:bg-sf-hover transition-colors"
                                    aria-label="Back to page help"
                                >
                                    <ArrowLeft size={18} />
                                </button>
                            ) : (
                                <div className="p-1.5 rounded-lg bg-sf-primary/10 text-sf-primary">
                                    <HelpCircle size={18} />
                                </div>
                            )}
                            <h2 id="context-help-title" className="font-bold text-sm text-sf-text truncate">
                                {drawerArticleId ? t('help.guides', 'Task guide') : t('help.context', 'Help with this page')}
                            </h2>
                        </div>

                        <button
                            type="button"
                            onClick={closeDrawer}
                            className="p-1.5 rounded-lg text-sf-muted hover:text-sf-text hover:bg-sf-hover transition-colors"
                            aria-label={t('help.close', 'Close help')}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Body Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {drawerArticleId ? (
                            /* In-drawer Article Reader */
                            loadingArticle ? (
                                <div className="flex flex-col items-center justify-center py-12 text-sf-muted gap-2">
                                    <Loader2 className="w-6 h-6 animate-spin text-sf-primary" />
                                    <span className="text-xs">{t('common.loading', 'Loading...')}</span>
                                </div>
                            ) : articleData ? (
                                <div className="space-y-4 animate-fadeIn">
                                    {articleData.isFallback && (
                                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
                                            <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                            <span>{articleData.localeNotice}</span>
                                        </div>
                                    )}

                                    <div>
                                        <div className="flex items-center gap-2 text-xs text-sf-muted mb-1">
                                            <span className="capitalize font-medium">{articleData.kind}</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} />
                                                {articleData.minutes} min
                                            </span>
                                        </div>
                                        <h3 className="text-base font-black text-sf-text leading-snug">
                                            {articleData.title}
                                        </h3>
                                        <p className="text-xs text-sf-muted mt-1 leading-relaxed">
                                            {articleData.summary}
                                        </p>
                                    </div>

                                    {/* Action Steps */}
                                    {articleData.steps?.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="text-[11px] font-bold uppercase tracking-wider text-sf-muted">
                                                Required Steps
                                            </div>
                                            <ol className="space-y-2">
                                                {articleData.steps.map((step, idx) => (
                                                    <li key={idx} className="flex items-start gap-2 text-xs text-sf-text bg-sf-inset p-2.5 rounded-lg border border-sf-divider/50">
                                                        <span className="w-5 h-5 rounded-full bg-sf-primary/10 text-sf-primary font-bold flex items-center justify-center shrink-0 text-[11px]">
                                                            {idx + 1}
                                                        </span>
                                                        <span className="flex-1 leading-relaxed">{step}</span>
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}

                                    {/* Success Criteria */}
                                    {articleData.success && (
                                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2">
                                            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                                            <div>
                                                <div className="font-bold mb-0.5">What success looks like</div>
                                                <div className="leading-relaxed">{articleData.success}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Precaution */}
                                    {articleData.caution && (
                                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                                            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                                            <div>
                                                <div className="font-bold mb-0.5">Keep in mind</div>
                                                <div className="leading-relaxed">{articleData.caution}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Lab Local Note */}
                                    {articleData.labNote && (
                                        <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-900 dark:text-blue-300 text-xs">
                                            <div className="flex items-center gap-1.5 font-bold mb-1">
                                                <Building2 size={14} />
                                                <span>{t('help.localNote', "Your laboratory's guidance")}</span>
                                            </div>
                                            <div className="leading-relaxed">{articleData.labNote.noteText}</div>
                                        </div>
                                    )}

                                    {/* Full Article Link */}
                                    <div className="pt-2">
                                        <Link
                                            to={`/help/articles/${articleData.id}`}
                                            onClick={closeDrawer}
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-sf-surface border border-sf-divider hover:bg-sf-hover text-sf-text text-xs font-bold transition-colors"
                                        >
                                            <span>Open full article page</span>
                                            <ExternalLink size={14} />
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-sf-muted text-xs">
                                    Article could not be loaded.
                                </div>
                            )
                        ) : (
                            /* Default Page Context View */
                            loadingContext ? (
                                <div className="flex flex-col items-center justify-center py-12 text-sf-muted gap-2">
                                    <Loader2 className="w-6 h-6 animate-spin text-sf-primary" />
                                    <span className="text-xs">{t('common.loading', 'Loading guidance...')}</span>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-fadeIn">
                                    {/* Active Blockers Alert */}
                                    {contextData?.blockers?.length > 0 && (
                                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-900 dark:text-amber-200 space-y-2">
                                            <div className="flex items-center gap-2 font-bold text-xs">
                                                <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                                <span>Active Blocker Detected</span>
                                            </div>
                                            <p className="text-[11px] leading-relaxed">
                                                One or more conditions are preventing this work item from proceeding. Click below to inspect resolution guidance:
                                            </p>
                                            <div className="space-y-1.5 pt-1">
                                                {contextData.blockers.map(b => (
                                                    <button
                                                        key={b.code}
                                                        type="button"
                                                        onClick={() => drillDownArticle(b.articleId)}
                                                        className="w-full flex items-center justify-between p-2 rounded-lg bg-sf-surface border border-amber-500/30 text-left hover:bg-amber-500/5 transition-colors text-xs font-semibold"
                                                    >
                                                        <span className="truncate">{b.code.replace(/_/g, ' ')}</span>
                                                        <ChevronRight size={14} className="text-sf-muted shrink-0" />
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Recommended Articles for this page */}
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-sf-muted">
                                            Recommended for this task
                                        </div>

                                        {contextData?.articles?.length > 0 ? (
                                            <div className="space-y-2">
                                                {contextData.articles.map(article => (
                                                    <button
                                                        key={article.id}
                                                        type="button"
                                                        onClick={() => drillDownArticle(article.id)}
                                                        className="w-full text-left p-3 rounded-xl border border-sf-divider bg-sf-surface hover:bg-sf-hover hover:border-sf-primary/40 transition-all group"
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="font-bold text-xs text-sf-text group-hover:text-sf-primary transition-colors line-clamp-1">
                                                                {article.title}
                                                            </div>
                                                            <ChevronRight size={14} className="text-sf-muted group-hover:text-sf-primary transition-colors shrink-0 mt-0.5" />
                                                        </div>
                                                        <p className="text-[11px] text-sf-muted line-clamp-2 mt-1 leading-relaxed">
                                                            {article.summary}
                                                        </p>
                                                        {article.labNote && (
                                                            <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                                                <Building2 size={12} />
                                                                <span>Includes lab-specific guidance</span>
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-sf-muted p-3 bg-sf-inset rounded-xl">
                                                {t('help.zero', 'No specific guidance for this section.')}
                                            </div>
                                        )}
                                    </div>

                                    {/* Quick Explore Links */}
                                    <div className="pt-2 border-t border-sf-divider space-y-2">
                                        <Link
                                            to="/help"
                                            onClick={closeDrawer}
                                            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-sf-inset hover:bg-sf-hover text-sf-text text-xs font-medium transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <FileText size={16} className="text-sf-primary" />
                                                <span>{t('help.centre', 'Browse Help Centre')}</span>
                                            </div>
                                            <ChevronRight size={14} className="text-sf-muted" />
                                        </Link>

                                        <Link
                                            to="/help/faq"
                                            onClick={closeDrawer}
                                            className="w-full flex items-center justify-between p-2.5 rounded-xl bg-sf-inset hover:bg-sf-hover text-sf-text text-xs font-medium transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <HelpCircle size={16} className="text-sf-primary" />
                                                <span>{t('help.faq', 'Common questions (FAQs)')}</span>
                                            </div>
                                            <ChevronRight size={14} className="text-sf-muted" />
                                        </Link>
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-sf-divider bg-sf-canvas flex items-center justify-between text-xs text-sf-muted">
                        <span>SoilFER Knowledge Base</span>
                        <Link
                            to="/help"
                            onClick={closeDrawer}
                            className="text-sf-primary font-bold hover:underline"
                        >
                            {t('help.searchAll', 'Search all help')}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContextHelpDrawer;
