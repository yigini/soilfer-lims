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
        return res.status(404).json({ error: `Offline pack '${id}' not found`, code: 'PACK_NOT_FOUND' });
    }

    // 1. Lease Expiry Check (IR-08)
    if (pack.expiresAt && new Date(pack.expiresAt) <= new Date()) {
        packCache.delete(id);
        return res.status(410).json({ error: `Offline pack '${id}' has expired`, code: 'PACK_EXPIRED' });
    }

    // 2. Strict ownership & laboratory scope matching (IR-08)
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const isOwner = pack.userId === req.user.id || pack.userId === req.user.username;
    const isSameLab = Boolean(req.user.labId && pack.labId && req.user.labId === pack.labId);

    if (!isSuperAdmin && (!isOwner || !isSameLab)) {
        return res.status(403).json({ error: 'Access denied to this offline work pack', code: 'PACK_ACCESS_DENIED' });
    }

    // 3. Current Session & Token Version Revalidation (IR-08, IR-09)
    if (req.user.tokenVersion !== undefined && pack.tokenVersion !== undefined && req.user.tokenVersion !== pack.tokenVersion) {
        return res.status(401).json({ error: 'Session invalidated since pack issuance. Re-authentication required.', code: 'SESSION_INVALIDATED' });
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
