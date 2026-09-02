const express = require('express');
const router = express.Router();
const ptController = require('../controllers/ptController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// Record a new PT round (Lab technicians, managers, admins)
router.post('/rounds', verifyToken, checkPermission('ENTER_RESULTS'), ptController.recordRound);

// List/filter PT rounds
router.get('/rounds', verifyToken, ptController.getRounds);

// Summary & Reportable Indicator metrics
router.get('/summary', verifyToken, ptController.getSummary);

// Delete PT round
router.delete('/rounds/:id', verifyToken, checkPermission('APPROVE_RESULTS'), ptController.deleteRound);

module.exports = router;
