const db = require('../prisma');
const templates = require('../services/instrumentImportTemplateService');
const importer = require('../services/instrumentImportService');
const multer = require('multer');
// Resource cap for an in-memory uploaded source, independent of lab policy.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024, files: 1, fields: 2 } }).single('file');
function refuse(res, error) {
    return res.status(error.statusCode || 500).json({ error: error.message, code: error.code || 'IMPORT_FAILED',
        ...(error.details && { details: error.details }) });
}
exports.uploadSource = (req, res, next) => upload(req, res, error => {
    if (error) return refuse(res, templates.fail(400, error.code === 'LIMIT_FILE_SIZE' ? 'IMPORT_FILE_TOO_LARGE' : 'IMPORT_REQUEST_INVALID', 'Supply one instrument source file.'));
    next();
});
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
function sourceInput(req, commit) {
    if (!req.file || !req.body || Object.keys(req.body).some(key => !['templateId', ...(commit ? ['previewToken'] : [])].includes(key)) ||
        typeof req.body.templateId !== 'string' || !req.body.templateId ||
        commit && (typeof req.body.previewToken !== 'string' || !req.body.previewToken))
        throw templates.fail(400, 'IMPORT_REQUEST_INVALID', 'Supply the source file and exact template preview.');
    return { batchId: req.params.batchId, templateId: req.body.templateId, sourceName: req.file.originalname,
        bytes: req.file.buffer, ...(commit && { previewToken: req.body.previewToken }) };
}
exports.previewImport = async (req, res) => {
    try { res.json(await importer.preview(db, req.user, sourceInput(req, false))); }
    catch (error) { refuse(res, error); }
};
exports.commitImport = async (req, res) => {
    try { res.status(201).json(await importer.commit(db, req.user, sourceInput(req, true))); }
    catch (error) { refuse(res, error); }
};
