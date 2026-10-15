const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);

// POST /api/exports/data - Generate data for export
router.post('/data', checkPermission('VIEW_SAMPLES'), exportController.getExportData);

// GET /api/exports/history - Get export logs
router.get('/history', checkPermission('VIEW_SAMPLES'), exportController.getExportHistory);

module.exports = router;
