
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, notificationController.getMyNotifications);
router.post('/mark-read', verifyToken, notificationController.markAsRead);
router.post('/mark-all-read', verifyToken, notificationController.markAllRead);
router.post('/clear-all', verifyToken, notificationController.clearAllNotifications);
router.post('/send', verifyToken, notificationController.sendInternalMessage);

module.exports = router;
