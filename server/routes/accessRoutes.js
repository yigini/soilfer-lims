'use strict';

const express = require('express');
const router = express.Router();
const accessController = require('../controllers/accessController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/assignable-roles', checkPermission('MANAGE_USERS'), accessController.getAssignableRoles);
router.get('/capabilities', accessController.getCapabilities);
router.get('/project-membership-report', checkPermission('MANAGE_PROJECTS'), accessController.getProjectMembershipReport);

module.exports = router;
