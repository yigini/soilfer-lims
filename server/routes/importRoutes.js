const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// Preview CSV headers and suggested mappings
router.post('/preview', verifyToken, importController.previewCsv);

// Execute legacy historical import (requires sample receipt / lab authority)
router.post('/execute', verifyToken, checkPermission('RECEIVE_SAMPLES'), importController.executeImport);

module.exports = router;
