const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const policy = require('../../services/policyService');
const { valid } = require('../../config/policyRegistry');
const { getAuthToken } = require('../setup');
const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { cleanupWorkflowFixtures, createSampleFixture, createWorkItemsFixture } = require('../helpers/workflowFixtures');

// #281 (YY "ok to fix"): registry bounds for the cross-check thresholds. A value
// stored before the bounds existed is never rewritten; it is disclosed instead.
const bounds = [
    ['crossCheck.textureClosureTolerancePct', 0, 100],
    ['crossCheck.baseSaturationMaxPct', 0, undefined],
    ['crossCheck.cnMin', 0, undefined],
    ['crossCheck.cnMax', 0, undefined],
    ['crossCheck.carbonatePhMin', 0, 14],
    ['crossCheck.basesCecFactor', 1, undefined]
];
const labs = [], samples = [];
async function lab(stored = {}) {
    const id = `LAB281-${randomUUID().slice(0, 8)}`;
    await prisma.lab.create({ data: { id, code: id, name: id, country: 'GTM' } });
    // Simulates a row saved before #281: written directly, bypassing the policy owner.
    for (const [key, value] of Object.entries(stored)) await prisma.labPolicyOverride.create({ data: { id: randomUUID(), labId: id,
        key, value: JSON.stringify(value), reason: '#281 pre-bounds fixture', setBy: 'FIXTURE' } });
    labs.push(id);
    return id;
}
afterAll(async () => {
    for (const sampleId of samples) {
        await prisma.crossCheckEvaluation.deleteMany({ where: { sampleId } }).catch(() => {});
        await prisma.result.deleteMany({ where: { sampleId } }).catch(() => {});
        await prisma.auditLog.deleteMany({ where: { sampleId } }).catch(() => {});
        await cleanupWorkflowFixtures(prisma, 'workItem', (await prisma.workItem.findMany({ where: { sampleId }, select: { id: true } })).map(item => item.id), { single: false }).catch(() => {});
        await cleanupWorkflowFixtures(prisma, 'sample', [sampleId], { single: true }).catch(() => {});
    }
    await prisma.labPolicyOverride.updateMany({ where: { labId: { in: labs }, revokedAt: null }, data: { revokedAt: new Date(), revokedBy: 'FIXTURE' } });
});

describe('#281 registry bounds', () => {
    test.each(bounds)('%s accepts its bounds and refuses one step outside them', (key, min, max) => {
        expect(valid(key, min)).toBe(true);
        expect(valid(key, min - 0.01)).toBe(false);
        if (max !== undefined) { expect(valid(key, max)).toBe(true); expect(valid(key, max + 0.01)).toBe(false); }
    });

    test('defaults are unchanged', async () => {
        const values = (await policy.snapshot(await lab())).values;
        expect(bounds.map(([key]) => values[key])).toEqual([2, 100, 8, 25, 7, 1.1]);
    });

    test('the policy owner refuses an out-of-range save with POLICY_VALUE_INVALID and writes nothing', async () => {
        const labId = await lab(), actor = jwt.decode(await getAuthToken('LAB_MANAGER', labId));
        const save = changes => policy.change(actor, labId, { changes, reason: '#281 bound' });
        for (const [key, min, max] of bounds) {
            await expect(save([{ key, value: min - 0.01 }])).rejects.toMatchObject({ statusCode: 400, code: 'POLICY_VALUE_INVALID' });
            if (max !== undefined) await expect(save([{ key, value: max + 0.01 }])).rejects.toMatchObject({ statusCode: 400, code: 'POLICY_VALUE_INVALID' });
        }
        expect(await prisma.labPolicyOverride.count({ where: { labId } })).toBe(0);
        expect(await prisma.labPolicy.count({ where: { labId } })).toBe(0);
        await save([{ key: 'crossCheck.textureClosureTolerancePct', value: 0 }, { key: 'crossCheck.carbonatePhMin', value: 14 }]);
        expect(await policy.get(labId, 'crossCheck.textureClosureTolerancePct')).toBe(0);
    });
});

describe('#281 a stored out-of-range value', () => {
    async function workflow(labId, values, saved = []) {
        const token = await getAuthToken('LAB_MANAGER', labId, ['GTM'], ['SOILFER-US']);
        const sampleId = `SMP-281-${randomUUID().slice(0, 8)}`;
        samples.push(sampleId);
        await createSampleFixture(prisma, { data: { id: sampleId, originalId: `ORIG-${sampleId}`, status: 'PROCESSING',
            dryingStatus: 'DONE', preparationStatus: 'DONE', receptionDate: new Date(), assignedLab: labId, labId, country: 'GTM' } });
        const codes = [...values, ...saved].map(([param]) => param);
        await createWorkItemsFixture(prisma, { data: codes.map(analysis => ({ id: `${sampleId}-${analysis}`, sampleId,
            assignedLab: labId, assignedTo: jwt.decode(token).username, analysis, status: 'IN_PROGRESS' })) });
        // #209: declare usable retained order lines during NEW owned positive fixture assembly.
        await prisma.$transaction(tx => tx.sampleOrderRevision.create({ data: { id: randomUUID(), sampleId: sampleId,
            version: 1, status: 'ACTIVE', reason: 'Owned retained positive execution order context', requestedBy: jwt.decode(token).username,
            lines: { create: (codes).map(analysis => ({ id: randomUUID(), analysis, workItemId: null, status: 'ACTIVE', isRequired: true })) } } }));
        for (const [param, value, unit] of values) await createExecutionResultFixture(prisma, { data: { id: randomUUID(), sampleId, param,
            value: String(value), numericValue: value, unit, isCurrent: true } });
        const save = saved.length ? await request(app).post(`/api/results/${sampleId}`).set('Authorization', `Bearer ${token}`)
            .send({ measurements: saved.map(([param, value, unit]) => ({ param, value: String(value), unit })) }) : null;
        const submit = await request(app).post(`/api/results/${sampleId}/submit`).set('Authorization', `Bearer ${token}`);
        return { sampleId, save, submit };
    }
    const texture = [['SAND', 40, '%'], ['SILT', 40, '%'], ['CLAY', 20, '%'], ['SOC', 90, 'g/kg'], ['TN', 2, 'g/kg']];
    const fractions = texture.slice(0, 3), carbon = texture.slice(3);

    test('is never rewritten, keeps every other policy readable and disables only the cross-checks', async () => {
        const labId = await lab({ 'crossCheck.cnMin': -5 });
        const before = await prisma.labPolicyOverride.findMany({ where: { labId } });
        const snapshot = await policy.snapshot(labId);
        expect(snapshot.values['qc.mode']).toBe('REQUIRED_BLOCKING');
        expect(snapshot.resolved['crossCheck.cnMin']).toMatchObject({ value: null, invalid: true, source: 'LAB_OVERRIDE' });
        const { sampleId, save, submit } = await workflow(labId, fractions, carbon);
        expect(save.status).toBe(200);
        expect(save.body).toMatchObject({ success: true, crossChecks: [], crossCheckUnavailableReason: 'CROSS_CHECK_POLICY_INVALID' });
        expect(submit.status).toBe(200);
        expect(submit.body).toMatchObject({ status: 'SUBMITTED_FULL', crossChecks: [], crossCheckUnavailableReason: 'CROSS_CHECK_POLICY_INVALID' });
        expect(await prisma.crossCheckEvaluation.count({ where: { sampleId } })).toBe(0);
        expect(await prisma.labPolicyOverride.findMany({ where: { labId } })).toEqual(before);
    });

    test('a stored invalid texture tolerance is disclosed and the blocking gate closes exactly, never wider', async () => {
        const labId = await lab({ 'crossCheck.textureClosureTolerancePct': -1 });
        const exact = await workflow(labId, texture);
        expect(exact.submit.status).toBe(200);
        expect(exact.submit.body.matrixDiagnostics).toMatchObject({ texturePolicyInvalid: true, isBlocking: false });
        expect(exact.submit.body.crossCheckUnavailableReason).toBe('CROSS_CHECK_POLICY_INVALID');
        const open = await workflow(labId, [['SAND', 40, '%'], ['SILT', 40, '%'], ['CLAY', 19, '%']]);
        expect(open.submit.status).toBe(422);
        expect(open.submit.body.blockingErrors).toEqual([expect.objectContaining({ check: 'TEXTURE_CLOSURE', tolerancePct: null,
            message: expect.stringContaining('must sum to 100% exactly') })]);
        expect((await prisma.sample.findUnique({ where: { id: open.sampleId } })).status).toBe('PROCESSING');
    });

    test('a manager fixes it by saving a valid value as a new policy version', async () => {
        const labId = await lab({ 'crossCheck.cnMin': -5 }), actor = jwt.decode(await getAuthToken('LAB_MANAGER', labId));
        const saved = await policy.change(actor, labId, { changes: [{ key: 'crossCheck.cnMin', value: 8 }], reason: '#281 repair' });
        expect(saved.version).toBe(1);
        expect(saved.resolved['crossCheck.cnMin']).toMatchObject({ value: 8 });
        expect(saved.resolved['crossCheck.cnMin'].invalid).toBeUndefined();
    });

    test('another laboratory with valid policy still records evidence', async () => {
        await lab({ 'crossCheck.cnMin': -5 });
        const { sampleId, submit } = await workflow(await lab(), texture);
        expect(submit.status).toBe(200);
        expect(submit.body.crossCheckUnavailableReason).toBeUndefined();
        expect(submit.body.crossChecks.find(row => row.ruleCode === 'CN_RATIO')).toMatchObject({ outcome: 'FLAGGED' });
        expect(await prisma.crossCheckEvaluation.count({ where: { sampleId } })).toBeGreaterThan(0);
    });
});

test.each(['en', 'es', 'es-419', 'fr', 'pt'])('the %s server and client locales disclose CROSS_CHECK_POLICY_INVALID', locale => {
    const server = require(`../../locales/${locale}.json`), client = require(`../../../client/src/translations/${locale}.json`);
    const find = tree => JSON.stringify(tree).match(/"unavailable":\{[^}]*"CROSS_CHECK_POLICY_INVALID":"([^"]+)"/)?.[1];
    expect(find(server)).toEqual(expect.stringMatching(/\S/));
    expect(find(client)).toEqual(expect.stringMatching(/\S/));
});
