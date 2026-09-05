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

// Discard single draft
router.delete('/drafts/item/:workItemId', checkPermission('ENTER_RESULTS'), workbenchController.discardDraft);

// Resolve draft conflict
router.post('/drafts/item/:workItemId/resolve-conflict', checkPermission('ENTER_RESULTS'), workbenchController.resolveConflict);

// V2 Two-Step Record & Submit Pipeline
router.post('/v2/completion/preview', checkPermission('ENTER_RESULTS'), workbenchController.previewCompletion);
router.post('/v2/completion/commit', checkPermission('ENTER_RESULTS'), workbenchController.commitCompletion);
router.post('/v2/submissions/preview', checkPermission('ENTER_RESULTS'), workbenchController.previewSubmissions);
router.post('/v2/submissions/commit', checkPermission('ENTER_RESULTS'), workbenchController.commitSubmissions);
router.get('/v2/receipts', checkPermission('ENTER_RESULTS'), workbenchController.getReceipts);

module.exports = router;
