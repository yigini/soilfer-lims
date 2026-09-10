/**
 * SoilFER LIMS - Offline Storage Database (IndexedDB)
 * 
 * Provides durable, transactional local storage for:
 * - Scoped work packs
 * - Offline sample & work item snapshots
 * - Immutable operation outbox
 * - Local drafts and operational receipts
 */

const DB_NAME = 'soilfer_lims_offline';
const DB_VERSION = 2;

let dbPromise = null;

export function getOfflineDb() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (typeof window === 'undefined' || !window.indexedDB) {
            return reject(new Error('IndexedDB is not supported on this platform.'));
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // 1. Work packs store: keyed by packId
            if (!db.objectStoreNames.contains('workPacks')) {
                const packStore = db.createObjectStore('workPacks', { keyPath: 'packId' });
                packStore.createIndex('userId', 'userId', { unique: false });
                packStore.createIndex('labId', 'labId', { unique: false });
                packStore.createIndex('expiresAt', 'expiresAt', { unique: false });
            }

            // 2. Samples store: keyed by sampleId
            if (!db.objectStoreNames.contains('samples')) {
                const sampleStore = db.createObjectStore('samples', { keyPath: 'id' });
                sampleStore.createIndex('originalId', 'originalId', { unique: false });
                sampleStore.createIndex('labId', 'labId', { unique: false });
                sampleStore.createIndex('status', 'status', { unique: false });
            }

            // 3. Work items store: keyed by workItemId
            if (!db.objectStoreNames.contains('workItems')) {
                const itemStore = db.createObjectStore('workItems', { keyPath: 'id' });
                itemStore.createIndex('sampleId', 'sampleId', { unique: false });
                itemStore.createIndex('methodCode', 'methodCode', { unique: false });
                itemStore.createIndex('status', 'status', { unique: false });
            }

            // 4. Outbox store: queued operations to be synced to server
            if (!db.objectStoreNames.contains('outbox')) {
                const outboxStore = db.createObjectStore('outbox', { keyPath: 'operationId' });
                outboxStore.createIndex('status', 'status', { unique: false });
                outboxStore.createIndex('capturedAtLocal', 'capturedAtLocal', { unique: false });
                outboxStore.createIndex('type', 'type', { unique: false });
            }

            // 5. Local drafts store: keyed by draftKey
            if (!db.objectStoreNames.contains('drafts')) {
                db.createObjectStore('drafts', { keyPath: 'draftKey' });
            }

            // 6. Sync receipts and history log
            if (!db.objectStoreNames.contains('syncLog')) {
                const logStore = db.createObjectStore('syncLog', { keyPath: 'id', autoIncrement: true });
                logStore.createIndex('operationId', 'operationId', { unique: false });
                logStore.createIndex('appliedAt', 'appliedAt', { unique: false });
            }

            // 7. Device enrollment identity
            if (!db.objectStoreNames.contains('device')) {
                db.createObjectStore('device', { keyPath: 'key' });
            }

            // 8. Offline Help Knowledge Base store: keyed by article id
            if (!db.objectStoreNames.contains('helpArticles')) {
                const helpStore = db.createObjectStore('helpArticles', { keyPath: 'id' });
                helpStore.createIndex('category', 'category', { unique: false });
            }

            // 9. Offline Help metadata (lastSync, blockers, categories)
            if (!db.objectStoreNames.contains('helpMeta')) {
                db.createObjectStore('helpMeta', { keyPath: 'key' });
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error('[OFFLINE_DB] Failed to open IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });

    return dbPromise;
}

/**
 * Generic promise wrapper for IndexedDB transactions
 */
export async function withStore(storeName, mode, callback) {
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);

        let result;
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error('Transaction aborted'));

        try {
            result = callback(store, tx);
        } catch (err) {
            reject(err);
        }
    });
}

// ─── OUTBOX OPERATIONS ───

export async function queueOutboxOperation(op) {
    if (!op.operationId) {
        op.operationId = 'op_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    }
    op.status = op.status || 'PENDING';
    op.capturedAtLocal = op.capturedAtLocal || new Date().toISOString();
    op.retries = op.retries || 0;

    await withStore('outbox', 'readwrite', (store) => {
        store.put(op);
    });

    return op;
}

export async function getPendingOutboxOperations() {
    return withStore('outbox', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const all = request.result || [];
                // Sort by capturedAtLocal ascending (causal sequence)
                all.sort((a, b) => new Date(a.capturedAtLocal) - new Date(b.capturedAtLocal));
                resolve(all.filter(o => o.status === 'PENDING' || o.status === 'RETRYING'));
            };
            request.onerror = () => reject(request.error);
        });
    });
}

export async function getAllOutboxOperations() {
    return withStore('outbox', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const all = request.result || [];
                all.sort((a, b) => new Date(b.capturedAtLocal) - new Date(a.capturedAtLocal));
                resolve(all);
            };
            request.onerror = () => reject(request.error);
        });
    });
}

export async function updateOutboxOperation(operationId, updates) {
    return withStore('outbox', 'readwrite', (store) => {
        return new Promise((resolve, reject) => {
            const getReq = store.get(operationId);
            getReq.onsuccess = () => {
                if (!getReq.result) return resolve(null);
                const updated = { ...getReq.result, ...updates };
                store.put(updated);
                resolve(updated);
            };
            getReq.onerror = () => reject(getReq.error);
        });
    });
}

export async function removeOutboxOperation(operationId) {
    return withStore('outbox', 'readwrite', (store) => {
        store.delete(operationId);
    });
}

// ─── WORK PACK STORAGE ───

export async function saveWorkPack(pack) {
    return withStore('workPacks', 'readwrite', (store) => {
        store.put(pack);
    });
}

export async function getActiveWorkPack(userId, labId) {
    return withStore('workPacks', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const packs = request.result || [];
                const now = new Date();
                // Find valid, unexpired pack for user/lab
                const valid = packs.find(p => 
                    (!userId || p.userId === userId) &&
                    (!labId || p.labId === labId) &&
                    new Date(p.expiresAt) > now
                );
                resolve(valid || packs[packs.length - 1] || null);
            };
            request.onerror = () => reject(request.error);
        });
    });
}

// ─── LOCAL SAMPLES & WORK ITEMS CACHE ───

export async function cacheSamples(samplesList) {
    if (!samplesList || !samplesList.length) return;
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('samples', 'readwrite');
        const store = tx.objectStore('samples');
        for (const s of samplesList) {
            store.put(s);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function cacheWorkItems(itemsList) {
    if (!itemsList || !itemsList.length) return;
    const db = await getOfflineDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('workItems', 'readwrite');
        const store = tx.objectStore('workItems');
        for (const it of itemsList) {
            store.put(it);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getOfflineSample(sampleId) {
    return withStore('samples', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
            const req = store.get(sampleId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    });
}

export async function getAllOfflineSamples() {
    return withStore('samples', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    });
}

export async function getOfflineWorkItemsForSample(sampleId) {
    return withStore('workItems', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
            const index = store.index('sampleId');
            const req = index.getAll(sampleId);
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });
    });
}

// ─── DRAFTS ───

export async function saveLocalDraft(draftKey, data) {
    return withStore('drafts', 'readwrite', (store) => {
        store.put({ draftKey, data, updatedAt: new Date().toISOString() });
    });
}

export async function getLocalDraft(draftKey) {
    return withStore('drafts', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
            const req = store.get(draftKey);
            req.onsuccess = () => resolve(req.result?.data || null);
            req.onerror = () => reject(req.error);
        });
    });
}

export async function deleteLocalDraft(draftKey) {
    return withStore('drafts', 'readwrite', (store) => {
        store.delete(draftKey);
    });
}

// ─── DEVICE IDENTITY ───

export async function getEnrolledDevice() {
    return withStore('device', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
            const req = store.get('current');
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    });
}

export async function setEnrolledDevice(deviceData) {
    return withStore('device', 'readwrite', (store) => {
        store.put({ key: 'current', ...deviceData, updatedAt: new Date().toISOString() });
    });
}

// ─── OFFLINE HELP PACK OPERATIONS ───

export async function saveOfflineHelpPack(pack, { labId = null, locale = null } = {}) {
    if (!pack || !Array.isArray(pack.articles)) return;

    const packLocale = locale || pack.locale || 'en';
    const packLabId = labId || pack.labId || 'global';
    const scopeKey = `${packLabId}::${packLocale}`;
    const newArticleIds = new Set(pack.articles.map(a => a.id));

    await withStore('helpArticles', 'readwrite', (store) => {
        // 1. Fetch existing to reconcile withdrawals for this scope
        const req = store.getAll();
        req.onsuccess = () => {
            const allItems = req.result || [];
            allItems.forEach(item => {
                if (item.scopeKey === scopeKey && !newArticleIds.has(item.articleId || item.id)) {
                    // Reconcile withdrawal: delete removed/withdrawn article
                    store.delete(item.id);
                }
            });

            // 2. Put incoming articles with scoped identifiers
            pack.articles.forEach(article => {
                const scopedId = `${scopeKey}::${article.id}`;
                const record = {
                    ...article,
                    id: scopedId,
                    articleId: article.id,
                    scopeKey,
                    labId: packLabId,
                    locale: packLocale,
                    cachedAt: new Date().toISOString()
                };
                store.put(record);

                // Also maintain legacy direct id lookup for active session
                store.put({
                    ...article,
                    id: article.id,
                    articleId: article.id,
                    scopeKey,
                    labId: packLabId,
                    locale: packLocale,
                    cachedAt: new Date().toISOString()
                });
            });
        };
    });

    await withStore('helpMeta', 'readwrite', (store) => {
        const metaPayload = {
            lastSync: new Date().toISOString(),
            locale: packLocale,
            labId: packLabId,
            packVersion: pack.packVersion || 1,
            categories: pack.categories || [],
            routeMap: pack.routeMap || {}
        };

        store.put({ key: `meta::${scopeKey}`, value: metaPayload });
        store.put({ key: 'current', value: metaPayload });
        store.put({ key: 'lastSync', value: metaPayload.lastSync });
        store.put({ key: 'locale', value: packLocale });
        store.put({ key: 'categories', value: pack.categories || [] });
        store.put({ key: 'routeMap', value: pack.routeMap || {} });
    });
}

export async function getOfflineHelpArticles({ category = null, labId = null, locale = 'en' } = {}) {
    return withStore('helpArticles', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => {
                const list = req.result || [];
                const targetScope = `${labId || 'global'}::${locale}`;
                const globalScope = `global::${locale}`;

                // Filter by scope (specific lab/locale -> global/locale -> all unique by articleId)
                let scoped = list.filter(a => a.scopeKey === targetScope);
                if (scoped.length === 0) {
                    scoped = list.filter(a => a.scopeKey === globalScope);
                }
                if (scoped.length === 0) {
                    scoped = list.filter(a => !a.id.includes('::'));
                }

                // Deduplicate by articleId
                const seen = new Set();
                const deduped = [];
                for (const art of scoped) {
                    const artId = art.articleId || art.id;
                    if (!seen.has(artId)) {
                        seen.add(artId);
                        deduped.push({
                            ...art,
                            id: artId
                        });
                    }
                }

                if (category && category !== 'all') {
                    resolve(deduped.filter(a => a.category === category));
                } else {
                    resolve(deduped);
                }
            };
            req.onerror = () => reject(req.error);
        });
    });
}

export async function getOfflineHelpArticle(id, { labId = null, locale = 'en' } = {}) {
    return withStore('helpArticles', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
            const scopedKey = `${labId || 'global'}::${locale}::${id}`;
            const globalKey = `global::${locale}::${id}`;

            const tryScoped = store.get(scopedKey);
            tryScoped.onsuccess = () => {
                if (tryScoped.result) {
                    return resolve({ ...tryScoped.result, id });
                }
                // Try global key
                const tryGlobal = store.get(globalKey);
                tryGlobal.onsuccess = () => {
                    if (tryGlobal.result) {
                        return resolve({ ...tryGlobal.result, id });
                    }
                    // Fall back to direct ID lookup
                    const tryDirect = store.get(id);
                    tryDirect.onsuccess = () => {
                        resolve(tryDirect.result ? { ...tryDirect.result, id } : null);
                    };
                    tryDirect.onerror = () => reject(tryDirect.error);
                };
                tryGlobal.onerror = () => reject(tryGlobal.error);
            };
            tryScoped.onerror = () => reject(tryScoped.error);
        });
    });
}

export async function getOfflineHelpMeta({ labId = null, locale = 'en' } = {}) {
    return withStore('helpMeta', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
            const scopedKey = `meta::${labId || 'global'}::${locale}`;
            const reqScoped = store.get(scopedKey);
            reqScoped.onsuccess = () => {
                if (reqScoped.result && reqScoped.result.value) {
                    return resolve(reqScoped.result.value);
                }
                // Try current
                const reqCurrent = store.get('current');
                reqCurrent.onsuccess = () => {
                    if (reqCurrent.result && reqCurrent.result.value) {
                        return resolve(reqCurrent.result.value);
                    }
                    // Fall back to legacy flat map
                    const reqAll = store.getAll();
                    reqAll.onsuccess = () => {
                        const map = {};
                        (reqAll.result || []).forEach(item => {
                            map[item.key] = item.value;
                        });
                        resolve(map);
                    };
                    reqAll.onerror = () => reject(reqAll.error);
                };
                reqCurrent.onerror = () => reject(reqCurrent.error);
            };
            reqScoped.onerror = () => reject(reqScoped.error);
        });
    });
}
