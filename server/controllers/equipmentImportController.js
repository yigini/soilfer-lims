const imports = require('../services/equipmentImportService');
const handle = mode => async (req, res) => {
    try {
        const result = await imports[mode](req.user, req.body);
        res.status(mode === 'commit' && !result.committed ? 422 : 200).json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ code: error.code || 'IMPORT_INTERNAL_ERROR', error: error.statusCode ? error.code : 'Import could not be completed.' });
    }
};
module.exports = { preview: handle('preview'), commit: handle('commit') };
