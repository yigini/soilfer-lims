const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/ping', (req, res) => res.send('pong'));
router.get('/system-logs', checkPermission('VIEW_AUDIT'), adminController.getAuditLogs);
router.get('/settings', adminController.getSettings);
router.put('/settings/branding', checkPermission('MANAGE_BRANDING'), adminController.updateBranding);
router.get('/languages', adminController.getLanguages);
router.post('/languages', checkPermission('MANAGE_BRANDING'), adminController.createLanguage);
router.delete('/languages/:code', checkPermission('MANAGE_BRANDING'), adminController.deleteLanguage);
router.put('/languages/:code/default', checkPermission('MANAGE_BRANDING'), adminController.setDefaultLanguage);
router.put('/languages/:code', checkPermission('MANAGE_BRANDING'), adminController.updateLanguage);
router.get('/languages/:code/catalog', checkPermission('MANAGE_BRANDING'), adminController.getLanguageCatalog);

// Global Platform Appearance (SUPER_ADMIN only)
router.get('/appearance', async (req, res) => {
    if (req.user?.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only SUPER_ADMIN can view global appearance settings.', code: 'FORBIDDEN_GLOBAL_APPEARANCE' });
    }
    try {
        const appearanceService = require('../services/appearanceService');
        const globalSetting = await appearanceService.getGlobalAppearance();
        res.json({ success: true, data: globalSetting });
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message, code: err.code || 'GLOBAL_APPEARANCE_ERROR' });
    }
});

router.patch('/appearance', checkPermission('MANAGE_GLOBAL_APPEARANCE'), async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Payload must be a non-null JSON object', code: 'INVALID_PAYLOAD' });
    }
    const allowed = ['themeId', 'defaultMode', 'expectedRevision'];
    const invalid = Object.keys(req.body).filter(k => !allowed.includes(k));
    if (invalid.length > 0) {
        return res.status(400).json({ error: `Unexpected fields in appearance update: ${invalid.join(', ')}`, code: 'INVALID_APPEARANCE_FIELDS' });
    }
    try {
        const appearanceService = require('../services/appearanceService');
        const updated = await appearanceService.updateGlobalAppearance(req.user, req.body);
        res.json({ success: true, data: updated, message: 'Platform appearance default updated successfully' });
    } catch (err) {
        res.status(err.statusCode || 500).json({
            error: err.message,
            code: err.code || 'GLOBAL_APPEARANCE_ERROR',
            currentRevision: err.currentRevision
        });
    }
});

module.exports = router;
