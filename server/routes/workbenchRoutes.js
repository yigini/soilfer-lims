const express = require('express');
const router = express.Router();
const workbenchController = require('../controllers/workbenchController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);

// Technician workbench queue (analysis-grouped)
router.get('/queue', checkPermission('ENTER_RESULTS'), workbenchController.getQueue);

// Batch save results (draft or complete)
router.post('/batch-save', checkPermission('ENTER_RESULTS'), workbenchController.batchSave);

// Server-side drafts
router.get('/drafts', checkPermission('ENTER_RESULTS'), workbenchController.getDrafts);

// Clear drafts for an analysis
router.delete('/drafts/:analysis', checkPermission('ENTER_RESULTS'), workbenchController.clearDrafts);

module.exports = router;
