'use strict';

const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/operations', verifyToken, syncController.processBatch);
router.get('/status', syncController.getSyncStatus);

module.exports = router;
