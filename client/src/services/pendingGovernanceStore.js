// Scoped registry of in-flight and unresolved project governance operations
// Entries are strictly keyed by actor (authenticated user ID) + project + action
const pendingOperationsStore = new Map();
const pendingManifestStore = new Map();

export function makeOpKey(actorId, projectId, actionType) {
    const actor = actorId || 'anonymous';
    return `${actor}:${projectId}:${actionType}`;
}

export function makeManifestKey(actorId, projectId) {
    const actor = actorId || 'anonymous';
    return `${actor}:${projectId}`;
}

export function getPendingOperation(actorId, projectId, actionType) {
    if (!projectId || !actionType) return null;
    const key = makeOpKey(actorId, projectId, actionType);
    return pendingOperationsStore.get(key) || null;
}

export function setPendingOperation(actorId, projectId, actionType, record) {
    if (!projectId || !actionType || !record) return;
    const key = makeOpKey(actorId, projectId, actionType);
    pendingOperationsStore.set(key, record);
}

export function deletePendingOperation(actorId, projectId, actionType) {
    if (!projectId || !actionType) return;
    const key = makeOpKey(actorId, projectId, actionType);
    pendingOperationsStore.delete(key);
}

export function findPendingOperationForProject(actorId, projectId) {
    if (!projectId) return null;
    const actor = actorId || 'anonymous';
    const prefix = `${actor}:${projectId}:`;
    for (const [k, v] of pendingOperationsStore.entries()) {
        if (k.startsWith(prefix)) {
            return v;
        }
    }
    return null;
}

export function getPendingManifest(actorId, projectId) {
    if (!projectId) return null;
    const key = makeManifestKey(actorId, projectId);
    return pendingManifestStore.get(key) || null;
}

export function setPendingManifest(actorId, projectId, record) {
    if (!projectId || !record) return;
    const key = makeManifestKey(actorId, projectId);
    pendingManifestStore.set(key, record);
}

export function deletePendingManifest(actorId, projectId) {
    if (!projectId) return;
    const key = makeManifestKey(actorId, projectId);
    pendingManifestStore.delete(key);
}

export function clearAllPendingGovernance(actorId = null) {
    if (actorId) {
        const actorPrefix = `${actorId}:`;
        for (const k of Array.from(pendingOperationsStore.keys())) {
            if (k.startsWith(actorPrefix)) pendingOperationsStore.delete(k);
        }
        for (const k of Array.from(pendingManifestStore.keys())) {
            if (k.startsWith(actorPrefix)) pendingManifestStore.delete(k);
        }
    } else {
        pendingOperationsStore.clear();
        pendingManifestStore.clear();
    }
}
