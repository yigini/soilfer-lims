const express = require('express');
const router = express.Router();
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');
const controller = require('../controllers/workRepeatController');
router.use(verifyToken);
router.post('/:id/repeats',checkPermission('MANAGE_WORK_ATTEMPTS'),controller.requestRepeat);
module.exports = router;
