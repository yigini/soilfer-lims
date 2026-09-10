const helpContentService = require('../services/helpContentService');
const prisma = require('../prisma');

/**
 * GET /api/help/topics
 */
async function getTopics(req, res) {
    try {
        const locale = req.query.locale || req.locale || 'en';
        const preview = req.query.preview === 'true';
        const topics = await helpContentService.getTopics(req.user, locale, preview);
        res.json({ success: true, topics });
    } catch (err) {
        console.error('[HELP_CONTROLLER] getTopics error:', err);
        res.status(500).json({ error: 'Failed to fetch help topics' });
    }
}

/**
 * GET /api/help/articles
 */
async function getArticles(req, res) {
    try {
        const { category, role, locale = req.locale || 'en', preview } = req.query;
        const articles = await helpContentService.getArticles({
            category,
            role,
            user: req.user,
            locale,
            preview: preview === 'true'
        });
        res.json({ success: true, articles });
    } catch (err) {
        console.error('[HELP_CONTROLLER] getArticles error:', err);
        res.status(500).json({ error: 'Failed to fetch help articles' });
    }
}

/**
 * GET /api/help/articles/:articleId
 */
async function getArticleById(req, res) {
    try {
        const { articleId } = req.params;
        const locale = req.query.locale || req.locale || 'en';
        const preview = req.query.preview === 'true';
        const article = await helpContentService.getArticleById(articleId, req.user, locale, preview);

        if (!article) {
            return res.status(404).json({ error: 'Help article not found or not published' });
        }

        res.json({ success: true, article });
    } catch (err) {
        console.error('[HELP_CONTROLLER] getArticleById error:', err);
        res.status(500).json({ error: 'Failed to fetch help article' });
    }
}

/**
 * GET /api/help/search
 */
async function searchHelp(req, res) {
    try {
        const { q, topic, role, limit, offset, locale = req.locale || 'en', preview } = req.query;
        const result = await helpContentService.searchHelp({
            query: q || '',
            topic: topic || null,
            role: role || null,
            user: req.user,
            locale,
            limit: Math.min(parseInt(limit) || 20, 50),
            offset: Math.max(parseInt(offset) || 0, 0),
            preview: preview === 'true'
        });

        res.json({ success: true, ...result });
    } catch (err) {
        console.error('[HELP_CONTROLLER] searchHelp error:', err);
        res.status(500).json({ error: 'Failed to execute search' });
    }
}

/**
 * GET /api/help/context
 */
async function getContextHelp(req, res) {
    try {
        const { route, blockers, locale = req.locale || 'en', preview } = req.query;
        let blockerCodes = [];
        if (blockers) {
            try {
                blockerCodes = Array.isArray(blockers) ? blockers : JSON.parse(blockers);
            } catch (e) {
                blockerCodes = String(blockers).split(',').map(s => s.trim()).filter(Boolean);
            }
        }

        const context = await helpContentService.getContextHelp({
            route: route || '/',
            blockerCodes,
            user: req.user,
            locale,
            preview: preview === 'true'
        });

        res.json({ success: true, ...context });
    } catch (err) {
        console.error('[HELP_CONTROLLER] getContextHelp error:', err);
        res.status(500).json({ error: 'Failed to resolve context help' });
    }
}

/**
 * POST /api/help/feedback
 */
async function recordFeedback(req, res) {
    try {
        const { articleId, revisionId, locale, useful, comment, category } = req.body;
        if (!articleId) {
            return res.status(400).json({ error: 'articleId is required' });
        }

        const feedback = await helpContentService.recordFeedback({
            articleId,
            revisionId,
            locale: locale || req.locale || 'en',
            useful,
            comment,
            category,
            user: req.user
        });

        res.json({ success: true, feedbackId: feedback.id });
    } catch (err) {
        console.error('[HELP_CONTROLLER] recordFeedback error:', err);
        res.status(500).json({ error: 'Failed to record feedback' });
    }
}

/**
 * GET /api/help/pack (offline pack)
 */
async function getOfflinePack(req, res) {
    try {
        const locale = req.query.locale || req.locale || 'en';
        const pack = await helpContentService.getOfflinePack({
            user: req.user,
            locale
        });

        res.json({ success: true, pack });
    } catch (err) {
        console.error('[HELP_CONTROLLER] getOfflinePack error:', err);
        res.status(500).json({ error: 'Failed to generate offline help pack' });
    }
}

/**
 * GET /api/help/support-config
 * Honest support contact endpoint (Finding 8).
 * If not configured for the lab, returns configured: false without inventing fake IN_APP destinations.
 */
async function getSupportConfig(req, res) {
    try {
        const labId = req.user?.labId;
        let config = null;

        if (labId) {
            config = await prisma.helpSupportConfig.findUnique({
                where: { labId }
            });
        }

        if (!config) {
            return res.json({
                success: true,
                isConfigured: false,
                support: null,
                message: 'Support contact is not configured for this laboratory.'
            });
        }

        res.json({
            success: true,
            isConfigured: true,
            support: {
                labId: config.labId,
                supportName: config.supportName,
                contactMethod: config.contactMethod,
                contactValue: config.contactValue,
                instructions: config.instructions
            }
        });
    } catch (err) {
        console.error('[HELP_CONTROLLER] getSupportConfig error:', err);
        res.status(500).json({ error: 'Failed to fetch support configuration' });
    }
}

module.exports = {
    getTopics,
    getArticles,
    getArticleById,
    searchHelp,
    getContextHelp,
    recordFeedback,
    getOfflinePack,
    getSupportConfig
};
