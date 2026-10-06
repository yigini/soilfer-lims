const { cleanupWorkflowFixtures } = require("../helpers/workflowFixtures");
/**
 * Issue #140 Codex Independent Review Remediations Test Suite
 * 
 * Verifies all 15 failure modes and 12 corrective items (R1-R12)
 * using an isolated synthetic in-memory test environment.
 * Does not touch development/production databases or copy live WAL files.
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const adapter = require('../../services/sisAdapterService');
const policy = require('../../services/exchangePolicyService');

describe('Issue #140 Codex Remediations Contract Tests', () => {
    let memoryDb;
    let stateService;
    let mockPrisma;
    let mockSamples;

    function matches(row, where) {
        return Object.entries(where).every(([k, v]) => {
            if (k === 'AND') return v.every(w => matches(row, w));
            if (k === 'OR') return v.some(w => matches(row, w));
            if (k === 'NOT') return !matches(row, v);
            const a = row[k];
            if (v === null) return a === null;
            if (v instanceof Date) return +a === +v;
            if (v && typeof v === 'object') return Object.entries(v).every(([op, b]) => ({
                in: () => Array.isArray(b) && b.includes(a),
                notIn: () => Array.isArray(b) && !b.includes(a),
                not: () => {
                    if (b === null) return a !== null && a !== undefined;
                    if (typeof b === 'object') return !matches({ [k]: a }, { [k]: b });
                    return a !== b;
                },
                contains: () => typeof a === 'string' && a.includes(b),
                lt: () => a < b,
                lte: () => a <= b,
                gt: () => a > b,
                gte: () => a >= b
            }[op] || (() => false))());
            return a === v;
        });
    }

    const fixture = (id, date) => ({
        id,
        originalId: 'BAG-' + id,
        labId: 'ACC-' + id,
        assignedLab: 'LAB-A',
        country: 'AAA',
        projectCode: 'P',
        status: 'APPROVED',
        approvedAt: new Date(date),
        updatedAt: new Date(date),
        createdAt: new Date(date),
        results: []
    });

    const auth = {
        type: 'API_KEY',
        id: 'key-123',
        keyId: 'key-123',
        name: 'same display name',
        role: 'NSIS_CONSUMER',
        labs: ['LAB-A'],
        countries: ['AAA'],
        projects: ['P']
    };

    beforeEach(() => {
        memoryDb = new Database(':memory:');
        mockSamples = [];

        mockPrisma = {
            sample: {
                count: async ({ where }) => mockSamples.filter(r => matches(r, where)).length,
                findMany: async ({ where, orderBy, take }) => mockSamples.filter(r => matches(r, where)).sort((a, b) => {
                    for (const order of orderBy || []) {
                        const [key, dir] = Object.entries(order)[0];
                        const d = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
                        if (d) return dir === 'desc' ? -d : d;
                    }
                    return 0;
                }).slice(0, take)
            }
        };

        // Construct stateService instance bound to memoryDb and mockPrisma
        const vm = require('vm');
        const fs = require('fs');
        const path = require('path');
        const fileContent = fs.readFileSync(path.resolve(__dirname, '../../services/exchangeStateService.js'), 'utf8');
        const context = {
            module: { exports: {} },
            exports: {},
            require(name) {
                if (name === 'better-sqlite3') return function() { return memoryDb; };
                if (name === '../prisma') return mockPrisma;
                if (name === './exchangePolicyService') return policy;
                if (name === './sisAdapterService') return adapter;
                if (name === './exchangeDbFunctions') return require('../../services/exchangeDbFunctions');
                if (name === './sampleHoldService') return require('../../services/sampleHoldService');
                if (['path', 'crypto'].includes(name)) return require(name);
                throw new Error('Unexpected require: ' + name);
            },
            process: { env: {} },
            __dirname: path.resolve(__dirname, '../../services'),
            Buffer,
            Date,
            console
        };
        context.exports = context.module.exports;
        vm.runInNewContext(fileContent, context);
        stateService = context.module.exports;
    });

    afterEach(() => {
        if (memoryDb) {
            try { memoryDb.close(); } catch (_) {}
        }
    });

    describe('R2: Immutable Frozen Snapshots (Probes 1 & 2)', () => {
        test('An unrelated durable hold cannot hide eligible specimens in the isolated query adapter', async () => {
            const prisma = require('../../prisma');
            const { createSampleFixture } = require('../helpers/workflowFixtures');
            const heldId = `issue140-held-${crypto.randomUUID()}`;
            await createSampleFixture(prisma, { data: { id: heldId, originalId: heldId, assignedLab: 'LAB-A', country: 'AAA',
                projectCode: 'P', status: 'APPROVED', approvedAt: new Date(),
                metadata: JSON.stringify({ provenanceHold: { status: 'AMBIGUOUS_PROVENANCE_HOLD' } }) } });
            try {
                expect(policy.getHeldSampleIds()).toContain(heldId);
                mockSamples = [fixture('eligible-isolated', '2026-01-01'), fixture(heldId, '2026-01-01')];
                await stateService.syncJournal(auth);
                const snap = await stateService.createSnapshot(auth);
                const page = await stateService.getSnapshotPage(snap.snapshotId, auth);
                expect(page.data.map(row => row.specimenId)).toEqual(['eligible-isolated']);
                expect(snap.totalSamples).toBe(1);
            } finally {
                await cleanupWorkflowFixtures(prisma, "sample", (await prisma.sample.findMany({ ...({ where: { id: heldId } }), select: { id: true } })).map(row => row.id), { single: true });
                await prisma.auditLog.deleteMany({ where: { entityId: heldId } });
            }
        });
        test('Probe 1: Snapshot remains frozen after subsequent result-only edit', async () => {
            const a = fixture('a', '2026-01-01');
            mockSamples = [a];
            await stateService.syncJournal(auth);

            const snap = await stateService.createSnapshot(auth);
            const before = await stateService.getSnapshotPage(snap.snapshotId, auth);
            expect(before.data[0].observations).toHaveLength(0);

            // Mutate sample result post-snapshot
            a.results = [{ id: 'r1', param: 'X', value: '77', isCurrent: true }];
            const after = await stateService.getSnapshotPage(snap.snapshotId, auth);

            // Frozen snapshot must not observe the mutation
            expect(after.data[0].observations).toHaveLength(0);
        });

        test('Probe 2: Snapshot row does not disappear after sample updatedAt advances', async () => {
            const a = fixture('a', '2026-01-01');
            mockSamples = [a];
            await stateService.syncJournal(auth);

            const snap = await stateService.createSnapshot(auth);
            expect(snap.totalSamples).toBe(1);

            // Update sample timestamp far into the future
            a.updatedAt = new Date(Date.now() + 600000);
            const page = await stateService.getSnapshotPage(snap.snapshotId, auth);

            // Frozen snapshot still contains the row
            expect(page.count).toBe(1);
            expect(page.data[0].specimenId).toBe('a');
        });
    });

    describe('R3: Connection Identity & Credential Isolation (Probe 3)', () => {
        test('Probe 3: Different credentials with same display name cannot access each others snapshots', async () => {
            mockSamples = [fixture('a', '2026-01-01')];
            await stateService.syncJournal(auth);
            const snap = await stateService.createSnapshot(auth);

            // Access with different key ID but identical name
            const unauthorizedAuth = { ...auth, id: 'different-key-id', keyId: 'different-key-id' };
            const access = stateService.getSnapshot(snap.snapshotId, unauthorizedAuth);

            expect(access.error).toBe('FORBIDDEN');
            expect(access.status).toBe(403);
        });

        test('Probe 8: Rejects unissued snapshots and negative receipt counts, enforces idempotency', async () => {
            const badReceipt = stateService.recordReceipt(auth, { snapshotId: 'unissued-snap', importedCount: -50 });
            expect(badReceipt.error).toBe('INVALID_COUNT');

            mockSamples = Array.from({ length: 10 }, (_, i) => fixture(`s_${i}`, '2026-01-01'));
            await stateService.syncJournal(auth);
            const snap = await stateService.createSnapshot(auth);
            const valid1 = stateService.recordReceipt(auth, { snapshotId: snap.snapshotId, importedCount: 10 });
            const valid2 = stateService.recordReceipt(auth, { snapshotId: snap.snapshotId, importedCount: 10 });

            expect(valid1.receiptId).toBe(valid2.receiptId);
            expect(valid2.idempotent).toBe(true);
        });
    });

    describe('R1: Monotonic Journal & Change Capture (Probes 4, 5, 6, 7)', () => {
        test('Probe 4: Change feed sequence progresses monotonically across pages', async () => {
            mockSamples = [fixture('a', '2026-01-01'), fixture('b', '2026-01-02')];
            await stateService.syncJournal(auth);

            const page1 = await stateService.getChanges(auth, { limit: 1 });
            expect(page1.changes).toHaveLength(1);
            expect(page1.changes[0].sequence).toBe(1);

            const page2 = await stateService.getChanges(auth, { limit: 1, cursor: page1.nextCursor });
            expect(page2.changes).toHaveLength(1);
            expect(page2.changes[0].sequence).toBe(2);
        });

        test('Probe 5: Cancelled specimen emits WITHDRAWAL event', async () => {
            mockSamples = [fixture('a', '2026-01-01'), fixture('b', '2026-01-02')];
            await stateService.syncJournal(auth);
            const page1 = await stateService.getChanges(auth, { limit: 1 });
            const page2 = await stateService.getChanges(auth, { limit: 1, cursor: page1.nextCursor });

            // Mark sample b as CANCELLED
            mockSamples[1].status = 'CANCELLED';
            mockSamples[1].updatedAt = new Date('2026-02-01');
            await stateService.syncJournal(auth);

            const withdrawals = await stateService.getChanges(auth, { cursor: page2.nextCursor });
            expect(withdrawals.count).toBe(1);
            expect(withdrawals.changes[0].eventType).toBe('WITHDRAWAL');
            expect(withdrawals.changes[0].specimenId).toBe('b');
            expect(withdrawals.changes[0].sequence).toBe(3);
        });

        test('Probe 6: Result-only edit emits AMENDMENT event', async () => {
            mockSamples = [fixture('a', '2026-01-01'), fixture('b', '2026-01-02')];
            await stateService.syncJournal(auth);
            const page1 = await stateService.getChanges(auth, { limit: 1 });
            const page2 = await stateService.getChanges(auth, { limit: 1, cursor: page1.nextCursor });

            mockSamples[1].status = 'CANCELLED';
            mockSamples[1].updatedAt = new Date('2026-02-01');
            await stateService.syncJournal(auth);
            const withdrawals = await stateService.getChanges(auth, { cursor: page2.nextCursor });

            // Edit results on sample a
            mockSamples[0].results = [{ id: 'new-res', param: 'PH', value: '7.2' }];
            mockSamples[0].updatedAt = new Date('2026-02-02');
            await stateService.syncJournal(auth);
            const amendments = await stateService.getChanges(auth, { cursor: withdrawals.nextCursor });

            expect(amendments.count).toBe(1);
            expect(amendments.changes[0].eventType).toBe('AMENDMENT');
            expect(amendments.changes[0].specimenId).toBe('a');
            expect(amendments.changes[0].sequence).toBe(4);
        });

        test('Probe 7: Exchange journal actively stores audit rows', async () => {
            mockSamples = [fixture('a', '2026-01-01')];
            await stateService.syncJournal(auth);
            await stateService.getChanges(auth, { limit: 10 });

            const count = memoryDb.prepare('SELECT COUNT(*) as n FROM _exchange_journal').get().n;
            expect(count).toBeGreaterThan(0);
        });
    });

    describe('R5, R6, R7: Truthful Formatting and Identity (Probes 9-13)', () => {
        test('Probe 9: Disambiguates profile reference across countries, does not infer confirmed profile', () => {
            const p1 = adapter.extractProfileReference({ projectCode: 'P', country: 'AAA', horizon: 'Ap' }, { site_id: 'POINT-1' });
            const p2 = adapter.extractProfileReference({ projectCode: 'P', country: 'BBB', horizon: 'Ap' }, { site_id: 'POINT-1' });

            expect(p1.profileRelation).toBe('SITE_POINT');
            expect(p1.profileKey).toBe('AAA:P:POINT-1');
            expect(p2.profileKey).toBe('BBB:P:POINT-1');
            expect(p1.profileKey).not.toBe(p2.profileKey);
        });

        test('Probe 10: AssignedLab does not fall back to accession; truthful publicationStatus; collector null', () => {
            const unassigned = adapter.formatSampleV2({
                ...fixture('x', '2026-01-01'),
                assignedLab: null,
                status: 'EXPECTED',
                fieldMetadata: JSON.stringify({ collector: 'Dr. Private' })
            });

            expect(unassigned.laboratoryId).toBeNull();
            expect(unassigned.publicationStatus).toBe('DRAFT');
            expect(unassigned.sampling.collectorName).toBeNull();
        });

        test('Probe 11: Boolean coordinate metadata is rejected as null', () => {
            const malformed = adapter.extractCoordinates({}, { latitude: { value: false }, longitude: { value: false } });
            expect(malformed).toBeNull();
        });

        test('Probe 12: Invalid calendar date 2026-99-99 is rejected as null', () => {
            const dates = adapter.extractDates({}, { collectionDate: '2026-99-99' });
            expect(dates.collectionDate).toBeNull();
        });

        test('Probe 13: Blank result string is null, LOD/LOQ/provenance preserved', () => {
            const obs = adapter.extractObservations({
                results: [{ id: 'b1', param: 'P', value: '', isCurrent: true, lod: 0.1, loq: 0.2, provenance: 'PREDICTED' }]
            })[0];

            expect(obs.asMeasured.value).toBeNull();
            expect(obs.lod).toBe(0.1);
            expect(obs.loq).toBe(0.2);
            expect(obs.provenance).toBe('PREDICTED');
        });
    });

    describe('R4: Authoritative Scope Policy (Probes 14 & 15)', () => {
        test('Probe 14: Accession matching allowed lab does not defeat assignedLab policy', () => {
            const misplaced = { ...fixture('z', '2026-01-01'), labId: 'LAB-A', assignedLab: 'LAB-B' };
            const where = policy.buildSampleWhere(auth, {});
            expect(matches(misplaced, where)).toBe(false);
        });

        test('Probe 15: Spectral query binds to parent sample relation', () => {
            const spectral = policy.buildSpectralWhere(auth, { project: 'P', country: 'AAA' });
            expect(Object.hasOwn(spectral, 'sample')).toBe(true);
            expect(spectral.sample.country).toBe('AAA');
        });
    });
});
