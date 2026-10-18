const db = require('../prisma');
const service = require('../services/blankHistoryService');
const handler = fn => async (req, res) => {
    try { return res.json({ success: true, ...await fn(req) }); }
    catch (error) { return res.status(error.statusCode || 500).json({ success: false,
        code: error.code || 'LOD_LOQ_FAILED', error: error.statusCode ? error.message : 'Blank history request failed.' }); }
};
exports.series = handler(req => service.listSeries(db, req.user, req.query));
exports.history = handler(req => service.readHistory(db, req.user, req.query));
exports.propose = handler(async req => ({ proposal: await service.propose(db, req.user, req.body) }));
