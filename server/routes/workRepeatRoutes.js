const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const controller = require('../controllers/workRepeatController');
router.use(verifyToken);
router.post('/:id/repeats',controller.requestRepeat);
module.exports = router;
