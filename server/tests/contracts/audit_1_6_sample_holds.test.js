const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');
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
        { metadata: '{invalid' }, { metadata: '[]' }, { metadata: 'null' },
        { metadata: JSON.stringify({ provenanceHold: null }) }, { metadata: JSON.stringify({ provenanceHold: 'invalid' }) },
        { fieldMetadata: JSON.stringify({ provenanceHold: [] }) },
        { metadata: JSON.stringify({ provenanceHold: { status: 'UNKNOWN' } }) },
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

test('prepared acceptance preserves the legacy refusal code and blocks a canonical hold with zero table writes', async () => {
    const legacy = await sample({ metadata: JSON.stringify({ provenanceHold: { status: holds.ACTIVE, reason: 'Legacy conflict' } }) });
    const canonical = await sample();
    await prisma.$transaction(tx => holds.raiseHold(tx, { sampleId: canonical.id, type: 'CLIENT_QUERY', reason: 'Confirm client identity', actor }));
    for (const [s, code] of [[legacy, 'AMBIGUOUS_PROVENANCE_HOLD'], [canonical, 'SAMPLE_HELD']]) {
        const before = snapshot();
        await expect(prisma.$transaction(tx => require('../../services/intakeService').commitPrepared(tx, {
            sample: s, responseKind: 'accepted', body: {}, user: actor, updateData: {}, now: new Date()
        }))).rejects.toMatchObject({ statusCode: 409, code });
        expect(snapshot()).toEqual(before);
    }
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
    expect(JSON.parse(fresh.metadata).provenanceHold).not.toHaveProperty('createdByResolution');
    expect(JSON.parse(fresh.metadata).provenanceHold).not.toHaveProperty('boundHoldIds');
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

test('re-raising a wrapper-only resolution removes stale association flags and retains resolution evidence', async () => {
    const s = await sample({ metadata: '{"untouched":1}', fieldMetadata: JSON.stringify({ provenanceHold: { value: holds.ACTIVE, source: 'KOBO' } }) });
    const first = await prisma.$transaction(tx => holds.raiseHold(tx, { sampleId: s.id, type: 'PROVENANCE',
        reason: 'Original wrapper evidence', actor: 'system:kobo-sync', compatMarker: holds.COMPAT }));
    await resolve(s, first);
    const marker = JSON.parse((await prisma.sample.findUnique({ where: { id: s.id } })).metadata).provenanceHold;
    expect(marker).toMatchObject({ createdByResolution: true, boundHoldIds: [first.id] });
    await boundHold(s.id, 'REVISED_FIELD_EVIDENCE: subsequent source');
    const fresh = JSON.parse((await prisma.sample.findUnique({ where: { id: s.id } })).metadata).provenanceHold;
    expect(fresh).not.toHaveProperty('createdByResolution'); expect(fresh).not.toHaveProperty('boundHoldIds');
    expect(fresh.resolutions).toEqual(marker.resolutions); expect(fresh.status).toBe(holds.ACTIVE);
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

test('wrapper-only resolution adds one marker after the last bound hold and preserves unrelated metadata bytes', async () => {
    const metadata = '{\n  "unrelated" : { "scientificValue": 1.2300, "text": "kept" }, "list": [ 1, 2 ]\n}';
    const mirror = { value: holds.ACTIVE, source: 'KOBO', lastUpdatedAt: '2026-10-01T12:00:00Z', lastUpdatedBy: 'SYNC' };
    const s = await sample({ metadata, fieldMetadata: JSON.stringify({ site: 'kept', provenanceHold: mirror }) });
    const create = () => prisma.$transaction(tx => holds.raiseHold(tx, { sampleId: s.id, type: 'PROVENANCE',
        reason: 'Reviewed wrapper-only identity evidence', actor: 'system:kobo-sync', compatMarker: holds.COMPAT }));
    const first = await create(), last = await create();
    await resolve(s, first);
    let fresh = await prisma.sample.findUnique({ where: { id: s.id } });
    expect(fresh.metadata).toBe(metadata);
    expect(JSON.parse(fresh.fieldMetadata).provenanceHold).toEqual(mirror);
    expect(await holds.isHeld(prisma, fresh)).toBe(true);
    await resolve(s, last);
    fresh = await prisma.sample.findUnique({ where: { id: s.id } });
    const closing = metadata.lastIndexOf('}');
    expect(fresh.metadata.slice(0, closing)).toBe(metadata.slice(0, closing));
    const marker = JSON.parse(fresh.metadata).provenanceHold;
    expect(marker).toMatchObject({ status: 'RESOLVED', createdByResolution: true });
    expect(marker.boundHoldIds.sort()).toEqual([first.id, last.id].sort());
    expect(marker.resolutions.map(row => row.holdId).sort()).toEqual([first.id, last.id].sort());
    expect(JSON.parse(fresh.fieldMetadata)).toEqual({ site: 'kept', provenanceHold: { ...mirror, value: 'RESOLVED' } });
    expect(await holds.isHeld(prisma, fresh)).toBe(false);
    const audit = await prisma.auditLog.findFirst({ where: { entityId: last.id, action: 'HOLD_RESOLVED' } });
    expect(JSON.parse(audit.details)).toEqual({ markerCreatedByResolution: true,
        metadataBeforeSha256: createHash('sha256').update(metadata).digest('hex'),
        metadataAfterSha256: createHash('sha256').update(fresh.metadata).digest('hex') });
});

test.each(['{unparseable', '["non-object root"]', '{"provenanceHold":"non-object marker","untouched":1}'])
('malformed hold metadata %s refuses resolution and preserves every raw byte and table', async metadata => {
    const s = await sample({ metadata });
    const h = await prisma.$transaction(tx => holds.raiseHold(tx, { sampleId: s.id, type: 'PROVENANCE',
        reason: 'Reviewed legacy hold: metadata repair needed', actor: 'system:kobo-sync', compatMarker: holds.COMPAT }));
    const before = snapshot();
    await expect(resolve(s, h)).rejects.toMatchObject({ statusCode: 409, code: 'HOLD_MARKER_INVALID' });
    expect(snapshot()).toEqual(before);
    const fresh = await prisma.sample.findUnique({ where: { id: s.id } });
    expect(fresh.metadata).toBe(metadata);
    expect(await holds.isHeld(prisma, fresh)).toBe(true);
    expect((await request(holdRoutes(actor)).get(`/api/samples/${s.id}/holds`)).body).toMatchObject({ held: true, metadataRepairNeeded: true });
});

function holdRoutes(user) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.user = user; next(); });
    app.use('/api/samples', require('../../routes/sampleRoutes'));
    return app;
}

test.each(['RESOLVED', holds.ACTIVE, { status: 'RESOLVED' }, null])('metadata edits cannot forge hold authority with %p', async value => {
    const s = await sample({ fieldMetadata: JSON.stringify({ provenanceHold: { value: holds.ACTIVE, source: 'KOBO' } }) });
    const before = snapshot();
    const response = await request(holdRoutes(actor)).put(`/api/samples/${s.id}/metadata`).send({ metadata: { provenanceHold: value } });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('HOLD_MARKER_MANAGED');
    expect(snapshot()).toEqual(before);
    expect(await holds.isHeld(prisma, await prisma.sample.findUnique({ where: { id: s.id } }))).toBe(true);
});

test.each(['get', 'resolve'])('hold %s route maps database busy errors to a stable conflict', async action => {
    const s = await sample();
    const method = action === 'get' ? 'findMany' : null;
    const spy = action === 'get' ? jest.spyOn(prisma.sampleHold, method) : jest.spyOn(prisma, '$transaction');
    spy.mockRejectedValueOnce(Object.assign(new Error('database is locked'), { code: 'SQLITE_BUSY' }));
    try {
        const response = action === 'get' ? await request(holdRoutes(actor)).get(`/api/samples/${s.id}/holds`) :
            await request(holdRoutes(actor)).post(`/api/samples/${s.id}/holds/fault/resolve`).send({ reason: 'Reviewed' });
        expect(response.status).toBe(409); expect(response.body.code).toBe('STATE_CHANGED');
    } finally { spy.mockRestore(); }
});

test('hold routes enforce manager permission and sample scope, then return resolved attribution', async () => {
    const s = await sample(), h = await boundHold(s.id, 'REVISED_FIELD_EVIDENCE: route reconciliation');
    const before = snapshot();
    const outside = holdRoutes({ ...actor, labId: 'outside-laboratory' });
    expect((await request(outside).get(`/api/samples/${s.id}/holds`)).status).toBe(403);
    expect((await request(outside).post(`/api/samples/${s.id}/holds/${h.id}/resolve`).send({ reason: 'Outside scope' })).status).toBe(403);
    const reception = holdRoutes({ ...actor, role: 'SAMPLE_RECEPTION' });
    expect((await request(reception).get(`/api/samples/${s.id}/holds`)).body).toMatchObject({ held: true, canResolve: false });
    expect((await request(reception).post(`/api/samples/${s.id}/holds/${h.id}/resolve`).send({ reason: 'Reception cannot resolve' })).status).toBe(403);
    const manager = holdRoutes(actor);
    expect((await request(manager).post(`/api/samples/${s.id}/holds/${h.id}/resolve`).send({ reason: ' ' })).status).toBe(400);
    expect(snapshot()).toEqual(before);
    const resolved = await request(manager).post(`/api/samples/${s.id}/holds/${h.id}/resolve`).send({ reason: 'Field source reconciled by manager' });
    expect(resolved.status).toBe(200);
    expect(resolved.body.hold).toMatchObject({ resolvedBy: actor.username, resolution: 'Field source reconciled by manager', raisedAtIsUpperBound: false });
    const fresh = await request(manager).get(`/api/samples/${s.id}/holds`);
    expect(fresh.body).toMatchObject({ held: false, canResolve: true, holds: [expect.objectContaining({ id: h.id, resolvedAt: expect.any(String) })] });
});
