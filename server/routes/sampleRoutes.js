const express = require('express');
const router = express.Router();
const sampleController = require('../controllers/sampleController');
const { checkPermission } = require('../middleware/authMiddleware');

// Read routes
router.get('/expected', sampleController.searchExpectedSamples);
router.get('/locations', sampleController.getSampleLocations);
router.get('/', checkPermission('VIEW_SAMPLES'), sampleController.getSamples);

// State-change routes with RBAC
router.put('/:id/status', checkPermission('CHANGE_STATUS'), sampleController.updateStatus);
router.put('/:id/phase', checkPermission('CHANGE_STATUS'), sampleController.updatePhaseStatus);

// Reception → Acceptance
router.post('/walkin', checkPermission('CREATE_SAMPLE'), sampleController.createWalkInSample);
router.post('/:id/receive', checkPermission('RECEIVE_SAMPLE'), sampleController.receiveSample);
router.post('/:id/accept', checkPermission('RECEIVE_SAMPLE'), sampleController.acceptSample);
router.post('/:id/undo-intake', checkPermission('RECEIVE_SAMPLE'), sampleController.undoIntake);
router.put('/:id/metadata', checkPermission('CHANGE_STATUS'), sampleController.updateSampleMetadata);
router.put('/:id/project', checkPermission('CHANGE_STATUS'), sampleController.updateSampleProject);
router.put('/:id/analyses', checkPermission('CHANGE_STATUS'), sampleController.updateSampleAnalyses);
router.get('/:id/detail', checkPermission('VIEW_SAMPLES'), sampleController.getSampleDetail);
router.get('/:id/map-state', checkPermission('VIEW_SAMPLES'), sampleController.getMapState);

// Final Approval + Closure
router.post('/:id/approve', checkPermission('APPROVE_RESULTS'), sampleController.approveSample);
router.post('/:id/undo-approve', checkPermission('APPROVE_RESULTS'), sampleController.undoApproval);
router.post('/:id/archive', checkPermission('ARCHIVE_SAMPLE'), sampleController.archiveSample);
router.post('/:id/dispose', checkPermission('DISPOSE_SAMPLE'), sampleController.disposeSample);
router.delete('/:id', checkPermission('DELETE_SAMPLE'), sampleController.deleteSample);
router.post('/batch-delete', checkPermission('DELETE_SAMPLE'), sampleController.batchDeleteSamples);

module.exports = router;
