const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { randomUUID } = require('crypto');

const completeValues = () => ({
    blanks: [{ value: 0 }], controls: [{ expected: 7, measured: 7 }],
    duplicates: [{ value1: 7, value2: 7 }, { value1: 7, value2: 7 }]
});

describe('Audit 0.1: explicit QC measurements at evaluation', () => {
    let token;
    let batchId;
    beforeAll(async () => { token = await getAuthToken('LAB_TECHNICIAN', 'AUDIT-QC-VALUES'); });
    beforeEach(async () => {
        batchId = `AUDIT-QC-${randomUUID()}`;
        await prisma.batch.create({ data: {
            id: batchId, labId: 'AUDIT-QC-VALUES', analysis: 'PH_H2O', profile: 'RACK_40',
            status: 'OPEN', createdBy: 'audit-fixture', history: '[]', qcResults: '{}'
        } });
        await require('../helpers/normalizedQcFixture').normalizeLegacyQcFixture(prisma, batchId);
    });
    // Retain normalized QC evidence until the disposable database teardown.

    test.each([
        ['empty payload', {}],
        ['empty collections', { blanks: [], controls: [], duplicates: [] }],
        ['partial types', { blanks: [{ value: 0 }] }],
        ['missing duplicate reading', { ...completeValues(), duplicates: [{ value1: 7 }] }],
        ['empty blank', { ...completeValues(), blanks: [{ value: '' }] }],
        ['whitespace control', { ...completeValues(), controls: [{ expected: 7, measured: ' ' }] }],
        ['invalid numeric value', { ...completeValues(), blanks: [{ value: 'no reading' }] }],
        ['boolean blank', { ...completeValues(), blanks: [{ value: false }] }],
        ['null control record', { ...completeValues(), controls: [null] }]
    ])('rejects %s without changing stored QC or audit evidence', async (_, payload) => {
        const before = await prisma.batch.findUnique({ where: { id: batchId } });
        const auditCount = await prisma.auditLog.count({ where: { entityId: batchId } });
        const res = await request(app).post(`/api/qc/batches/${batchId}/evaluate`)
            .set('Authorization', `Bearer ${token}`).send(payload);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('QC_VALUES_MISSING');
        expect(await prisma.batch.findUnique({ where: { id: batchId } })).toEqual(before);
        expect(await prisma.batchQcResult.count({ where: { batchId } })).toBe(0);
        expect(await prisma.auditLog.count({ where: { entityId: batchId } })).toBe(auditCount);
    });

    test.each([0, '0'])('accepts an explicitly entered zero blank (%s)', async value => {
        const res = await request(app).post(`/api/qc/batches/${batchId}/evaluate`)
            .set('Authorization', `Bearer ${token}`).send({ ...completeValues(), blanks: [{ value }] });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('QC_PASS');
        expect(res.body.evaluation.blanks[0].value).toBe(0);
    });

    test('rejecting an incomplete new evaluation preserves existing QC measurements', async () => {
        await request(app).post(`/api/qc/batches/${batchId}/evaluate`)
            .set('Authorization', `Bearer ${token}`).send(completeValues()).expect(200);
        const before = await prisma.batch.findUnique({ where: { id: batchId } });
        const rows = await prisma.qcMeasurement.findMany({ where: { batchId }, orderBy: { id: 'asc' } });
        const evaluations = await prisma.qcEvaluation.findMany({ where: { batchId }, orderBy: { version: 'asc' } });
        await request(app).post(`/api/qc/batches/${batchId}/evaluate`)
            .set('Authorization', `Bearer ${token}`).send({}).expect(400);
        expect(await prisma.batch.findUnique({ where: { id: batchId } })).toEqual(before);
        expect(await prisma.qcMeasurement.findMany({ where: { batchId }, orderBy: { id: 'asc' } })).toEqual(rows);
        expect(await prisma.qcEvaluation.findMany({ where: { batchId }, orderBy: { version: 'asc' } })).toEqual(evaluations);
    });
});

// Client cases migrated under Claude's #188 pin 6052289128; server cases above are unchanged.
const { nativeHost, nativeFixture, enter } = require('../helpers/qcWorksheetUi');
describe('Audit 0.1: native worksheet explicit observations', () => {
    test.each(['1,234', '1.234', '6 ,42'])('ambiguous or malformed QC input %s cannot be sent', async raw => {
        const view = nativeHost(); await view.render();
        await enter(view, { blank: '0', 'control-0': '7', 'parent-0': raw, 'duplicate-0': '7' });
        expect(view.find('native-qc-evaluate').props.disabled).toBe(true);
        await view.find('native-qc-evaluate').props.onClick();
        expect(view.axios.post).not.toHaveBeenCalled(); expect(view.axios.put).not.toHaveBeenCalled();
    });
    test('opening QC with no input disables evaluation and clicking its handler sends no request', async () => {
        const view = nativeHost(); await view.render();
        for (const id of ['blank', 'control-0', 'parent-0', 'duplicate-0']) expect(view.find('native-value-' + id).props.value).toBe('');
        expect(view.find('native-qc-evaluate').props.disabled).toBe(true);
        await view.find('native-qc-evaluate').props.onClick();
        expect(view.axios.post).not.toHaveBeenCalled(); expect(view.axios.put).not.toHaveBeenCalled();
    });
    test('requires every position, accepts zero and decimal comma verbatim, and opens fresh from server evidence', async () => {
        const batch = nativeFixture(), view = nativeHost(batch); await view.render();
        await enter(view, { blank: '0', 'control-0': '7,03', 'parent-0': '6,85' });
        expect(view.find('native-qc-evaluate').props.disabled).toBe(true);
        await view.find('native-qc-evaluate').props.onClick(); expect(view.axios.post).not.toHaveBeenCalled();
        await enter(view, { 'duplicate-0': '6,87' });
        expect(view.find('native-qc-evaluate').props.disabled).toBeFalsy(); await view.find('native-qc-evaluate').props.onClick();
        expect(view.axios.post).toHaveBeenCalledWith('/api/qc/batches/worksheet-run/evaluate', {
            analysisCode: 'A', references: [], measurements: [
                { positionId: 'blank', replicateNo: 1, rawInput: '0' }, { positionId: 'control-0', replicateNo: 1, rawInput: '7,03' },
                { positionId: 'parent-0', replicateNo: 1, rawInput: '6,85' }, { positionId: 'duplicate-0', replicateNo: 1, rawInput: '6,87' }
            ]
        });
        view.unmount(); batch.analytes[0].measurements = [{ positionId: 'blank', replicateNo: 1, rawInput: '0.0123456789' }];
        await view.render(); expect(view.find('native-value-blank')).toBeUndefined();
        expect(view.text()).toContain('0.0123456789');
        for (const id of ['control-0', 'parent-0', 'duplicate-0']) expect(view.find('native-value-' + id).props.value).toBe('');
        expect(view.find('native-qc-evaluate').props.disabled).toBe(true);
    });
});
