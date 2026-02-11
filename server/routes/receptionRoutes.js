const express = require('express');
const router = express.Router();
const receptionController = require('../controllers/receptionController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);

// POST /api/reception/intake
// Requires RECEIVE_SAMPLE permission
router.post('/intake', checkPermission('RECEIVE_SAMPLE'), receptionController.processIntake);

module.exports = router;
