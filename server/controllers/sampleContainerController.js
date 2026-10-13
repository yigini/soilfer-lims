const prisma = require('../prisma');
const containers = require('../services/sampleContainerService');
function refused(res, error) {
    if (!error.statusCode) console.error('Container request failed:', error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Container request failed.', code: error.code || 'SAMPLE_CONTAINER_FAILED' });
}
exports.list = async (req, res) => {
    try { res.json({ containers: await containers.list(prisma, req.params.id, req.user) }); }
    catch (error) { refused(res, error); }
};
exports.create = async (req, res) => {
    try { res.status(201).json({ container: await containers.create(prisma, req.params.id, req.user, req.body) }); }
    catch (error) { refused(res, error); }
};
