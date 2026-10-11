const { randomUUID } = require('node:crypto');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { cleanupWorkflowFixtures, createSampleFixture, createWorkItemsFixture } = require('../helpers/workflowFixtures');
const { validateSampleMatrix, matrixContext } = require('../../controllers/validationController');

// #278 (YY sign-off 6100482960): the blocking TEXTURE_CLOSURE gate is inclusive
// within crossCheck.textureClosureTolerancePct and reads stored numeric evidence.
const row = (param, numericValue, extra = {}) => ({ id: `${param}-${randomUUID()}`, param, value: String(numericValue),
    numericValue, unit: '%', censoring: 'NONE', replicateNo: 1, ...extra });
const triple = (sand, silt, clay, extra = {}) => [row('SAND', sand, extra), row('SILT', silt, extra), row('CLAY', clay, extra)];
const gate = (rows, context = { textureClosureTolerancePct: 2 }) => validateSampleMatrix(rows, context);

describe('#278 texture closure gate (pure)', () => {
    test('40 + 40 + 19 passes at the approved ±2 tolerance and classifies the soil', () => {
        const result = gate(triple(40, 40, 19));
        expect(result.isBlocking).toBe(false);
        expect(result.textureClosure).toEqual([expect.objectContaining({ replicateNo: 1, outcome: 'PASS', tolerancePct: 2 })]);
        expect(result.texture).toMatchObject({ isValid: true, closureError: 1 });
    });

    test.each([[40, 40, 18, false], [40, 40, 22, false], [40, 40, 17.9, true], [40, 40, 22.1, true]])
    ('%s + %s + %s at ±2 blocks: %s (boundary is inclusive)', (sand, silt, clay, blocked) => {
        const result = gate(triple(sand, silt, clay));
        expect(result.isBlocking).toBe(blocked);
        if (blocked) expect(result.blockingErrors).toEqual([expect.objectContaining({ check: 'TEXTURE_CLOSURE',
            severity: 'BLOCKING', replicateNo: 1, tolerancePct: 2, message: expect.stringContaining('± 2%') })]);
    });

    test('the lab tolerance, not a literal, decides', () => {
        expect(gate(triple(40, 40, 19), { textureClosureTolerancePct: 0.5 }).isBlocking).toBe(true);
        expect(gate(triple(40, 40, 17), { textureClosureTolerancePct: 3 }).isBlocking).toBe(false);
    });

    test('an invalid tolerance is refused rather than guessed', () => {
        for (const tolerance of [-1, '2', Number.NaN]) {
            expect(() => gate(triple(40, 40, 20), { textureClosureTolerancePct: tolerance }))
                .toThrow(expect.objectContaining({ statusCode: 409, code: 'CROSS_CHECK_POLICY_REQUIRED' }));
        }
    });

    test('stored numericValue is authoritative over the result text', () => {
        const rows = triple(40, 40, 19).map(item => ({ ...item, value: '87' }));
        expect(gate(rows).isBlocking).toBe(false);
        const misleading = triple(40, 30, 17).map(item => ({ ...item, value: '33.3' }));
        expect(gate(misleading).isBlocking).toBe(true);
    });

    test('a non-percent unit is disclosed as not evaluated and does not block', () => {
        const rows = [row('SAND', 400, { unit: 'g/kg' }), row('SILT', 400, { unit: 'g/kg' }), row('CLAY', 190, { unit: 'g/kg' })];
        const result = gate(rows);
        expect(result.isBlocking).toBe(false);
        expect(result.textureClosure).toEqual([expect.objectContaining({ outcome: 'NOT_EVALUATED', reasonCode: 'UNIT_MISMATCH' })]);
        expect(result.warnings).toContain('Texture closure not evaluated: UNIT_MISMATCH');
    });

    test('a row without a stored unit is never given a catalogue unit and closes exactly, never within the lab tolerance', () => {
        const missing = gate(triple(40, 40, 19, { unit: null }), { textureClosureTolerancePct: 2 });
        expect(missing.isBlocking).toBe(true);
        expect(missing.textureClosure[0]).toMatchObject({ outcome: 'BLOCKED', reasonCode: 'UNIT_MISSING_EXACT_CLOSURE', tolerancePct: null });
        expect(missing.blockingErrors[0].message).toContain('must sum to 100% exactly');
        expect(gate(triple(40, 30, 17, { unit: '' })).isBlocking).toBe(true);
        const exact = gate(triple(40, 40, 20, { unit: null }), { textureClosureTolerancePct: 2 });
        expect(exact).toMatchObject({ isBlocking: false, textureClosure: [expect.objectContaining({ outcome: 'PASS', reasonCode: 'UNIT_MISSING_EXACT_CLOSURE' })] });
        expect(exact.warnings).toContain('Texture closure: UNIT_MISSING_EXACT_CLOSURE');
        expect(gate(triple(40, 40, 19), { textureClosureTolerancePct: 2 }).isBlocking).toBe(false);
    });

    test.each([
        ['censored', triple(40, 40, 19).map((item, index) => index === 2 ? { ...item, censoring: 'BELOW_LOQ' } : item), 'INPUT_CENSORED'],
        ['non-numeric', triple(40, 40, 19).map((item, index) => index === 2 ? { ...item, numericValue: null, value: 'n/a' } : item), 'INPUT_NON_NUMERIC'],
        ['ambiguous', [...triple(40, 40, 19), row('SAND', 50)], 'MULTIPLE_CANDIDATES']
    ])('%s fractions are not evaluated and do not block', (_, rows, reasonCode) => {
        const result = gate(rows);
        expect(result.isBlocking).toBe(false);
        expect(result.textureClosure).toEqual([expect.objectContaining({ outcome: 'NOT_EVALUATED', reasonCode })]);
    });

    test('missing fractions skip the check, as before', () => {
        expect(gate([row('SAND', 40), row('SILT', 40)])).toMatchObject({ isBlocking: false, textureClosure: [], texture: null });
    });

    test('each replicate closes on its own', () => {
        const result = gate([...triple(40, 40, 19), ...triple(40, 30, 17, { replicateNo: 2 })]);
        expect(result.textureClosure.map(item => [item.replicateNo, item.outcome])).toEqual([[1, 'PASS'], [2, 'BLOCKED']]);
        expect(result.blockingErrors).toEqual([expect.objectContaining({ replicateNo: 2, message: expect.stringContaining('(replicate 2)') })]);
    });
});

describe('#278 laboratory policy and the real submission gate', () => {
    const labs = [], samples = [];
    async function lab(tolerance) {
        const id = `LAB278-${randomUUID().slice(0, 8)}`;
        await prisma.lab.create({ data: { id, code: id, name: id, country: 'GTM' } });
        if (tolerance !== undefined) await prisma.labPolicyOverride.create({ data: { id: randomUUID(), labId: id,
            key: 'crossCheck.textureClosureTolerancePct', value: JSON.stringify(tolerance), reason: '#278 fixture', setBy: 'FIXTURE' } });
        labs.push(id);
        return id;
    }
    afterAll(async () => {
        for (const sampleId of samples) {
            await prisma.result.deleteMany({ where: { sampleId } }).catch(() => {});
            await prisma.auditLog.deleteMany({ where: { sampleId } }).catch(() => {});
            await cleanupWorkflowFixtures(prisma, 'workItem', (await prisma.workItem.findMany({ where: { sampleId }, select: { id: true } })).map(item => item.id), { single: false }).catch(() => {});
            await cleanupWorkflowFixtures(prisma, 'sample', [sampleId], { single: true }).catch(() => {});
        }
        await prisma.labPolicyOverride.updateMany({ where: { labId: { in: labs }, revokedAt: null }, data: { revokedAt: new Date(), revokedBy: 'FIXTURE' } });
    });

    test('each laboratory gets its own tolerance; an unregistered lab gets the registry default', async () => {
        const strictLab = await lab(0.5), defaultLab = await lab();
        expect((await matrixContext(prisma, { assignedLab: strictLab })).textureClosureTolerancePct).toBe(0.5);
        expect((await matrixContext(prisma, { assignedLab: defaultLab })).textureClosureTolerancePct).toBe(2);
        expect((await matrixContext(prisma, { assignedLab: `unregistered-${randomUUID()}` })).textureClosureTolerancePct).toBe(2);
    });

    async function submitTriple(labId, values) {
        const token = await getAuthToken('LAB_MANAGER', labId, ['GTM'], ['SOILFER-US']);
        const sampleId = `SMP-278-${randomUUID().slice(0, 8)}`;
        samples.push(sampleId);
        await createSampleFixture(prisma, { data: { id: sampleId, originalId: `ORIG-${sampleId}`, status: 'PROCESSING',
            dryingStatus: 'DONE', preparationStatus: 'DONE', receptionDate: new Date(), assignedLab: labId, labId, country: 'GTM' } });
        for (const code of ['SAND', 'SILT', 'CLAY']) await prisma.analysis.upsert({ where: { code },
            create: { code, name: code, units: '%', status: 'active' }, update: {} });
        await createWorkItemsFixture(prisma, { data: ['SAND', 'SILT', 'CLAY'].map(analysis => ({ id: `${sampleId}-${analysis}`, sampleId,
            assignedLab: labId, assignedTo: require('jsonwebtoken').decode(token).username, analysis, status: 'IN_PROGRESS' })) });
        for (const [param, value] of values) await createExecutionResultFixture(prisma, { data: { id: randomUUID(), sampleId, param,
            value: String(value), numericValue: value, unit: '%', isCurrent: true } });
        return { sampleId, response: await request(app).post(`/api/results/${sampleId}/submit`).set('Authorization', `Bearer ${token}`) };
    }

    test('40 + 40 + 19 is no longer refused at the default tolerance', async () => {
        const { response } = await submitTriple(await lab(), [['SAND', 40], ['SILT', 40], ['CLAY', 19]]);
        expect(response.body.error).not.toBe('BLOCKING_MATRIX_DIAGNOSTICS');
    });

    test('a stricter lab still refuses 40 + 40 + 19 with zero writes', async () => {
        const { sampleId, response } = await submitTriple(await lab(0.5), [['SAND', 40], ['SILT', 40], ['CLAY', 19]]);
        expect(response.status).toBe(422);
        expect(response.body.blockingErrors).toEqual([expect.objectContaining({ check: 'TEXTURE_CLOSURE', tolerancePct: 0.5 })]);
        expect((await prisma.sample.findUnique({ where: { id: sampleId } })).status).toBe('PROCESSING');
    });
});
