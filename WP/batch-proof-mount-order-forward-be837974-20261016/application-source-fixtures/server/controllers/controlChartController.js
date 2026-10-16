const db = require('../prisma');
const service = require('../services/controlChartService');
const handler = fn => async (req,res) => {
    try { return res.json({success:true,...await fn(req)}); }
    catch(error) { return res.status(error.statusCode || 500).json({success:false,code:error.code || 'QC_CHART_FAILED',error:error.message}); }
};
exports.series = handler(async req => ({series:await service.listSeries(db,req.user,req.query.labId)}));
exports.chart = handler(req => service.readSeries(db,req.user,req.query));
exports.propose = handler(async req => ({proposal:await service.propose(db,req.user,req.body)}));
exports.approve = handler(async req => ({set:await service.approve(db,req.user,req.params.id)}));
exports.reviews = handler(req => service.reviews(db,req.user,req.query.labId));
exports.resolve = handler(async req => ({resolution:await service.resolveReview(db,req.user,req.params.id,req.body)}));
