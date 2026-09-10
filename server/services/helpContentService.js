const fs = require('fs');
const path = require('path');
const prisma = require('../prisma');

// Static categories metadata from content contract
const CATEGORIES = [
    { id: 'start', title: 'Getting started', description: 'Find your way and prepare for a shift.', icon: 'compass' },
    { id: 'intake', title: 'Receiving samples', description: 'Identity, condition, field context and labels.', icon: 'package-check' },
    { id: 'bench', title: 'Working at the bench', description: 'Preparation, method runs and result entry.', icon: 'flask-conical' },
    { id: 'review', title: 'Review & reports', description: 'Check evidence, return work and release reports.', icon: 'clipboard-check' },
    { id: 'assets', title: 'Equipment & stock', description: 'Use eligible instruments and traceable materials.', icon: 'microscope' },
    { id: 'offline', title: 'Mobile & offline', description: 'Device saves, synchronization and recovery.', icon: 'cloud-download' },
    { id: 'connect', title: 'Projects & connections', description: 'KoBo field records, projects and SIS exchange.', icon: 'network' },
    { id: 'manage', title: 'Managing the laboratory', description: 'Assignments, configuration and language.', icon: 'settings-2' }
];

// Fallback notices for unreviewed locales
const FALLBACK_NOTICES = {
    en: 'This article is available in English.',
    es: 'Este artículo está disponible en inglés. Todavía no hay una traducción revisada.',
    'es-419': 'Este artículo está disponible en inglés. Aún no hay una traducción revisada.',
    fr: 'Cet article est disponible en anglais. Aucune traduction révisée n’est encore disponible.',
    pt: 'Este artigo está disponível em inglês. Ainda não existe uma tradução revista.'
};

// Route and blocker map
let cachedRouteMap = null;
function getRouteMap() {
    if (cachedRouteMap) return cachedRouteMap;
    const mapPath = path.resolve(__dirname, '../../WP/help-knowledge-base-v1/route-help-map.json');
    if (fs.existsSync(mapPath)) {
        try {
            cachedRouteMap = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
        } catch (e) {
            console.error('[HELP_SERVICE] Failed to read route-help-map.json:', e);
        }
    }
    return cachedRouteMap || { routes: [], blockers: {} };
}

// Helpers
const normalizeString = (str = '') => {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
};

const sanitizeHtml = (str = '') => {
    return String(str)
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

/**
 * Return categories with counts of approved articles available to the user
 */
async function getTopics(user = null) {
    const isAuth = !!user;
    const allowedVisibilities = isAuth ? ['PUBLIC', 'AUTHENTICATED'] : ['PUBLIC'];

    const articles = await prisma.helpArticle.findMany({
        where: {
            archivedAt: null,
            visibility: { in: allowedVisibilities },
            publications: {
                some: { isCurrent: true }
            }
        },
        select: { id: true, category: true }
    });

    const countByCategory = {};
    articles.forEach(a => {
        countByCategory[a.category] = (countByCategory[a.category] || 0) + 1;
    });

    return CATEGORIES.map(cat => ({
        ...cat,
        articleCount: countByCategory[cat.id] || 0
    }));
}

/**
 * Get articles by category or search filters
 */
async function getArticles({ category = null, role = null, user = null, locale = 'en' }) {
    const isAuth = !!user;
    const allowedVisibilities = isAuth ? ['PUBLIC', 'AUTHENTICATED'] : ['PUBLIC'];

    const where = {
        archivedAt: null,
        visibility: { in: allowedVisibilities },
        publications: {
            some: { isCurrent: true }
        }
    };

    if (category) {
        where.category = category;
    }

    const rawArticles = await prisma.helpArticle.findMany({
        where,
        include: {
            publications: {
                where: { isCurrent: true },
                include: {
                    revision: {
                        include: {
                            locales: true
                        }
                    }
                }
            }
        },
        orderBy: { id: 'asc' }
    });

    return rawArticles
        .filter(article => {
            if (!role || role === 'all') return true;
            try {
                const roles = JSON.parse(article.roles || '[]');
                return roles.includes('all') || roles.includes(role.toLowerCase());
            } catch (e) {
                return true;
            }
        })
        .map(article => {
            const pub = article.publications[0];
            const rev = pub?.revision;
            const targetLocaleRev = rev?.locales?.find(l => l.locale === locale);
            const isApproved = targetLocaleRev && targetLocaleRev.reviewStatus === 'APPROVED';
            const isFallback = !isApproved && locale !== 'en';

            return {
                id: article.id,
                category: article.category,
                kind: article.kind,
                feature: article.feature,
                title: (isApproved ? targetLocaleRev.title : rev?.title) || article.id,
                summary: (isApproved ? targetLocaleRev.summary : rev?.summary) || '',
                minutes: article.minutes,
                roles: JSON.parse(article.roles || '["all"]'),
                keywords: JSON.parse(article.keywords || '[]'),
                isFallback,
                localeNotice: isFallback ? (FALLBACK_NOTICES[locale] || FALLBACK_NOTICES.en) : null
            };
        });
}

/**
 * Get single full article by ID
 */
async function getArticleById(articleId, user = null, locale = 'en') {
    const isAuth = !!user;
    const allowedVisibilities = isAuth ? ['PUBLIC', 'AUTHENTICATED'] : ['PUBLIC'];

    const article = await prisma.helpArticle.findFirst({
        where: {
            id: articleId,
            archivedAt: null,
            visibility: { in: allowedVisibilities }
        },
        include: {
            publications: {
                where: { isCurrent: true },
                include: {
                    revision: {
                        include: {
                            locales: true
                        }
                    }
                }
            },
            labNotes: user?.labId ? {
                where: {
                    labId: user.labId,
                    isActive: true
                }
            } : false
        }
    });

    if (!article) return null;

    const pub = article.publications[0];
    const rev = pub?.revision;
    if (!rev) return null;

    const targetLocaleRev = rev.locales.find(l => l.locale === locale);
    const isApproved = targetLocaleRev && targetLocaleRev.reviewStatus === 'APPROVED';
    const isFallback = !isApproved && locale !== 'en';

    // Content payload: use approved locale or fall back to English source
    const content = isApproved ? targetLocaleRev : rev;

    // Fetch related articles summaries
    let relatedArticles = [];
    try {
        const relatedIds = JSON.parse(rev.related || '[]');
        if (relatedIds.length > 0) {
            const relatedRecords = await prisma.helpArticle.findMany({
                where: {
                    id: { in: relatedIds },
                    archivedAt: null,
                    visibility: { in: allowedVisibilities },
                    publications: { some: { isCurrent: true } }
                },
                include: {
                    publications: {
                        where: { isCurrent: true },
                        include: { revision: true }
                    }
                }
            });

            relatedArticles = relatedRecords.map(r => ({
                id: r.id,
                category: r.category,
                kind: r.kind,
                title: r.publications[0]?.revision?.title || r.id,
                summary: r.publications[0]?.revision?.summary || '',
                minutes: r.minutes
            }));
        }
    } catch (e) {
        console.warn('[HELP_SERVICE] Failed parsing related articles:', e.message);
    }

    // Lab note (strictly scoped to user's assigned lab)
    const labNote = article.labNotes?.[0] ? {
        noteText: article.labNotes[0].noteText,
        updatedAt: article.labNotes[0].updatedAt
    } : null;

    return {
        id: article.id,
        category: article.category,
        kind: article.kind,
        feature: article.feature,
        roles: JSON.parse(article.roles || '["all"]'),
        keywords: JSON.parse(article.keywords || '[]'),
        minutes: article.minutes,
        reviewOwner: article.reviewOwner,
        revisionNumber: rev.revisionNumber,
        publishedAt: pub.publishedAt,
        title: content.title,
        summary: content.summary,
        steps: JSON.parse(content.steps || '[]'),
        success: content.success,
        caution: content.caution,
        relatedArticles,
        labNote,
        isFallback,
        localeNotice: isFallback ? (FALLBACK_NOTICES[locale] || FALLBACK_NOTICES.en) : null
    };
}

const SYNONYMS = {
    metodo: 'method',
    metodos: 'methods',
    preparacion: 'preparation',
    preparacao: 'preparation',
    sechage: 'drying',
    secado: 'drying',
    secagem: 'drying',
    recepcion: 'reception',
    recepcao: 'reception',
    espectro: 'spectrum',
    espectros: 'spectra',
    spectre: 'spectrum',
    spectres: 'spectra',
    resultado: 'result',
    resultados: 'results',
    resultats: 'results',
    aprobacion: 'approval',
    aprovacao: 'approval',
    muestra: 'sample',
    muestras: 'samples',
    amostra: 'sample',
    echantillon: 'sample'
};

/**
 * Search articles across titles, summaries, steps, and keywords
 */
async function searchHelp({ query = '', topic = null, role = null, user = null, locale = 'en', limit = 20, offset = 0 }) {
    const rawQuery = String(query).trim();
    if (!rawQuery) {
        return { total: 0, results: [] };
    }

    const normQuery = normalizeString(rawQuery);
    const queryTokens = normQuery.split(/\s+/).filter(t => t.length > 1);
    const searchTokens = [...new Set([...queryTokens, ...queryTokens.map(t => SYNONYMS[t]).filter(Boolean)])];

    const isAuth = !!user;
    const allowedVisibilities = isAuth ? ['PUBLIC', 'AUTHENTICATED'] : ['PUBLIC'];

    const where = {
        archivedAt: null,
        visibility: { in: allowedVisibilities },
        publications: {
            some: { isCurrent: true }
        }
    };

    if (topic && topic !== 'all') {
        where.category = topic;
    }

    const articles = await prisma.helpArticle.findMany({
        where,
        include: {
            publications: {
                where: { isCurrent: true },
                include: {
                    revision: {
                        include: { locales: true }
                    }
                }
            }
        }
    });

    const scoredResults = [];

    for (const article of articles) {
        const pub = article.publications[0];
        const rev = pub?.revision;
        if (!rev) continue;

        // Role filtering
        if (role && role !== 'all') {
            try {
                const roles = JSON.parse(article.roles || '[]');
                if (!roles.includes('all') && !roles.includes(role.toLowerCase())) {
                    continue;
                }
            } catch (e) { }
        }

        const targetLocaleRev = rev.locales?.find(l => l.locale === locale);
        const isApproved = targetLocaleRev && targetLocaleRev.reviewStatus === 'APPROVED';
        const isFallback = !isApproved && locale !== 'en';
        const activeContent = isApproved ? targetLocaleRev : rev;

        const normTitle = normalizeString(activeContent.title || '');
        const normSummary = normalizeString(activeContent.summary || '');
        const normKeywords = normalizeString(article.keywords || '');
        const normSteps = normalizeString(activeContent.steps || '');
        const normId = normalizeString(article.id);

        let score = 0;

        // Exact title or ID match
        if (normTitle === normQuery || normId === normQuery) score += 100;
        else if (normTitle.includes(normQuery)) score += 50;

        // Keyword match (e.g. MIR, NIR, pH)
        if (normKeywords.includes(normQuery)) score += 40;

        // Summary match
        if (normSummary.includes(normQuery)) score += 20;

        // Steps match
        if (normSteps.includes(normQuery)) score += 10;

        // Token and synonym matching
        for (const token of searchTokens) {
            if (normTitle.includes(token)) score += 25;
            if (normKeywords.includes(token)) score += 20;
            if (normSummary.includes(token)) score += 15;
            if (normSteps.includes(token)) score += 8;
        }

        if (score > 0) {
            scoredResults.push({
                score,
                article: {
                    id: article.id,
                    category: article.category,
                    kind: article.kind,
                    title: activeContent.title,
                    summary: activeContent.summary,
                    minutes: article.minutes,
                    isFallback,
                    localeNotice: isFallback ? (FALLBACK_NOTICES[locale] || FALLBACK_NOTICES.en) : null
                }
            });
        }
    }

    scoredResults.sort((a, b) => b.score - a.score);

    const total = scoredResults.length;
    const paginated = scoredResults.slice(offset, offset + limit).map(r => r.article);

    return { total, results: paginated };
}

/**
 * Contextual help resolver for routes and live readiness blocker codes
 */
async function getContextHelp({ route = '/', blockerCodes = [], user = null, locale = 'en' }) {
    const routeMap = getRouteMap();
    const isAuth = !!user;

    // 1. Resolve route mapping
    let matchedArticleIds = [];
    const normalizedRoute = route.split('?')[0].replace(/\/$/, '') || '/';

    // Route matching order: exact match -> parameterized pattern -> wildcard
    const exactMatch = routeMap.routes.find(r => r.route === normalizedRoute);
    if (exactMatch) {
        matchedArticleIds = exactMatch.articleIds || [];
    } else {
        // Pattern match (e.g. /samples/:id)
        const patternMatch = routeMap.routes.find(r => {
            if (!r.route.includes(':')) return false;
            const regex = new RegExp('^' + r.route.replace(/:[a-zA-Z0-9_-]+/g, '[^/]+') + '$');
            return regex.test(normalizedRoute);
        });
        if (patternMatch) {
            matchedArticleIds = patternMatch.articleIds || [];
        } else {
            const wildcard = routeMap.routes.find(r => r.route === '*');
            matchedArticleIds = wildcard ? wildcard.articleIds : ['manage-load-error', 'manage-support'];
        }
    }

    // 2. Resolve blocker codes (e.g. DRYING_PREREQUISITE_BLOCKED -> bench-drying)
    const resolvedBlockers = [];
    if (Array.isArray(blockerCodes) && blockerCodes.length > 0) {
        for (const code of blockerCodes) {
            const mappedArticleId = routeMap.blockers[code] || routeMap.unknownCodeArticle || 'bench-blocked';
            resolvedBlockers.push({
                code,
                articleId: mappedArticleId
            });
            if (!matchedArticleIds.includes(mappedArticleId)) {
                // Prepend blocker article to front of recommendations
                matchedArticleIds.unshift(mappedArticleId);
            }
        }
    }

    // 3. Load recommended articles
    const allowedVisibilities = isAuth ? ['PUBLIC', 'AUTHENTICATED'] : ['PUBLIC'];
    const articles = await prisma.helpArticle.findMany({
        where: {
            id: { in: matchedArticleIds },
            archivedAt: null,
            visibility: { in: allowedVisibilities },
            publications: { some: { isCurrent: true } }
        },
        include: {
            publications: {
                where: { isCurrent: true },
                include: {
                    revision: {
                        include: { locales: true }
                    }
                }
            },
            labNotes: user?.labId ? {
                where: { labId: user.labId, isActive: true }
            } : false
        }
    });

    const articleMap = new Map();
    for (const a of articles) {
        const pub = a.publications[0];
        const rev = pub?.revision;
        if (!rev) continue;

        const targetLocaleRev = rev.locales?.find(l => l.locale === locale);
        const isApproved = targetLocaleRev && targetLocaleRev.reviewStatus === 'APPROVED';
        const isFallback = !isApproved && locale !== 'en';
        const activeContent = isApproved ? targetLocaleRev : rev;

        articleMap.set(a.id, {
            id: a.id,
            category: a.category,
            kind: a.kind,
            title: activeContent.title,
            summary: activeContent.summary,
            minutes: a.minutes,
            labNote: a.labNotes?.[0] ? a.labNotes[0].noteText : null,
            isFallback,
            localeNotice: isFallback ? (FALLBACK_NOTICES[locale] || FALLBACK_NOTICES.en) : null
        });
    }

    const orderedArticles = matchedArticleIds
        .map(id => articleMap.get(id))
        .filter(Boolean);

    return {
        route: normalizedRoute,
        blockers: resolvedBlockers,
        articles: orderedArticles
    };
}

/**
 * Record feedback for an article
 */
async function recordFeedback({ articleId, revisionId = null, locale = 'en', useful, comment = '', category = null, user = null }) {
    const sanitizedComment = sanitizeHtml(comment.slice(0, 1000));

    return await prisma.helpFeedback.create({
        data: {
            articleId,
            revisionId,
            locale,
            useful: !!useful,
            comment: sanitizedComment || null,
            category: category ? String(category).slice(0, 50) : null,
            userId: user?.id || null
        }
    });
}

/**
 * Build offline pack bundle for synchronization
 */
async function getOfflinePack({ user = null, locale = 'en' }) {
    const isAuth = !!user;
    const allowedVisibilities = isAuth ? ['PUBLIC', 'AUTHENTICATED'] : ['PUBLIC'];

    const articles = await prisma.helpArticle.findMany({
        where: {
            archivedAt: null,
            visibility: { in: allowedVisibilities },
            publications: { some: { isCurrent: true } }
        },
        include: {
            publications: {
                where: { isCurrent: true },
                include: {
                    revision: {
                        include: { locales: true }
                    }
                }
            },
            labNotes: user?.labId ? {
                where: { labId: user.labId, isActive: true }
            } : false
        }
    });

    const routeMap = getRouteMap();

    const items = articles.map(article => {
        const pub = article.publications[0];
        const rev = pub?.revision;
        const targetLocaleRev = rev?.locales?.find(l => l.locale === locale);
        const isApproved = targetLocaleRev && targetLocaleRev.reviewStatus === 'APPROVED';
        const isFallback = !isApproved && locale !== 'en';
        const content = isApproved ? targetLocaleRev : rev;

        return {
            id: article.id,
            category: article.category,
            kind: article.kind,
            feature: article.feature,
            roles: JSON.parse(article.roles || '["all"]'),
            keywords: JSON.parse(article.keywords || '[]'),
            minutes: article.minutes,
            title: content.title,
            summary: content.summary,
            steps: JSON.parse(content.steps || '[]'),
            success: content.success,
            caution: content.caution,
            related: JSON.parse(rev.related || '[]'),
            labNote: article.labNotes?.[0]?.noteText || null,
            isFallback,
            localeNotice: isFallback ? (FALLBACK_NOTICES[locale] || FALLBACK_NOTICES.en) : null
        };
    });

    return {
        packVersion: 1,
        locale,
        generatedAt: new Date().toISOString(),
        categories: CATEGORIES,
        routeMap: {
            blockers: routeMap.blockers,
            unknownCodeArticle: routeMap.unknownCodeArticle
        },
        articles: items
    };
}

module.exports = {
    CATEGORIES,
    getTopics,
    getArticles,
    getArticleById,
    searchHelp,
    getContextHelp,
    recordFeedback,
    getOfflinePack
};
