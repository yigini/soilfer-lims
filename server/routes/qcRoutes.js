const express = require('express');
const router = express.Router();
const qcController = require('../controllers/qcController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.post('/batches', checkPermission('APPROVE_RESULTS'), qcController.createBatch);
router.get('/batches', qcController.getBatches);
router.put('/batches/:id', checkPermission('APPROVE_RESULTS'), qcController.updateBatch);
router.post('/batches/:id/items', checkPermission('APPROVE_RESULTS'), qcController.addItemsToBatch);
router.post('/batches/:id/disposition', checkPermission('APPROVE_RESULTS'), qcController.dispositionBatch);

module.exports = router;
