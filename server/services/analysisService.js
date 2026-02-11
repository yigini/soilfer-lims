/**
 * Shared Analysis Service
 * 
 * Single source of truth for analysis name lookup and caching.
 * Replaces the duplicated loadMethods/getAnalysisName functions
 * previously scattered across workItemController and submissionController.
 */
const prisma = require('../prisma');

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
        validation: a.validation ? JSON.parse(a.validation) : null
    }));
    cacheTime = now;
    return cache;
};

/**
 * Resolve analysis code to display name.
 * Returns the name if found, otherwise the code itself.
 */
const getAnalysisName = async (code) => {
    const analyses = await loadAnalyses();
    const match = analyses.find(a => a.code === code);
    return match ? match.name : code;
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
