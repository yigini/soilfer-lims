/**
 * SoilFER LIMS - Client Sync Engine
 * 
 * Manages:
 * - Queueing domain operations into durable IndexedDB outbox
 * - Causal sequence and payload hashing (SHA-256)
 * - Sending batches to POST /api/sync/operations
 * - Reconciling server receipts, conflicts, and deduplication
 */

import {
    queueOutboxOperation,
    getPendingOutboxOperations,
    getAllOutboxOperations,
    updateOutboxOperation,
    removeOutboxOperation
} from './offlineDb';
import { ensureDeviceId } from './workPackManager';

// Sync event listeners (callbacks triggered on state changes)
const listeners = new Set();

export function subscribeSyncState(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

function notifyListeners(event) {
    listeners.forEach(fn => {
        try { fn(event); } catch (e) { console.error('[SYNC_EVENT_ERROR]', e); }
    });
}

/**
 * Calculates SHA-256 hash of a payload object for cryptographic idempotency
 */
export async function computePayloadHash(payload) {
    const jsonStr = JSON.stringify(payload || {}, Object.keys(payload || {}).sort());
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(jsonStr);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // Simple fallback hash if crypto.subtle is unavailable
    let hash = 0;
    for (let i = 0; i < jsonStr.length; i++) {
        const char = jsonStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'fallback_' + Math.abs(hash).toString(16);
}

/**
 * Record a domain command into durable outbox
 */
export async function recordSyncOperation({
    type,
    target,
    baseVersion = 1,
    dependsOn = [],
    schemaRevision = '1.0.0',
    payload = {},
    attachmentIds = [],
    packId = null
}) {
    const deviceId = await ensureDeviceId();
    const operationId = 'op_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const payloadHash = await computePayloadHash(payload);

    const operation = {
        operationId,
        deviceId,
        packId,
        type,
        target,
        baseVersion,
        dependsOn,
        schemaRevision,
        capturedAtLocal: new Date().toISOString(),
        payloadHash,
        payload,
        attachmentIds,
        status: 'PENDING',
        retries: 0
    };

    await queueOutboxOperation(operation);
    notifyListeners({ type: 'OPERATION_QUEUED', operation });

    // Trigger background sync attempt if online
    if (navigator.onLine) {
        triggerSync().catch(err => {
            console.warn('[SYNC_BACKGROUND_FAIL] Sync will retry later:', err.message);
        });
    }

    return operation;
}

let isSyncing = false;

/**
 * Executes a sync run: collects pending operations and dispatches to /api/sync/operations
 */
export async function triggerSync(authToken = null) {
    if (isSyncing) return { status: 'ALREADY_SYNCING' };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { status: 'OFFLINE' };
    }

    const pending = await getPendingOutboxOperations();
    if (!pending || pending.length === 0) {
        return { status: 'UP_TO_DATE', count: 0 };
    }

    isSyncing = true;
    notifyListeners({ type: 'SYNC_STARTED', pendingCount: pending.length });

    try {
        const deviceId = await ensureDeviceId();
        const token = authToken || localStorage.getItem('token');

        const headers = {
            'Content-Type': 'application/json',
            'x-device-id': deviceId
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // Mark operations as SYNCING
        for (const op of pending) {
            await updateOutboxOperation(op.operationId, { status: 'SYNCING' });
        }

        const response = await fetch('/api/sync/operations', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                protocolVersion: 1,
                deviceId,
                operations: pending
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Sync failed with HTTP ${response.status}`);
        }

        const result = await response.json();
        const receipts = result.receipts || [];

        // Reconcile each operation based on server receipt
        let appliedCount = 0;
        let conflictCount = 0;

        for (const receipt of receipts) {
            const opId = receipt.operationId;
            if (receipt.status === 'APPLIED' || receipt.status === 'DUPLICATE_APPLIED') {
                // Successfully processed! Remove from outbox
                await removeOutboxOperation(opId);
                appliedCount++;
            } else if (receipt.status === 'CONFLICT') {
                // Version or conflict detected! Keep in outbox with CONFLICT status so staff can inspect
                await updateOutboxOperation(opId, {
                    status: 'CONFLICT',
                    conflictReason: receipt.reason,
                    serverVersion: receipt.serverVersion,
                    serverState: receipt.serverState
                });
                conflictCount++;
            } else {
                // REJECTED or other error
                await updateOutboxOperation(opId, {
                    status: 'REJECTED',
                    rejectionReason: receipt.reason || 'Server validation rejected operation.'
                });
            }
        }

        const summary = {
            status: 'COMPLETED',
            total: pending.length,
            applied: appliedCount,
            conflicts: conflictCount,
            timestamp: new Date().toISOString()
        };

        notifyListeners({ type: 'SYNC_COMPLETED', summary });
        return summary;
    } catch (err) {
        console.error('[SYNC_ENGINE_ERROR]', err);
        // Reset SYNCING status to PENDING for retry
        for (const op of pending) {
            await updateOutboxOperation(op.operationId, {
                status: 'PENDING',
                retries: (op.retries || 0) + 1,
                lastError: err.message
            });
        }
        notifyListeners({ type: 'SYNC_FAILED', error: err.message });
        return { status: 'FAILED', error: err.message };
    } finally {
        isSyncing = false;
    }
}
