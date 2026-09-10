/**
 * SoilFER LIMS - Work Pack Manager
 * Handles downloading, caching, and querying scoped work packs for offline shifts.
 */

import {
    saveWorkPack,
    getActiveWorkPack,
    cacheSamples,
    cacheWorkItems,
    getAllOfflineSamples,
    getOfflineSample,
    getOfflineWorkItemsForSample,
    getEnrolledDevice,
    setEnrolledDevice,
    saveOfflineHelpPack
} from './offlineDb';

/**
 * Ensures this browser/device has a stable persistent device ID
 */
export async function ensureDeviceId() {
    let dev = await getEnrolledDevice();
    if (!dev || !dev.deviceId) {
        const generatedId = 'dev_' + (crypto?.randomUUID ? crypto.randomUUID() : ('d' + Date.now() + Math.random().toString(36).substring(2, 9)));
        dev = {
            deviceId: generatedId,
            platform: navigator.userAgent.includes('Mobi') ? 'mobile_web' : 'desktop_web',
            appVersion: '1.4.0',
            userAgent: navigator.userAgent,
            enrolledAt: new Date().toISOString()
        };
        await setEnrolledDevice(dev);
    }
    return dev.deviceId;
}

/**
 * Downloads a scoped work pack from server and activates it in local IndexedDB
 */
export async function downloadAndActivateWorkPack({ labId, methodCodes, sampleIds, token }) {
    const deviceId = await ensureDeviceId();

    const headers = {
        'Content-Type': 'application/json',
        'x-device-id': deviceId
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // 1. Request pack preparation
    const prepRes = await fetch('/api/offline/packs/prepare', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            deviceId,
            labId,
            methodCodes: methodCodes || [],
            sampleIds: sampleIds || []
        })
    });

    if (!prepRes.ok) {
        const errData = await prepRes.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to prepare work pack: ${prepRes.status}`);
    }

    const packManifest = await prepRes.json();
    const packId = packManifest.packId || packManifest.id;

    // 2. Fetch pack full bundle
    const packRes = await fetch(`/api/offline/packs/${packId}`, {
        method: 'GET',
        headers
    });

    if (!packRes.ok) {
        throw new Error(`Failed to download work pack bundle: ${packRes.status}`);
    }

    const bundle = await packRes.json();

    // 3. Atomically save to IndexedDB
    await saveWorkPack({
        packId,
        userId: bundle.userId,
        labId: bundle.labId,
        issuedAt: bundle.issuedAt,
        expiresAt: bundle.expiresAt,
        sampleCount: bundle.samples?.length || 0,
        itemCount: bundle.workItems?.length || 0,
        manifest: bundle.manifest || packManifest,
        downloadedAt: new Date().toISOString()
    });

    // 4. Cache samples & work items
    if (bundle.samples && bundle.samples.length) {
        await cacheSamples(bundle.samples);
    }
    if (bundle.workItems && bundle.workItems.length) {
        await cacheWorkItems(bundle.workItems);
    }

    // 5. Download and cache scoped offline help pack
    try {
        const helpRes = await fetch('/api/help/pack', { method: 'GET', headers });
        if (helpRes.ok) {
            const helpData = await helpRes.json();
            if (helpData?.pack) {
                await saveOfflineHelpPack(helpData.pack);
            }
        }
    } catch (e) {
        console.warn('[WORK_PACK] Notice caching offline help pack:', e.message);
    }

    return bundle;
}

/**
 * Checks if current active pack is still within valid lease period (12h default)
 */
export async function checkPackValidity(user) {
    const pack = await getActiveWorkPack(user?.id, user?.labId);
    if (!pack) {
        return { hasPack: false, isExpired: false, pack: null };
    }

    const now = new Date();
    const expiry = new Date(pack.expiresAt);
    const isExpired = now >= expiry;
    const remainingMs = Math.max(0, expiry - now);

    return {
        hasPack: true,
        isExpired,
        remainingMinutes: Math.round(remainingMs / 60000),
        pack
    };
}
