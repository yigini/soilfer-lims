const db = require('../prisma');
const templates = require('../services/instrumentImportTemplateService');
function refuse(res, error) {
    return res.status(error.statusCode || 500).json({ error: error.message, code: error.code || 'IMPORT_FAILED' });
}
exports.listTemplates = async (req, res) => {
    try { res.json(await templates.listTemplates(db, req.user, req.params.instrumentId, req.query.labId)); }
    catch (error) { refuse(res, error); }
};
exports.saveTemplate = async (req, res) => {
    try {
        if (Object.hasOwn(req.body || {}, 'instrumentId'))
            throw templates.fail(422, 'IMPORT_TEMPLATE_INVALID', 'Select the instrument in the route.');
        res.status(201).json(await templates.saveTemplate(db, req.user, { ...req.body, instrumentId: req.params.instrumentId }));
    } catch (error) { refuse(res, error); }
};
