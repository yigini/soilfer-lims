/**
 * Shared Analysis Service
 * 
 * Single source of truth for analysis name lookup and caching.
 * Replaces the duplicated loadMethods/getAnalysisName functions
 * previously scattered across workItemController and submissionController.
 */
const prisma = require('../prisma');
const { parseJson } = require('./cataloguePolicy');

// In-memory cache with TTL
let cache = null;
let cacheTime = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Load all analyses from DB with caching.
 * Returns array of { code, name, unit, categoryId, validation }
 */
const loadAnalyses = async () => {
    const now = Date.now();
    if (cache && cacheTime && (now - cacheTime) < CACHE_TTL) {
        return cache;
    }
    const analyses = await prisma.analysis.findMany({
        include: { category: { select: { name: true } } }
    });
    cache = analyses.map(a => ({
        code: a.code,
        name: a.name,
        unit: a.units,
        categoryId: a.categoryId,
        categoryName: a.category?.name || null,
        prerequisites: a.prerequisites,
        executionOrder: a.executionOrder,
        validation: parseJson(a.validation)
    }));
    cacheTime = now;
    return cache;
};

const FALLBACK_ANALYSIS_NAMES = require('../data/analysisDisplayNames.json');

/**
 * Resolve analysis code to display name.
 * Returns a current catalogue name, a curated legacy label or an explicit missing-definition label.
 */
const getAnalysisName = async (code) => {
    if (!code) return '—';
    const analyses = await loadAnalyses();
    const match = analyses.find(a => a.code === code);
    if (match?.name && match.name !== code && match.name !== `${code} Determination` && !/^https?:/i.test(match.name)) return match.name;
    return FALLBACK_ANALYSIS_NAMES[code] || 'Unconfigured parameter';
};

/**
 * Get the category name for a given analysis code.
 * Used by workItemController to dynamically assign work item categories.
 */
const getAnalysisCategory = async (code) => {
    const analyses = await loadAnalyses();
    const match = analyses.find(a => a.code === code);
    return match?.categoryName || 'Analysis';
};

/**
 * Invalidate the cache.
 * Should be called after create/update/delete in analysisController.
 */
const invalidateCache = () => {
    cache = null;
    cacheTime = null;
};

module.exports = {
    loadAnalyses,
    getAnalysisName,
    getAnalysisCategory,
    invalidateCache
};
