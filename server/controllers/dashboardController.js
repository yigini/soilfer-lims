/**
 * Dashboard Controller
 * 
 * Handles authenticated requests for:
 * 1. GET /api/dashboard/home (Unified contract response)
 * 2. GET /api/dashboard/queues/:queueKey (Paginated selector rows)
 * 3. GET /api/dashboard/live (Backward-compatible adapter)
 */
'use strict';

const dashboardService = require('../services/dashboardService');
const { getQaDashboard } = require('../services/qaDashboardService');

async function getQa(req, res) {
    try {
        res.json(await getQaDashboard(req.user, { labId: req.query.labId, days: req.query.days }));
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to load QA dashboard',
            code: err.code || 'QA_DASHBOARD_ERROR' });
    }
}

async function getHome(req, res) {
    try {
        const homeData = await dashboardService.getDashboardHome(req.user, {
            selectedLabId: req.query.labId,
            selectedProjectId: req.query.projectId
        });
        res.json(homeData);
    } catch (err) {
        console.error('[DashboardController] getHome error:', err);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to load dashboard home',
            code: err.code || 'DASHBOARD_HOME_ERROR'
        });
    }
}

async function getQueue(req, res) {
    try {
        const { queueKey } = req.params;
        const queueData = await dashboardService.getQueueRows(req.user, queueKey, {
            page: req.query.page,
            pageSize: req.query.pageSize,
            selectedLabId: req.query.labId,
            selectedProjectId: req.query.projectId,
            search: req.query.q
        });
        res.json(queueData);
    } catch (err) {
        console.error(`[DashboardController] getQueue error for ${req.params?.queueKey}:`, err);
        res.status(err.statusCode || 500).json({
            error: err.message || 'Failed to load queue rows',
            code: err.code || 'QUEUE_ERROR'
        });
    }
}

module.exports = {
    getQa,
    getHome,
    getQueue
};
