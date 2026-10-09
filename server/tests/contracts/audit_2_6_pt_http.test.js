const request = require('supertest');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
let app, prisma, ownedDatabase;
const { JWT_SECRET } = require('../../config/auth');
const policyService = require('../../services/policyService');
const owned = [];
beforeAll(async () => {
    ownedDatabase = await require('../helpers/qcGateFixture').qcGateFixture();
    prisma = ownedDatabase.db;
    await jest.isolateModulesAsync(async () => {
        jest.doMock('../../prisma', () => prisma);
        app = require('../../app');
    });
    jest.dontMock('../../prisma');
});
afterAll(async () => { if (ownedDatabase) await ownedDatabase.close(); });

test.each([null, 0, true, false, '', 'invalid-date'])('explicit invalid PT date %s refuses create and update with zero writes', async date => {
    const f = await fixture(), before = await f.snapshot(), created = await f.post({ ...f.body, date });
    expect(created.status).toBe(400); expect(created.body.code).toBe('PT_INPUT_INVALID'); expect(await f.snapshot()).toEqual(before);
    const round = (await f.post(f.body)).body.data, recorded = await f.snapshot();
    const updated = await request(app).patch(`/api/pt/rounds/${round.id}`).set('Authorization', f.auth).send({ date });
    expect(updated.status).toBe(400); expect(updated.body.code).toBe('PT_INPUT_INVALID'); expect(await f.snapshot()).toEqual(recorded);
});

test('PT create resolves a known lab code and rejects an unknown lab id with a stable 4xx', async () => {
    const f = await fixture(), code = `PT-CODE-${randomUUID()}`;
    await prisma.lab.update({ where: { id: f.labId }, data: { code } });
    const before = await f.snapshot(), missing = await f.post({ ...f.body, labId: `missing-${randomUUID()}` });
    expect(missing.status).toBe(400); expect(missing.body.code).toBe('PT_LAB_INVALID'); expect(await f.snapshot()).toEqual(before);
    const created = await f.post({ ...f.body, labId: code });
    expect(created.status).toBe(201); expect(created.body.data.labId).toBe(f.labId);
});

test('correction away from UNSATISFACTORY retains its RAISED NCR link and audits the old/new outcomes', async () => {
    const f = await fixture(), round = (await f.post(f.body)).body.data;
    const report = await prisma.nonconformityReport.findUnique({ where: { id: round.nonconformityId } });
    expect(report).toMatchObject({ source: 'PT', refType: 'ProficiencyRound', refId: round.id, labId: f.labId });
    const updated = await request(app).patch(`/api/pt/rounds/${round.id}`).set('Authorization', f.auth).send({ labResult: 0, uncertainty: 1 });
    expect(updated.status).toBe(200); expect(updated.body.data).toMatchObject({ outcome: 'SATISFACTORY', zScore: 0, ncrStatus: 'RAISED', nonconformityId: report.id });
    const audit = await prisma.auditLog.findFirst({ where: { entityId: round.id, action: 'UPDATE_PT' } });
    expect(JSON.parse(audit.before)).toMatchObject({ outcome: 'UNSATISFACTORY', ncrStatus: 'RAISED', nonconformityId: report.id });
    expect(JSON.parse(audit.after)).toMatchObject({ outcome: 'SATISFACTORY', ncrStatus: 'RAISED', nonconformityId: report.id });
    expect(await prisma.nonconformityReport.findUnique({ where: { id: report.id } })).toEqual(report);
    expect(await prisma.auditLog.count({ where: { entityId: round.id, action: 'PT_UNSATISFACTORY' } })).toBe(1);
});

async function fixture() {
    const id = randomUUID(), analysisCode = `pSA-${id}`, unitCode = `pt-unit-${id}`;
    await prisma.lab.create({ data: { id, code: id, name: 'Owned PT HTTP fixture', country: 'TEST' } });
    await prisma.unit.create({ data: { code: unitCode, display: 'Fixture unit', quantityKind: 'MASS_FRACTION', factorToBase: 1 } });
    await prisma.analysis.create({ data: { code: analysisCode, name: 'Mixed-case PT fixture', unitCode } });
    const user = await prisma.user.create({ data: { id: randomUUID(), username: `pt-${id}`, email: `${id}@example.test`,
        password: 'fixture', role: 'SUPER_ADMIN', labId: id, isActive: true, mustChangePassword: false } });
    const f = { labId: id, analysisCode, unitCode, users: [user.id], actor: user,
        token: jwt.sign({ id: user.id, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '10m' }) };
    f.auth = `Bearer ${f.token}`;
    f.body = { labId: id, analysisCode, provider: 'Fixture', roundRef: 'PT-owned', assignedValue: 0, labResult: 3, uncertainty: 1 };
    f.post = body => request(app).post('/api/pt/rounds').set('Authorization', f.auth).send(body);
    f.snapshot = async () => JSON.parse(JSON.stringify(await Promise.all([
        prisma.proficiencyRound.findMany({ where: { labId: id }, orderBy: { id: 'asc' } }),
        prisma.auditLog.findMany({ where: { labId: id }, orderBy: { id: 'asc' } }),
        prisma.nonconformityReport.findMany({ where: { labId: id }, orderBy: { id: 'asc' } })])));
    f.legacy = data => prisma.proficiencyRound.create({ data: { id: randomUUID(), ...f.body, zScore: 3,
        outcome: 'QUESTIONABLE', date: new Date(), classificationLimits: null, ...data } });
    owned.push(f); return f;
}
test('actual PT create preserves catalogue case, classifies z=3 as unsatisfactory, freezes lab/analysis policy and queues NCR evidence', async () => {
    const f = await fixture(), first = await f.post(f.body);
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ analysisCode: f.analysisCode, zScore: 3, outcome: 'UNSATISFACTORY', ncrStatus: 'RAISED' });
    expect(await prisma.nonconformityReport.findUnique({ where: { id: first.body.data.nonconformityId } })).toMatchObject({
        source: 'PT', refType: 'ProficiencyRound', refId: first.body.data.id, labId: f.labId, status: 'OPEN' });
    expect(JSON.parse(first.body.data.classificationLimits)).toEqual({ questionable: 2, unsatisfactory: 3 });
    const audit = await prisma.auditLog.findFirst({ where: { entityId: first.body.data.id, action: 'PT_UNSATISFACTORY' } });
    expect(JSON.parse(audit.details)).toMatchObject({ roundId: first.body.data.id, zScore: 3, limits: { questionable: 2, unsatisfactory: 3 } });
    await policyService.change(f.actor, f.labId, { reason: 'Reviewed PT analysis override', changes: [
        { key: 'pt.zScoreLimits', analysisCode: f.analysisCode, value: { questionable: 2.5, unsatisfactory: 4 } }] }, { db: prisma });
    const second = await f.post(f.body);
    expect(second.status).toBe(201); expect(second.body.data.outcome).toBe('QUESTIONABLE');
    expect(JSON.parse(second.body.data.classificationLimits)).toEqual({ questionable: 2.5, unsatisfactory: 4 });
    expect((await prisma.proficiencyRound.findUnique({ where: { id: first.body.data.id } })).classificationLimits).toBe(first.body.data.classificationLimits);
});

test.each([null, undefined, 0, -1, 'bad'])('actual PT create refuses sigma %s with stable 400 and zero PT/audit writes', async sigma => {
    const f = await fixture(), before = await f.snapshot(), response = await f.post({ ...f.body, uncertainty: sigma });
    expect(response.status).toBe(400); expect(response.body.code).toBe('PT_SIGMA_REQUIRED');
    expect(await f.snapshot()).toEqual(before);
});

test('actual PT create stores the unrounded near-boundary score and negative z=-3 is unsatisfactory', async () => {
    const f = await fixture(), near = await f.post({ ...f.body, labResult: 2.99996 });
    expect(near.status).toBe(201); expect(near.body.data.zScore).toBe(2.99996); expect(near.body.data.outcome).toBe('QUESTIONABLE');
    const negative = await f.post({ ...f.body, labResult: -3 });
    expect(negative.status).toBe(201); expect(negative.body.data.outcome).toBe('UNSATISFACTORY');
});

test('legacy flags carry a French warning; explicit sigma correction reclassifies, clears flags and retains before/after audit', async () => {
    const f = await fixture(), old = await f.legacy({ uncertainty: null, legacyScoreFlag: 'SIGMA_MISSING', legacyFlaggedAt: new Date() });
    const list = await request(app).get(`/api/pt/rounds?labId=${f.labId}&analysisCode=${encodeURIComponent(f.analysisCode)}`)
        .set('Authorization', f.auth).set('x-app-locale', 'fr');
    expect(list.status).toBe(200); expect(list.body.data[0].warnings[0]).toEqual({ code: 'SIGMA_MISSING',
        message: require('../../locales/fr.json').proficiencyTesting.legacySigmaMissing });
    expect(list.body.data[0].outcome).toBe('QUESTIONABLE'); expect(list.body.data[0].classificationLimits).toBeNull();
    const corrected = await request(app).patch(`/api/pt/rounds/${old.id}`).set('Authorization', f.auth).send({ uncertainty: 1 });
    expect(corrected.status).toBe(200); expect(corrected.body.data).toMatchObject({ zScore: 3, outcome: 'UNSATISFACTORY',
        ncrStatus: 'RAISED', legacyScoreFlag: null, legacyFlaggedAt: null });
    expect(await prisma.nonconformityReport.findUnique({ where: { id: corrected.body.data.nonconformityId } })).toMatchObject({
        source: 'PT', refType: 'ProficiencyRound', refId: old.id, labId: f.labId, status: 'OPEN' });
    const audit = await prisma.auditLog.findFirst({ where: { entityId: old.id, action: 'UPDATE_PT' } });
    expect(JSON.parse(audit.before)).toMatchObject({ zScore: 3, outcome: 'QUESTIONABLE', uncertainty: null, legacyScoreFlag: 'SIGMA_MISSING' });
    expect(JSON.parse(audit.after)).toMatchObject({ outcome: 'UNSATISFACTORY', uncertainty: 1, legacyScoreFlag: null });
});

test('metadata-only update preserves historical scores/classification/flags, and a numeric correction requires explicit sigma', async () => {
    const f = await fixture(), old = await f.legacy({ uncertainty: null, legacyScoreFlag: 'SIGMA_MISSING', legacyFlaggedAt: new Date() });
    const update = await request(app).patch(`/api/pt/rounds/${old.id}`).set('Authorization', f.auth).send({ notes: 'Verified historical label' });
    expect(update.status).toBe(200); expect(update.body.data).toMatchObject({ zScore: 3, outcome: 'QUESTIONABLE',
        classificationLimits: null, legacyScoreFlag: 'SIGMA_MISSING', uncertainty: null });
    const before = await f.snapshot(), invalid = await request(app).patch(`/api/pt/rounds/${old.id}`).set('Authorization', f.auth).send({ assignedValue: 1 });
    expect(invalid.status).toBe(400); expect(invalid.body.code).toBe('PT_SIGMA_REQUIRED'); expect(await f.snapshot()).toEqual(before);
});

test('manager deletion requires a reason, hides rather than erases, is idempotent and blocks later updates', async () => {
    const f = await fixture(), old = (await f.post(f.body)).body.data;
    const erase = body => request(app).delete(`/api/pt/rounds/${old.id}`).set('Authorization', f.auth).send(body);
    const before = await f.snapshot(), refused = await erase({ reason: '  ' });
    expect(refused.status).toBe(400); expect(refused.body.code).toBe('PT_DELETE_REASON_REQUIRED'); expect(await f.snapshot()).toEqual(before);
    const deleted = await erase({ reason: '  Duplicate provider import  ' });
    expect(deleted.status).toBe(200); expect(deleted.body.data).toMatchObject({ id: old.id, zScore: old.zScore, outcome: old.outcome,
        deletedBy: f.actor.username, deleteReason: 'Duplicate provider import' });
    expect((await request(app).get(`/api/pt/rounds?labId=${f.labId}`).set('Authorization', f.auth)).body.count).toBe(0);
    expect((await request(app).get(`/api/pt/rounds?labId=${f.labId}&includeDeleted=true`).set('Authorization', f.auth)).body.count).toBe(1);
    const after = await f.snapshot(), repeated = await erase({ reason: 'Already hidden' });
    expect(repeated.status).toBe(200); expect(await f.snapshot()).toEqual(after);
    const update = await request(app).patch(`/api/pt/rounds/${old.id}`).set('Authorization', f.auth).send({ uncertainty: 2 });
    expect(update.status).toBe(409); expect(update.body.code).toBe('PT_ROUND_DELETED'); expect(await f.snapshot()).toEqual(after);
    expect(await prisma.auditLog.count({ where: { entityId: old.id, action: 'DELETE_PT' } })).toBe(1);
});

test('actual PT write rolls the round back if its audit cannot be stored', async () => {
    const f = await fixture(), target = require('../helpers/testOwnedDatabase').assertOwnedTestDatabase(ownedDatabase.file, 'system:fixture');
    const raw = new Database(target, { fileMustExist: true });
    try {
        raw.exec(`CREATE TRIGGER owned_pt_api_audit_fault BEFORE INSERT ON "AuditLog" WHEN NEW.labId='${f.labId}'
            BEGIN SELECT RAISE(ABORT,'OWNED_PT_API_AUDIT_FAULT'); END;`);
        const before = await f.snapshot(), response = await f.post(f.body);
        expect(response.status).toBe(500); expect(await f.snapshot()).toEqual(before);
    } finally { raw.exec('DROP TRIGGER IF EXISTS owned_pt_api_audit_fault'); raw.close(); }
});

test('lab-scoped technician cannot create or update another lab and cannot include deleted rounds', async () => {
    const f = await fixture(), other = await fixture(), foreign = (await other.post(other.body)).body.data;
    const user = await prisma.user.create({ data: { id: randomUUID(), username: `pt-tech-${randomUUID()}`, email: `${randomUUID()}@example.test`,
        password: 'fixture', role: 'LAB_TECHNICIAN', labId: f.labId, isActive: true, mustChangePassword: false } }); f.users.push(user.id);
    const auth = `Bearer ${jwt.sign({ id: user.id, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '10m' })}`;
    const before = await other.snapshot();
    expect((await request(app).post('/api/pt/rounds').set('Authorization', auth).send(other.body)).status).toBe(403);
    expect((await request(app).patch(`/api/pt/rounds/${foreign.id}`).set('Authorization', auth).send({ uncertainty: 1 })).status).toBe(403);
    expect((await request(app).get('/api/pt/rounds?includeDeleted=true').set('Authorization', auth)).status).toBe(403);
    expect((await request(app).get(`/api/pt/rounds?labId=${other.labId}`).set('Authorization', auth)).body.count).toBe(0);
    expect(await other.snapshot()).toEqual(before);
});
