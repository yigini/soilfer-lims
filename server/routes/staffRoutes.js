'use strict';

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);
router.use(checkPermission('MANAGE_USERS'));

router.post('/invitations', checkPermission('MANAGE_USERS'), userController.createInvitation);

module.exports = router;
