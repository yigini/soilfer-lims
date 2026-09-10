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
    Lock,
    ExternalLink,
    ChevronDown,
    HelpCircle,
    UserCheck,
    Layers,
    FileText,
    Eye
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

    const sections = article.sections || [];
    const hasStructuredSections = sections.length > 0 && sections.some(s => s.steps?.length > 0);
    let stepCounter = 0;

    return (
        <div className="min-h-screen bg-sf-canvas pb-20">
            {/* Top Navigation & Breadcrumbs */}
            <div className="bg-sf-surface border-b border-sf-divider py-4 px-4 md:px-8">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs text-sf-muted truncate">
                        <Link to="/help" className="hover:text-sf-primary transition-colors font-medium">
                            {t('help.centre', 'Help Centre')}
                        </Link>
                        <ChevronRight size={12} className="shrink-0" />
                        <Link to={`/help/topics/${article.category}`} className="hover:text-sf-primary transition-colors capitalize font-medium">
                            {t(`help.categories.${article.category}`, article.category)}
                        </Link>
                        <ChevronRight size={12} className="shrink-0" />
                        <span className="text-sf-text font-bold truncate">{article.title}</span>
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

            {/* Main Content Area: 2-column on desktop (Article + Sticky TOC) */}
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] gap-10 items-start">
                    
                    {/* Left Column: Full Article Body */}
                    <main className="min-w-0 space-y-8">
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
                        <div className="article-head space-y-3">
                            <div className="eyebrow text-xs font-bold uppercase tracking-wider text-sf-primary">
                                {article.kind === 'guide' ? t('help.taskGuide', 'Task guide') : article.kind}
                            </div>

                            <h1 className="text-2xl md:text-4xl font-black text-sf-text tracking-tight leading-tight">
                                {article.title}
                            </h1>

                            <p className="text-base md:text-lg text-sf-muted leading-relaxed font-medium hc-lead">
                                {article.summary}
                            </p>

                            <div className="flex items-center gap-3 text-xs text-sf-muted flex-wrap pt-2 border-t border-sf-divider/50">
                                {article.roles && article.roles.map(r => (
                                    <span key={r} className="px-2.5 py-1 rounded-lg bg-sf-primary/10 text-sf-primary font-bold text-[11px]">
                                        {r.replace('_', ' ')}
                                    </span>
                                ))}
                                <span className="flex items-center gap-1 font-medium">
                                    <Clock size={13} />
                                    {article.minutes} {t('help.minutesShort', 'min guide')}
                                </span>
                                {article.reviewOwner && (
                                    <span>• {t('help.reviewLead', 'Review lead')}: {article.reviewOwner}</span>
                                )}
                            </div>
                        </div>

                        {/* Quick Answer Highlight Callout */}
                        {article.quick && (
                            <div className="p-5 rounded-2xl bg-emerald-500/10 border-l-4 border-l-emerald-600 border border-emerald-500/20 text-emerald-950 dark:text-emerald-100 shadow-xs">
                                <div className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-1.5 flex items-center gap-1.5">
                                    <CheckCircle2 size={15} />
                                    <span>{t('help.quickAnswer', 'Quick Answer')}</span>
                                </div>
                                <p className="text-sm md:text-base leading-relaxed font-medium">
                                    {article.quick}
                                </p>
                            </div>
                        )}

                        {/* Before you start checklist */}
                        {article.before && article.before.length > 0 && (
                            <section id="before" className="p-6 rounded-2xl bg-sf-surface border border-sf-divider space-y-4">
                                <h2 className="text-base md:text-lg font-black text-sf-text flex items-center gap-2">
                                    <CheckCircle2 size={18} className="text-sf-primary" />
                                    <span>{t('help.beforeYouStart', 'Before you start')}</span>
                                </h2>
                                <ul className="space-y-2.5">
                                    {article.before.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-3 text-xs md:text-sm text-sf-text">
                                            <span className="w-5 h-5 rounded-md bg-sf-primary/10 text-sf-primary font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
                                                ✓
                                            </span>
                                            <span className="leading-relaxed">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {/* Synthetic batch figure for bench-batch exemplar */}
                        {article.id === 'bench-batch' && (
                            <div className="p-5 rounded-2xl bg-sf-surface border border-sf-divider space-y-3" role="img" aria-label="Synthetic batch example: 40 rows checked, 38 matched drafts and two excluded rows">
                                <div className="flex items-center justify-between text-xs font-black text-sf-primary uppercase tracking-wider">
                                    <span>EXAMPLE · pH WORKSHEET</span>
                                    <span>40-row batch</span>
                                </div>
                                <div className="border border-sf-divider rounded-xl overflow-hidden bg-sf-canvas">
                                    <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-sf-inset text-[11px] font-bold text-sf-muted uppercase tracking-wider border-b border-sf-divider">
                                        <span>Sample ID</span>
                                        <span>pH Value</span>
                                        <span>Paste Preview</span>
                                    </div>
                                    <div className="divide-y divide-sf-divider text-xs">
                                        <div className="grid grid-cols-3 gap-2 px-4 py-2 font-mono items-center">
                                            <span className="font-bold text-sf-text">DEMO-001</span>
                                            <span className="text-sf-text">6.42</span>
                                            <span className="text-emerald-600 font-sans font-bold">✓ Matched</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 px-4 py-2 font-mono items-center">
                                            <span className="font-bold text-sf-text">DEMO-002</span>
                                            <span className="text-sf-text">5.88</span>
                                            <span className="text-emerald-600 font-sans font-bold">✓ Matched</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 px-4 py-2 font-mono items-center bg-rose-500/5">
                                            <span className="font-bold text-sf-text">DEMO-039</span>
                                            <span className="text-sf-text">6.15</span>
                                            <span className="text-rose-600 font-sans font-bold">✕ Blocked (drying gap)</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 px-4 py-2 font-mono items-center bg-amber-500/5">
                                            <span className="font-bold text-sf-text">DEMO-040</span>
                                            <span className="text-sf-muted">—</span>
                                            <span className="text-amber-600 font-sans font-bold">✕ Missing value</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-[11px] text-sf-muted leading-relaxed">
                                    4 of 40 rows shown · <strong>38 matched</strong> · <strong>2 excluded</strong><br />
                                    Applying values creates drafts. Submission to reviewer comes later in Ready to Submit.
                                </div>
                            </div>
                        )}

                        {/* Numbered Procedure Sections */}
                        {hasStructuredSections ? (
                            <div className="space-y-8">
                                {sections.map((sec, secIdx) => (
                                    <section id={`phase-${secIdx}`} key={secIdx} className="space-y-4">
                                        <h2 className="text-lg md:text-xl font-black text-sf-text border-b border-sf-divider pb-2">
                                            {sec.title}
                                        </h2>
                                        <div className="space-y-4">
                                            {sec.steps && sec.steps.map((step, stIdx) => {
                                                stepCounter += 1;
                                                return (
                                                    <div
                                                        key={stIdx}
                                                        className="step p-5 rounded-2xl bg-sf-surface border border-sf-divider shadow-xs space-y-3"
                                                    >
                                                        <div className="flex items-start gap-3.5">
                                                            <span className="w-7 h-7 rounded-xl bg-sf-primary text-white font-black flex items-center justify-center shrink-0 text-xs shadow-xs mt-0.5">
                                                                {stepCounter}
                                                            </span>
                                                            <div className="flex-1">
                                                                <p className="action text-sm md:text-base font-semibold text-sf-text leading-relaxed">
                                                                    {step.action || step}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {step.expected && (
                                                            <div className="ml-10 p-3 rounded-xl bg-sf-inset border-l-2 border-l-sf-primary text-xs md:text-sm text-sf-muted space-y-1">
                                                                <div className="text-[11px] font-black uppercase tracking-wider text-sf-primary flex items-center gap-1.5">
                                                                    <Eye size={13} />
                                                                    <span>{t('help.whatYouShouldSee', 'What you should see')}</span>
                                                                </div>
                                                                <p className="leading-relaxed text-sf-text font-normal">
                                                                    {step.expected}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        ) : article.steps?.length > 0 ? (
                            <section className="space-y-3">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-sf-muted">
                                    {t('help.drawer.steps', 'Required Steps')}
                                </h2>
                                <ol className="space-y-3">
                                    {article.steps.map((step, idx) => (
                                        <li
                                            key={idx}
                                            className="step p-4 rounded-2xl bg-sf-surface border border-sf-divider flex items-start gap-3 text-xs md:text-sm text-sf-text shadow-xs"
                                        >
                                            <span className="w-6 h-6 rounded-full bg-sf-primary/10 text-sf-primary font-black flex items-center justify-center shrink-0 text-xs mt-0.5">
                                                {idx + 1}
                                            </span>
                                            <span className="leading-relaxed">{step}</span>
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        ) : null}

                        {/* Field Guide & Examples Table */}
                        {article.fields && article.fields.length > 0 && (
                            <section id="fields" className="space-y-4">
                                <h2 className="text-lg md:text-xl font-black text-sf-text border-b border-sf-divider pb-2">
                                    {t('help.fieldGuide', 'Field guide & examples')}
                                </h2>
                                <div className="border border-sf-divider rounded-2xl overflow-hidden bg-sf-surface">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr className="bg-sf-inset border-b border-sf-divider text-sf-muted uppercase font-bold text-[11px] tracking-wider">
                                                    <th className="p-3.5">{t('help.fieldOrState', 'Field or state')}</th>
                                                    <th className="p-3.5">{t('help.meaning', 'What it means')}</th>
                                                    <th className="p-3.5">{t('help.exampleInstruction', 'Example / instruction')}</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-sf-divider text-sf-text">
                                                {article.fields.map((row, rIdx) => (
                                                    <tr key={rIdx} className="hover:bg-sf-hover transition-colors">
                                                        <td className="p-3.5 font-bold">{row[0]}</td>
                                                        <td className="p-3.5 text-sf-muted leading-relaxed">{row[1]}</td>
                                                        <td className="p-3.5 font-mono text-[11px] leading-relaxed text-sf-text">{row[2]}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {article.example && (
                                    <div className="p-4 rounded-xl bg-sf-inset border border-sf-divider space-y-2">
                                        <div className="text-xs font-bold uppercase tracking-wider text-sf-muted">
                                            {t('help.workedExample', 'Worked example')}
                                        </div>
                                        <pre className="p-3 bg-sf-surface border border-sf-divider rounded-lg font-mono text-xs text-sf-text overflow-x-auto whitespace-pre">
                                            {article.example}
                                        </pre>
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Success Criteria (Check it worked) & Who Acts Next */}
                        {(article.success || article.nextActor) && (
                            <section id="success" className="success p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-100 space-y-4">
                                <div>
                                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 mb-1">
                                        <CheckCircle2 size={16} />
                                        <span>{t('help.checkItWorked', 'Check it worked')}</span>
                                    </div>
                                    <p className="text-sm md:text-base leading-relaxed font-medium">
                                        {article.success}
                                    </p>
                                </div>

                                {article.nextActor && (
                                    <div className="pt-3 border-t border-emerald-500/20">
                                        <div className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 mb-1 flex items-center gap-1.5">
                                            <UserCheck size={14} />
                                            <span>{t('help.whoActsNext', 'Who acts next')}</span>
                                        </div>
                                        <p className="text-sm font-semibold">
                                            {article.nextActor}
                                        </p>
                                    </div>
                                )}
                            </section>
                        )}

                        {/* Troubleshooting Accordion (If something differs) */}
                        {article.problems && article.problems.length > 0 && (
                            <section id="problems" className="space-y-4">
                                <h2 className="text-lg md:text-xl font-black text-sf-text border-b border-sf-divider pb-2">
                                    {t('help.ifSomethingDiffers', 'If something differs')}
                                </h2>
                                <div className="space-y-3">
                                    {article.problems.map((prob, pIdx) => (
                                        <details key={pIdx} className="group p-4 rounded-2xl bg-sf-surface border border-sf-divider hover:border-sf-primary/40 transition-colors">
                                            <summary className="font-bold text-sm text-sf-text cursor-pointer flex items-center justify-between gap-2 select-none">
                                                <span className="text-amber-800 dark:text-amber-300 flex items-center gap-2">
                                                    <AlertCircle size={16} className="shrink-0" />
                                                    {prob.symptom}
                                                </span>
                                                <ChevronDown size={16} className="text-sf-muted group-open:rotate-180 transition-transform" />
                                            </summary>
                                            <div className="mt-3 pt-3 border-t border-sf-divider space-y-2 text-xs md:text-sm">
                                                <p className="text-sf-muted leading-relaxed">
                                                    <strong>{t('help.cause', 'Cause')}:</strong> {prob.why}
                                                </p>
                                                <p className="text-sf-text font-semibold bg-sf-inset p-3 rounded-xl border border-sf-divider leading-relaxed">
                                                    <strong>{t('help.action', 'Safe action')}:</strong> {prob.action}
                                                </p>
                                            </div>
                                        </details>
                                    ))}
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

                        {/* Source Evidence Details */}
                        {article.sources && article.sources.length > 0 && (
                            <div className="p-4 rounded-2xl bg-sf-surface border border-sf-divider text-xs text-sf-muted space-y-2">
                                <details className="group">
                                    <summary className="font-bold cursor-pointer flex items-center justify-between text-sf-muted hover:text-sf-text">
                                        <span>{t('help.implementationEvidence', 'Implementation evidence & verified sources')}</span>
                                        <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
                                    </summary>
                                    <ul className="mt-2 space-y-1 font-mono text-[11px] text-sf-muted pl-2 border-l border-sf-divider">
                                        {article.sources.map((s, sIdx) => (
                                            <li key={sIdx}>• {s}</li>
                                        ))}
                                    </ul>
                                </details>
                            </div>
                        )}

                        {/* Feedback Widget */}
                        <div className="pt-6 border-t border-sf-divider space-y-3">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-sf-surface border border-sf-divider">
                                <span className="font-bold text-xs text-sf-text">
                                    {t('help.feedbackPrompt', 'Did this explain your next step?')}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        data-act="feedback-yes"
                                        onClick={() => handleFeedback(true)}
                                        className="px-3.5 py-2 rounded-xl border border-sf-divider hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-600 text-xs font-bold flex items-center gap-1.5 transition-colors"
                                    >
                                        <ThumbsUp size={13} />
                                        <span>{t('help.yes', 'Yes')}</span>
                                    </button>
                                    <button
                                        type="button"
                                        data-act="feedback-no"
                                        onClick={() => handleFeedback(false)}
                                        className="px-3.5 py-2 rounded-xl border border-sf-divider hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-600 text-xs font-bold flex items-center gap-1.5 transition-colors"
                                    >
                                        <ThumbsDown size={13} />
                                        <span>{t('help.stillUnclear', 'Still unclear')}</span>
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
                                            className="p-3.5 rounded-xl bg-sf-surface border border-sf-divider hover:border-sf-primary/40 hover:bg-sf-hover transition-all group"
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

                    {/* Right Column: Sticky Table of Contents on Desktop */}
                    <aside className="toc hidden lg:block sticky top-6 space-y-4 border-l border-sf-divider pl-5 text-xs">
                        <div className="font-black text-sf-text uppercase tracking-wider text-[11px]">
                            {t('help.onThisPage', 'On this page')}
                        </div>
                        <nav className="space-y-2 text-sf-muted">
                            {article.before && article.before.length > 0 && (
                                <a href="#before" className="block hover:text-sf-primary transition-colors">
                                    {t('help.beforeYouStart', 'Before you start')}
                                </a>
                            )}
                            {sections.map((sec, sIdx) => (
                                <a key={sIdx} href={`#phase-${sIdx}`} className="block hover:text-sf-primary transition-colors truncate">
                                    {sec.title}
                                </a>
                            ))}
                            {article.fields && article.fields.length > 0 && (
                                <a href="#fields" className="block hover:text-sf-primary transition-colors">
                                    {t('help.fieldGuide', 'Field guide & examples')}
                                </a>
                            )}
                            {(article.success || article.nextActor) && (
                                <a href="#success" className="block hover:text-sf-primary transition-colors">
                                    {t('help.checkItWorked', 'Check it worked')}
                                </a>
                            )}
                            {article.problems && article.problems.length > 0 && (
                                <a href="#problems" className="block hover:text-sf-primary transition-colors">
                                    {t('help.ifSomethingDiffers', 'If something differs')}
                                </a>
                            )}
                        </nav>

                        <div className="pt-4 border-t border-sf-divider space-y-2">
                            <Link
                                to="/workbench"
                                className="w-full py-2 px-3 rounded-xl bg-sf-surface border border-sf-divider hover:bg-sf-hover text-sf-text text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                            >
                                <span>{t('help.openWorkbench', 'Go to Workbench')}</span>
                                <ExternalLink size={12} />
                            </Link>
                            <Link
                                to="/help"
                                className="w-full py-2 px-3 rounded-xl bg-sf-surface border border-sf-divider hover:bg-sf-hover text-sf-muted text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                            >
                                <ArrowLeft size={12} />
                                <span>{t('help.centre', 'Help Centre')}</span>
                            </Link>
                        </div>
                    </aside>
                </div>
            </div>

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
