// Normalize only the bounded JSON import endpoints; other parser errors keep their existing handling.
module.exports = function importBodyLimit(error, req, res, next) {
    if (error?.type === 'entity.too.large' && /^\/api\/(inventory|equipment)\/import\/(preview|commit)\/?$/.test(req.path))
        return res.status(413).json({ code: 'IMPORT_TOO_LARGE', error: 'Import exceeds the request limit.' });
    return next(error);
};
