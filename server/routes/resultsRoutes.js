const express = require('express');
const router = express.Router();
const resultsController = require('../controllers/resultsController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/:sampleId', checkPermission('VIEW_SAMPLES'), resultsController.getResults);
router.get('/:sampleId/history', checkPermission('VIEW_SAMPLES'), resultsController.getResultHistory);
router.get('/:sampleId/history/:param', checkPermission('VIEW_SAMPLES'), resultsController.getResultHistory);
router.post('/:sampleId', checkPermission('ENTER_RESULTS'), resultsController.saveResults);
router.post('/:sampleId/submit', checkPermission('ENTER_RESULTS'), resultsController.submitForApproval);

module.exports = router;
