const fs = require('fs');
const path = require('path');
const prisma = require('../prisma');

// Load runtime data from server/data/help/
const HELP_DATA_DIR = path.resolve(__dirname, '../data/help');

function loadJsonFile(fileName, fallback = null) {
    const fullPath = path.join(HELP_DATA_DIR, fileName);
    if (fs.existsSync(fullPath)) {
        try {
            return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        } catch (e) {
            console.error(`[HELP_SERVICE] Failed to read ${fileName}:`, e.message);
        }
    }
    return fallback;
}

// Route and blocker map (cached)
let cachedRouteMap = null;
function getRouteMap() {
    if (cachedRouteMap) return cachedRouteMap;
    const map = loadJsonFile('route-help-map.json', { routes: [], blockers: {} });
    cachedRouteMap = map;
    return cachedRouteMap;
}

// Categories with multi-language metadata
let cachedCategories = null;
function getCategories() {
    if (cachedCategories) return cachedCategories;
    const cats = loadJsonFile('categories.json', []);
    cachedCategories = cats;
    return cachedCategories;
}

// Synonyms dictionary for multi-language search
let cachedSynonyms = null;
function getSynonyms() {
    if (cachedSynonyms) return cachedSynonyms;
    const syns = loadJsonFile('synonyms.json', {});
    cachedSynonyms = syns;
    return cachedSynonyms;
}

// Fallback notices for unreviewed locales
const FALLBACK_NOTICES = {
    en: 'This article is available in English.',
    es: 'Este artículo está disponible en inglés. Todavía no hay una traducción revisada.',
    'es-419': 'Este artículo está disponible en inglés. Aún no hay una traducción revisada.',
    fr: 'Cet article est disponible en anglais. Aucune traduction révisée n’est encore disponible.',
    pt: 'Este artigo está disponível em inglês. Ainda não existe uma tradução revista.'
};

// String normalization for accented & typo-tolerant search
const normalizeString = (str = '') => {
    return String(str)
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
 * Return categories with counts of approved articles available to the user.
 * Returns localized titles and descriptions based on requested locale.
 */
async function getTopics(user = null, locale = 'en', preview = false) {
    const isAuth = !!user;
    const allowedVisibilities = isAuth ? ['PUBLIC', 'AUTHENTICATED'] : ['PUBLIC'];
    const canPreview = preview && isAuth && (user.role === 'SUPER_ADMIN' || user.permissions?.includes('HELP_EDIT_GLOBAL'));

    const where = {
        archivedAt: null,
        visibility: { in: allowedVisibilities }
    };

    if (!canPreview) {
        where.publications = { some: { isCurrent: true } };
    }

    const articles = await prisma.helpArticle.findMany({
        where,
        select: { id: true, category: true }
    });

    const countByCategory = {};
    articles.forEach(a => {
        countByCategory[a.category] = (countByCategory[a.category] || 0) + 1;
    });

    const rawCategories = getCategories();
    return rawCategories.map(cat => ({
        id: cat.id,
        icon: cat.icon,
        title: cat.titles?.[locale] || cat.titles?.en || cat.id,
        description: cat.descriptions?.[locale] || cat.descriptions?.en || '',
        articleCount: countByCategory[cat.id] || 0
    }));
}

/**
 * Get articles by category or search filters.
 * Returns published articles only, unless preview=true is requested by an authorized editor.
 */
async function getArticles({ category = null, role = null, user = null, locale = 'en', preview = false }) {
    const isAuth = !!user;
    const allowedVisibilities = isAuth ? ['PUBLIC', 'AUTHENTICATED'] : ['PUBLIC'];
    const canPreview = preview && isAuth && (user.role === 'SUPER_ADMIN' || user.permissions?.includes('HELP_EDIT_GLOBAL'));

    const where = {
        archivedAt: null,
        visibility: { in: allowedVisibilities }
    };

    if (!canPreview) {
        where.publications = { some: { isCurrent: true } };
    }

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
                        include: { locales: true }
                    }
                }
            },
            revisions: canPreview ? {
                orderBy: { revisionNumber: 'desc' },
                take: 1,
                include: { locales: true }
            } : false,
            labNotes: user?.labId ? {
                where: { labId: user.labId, isActive: true }
            } : false
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
            const pub = article.publications?.[0];
            const rev = canPreview ? (pub?.revision || article.revisions?.[0]) : pub?.revision;
            if (!rev) return null;

            const targetLocaleRev = rev?.locales?.find(l => l.locale === locale);
            const isApproved = targetLocaleRev && targetLocaleRev.reviewStatus === 'APPROVED';
            const isFallback = !isApproved && locale !== 'en';
            const content = targetLocaleRev || rev;

            return {
                id: article.id,
                category: article.category,
                kind: article.kind,
                feature: article.feature,
                roles: JSON.parse(article.roles || '["all"]'),
                keywords: JSON.parse(article.keywords || '[]'),
                minutes: article.minutes,
                reviewOwner: article.reviewOwner,
                visibility: article.visibility,
                title: content.title || rev.title,
                summary: content.summary || rev.summary,
                isFallback,
                localeNotice: isFallback ? (FALLBACK_NOTICES[locale] || FALLBACK_NOTICES.en) : null,
                isDraftPreview: !pub && canPreview,
                labNote: article.labNotes?.[0] ? {
                    id: article.labNotes[0].id,
                    noteText: article.labNotes[0].noteText,
                    isActive: article.labNotes[0].isActive
                } : null
            };
        })
        .filter(Boolean);
}

/**
 * Get detailed article by ID
 */
async function getArticleById(articleId, user = null, locale = 'en', preview = false) {
    const isAuth = !!user;
    const allowedVisibilities = isAuth ? ['PUBLIC', 'AUTHENTICATED'] : ['PUBLIC'];
    const canPreview = preview && isAuth && (user.role === 'SUPER_ADMIN' || user.permissions?.includes('HELP_EDIT_GLOBAL'));

    const where = {
        id: articleId,
        archivedAt: null,
        visibility: { in: allowedVisibilities }
    };

    if (!canPreview) {
        where.publications = { some: { isCurrent: true } };
    }

    const article = await prisma.helpArticle.findFirst({
        where,
        include: {
            publications: {
                where: { isCurrent: true },
                include: {
                    revision: {
                        include: { locales: true }
                    }
                }
            },
            revisions: canPreview ? {
                orderBy: { revisionNumber: 'desc' },
                take: 1,
                include: { locales: true }
            } : false,
            labNotes: user?.labId ? {
                where: { labId: user.labId, isActive: true }
            } : false
        }
    });

    if (!article) return null;

    const pub = article.publications?.[0];
    const rev = canPreview ? (pub?.revision || article.revisions?.[0]) : pub?.revision;
    if (!rev) return null;

    const targetLocaleRev = rev.locales?.find(l => l.locale === locale);
    const isApproved = targetLocaleRev && targetLocaleRev.reviewStatus === 'APPROVED';
    const isFallback = !isApproved && locale !== 'en';
    const activeContent = targetLocaleRev || rev;

    let steps = [];
    try {
        steps = JSON.parse(activeContent.steps || rev.steps || '[]');
    } catch (e) {
        steps = [];
    }

    let related = [];
    try {
        related = JSON.parse(rev.related || '[]');
    } catch (e) {
        related = [];
    }

    return {
        id: article.id,
        category: article.category,
        kind: article.kind,
        feature: article.feature,
        roles: JSON.parse(article.roles || '["all"]'),
        keywords: JSON.parse(article.keywords || '[]'),
        minutes: article.minutes,
        reviewOwner: article.reviewOwner,
        visibility: article.visibility,
        title: activeContent.title || rev.title,
        summary: activeContent.summary || rev.summary,
        steps,
        success: activeContent.success || rev.success || '',
        caution: activeContent.caution || rev.caution || '',
        related,
        sourceLocale: rev.sourceLocale,
        revisionNumber: rev.revisionNumber,
        publishedAt: pub?.publishedAt || null,
        isFallback,
        localeNotice: isFallback ? (FALLBACK_NOTICES[locale] || FALLBACK_NOTICES.en) : null,
        isDraftPreview: !pub && canPreview,
        labNote: article.labNotes?.[0] ? {
            id: article.labNotes[0].id,
            noteText: article.labNotes[0].noteText,
            isActive: article.labNotes[0].isActive
        } : null
    };
}

/**
 * Search articles using multi-language token and synonym scoring
 */
async function searchHelp({ query = '', topic = null, role = null, user = null, locale = 'en', limit = 20, offset = 0, preview = false }) {
    const normQuery = normalizeString(query);
    if (!normQuery) {
        return { total: 0, results: [] };
    }

    const queryTokens = normQuery.split(/\s+/).filter(Boolean);
    const synonymsDict = getSynonyms();

    // Expand search tokens with synonyms across languages
    const searchTokens = new Set(queryTokens);
    for (const [canonicalKey, synonymList] of Object.entries(synonymsDict)) {
        const canonicalNorm = normalizeString(canonicalKey);
        const allSyns = [canonicalNorm, ...(synonymList || []).map(normalizeString)];
        if (allSyns.some(s => queryTokens.includes(s) || normQuery.includes(s))) {
            allSyns.forEach(s => searchTokens.add(s));
        }
    }

    const isAuth = !!user;
    const allowedVisibilities = isAuth ? ['PUBLIC', 'AUTHENTICATED'] : ['PUBLIC'];
    const canPreview = preview && isAuth && (user.role === 'SUPER_ADMIN' || user.permissions?.includes('HELP_EDIT_GLOBAL'));

    const where = {
        archivedAt: null,
        visibility: { in: allowedVisibilities }
    };

    if (!canPreview) {
        where.publications = { some: { isCurrent: true } };
    }

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
            },
            revisions: canPreview ? {
                orderBy: { revisionNumber: 'desc' },
                take: 1,
                include: { locales: true }
            } : false
        }
    });

    const scoredResults = [];

    for (const article of articles) {
        const pub = article.publications?.[0];
        const rev = canPreview ? (pub?.revision || article.revisions?.[0]) : pub?.revision;
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
        const activeContent = targetLocaleRev || rev;

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
                    title: activeContent.title || rev.title,
                    summary: activeContent.summary || rev.summary,
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
 * Contextual help resolver for routes and live readiness blocker codes.
 * Deep copies matched article arrays so blocker resolution NEVER contaminates cached route maps!
 */
async function getContextHelp({ route = '/', blockerCodes = [], user = null, locale = 'en', preview = false }) {
    const routeMap = getRouteMap();
    const isAuth = !!user;
    const canPreview = preview && isAuth && (user.role === 'SUPER_ADMIN' || user.permissions?.includes('HELP_EDIT_GLOBAL'));

    // 1. Resolve route mapping
    let matchedArticleIds = [];
    const normalizedRoute = route.split('?')[0].replace(/\/$/, '') || '/';

    const exactMatch = (routeMap.routes || []).find(r => r.route === normalizedRoute);
    if (exactMatch) {
        // Deep clone to prevent cached array mutation (Finding 4)
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
            const wildcard = (routeMap.routes || []).find(r => r.route === '*');
            matchedArticleIds = [...(wildcard?.articleIds || ['manage-load-error', 'manage-support'])];
        }
    }

    // 2. Resolve blocker codes (e.g. DRYING_PREREQUISITE_BLOCKED -> bench-drying)
    const resolvedBlockers = [];
    if (Array.isArray(blockerCodes) && blockerCodes.length > 0) {
        for (const code of blockerCodes) {
            const mappedArticleId = routeMap.blockers?.[code] || routeMap.unknownCodeArticle || 'bench-blocked';
            resolvedBlockers.push({
                code,
                articleId: mappedArticleId
            });
            if (!matchedArticleIds.includes(mappedArticleId)) {
                // Prepend blocker article to front of recommendations without mutating source registry
                matchedArticleIds.unshift(mappedArticleId);
            }
        }
    }

    // 3. Load recommended articles
    const allowedVisibilities = isAuth ? ['PUBLIC', 'AUTHENTICATED'] : ['PUBLIC'];
    const where = {
        id: { in: matchedArticleIds },
        archivedAt: null,
        visibility: { in: allowedVisibilities }
    };

    if (!canPreview) {
        where.publications = { some: { isCurrent: true } };
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
            },
            revisions: canPreview ? {
                orderBy: { revisionNumber: 'desc' },
                take: 1,
                include: { locales: true }
            } : false,
            labNotes: user?.labId ? {
                where: { labId: user.labId, isActive: true }
            } : false
        }
    });

    const articleMap = new Map();
    for (const a of articles) {
        const pub = a.publications?.[0];
        const rev = canPreview ? (pub?.revision || a.revisions?.[0]) : pub?.revision;
        if (!rev) continue;

        const targetLocaleRev = rev.locales?.find(l => l.locale === locale);
        const isApproved = targetLocaleRev && targetLocaleRev.reviewStatus === 'APPROVED';
        const isFallback = !isApproved && locale !== 'en';
        const activeContent = targetLocaleRev || rev;

        articleMap.set(a.id, {
            id: a.id,
            category: a.category,
            kind: a.kind,
            title: activeContent.title || rev.title,
            summary: activeContent.summary || rev.summary,
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
 * Build offline pack bundle for synchronization.
 * Partitioned by audience/lab/locale.
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
    const categories = getCategories().map(cat => ({
        id: cat.id,
        icon: cat.icon,
        title: cat.titles?.[locale] || cat.titles?.en || cat.id,
        description: cat.descriptions?.[locale] || cat.descriptions?.en || ''
    }));

    const items = articles.map(article => {
        const pub = article.publications?.[0];
        const rev = pub?.revision;
        if (!rev) return null;

        const targetLocaleRev = rev.locales?.find(l => l.locale === locale);
        const isApproved = targetLocaleRev && targetLocaleRev.reviewStatus === 'APPROVED';
        const isFallback = !isApproved && locale !== 'en';
        const content = targetLocaleRev || rev;

        let steps = [];
        try { steps = JSON.parse(content.steps || rev.steps || '[]'); } catch (e) { steps = []; }
        let related = [];
        try { related = JSON.parse(rev.related || '[]'); } catch (e) { related = []; }

        return {
            id: article.id,
            category: article.category,
            kind: article.kind,
            feature: article.feature,
            roles: JSON.parse(article.roles || '["all"]'),
            keywords: JSON.parse(article.keywords || '[]'),
            minutes: article.minutes,
            title: content.title || rev.title,
            summary: content.summary || rev.summary,
            steps,
            success: content.success || rev.success || '',
            caution: content.caution || rev.caution || '',
            related,
            labNote: article.labNotes?.[0]?.noteText || null,
            revisionNumber: rev.revisionNumber,
            isFallback,
            localeNotice: isFallback ? (FALLBACK_NOTICES[locale] || FALLBACK_NOTICES.en) : null
        };
    }).filter(Boolean);

    return {
        packVersion: 1,
        locale,
        labId: user?.labId || null,
        generatedAt: new Date().toISOString(),
        categories,
        routeMap: {
            blockers: routeMap.blockers || {},
            unknownCodeArticle: routeMap.unknownCodeArticle || 'bench-blocked'
        },
        articles: items
    };
}

module.exports = {
    getCategories,
    getTopics,
    getArticles,
    getArticleById,
    searchHelp,
    getContextHelp,
    recordFeedback,
    getOfflinePack
};
