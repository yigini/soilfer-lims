const { randomUUID } = require('node:crypto');
const prisma = require('../../prisma');
const policy = require('../../services/policyService');
const actor = { username: 'system:fixture', role: 'SUPER_ADMIN' };

test('calibration verification is opt-in in every preset and can differ by lab and method', async () => {
    const labId = randomUUID(), otherLabId = randomUUID(), analysisCode = `CAL-${randomUUID()}`;
    for (const id of [labId, otherLabId]) await prisma.lab.create({ data: { id, code: id, name: 'Calibration policy fixture', country: 'GTM' } });
    await prisma.analysis.create({ data: { code: analysisCode, name: 'Calibration policy analyte' } });
    const method = await prisma.methodology.create({ data: { analysisCode, name: 'Instrumental method' } });
    const otherMethod = await prisma.methodology.create({ data: { analysisCode, name: 'Non-instrumental method' } });
    for (const presetCode of ['ISO17025_STRICT', 'BASIC', 'ADVISORY']) {
        await policy.change(actor, labId, { presetCode, reason: 'Choose lab preset' });
        expect(await policy.get(labId, 'qc.calibrationVerification', { analysisCode, methodologyId: method.id })).toBe(false);
    }
    await policy.change(actor, labId, { changes: [{ key: 'qc.calibrationVerification', value: true,
        analysisCode, methodologyId: method.id }], reason: 'Enable the reviewed instrumental method' });
    expect(await policy.get(labId, 'qc.calibrationVerification', { analysisCode, methodologyId: method.id })).toBe(true);
    expect(await policy.get(labId, 'qc.calibrationVerification', { analysisCode, methodologyId: otherMethod.id })).toBe(false);
    expect(await policy.get(otherLabId, 'qc.calibrationVerification', { analysisCode, methodologyId: method.id })).toBe(false);
    const snapshot = await policy.snapshot(labId, { analysisCode, methodologyId: method.id });
    expect(snapshot.resolved['qc.calibrationVerification']).toMatchObject({ value: true, source: 'METHOD_OVERRIDE', version: 4 });
    const before = await prisma.labPolicyOverride.count({ where: { labId } });
    await expect(policy.change(actor, labId, { changes: [{ key: 'qc.calibrationVerification', value: 'true' }],
        reason: 'Reject text pretending to be boolean' })).rejects.toMatchObject({ statusCode: 400, code: 'POLICY_VALUE_INVALID' });
    expect(await prisma.labPolicyOverride.count({ where: { labId } })).toBe(before);
    expect((await policy.snapshot(labId)).version).toBe(4);
});
