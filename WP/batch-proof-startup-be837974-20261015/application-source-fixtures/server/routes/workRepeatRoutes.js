const express = require('express');
const router = express.Router();
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');
const controller = require('../controllers/workRepeatController');
router.use(verifyToken);
router.post('/:id/repeats',checkPermission('MANAGE_WORK_ATTEMPTS'),controller.requestRepeat);
router.post('/:id/repeats/limit-override',checkPermission('APPROVE_RESULTS'),controller.requestRepeatLimitOverride);
module.exports = router;
