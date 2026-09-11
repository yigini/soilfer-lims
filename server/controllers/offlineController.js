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
    const pack = packCache.get(id);

    if (!pack) {
        return res.status(404).json({ error: `Offline pack '${id}' not found or expired` });
    }

    // Verify pack ownership & lab scope (LG-15, P23)
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const isOwner = pack.userId === req.user.id || pack.userId === req.user.username;
    const isSameLab = !req.user.labId || !pack.labId || req.user.labId === pack.labId;

    if (!isSuperAdmin && (!isOwner || !isSameLab)) {
        return res.status(403).json({ error: 'Access denied to this offline work pack' });
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
