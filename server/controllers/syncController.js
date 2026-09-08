'use strict';

const SyncService = require('../services/syncService');

exports.processBatch = async (req, res) => {
    try {
        const result = await SyncService.processSyncBatch(req.user, req.body);
        return res.json(result);
    } catch (err) {
        console.error('[SYNC_CONTROLLER_ERROR]', err);
        return res.status(err.status || 500).json({
            error: err.message || 'Synchronization batch failed',
            code: err.code || 'SYNC_ERROR'
        });
    }
};

exports.getSyncStatus = async (req, res) => {
    return res.json({
        status: 'ok',
        serverTime: new Date().toISOString(),
        protocolVersion: 1
    });
};
