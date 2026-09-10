import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Search,
    Compass,
    PackageCheck,
    FlaskConical,
    ClipboardCheck,
    Microscope,
    DownloadCloud,
    Network,
    Settings2,
    HelpCircle,
    ChevronRight,
    Clock,
    Send,
    X,
    CheckCircle2,
    AlertCircle,
    Loader2,
    WifiOff,
    Mail,
    Building2,
    ExternalLink
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import helpClientService from '../../services/helpClientService';
import clsx from 'clsx';

const ICON_MAP = {
    compass: Compass,
    'package-check': PackageCheck,
    'flask-conical': FlaskConical,
    'clipboard-check': ClipboardCheck,
    microscope: Microscope,
    'cloud-download': DownloadCloud,
    network: Network,
    'settings-2': Settings2
};

export const HelpCentre = () => {
    const { t, locale } = useLanguage();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [topics, setTopics] = useState([]);
    const [guides, setGuides] = useState([]);
    const [selectedRole, setSelectedRole] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);
    const [lastSync, setLastSync] = useState(null);

    // Support Modal State (Finding 8)
    const [isSupportOpen, setIsSupportOpen] = useState(false);
    const [supportConfig, setSupportConfig] = useState(null);
    const [loadingSupport, setLoadingSupport] = useState(false);
    const [supportSubject, setSupportSubject] = useState('');
    const [supportText, setSupportText] = useState('');
    const [supportStatus, setSupportStatus] = useState(null);

    // Fetch topics and top guides
    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        Promise.all([
            helpClientService.getTopics({ locale, user }),
            helpClientService.getArticles({ role: selectedRole, locale, user })
        ])
            .then(([topicsRes, articlesRes]) => {
                if (!isMounted) return;
                setTopics(topicsRes.topics || []);
                setGuides(articlesRes.articles || []);
                setIsOffline(topicsRes.isOffline || articlesRes.isOffline || false);
                setLastSync(topicsRes.lastSync || articlesRes.lastSync || null);
            })
            .catch(err => {
                console.warn('[HELP_CENTRE] Failed to load initial help data:', err.message);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [selectedRole, locale, user]);

    // Search query effect
    useEffect(() => {
        const query = searchQuery.trim();
        if (!query) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        const timer = setTimeout(() => {
            setIsSearching(true);
            helpClientService.searchHelp({ query, role: selectedRole, locale, user })
                .then(res => {
                    setSearchResults(res.results || []);
                    if (res.isOffline) setIsOffline(true);
                })
                .catch(err => {
                    console.warn('[HELP_CENTRE] Search failed:', err.message);
                })
                .finally(() => {
                    setIsSearching(false);
                });
        }, 200);

        return () => clearTimeout(timer);
    }, [searchQuery, selectedRole, locale, user]);

    // Load support config when opening support modal
    const handleOpenSupport = async () => {
        setIsSupportOpen(true);
        setSupportStatus(null);
        setLoadingSupport(true);
        try {
            const res = await helpClientService.getSupportConfig(user);
            setSupportConfig(res);
        } catch (e) {
            setSupportConfig({ isConfigured: false });
        } finally {
            setLoadingSupport(false);
        }
    };

    const handleSupportSubmit = (e) => {
        e.preventDefault();
        if (!supportText.trim()) {
            setSupportStatus({ error: true, message: 'Please enter a description of the issue or question.' });
            return;
        }

        // Honest review & delivery flow (Finding 8)
        if (supportConfig?.support?.contactMethod === 'EMAIL') {
            const email = supportConfig.support.contactValue;
            const subject = encodeURIComponent(`[SoilFER LIMS Support] ${supportSubject || 'Laboratory Issue'} (${user?.labId || 'General'})`);
            const body = encodeURIComponent(
                `User: ${user?.username || 'Anonymous'}\n` +
                `Lab: ${user?.labId || 'Unassigned'}\n` +
                `URL: ${window.location.href}\n` +
                `Time: ${new Date().toISOString()}\n\n` +
                `Description:\n${supportText}\n\n` +
                `---\nNote: Confidential tokens and passwords were excluded.`
            );
            window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
            setSupportStatus({
                error: false,
                message: 'Your email client has been opened with the pre-formatted support message.'
            });
        } else {
            setSupportStatus({
                error: false,
                message: 'Support request prepared for laboratory supervisor review. Please forward the details below.'
            });
        }
    };

    return (
        <div className="min-h-screen bg-sf-canvas pb-16">
            {/* Offline Status Banner */}
            {isOffline && (
                <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <WifiOff size={14} className="text-amber-600 dark:text-amber-400" />
                        <span className="font-semibold">{t('help.offline', 'Downloaded Help (Offline)')}</span>
                        <span className="opacity-80">— Viewing cached laboratory guidance.</span>
                    </div>
                    {lastSync && (
                        <span className="text-[11px] opacity-75">
                            {t('help.offlineDate', 'Last synchronized')}: {new Date(lastSync).toLocaleString()}
                        </span>
                    )}
                </div>
            )}

            {/* Hero Section */}
            <div className="bg-gradient-to-b from-sf-surface to-sf-canvas border-b border-sf-divider py-10 px-4 md:px-8">
                <div className="max-w-4xl mx-auto text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sf-primary/10 text-sf-primary text-xs font-bold uppercase tracking-wider">
                        <HelpCircle size={14} />
                        <span>SoilFER Laboratory Guidance</span>
                    </div>

                    <h1 className="text-2xl md:text-4xl font-black text-sf-text tracking-tight">
                        {t('help.hero', 'How can we help at the lab?')}
                    </h1>

                    <p className="text-sm md:text-base text-sf-muted max-w-xl mx-auto">
                        {t('help.intro', 'Clear guidance for the work in front of you.')}
                    </p>

                    {/* Search Bar */}
                    <div className="relative max-w-xl mx-auto pt-2">
                        <div className="relative flex items-center">
                            <Search className="absolute left-4 text-sf-muted w-5 h-5 pointer-events-none" />
                            <input
                                id="hc-query"
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={t('help.placeholder', 'Try preparation, a blocked result or a spectrum file…')}
                                className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-sf-surface border border-sf-divider text-sf-text placeholder-sf-muted focus:outline-none focus:ring-2 focus:ring-sf-primary focus:border-transparent shadow-sm text-sm"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 p-1 rounded-full text-sf-muted hover:text-sf-text"
                                    aria-label="Clear search"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Search Results Dropdown */}
                        {searchQuery && (
                            <div className="absolute left-0 right-0 top-full mt-2 bg-sf-surface border border-sf-divider rounded-2xl shadow-xl z-30 max-h-96 overflow-y-auto p-2 text-left">
                                {isSearching ? (
                                    <div className="p-4 text-center text-xs text-sf-muted flex items-center justify-center gap-2">
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>Searching guidance...</span>
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    <div className="divide-y divide-sf-divider/50">
                                        {searchResults.map((item) => (
                                            <Link
                                                key={item.id}
                                                to={`/help/articles/${item.id}`}
                                                className="block p-3 rounded-xl hover:bg-sf-inset transition-colors"
                                            >
                                                <div className="font-bold text-sm text-sf-text">{item.title}</div>
                                                <div className="text-xs text-sf-muted line-clamp-1 mt-0.5">{item.summary}</div>
                                                {item.localeNotice && (
                                                    <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                                                        {item.localeNotice}
                                                    </div>
                                                )}
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-6 text-center text-xs text-sf-muted space-y-1">
                                        <div className="font-semibold">{t('help.zero', 'No matching guidance found')}</div>
                                        <div>{t('help.zeroHint', 'Try a method name or a shorter phrase, or ask your lab.')}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-10">
                {/* Topic Grid */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-black text-sf-text uppercase tracking-wider text-xs">
                            {t('help.all', 'All topics')}
                        </h2>
                        <Link
                            to="/help/faq"
                            className="text-xs font-bold text-sf-primary hover:underline flex items-center gap-1"
                        >
                            <span>{t('help.faq', 'Common questions')}</span>
                            <ChevronRight size={14} />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {topics.map((topic) => {
                            const IconComponent = ICON_MAP[topic.icon] || Compass;
                            return (
                                <Link
                                    key={topic.id}
                                    to={`/help/topics/${topic.id}`}
                                    className="p-5 rounded-2xl bg-sf-surface border border-sf-divider hover:border-sf-primary/40 hover:shadow-md transition-all flex flex-col justify-between group"
                                >
                                    <div className="space-y-3">
                                        <div className="w-10 h-10 rounded-xl bg-sf-primary/10 text-sf-primary flex items-center justify-center group-hover:bg-sf-primary group-hover:text-white transition-colors">
                                            <IconComponent size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-sm text-sf-text group-hover:text-sf-primary transition-colors">
                                                {topic.title}
                                            </h3>
                                            <p className="text-xs text-sf-muted mt-1 line-clamp-2 leading-relaxed">
                                                {topic.description}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="pt-4 mt-2 border-t border-sf-divider/50 flex items-center justify-between text-[11px] text-sf-muted">
                                        <span>{topic.articleCount} {topic.articleCount === 1 ? 'guide' : 'guides'}</span>
                                        <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </section>

                {/* Popular Task Guides */}
                <section className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <h2 className="text-lg font-black text-sf-text tracking-tight">
                                {t('help.guides', 'Task guides')}
                            </h2>
                            <p className="text-xs text-sf-muted">
                                Step-by-step procedures verified for active laboratory methods.
                            </p>
                        </div>

                        {/* Role Filter */}
                        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-sf-surface border border-sf-divider text-xs self-start sm:self-auto">
                            {['all', 'technician', 'reception', 'manager'].map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setSelectedRole(r)}
                                    className={clsx(
                                        "px-2.5 py-1 rounded-lg font-semibold capitalize transition-colors",
                                        selectedRole === r
                                            ? "bg-sf-primary text-white"
                                            : "text-sf-muted hover:text-sf-text"
                                    )}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-xs text-sf-muted flex items-center justify-center gap-2">
                            <Loader2 size={16} className="animate-spin" />
                            <span>Loading guides...</span>
                        </div>
                    ) : guides.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {guides.slice(0, 9).map((art) => (
                                <Link
                                    key={art.id}
                                    to={`/help/articles/${art.id}`}
                                    className="p-5 rounded-2xl bg-sf-surface border border-sf-divider hover:border-sf-primary/40 hover:shadow-sm transition-all flex flex-col justify-between"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-[11px] text-sf-muted">
                                            <span className="uppercase font-bold tracking-wider text-sf-primary">
                                                {art.category}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} />
                                                {art.minutes || 2} min
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-sm text-sf-text hover:text-sf-primary transition-colors">
                                            {art.title}
                                        </h3>
                                        <p className="text-xs text-sf-muted line-clamp-2 leading-relaxed">
                                            {art.summary}
                                        </p>
                                    </div>
                                    <div className="pt-4 mt-2 flex items-center justify-between text-xs font-bold text-sf-primary">
                                        <span>{t('help.read', 'Read the guide')}</span>
                                        <ChevronRight size={14} />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="p-8 text-center text-xs text-sf-muted bg-sf-surface rounded-2xl border border-sf-divider">
                            No published guides available for this role filter.
                        </div>
                    )}
                </section>

                {/* Ask Your Lab Support Callout */}
                <section className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-sf-surface to-sf-canvas border border-sf-divider flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
                    <div className="space-y-1.5 text-center sm:text-left">
                        <h3 className="text-base md:text-lg font-black text-sf-text">
                            {t('help.support', 'Ask your lab')}
                        </h3>
                        <p className="text-xs md:text-sm text-sf-muted max-w-xl">
                            Need help with a method issue, sample discrepancy or blocked task? Contact your assigned laboratory manager or method lead.
                        </p>
                    </div>
                    <button
                        onClick={handleOpenSupport}
                        className="px-5 py-2.5 rounded-xl bg-sf-primary text-white text-xs font-bold hover:bg-sf-primary/90 transition-colors shadow-sm shrink-0 flex items-center gap-2"
                    >
                        <Mail size={16} />
                        <span>{t('help.support', 'Ask your lab')}</span>
                    </button>
                </section>
            </div>

            {/* Configured Support Contact Modal (Finding 8) */}
            {isSupportOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-sf-surface border border-sf-divider rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-sf-divider pb-3">
                            <div className="flex items-center gap-2 text-sm font-bold text-sf-text">
                                <HelpCircle size={18} className="text-sf-primary" />
                                <span>{t('help.support', 'Ask your lab')}</span>
                            </div>
                            <button
                                onClick={() => { setIsSupportOpen(false); setSupportStatus(null); }}
                                className="p-1 rounded-lg text-sf-muted hover:text-sf-text"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {loadingSupport ? (
                            <div className="p-8 text-center text-xs text-sf-muted flex items-center justify-center gap-2">
                                <Loader2 size={16} className="animate-spin" />
                                <span>Checking laboratory support configuration...</span>
                            </div>
                        ) : !supportConfig?.isConfigured ? (
                            <div className="space-y-4 py-2">
                                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                                    <div className="font-bold flex items-center gap-1.5">
                                        <AlertCircle size={16} />
                                        <span>Support Contact Not Configured</span>
                                    </div>
                                    <p className="leading-relaxed">
                                        An automated support destination is not configured for your laboratory. Please contact your assigned laboratory manager or operational supervisor directly.
                                    </p>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsSupportOpen(false)}
                                        className="px-4 py-2 rounded-xl bg-sf-primary text-white text-xs font-bold"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSupportSubmit} className="space-y-4">
                                <div className="p-3 rounded-xl bg-sf-inset border border-sf-divider text-xs space-y-1">
                                    <div className="font-bold text-sf-text flex items-center gap-1.5">
                                        <Building2 size={14} className="text-sf-primary" />
                                        <span>{supportConfig.support?.supportName || 'Laboratory Support'}</span>
                                    </div>
                                    <div className="text-sf-muted">
                                        Destination: <span className="font-mono text-sf-text">{supportConfig.support?.contactValue || supportConfig.support?.contactMethod}</span>
                                    </div>
                                    {supportConfig.support?.instructions && (
                                        <div className="text-sf-muted pt-1 border-t border-sf-divider/50 mt-1">
                                            {supportConfig.support.instructions}
                                        </div>
                                    )}
                                </div>

                                {/* Privacy guidance (Finding 8) */}
                                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-800 dark:text-blue-300">
                                    <span className="font-bold">Privacy notice: </span>
                                    Please review your message. Do not include passwords, API access tokens, or confidential patient/customer identifiers in free text.
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-sf-text">Subject / Summary</label>
                                    <input
                                        type="text"
                                        value={supportSubject}
                                        onChange={(e) => setSupportSubject(e.target.value)}
                                        placeholder="e.g. Drying step verification issue"
                                        className="w-full p-2.5 rounded-xl bg-sf-inset border border-sf-divider text-xs text-sf-text focus:outline-none focus:ring-2 focus:ring-sf-primary"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-sf-text">Detailed Description</label>
                                    <textarea
                                        rows={4}
                                        value={supportText}
                                        onChange={(e) => setSupportText(e.target.value)}
                                        placeholder="Describe what you were trying to do, what happened, and what you expected..."
                                        className="w-full p-3 rounded-xl bg-sf-inset border border-sf-divider text-xs text-sf-text focus:outline-none focus:ring-2 focus:ring-sf-primary"
                                    />
                                </div>

                                {supportStatus && (
                                    <div
                                        className={clsx(
                                            "p-3 rounded-xl text-xs flex items-start gap-2",
                                            supportStatus.error
                                                ? "bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300"
                                                : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                                        )}
                                    >
                                        {supportStatus.error ? <AlertCircle size={16} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
                                        <span>{supportStatus.message}</span>
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-sf-divider">
                                    <button
                                        type="button"
                                        onClick={() => { setIsSupportOpen(false); setSupportStatus(null); }}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-sf-muted hover:text-sf-text"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 rounded-xl bg-sf-primary text-white text-xs font-bold hover:bg-sf-primary/90 transition-colors flex items-center gap-1.5"
                                    >
                                        {supportConfig.support?.contactMethod === 'EMAIL' ? (
                                            <>
                                                <ExternalLink size={14} />
                                                <span>Draft in Email Client</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send size={14} />
                                                <span>Review & Send Request</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default HelpCentre;
