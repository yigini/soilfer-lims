'use strict';

const WorkPackService = require('../services/workPackService');

// In-memory cache of generated packs (or could be persisted in DB/file cache)
const packCache = new Map();

exports.preparePack = async (req, res) => {
    try {
        const bundle = await WorkPackService.preparePack(req.user, req.body || {});
        packCache.set(bundle.packId, bundle);
        return res.json(bundle);
    } catch (err) {
        console.error('[OFFLINE_CONTROLLER_PREPARE_ERROR]', err);
        return res.status(err.status || 500).json({
            error: err.message || 'Failed to prepare offline work pack'
        });
    }
};

exports.getPack = async (req, res) => {
    const { id } = req.params;
    let pack = packCache.get(id);

    if (!pack) {
        // Try regenerating or return 404
        try {
            pack = await WorkPackService.preparePack(req.user, { labId: req.user.labId });
            packCache.set(pack.packId, pack);
        } catch (e) {
            return res.status(404).json({ error: `Offline pack '${id}' not found or expired` });
        }
    }

    return res.json(pack);
};

exports.enrollDevice = async (req, res) => {
    const { deviceId, platform, appVersion } = req.body || {};
    return res.json({
        success: true,
        deviceId: deviceId || ('dev_' + Date.now()),
        enrolledAt: new Date().toISOString(),
        leaseDurationHours: 12
    });
};
