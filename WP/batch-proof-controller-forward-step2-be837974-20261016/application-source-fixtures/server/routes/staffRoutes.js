'use strict';

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);
router.use(checkPermission('MANAGE_USERS'));

router.get('/invitations', checkPermission('MANAGE_USERS'), userController.getPendingInvitations);
router.post('/invitations', checkPermission('MANAGE_USERS'), userController.createInvitation);
router.post('/invitations/:id/reissue', checkPermission('MANAGE_USERS'), userController.reissueInvitation);
router.post('/invitations/:id/revoke', checkPermission('MANAGE_USERS'), userController.revokeInvitation);
router.delete('/invitations/:id', checkPermission('MANAGE_USERS'), userController.revokeInvitation);

module.exports = router;
