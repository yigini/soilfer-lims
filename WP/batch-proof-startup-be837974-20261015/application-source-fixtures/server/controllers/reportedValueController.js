const prisma = require('../prisma');
const selections = require('../services/reportedValueSelectionService');
function refuse(res, original) {
    const error = require('../services/workflowStateRules').mapStateError(original);
    return res.status(error.statusCode || 500).json({ code: error.code || 'REPORTED_VALUE_SELECTION_FAILED',
        error: error.statusCode ? error.message : 'Could not read or save the reported value.', ...(error.details || {}) });
}
exports.inspect = async (req,res) => {
    try { res.json(await selections.reviewReportedSelection(prisma, req.params.id, req.user)); }
    catch (error) { refuse(res,error); }
};
exports.preview = async (req,res) => {
    try {
        const preview = await selections.reviewReportedSelection(prisma, req.params.id, req.user, req.body);
        res.status(preview.allowed ? 200 : 409).json(preview);
    }
    catch (error) { refuse(res,error); }
};
exports.select = async (req,res) => {
    try { res.status(201).json({ selections: await selections.replaceReportedSelection(prisma, req.params.id, req.user, req.body) }); }
    catch (error) { refuse(res,error); }
};
