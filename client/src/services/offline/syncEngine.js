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
} from './offlineDb.js';
import { ensureDeviceId } from './workPackManager.js';

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
    packId = null,
    userId = null,
    labId = null
}) {
    const deviceId = await ensureDeviceId();
    const operationId = 'op_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const payloadHash = await computePayloadHash(payload);

    // Resolve user and lab context from session if not explicitly provided
    // Canonical ownership identity: ALWAYS prefer id over username
    let opUser = resolveCanonicalUserId(userId);
    let opLab = labId;

    if (!opUser || !opLab) {
        const storedUser = getActiveSessionUser();
        if (storedUser) {
            if (!opUser) {
                opUser = resolveCanonicalUserId(storedUser);
            }
            opLab = opLab || storedUser.labId || null;
        }
    }

    const operation = {
        operationId,
        deviceId,
        packId,
        userId: opUser,
        labId: opLab,
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
    if (typeof navigator !== 'undefined' && navigator.onLine) {
        triggerSync().catch(err => {
            console.warn('[SYNC_BACKGROUND_FAIL] Sync will retry later:', err.message);
        });
    }

    return operation;
}

let isSyncing = false;

export function _resetSyncingState() {
    isSyncing = false;
}

export function resolveCanonicalUserId(userOrId) {
    if (!userOrId) return null;
    if (typeof userOrId === 'string') {
        const trimmed = userOrId.trim();
        return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof userOrId === 'object') {
        const candidate = userOrId.id || userOrId.userId || userOrId.username;
        if (typeof candidate === 'string') {
            const trimmed = candidate.trim();
            return trimmed.length > 0 ? trimmed : null;
        }
    }
    return null;
}

export function getActiveSessionUser() {
    if (typeof localStorage !== 'undefined') {
        try {
            const raw = localStorage.getItem('user');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    return parsed;
                }
            }
        } catch {}
    }
    return null;
}

export function getActiveSessionUserId() {
    return resolveCanonicalUserId(getActiveSessionUser());
}

/**
 * Executes a sync run: collects pending operations and dispatches to /api/sync/operations
 */
export async function triggerSync(authToken = null, userContext = null) {
    if (isSyncing) return { status: 'ALREADY_SYNCING', code: 'ALREADY_SYNCING', count: 0 };
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { status: 'OFFLINE', code: 'OFFLINE', count: 0 };
    }

    // Resolve user identity strictly and canonically
    let activeUserObj = null;
    let resolvedUserId = null;
    let legacyUsername = null;

    if (userContext) {
        if (typeof userContext === 'string' && userContext.trim()) {
            resolvedUserId = userContext.trim();
            const sessionUser = getActiveSessionUser();
            if (sessionUser && (sessionUser.id === resolvedUserId || sessionUser.userId === resolvedUserId)) {
                activeUserObj = sessionUser;
                if (sessionUser.username && typeof sessionUser.username === 'string') {
                    legacyUsername = sessionUser.username.trim();
                }
            }
        } else if (typeof userContext === 'object') {
            activeUserObj = userContext;
            resolvedUserId = resolveCanonicalUserId(userContext);
            if (userContext.username && typeof userContext.username === 'string') {
                legacyUsername = userContext.username.trim();
            }
        }
    }

    // If authToken was supplied directly without valid userContext, fail closed immediately
    if (authToken && !resolvedUserId) {
        return {
            status: 'AUTH_REQUIRED',
            code: 'MISSING_USER_IDENTITY',
            error: 'Authentication token supplied without valid user context.',
            count: 0
        };
    }

    // If no userContext provided and no authToken provided, attempt resolution from localStorage session
    if (!resolvedUserId) {
        activeUserObj = getActiveSessionUser();
        resolvedUserId = resolveCanonicalUserId(activeUserObj);
        if (activeUserObj && activeUserObj.username && typeof activeUserObj.username === 'string') {
            legacyUsername = activeUserObj.username.trim();
        }
    }

    // Fail closed if user identity is missing or malformed
    if (!resolvedUserId || typeof resolvedUserId !== 'string' || !resolvedUserId.trim()) {
        return {
            status: 'AUTH_REQUIRED',
            code: 'MISSING_USER_IDENTITY',
            error: 'Cannot sync outbox without verified user identity.',
            count: 0
        };
    }

    const token = authToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null);
    if (!token) {
        return {
            status: 'AUTH_REQUIRED',
            code: 'MISSING_AUTH_TOKEN',
            error: 'Authentication token is required to perform sync.',
            count: 0
        };
    }

    // Query pending operations partitioned strictly for resolvedUserId, preserving verified legacy username records
    const pending = await getPendingOutboxOperations(resolvedUserId, legacyUsername);
    if (!pending || pending.length === 0) {
        return { status: 'UP_TO_DATE', count: 0 };
    }

    isSyncing = true;
    notifyListeners({ type: 'SYNC_STARTED', pendingCount: pending.length });

    try {
        // Account switch check before network dispatch
        const activeBefore = getActiveSessionUserId();
        if (activeBefore && activeBefore !== resolvedUserId && activeBefore !== legacyUsername) {
            return {
                status: 'ABORTED',
                code: 'ACCOUNT_SWITCH_DETECTED',
                error: 'Active user session changed before transmission. Aborted to prevent cross-account attribution.',
                count: 0
            };
        }

        const deviceId = await ensureDeviceId();
        const headers = {
            'Content-Type': 'application/json',
            'x-device-id': deviceId,
            'Authorization': `Bearer ${token}`
        };

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

        // Account switch check after network response
        const activeAfter = getActiveSessionUserId();
        if (activeAfter && activeAfter !== resolvedUserId && activeAfter !== legacyUsername) {
            // Revert SYNCING back to PENDING so User A's ops remain safe and un-synced under User B
            for (const op of pending) {
                await updateOutboxOperation(op.operationId, { status: 'PENDING' });
            }
            return {
                status: 'ABORTED',
                code: 'ACCOUNT_SWITCH_DETECTED',
                error: 'Active user session changed during sync. Safely aborted without attributing operations to new user.',
                count: 0
            };
        }

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Sync failed with HTTP ${response.status}`);
        }

        const result = await response.json();
        const receipts = result.receipts || [];

        let appliedCount = 0;
        let conflictCount = 0;

        for (const receipt of receipts) {
            const opId = receipt.operationId;
            if (receipt.status === 'APPLIED' || receipt.status === 'DUPLICATE_APPLIED' || receipt.status === 'SUCCESS') {
                await removeOutboxOperation(opId);
                appliedCount++;
            } else if (receipt.status === 'CONFLICT') {
                await updateOutboxOperation(opId, {
                    status: 'CONFLICT',
                    conflictReason: receipt.reason || receipt.error,
                    serverVersion: receipt.serverVersion,
                    serverState: receipt.serverState
                });
                conflictCount++;
            } else {
                await updateOutboxOperation(opId, {
                    status: 'REJECTED',
                    rejectionReason: receipt.reason || receipt.error || 'Server validation rejected operation.'
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
