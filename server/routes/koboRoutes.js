/**
 * Kobo Integration Routes
 */
const express = require('express');
const router = express.Router();
const koboController = require('../controllers/koboController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);

// Issue only references already recorded on an authorized sample.
router.get('/media/samples/:sampleId', koboController.getMediaUrls);

// Configuration endpoints (managers only for write)
router.get('/configs', checkPermission('MANAGE_ANALYSES'), koboController.getAllConfigs);
router.get('/config/:labId', koboController.getConfig);
router.put('/config/:labId', checkPermission('MANAGE_ANALYSES'), koboController.upsertConfig);

// Connection testing (managers only)
router.post('/test', checkPermission('MANAGE_ANALYSES'), koboController.testConnection);
router.get('/form-fields/:labId', checkPermission('MANAGE_ANALYSES'), koboController.getFormFields);

// Sync endpoints (managers only)
router.post('/sync-sample/:sampleId', checkPermission('MANAGE_ANALYSES'), koboController.syncSample);
router.post('/sync/:labId', checkPermission('MANAGE_ANALYSES'), koboController.syncLab);
router.post('/sync-all', checkPermission('MANAGE_ANALYSES'), koboController.syncAll);

// Image reads still require a valid sealed reference.
router.get('/media', koboController.proxyMedia);

module.exports = router;
