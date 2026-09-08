'use strict';

const express = require('express');
const router = express.Router();
const offlineController = require('../controllers/offlineController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/devices/enroll', verifyToken, offlineController.enrollDevice);
router.post('/packs/prepare', verifyToken, offlineController.preparePack);
router.get('/packs/:id', verifyToken, offlineController.getPack);

module.exports = router;
