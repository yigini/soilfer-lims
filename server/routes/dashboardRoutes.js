/**
 * Dashboard Routes
 */
'use strict';

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const dashboardController = require('../controllers/dashboardController');

router.get('/home', verifyToken, dashboardController.getHome);
router.get('/qa', verifyToken, dashboardController.getQa);
router.get('/queues/:queueKey', verifyToken, dashboardController.getQueue);

module.exports = router;
