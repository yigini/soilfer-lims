const Database = require('better-sqlite3');
const { PrismaClient } = require('../../prisma_client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { beforeGuards } = require('../helpers/legacyWorkflowDatabase');
const { createSampleFixture } = require('../helpers/workflowFixtures');
const policy = require('../../services/exchangePolicyService');

describe('Narrow publication hold candidates preserve conservative exclusions', () => {
    let db, client, rehearsal;
    async function initialize(rows = []) {
        const historical = rows.filter(row => row.status === 'RELEASED');
        rehearsal = beforeGuards({ actor: 'system:fixture', samples: historical.map(row => ({ ...row,
            originalId: row.id, createdAt: Date.UTC(2026, 9, 3), updatedAt: Date.UTC(2026, 9, 3) })) });
        client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${rehearsal.file}` }) });
        for (const row of rows.filter(row => row.status !== 'RELEASED')) {
            await createSampleFixture(client, { data: { ...row, originalId: row.id,
                approvedAt: row.approvedAt ? new Date(row.approvedAt) : null } });
        }
        db = new Database(rehearsal.file); db.pragma('foreign_keys = ON');
    }
    afterEach(async () => { if (db?.open) db.close(); await client?.$disconnect(); rehearsal?.close(); });
    test.each(['APPROVED', 'RELEASED', 'ARCHIVED', 'DISPOSED'])('malformed, non-object and actual holds are excluded in %s', async status => {
        await initialize([
            { id: 'malformed', status, approvedAt: '2026-10-03', metadata: '{broken', fieldMetadata: null },
            { id: 'array', status, approvedAt: '2026-10-03', metadata: null, fieldMetadata: '[]' },
            { id: 'hold', status, approvedAt: '2026-10-03', metadata: JSON.stringify({ provenanceHold: { status: 'AMBIGUOUS_PROVENANCE_HOLD' } }), fieldMetadata: null },
            { id: 'clean', status, approvedAt: '2026-10-03', metadata: '{}', fieldMetadata: '{}' }
        ]);
        expect(policy.getHeldSampleIds(db, { publicationOnly: true }).sort()).toEqual(['array', 'hold', 'malformed']);
    });
    test('unpublished rows and never-approved archived rows are not scanned for restricted publication', async () => {
        await initialize([{ id: 'expected', status: 'EXPECTED', approvedAt: null, metadata: '{broken' },
            { id: 'unapproved-archived', status: 'ARCHIVED', approvedAt: null, metadata: '{broken' }]);
        expect(policy.getHeldSampleIds(db, { publicationOnly: true })).toEqual([]);
        expect(policy.getHeldSampleIds(db).sort()).toEqual(['expected', 'unapproved-archived']);
    });
    test('missing publication columns retain broad conservative discovery', async () => {
        await initialize([{ id: 'old', status: 'EXPECTED', metadata: '[]' }]);
        // A read-only projection exposes the original minimal reader shape. The
        // real Sample table and every release guard remain installed and intact.
        db.exec('CREATE TEMP VIEW Sample AS SELECT id,metadata FROM main.Sample');
        expect(db.prepare('PRAGMA table_info(Sample)').all().map(row => row.name)).toEqual(['id', 'metadata']);
        expect(db.prepare('PRAGMA main.table_info(Sample)').all().some(row => row.name === 'status')).toBe(true);
        expect(policy.getHeldSampleIds(db, { publicationOnly: true })).toEqual(['old']);
    });
    test('a database failure remains an error, never a successful empty list', async () => {
        await initialize(); db.close();
        expect(() => policy.getHeldSampleIds(db, { publicationOnly: true })).toThrow();
    });
});
