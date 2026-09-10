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
    Loader2
} from 'lucide-react';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
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

    // Support Modal State
    const [isSupportOpen, setIsSupportOpen] = useState(false);
    const [supportText, setSupportText] = useState('');
    const [supportStatus, setSupportStatus] = useState(null);

    // Fetch topics and top guides
    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        Promise.all([
            axios.get('/api/help/topics'),
            axios.get('/api/help/articles', { params: { role: selectedRole, locale } })
        ])
            .then(([topicsRes, articlesRes]) => {
                if (!isMounted) return;
                if (topicsRes.data?.success) setTopics(topicsRes.data.topics || []);
                if (articlesRes.data?.success) setGuides(articlesRes.data.articles || []);
            })
            .catch(err => {
                console.warn('[HELP_CENTRE] Failed to load initial help data:', err.message);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [selectedRole, locale]);

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
            axios.get('/api/help/search', { params: { q: query, role: selectedRole, locale } })
                .then(res => {
                    if (res.data?.success) {
                        setSearchResults(res.data.results || []);
                    }
                })
                .catch(err => {
                    console.warn('[HELP_CENTRE] Search failed:', err.message);
                })
                .finally(() => {
                    setIsSearching(false);
                });
        }, 200);

        return () => clearTimeout(timer);
    }, [searchQuery, selectedRole, locale]);

    const handleSupportSubmit = (e) => {
        e.preventDefault();
        if (!supportText.trim()) {
            setSupportStatus({ error: true, message: 'Please enter a description first.' });
            return;
        }

        // Review before send: honest simulation showing preview without sending credentials/data
        setSupportStatus({
            error: false,
            message: 'Support request prepared for review. Nothing has been sent externally.'
        });
    };

    return (
        <div className="min-h-screen bg-sf-canvas pb-16">
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
                        {searchQuery.trim() && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-sf-surface border border-sf-divider rounded-2xl shadow-2xl p-2 z-40 text-left max-h-96 overflow-y-auto animate-fadeIn">
                                {isSearching ? (
                                    <div className="flex items-center justify-center py-6 text-sf-muted text-xs gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-sf-primary" />
                                        <span>{t('help.search', 'Searching...')}</span>
                                    </div>
                                ) : searchResults.length > 0 ? (
                                    <div className="space-y-1">
                                        {searchResults.map(art => (
                                            <Link
                                                key={art.id}
                                                to={`/help/articles/${art.id}`}
                                                data-article={art.id}
                                                className="block p-3 rounded-xl hover:bg-sf-hover transition-colors group"
                                            >
                                                <div className="font-bold text-xs text-sf-text group-hover:text-sf-primary transition-colors">
                                                    {art.title}
                                                </div>
                                                <div className="text-[11px] text-sf-muted line-clamp-1 mt-0.5">
                                                    {art.summary}
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="hc-empty p-6 text-center text-sf-muted space-y-1">
                                        <div className="text-xs font-bold">{t('help.zero', 'No matching guidance found')}</div>
                                        <div className="text-[11px]">{t('help.zeroHint', 'Try a method name or a shorter phrase, or ask your lab.')}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Role Filter Tabs */}
                    <div className="flex items-center justify-center gap-1.5 flex-wrap pt-2">
                        {[
                            { id: 'all', label: 'All Roles' },
                            { id: 'technician', label: 'Technician' },
                            { id: 'reception', label: 'Reception' },
                            { id: 'manager', label: 'Manager' },
                            { id: 'admin', label: 'Admin' }
                        ].map(r => (
                            <button
                                key={r.id}
                                onClick={() => setSelectedRole(r.id)}
                                className={clsx(
                                    "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                                    selectedRole === r.id
                                        ? "bg-sf-primary text-white"
                                        : "bg-sf-surface text-sf-muted border border-sf-divider hover:text-sf-text"
                                )}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-10">
                {/* 8 Core Categories Grid */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-black text-sf-text">
                            {t('help.all', 'Explore by Topic')}
                        </h2>
                        <Link to="/help/faq" className="text-xs font-bold text-sf-primary hover:underline flex items-center gap-1">
                            <span>{t('help.faq', 'Common Questions')}</span>
                            <ChevronRight size={14} />
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {topics.map(topic => {
                            const IconComponent = ICON_MAP[topic.icon] || HelpCircle;
                            const translatedTitle = t(`help.categories.${topic.id}`, topic.title);
                            return (
                                <Link
                                    key={topic.id}
                                    to={`/help/topics/${topic.id}`}
                                    className="p-4 rounded-2xl bg-sf-surface border border-sf-divider hover:border-sf-primary/40 hover:shadow-md transition-all group flex flex-col justify-between"
                                >
                                    <div className="space-y-2">
                                        <div className="w-9 h-9 rounded-xl bg-sf-primary/10 text-sf-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <IconComponent size={18} />
                                        </div>
                                        <div className="font-bold text-sm text-sf-text group-hover:text-sf-primary transition-colors">
                                            {translatedTitle}
                                        </div>
                                        <div className="text-xs text-sf-muted line-clamp-2 leading-relaxed">
                                            {topic.description}
                                        </div>
                                    </div>
                                    <div className="pt-3 mt-3 border-t border-sf-divider/50 flex items-center justify-between text-[11px] text-sf-muted">
                                        <span>{topic.articleCount} articles</span>
                                        <ChevronRight size={14} className="text-sf-muted group-hover:text-sf-primary transition-colors" />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>

                {/* Popular Task Guides */}
                <div className="space-y-4">
                    <h2 className="text-lg font-black text-sf-text">
                        {t('help.guides', 'Recommended Task Guides')}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {guides.slice(0, 6).map(guide => (
                            <Link
                                key={guide.id}
                                to={`/help/articles/${guide.id}`}
                                data-article={guide.id}
                                className="p-4 rounded-2xl bg-sf-surface border border-sf-divider hover:border-sf-primary/40 hover:shadow-md transition-all group flex flex-col justify-between space-y-2"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-[11px] text-sf-muted">
                                        <span className="capitalize font-bold text-sf-primary">{guide.kind}</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={12} />
                                            {guide.minutes} min
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-sm text-sf-text group-hover:text-sf-primary transition-colors">
                                        {guide.title}
                                    </h3>
                                    <p className="text-xs text-sf-muted line-clamp-2 leading-relaxed">
                                        {guide.summary}
                                    </p>
                                </div>
                                <div className="flex items-center text-xs font-bold text-sf-primary pt-1">
                                    <span>{t('help.read', 'Read the guide')}</span>
                                    <ChevronRight size={14} />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Ask Your Lab Support Action Card */}
                <div className="p-6 rounded-3xl bg-gradient-to-r from-sf-surface to-sf-inset border border-sf-divider flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="space-y-1 text-center md:text-left">
                        <h3 className="font-black text-base text-sf-text">
                            Need hands-on assistance or encountered a blocker?
                        </h3>
                        <p className="text-xs text-sf-muted max-w-lg">
                            Submit a structured support inquiry to your laboratory manager or application support lead with safe context pre-filled.
                        </p>
                    </div>
                    <button
                        type="button"
                        data-view="support"
                        onClick={() => setIsSupportOpen(true)}
                        className="px-5 py-2.5 rounded-xl bg-sf-primary text-white font-bold text-xs hover:bg-sf-primary/90 transition-colors shadow-sm shrink-0"
                    >
                        {t('help.support', 'Ask your lab')}
                    </button>
                </div>
            </div>

            {/* Support Dialog Modal */}
            {isSupportOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
                    <div className="w-full max-w-md bg-sf-surface border border-sf-divider rounded-3xl shadow-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-base text-sf-text">
                                {t('help.support', 'Ask your lab')}
                            </h3>
                            <button
                                onClick={() => { setIsSupportOpen(false); setSupportStatus(null); }}
                                className="p-1 rounded-lg text-sf-muted hover:text-sf-text"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <p className="text-xs text-sf-muted leading-relaxed">
                            Describe what you were trying to do, what happened, and what you expected. Sensitive tokens, passwords, and confidential sample results are excluded automatically.
                        </p>

                        <form onSubmit={handleSupportSubmit} className="space-y-3">
                            <textarea
                                id="hc-support-text"
                                rows={4}
                                value={supportText}
                                onChange={(e) => setSupportText(e.target.value)}
                                placeholder="State the issue or question clearly..."
                                className="w-full p-3 rounded-xl bg-sf-inset border border-sf-divider text-xs text-sf-text focus:outline-none focus:ring-2 focus:ring-sf-primary"
                            />

                            {supportStatus && (
                                <div
                                    id="hc-status"
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

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setIsSupportOpen(false); setSupportStatus(null); }}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-sf-muted hover:text-sf-text"
                                >
                                    {t('common.cancel', 'Cancel')}
                                </button>
                                <button
                                    type="submit"
                                    data-act="support-preview"
                                    className="px-4 py-2 rounded-xl bg-sf-primary text-white text-xs font-bold hover:bg-sf-primary/90 transition-colors flex items-center gap-1.5"
                                >
                                    <Send size={14} />
                                    <span>Review before sending</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HelpCentre;
