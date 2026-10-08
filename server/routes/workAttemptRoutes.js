const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const controller = require('../controllers/workRepeatController');
router.use(verifyToken);
router.post('/:id/corrections',controller.correctAttempt);
module.exports = router;
