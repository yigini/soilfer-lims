const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { getNumberFormat } = require('../../services/numberFormatService');
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const lab = 'LAB-AUDIT-014';

describe('Audit 0.14: normalized entries and lab number policy', () => {
    let token, manager, actor;
    beforeAll(async () => {
        token = await getAuthToken('LAB_TECHNICIAN', lab); actor = jwt.decode(token);
        manager = await getAuthToken('LAB_MANAGER', lab);
        await prisma.lab.upsert({ where: { id: lab }, update: {}, create: { id: lab, code: lab, name: lab, country: 'GTM' } });
    });
    beforeEach(async () => { await prisma.lab.update({ where: { id: lab }, data: { settings: '{"language":"fr","dateFormat":"YYYY-MM-DD"}' } }); });
    async function fixture(analysis = 'SPEC_GRS') {
        const sampleId = id('SMP014'), workItemId = id('WI014');
        await prisma.sample.create({ data: { id: sampleId, originalId: sampleId, assignedLab: lab, labId: sampleId, status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE', requiredAnalyses: JSON.stringify([analysis]) } });
        await prisma.workItem.create({ data: { id: workItemId, sampleId, labId: lab, assignedLab: lab, analysis, assignedTo: actor.username, status: 'IN_PROGRESS', version: 0 } });
        return { sampleId, workItemId };
    }
    const record = (f, value, extra = {}) => request(app).post('/api/workbench/batch-save').set('Authorization', `Bearer ${token}`).send({ draft: false, entries: [{ workItemId: f.workItemId, value, version: 0, ...extra }] });
    test.each([['6,85', '6.85', 6.85], ['<0,5', '<0.5', 0.5], ['< 0.5', '<0.5', 0.5], ['>100', '>100', 100], ['1e-3', '0.001', 0.001]])('recording %s stores canonical value and exact raw input', async (raw, canonical, numericValue) => {
        const f = await fixture(); const response = await record(f, raw);
        expect({ status: response.status, body: response.body }).toMatchObject({ status: 200, body: { saved: 1 } });
        const result = await prisma.result.findFirst({ where: { sampleId: f.sampleId } });
        expect(result).toMatchObject({ value: canonical, rawInput: raw, numericValue, isCurrent: true });
    });
    test.each([['1,234', 'AMBIGUOUS_NUMBER'], ['1.234', 'AMBIGUOUS_NUMBER'], ['6 ,42', 'INVALID_NUMBER']])('invalid %s cannot be committed, even with a manager override reason', async (raw, code) => {
        const f = await fixture(); const before = await prisma.workItem.findUnique({ where: { id: f.workItemId } });
        const response = await record(f, raw, { overrideReason: 'Should never allow malformed numbers' });
        expect(response.status).toBe(422); expect(response.body.errors[0].code).toBe(code);
        expect(await prisma.result.count({ where: { sampleId: f.sampleId } })).toBe(0);
        expect(await prisma.workItem.findUnique({ where: { id: f.workItemId } })).toEqual(before);
    });
    test('texture stores all normalized fractions and exact individual raw inputs atomically', async () => {
        const f = await fixture('TEXTURE');
        const response = await record(f, null, { values: { sand: '6,85', silt: '43,15', clay: '50' } });
        expect(response.status).toBe(200); expect(response.body.saved).toBe(1);
        const rows = await prisma.result.findMany({ where: { sampleId: f.sampleId } });
        expect(rows.filter(row => row.isCurrent)).toHaveLength(4);
        expect(rows.find(row => row.param === 'SAND')).toMatchObject({ value: '6.85', numericValue: 6.85, rawInput: '6,85' });
        expect(rows.find(row => row.param === 'SILT')).toMatchObject({ value: '43.15', numericValue: 43.15, rawInput: '43,15' });
        expect(rows.find(row => row.param === 'TEXTURE').rawInput).toBe('{"sand":"6,85","silt":"43,15","clay":"50"}');
    });
    test('lab policy is shared across analysts, explicit thousands grouping is honored and malformed policy fails before writes', async () => {
        await prisma.lab.update({ where: { id: lab }, data: { settings: '{"decimalSeparator":".","thousandsSeparator":","}' } });
        expect(await getNumberFormat(lab)).toEqual({ decimal: '.', thousands: ',' });
        const f = await fixture(); const response = await record(f, '1,234');
        expect({ status: response.status, body: response.body }).toMatchObject({ status: 200, body: { saved: 1 } }); expect((await prisma.result.findFirst({ where: { sampleId: f.sampleId } })).value).toBe('1234');
        await prisma.lab.update({ where: { id: lab }, data: { settings: '{"decimalSeparator":",","thousandsSeparator":","}' } });
        const invalid = await fixture(), before = await prisma.workItem.findUnique({ where: { id: invalid.workItemId } });
        const refused = await record(invalid, '6,85');
        expect(refused.status).toBe(409); expect(refused.body.code).toBe('NUMBER_FORMAT_POLICY_INVALID');
        expect(await prisma.result.count({ where: { sampleId: invalid.sampleId } })).toBe(0);
        expect(await prisma.workItem.findUnique({ where: { id: invalid.workItemId } })).toEqual(before);
    });
    test('existing profile update persists only valid flat separators, retains unrelated settings and audits the change', async () => {
        const patch = data => request(app).patch(`/api/labs/${lab}/profile`).set('Authorization', `Bearer ${manager}`).send(data);
        expect((await patch({ decimalSeparator: ',', thousandsSeparator: '.' })).status).toBe(200);
        const stored = await prisma.lab.findUnique({ where: { id: lab } });
        expect(JSON.parse(stored.settings)).toEqual({ language: 'fr', dateFormat: 'YYYY-MM-DD', decimalSeparator: ',', thousandsSeparator: '.' });
        const audit = await prisma.auditLog.findFirst({ where: { entity: 'LAB', entityId: lab, action: 'UPDATE_PROFILE' }, orderBy: { timestamp: 'desc' } });
        expect(audit.details).toContain('settings');
        expect((await patch({ decimalSeparator: '.', thousandsSeparator: '.' })).body.code).toBe('NUMBER_FORMAT_POLICY_INVALID');
        expect((await prisma.lab.findUnique({ where: { id: lab } })).settings).toBe(stored.settings);
    });
    test('QC uses the same comma parsing and typed new QC details preserve original strings', async () => {
        const batchId = id('B014');
        await prisma.batch.create({ data: { id: batchId, labId: lab, analysis: 'PH_H2O', status: 'OPEN', profile: 'RACK_40', createdBy: actor.username } });
        const response = await request(app).post(`/api/qc/batches/${batchId}/evaluate`).set('Authorization', `Bearer ${token}`).send({
            blanks: [{ value: '0,01' }], controls: [{ expected: '7,00', measured: '7,00' }], duplicates: [{ value1: '6,85', value2: '6,87' }] });
        expect(response.status).toBe(200); expect(response.body.evaluation.duplicates[0].value1).toBe(6.85);
        const row = await prisma.batchQcResult.findFirst({ where: { batchId, type: 'DUPLICATE' } });
        expect(JSON.parse(row.details).rawInput).toEqual({ value1: '6,85', value2: '6,87' });
    });
    test('an ambiguous QC value fails before any batch, typed QC or audit writes', async () => {
        const batchId = id('B014'); await prisma.batch.create({ data: { id: batchId, labId: lab, analysis: 'PH_H2O', status: 'OPEN', profile: 'RACK_40', createdBy: actor.username } });
        const response = await request(app).post(`/api/qc/batches/${batchId}/evaluate`).set('Authorization', `Bearer ${token}`).send({ blanks: [{ value: '1,234' }], controls: [{ expected: 7, measured: 7 }], duplicates: [{ value1: 7, value2: 7 }] });
        expect(response.status).toBe(400); expect(response.body.code).toBe('AMBIGUOUS_NUMBER');
        expect((await prisma.batch.findUnique({ where: { id: batchId } })).status).toBe('OPEN');
        expect(await prisma.batchQcResult.count({ where: { batchId } })).toBe(0);
        expect(await prisma.auditLog.count({ where: { entityId: batchId } })).toBe(0);
    });
});
