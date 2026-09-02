const express = require('express');
const router = express.Router();
const sisController = require('../controllers/sisController');
const spectralExportController = require('../controllers/spectralExportController');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// ─── PUBLIC / CONSUMER ENDPOINTS (Secured with API Key or JWT) ───

// 1. Samples Registry & Provenance
router.get('/samples', apiKeyAuth, sisController.getSamples);
router.get('/samples/:id', apiKeyAuth, sisController.getSampleById);

// 2. Spatial GeoJSON FeatureCollection for GIS Integration
router.get('/geojson', apiKeyAuth, sisController.getGeoJson);

// 3. Tabular Analytical Chemistry Matrix
router.get('/results', apiKeyAuth, sisController.getResultsMatrix);

// 4. Spectroscopy Dataset (NIR/MIR)
router.get('/spectra', apiKeyAuth, sisController.getSpectra);
router.get('/spectra/export', apiKeyAuth, spectralExportController.exportSpectra);

// 5. Delta Synchronization Endpoint for Incremental ETL
router.get('/sync', apiKeyAuth, sisController.syncDelta);

// 6. Dataset Statistics
router.get('/stats', apiKeyAuth, sisController.getStats);

// ─── ADMIN API KEY MANAGEMENT (Platform Admins Only) ───

router.get('/keys', verifyToken, checkPermission('MANAGE_BRANDING'), sisController.listApiKeys);
router.post('/keys', verifyToken, checkPermission('MANAGE_BRANDING'), sisController.createApiKey);
router.delete('/keys/:id', verifyToken, checkPermission('MANAGE_BRANDING'), sisController.revokeApiKey);

module.exports = router;
