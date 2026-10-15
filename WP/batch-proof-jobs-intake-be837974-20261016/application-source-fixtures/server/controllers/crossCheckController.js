const prisma = require('../prisma');
const { reviewCrossChecks } = require('../services/crossCheckEvaluationService');
exports.review = async (req, res) => {
    try { res.json(await reviewCrossChecks(prisma, req.params.sampleId, req.user)); }
    catch (error) { res.status(error.statusCode || 500).json({ code: error.code || 'CROSS_CHECK_READ_FAILED',
        error: error.statusCode ? error.message : 'Could not read cross-check evidence.' }); }
};
