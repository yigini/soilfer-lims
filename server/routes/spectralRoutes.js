const express = require('express');
const router = express.Router();
const spectralController = require('../controllers/spectralController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// List / Explorer (any authenticated user can browse)
router.get('/', verifyToken, spectralController.getLibrary);

// Detail / Viewer
router.get('/:id', verifyToken, spectralController.getScan);

// Pre-upload: check which lab IDs match existing samples
router.post('/check-matches', verifyToken, spectralController.checkMatches);

// Batch Upload (technicians+)
router.post('/batch', verifyToken, checkPermission('ENTER_RESULTS'), spectralController.uploadBatch);

// Batch Review — approve/reject multiple spectra (managers only)
router.post('/batch-review', verifyToken, checkPermission('APPROVE_RESULTS'), spectralController.batchReview);

// Batch Delete — move multiple spectra to trash (managers only)
router.post('/batch-delete', verifyToken, checkPermission('APPROVE_RESULTS'), spectralController.batchDelete);

// Manager Review (Approve/Reject/Undo)
router.post('/:id/review', verifyToken, checkPermission('APPROVE_RESULTS'), spectralController.reviewSpectrum);

// Restore from trash (managers only)
router.post('/:id/restore', verifyToken, checkPermission('APPROVE_RESULTS'), spectralController.restoreScan);

// Soft delete — move to trash (managers only)
router.delete('/:id', verifyToken, checkPermission('APPROVE_RESULTS'), spectralController.deleteScan);

// Permanent delete — hard delete from trash only (managers only)
router.delete('/:id/permanent', verifyToken, checkPermission('APPROVE_RESULTS'), spectralController.permanentlyDeleteScan);

module.exports = router;
