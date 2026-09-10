import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    HelpCircle,
    Search,
    ChevronDown,
    ExternalLink,
    ArrowLeft,
    Clock,
    X,
    Loader2
} from 'lucide-react';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import clsx from 'clsx';

export const FAQPage = () => {
    const { t, locale } = useLanguage();
    const location = useLocation();

    const [articles, setArticles] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        axios.get('/api/help/articles', { params: { locale } })
            .then(res => {
                if (isMounted && res.data?.success) {
                    setArticles(res.data.articles || []);
                }
            })
            .catch(err => {
                console.warn('[FAQ_PAGE] Failed to load articles:', err.message);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [locale]);

    // Filter FAQs by category and query
    const filteredArticles = articles.filter(a => {
        const matchesCategory = selectedCategory === 'all' || a.category === selectedCategory;
        if (!matchesCategory) return false;

        const q = searchQuery.toLowerCase().trim();
        if (!q) return true;

        const title = (a.title || '').toLowerCase();
        const summary = (a.summary || '').toLowerCase();
        const keywords = (a.keywords || []).join(' ').toLowerCase();

        return title.includes(q) || summary.includes(q) || keywords.includes(q);
    });

    const categories = [
        { id: 'all', label: t('help.all', 'All Topics') },
        { id: 'bench', label: 'Workbench & Methods' },
        { id: 'intake', label: 'Intake & Reception' },
        { id: 'review', label: 'Review & Approvals' },
        { id: 'assets', label: 'Equipment & Stock' },
        { id: 'offline', label: 'Mobile & Offline' },
        { id: 'connect', label: 'Connections & KoBo' },
        { id: 'manage', label: 'Management' }
    ];

    return (
        <div className="min-h-screen bg-sf-canvas pb-16">
            {/* Header / Hero */}
            <div className="bg-sf-surface border-b border-sf-divider py-8 px-4 md:px-8">
                <div className="max-w-4xl mx-auto space-y-4">
                    <Link
                        to="/help"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-sf-muted hover:text-sf-primary transition-colors"
                    >
                        <ArrowLeft size={14} />
                        <span>{t('help.centre', 'Help Centre')}</span>
                    </Link>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-sf-text">
                                {t('help.faq', 'Common Questions (FAQs)')}
                            </h1>
                            <p className="text-xs md:text-sm text-sf-muted mt-1">
                                Concise answers and resolutions for daily laboratory work.
                            </p>
                        </div>

                        {/* Search in FAQs */}
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sf-muted w-4 h-4 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Filter questions..."
                                className="w-full pl-9 pr-8 py-2 rounded-xl bg-sf-inset border border-sf-divider text-xs text-sf-text focus:outline-none focus:ring-2 focus:ring-sf-primary"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sf-muted hover:text-sf-text"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-2">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={clsx(
                                    "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                                    selectedCategory === cat.id
                                        ? "bg-sf-primary text-white"
                                        : "bg-sf-inset text-sf-muted hover:text-sf-text border border-sf-divider"
                                )}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Questions List */}
            <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-sf-muted gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-sf-primary" />
                        <span className="text-xs">{t('common.loading', 'Loading questions...')}</span>
                    </div>
                ) : filteredArticles.length > 0 ? (
                    <div className="space-y-3">
                        {filteredArticles.map(article => (
                            <details
                                key={article.id}
                                id={`faq-${article.id}`}
                                className="group bg-sf-surface border border-sf-divider rounded-2xl p-4 transition-all hover:border-sf-primary/40 open:shadow-sm"
                            >
                                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none select-none">
                                    <span className="font-bold text-sm text-sf-text group-hover:text-sf-primary transition-colors">
                                        {article.title}
                                    </span>
                                    <ChevronDown
                                        size={18}
                                        className="text-sf-muted group-hover:text-sf-primary transition-transform duration-200 group-open:rotate-180 shrink-0"
                                    />
                                </summary>

                                <div className="mt-3 pt-3 border-t border-sf-divider space-y-3 animate-fadeIn">
                                    <p className="text-xs md:text-sm text-sf-text leading-relaxed font-medium hc-lead">
                                        {article.summary}
                                    </p>

                                    <div className="flex items-center justify-between pt-1">
                                        <div className="flex items-center gap-2 text-[11px] text-sf-muted">
                                            <span className="capitalize font-bold text-sf-primary">{article.category}</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} />
                                                {article.minutes} min guide
                                            </span>
                                        </div>

                                        <Link
                                            to={`/help/articles/${article.id}`}
                                            data-article={article.id}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sf-primary/10 hover:bg-sf-primary/20 text-sf-primary text-xs font-bold transition-colors"
                                        >
                                            <span>{t('help.read', 'Read full guide')}</span>
                                            <ExternalLink size={13} />
                                        </Link>
                                    </div>
                                </div>
                            </details>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-sf-surface border border-sf-divider rounded-2xl p-8 space-y-2">
                        <HelpCircle size={32} className="mx-auto text-sf-muted" />
                        <div className="font-bold text-sm text-sf-text">{t('help.zero', 'No matching questions found')}</div>
                        <div className="text-xs text-sf-muted">{t('help.zeroHint', 'Try a method name or a shorter phrase, or ask your lab.')}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FAQPage;
