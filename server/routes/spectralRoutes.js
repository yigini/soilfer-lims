const express = require('express');
const router = express.Router();
const spectralController = require('../controllers/spectralController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// List / Explorer (any authenticated user can browse)
router.get('/', verifyToken, spectralController.getLibrary);

// Library Statistics & Tile Aggregations (SL-04)
router.get('/stats', verifyToken, spectralController.getLibraryStats);

// SL-21: Instrument Control Scans & Drift History
router.get('/control-drifts', verifyToken, spectralController.getControlDrifts);

// Detail / Viewer
router.get('/:id', verifyToken, spectralController.getScan);

// SL-06: Raw Instrument File Download
router.get('/:id/raw', verifyToken, spectralController.downloadRawScan);

// Pre-upload: check which lab IDs match existing samples
router.post('/check-matches', verifyToken, checkPermission('ENTER_RESULTS'), spectralController.checkMatches);

const multer = require('multer');
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
});

// Staged Ingestion Preview (Amendment 5)
router.post('/preview', verifyToken, checkPermission('ENTER_RESULTS'), upload.array('files', 100), spectralController.previewBatch);

// Batch Commit of Staged Manifest (Amendment 5)
router.post('/batch/commit', verifyToken, checkPermission('ENTER_RESULTS'), spectralController.commitBatch);

// Link existing scan to WorkItem (Amendment 4)
router.post('/link-task', verifyToken, checkPermission('ENTER_RESULTS'), spectralController.linkTask);

// Batch Upload (Supports JSON scans array or multipart raw file uploads)
router.post('/batch', verifyToken, checkPermission('ENTER_RESULTS'), upload.array('files', 100), spectralController.uploadBatch);

// Dedicated Raw Instrument Files Upload (SL-06 & SL-13 true binary multipart)
router.post('/upload-raw', verifyToken, checkPermission('ENTER_RESULTS'), upload.array('files', 100), spectralController.uploadBatch);

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
