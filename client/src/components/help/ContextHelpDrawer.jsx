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
    ShieldAlert,
    WifiOff,
    FileEdit,
    RefreshCw,
    Globe,
    UserCheck,
    Eye
} from 'lucide-react';
import { useHelp } from '../../context/HelpContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import helpClientService from '../../services/helpClientService';
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
    const { user } = useAuth();
    const location = useLocation();

    const [contextData, setContextData] = useState(null);
    const [articleData, setArticleData] = useState(null);
    const [loadingContext, setLoadingContext] = useState(false);
    const [loadingArticle, setLoadingArticle] = useState(false);
    const [isDesktop, setIsDesktop] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 768 : true));

    const drawerRef = useRef(null);
    const closeBtnRef = useRef(null);
    const previouslyFocusedElement = useRef(null);

    // Responsive screen width listener
    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Escape key listener and focus management
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isDrawerOpen) {
                closeDrawer();
            }
        };

        if (isDrawerOpen) {
            document.addEventListener('keydown', handleKeyDown);
            previouslyFocusedElement.current = document.activeElement;
            if (!isDesktop) {
                // Focus close button on mobile entry
                setTimeout(() => {
                    closeBtnRef.current?.focus();
                }, 50);
            }
        } else {
            // Restore focus when drawer closes
            if (previouslyFocusedElement.current && typeof previouslyFocusedElement.current.focus === 'function') {
                previouslyFocusedElement.current.focus();
                previouslyFocusedElement.current = null;
            }
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isDrawerOpen, isDesktop, closeDrawer]);

    // Focus trap on mobile
    const handleDrawerKeyDown = (e) => {
        if (isDesktop || !isDrawerOpen) return;
        if (e.key === 'Tab') {
            const focusable = drawerRef.current?.querySelectorAll(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (!focusable || focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    last.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === last) {
                    first.focus();
                    e.preventDefault();
                }
            }
        }
    };

    const loadContext = () => {
        setLoadingContext(true);
        helpClientService.getContextHelp({
            route: location.pathname,
            blockerCodes: activeBlockers,
            blockers: activeBlockers,
            locale,
            user
        })
            .then(data => {
                if (data) {
                    setContextData(data);
                }
            })
            .catch(err => {
                console.warn('[CONTEXT_HELP] Failed to load context:', err.message);
                setContextData({
                    route: location.pathname,
                    availability: 'REQUEST_FAILURE',
                    error: err.message,
                    blockers: [],
                    articles: []
                });
            })
            .finally(() => {
                setLoadingContext(false);
            });
    };

    // Fetch page contextual help when opened or route/blockers change (network-first with offline IndexedDB fallback)
    useEffect(() => {
        if (!isDrawerOpen) return;
        loadContext();
    }, [isDrawerOpen, location.pathname, activeBlockers, locale, user]);

    // Fetch single article if drilled down inside drawer
    useEffect(() => {
        if (!isDrawerOpen || !drawerArticleId) {
            setArticleData(null);
            return;
        }

        let isMounted = true;
        setLoadingArticle(true);

        helpClientService.getArticleById(drawerArticleId, { locale, user })
            .then(res => {
                if (isMounted) {
                    const art = res?.article || (res?.id ? res : null);
                    setArticleData(art);
                }
            })
            .catch(err => {
                console.warn('[CONTEXT_HELP] Failed to load article:', err.message);
            })
            .finally(() => {
                if (isMounted) setLoadingArticle(false);
            });

        return () => { isMounted = false; };
    }, [isDrawerOpen, drawerArticleId, locale, user]);

    const renderEmptyState = () => {
        const availability = contextData?.availability || 'NO_PAGE_GUIDE';

        if (availability === 'MAPPED_UNPUBLISHED_EDITOR') {
            return (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-3 text-center">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                        <FileText size={16} />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-sf-text mb-1">
                            {t('help.drawer.unPublishedTitle', 'Guidance in Review')}
                        </div>
                        <p className="text-xs text-sf-muted leading-relaxed">
                            {t('help.drawer.unPublishedEditorBody', 'This page is mapped to workflow guides, but they have not been published yet.')}
                        </p>
                    </div>
                    <Link
                        to="/admin/help"
                        onClick={closeDrawer}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-sf-primary text-white font-bold text-xs hover:bg-sf-primary/90 transition-colors shadow-sm"
                    >
                        <FileEdit size={14} />
                        <span>{t('help.drawer.openEditor', 'Review Drafts in Admin Editor')}</span>
                    </Link>
                </div>
            );
        }

        if (availability === 'MAPPED_UNPUBLISHED') {
            return (
                <div className="p-4 rounded-xl bg-sf-surface border border-sf-divider text-xs space-y-2 text-center">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                        <Clock size={16} />
                    </div>
                    <div className="font-bold text-sm text-sf-text">
                        {t('help.drawer.inReviewTitle', 'Guidance Coming Soon')}
                    </div>
                    <p className="text-xs text-sf-muted leading-relaxed">
                        {t('help.drawer.inReviewBody', 'Guidance for this page is currently undergoing editorial review and has not yet been published.')}
                    </p>
                    <div className="pt-2">
                        <Link
                            to="/help"
                            onClick={closeDrawer}
                            className="text-xs font-bold text-sf-primary hover:underline inline-flex items-center gap-1"
                        >
                            <span>{t('help.drawer.browseGeneral', 'Browse Help Centre')}</span>
                            <ExternalLink size={12} />
                        </Link>
                    </div>
                </div>
            );
        }

        if (availability === 'AUTH_REQUIRED') {
            return (
                <div className="p-4 rounded-xl bg-sf-surface border border-sf-divider text-xs space-y-2 text-center">
                    <div className="w-8 h-8 rounded-full bg-slate-500/10 text-sf-muted flex items-center justify-center mx-auto">
                        <ShieldAlert size={16} />
                    </div>
                    <div className="font-bold text-sm text-sf-text">
                        {t('help.drawer.authRequiredTitle', 'Authentication Required')}
                    </div>
                    <p className="text-xs text-sf-muted leading-relaxed">
                        {t('help.drawer.authRequiredBody', 'Please sign in to access laboratory procedures and workbench guidance.')}
                    </p>
                    <div className="pt-2">
                        <Link
                            to="/login"
                            onClick={closeDrawer}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-sf-primary text-white font-bold text-xs"
                        >
                            <span>{t('auth.login', 'Sign In')}</span>
                        </Link>
                    </div>
                </div>
            );
        }

        if (availability === 'MISSING_OFFLINE_PACK') {
            return (
                <div className="p-4 rounded-xl bg-sf-surface border border-sf-divider text-xs space-y-2 text-center">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
                        <WifiOff size={16} />
                    </div>
                    <div className="font-bold text-sm text-sf-text">
                        {t('help.drawer.missingPackTitle', 'Offline Pack Not Downloaded')}
                    </div>
                    <p className="text-xs text-sf-muted leading-relaxed">
                        {t('help.drawer.missingPackBody', 'You are offline and no offline help pack has been downloaded for this laboratory.')}
                    </p>
                </div>
            );
        }

        if (availability === 'REQUEST_FAILURE') {
            return (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-900 dark:text-red-200 text-xs space-y-3 text-center">
                    <div className="w-8 h-8 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                        <AlertCircle size={16} />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-sf-text mb-1">
                            {t('help.drawer.requestFailureTitle', 'Connection Error')}
                        </div>
                        <p className="text-xs text-sf-muted leading-relaxed">
                            {t('help.drawer.requestFailureBody', 'Could not load guidance due to a network error.')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={loadContext}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-sf-surface border border-sf-divider text-sf-text hover:bg-sf-hover font-bold text-xs"
                    >
                        <RefreshCw size={12} />
                        <span>{t('common.retry', 'Retry')}</span>
                    </button>
                </div>
            );
        }

        if (availability === 'UNAVAILABLE_TRANSLATION') {
            return (
                <div className="p-4 rounded-xl bg-sf-surface border border-sf-divider text-xs space-y-2 text-center">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto">
                        <Globe size={16} />
                    </div>
                    <div className="font-bold text-sm text-sf-text">
                        {t('help.drawer.noTranslationTitle', 'Translation Unavailable')}
                    </div>
                    <p className="text-xs text-sf-muted leading-relaxed">
                        {t('help.drawer.noTranslationBody', 'Guidance for this page is not yet available in your selected language.')}
                    </p>
                    <div className="pt-2">
                        <Link
                            to="/help"
                            onClick={closeDrawer}
                            className="text-xs font-bold text-sf-primary hover:underline inline-flex items-center gap-1"
                        >
                            <span>{t('help.drawer.browseGeneral', 'Browse Help Centre')}</span>
                            <ExternalLink size={12} />
                        </Link>
                    </div>
                </div>
            );
        }

        return (
            <div className="text-center py-6 text-sf-muted text-xs bg-sf-inset rounded-xl border border-sf-divider/40 space-y-2">
                <p className="font-medium">{t('help.zeroPageHelp', 'No specific guide for this page.')}</p>
                <p className="text-[11px] text-sf-muted">
                    {t('help.drawer.zeroPageSub', 'Search the knowledge base or explore general topics in Help Centre.')}
                </p>
            </div>
        );
    };

    if (!isDrawerOpen) return null;

    return (
        <div
            className={clsx(
                "fixed inset-0 z-50 overflow-hidden",
                isDesktop ? "pointer-events-none" : "pointer-events-auto"
            )}
            onKeyDown={handleDrawerKeyDown}
        >
            {/* Backdrop: only visible on mobile (< md) to allow non-intrusive split-screen desktop bench entry */}
            {!isDesktop && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 animate-fadeIn pointer-events-auto"
                    onClick={closeDrawer}
                    aria-hidden="true"
                />
            )}

            {/* Slide-out Companion Panel */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
                <aside
                    ref={drawerRef}
                    role={isDesktop ? "region" : "dialog"}
                    aria-modal={isDesktop ? "false" : "true"}
                    aria-labelledby="context-help-title"
                    className="w-screen max-w-md bg-sf-surface border-l border-sf-divider shadow-2xl flex flex-col transition-transform duration-300 animate-slideLeft pointer-events-auto"
                >
                    {/* Offline indicator if served from local cache */}
                    {contextData?.isOffline && (
                        <div className="px-3 py-1 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] flex items-center gap-1.5 font-medium">
                            <WifiOff size={12} />
                            <span>{t('help.offlineCacheNotice', 'Serving from offline cache')}</span>
                        </div>
                    )}
                    {/* Header */}
                    <div className="p-4 border-b border-sf-divider bg-sf-canvas flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {drawerArticleId ? (
                                <button
                                    type="button"
                                    onClick={navigateBackInDrawer}
                                    className="p-1.5 rounded-lg text-sf-muted hover:text-sf-text hover:bg-sf-hover transition-colors"
                                    aria-label={t('help.backToPageHelp', 'Back to page help')}
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
                            ref={closeBtnRef}
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
                                                {articleData.minutes} {t('help.minutesShort', 'min')}
                                            </span>
                                        </div>
                                        <h3 className="text-base font-black text-sf-text leading-snug">
                                            {articleData.title}
                                        </h3>
                                        <p className="text-xs text-sf-muted mt-1 leading-relaxed">
                                            {articleData.summary}
                                        </p>
                                    </div>

                                    {/* Quick Answer Highlight */}
                                    {articleData.quick && (
                                        <div className="p-3 rounded-xl bg-emerald-500/10 border-l-4 border-l-emerald-600 border border-emerald-500/20 text-emerald-950 dark:text-emerald-100 text-xs shadow-xs">
                                            <div className="font-bold uppercase tracking-wider text-[10px] text-emerald-700 dark:text-emerald-300 mb-1 flex items-center gap-1">
                                                <CheckCircle2 size={12} />
                                                <span>{t('help.quickAnswer', 'Quick Answer')}</span>
                                            </div>
                                            <p className="leading-relaxed font-medium">{articleData.quick}</p>
                                        </div>
                                    )}

                                    {/* Before You Start Checklist */}
                                    {articleData.before?.length > 0 && (
                                        <div className="space-y-1.5 bg-sf-inset p-3 rounded-xl border border-sf-divider/60">
                                            <div className="text-[11px] font-bold uppercase tracking-wider text-sf-muted">
                                                {t('help.beforeYouStart', 'Before you start')}
                                            </div>
                                            <ul className="space-y-1 text-xs text-sf-text">
                                                {articleData.before.map((b, bIdx) => (
                                                    <li key={bIdx} className="flex items-start gap-1.5">
                                                        <span className="text-sf-primary font-bold">✓</span>
                                                        <span className="leading-relaxed">{b}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Action Steps - Structured Sections or Legacy Steps */}
                                    {articleData.sections?.length > 0 && articleData.sections.some(s => s.steps?.length > 0) ? (
                                        <div className="space-y-4">
                                            {articleData.sections.map((sec, secIdx) => (
                                                <div key={secIdx} className="space-y-2">
                                                    <div className="text-xs font-bold text-sf-text border-b border-sf-divider pb-1">
                                                        {sec.title}
                                                    </div>
                                                    <div className="space-y-2">
                                                        {sec.steps.map((st, stIdx) => (
                                                            <div key={stIdx} className="bg-sf-inset p-3 rounded-xl border border-sf-divider/60 space-y-1.5">
                                                                <div className="flex items-start gap-2 text-xs text-sf-text">
                                                                    <span className="w-5 h-5 rounded-full bg-sf-primary text-white font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                                                                        {stIdx + 1}
                                                                    </span>
                                                                    <span className="flex-1 font-semibold leading-relaxed">{st.action || st}</span>
                                                                </div>
                                                                {st.expected && (
                                                                    <div className="ml-7 pl-2 border-l-2 border-sf-primary/50 text-[11px] text-sf-muted">
                                                                        <span className="font-bold text-sf-primary text-[10px] uppercase block">
                                                                            {t('help.whatYouShouldSee', 'What you should see')}
                                                                        </span>
                                                                        <span className="text-sf-text">{st.expected}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : articleData.steps?.length > 0 ? (
                                        <div className="space-y-2">
                                            <div className="text-[11px] font-bold uppercase tracking-wider text-sf-muted">
                                                {t('help.drawer.steps', 'Required Steps')}
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
                                    ) : null}

                                    {/* Field Guide */}
                                    {articleData.fields?.length > 0 && (
                                        <div className="space-y-1.5 bg-sf-inset p-3 rounded-xl border border-sf-divider/60">
                                            <div className="text-[11px] font-bold uppercase tracking-wider text-sf-muted">
                                                {t('help.fieldGuide', 'Field Guide')}
                                            </div>
                                            <div className="space-y-1.5 text-xs">
                                                {articleData.fields.map((f, fIdx) => (
                                                    <div key={fIdx} className="border-b border-sf-divider/40 pb-1.5 last:border-0 last:pb-0">
                                                        <span className="font-bold text-sf-text">{f[0]}</span>: <span className="text-sf-muted">{f[1]}</span>
                                                        {f[2] && <div className="text-[10px] font-mono text-sf-primary mt-0.5">Ex: {f[2]}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Success Criteria */}
                                    {articleData.success && (
                                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2">
                                            <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                                            <div>
                                                <div className="font-bold mb-0.5">{t('help.drawer.success', 'What success looks like')}</div>
                                                <div className="leading-relaxed">{articleData.success}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Who Acts Next */}
                                    {articleData.nextActor && (
                                        <div className="p-2.5 rounded-xl bg-sf-inset border border-sf-divider text-xs flex items-center gap-2">
                                            <UserCheck size={14} className="text-sf-primary shrink-0" />
                                            <div>
                                                <span className="text-[10px] font-bold uppercase text-sf-muted block">{t('help.whoActsNext', 'Who acts next')}</span>
                                                <span className="font-semibold text-sf-text">{articleData.nextActor}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Troubleshooting Accordion (If something differs) */}
                                    {articleData.problems?.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="text-[11px] font-bold uppercase tracking-wider text-sf-muted">
                                                {t('help.ifSomethingDiffers', 'If something differs')}
                                            </div>
                                            <div className="space-y-1.5">
                                                {articleData.problems.map((prob, pIdx) => (
                                                    <details key={pIdx} className="group bg-sf-inset p-2.5 rounded-xl border border-sf-divider/60 text-xs">
                                                        <summary className="font-semibold text-sf-text cursor-pointer flex items-center justify-between gap-2 select-none">
                                                            <span className="text-amber-700 dark:text-amber-300">{prob.symptom}</span>
                                                            <ChevronRight size={12} className="text-sf-muted group-open:rotate-90 transition-transform" />
                                                        </summary>
                                                        <div className="mt-2 pt-2 border-t border-sf-divider/40 space-y-1 text-[11px]">
                                                            <div className="text-sf-muted">{prob.why}</div>
                                                            <div className="font-medium text-sf-text bg-sf-surface p-2 rounded-lg border border-sf-divider/40">
                                                                {prob.action}
                                                            </div>
                                                        </div>
                                                    </details>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Precaution */}
                                    {articleData.caution && (
                                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                                            <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                                            <div>
                                                <div className="font-bold mb-0.5">{t('help.drawer.caution', 'Keep in mind')}</div>
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
                                    {articleData.id && (
                                        <div className="pt-2">
                                            <Link
                                                to={`/help/articles/${articleData.id}`}
                                                onClick={closeDrawer}
                                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-sf-surface border border-sf-divider hover:bg-sf-hover text-sf-text text-xs font-bold transition-colors"
                                            >
                                                <span>{t('help.drawer.openFullArticle', 'Open full article page')}</span>
                                                <ExternalLink size={14} />
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-sf-muted text-xs">
                                    {t('help.loadError', 'Article could not be loaded.')}
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
                                                <span>{t('help.drawer.activeBlocker', 'Active Blocker Detected')}</span>
                                            </div>
                                            <p className="text-[11px] leading-relaxed">
                                                {t('help.drawer.blockerExplanation', 'One or more conditions are preventing this work item from proceeding. Click below to inspect resolution guidance:')}
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
                                            {t('help.drawer.recommended', 'Recommended for this task')}
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
                                                                <span>{t('help.drawer.includesLabGuidance', 'Includes lab-specific guidance')}</span>
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            renderEmptyState()
                                        )}
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-sf-divider bg-sf-canvas flex items-center justify-between text-xs">
                        <Link
                            to="/help"
                            onClick={closeDrawer}
                            className="font-bold text-sf-primary hover:underline flex items-center gap-1"
                        >
                            <span>{t('help.centre', 'Help Centre')}</span>
                            <ExternalLink size={12} />
                        </Link>
                        <span className="text-[11px] text-sf-muted">SoilFER Knowledge Base</span>
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default ContextHelpDrawer;
