const prisma = require('../prisma');
const rules = require('../services/workflowStateRules');
function refuse(res, original) {
    const error = rules.mapStateError(original);
    return res.status(error.statusCode || 500).json({ error: error.message, code: error.code || 'WORK_REPEAT_FAILED', ...(error.details && { details:error.details }) });
}
exports.requestRepeat = async (req,res) => {
    try { res.status(201).json(await require('../services/workRepeatService').requestRepeat(prisma,req.params.id,req.user,req.body)); }
    catch (error) { refuse(res,error); }
};
exports.correctAttempt = async (req,res) => {
    try { res.status(201).json(await require('../services/workAttemptCorrectionService').correctAttempt(prisma,req.params.id,req.user,req.body)); }
    catch (error) { refuse(res,error); }
};
