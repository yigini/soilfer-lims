'use strict';

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);
// 1. Public/Common Routes (Authenticated Only)
router.get('/directory', userController.getDirectory);

// 2. Restricted Management Routes
// Enforce MANAGE_USERS for all user operations below
router.use(checkPermission('MANAGE_USERS'));

router.get('/', userController.getUsers);
router.post('/', userController.createUser);
router.get('/invitations', checkPermission('MANAGE_USERS'), userController.getPendingInvitations);
router.post('/invitations', checkPermission('MANAGE_USERS'), userController.createInvitation);
router.post('/invitations/:id/reissue', checkPermission('MANAGE_USERS'), userController.reissueInvitation);
router.post('/invitations/:id/revoke', checkPermission('MANAGE_USERS'), userController.revokeInvitation);
router.delete('/invitations/:id', checkPermission('MANAGE_USERS'), userController.revokeInvitation);
router.post('/:id/access-preview', checkPermission('MANAGE_USERS'), userController.getAccessPreview);
router.patch('/:id/access', checkPermission('MANAGE_USERS'), userController.applyAccess);
router.post('/:id/suspend', checkPermission('MANAGE_USERS'), userController.suspendUser);
router.post('/:id/reactivate', checkPermission('MANAGE_USERS'), userController.reactivateUser);
router.post('/:id/recovery', checkPermission('MANAGE_USERS'), userController.createRecovery);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
