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

module.exports = router;
