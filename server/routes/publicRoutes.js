const express = require('express');
const router = express.Router();
const publicI18nController = require('../controllers/publicI18nController');

router.get('/i18n/bootstrap', publicI18nController.bootstrap);

module.exports = router;
