const express = require('express');
const router = express.Router();
const dataResultsController = require('../controllers/dataResultsController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, dataResultsController.getAnalyticalResults);

module.exports = router;
