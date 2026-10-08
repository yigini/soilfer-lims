const express = require('express');
const router = express.Router();
const qcController = require('../controllers/qcController');
const qcRuleController = require('../controllers/qcRuleController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);
router.get('/rules', checkPermission('VIEW_LAB_POLICIES'), qcRuleController.list);
router.post('/rules', checkPermission('MANAGE_LAB_POLICIES'), qcRuleController.change);

router.post('/batches', checkPermission('CHANGE_STATUS'), qcController.createBatch);
router.get('/batches', qcController.getBatches);
router.get('/batches/:id', qcController.getBatchById);
router.put('/batches/:id', checkPermission('CHANGE_STATUS'), qcController.updateBatch);
router.post('/batches/:id/evaluate', checkPermission('CHANGE_STATUS'), qcController.evaluateBatch);
router.post('/batches/:id/preview', checkPermission('CHANGE_STATUS'), qcController.previewBatch);
router.post('/batches/:id/corrections', checkPermission('CHANGE_STATUS'), qcController.correctMeasurements);
router.post('/batches/:id/start', checkPermission('CHANGE_STATUS'), qcController.startRun);
router.post('/batches/:id/rebuild', checkPermission('CHANGE_STATUS'), qcController.rebuildRun);
router.post('/batches/:id/reorder', checkPermission('CHANGE_STATUS'), qcController.reorderRun);
router.post('/batches/:id/items', checkPermission('CHANGE_STATUS'), qcController.addItemsToBatch);
router.delete('/batches/:id/items', checkPermission('CHANGE_STATUS'), qcController.removeItemsFromBatch);
router.post('/batches/:id/disposition', checkPermission('APPROVE_RESULTS'), qcController.dispositionBatch);

module.exports = router;
