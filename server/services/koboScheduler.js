/**
 * Automated Background Scheduler for KoboToolbox
 * Ticks periodically and syncs active forms based on their configured syncIntervalMins.
 */
const prisma = require('../prisma');
const koboController = require('../controllers/koboController');

let schedulerInterval = null;
let isSyncing = false;

async function checkAndSyncKobo() {
    if (isSyncing) {
        console.log('[KOBO_SCHEDULER] Previous sync tick still in progress, skipping tick.');
        return;
    }

    isSyncing = true;
    try {
        const activeConfigs = await prisma.koboConfig.findMany({
            where: { isActive: true }
        });

        if (!activeConfigs || activeConfigs.length === 0) {
            return;
        }

        const now = Date.now();

        for (const config of activeConfigs) {
            const intervalMs = (config.syncIntervalMins || 15) * 60 * 1000;
            const lastSync = config.lastSyncAt ? new Date(config.lastSyncAt).getTime() : 0;

            if (now - lastSync >= intervalMs) {
                console.log(`[KOBO_SCHEDULER] Triggering scheduled sync for Lab: ${config.labId}, Project: ${config.projectCode || 'DEFAULT'}`);
                try {
                    const result = await koboController._syncLabSubmissions(config, 'KOBO_SCHEDULER');
                    console.log(`[KOBO_SCHEDULER] Completed sync for ${config.labId}:`, result);
                } catch (err) {
                    console.error(`[KOBO_SCHEDULER] Error syncing lab ${config.labId}:`, err.message);
                }
            }
        }
    } catch (err) {
        console.error('[KOBO_SCHEDULER] General scheduler error:', err.message);
    } finally {
        isSyncing = false;
    }
}

function startScheduler(tickIntervalMs = 60000) {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
    }
    console.log(`[KOBO_SCHEDULER] Starting Kobo background sync scheduler (Tick: ${tickIntervalMs / 1000}s)`);
    // Run an initial check after 10s startup delay
    setTimeout(() => {
        checkAndSyncKobo().catch(err => console.error('[KOBO_SCHEDULER] Initial sync error:', err.message));
    }, 10000);

    schedulerInterval = setInterval(checkAndSyncKobo, tickIntervalMs);
}

function stopScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        console.log('[KOBO_SCHEDULER] Stopped Kobo scheduler');
    }
}

module.exports = {
    startScheduler,
    stopScheduler,
    checkAndSyncKobo
};