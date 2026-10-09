const prisma = require('../prisma');
const templates = require('../services/calculationTemplateService');
const activations = require('../services/calculationActivationService');
function refuse(res, error) {
    if (error.statusCode) return res.status(error.statusCode).json({ code: error.code, error: error.message });
    const message = String(error.message || '');
    const guard = message.match(/\b(?:CALC_[A-Z_]+|CALIBRATION_[A-Z_]+|RESULT_CALCULATION_[A-Z_]+)\b/);
    if (guard) return res.status(409).json({ code: guard[0], error: 'The calculation definition changed or violates a stored guard.' });
    if (['P2002', 'P2034'].includes(error.code) || /SQLITE_BUSY|SQLITE_LOCKED|database is locked/i.test(message)) {
        return res.status(409).json({ code: 'CALC_TEMPLATE_VERSION_CHANGED', error: 'Refresh the calculation definition before retrying.' });
    }
    if (error.code === 'P2021' || /no such table/i.test(message)) return res.status(409).json({ code: 'CALC_NOT_INSTALLED', error: 'The calculation release is not installed.' });
    if (error.code === 'P2003') return res.status(409).json({ code: 'CALC_TEMPLATE_SCOPE_INVALID', error: 'A calculation reference changed.' });
    console.error('[calculationTemplates]', error);
    return res.status(500).json({ code: 'CALC_TEMPLATE_ERROR', error: 'Unable to process the calculation template.' });
}
const handle = (operation, status = 200) => async (req, res) => {
    try { return res.status(status).json({ data: await operation(req) }); }
    catch (error) { return refuse(res, error); }
};
exports.list = handle(req => templates.list(prisma, req.user, { labId: req.query.labId, analysisCode: req.query.analysisCode }));
exports.clone = handle(req => templates.clone(prisma, req.user, req.params.id, req.body), 201);
exports.revise = handle(req => templates.revise(prisma, req.user, req.params.id, req.body), 201);
exports.activation = handle(req => activations.change(prisma, req.user, req.params.id, req.body), 201);
exports.activationState = handle(req => activations.getState(prisma, req.user, { labId: req.query.labId,
    analysisCode: req.query.analysisCode, methodologyId: req.query.methodologyId === '' || req.query.methodologyId === 'null' ? null : req.query.methodologyId }));
