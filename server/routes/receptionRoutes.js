const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const receptionController = require('../controllers/receptionController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// Storage configuration for intake & non-conformance photos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, '..', 'uploads', 'intake');
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        const uniqueName = `intake_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per photo
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed.'));
        }
    }
});

router.use(verifyToken);

// POST /api/reception/intake
// Requires RECEIVE_SAMPLE permission
router.post('/intake', checkPermission('RECEIVE_SAMPLE'), receptionController.processIntake);

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
router.post('/upload-photo', checkPermission('RECEIVE_SAMPLE'), upload.array('photos', 5), receptionController.uploadIntakePhoto);

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

module.exports = router;

