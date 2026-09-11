const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.post('/login', authController.login);
router.get('/me', verifyToken, authController.me);
router.patch('/preferences', verifyToken, authController.updatePreferences);
router.patch('/profile', verifyToken, authController.updateProfile);
router.post('/change-password', verifyToken, authController.changePassword);
router.post('/impersonate', verifyToken, checkPermission('MANAGE_BRANDING'), authController.impersonate);

// Staff Invitation & Password Recovery Token Endpoints (IR-06)
const staffLifecycleService = require('../services/staffLifecycleService');

router.get('/invitation/:token', async (req, res) => {
    try {
        const info = await staffLifecycleService.verifyInvitationToken(req.params.token);
        res.json(info);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.code || 'INVITATION_ERROR', message: err.message });
    }
});

router.post('/activate', async (req, res) => {
    try {
        const { token, username, password } = req.body;
        const user = await staffLifecycleService.consumeInvitation(token, { username, password });
        res.status(201).json({ success: true, user, message: 'Account activated successfully. You can now log in.' });
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.code || 'ACTIVATION_ERROR', message: err.message });
    }
});

router.get('/recovery/:token', async (req, res) => {
    try {
        const info = await staffLifecycleService.verifyRecoveryToken(req.params.token);
        res.json(info);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.code || 'RECOVERY_ERROR', message: err.message });
    }
});

router.post('/reset-password-grant', async (req, res) => {
    try {
        const { token, password } = req.body;
        const result = await staffLifecycleService.consumeRecoveryGrant(token, { newPassword: password });
        res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.code || 'RECOVERY_ERROR', message: err.message });
    }
});

module.exports = router;
