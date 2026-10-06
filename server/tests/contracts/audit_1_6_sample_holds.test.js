const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const prisma = require('../../prisma');
const holds = require('../../services/sampleHoldService');
const { createSampleFixture } = require('../helpers/workflowFixtures');
const { getAuthToken } = require('../setup');
const labId = `HOLD-LAB-${randomUUID()}`;
let actor;

beforeAll(async () => {
    await prisma.lab.create({ data: { id: labId, code: labId, name: 'Hold authority laboratory', country: 'GTM' } });
    actor = jwt.decode(await getAuthToken('LAB_MANAGER', labId));
});

async function sample(extra = {}) {
    const id = randomUUID();
    return createSampleFixture(prisma, { data: { id, originalId: id, status: 'EXPECTED', assignedLab: labId, ...extra } });
}
function snapshot() {
    const db = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
    try {
        return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => {
            const rows = db.prepare(`SELECT * FROM "${name.replaceAll('"', '""')}"`).all().map(row => JSON.stringify(row)).sort();
            return { name, count: rows.length, hash: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
        });
    } finally { db.close(); }
}
async function boundHold(sampleId, reason) {
    return prisma.$transaction(tx => holds.raiseKoboHold(tx, { sampleId, actor: 'system:kobo-sync',
        marker: { reason, status: holds.ACTIVE, updatedAt: new Date().toISOString() } }));
}
const resolve = (s, h, reason = 'Reviewed source evidence reconciled') => prisma.$transaction(tx => holds.resolveHold(tx,
    { sampleId: s.id, holdId: h.id, actor, reason }));

test('canonical holds and legacy metadata/mirror markers use the same fail-closed JS and SQL rule', async () => {
    const cases = [
        {}, { metadata: JSON.stringify({ provenanceHold: { status: holds.ACTIVE, reason: 'Legacy conflict' } }) },
        { fieldMetadata: JSON.stringify({ provenanceHold: { value: holds.ACTIVE, source: 'KOBO' } }) },
        { metadata: '{invalid' }, { metadata: JSON.stringify({ provenanceHold: { status: 'UNKNOWN' } }) },
        { metadata: JSON.stringify({ provenanceHold: { status: 'RESOLVED' } }), fieldMetadata: JSON.stringify({ provenanceHold: { value: 'RESOLVED', source: 'KOBO' } }) }
    ];
    for (const data of cases) {
        const s = await sample(data);
        const held = await holds.isHeld(prisma, s);
        const sql = await prisma.$queryRawUnsafe(`SELECT id FROM Sample s WHERE s.id = ? AND ${holds.heldSql('s')}`, s.id);
        expect(sql.length > 0).toBe(held);
        expect(held).toBe(Boolean(data.metadata && !data.metadata.includes('RESOLVED') || data.fieldMetadata && !data.fieldMetadata.includes('RESOLVED')));
    }
    const s = await sample();
    const h = await prisma.$transaction(tx => holds.raiseHold(tx, { sampleId: s.id, type: 'CLIENT_QUERY', reason: 'Confirm client identity', actor }));
    expect(h.compatMarker).toBeNull();
    expect(await holds.isHeld(prisma, s)).toBe(true);
    expect(await prisma.$queryRawUnsafe(`SELECT id FROM Sample s WHERE s.id = ? AND ${holds.heldSql('s')}`, s.id)).toHaveLength(1);
    await resolve(s, h);
    expect(await holds.isHeld(prisma, await prisma.sample.findUnique({ where: { id: s.id } }))).toBe(false);
});

test('resolving one of two bound holds keeps the sample held; the last clears both markers and preserves every old field', async () => {
    const s = await sample({ metadata: JSON.stringify({ unrelated: { kept: true }, provenanceHold: { status: holds.ACTIVE,
        reason: 'CONFLICTING_FIELD_SUBMISSIONS: historical reason', evidence: ['original evidence'] } }),
    fieldMetadata: JSON.stringify({ site: 'kept', provenanceHold: { value: holds.ACTIVE, source: 'KOBO', lastUpdatedBy: 'original sync' } }) });
    const first = await boundHold(s.id, 'CONFLICTING_FIELD_SUBMISSIONS: one'), second = await boundHold(s.id, 'REVISED_FIELD_EVIDENCE: two');
    await resolve(s, first);
    let fresh = await prisma.sample.findUnique({ where: { id: s.id } });
    expect(await holds.isHeld(prisma, fresh)).toBe(true);
    expect(JSON.parse(fresh.metadata).provenanceHold).toMatchObject({ status: holds.ACTIVE, resolutions: [expect.objectContaining({ holdId: first.id })] });
    expect(JSON.parse(fresh.fieldMetadata).provenanceHold.value).toBe(holds.ACTIVE);
    await resolve(s, second);
    fresh = await prisma.sample.findUnique({ where: { id: s.id } });
    expect(await holds.isHeld(prisma, fresh)).toBe(false);
    expect(JSON.parse(fresh.metadata)).toMatchObject({ unrelated: { kept: true }, provenanceHold: { status: 'RESOLVED',
        reason: 'REVISED_FIELD_EVIDENCE: two', evidence: ['original evidence'], resolutions: [
            expect.objectContaining({ holdId: first.id }), expect.objectContaining({ holdId: second.id })] } });
    expect(JSON.parse(fresh.fieldMetadata)).toEqual({ site: 'kept', provenanceHold: { value: 'RESOLVED', source: 'KOBO', lastUpdatedBy: 'original sync' } });
    expect(await prisma.auditLog.count({ where: { sampleId: s.id, action: 'HOLD_RESOLVED' } })).toBe(2);
    const before = snapshot();
    await resolve(s, second);
    expect(snapshot()).toEqual(before);
});

test('a new LIVE Kobo hold preserves earlier resolution history and raises the mirror again', async () => {
    const s = await sample({ fieldMetadata: JSON.stringify({ provenanceHold: { value: 'RESOLVED', source: 'KOBO' } }) });
    const first = await boundHold(s.id, 'REVISED_FIELD_EVIDENCE: first');
    await resolve(s, first);
    const second = await boundHold(s.id, 'REVISED_FIELD_EVIDENCE: later');
    const fresh = await prisma.sample.findUnique({ where: { id: s.id } });
    expect(second).toMatchObject({ raisedBy: 'system:kobo-sync', attributionSource: 'LIVE', compatMarker: 'KOBO_PROVENANCE' });
    expect(JSON.parse(fresh.metadata).provenanceHold).toMatchObject({ status: holds.ACTIVE, reason: second.reason,
        resolutions: [expect.objectContaining({ holdId: first.id })] });
    expect(JSON.parse(fresh.fieldMetadata).provenanceHold.value).toBe(holds.ACTIVE);
    expect(await holds.isHeld(prisma, fresh)).toBe(true);
});

test('an unbackfilled active marker refuses resolution with a stable code and zero table writes', async () => {
    const s = await sample({ metadata: JSON.stringify({ provenanceHold: { status: holds.ACTIVE, reason: 'Historical identity conflict' } }) });
    const before = snapshot();
    await expect(resolve(s, { id: randomUUID() })).rejects.toMatchObject({ statusCode: 409, code: 'HOLD_BACKFILL_REQUIRED' });
    expect(snapshot()).toEqual(before);
    expect(await holds.isHeld(prisma, s)).toBe(true);
});

test('an active marker with only resolved bound holds remains held', async () => {
    const s = await sample(), h = await boundHold(s.id, 'REVISED_FIELD_EVIDENCE: reconciled');
    await resolve(s, h);
    await prisma.sample.update({ where: { id: s.id }, data: { metadata: JSON.stringify({ provenanceHold: { status: holds.ACTIVE, reason: 'Inconsistent legacy producer' } }) } });
    const fresh = await prisma.sample.findUnique({ where: { id: s.id } });
    expect(await holds.isHeld(prisma, fresh)).toBe(true);
    await expect(prisma.$transaction(tx => holds.assertNotHeld(tx, fresh))).rejects.toMatchObject({ statusCode: 409, code: 'SAMPLE_HELD' });
});

test('resolution requires a reason, manager permission and scope, and all refusals preserve every table', async () => {
    const s = await sample(), h = await boundHold(s.id, 'REVISED_FIELD_EVIDENCE: review');
    for (const options of [{ reason: '' }, { actor: { ...actor, role: 'SAMPLE_RECEPTION' } }, { actor: { ...actor, labId: 'outside-lab' } }]) {
        const before = snapshot();
        await expect(prisma.$transaction(tx => holds.resolveHold(tx, { sampleId: s.id, holdId: h.id, reason: 'Reviewed', actor, ...options })))
            .rejects.toMatchObject({ statusCode: expect.any(Number), code: expect.any(String) });
        expect(snapshot()).toEqual(before);
    }
});

test('an audit failure rolls back resolution, both compatibility markers and all tables', async () => {
    const s = await sample(), h = await boundHold(s.id, 'REVISED_FIELD_EVIDENCE: audit rollback'), before = snapshot();
    await expect(prisma.$transaction(tx => holds.resolveHold({ ...tx, auditLog: { ...tx.auditLog,
        create: () => { throw new Error('Synthetic hold audit failure'); } } }, { sampleId: s.id, holdId: h.id, reason: 'Reviewed', actor })))
        .rejects.toThrow('Synthetic hold audit failure');
    expect(snapshot()).toEqual(before);
});

test('legacy updatedAt attribution is presented as an upper bound', () => {
    expect(holds.presentHold({ attributionSource: 'LEGACY_HOLD_UPDATED_AT' }).raisedAtIsUpperBound).toBe(true);
    expect(holds.presentHold({ attributionSource: 'KOBO_CONFLICT_AUDIT' }).raisedAtIsUpperBound).toBe(false);
});
