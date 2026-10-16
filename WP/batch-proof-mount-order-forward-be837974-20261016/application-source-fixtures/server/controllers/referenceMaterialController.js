const prisma = require('../prisma');
const service = require('../services/referenceMaterialService');

function fail(res, error) {
    const message = String(error.message || '');
    if (error.statusCode) return res.status(error.statusCode).json({ code: error.code, error: message, details: error.details || {} });
    const guarded = message.match(/INVALID_REFERENCE_MATERIAL|REFERENCE_MATERIAL_IMMUTABLE|INVALID_REFERENCE_VALUE|REFERENCE_VALUE_IMMUTABLE|REFERENCE_VALUE_REFERENCED|INVALID_QC_REFERENCE_LINK/);
    const code = guarded?.[0] || (error.code === 'P2002' ? 'REFERENCE_VALUE_CURRENT_EXISTS' : error.code === 'P2003' ? 'REFERENCE_LINK_INVALID' :
        /SQLITE_BUSY|SQLITE_LOCKED|database is locked/i.test(message) ? 'REFERENCE_WRITE_BUSY' : null);
    if (code) return res.status(409).json({ code, error: 'Reference material write refused. Reload before retrying.' });
    console.error('[referenceMaterials]', error);
    return res.status(500).json({ code: 'REFERENCE_ERROR', error: 'Failed to process reference materials.' });
}
const handle = (operation, status = 200) => async (req, res) => {
    try { return res.status(status).json({ data: await prisma.$transaction(tx => operation(tx, req)) }); }
    catch (error) { return fail(res, error); }
};
exports.list = handle((tx, req) => service.listMaterials(tx, req.user, { labId: req.query.labId }));
exports.create = handle((tx, req) => service.createMaterial(tx, req.user, req.body), 201);
exports.changeStatus = handle((tx, req) => service.changeStatus(tx, req.user, req.params.id, req.body));
exports.addValue = handle((tx, req) => service.addValue(tx, req.user, req.params.id, req.body), 201);
exports.correctValue = handle((tx, req) => service.correctValue(tx, req.user, req.params.id, req.params.valueId, req.body), 201);
