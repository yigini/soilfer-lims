'use strict';

const express = require('express');
const { verifyToken } = require('../middleware/authMiddleware');
const controller = require('../controllers/uploadMediaController');

const api = express.Router();
api.use((req, res, next) => { controller.headers(res); next(); });
api.use(verifyToken);
api.post('/access', controller.issueUrls);

const files = express.Router();
files.use((req, res, next) => { controller.headers(res); next(); });
files.get('/intake/:filename', (req, res) => req.headers.authorization
    ? verifyToken(req, res, () => controller.readImage(req, res)) : controller.readImage(req, res));
// No static fallback: instrument sources/staging/ownership metadata and all
// unknown directories remain unavailable through the browser image mount.
files.use((req, res) => req.headers.authorization
    ? verifyToken(req, res, () => res.status(404).json({ error: 'Image not found.' }))
    : res.status(401).json({ error: 'Image access is required.' }));
files.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    // Express URI decoding errors must not send a signed query to the global logger.
    return controller.sendError(res, Object.assign(new Error('Unsupported image request.'), {
        statusCode: 400, code: 'UPLOAD_REQUEST_INVALID', uploadMediaError: true }));
});

module.exports = { api, files };
