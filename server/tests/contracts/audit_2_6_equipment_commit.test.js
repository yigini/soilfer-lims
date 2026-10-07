const request = require('supertest'), jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const app = require('../../app'), prisma = require('../../prisma');
const { JWT_SECRET } = require('../../config/auth');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const policyService = require('../../services/policyService');
const { resolveEquipmentRequirement } = require('../../services/workbenchReadinessService');
async function fixture() {
    const labId = randomUUID(), analysis = `eq26-${randomUUID()}`;
    await prisma.lab.create({ data: { id: labId, code: labId, name: 'Owned equipment commit laboratory', country: 'TEST' } });
    const actor = await prisma.user.create({ data: { id: randomUUID(), username: `eq-${labId}`, email: `${labId}@example.test`,
        password: 'fixture', role: 'SUPER_ADMIN', labId, isActive: true, mustChangePassword: false } });
    await prisma.analysis.create({ data: { code: analysis, name: 'Controlled equipment fixture', units: 'mg/kg',
        status: 'active', validation: JSON.stringify({ type: 'numeric', min: 0, max: 100 }) } });
    const f = { labId, analysis, actor, auth: `Bearer ${jwt.sign({ id: actor.id, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '10m' })}` };
    f.item = async (code = analysis) => {
        const sampleId = randomUUID(), workItemId = randomUUID();
        await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, labId: sampleId, assignedLab: labId,
            status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE', requiredAnalyses: JSON.stringify([code]) } });
        await createWorkItemFixture(prisma, { data: { id: workItemId, sampleId, analysis: code, assignedLab: labId,
            assignedTo: actor.username, status: 'ASSIGNED', version: 0 } });
        return { sampleId, workItemId, version: 0, value: '6.2' };
    };
    f.asset = (criticality = 'CRITICAL', configured = true) => prisma.equipmentAsset.create({ data: {
        id: randomUUID(), labId, name: 'Owned qualified instrument', assetType: 'OTHER', status: 'IN_SERVICE', criticality,
        ...(configured && { qualification: { create: { id: randomUUID(), labId, calibrationStatus: 'OK',
            verificationStatus: 'OK', nextCalibrationDueDate: new Date(Date.now() + 86400000) } } }) } });
    f.save = entries => request(app).post('/api/workbench/v2/completion/commit').set('Authorization', f.auth).send({ entries });
    f.require = async (value, analysisCode = null, methodologyId = null) => policyService.change(actor, labId, {
        reason: 'Reviewed equipment fixture policy', changes: [{ key: 'equipment.requireEquipment', value, analysisCode, methodologyId }] });
    return f;
}
test('an instrument made overdue at the transaction boundary rejects only its row, with zero row writes; the other row commits', async () => {
    const f = await fixture(), bad = await f.item(), good = await f.item(), badAsset = await f.asset(), goodAsset = await f.asset();
    await f.require('REQUIRED');
    const before = await prisma.workItem.findUnique({ where: { id: bad.workItemId } });
    const auditCount = await prisma.auditLog.count({ where: { sampleId: bad.sampleId } });
    const realTransaction = prisma.$transaction.bind(prisma);
    let injected = false;
    const transaction = jest.spyOn(prisma, '$transaction').mockImplementation(async (...args) => {
        if (!injected) { injected = true; await prisma.equipmentQualification.update({ where: { equipmentId: badAsset.id },
            data: { nextCalibrationDueDate: new Date(Date.now() - 86400000) } }); }
        return realTransaction(...args);
    });
    let response;
    try { response = await f.save([{ ...bad, equipmentId: badAsset.id }, { ...good, equipmentId: goodAsset.id }]); }
    finally { transaction.mockRestore(); }
    expect(injected).toBe(true);
    expect(response.status).toBe(200); expect(response.body.saved).toBe(1);
    expect(response.body.errors).toEqual([expect.objectContaining({ workItemId: bad.workItemId, code: 'EQUIPMENT_NOT_READY' })]);
    expect(await prisma.workItem.findUnique({ where: { id: bad.workItemId } })).toEqual(before);
    expect(await prisma.result.count({ where: { sampleId: bad.sampleId } })).toBe(0);
    expect(await prisma.workAttempt.count({ where: { workItemId: bad.workItemId } })).toBe(0);
    expect(await prisma.workItemEquipmentUse.count({ where: { workItemId: bad.workItemId } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { sampleId: bad.sampleId } })).toBe(auditCount);
    const result = await prisma.result.findFirst({ where: { sampleId: good.sampleId } });
    expect(result.equipmentId).toBe(goodAsset.id);
    expect(JSON.parse(result.equipmentReadiness)).toMatchObject({ equipmentId: goodAsset.id, assetStatus: 'IN_SERVICE',
        readiness: 'READY', criticality: 'CRITICAL', requirement: 'REQUIRED' });
    expect(new Date(JSON.parse(result.equipmentReadiness).calibrationDueDate).getTime()).toBeGreaterThan(Date.now());
    expect(Number.isFinite(new Date(JSON.parse(result.equipmentReadiness).evaluatedAt).getTime())).toBe(true);
});
test('a required missing instrument and an unconfigured critical instrument refuse EQUIPMENT_NOT_READY; lab ALLOW permits only unconfigured evidence', async () => {
    const f = await fixture(), item = await f.item(), asset = await f.asset('CRITICAL', false);
    await f.require('REQUIRED');
    for (const entry of [item, { ...item, equipmentId: asset.id }]) {
        const response = await f.save([entry]);
        expect(response.body.saved).toBe(0);
        expect(response.body.errors[0].code).toBe('EQUIPMENT_NOT_READY');
        expect(await prisma.result.count({ where: { sampleId: item.sampleId } })).toBe(0);
    }
    await policyService.change(f.actor, f.labId, { reason: 'Reviewed criticality configuration', changes: [{ key: 'equipment.unconfiguredReadiness',
        value: { CRITICAL: 'ALLOW', IMPORTANT: 'WARN', NON_CRITICAL: 'ALLOW' } }] });
    expect((await f.save([{ ...item, equipmentId: asset.id }])).body.saved).toBe(1);
    expect(JSON.parse((await prisma.result.findFirst({ where: { sampleId: item.sampleId } })).equipmentReadiness))
        .toMatchObject({ equipmentId: asset.id, calibrationDueDate: null, requirement: 'REQUIRED', readiness: 'READY' });
});
test('AUTO chooses method-specific eligibility over the fallback and explicit NOT_REQUIRED overrides the mapping', async () => {
    const f = await fixture(), method = await prisma.methodology.create({ data: { id: randomUUID(), analysisCode: f.analysis, name: 'Owned specific method' } });
    await prisma.equipmentMethodEligibility.create({ data: { id: randomUUID(), labId: f.labId, analysisCode: f.analysis, isRequired: true } });
    const specific = await prisma.equipmentMethodEligibility.create({ data: { id: randomUUID(), labId: f.labId, analysisCode: f.analysis, methodId: method.id, isRequired: false } });
    expect(await resolveEquipmentRequirement(prisma, { analysis: f.analysis, methodologyId: method.id }, f.labId))
        .toMatchObject({ isRequired: false, mappingId: specific.id, requirement: 'AUTO' });
    expect((await resolveEquipmentRequirement(prisma, { analysis: f.analysis }, f.labId)).isRequired).toBe(true);
    await f.require('NOT_REQUIRED', f.analysis, method.id);
    expect((await resolveEquipmentRequirement(prisma, { analysis: f.analysis, methodologyId: method.id }, f.labId)).isRequired).toBe(false);
    const item = await f.item(); await f.require('NOT_REQUIRED');
    expect((await f.save([item])).body.saved).toBe(1);
    const result = await prisma.result.findFirst({ where: { sampleId: item.sampleId } });
    expect(result.equipmentId).toBeNull(); expect(result.equipmentReadiness).toBeNull();
});
test('texture results and the new existing-path attempt store exactly the same snapshot', async () => {
    const f = await fixture(), item = await f.item('TEXTURE'), asset = await f.asset();
    await f.require('REQUIRED', 'TEXTURE');
    const response = await f.save([{ ...item, value: undefined, values: { sand: 50, silt: 35, clay: 15 }, equipmentId: asset.id }]);
    expect(response.status).toBe(200); expect(response.body.saved).toBe(1);
    const attempt = await prisma.workAttempt.findFirst({ where: { workItemId: item.workItemId } });
    const results = await prisma.result.findMany({ where: { sampleId: item.sampleId, attemptId: attempt.id } });
    expect(results).toHaveLength(4);
    const evidence = JSON.parse(attempt.evidenceData).equipmentReadiness;
    expect(evidence.equipmentId).toBe(asset.id);
    for (const result of results) expect(JSON.parse(result.equipmentReadiness)).toEqual(evidence);
    expect(attempt.attemptNo).toBe(1);
});
test('raw database updates cannot change equipment evidence while ordinary result metadata updates remain valid', async () => {
    const f = await fixture(), item = await f.item(), asset = await f.asset();
    expect((await f.save([{ ...item, equipmentId: asset.id }])).body.saved).toBe(1);
    const result = await prisma.result.findFirst({ where: { sampleId: item.sampleId } });
    await expect(prisma.$executeRawUnsafe('UPDATE "Result" SET equipmentReadiness=? WHERE id=?', '{}', result.id))
        .rejects.toThrow('RESULT_EQUIPMENT_READINESS_IMMUTABLE');
    await prisma.result.update({ where: { id: result.id }, data: { isCurrent: false, flags: '["FIXTURE_REVIEW"]', isValid: false } });
    expect((await prisma.result.findUnique({ where: { id: result.id } })).equipmentReadiness).toBe(result.equipmentReadiness);
});
test('a superseding Result gets a fresh snapshot and leaves the original equipment evidence unchanged', async () => {
    const f = await fixture(), item = await f.item(), firstAsset = await f.asset(), nextAsset = await f.asset();
    const { writeResult } = require('../../services/resultWriteService');
    const write = equipmentId => prisma.$transaction(tx => writeResult(tx, { sampleId: item.sampleId, workItemId: item.workItemId,
        actor: f.actor, measurement: { param: f.analysis, value: '6.2', equipmentId } }));
    const first = await write(firstAsset.id), next = await write(nextAsset.id);
    const old = await prisma.result.findUnique({ where: { id: first.id } });
    expect(old).toMatchObject({ isCurrent: false, supersededBy: next.id, equipmentReadiness: first.equipmentReadiness });
    expect(JSON.parse(first.equipmentReadiness).equipmentId).toBe(firstAsset.id);
    expect(JSON.parse(next.equipmentReadiness).equipmentId).toBe(nextAsset.id);
});
