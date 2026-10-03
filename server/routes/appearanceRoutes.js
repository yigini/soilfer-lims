/**
 * SoilFER LIMS - Appearance API Routes
 *
 * Exposes:
 * - GET /api/appearance/catalog (Public published catalogue)
 * - GET /api/appearance/public  (Public login/help theme context)
 * - GET /api/appearance/context (User appearance context, supports optional auth or authenticated)
 */

const express = require('express');
const router = express.Router();
const appearanceService = require('../services/appearanceService');
const { verifyToken } = require('../middleware/authMiddleware');

// Public static-safe theme catalog
router.get('/catalog', (req, res) => {
    try {
        const catalog = appearanceService.getCatalog();
        res.json({ success: true, data: catalog });
    } catch (err) {
        console.error('[APPEARANCE] Catalog error:', err);
        res.status(500).json({ error: 'Failed to retrieve theme catalog', code: 'CATALOG_ERROR' });
    }
});

// Public platform appearance (for login, activation, error boundaries)
router.get('/public', async (req, res) => {
    try {
        const publicTheme = await appearanceService.getPublicAppearance();
        res.json({ success: true, data: publicTheme });
    } catch (err) {
        console.error('[APPEARANCE] Public theme error:', err);
        res.status(500).json({ error: 'Failed to retrieve public appearance', code: 'PUBLIC_APPEARANCE_ERROR' });
    }
});

// Authenticated user appearance context (resolves user preferences, lab default, and platform default)
router.get('/context', verifyToken, async (req, res) => {
    try {
        const queryLabId = req.query.labId || null;
        const context = await appearanceService.getUserAppearanceContext(req.user, queryLabId);
        res.json({ success: true, data: context });
    } catch (err) {
        console.error('[APPEARANCE] Context error:', err);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to retrieve appearance context',
            code: err.code || 'CONTEXT_ERROR'
        });
    }
});

module.exports = router;
