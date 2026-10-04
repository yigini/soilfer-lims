const crypto = require('crypto');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const lab = 'LAB-AUDIT-013';

describe('Audit 0.13: authenticated scoped sample lookup', () => {
    let token;
    beforeAll(async () => { token = await getAuthToken('LAB_TECHNICIAN', lab); });
    const lookup = (code, auth = token) => request(app).get('/api/samples/lookup').set('Authorization', `Bearer ${auth}`).query({ code });
    const sample = data => prisma.sample.create({ data: { id: id('SMP013'), originalId: id('FIELD013'),
        labId: id('LABEL013'), assignedLab: lab, status: 'EXPECTED', ...data } });
    test.each(['labId', 'originalId', 'id'])('an exact %s lookup resolves the immutable sample, including whitespace', async field => {
        const row = await sample();
        const response = await lookup(` ${row[field]} `);
        expect(response.status).toBe(200); expect(response.body).toMatchObject({ id: row.id, originalId: row.originalId, status: 'EXPECTED' });
    });
    test('unauthenticated lookup returns 401 even when the sample exists', async () => {
        const row = await sample();
        expect((await request(app).get('/api/samples/lookup').query({ code: row.labId })).status).toBe(401);
    });
    test('missing and foreign samples have the same 404 code without identifiers or candidates', async () => {
        const row = await sample({ assignedLab: 'FOREIGN-LAB-013' });
        const foreign = await lookup(row.labId), missing = await lookup(id('NONE013'));
        expect(foreign.status).toBe(404); expect(foreign.body).toEqual(missing.body);
        expect(foreign.body).toEqual({ code: 'SAMPLE_NOT_FOUND', error: 'Sample not found.' });
    });
    test('a labId identifier matching the user lab does not override a foreign assignedLab', async () => {
        await sample({ assignedLab: 'FOREIGN-LAB-013', labId: lab });
        const response = await lookup(lab);
        expect(response.status).toBe(404); expect(response.body.code).toBe('SAMPLE_NOT_FOUND');
    });
    test('ambiguous identifiers return every in-scope candidate display ID and never select the first row', async () => {
        const shared = id('SHARED013');
        const one = await sample({ labId: shared }), two = await sample({ originalId: shared });
        const response = await lookup(shared);
        expect(response.status).toBe(409); expect(response.body.code).toBe('SAMPLE_LOOKUP_AMBIGUOUS');
        expect(response.body.candidates.map(row => row.id).sort()).toEqual([one.id, two.id].sort());
        expect(response.body.candidates.map(row => row.displayId).sort()).toEqual([one.originalId, two.originalId].sort());
    });
    test('foreign collisions do not create ambiguity or expose candidates', async () => {
        const shared = id('COLLISION013');
        const visible = await sample({ labId: shared }); await sample({ labId: shared, assignedLab: 'FOREIGN-LAB-013' });
        const response = await lookup(shared);
        expect(response.status).toBe(200); expect(response.body.id).toBe(visible.id); expect(response.body.candidates).toBeUndefined();
    });
    test('a single sample matching multiple identifier fields is not ambiguous', async () => {
        const shared = id('SAME013'), row = await sample({ id: shared, originalId: shared, labId: shared });
        const response = await lookup(shared);
        expect(response.status).toBe(200); expect(response.body.id).toBe(row.id);
    });
    test('project scope resolves only the assigned project', async () => {
        const projectCode = id('PROJECT013');
        const projectToken = await getAuthToken('PROJECT_MANAGER', undefined, [], [projectCode]);
        const visible = await sample({ projectCode, assignedLab: 'PROJECT-LAB-013' }), hidden = await sample({ projectCode: id('OTHER013') });
        expect((await lookup(visible.labId, projectToken)).body.id).toBe(visible.id);
        expect((await lookup(hidden.labId, projectToken)).status).toBe(404);
    });
    test('an empty code fails with stable 400 and lookup does not write any data or audits', async () => {
        const before = await prisma.auditLog.count(), sampleCount = await prisma.sample.count();
        const response = await lookup('  ');
        expect(response.status).toBe(400); expect(response.body.code).toBe('LOOKUP_CODE_REQUIRED');
        expect(await prisma.auditLog.count()).toBe(before); expect(await prisma.sample.count()).toBe(sampleCount);
    });
});
