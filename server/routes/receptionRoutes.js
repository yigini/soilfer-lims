const express = require('express');
const router = express.Router();
const multer = require('multer');
const receptionController = require('../controllers/receptionController');
const uploadMediaController = require('../controllers/uploadMediaController');
const { MAX_IMAGE_BYTES } = require('../utils/uploadFiles');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// Bounded memory intake: no client-provided filename/type reaches disk.
// The controller validates every file's bytes before saving the batch.
const upload = multer({ storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 5, fields: 1, fieldSize: 200, parts: 7 } }).array('photos', 5);
function receivePhotos(req, res, next) {
    upload(req, res, error => {
        if (!error) return next();
        return uploadMediaController.sendError(res, Object.assign(new Error(
            error.code === 'LIMIT_FILE_SIZE' ? 'The image exceeds the upload size limit.' : 'Select up to five image files.'), {
            statusCode: error.code === 'LIMIT_FILE_SIZE' ? 413 : 400,
            code: error.code === 'LIMIT_FILE_SIZE' ? 'UPLOAD_TOO_LARGE' : 'UPLOAD_REQUEST_INVALID', uploadMediaError: true }));
    });
}

router.use(verifyToken);

// POST /api/reception/intake
// Requires RECEIVE_SAMPLE permission
router.post('/intake', checkPermission('RECEIVE_SAMPLE'), receptionController.processIntake);
router.get('/intake-rules', checkPermission('RECEIVE_SAMPLE'), receptionController.getIntakeRules);

// POST /api/reception/discard
// Allows reception staff to discard their own DRAFT/RECEIVED samples
router.post('/discard', checkPermission('RECEIVE_SAMPLE'), receptionController.discardDraft);

// GET /api/reception/check-duplicate
// Duplicate & re-submission detection across laboratories (RC-04)
router.get('/check-duplicate', checkPermission('RECEIVE_SAMPLE'), receptionController.checkDuplicate);

// POST /api/reception/mass-check
// Calculate required analytical mass against test catalogue + retention (RC-01)
router.post('/mass-check', checkPermission('RECEIVE_SAMPLE'), receptionController.calculateMassRequirement);

// POST /api/reception/upload-photo
// Upload sample condition or non-conformance photographic evidence (RC-03)
router.post('/upload-photo', checkPermission('RECEIVE_SAMPLE'), receivePhotos, receptionController.uploadIntakePhoto);

// GET /api/reception/admin-units
// Administrative unit hierarchy picker (RC-05, RC-08)
router.get('/admin-units', checkPermission('RECEIVE_SAMPLE'), receptionController.getAdminUnits);

// POST /api/reception/parse-coordinates
// Universal coordinate parsing for DD, DMS, UTM (RC-05)
router.post('/parse-coordinates', checkPermission('RECEIVE_SAMPLE'), receptionController.parseCoordinatesEndpoint);

// GET /api/reception/reverse-geocode
// Server-side geocode proxy with caching & offline boundary fallback (RC-08)
router.get('/reverse-geocode', checkPermission('RECEIVE_SAMPLE'), receptionController.reverseGeocode);

// GET /api/reception/batch-geometry-check
// Consignment/project spatial outlier detection (RC-10)
router.get('/batch-geometry-check', checkPermission('RECEIVE_SAMPLE'), receptionController.batchGeometryCheck);

// POST /api/reception/consignments
// High-throughput batch receive workflow with per-sample exception handling (RC-12, RC-13, RC-14)
router.post('/consignments', checkPermission('RECEIVE_SAMPLE'), receptionController.processBatchConsignmentIntake);

// GET /api/reception/consignments
// List consignment delivery records (RC-12)
router.get('/consignments', checkPermission('RECEIVE_SAMPLE'), receptionController.getConsignments);

// GET /api/reception/consignments/:id
// Get consignment detail and linked samples (RC-12)
router.get('/consignments/:id', checkPermission('RECEIVE_SAMPLE'), receptionController.getConsignmentDetail);

// POST /api/reception/parse-manifest
// Institutional client spreadsheet manifest import & validation (RC-15)
router.post('/parse-manifest', checkPermission('RECEIVE_SAMPLE'), receptionController.parseManifestEndpoint);

// GET /api/reception/sample-context/:id and GET /api/reception/sample-context
// Scoped, pure read-only intake detail resolver
router.get('/sample-context/:id', checkPermission('RECEIVE_SAMPLE'), receptionController.getSampleIntakeContext);
router.get('/sample-context', checkPermission('RECEIVE_SAMPLE'), receptionController.getSampleIntakeContext);

module.exports = router;


