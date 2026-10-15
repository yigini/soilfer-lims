/**
 * Review Decision Routes
 */
const express = require('express');
const router = express.Router();
const reviewDecisionController = require('../controllers/reviewDecisionController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.post('/:workItemId', checkPermission('APPROVE_RESULTS'), reviewDecisionController.createReview);
router.get('/', reviewDecisionController.getReviews);

module.exports = router;
