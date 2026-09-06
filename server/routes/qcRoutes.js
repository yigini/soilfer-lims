const express = require('express');
const router = express.Router();
const qcController = require('../controllers/qcController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.post('/batches', checkPermission('CHANGE_STATUS'), qcController.createBatch);
router.get('/batches', qcController.getBatches);
router.get('/batches/:id', qcController.getBatchById);
router.put('/batches/:id', checkPermission('CHANGE_STATUS'), qcController.updateBatch);
router.post('/batches/:id/evaluate', checkPermission('CHANGE_STATUS'), qcController.evaluateBatch);
router.post('/batches/:id/items', checkPermission('CHANGE_STATUS'), qcController.addItemsToBatch);
router.delete('/batches/:id/items', checkPermission('CHANGE_STATUS'), qcController.removeItemsFromBatch);
router.post('/batches/:id/disposition', checkPermission('APPROVE_RESULTS'), qcController.dispositionBatch);

module.exports = router;
