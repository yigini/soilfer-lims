const express = require('express');
const router = express.Router();
const sisV2Controller = require('../controllers/sisV2Controller');
const apiKeyAuth = require('../middleware/apiKeyAuth');

// ─── PUBLIC / CONSUMER ENDPOINTS (V2 Secured with API Key or JWT) ───

// 1. Capabilities & Contract Version (Public/Consumer Discovery)
router.get('/capabilities', apiKeyAuth.optional, sisV2Controller.getCapabilities);

// 2. Samples Registry & Specimen Detail
router.get('/samples', apiKeyAuth, sisV2Controller.getSamples);
router.get('/samples/:specimenId', apiKeyAuth, sisV2Controller.getSampleById);

// 3. Lossless Analytical Chemistry Observations
router.get('/observations', apiKeyAuth, sisV2Controller.getObservations);

// 4. Spatial GeoJSON (RFC 7946 Compliant)
router.get('/geojson', apiKeyAuth, apiKeyAuth.requireCapability('SPATIAL'), sisV2Controller.getGeoJson);

// 5. Dataset Statistics (Strictly Scoped)
router.get('/stats', apiKeyAuth, sisV2Controller.getStats);

// 6. Spectroscopy Dataset
router.get('/spectra', apiKeyAuth, apiKeyAuth.requireCapability('SPECTRAL'), sisV2Controller.getSpectra);

const EXCHANGE_WRITE_ROLES = ['NSIS_CONSUMER', 'DATA_EXCHANGE', 'SUPER_ADMIN', 'LAB_MANAGER', 'ADMIN'];

// 7. Resumable Export Snapshots
router.post('/snapshots', apiKeyAuth, apiKeyAuth.requireRole(EXCHANGE_WRITE_ROLES), apiKeyAuth.requireCapability('SNAPSHOT'), sisV2Controller.createSnapshot);
router.get('/snapshots/:snapshotId/pages', apiKeyAuth, apiKeyAuth.requireCapability('SNAPSHOT'), sisV2Controller.getSnapshotPages);

// 8. Continuous Synchronization Change Feed
router.get('/changes', apiKeyAuth, sisV2Controller.getChanges);

// 9. Receiver Delivery Receipts
router.post('/receipts', apiKeyAuth, apiKeyAuth.requireRole(EXCHANGE_WRITE_ROLES), apiKeyAuth.requireCapability('RECEIPT'), sisV2Controller.submitReceipt);

module.exports = router;
