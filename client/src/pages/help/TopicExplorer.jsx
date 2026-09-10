import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft,
    Clock,
    ChevronRight,
    Loader2,
    Compass,
    PackageCheck,
    FlaskConical,
    ClipboardCheck,
    Microscope,
    DownloadCloud,
    Network,
    Settings2,
    HelpCircle,
    WifiOff
} from 'lucide-react';
import helpClientService from '../../services/helpClientService';
import { useLanguage } from '../../context/LanguageContext';

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

export const TopicExplorer = () => {
    const { topicId } = useParams();
    const { t, locale } = useLanguage();

    const [articles, setArticles] = useState([]);
    const [topicMeta, setTopicMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(false);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        Promise.all([
            helpClientService.getTopics(locale),
            helpClientService.getArticles({ category: topicId, locale })
        ])
            .then(([topics, arts]) => {
                if (!isMounted) return;
                const found = (topics || []).find(tp => tp.id === topicId);
                setTopicMeta(found || null);
                setArticles(Array.isArray(arts) ? arts : []);
                setIsOffline((Array.isArray(arts) && arts.length > 0 && arts[0].isOffline) || false);
            })
            .catch(err => {
                console.warn('[TOPIC_EXPLORER] Failed to load topic:', err.message);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => { isMounted = false; };
    }, [topicId, locale]);

    const IconComponent = (topicMeta && ICON_MAP[topicMeta.icon]) || HelpCircle;
    const translatedTitle = t(`help.categories.${topicId}`, topicMeta?.title || topicId);

    return (
        <div className="min-h-screen bg-sf-canvas pb-20">
            {/* Header */}
            <div className="bg-sf-surface border-b border-sf-divider py-8 px-4 md:px-8">
                <div className="max-w-4xl mx-auto space-y-4">
                    <Link
                        to="/help"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-sf-muted hover:text-sf-primary transition-colors"
                    >
                        <ArrowLeft size={14} />
                        <span>{t('help.centre', 'Help Centre')}</span>
                    </Link>

                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-sf-primary/10 text-sf-primary flex items-center justify-center shrink-0">
                            <IconComponent size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-sf-text">
                                {translatedTitle}
                            </h1>
                            <p className="text-xs md:text-sm text-sf-muted mt-0.5">
                                {topicMeta?.description || 'Task guides and standard operational procedures.'}
                            </p>
                            {isOffline && (
                                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
                                    <WifiOff size={14} />
                                    <span>Offline mode: served from local workpack cache</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Articles List */}
            <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-sf-muted gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-sf-primary" />
                        <span className="text-xs">{t('common.loading', 'Loading articles...')}</span>
                    </div>
                ) : articles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {articles.map(art => (
                            <Link
                                key={art.id}
                                to={`/help/articles/${art.id}`}
                                className="p-4 rounded-2xl bg-sf-surface border border-sf-divider hover:border-sf-primary/40 hover:shadow-md transition-all group flex flex-col justify-between space-y-2"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 text-[11px] text-sf-muted">
                                        <span className="capitalize font-bold text-sf-primary">{art.kind}</span>
                                        <span>•</span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={12} />
                                            {art.minutes} min
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-sm text-sf-text group-hover:text-sf-primary transition-colors">
                                        {art.title}
                                    </h3>
                                    <p className="text-xs text-sf-muted line-clamp-2 leading-relaxed">
                                        {art.summary}
                                    </p>
                                </div>
                                <div className="flex items-center text-xs font-bold text-sf-primary pt-1">
                                    <span>{t('help.read', 'Read the guide')}</span>
                                    <ChevronRight size={14} />
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-sf-surface border border-sf-divider rounded-2xl p-8 space-y-2">
                        <HelpCircle size={32} className="mx-auto text-sf-muted" />
                        <div className="font-bold text-sm text-sf-text">{t('help.zero', 'No articles found in this category')}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TopicExplorer;
