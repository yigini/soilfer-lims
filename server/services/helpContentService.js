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

function parseApprovedLocales(pub) {
    if (!pub || !pub.approvedLocales) return ['en'];
    try {
        const parsed = typeof pub.approvedLocales === 'string'
            ? JSON.parse(pub.approvedLocales)
            : pub.approvedLocales;
        return Array.isArray(parsed) ? parsed : ['en'];
    } catch (e) {
        return ['en'];
    }
}

/**
 * Common locale resolution policy across all help readers, context, search, and offline pack.
 * Enforces:
 * - Normal readers receive ONLY locales explicitly included in pub.approvedLocales AND reviewStatus === 'APPROVED'.
 * - If target locale is not approved, falls back to approved source locale with a truthful fallback notice.
 * - NEVER serves unapproved translated bytes to regular readers.
 * - Preview remains an explicit authorized editor action.
 */
function resolveRevisionContent({ rev, pub, locale = 'en', canPreview = false }) {
    if (!rev) return null;

    const sourceLocale = rev.sourceLocale || 'en';

    // 1. Editorial preview mode for authorized editors
    if (canPreview) {
        const targetLocaleRev = rev.locales?.find(l => l.locale === locale);
        if (locale === sourceLocale) {
            return {
                content: rev,
                isFallback: false,
                localeNotice: null,
                isDraftPreview: !pub,
                resolvedLocale: sourceLocale
            };
        }

        if (targetLocaleRev && targetLocaleRev.reviewStatus === 'APPROVED') {
            return {
                content: targetLocaleRev,
                isFallback: false,
                localeNotice: null,
                isDraftPreview: !pub,
                resolvedLocale: locale
            };
        }

        // Unapproved translation or missing locale falls back to source locale content
        return {
            content: rev,
            isFallback: true,
            localeNotice: FALLBACK_NOTICES[locale] || FALLBACK_NOTICES.en,
            isDraftPreview: !pub,
            resolvedLocale: sourceLocale
        };
    }

    // 2. Normal published reader mode: requires current publication
    if (!pub) return null;

    const approvedLocales = parseApprovedLocales(pub);
    const targetLocaleRev = rev.locales?.find(l => l.locale === locale);

    // If requested locale is source locale (e.g. 'en')
    if (locale === sourceLocale) {
        if (!approvedLocales.includes(sourceLocale)) return null;
        return {
            content: rev,
            isFallback: false,
            localeNotice: null,
            isDraftPreview: false,
            resolvedLocale: sourceLocale
        };
    }

    // If requested locale is approved and locale revision is APPROVED
    if (approvedLocales.includes(locale) && targetLocaleRev && targetLocaleRev.reviewStatus === 'APPROVED') {
        return {
            content: targetLocaleRev,
            isFallback: false,
            localeNotice: null,
            isDraftPreview: false,
            resolvedLocale: locale
        };
    }

    // Fall back to approved source locale if available
    if (approvedLocales.includes(sourceLocale)) {
        return {
            content: rev,
            isFallback: true,
            localeNotice: FALLBACK_NOTICES[locale] || FALLBACK_NOTICES.en,
            isDraftPreview: false,
            resolvedLocale: sourceLocale
        };
    }

    return null;
}

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

    const countByCategory = {};
    articles.forEach(a => {
        const pub = a.publications?.[0];
        const rev = canPreview ? (pub?.revision || a.revisions?.[0]) : pub?.revision;
        const resolved = resolveRevisionContent({ rev, pub, locale, canPreview });
        if (resolved) {
            countByCategory[a.category] = (countByCategory[a.category] || 0) + 1;
        }
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
                const roles = JSON.parse(article.roles || '[]').map(r => String(r).toLowerCase());
                const searchRole = role.toLowerCase();
                return roles.includes('all') ||
                    roles.includes(searchRole) ||
                    (searchRole === 'technician' && (roles.includes('lab_technician') || roles.includes('technician'))) ||
                    (searchRole === 'manager' && (roles.includes('lab_manager') || roles.includes('manager'))) ||
                    (searchRole === 'reception' && (roles.includes('sample_reception') || roles.includes('reception')));
            } catch (e) {
                return true;
            }
        })
        .map(article => {
            const pub = article.publications?.[0];
            const rev = canPreview ? (pub?.revision || article.revisions?.[0]) : pub?.revision;
            if (!rev) return null;

            const resolved = resolveRevisionContent({ rev, pub, locale, canPreview });
            if (!resolved) return null;

            const { content, isFallback, localeNotice, isDraftPreview } = resolved;

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
                localeNotice,
                isDraftPreview,
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

    if (!article) {
        const migration = loadJsonFile('migration-map.json', null);
        const successorEntry = migration?.articles?.find(m => m.legacyArticleId === articleId);
        if (successorEntry && successorEntry.successorBriefIds?.[0]) {
            return getArticleById(successorEntry.successorBriefIds[0], user, locale, preview);
        }
        return null;
    }

    const pub = article.publications?.[0];
    const rev = canPreview ? (pub?.revision || article.revisions?.[0]) : pub?.revision;
    if (!rev) return null;

    const resolved = resolveRevisionContent({ rev, pub, locale, canPreview });
    if (!resolved) return null;

    const { content, isFallback, localeNotice, isDraftPreview } = resolved;

    let steps = [];
    let quick = '';
    let before = [];
    let sections = [];
    let fields = [];
    let example = '';
    let nextActor = '';
    let problems = [];
    let sources = [];

    try {
        const parsed = JSON.parse(content.steps || rev.steps || '[]');
        if (Array.isArray(parsed)) {
            if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0] !== null && parsed[0].action) {
                sections = [{ title: 'Procedure', steps: parsed }];
                steps = parsed.map(st => `${st.action}${st.expected ? ' (Expected: ' + st.expected + ')' : ''}`);
            } else {
                steps = parsed;
                sections = [{
                    title: 'Procedure',
                    steps: parsed.map(s => ({ action: typeof s === 'string' ? s : JSON.stringify(s), expected: '' }))
                }];
            }
        } else if (parsed && typeof parsed === 'object') {
            quick = parsed.quick || '';
            before = parsed.before || [];
            sections = parsed.sections || [];
            fields = parsed.fields || [];
            example = parsed.example || '';
            nextActor = parsed.nextActor || '';
            problems = parsed.problems || [];
            sources = parsed.sources || [];
            if (Array.isArray(parsed.steps)) {
                steps = parsed.steps;
            } else if (Array.isArray(sections)) {
                steps = sections.flatMap(s => (s.steps || []).map(st => typeof st === 'string' ? st : `${st.action}${st.expected ? ' (Expected: ' + st.expected + ')' : ''}`));
            }
        }
    } catch (e) {
        steps = [];
    }

    // Disk-content fallback for rich v2 fields
    const diskContent = loadJsonFile(`content.${locale}.json`) || loadJsonFile('content.en.json');
    const diskArt = diskContent?.articles?.find(a => a.id === article.id);
    if (diskArt) {
        if (!quick && diskArt.quick) quick = diskArt.quick;
        if ((!before || before.length === 0) && diskArt.before) before = diskArt.before;
        if ((!sections || sections.length === 0) && diskArt.sections) sections = diskArt.sections;
        if ((!fields || fields.length === 0) && diskArt.fields) fields = diskArt.fields;
        if (!example && diskArt.example) example = diskArt.example;
        if (!nextActor && diskArt.nextActor) nextActor = diskArt.nextActor;
        if ((!problems || problems.length === 0) && diskArt.problems) problems = diskArt.problems;
        if ((!sources || sources.length === 0) && diskArt.sources) sources = diskArt.sources;
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
        title: content.title || rev.title,
        summary: content.summary || rev.summary,
        steps,
        quick: quick || content.summary || rev.summary,
        before: before.length > 0 ? before : ['Verify user role, assignment and prerequisite steps.'],
        sections: sections.length > 0 ? sections : [{ title: 'Procedure', steps: steps.map(s => ({ action: s, expected: '' })) }],
        fields: fields || [],
        example: example || '',
        nextActor: nextActor || 'Assigned colleague or laboratory supervisor',
        problems: problems || [],
        sources: sources || [],
        success: content.success || rev.success || '',
        caution: content.caution || rev.caution || '',
        related,
        sourceLocale: rev.sourceLocale,
        revisionNumber: rev.revisionNumber,
        publishedAt: pub?.publishedAt || null,
        isFallback,
        localeNotice,
        isDraftPreview,
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

        const resolved = resolveRevisionContent({ rev, pub, locale, canPreview });
        if (!resolved) continue;

        const { content, isFallback, localeNotice } = resolved;

        const normTitle = normalizeString(content.title || rev.title || '');
        const normSummary = normalizeString(content.summary || rev.summary || '');
        const normKeywords = normalizeString(article.keywords || '');
        const normSteps = normalizeString(content.steps || rev.steps || '');
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
                    title: content.title || rev.title,
                    summary: content.summary || rev.summary,
                    minutes: article.minutes,
                    isFallback,
                    localeNotice
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
 * Computes structured availability (AVAILABLE, MAPPED_UNPUBLISHED, MAPPED_UNPUBLISHED_EDITOR, AUTH_REQUIRED, NO_PAGE_GUIDE, UNAVAILABLE_TRANSLATION).
 */
async function getContextHelp({ route = '/', blockerCodes = [], user = null, locale = 'en', preview = false }) {
    const routeMap = getRouteMap();
    const isAuth = !!user;
    const canPreview = preview && isAuth && (user.role === 'SUPER_ADMIN' || user.permissions?.includes('HELP_EDIT_GLOBAL'));

    // 1. Resolve route mapping
    let matchedArticleIds = [];
    const normalizedRoute = route.split('?')[0].replace(/\/$/, '') || '/';

    const exactMatch = (routeMap.routes || []).find(r => r.route === normalizedRoute);
    let isMappedRoute = false;

    if (exactMatch) {
        // Deep clone to prevent cached array mutation (Finding 4)
        matchedArticleIds = [...(exactMatch.articleIds || [])];
        isMappedRoute = true;
    } else {
        const patternMatch = (routeMap.routes || []).find(r => {
            if (!r.route.includes(':')) return false;
            const regex = new RegExp('^' + r.route.replace(/:[a-zA-Z0-9_-]+/g, '[^/]+') + '$');
            return regex.test(normalizedRoute);
        });
        if (patternMatch) {
            matchedArticleIds = [...(patternMatch.articleIds || [])];
            isMappedRoute = true;
        } else {
            const wildcard = (routeMap.routes || []).find(r => r.route === '*');
            matchedArticleIds = [...(wildcard?.articleIds || ['manage-load-error', 'manage-support'])];
            isMappedRoute = false;
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

    // 3. Load candidate articles
    const allowedVisibilities = isAuth ? ['PUBLIC', 'AUTHENTICATED'] : ['PUBLIC'];
    const where = {
        id: { in: matchedArticleIds },
        archivedAt: null
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
        if (!allowedVisibilities.includes(a.visibility)) continue;

        const pub = a.publications?.[0];
        const rev = canPreview ? (pub?.revision || a.revisions?.[0]) : pub?.revision;
        if (!rev) continue;

        const resolved = resolveRevisionContent({ rev, pub, locale, canPreview });
        if (!resolved) continue;

        const { content, isFallback, localeNotice, isDraftPreview } = resolved;

        articleMap.set(a.id, {
            id: a.id,
            category: a.category,
            kind: a.kind,
            visibility: a.visibility,
            title: content.title || rev.title,
            summary: content.summary || rev.summary,
            minutes: a.minutes,
            labNote: a.labNotes?.[0] ? a.labNotes[0].noteText : null,
            isFallback,
            localeNotice,
            isDraftPreview
        });
    }

    const orderedArticles = matchedArticleIds
        .map(id => articleMap.get(id))
        .filter(Boolean);

    // 4. Compute structured availability
    let availability = 'AVAILABLE';
    let draftArticleIds = undefined;

    if (orderedArticles.length > 0) {
        availability = 'AVAILABLE';
    } else if (!isMappedRoute) {
        availability = 'NO_PAGE_GUIDE';
    } else {
        // Route is mapped, but orderedArticles is empty. Diagnose why:
        const mappedArticlesInDb = articles.filter(a => matchedArticleIds.includes(a.id));
        if (mappedArticlesInDb.length === 0) {
            // Check if articles exist in DB regardless of publication filter
            const dbCheck = await prisma.helpArticle.findMany({
                where: { id: { in: matchedArticleIds }, archivedAt: null },
                select: { id: true, visibility: true }
            });
            if (dbCheck.length === 0) {
                availability = 'NO_PAGE_GUIDE';
            } else if (!isAuth && dbCheck.every(a => a.visibility === 'AUTHENTICATED')) {
                availability = 'AUTH_REQUIRED';
            } else {
                const canEditHelp = isAuth && (user?.role === 'SUPER_ADMIN' || user?.permissions?.includes('HELP_EDIT_GLOBAL'));
                if (canEditHelp) {
                    availability = 'MAPPED_UNPUBLISHED_EDITOR';
                    draftArticleIds = dbCheck.map(a => a.id);
                } else {
                    availability = 'MAPPED_UNPUBLISHED';
                }
            }
        } else if (!isAuth && mappedArticlesInDb.every(a => a.visibility === 'AUTHENTICATED')) {
            availability = 'AUTH_REQUIRED';
        } else {
            availability = 'UNAVAILABLE_TRANSLATION';
        }
    }

    const response = {
        route: normalizedRoute,
        availability,
        blockers: resolvedBlockers,
        articles: orderedArticles
    };

    if (draftArticleIds) {
        response.draftArticleIds = draftArticleIds;
    }

    return response;
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

        const resolved = resolveRevisionContent({ rev, pub, locale, canPreview: false });
        if (!resolved) return null;

        const { content, isFallback, localeNotice } = resolved;

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
            localeNotice
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

/**
 * Get FAQs derived from canonical problem blocks across guides
 */
async function getFaqs({ locale = 'en', topic = null } = {}) {
    const diskContent = loadJsonFile(`content.${locale}.json`) || loadJsonFile('content.en.json');
    if (!diskContent?.articles) return [];

    const faqs = [];
    diskContent.articles.forEach(art => {
        if (topic && art.category !== topic) return;
        if (Array.isArray(art.problems) && art.problems.length > 0) {
            art.problems.forEach((prob, idx) => {
                faqs.push({
                    id: `${art.id}-faq-${idx + 1}`,
                    articleId: art.id,
                    articleTitle: art.title,
                    category: art.category,
                    question: prob.symptom,
                    cause: prob.why,
                    action: prob.action
                });
            });
        }
    });
    return faqs;
}

module.exports = {
    getCategories,
    getTopics,
    getArticles,
    getArticleById,
    searchHelp,
    getContextHelp,
    recordFeedback,
    getOfflinePack,
    getFaqs
};
