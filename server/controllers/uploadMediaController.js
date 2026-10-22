'use strict';

const media = require('../services/uploadMediaService');

function headers(res) {
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
}
function sendError(res, error) {
    headers(res);
    const known = error?.uploadMediaError === true;
    if (!known) console.error('[UPLOAD] Image operation failed.');
    return res.status(known ? error.statusCode : 500).json({
        code: known ? error.code : 'UPLOAD_OPERATION_FAILED',
        error: known ? error.message : 'The image operation could not be completed.'
    });
}
async function issueUrls(req, res) {
    try {
        if (Object.keys(req.query).length || !req.body || Object.keys(req.body).some(key => key !== 'paths')) {
            throw Object.assign(new Error('Unsupported image request.'), {
                statusCode: 400, code: 'UPLOAD_REQUEST_INVALID', uploadMediaError: true });
        }
        const encoded = req.headers.authorization?.split(' ')[1];
        const session = encoded ? require('jsonwebtoken').decode(encoded) : null;
        const result = await media.issueUrls({ user: req.user, actor: req.actor,
            paths: req.body.paths, sessionExpiresAt: session?.exp });
        headers(res);
        return res.json(result);
    } catch (error) { return sendError(res, error); }
}
async function readImage(req, res) {
    try {
        if (Object.keys(req.query).some(key => key !== 'token')) throw Object.assign(new Error('Unsupported image request.'), {
            statusCode: 400, code: 'UPLOAD_REQUEST_INVALID', uploadMediaError: true });
        const image = await media.readImage({ user: req.user, actor: req.actor,
            canonical: '/uploads/intake/' + req.params.filename, token: req.query.token });
        headers(res);
        res.type(image.contentType);
        res.set('Content-Disposition', 'inline');
        return res.sendFile(image.filename, { root: image.root, dotfiles: 'deny',
            cacheControl: false, acceptRanges: false, lastModified: false }, error => {
            if (error && !res.headersSent) sendError(res, Object.assign(new Error('The recorded image is unavailable.'), {
                statusCode: 404, code: 'UPLOAD_NOT_FOUND', uploadMediaError: true }));
        });
    } catch (error) { return sendError(res, error); }
}

module.exports = { headers, sendError, issueUrls, readImage };
