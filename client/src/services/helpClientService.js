import axios from 'axios';
import {
    saveOfflineHelpPack,
    getOfflineHelpArticles,
    getOfflineHelpArticle,
    getOfflineHelpMeta
} from './offline/offlineDb';

/**
 * Normalizes text for offline search matching
 */
function normalizeString(str = '') {
    return String(str)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

/**
 * Unified Help Client Service
 * Provides network-first access with transparent IndexedDB offline fallback
 * across HelpCentre, FAQPage, ArticleReader, TopicExplorer, and ContextHelpDrawer.
 */
export const helpClientService = {
    /**
     * Fetch topics / categories with article counts
     */
    async getTopics({ locale = 'en', user = null } = {}) {
        const labId = user?.labId || null;
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            try {
                const res = await axios.get('/api/help/topics', { params: { locale } });
                if (res.data?.success && Array.isArray(res.data.topics)) {
                    return { topics: res.data.topics, isOffline: false };
                }
            } catch (err) {
                console.warn('[HELP_CLIENT] Network fetch topics failed, falling back to offline storage:', err.message);
            }
        }

        // Offline fallback
        const meta = await getOfflineHelpMeta({ labId, locale });
        const categories = meta?.categories || [];
        const offlineArticles = await getOfflineHelpArticles({ labId, locale });

        const countByCategory = {};
        offlineArticles.forEach(a => {
            countByCategory[a.category] = (countByCategory[a.category] || 0) + 1;
        });

        const topics = categories.map(cat => ({
            id: cat.id,
            icon: cat.icon,
            title: cat.title || cat.titles?.[locale] || cat.titles?.en || cat.id,
            description: cat.description || cat.descriptions?.[locale] || cat.descriptions?.en || '',
            articleCount: countByCategory[cat.id] || 0
        }));

        return {
            topics,
            isOffline: true,
            lastSync: meta?.lastSync || null
        };
    },

    /**
     * Fetch articles list by category or role
     */
    async getArticles({ category = null, role = null, locale = 'en', user = null } = {}) {
        const labId = user?.labId || null;
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            try {
                const res = await axios.get('/api/help/articles', {
                    params: { category, role, locale }
                });
                if (res.data?.success && Array.isArray(res.data.articles)) {
                    return { articles: res.data.articles, isOffline: false };
                }
            } catch (err) {
                console.warn('[HELP_CLIENT] Network fetch articles failed, falling back to offline storage:', err.message);
            }
        }

        // Offline fallback
        const meta = await getOfflineHelpMeta({ labId, locale });
        let articles = await getOfflineHelpArticles({ category, labId, locale });

        if (role && role !== 'all') {
            articles = articles.filter(a => {
                const roles = a.roles || ['all'];
                return roles.includes('all') || roles.includes(role.toLowerCase());
            });
        }

        return {
            articles,
            isOffline: true,
            lastSync: meta?.lastSync || null
        };
    },

    /**
     * Fetch single article by ID
     */
    async getArticleById(articleId, { locale = 'en', user = null } = {}) {
        const labId = user?.labId || null;
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            try {
                const res = await axios.get(`/api/help/articles/${articleId}`, {
                    params: { locale }
                });
                if (res.data?.success && res.data.article) {
                    return { article: res.data.article, isOffline: false };
                }
            } catch (err) {
                console.warn(`[HELP_CLIENT] Network fetch article ${articleId} failed, falling back to offline storage:`, err.message);
            }
        }

        // Offline fallback
        const meta = await getOfflineHelpMeta({ labId, locale });
        const article = await getOfflineHelpArticle(articleId, { labId, locale });

        return {
            article,
            isOffline: true,
            lastSync: meta?.lastSync || null
        };
    },

    /**
     * Search help articles (online API with client-side offline scoring)
     */
    async searchHelp({ query = '', topic = null, role = null, locale = 'en', user = null, limit = 20, offset = 0 } = {}) {
        const labId = user?.labId || null;
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            try {
                const res = await axios.get('/api/help/search', {
                    params: { q: query, topic, role, locale, limit, offset }
                });
                if (res.data?.success) {
                    return {
                        total: res.data.total,
                        results: res.data.results || [],
                        isOffline: false
                    };
                }
            } catch (err) {
                console.warn('[HELP_CLIENT] Network search failed, falling back to offline search:', err.message);
            }
        }

        // Client-side offline search fallback
        const meta = await getOfflineHelpMeta({ labId, locale });
        const allArticles = await getOfflineHelpArticles({ category: topic, labId, locale });
        const normQuery = normalizeString(query);

        if (!normQuery) {
            return { total: 0, results: [], isOffline: true, lastSync: meta?.lastSync };
        }

        const queryTokens = normQuery.split(/\s+/).filter(Boolean);
        const scored = [];

        for (const art of allArticles) {
            if (role && role !== 'all') {
                const roles = art.roles || ['all'];
                if (!roles.includes('all') && !roles.includes(role.toLowerCase())) continue;
            }

            const normTitle = normalizeString(art.title || '');
            const normSummary = normalizeString(art.summary || '');
            const normKeywords = normalizeString(Array.isArray(art.keywords) ? art.keywords.join(' ') : (art.keywords || ''));
            const normSteps = normalizeString(Array.isArray(art.steps) ? art.steps.join(' ') : (art.steps || ''));

            let score = 0;
            if (normTitle === normQuery || art.id === normQuery) score += 100;
            else if (normTitle.includes(normQuery)) score += 50;

            if (normKeywords.includes(normQuery)) score += 40;
            if (normSummary.includes(normQuery)) score += 20;
            if (normSteps.includes(normQuery)) score += 10;

            for (const t of queryTokens) {
                if (normTitle.includes(t)) score += 25;
                if (normKeywords.includes(t)) score += 20;
                if (normSummary.includes(t)) score += 15;
                if (normSteps.includes(t)) score += 8;
            }

            if (score > 0) {
                scored.push({ score, article: art });
            }
        }

        scored.sort((a, b) => b.score - a.score);
        const paginated = scored.slice(offset, offset + limit).map(s => s.article);

        return {
            total: scored.length,
            results: paginated,
            isOffline: true,
            lastSync: meta?.lastSync || null
        };
    },

    /**
     * Resolve contextual help for page and live blockers
     */
    async getContextHelp({ route = '/', blockerCodes = [], locale = 'en', user = null } = {}) {
        const labId = user?.labId || null;
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            try {
                const res = await axios.get('/api/help/context', {
                    params: {
                        route,
                        blockers: blockerCodes.length > 0 ? JSON.stringify(blockerCodes) : undefined,
                        locale
                    }
                });
                if (res.data?.success) {
                    return {
                        route: res.data.route,
                        blockers: res.data.blockers || [],
                        articles: res.data.articles || [],
                        isOffline: false
                    };
                }
            } catch (err) {
                console.warn('[HELP_CLIENT] Network context fetch failed, falling back to offline storage:', err.message);
            }
        }

        // Offline context fallback using cached routeMap and articles
        const meta = await getOfflineHelpMeta({ labId, locale });
        const routeMap = meta?.routeMap || { routes: [], blockers: {} };
        const normalizedRoute = route.split('?')[0].replace(/\/$/, '') || '/';

        let matchedArticleIds = [];
        const exactMatch = (routeMap.routes || []).find(r => r.route === normalizedRoute);
        if (exactMatch) {
            matchedArticleIds = [...(exactMatch.articleIds || [])];
        } else {
            const patternMatch = (routeMap.routes || []).find(r => {
                if (!r.route.includes(':')) return false;
                const regex = new RegExp('^' + r.route.replace(/:[a-zA-Z0-9_-]+/g, '[^/]+') + '$');
                return regex.test(normalizedRoute);
            });
            if (patternMatch) {
                matchedArticleIds = [...(patternMatch.articleIds || [])];
            } else {
                matchedArticleIds = ['manage-load-error', 'manage-support'];
            }
        }

        const resolvedBlockers = [];
        if (Array.isArray(blockerCodes) && blockerCodes.length > 0) {
            for (const code of blockerCodes) {
                const mappedId = routeMap.blockers?.[code] || routeMap.unknownCodeArticle || 'bench-blocked';
                resolvedBlockers.push({ code, articleId: mappedId });
                if (!matchedArticleIds.includes(mappedId)) {
                    matchedArticleIds.unshift(mappedId);
                }
            }
        }

        const allArticles = await getOfflineHelpArticles({ labId, locale });
        const articleMap = new Map();
        allArticles.forEach(a => articleMap.set(a.id, a));

        const orderedArticles = matchedArticleIds
            .map(id => articleMap.get(id))
            .filter(Boolean);

        return {
            route: normalizedRoute,
            blockers: resolvedBlockers,
            articles: orderedArticles,
            isOffline: true,
            lastSync: meta?.lastSync || null
        };
    },

    /**
     * Submit feedback
     */
    async recordFeedback({ articleId, revisionId, locale, useful, comment, category, user }) {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            return axios.post('/api/help/feedback', {
                articleId,
                revisionId,
                locale,
                useful,
                comment,
                category
            });
        }
        // Offline: acknowledge locally
        return { data: { success: true, offlineQueued: true } };
    },

    /**
     * Fetch support configuration
     */
    async getSupportConfig(user = null) {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            try {
                const res = await axios.get('/api/help/support-config');
                if (res.data?.success) {
                    return res.data;
                }
            } catch (err) {
                console.warn('[HELP_CLIENT] Failed to fetch support config:', err.message);
            }
        }

        return {
            success: true,
            isConfigured: false,
            support: null,
            isOffline: true
        };
    }
};

export default helpClientService;
