const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

const { verifyToken } = require('../middleware/authMiddleware');

// Apply verifyToken to all routes
router.use(verifyToken);

router.get('/', messageController.getMessages);
router.get('/conversations', messageController.getConversations);
router.get('/thread/:userId', messageController.getThread);
router.post('/send', messageController.sendMessage);
router.post('/draft', messageController.saveDraft);
router.post('/read', messageController.markRead);
router.post('/move', messageController.moveFolder);

module.exports = router;
