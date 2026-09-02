/**
 * Submission Routes - Step 5
 */
const express = require('express');
const router = express.Router();
const submissionController = require('../controllers/submissionController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);

// Technician creates submission
router.post('/', checkPermission('ENTER_RESULTS'), submissionController.createSubmission);

// List submissions (scoped by role)
router.get('/', submissionController.listSubmissions);

// Get reanalysis requests (technician)
router.get('/reanalysis', submissionController.getReanalysisRequests);

// Get submission detail
router.get('/:id', submissionController.getSubmission);

// Manager reviews submission with per-item decisions
router.post('/:id/review', checkPermission('APPROVE_RESULTS'), submissionController.reviewSubmission);

module.exports = router;

