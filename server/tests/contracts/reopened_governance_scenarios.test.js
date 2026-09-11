'use strict';

/**
 * Reopened Governance & Parity Scenarios Contract Tests
 *
 * Verifies:
 * 1. Offline Sync Draft Parity (workEligibility.canRecord gating, DRYING_PENDING -> PREREQUISITE_INCOMPLETE, status advancement)
 * 2. Offline Sync Spectral & Texture Determinations (SPECTRAL_SCALAR_REJECTED for custom methods, TEXTURE_CLOSURE_FAILED vs atomic multi-fraction persistence)
 * 3. Offline Shared-Device Outbox User Partitioning (userId scoping, no cross-account execution)
 * 4. Offline Pack Lease & Scope Enforcement (410 PACK_EXPIRED, 403 PACK_ACCESS_DENIED, 401 SESSION_INVALIDATED)
 * 5. Work Item Assignment Scoping & Receiving Lab Broadcasts (assignmentEligibilityService validation, receiving lab broadcast)
 */

const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/auth');
const syncService = require('../../services/syncService');
const offlineController = require('../../controllers/offlineController');
const wsServer = require('../../wsServer');

describe('Reopened Governance & Offline Parity Contract Tests', () => {
    const SUFFIX = 'REOPEN-' + Date.now();
    let labA, labB, userTechA, userTechB, userMgrA, userSA;
    let tokenTechA, tokenTechB, tokenMgrA, tokenSA;
    let sampleA, samplePendingDrying;
    let workItemTexture, workItemSpectral, workItemNormal, workItemDryingBlocked;
    let customSpectralMethod;

    beforeAll(async () => {
        // Ensure analysis records exist for foreign key constraints
        const ensureAnalysis = async (code, name) => {
            await prisma.analysis.upsert({
                where: { code },
                create: { code, name, matrix: 'SOIL', module: 'FERTILITY' },
                update: {}
            });
        };

        await ensureAnalysis('SPEC_MIR', 'Mid-Infrared Spectroscopy');
        await ensureAnalysis('TEXTURE', 'Soil Texture');
        await ensureAnalysis('SAND', 'Sand Fraction');
        await ensureAnalysis('SILT', 'Silt Fraction');
        await ensureAnalysis('CLAY', 'Clay Fraction');
        await ensureAnalysis('PH_H2O', 'pH in Water');

        // Setup Labs
        labA = await prisma.lab.create({
            data: {
                id: 'lab-a-' + SUFFIX,
                code: 'LA-' + SUFFIX.slice(-4),
                name: 'Lab Alpha ' + SUFFIX,
                country: 'Guatemala',
                isActive: true
            }
        });

        labB = await prisma.lab.create({
            data: {
                id: 'lab-b-' + SUFFIX,
                code: 'LB-' + SUFFIX.slice(-4),
                name: 'Lab Beta ' + SUFFIX,
                country: 'Guatemala',
                isActive: true
            }
        });

        // Setup Users
        userSA = await prisma.user.create({
            data: {
                id: 'usr-sa-' + SUFFIX,
                username: 'sa_' + SUFFIX,
                email: 'sa_' + SUFFIX + '@soilfer.org',
                password: 'hash',
                role: 'SUPER_ADMIN',
                isActive: true,
                tokenVersion: 1
            }
        });

        userMgrA = await prisma.user.create({
            data: {
                id: 'usr-mgrA-' + SUFFIX,
                username: 'mgrA_' + SUFFIX,
                email: 'mgrA_' + SUFFIX + '@soilfer.org',
                password: 'hash',
                role: 'LAB_MANAGER',
                labId: labA.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        userTechA = await prisma.user.create({
            data: {
                id: 'usr-techA-' + SUFFIX,
                username: 'techA_' + SUFFIX,
                email: 'techA_' + SUFFIX + '@soilfer.org',
                password: 'hash',
                role: 'LAB_TECHNICIAN',
                labId: labA.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        userTechB = await prisma.user.create({
            data: {
                id: 'usr-techB-' + SUFFIX,
                username: 'techB_' + SUFFIX,
                email: 'techB_' + SUFFIX + '@soilfer.org',
                password: 'hash',
                role: 'LAB_TECHNICIAN',
                labId: labB.id,
                isActive: true,
                tokenVersion: 1
            }
        });

        tokenSA = jwt.sign({ id: userSA.id, username: userSA.username, role: userSA.role, tokenVersion: 1 }, JWT_SECRET);
        tokenMgrA = jwt.sign({ id: userMgrA.id, username: userMgrA.username, role: userMgrA.role, labId: labA.id, tokenVersion: 1 }, JWT_SECRET);
        tokenTechA = jwt.sign({ id: userTechA.id, username: userTechA.username, role: userTechA.role, labId: labA.id, tokenVersion: 1 }, JWT_SECRET);
        tokenTechB = jwt.sign({ id: userTechB.id, username: userTechB.username, role: userTechB.role, labId: labB.id, tokenVersion: 1 }, JWT_SECRET);

        // Custom spectral methodology
        customSpectralMethod = await prisma.methodology.create({
            data: {
                id: 'meth-spec-' + SUFFIX,
                analysisCode: 'SPEC_MIR',
                name: 'Custom MIR Spectroscopy ' + SUFFIX,
                standard: 'MIR Spectroscopy Standard'
            }
        });

        // Setup Samples
        sampleA = await prisma.sample.create({
            data: {
                id: 'smp-a-' + SUFFIX,
                originalId: 'orig-a-' + SUFFIX,
                status: 'PROCESSING',
                dryingStatus: 'DONE',
                preparationStatus: 'DONE',
                receptionDate: new Date(),
                assignedLab: labA.id,
                labId: labA.id,
                country: 'Guatemala'
            }
        });

        samplePendingDrying = await prisma.sample.create({
            data: {
                id: 'smp-dry-' + SUFFIX,
                originalId: 'orig-dry-' + SUFFIX,
                status: 'RECEIVED',
                dryingStatus: 'PENDING',
                preparationStatus: 'PENDING',
                receptionDate: new Date(),
                assignedLab: labA.id,
                labId: labA.id,
                country: 'Guatemala'
            }
        });

        // Setup Work Items
        workItemDryingBlocked = await prisma.workItem.create({
            data: {
                id: 'wi-dry-' + SUFFIX,
                sampleId: samplePendingDrying.id,
                analysis: 'PH_H2O',
                status: 'ASSIGNED',
                assignedTo: userTechA.username,
                assignedLab: labA.id,
                labId: labA.id,
                version: 1
            }
        });

        workItemNormal = await prisma.workItem.create({
            data: {
                id: 'wi-norm-' + SUFFIX,
                sampleId: sampleA.id,
                analysis: 'PH_H2O',
                status: 'ASSIGNED',
                assignedTo: userTechA.username,
                assignedLab: labA.id,
                labId: labA.id,
                version: 1
            }
        });

        workItemSpectral = await prisma.workItem.create({
            data: {
                id: 'wi-spec-' + SUFFIX,
                sampleId: sampleA.id,
                analysis: 'SPEC_MIR',
                methodologyId: customSpectralMethod.id,
                category: 'Spectroscopy',
                status: 'IN_PROGRESS',
                assignedTo: userTechA.username,
                assignedLab: labA.id,
                labId: labA.id,
                version: 1
            }
        });

        workItemTexture = await prisma.workItem.create({
            data: {
                id: 'wi-text-' + SUFFIX,
                sampleId: sampleA.id,
                analysis: 'TEXTURE',
                status: 'IN_PROGRESS',
                assignedTo: userTechA.username,
                assignedLab: labA.id,
                labId: labA.id,
                version: 1
            }
        });
    });

    afterAll(async () => {
        await prisma.result.deleteMany({ where: { sampleId: { in: [sampleA.id, samplePendingDrying.id] } } }).catch(() => {});
        await prisma.workAttempt.deleteMany({ where: { workItemId: { in: [workItemTexture.id, workItemSpectral.id, workItemNormal.id, workItemDryingBlocked.id] } } }).catch(() => {});
        await prisma.workItemDraft.deleteMany({ where: { workItemId: { in: [workItemTexture.id, workItemSpectral.id, workItemNormal.id, workItemDryingBlocked.id] } } }).catch(() => {});
        await prisma.commandReceipt.deleteMany({ where: { author: { in: [userTechA.username, userTechB.username] } } }).catch(() => {});
        await prisma.workItem.deleteMany({ where: { id: { in: [workItemTexture.id, workItemSpectral.id, workItemNormal.id, workItemDryingBlocked.id] } } }).catch(() => {});
        await prisma.sample.deleteMany({ where: { id: { in: [sampleA.id, samplePendingDrying.id] } } }).catch(() => {});
        await prisma.methodology.deleteMany({ where: { id: customSpectralMethod.id } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: { in: [userTechA.id, userTechB.id, userMgrA.id, userSA.id] } } }).catch(() => {});
        await prisma.lab.deleteMany({ where: { id: { in: [labA.id, labB.id] } } }).catch(() => {});
    });

    describe('1. Offline Sync Draft Parity & Gating', () => {
        test('SAVE_WORK_DRAFT rejects prerequisite-blocked sample with PREREQUISITE_INCOMPLETE', async () => {
            const result = await syncService.applySyncOperations(userTechA, [{
                operationId: 'op-draft-block-' + Date.now(),
                type: 'SAVE_WORK_DRAFT',
                target: workItemDryingBlocked.id,
                payload: { value: '6.5' }
            }]);

            expect(result.receipts).toHaveLength(1);
            expect(result.receipts[0].status).toBe('REJECTED');
            expect(result.receipts[0].code).toBe('PREREQUISITE_INCOMPLETE');
        });

        test('SAVE_WORK_DRAFT rejects unassigned technician with NOT_ASSIGNED_TECHNICIAN', async () => {
            const result = await syncService.applySyncOperations(userTechB, [{ // Tech B from Lab B
                operationId: 'op-draft-unassigned-' + Date.now(),
                type: 'SAVE_WORK_DRAFT',
                target: workItemNormal.id,
                payload: { value: '6.8' }
            }]);

            expect(result.receipts).toHaveLength(1);
            expect(result.receipts[0].status).toBe('REJECTED');
            expect(['NOT_ASSIGNED_TECHNICIAN', 'WORK_ITEM_OUTSIDE_LAB_SCOPE']).toContain(result.receipts[0].code);
        });

        test('Valid SAVE_WORK_DRAFT persists atomically and advances status from ASSIGNED to IN_PROGRESS', async () => {
            const opId = 'op-draft-valid-' + Date.now();
            const result = await syncService.applySyncOperations(userTechA, [{
                operationId: opId,
                type: 'SAVE_WORK_DRAFT',
                target: workItemNormal.id,
                payload: { value: '7.1', notes: 'Preliminary draft reading' }
            }]);

            expect(result.receipts).toHaveLength(1);
            expect(['APPLIED', 'SUCCESS']).toContain(result.receipts[0].status);

            // Verify work item advanced to IN_PROGRESS
            const updatedItem = await prisma.workItem.findUnique({ where: { id: workItemNormal.id } });
            expect(updatedItem.status).toBe('IN_PROGRESS');
        });
    });

    describe('2. Offline Sync Spectral & Texture Determinations', () => {
        test('COMPLETE_WORK on custom spectral method rejects scalar entry with SPECTRAL_SCALAR_REJECTED', async () => {
            const result = await syncService.applySyncOperations(userTechA, [{
                operationId: 'op-spec-scalar-' + Date.now(),
                type: 'COMPLETE_WORK',
                target: workItemSpectral.id,
                payload: { result: '1250.5' } // Scalar instead of spectral scan
            }]);

            expect(result.receipts).toHaveLength(1);
            expect(result.receipts[0].status).toBe('REJECTED');
            expect(result.receipts[0].code).toBe('SPECTRAL_SCALAR_REJECTED');
        });

        test('COMPLETE_WORK on grouped texture rejects non-closing sum with TEXTURE_CLOSURE_FAILED', async () => {
            const result = await syncService.applySyncOperations(userTechA, [{
                operationId: 'op-text-fail-' + Date.now(),
                type: 'COMPLETE_WORK',
                target: workItemTexture.id,
                payload: {
                    sand: 50,
                    silt: 20,
                    clay: 20 // Sum is 90%, outside tolerance
                }
            }]);

            expect(result.receipts).toHaveLength(1);
            expect(result.receipts[0].status).toBe('REJECTED');
            expect(result.receipts[0].code).toBe('TEXTURE_CLOSURE_FAILED');
        });

        test('COMPLETE_WORK on grouped texture with valid closure atomically writes SAND, SILT, CLAY, and TEXTURE results', async () => {
            const opId = 'op-text-success-' + Date.now();
            const result = await syncService.applySyncOperations(userTechA, [{
                operationId: opId,
                type: 'COMPLETE_WORK',
                target: workItemTexture.id,
                payload: {
                    sand: 40,
                    silt: 40,
                    clay: 20 // Sum is 100%
                }
            }]);

            expect(result.receipts).toHaveLength(1);
            expect(['APPLIED', 'SUCCESS']).toContain(result.receipts[0].status);

            // Verify 4 Result records were created for the sample
            const createdResults = await prisma.result.findMany({
                where: { sampleId: sampleA.id, isCurrent: true }
            });
            const params = createdResults.map(r => r.param);
            expect(params).toContain('SAND');
            expect(params).toContain('SILT');
            expect(params).toContain('CLAY');
            expect(params).toContain('TEXTURE');

            // Verify WorkAttempt was created
            const attempt = await prisma.workAttempt.findFirst({
                where: { workItemId: workItemTexture.id }
            });
            expect(attempt).not.toBeNull();
            expect(attempt.author || attempt.technician).toBe(userTechA.username);
        });
    });

    describe('3. Offline Shared-Device Outbox User Partitioning & Identity Fail-Closed (IR-08)', () => {
        const { pathToFileURL } = require('url');
        const path = require('path');

        class MemoryIDBStore {
            constructor(keyPath) {
                this.keyPath = keyPath;
                this.items = new Map();
            }
            get(key) {
                const req = { onsuccess: null, onerror: null, result: this.items.get(key) || null };
                queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
                return req;
            }
            getAll() {
                const req = { onsuccess: null, onerror: null, result: Array.from(this.items.values()) };
                queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
                return req;
            }
            put(val) {
                const key = val[this.keyPath] || ('gen_' + Math.random().toString(36).substring(2));
                this.items.set(key, JSON.parse(JSON.stringify(val)));
                const req = { onsuccess: null, onerror: null, result: key };
                queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
                return req;
            }
            delete(key) {
                this.items.delete(key);
                const req = { onsuccess: null, onerror: null, result: undefined };
                queueMicrotask(() => req.onsuccess && req.onsuccess({ target: req }));
                return req;
            }
            createIndex() {}
        }

        class MemoryIDBDatabase {
            constructor() {
                this.stores = new Map();
                this.objectStoreNames = {
                    contains: (name) => this.stores.has(name)
                };
            }
            createObjectStore(name, { keyPath }) {
                const store = new MemoryIDBStore(keyPath);
                this.stores.set(name, store);
                return store;
            }
            transaction(storeName) {
                const store = this.stores.get(storeName);
                const tx = {
                    objectStore: () => store,
                    oncomplete: null,
                    onerror: null
                };
                queueMicrotask(() => tx.oncomplete && tx.oncomplete());
                return tx;
            }
        }

        const fs = require('fs');
        const vm = require('vm');

        function loadModuleInContext(filePath, ctx, moduleMocks = {}) {
            let code = fs.readFileSync(filePath, 'utf8');
            code = code.replace(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"];?/g, (match, names) => {
                const importedNames = names.split(',').map(s => s.trim()).filter(Boolean);
                return importedNames.map(name => `const ${name} = __mocks__.${name};`).join('\n');
            });
            code = code.replace(/export\s+async\s+function\s+([a-zA-Z0-9_$]+)/g, 'exports.$1 = $1; async function $1');
            code = code.replace(/export\s+function\s+([a-zA-Z0-9_$]+)/g, 'exports.$1 = $1; function $1');
            code = code.replace(/export\s+const\s+([a-zA-Z0-9_$]+)\s*=/g, 'const $1 = exports.$1 =');

            const exportsObj = {};
            const fullContext = {
                ...ctx,
                exports: exportsObj,
                module: { exports: exportsObj },
                __mocks__: moduleMocks
            };

            vm.runInNewContext(code, fullContext);
            return fullContext.exports;
        }

        let offlineDb;
        let syncEngine;
        let memoryDb;
        let storageMap;
        let originalFetch;
        let originalLocalStorage;

        beforeAll(() => {
            originalFetch = global.fetch;
            originalLocalStorage = global.localStorage;

            memoryDb = new MemoryIDBDatabase();
            storageMap = new Map();

            const mockLocalStorage = {
                getItem: (k) => storageMap.get(k) || null,
                setItem: (k, v) => storageMap.set(k, String(v)),
                removeItem: (k) => storageMap.delete(k),
                clear: () => storageMap.clear()
            };
            global.localStorage = mockLocalStorage;

            const context = {
                window: {
                    indexedDB: {
                        open: () => {
                            const req = { onsuccess: null, onerror: null, onupgradeneeded: null };
                            queueMicrotask(() => {
                                if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: memoryDb } });
                                if (req.onsuccess) req.onsuccess({ target: { result: memoryDb } });
                            });
                            return req;
                        }
                    }
                },
                navigator: { onLine: true, userAgent: 'NodeTest/1.0' },
                localStorage: mockLocalStorage,
                fetch: (url, opts) => global.fetch(url, opts),
                console,
                Date,
                JSON,
                Math,
                Promise,
                Array,
                String,
                Set,
                Map,
                queueMicrotask
            };

            const offlineDbPath = path.resolve(__dirname, '../../../client/src/services/offline/offlineDb.js');
            const syncEnginePath = path.resolve(__dirname, '../../../client/src/services/offline/syncEngine.js');

            offlineDb = loadModuleInContext(offlineDbPath, context);
            syncEngine = loadModuleInContext(syncEnginePath, context, {
                ...offlineDb,
                ensureDeviceId: async () => 'test-device-id'
            });
        });

        afterAll(() => {
            global.fetch = originalFetch;
            global.localStorage = originalLocalStorage;
        });

        beforeEach(() => {
            storageMap.clear();
            if (syncEngine._resetSyncingState) syncEngine._resetSyncingState();
        });

        test('getPendingOutboxOperations strictly fails closed with [] when identity is null, undefined, empty, or non-string', async () => {
            expect(await offlineDb.getPendingOutboxOperations(null)).toEqual([]);
            expect(await offlineDb.getPendingOutboxOperations(undefined)).toEqual([]);
            expect(await offlineDb.getPendingOutboxOperations('')).toEqual([]);
            expect(await offlineDb.getPendingOutboxOperations('   ')).toEqual([]);
            expect(await offlineDb.getPendingOutboxOperations(12345)).toEqual([]);
            expect(await offlineDb.getPendingOutboxOperations({})).toEqual([]);
        });

        test('triggerSync fails closed with AUTH_REQUIRED / MISSING_USER_IDENTITY when user identity is absent', async () => {
            // Storage has no user
            const result = await syncEngine.triggerSync();
            expect(result.status).toBe('AUTH_REQUIRED');
            expect(result.code).toBe('MISSING_USER_IDENTITY');
            expect(result.count).toBe(0);
        });

        test('triggerSync fails closed when authToken is passed without valid user context', async () => {
            const result = await syncEngine.triggerSync('jwt-without-context');
            expect(result.status).toBe('AUTH_REQUIRED');
            expect(result.code).toBe('MISSING_USER_IDENTITY');
            expect(result.count).toBe(0);
        });

        test('Simulated shared device: User A logout -> User B login dispatches only User B ops and preserves User A & ownerless ops intact', async () => {
            // 1. User A logs in and records domain work into outbox
            localStorage.setItem('user', JSON.stringify({ id: userTechA.username, username: userTechA.username }));
            const opA = await syncEngine.recordSyncOperation({
                type: 'SAVE_WORK_DRAFT',
                target: workItemNormal.id,
                payload: { notes: 'Tech A draft' }
            });
            expect(opA.userId).toBe(userTechA.username);

            // 2. Add a legacy ownerless operation (null userId) directly to outbox store
            await offlineDb.queueOutboxOperation({
                operationId: 'op-legacy-ownerless-' + Date.now(),
                userId: null,
                type: 'SAVE_WORK_DRAFT',
                target: workItemNormal.id,
                payload: { notes: 'Legacy operation with null userId' },
                status: 'PENDING',
                capturedAtLocal: new Date().toISOString()
            });

            // 3. User A logs out (localStorage cleared)
            localStorage.clear();

            // 4. User B logs into shared device
            localStorage.setItem('user', JSON.stringify({ id: userTechB.username, username: userTechB.username }));
            localStorage.setItem('token', tokenMgrA); // any valid test token

            // User B pending query returns 0 before User B performs work
            const initialBPending = await offlineDb.getPendingOutboxOperations(userTechB.username);
            expect(initialBPending).toHaveLength(0);

            // User B records an operation
            const opB = await syncEngine.recordSyncOperation({
                type: 'COMPLETE_WORK',
                target: workItemNormal.id,
                payload: { result: 'Tech B work' }
            });
            expect(opB.userId).toBe(userTechB.username);

            // Verify User B pending query returns ONLY User B's operation
            const bPending = await offlineDb.getPendingOutboxOperations(userTechB.username);
            expect(bPending).toHaveLength(1);
            expect(bPending[0].operationId).toBe(opB.operationId);

            // 5. User B triggers sync
            let dispatchedOps = null;
            global.fetch = jest.fn().mockImplementation(async (url, opts) => {
                const body = JSON.parse(opts.body);
                dispatchedOps = body.operations;
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        receipts: dispatchedOps.map(o => ({ operationId: o.operationId, status: 'APPLIED' }))
                    })
                };
            });

            if (syncEngine._resetSyncingState) syncEngine._resetSyncingState();
            const syncResult = await syncEngine.triggerSync();
            expect(syncResult.status).toBe('COMPLETED');
            expect(syncResult.applied).toBe(1);

            // Verify network dispatch ONLY sent User B's operations
            expect(dispatchedOps).toHaveLength(1);
            expect(dispatchedOps[0].userId).toBe(userTechB.username);

            // 6. Verify User A's un-synced work and legacy ownerless work remain safely preserved in outbox
            const allRemaining = await offlineDb.getAllOutboxOperations();
            const userAInStore = allRemaining.find(o => o.operationId === opA.operationId);
            const ownerlessInStore = allRemaining.find(o => o.userId === null);

            expect(userAInStore).toBeDefined();
            expect(userAInStore.userId).toBe(userTechA.username);
            expect(userAInStore.status).toBe('PENDING');

            expect(ownerlessInStore).toBeDefined();
            expect(ownerlessInStore.userId).toBeNull();
            expect(ownerlessInStore.status).toBe('PENDING');
        });

        test('Mid-sync account switch is detected and safely aborted without cross-account attribution', async () => {
            // User A queues work
            localStorage.setItem('user', JSON.stringify({ id: userTechA.username, username: userTechA.username }));
            localStorage.setItem('token', tokenMgrA);

            const opA = await syncEngine.recordSyncOperation({
                type: 'SAVE_WORK_DRAFT',
                target: workItemNormal.id,
                payload: { notes: 'Tech A in-flight operation' }
            });

            // Simulate account switch during in-flight network call
            global.fetch = jest.fn().mockImplementation(async () => {
                // User switches to User B while fetch is in-flight!
                localStorage.setItem('user', JSON.stringify({ id: userTechB.username, username: userTechB.username }));
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        receipts: [{ operationId: opA.operationId, status: 'APPLIED' }]
                    })
                };
            });

            const syncResult = await syncEngine.triggerSync(tokenMgrA, { id: userTechA.username });
            expect(syncResult.status).toBe('ABORTED');
            expect(syncResult.code).toBe('ACCOUNT_SWITCH_DETECTED');

            // User A's operation must be reverted to PENDING and NOT deleted
            const userAOps = await offlineDb.getPendingOutboxOperations(userTechA.username);
            const opInStore = userAOps.find(o => o.operationId === opA.operationId);
            expect(opInStore).toBeDefined();
            expect(opInStore.status).toBe('PENDING');
        });
    });

    describe('4. Offline Pack Lease & Scope Enforcement', () => {
        test('getPack returns 410 PACK_EXPIRED when pack lease is expired', async () => {
            const req = {
                params: { id: 'pack-expired-1' },
                user: userTechA
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const bundle = await offlineController.preparePack({
                user: userTechA,
                body: { packType: 'SAMPLE', targetIds: [sampleA.id] }
            }, { json: (b) => b });

            bundle.expiresAt = new Date(Date.now() - 1000).toISOString();

            req.params.id = bundle.packId;
            await offlineController.getPack(req, res);

            expect(res.status).toHaveBeenCalledWith(410);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PACK_EXPIRED' }));
        });

        test('getPack returns 403 PACK_ACCESS_DENIED when requested across laboratories', async () => {
            const bundle = await offlineController.preparePack({
                user: userTechA,
                body: { packType: 'SAMPLE', targetIds: [sampleA.id] }
            }, { json: (b) => b });

            const req = {
                params: { id: bundle.packId },
                user: userTechB
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await offlineController.getPack(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PACK_ACCESS_DENIED' }));
        });

        test('getPack returns 401 SESSION_INVALIDATED when user tokenVersion changed', async () => {
            const bundle = await offlineController.preparePack({
                user: { ...userTechA, tokenVersion: 1 },
                body: { packType: 'SAMPLE', targetIds: [sampleA.id] }
            }, { json: (b) => b });

            const req = {
                params: { id: bundle.packId },
                user: { ...userTechA, tokenVersion: 2 }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await offlineController.getPack(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SESSION_INVALIDATED' }));
        });
    });

    describe('5. Work Item Assignment Scoping & Receiving Lab Broadcast', () => {
        let broadcastSpy;

        beforeEach(() => {
            broadcastSpy = jest.spyOn(wsServer, 'broadcastToLab').mockImplementation(() => {});
        });

        afterEach(() => {
            if (broadcastSpy) broadcastSpy.mockRestore();
        });

        test('assignWork via assignmentEligibilityService blocks cross-lab assignment', async () => {
            const res = await request(app)
                .post('/api/work/assign')
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    workItemIds: [workItemNormal.id],
                    assignee: userTechB.username // Tech B belongs to Lab B
                });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('CROSS_LAB_ASSIGNMENT_DENIED');
        });

        test('assignWork broadcasts WORKITEM_UPDATE to target receiving laboratory', async () => {
            const res = await request(app)
                .post('/api/work/assign')
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    workItemIds: [workItemNormal.id],
                    assignee: userTechA.username
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            expect(broadcastSpy).toHaveBeenCalledWith(
                labA.id,
                'WORKITEM_UPDATE',
                expect.objectContaining({ action: 'ASSIGNED' })
            );
        });

        test('reassignWork broadcasts WORKITEM_UPDATE to receiving laboratory', async () => {
            const res = await request(app)
                .post(`/api/work/${workItemNormal.id}/reassign`)
                .set('Authorization', `Bearer ${tokenMgrA}`)
                .send({
                    technicianUserId: userTechA.username,
                    reason: 'Work reassignment to confirmed lead analyst'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            expect(broadcastSpy).toHaveBeenCalledWith(
                labA.id,
                'WORKITEM_UPDATE',
                expect.objectContaining({ action: 'REASSIGNED' })
            );
        });
    });
});
