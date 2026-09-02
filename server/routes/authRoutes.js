const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.post('/login', authController.login);
router.get('/me', verifyToken, authController.me);
router.post('/change-password', verifyToken, authController.changePassword);
router.post('/impersonate', verifyToken, checkPermission('MANAGE_BRANDING'), authController.impersonate);

module.exports = router;
