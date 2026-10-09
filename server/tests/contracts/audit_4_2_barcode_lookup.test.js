const crypto = require('node:crypto'), jwt = require('jsonwebtoken'), request = require('supertest');
const app = require('../../app'), prisma = require('../../prisma');
const policy = require('../../services/policyService');
const codes = require('../../services/sampleCodeService');
const { createSampleFixture } = require('../helpers/workflowFixtures');
const { getAuthToken } = require('../setup');
const positive = 'GHA1-26-000123N', wrong = 'GHA1-26-000123K';
const id = () => crypto.randomUUID();
const unmatchedInvalidCode = () => {
    const body = 'UNMATCHED' + id().replaceAll('-', '').toUpperCase();
    return body + (codes.checkCharacter(body) === 'K' ? 'N' : 'K');
};

describe('Audit 4.2: stored exact identifiers and scoped failed-scan diagnostics', () => {
    let lab, technician, manager;
    beforeEach(async () => {
        lab = await prisma.lab.create({ data: { id: id(), code: 'SCAN' + id().slice(0, 8).toUpperCase(), name: 'Barcode contract lab', country: 'GTM' } });
        technician = await getAuthToken('LAB_TECHNICIAN', lab.id);
        manager = jwt.decode(await getAuthToken('LAB_MANAGER', lab.id));
        await format('{LAB}-{YY}-{SEQ:6}{CHK}');
    });
    afterEach(() => jest.restoreAllMocks());
    const format = value => policy.change(manager, lab.id, { changes: [{ key: 'sample.codeFormat', value }], reason: 'Barcode test numbering policy' });
    const sample = data => createSampleFixture(prisma, { data: { id: id(), originalId: 'FIELD-' + id(), labId: lab.id,
        assignedLab: lab.id, status: 'EXPECTED', ...data } });
    const lookup = (code, extra = {}, auth = technician) => request(app).get('/api/samples/lookup')
        .set('Authorization', 'Bearer ' + auth).query({ code, ...extra });
    const retained = async () => ({ samples: await prisma.sample.findMany({ orderBy: { id: 'asc' } }),
        results: await prisma.result.findMany({ orderBy: { id: 'asc' } }), audit: await prisma.auditLog.findMany({ orderBy: { id: 'asc' } }),
        sequences: await prisma.labSequence.findMany({ orderBy: [{ labId: 'asc' }, { scope: 'asc' }, { year: 'asc' }] }) });

    test.each([positive, wrong, 'HISTORICAL-N-000123', 'LABEL-WITHOUT-CHECK'])('stored issued code %s matches exactly without consulting current policy', async code => {
        const row = await sample({ labSampleCode: code });
        const spy = jest.spyOn(policy, 'get'); const before = await retained();
        const response = await lookup(' ' + code + ' ');
        expect(response.status).toBe(200); expect(response.body.id).toBe(row.id);
        expect(spy).not.toHaveBeenCalled(); expect(await retained()).toEqual(before);
    });
    test('literal originalId GHA1-26-000123K skips the checksum and resolves its row', async () => {
        const row = await sample({ originalId: wrong }); const spy = jest.spyOn(policy, 'get'), before = await retained();
        const response = await lookup(wrong);
        expect(response.status).toBe(200); expect(response.body.id).toBe(row.id); expect(spy).not.toHaveBeenCalled();
        expect(await retained()).toEqual(before);
    });
    test('failed K scan explains the existing check character while a valid unmatched N scan is plain not-found', async () => {
        expect(codes.verifyCheckCharacter(positive)).toBe(true); expect(codes.verifyCheckCharacter(wrong)).toBe(false);
        const before = await retained(), spy = jest.spyOn(policy, 'get');
        const invalid = await lookup(wrong), missing = await lookup(positive);
        expect(invalid.status).toBe(404); expect(invalid.body).toEqual({ code: 'SCAN_CHECK_CHARACTER_INVALID', error: 'Sample not found.' });
        expect(missing.status).toBe(404); expect(missing.body).toEqual({ code: 'SAMPLE_NOT_FOUND', error: 'Sample not found.' });
        expect(spy).toHaveBeenCalledWith(lab.id, 'sample.codeFormat', { db: prisma }); expect(await retained()).toEqual(before);
    });
    test.each(['{LAB}-{CHK}-{YY}-{SEQ:6}', '{LAB}-{YY}-{SEQ:6}'])('current format %s never guesses a historical checksum', async current => {
        await format(current); const before = await retained(), response = await lookup(wrong);
        expect(response.status).toBe(404); expect(response.body).toEqual({ code: 'SAMPLE_NOT_FOUND', error: 'Sample not found.' });
        expect(await retained()).toEqual(before);
    });
    test('a forged scanning lab cannot override technician scope or reveal a foreign stored label', async () => {
        const foreign = await prisma.lab.create({ data: { id: id(), code: 'FOREIGN' + id().slice(0, 6), name: 'Foreign barcode lab', country: 'GTM' } });
        const code = unmatchedInvalidCode();
        await sample({ labId: foreign.id, assignedLab: foreign.id, labSampleCode: code });
        const before = await retained(), spy = jest.spyOn(policy, 'get');
        const response = await lookup(code, { scanLabId: foreign.id });
        expect(response.status).toBe(404); expect(response.body).toEqual({ code: 'SCAN_CHECK_CHARACTER_INVALID', error: 'Sample not found.' });
        expect(spy).toHaveBeenCalledWith(lab.id, 'sample.codeFormat', { db: prisma }); expect(await retained()).toEqual(before);
    });
    test('a global operator diagnoses against the explicitly selected registered scanning lab only', async () => {
        const globalToken = await getAuthToken('SUPER_ADMIN'); const before = await retained();
        const invalid = unmatchedInvalidCode();
        const selected = await lookup(invalid, { scanLabId: lab.id }, globalToken);
        const unspecified = await lookup(invalid, {}, globalToken);
        const unknown = await lookup(invalid, { scanLabId: 'unknown-scanning-lab' }, globalToken);
        expect(selected.status).toBe(404); expect(selected.body.code).toBe('SCAN_CHECK_CHARACTER_INVALID');
        expect(unspecified.status).toBe(404); expect(unspecified.body.code).toBe('SAMPLE_NOT_FOUND');
        expect(unknown.body).toEqual(unspecified.body); expect(await retained()).toEqual(before);
    });
    test('ambiguous exact identifiers keep the existing 409 and every scoped candidate, without policy reinterpretation', async () => {
        const code = unmatchedInvalidCode();
        const first = await sample({ labSampleCode: code }), second = await sample({ originalId: code });
        const before = await retained(), spy = jest.spyOn(policy, 'get'), response = await lookup(code);
        expect(response.status).toBe(409); expect(response.body.code).toBe('SAMPLE_LOOKUP_AMBIGUOUS');
        expect(response.body.candidates.map(row => row.id).sort()).toEqual([first.id, second.id].sort());
        expect(spy).not.toHaveBeenCalled(); expect(await retained()).toEqual(before);
    });
    test('diagnostic policy failure preserves the scoped 404 and empty/unauthenticated lookup contracts', async () => {
        const before = await retained(); jest.spyOn(policy, 'get').mockRejectedValueOnce(new Error('Unavailable diagnostic policy'));
        const response = await lookup(wrong);
        expect(response.status).toBe(404); expect(response.body.code).toBe('SAMPLE_NOT_FOUND');
        expect((await lookup('  ')).status).toBe(400);
        expect((await request(app).get('/api/samples/lookup').query({ code: wrong })).status).toBe(401);
        expect(await retained()).toEqual(before);
    });
    test('a project-scoped operator without a lab keeps its authorized exact lookup and ordinary 404', async () => {
        const projectCode = 'PROJECT-' + id(), token = await getAuthToken('PROJECT_MANAGER', null, [], [projectCode]);
        const row = await sample({ projectCode, originalId: 'PROJECT-FIELD-' + id() });
        const before = await retained(), spy = jest.spyOn(policy, 'get');
        expect((await lookup(row.originalId, {}, token)).body.id).toBe(row.id);
        const missing = await lookup(wrong, { scanLabId: lab.id }, token);
        expect(missing.status).toBe(404); expect(missing.body).toEqual({ code: 'SAMPLE_NOT_FOUND', error: 'Sample not found.' });
        expect(spy).not.toHaveBeenCalled(); expect(await retained()).toEqual(before);
    });
});
