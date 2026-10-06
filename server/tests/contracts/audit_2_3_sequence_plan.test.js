const { randomUUID } = require('node:crypto');
const prisma = require('../../prisma');
const policies = require('../../services/policyService');
const rules = require('../../services/qcRuleService');
const { planSequence, planRunSequence, resolveSequenceCriteria, DUPLICATE_ALGORITHM } = require('../../services/batchSequenceService');
const actor = { username: 'system:fixture', role: 'SUPER_ADMIN' };

async function fixture(criteria = {}) {
    const labId = randomUUID(), analysisCode = `OC-SEQUENCE-${randomUUID()}`;
    await prisma.lab.create({ data: { id: labId, code: labId, name: 'Run sequence fixture', country: 'GTM' } });
    await prisma.analysis.create({ data: { code: analysisCode, name: 'Organic carbon sequence fixture' } });
    const method = await prisma.methodology.create({ data: { analysisCode, name: 'Recorded carbon method' } });
    const target = { labId, analysisCode, methodologyId: method.id };
    if (Object.keys(criteria).length) await rules.change(actor, { ...target, criteria, expectedVersion: 0,
        reason: 'Set reviewed run criteria' }, { db: prisma });
    return { ...target, criteria: await resolveSequenceCriteria(labId, analysisCode, method.id, prisma) };
}
const sampleIds = count => Array.from({ length: count }, (_, i) => `physical-sample-${i + 1}`);
const countKind = (plan, kind) => plan.positions.filter(row => row.kind === kind).length;

test('23-sample plan uses method capacity and default frequencies with real sample parents and contiguous positions', async () => {
    const f = await fixture({ maxBatchSize: 23, crmEveryNBatches: 0 });
    const plan = planSequence({ criteria: f.criteria, sampleIds: sampleIds(23), crmOrdinal: 1, seed: 'recorded-seed' });
    expect(countKind(plan, 'SAMPLE')).toBe(23);
    expect(countKind(plan, 'BLANK')).toBe(1);
    expect(countKind(plan, 'LRM')).toBe(1);
    expect(countKind(plan, 'DUPLICATE')).toBe(3);
    expect(plan.positions.map(row => row.position)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
    expect(plan.positions.every(row => row.referenceMaterialId === null)).toBe(true);
    for (const duplicate of plan.positions.filter(row => row.kind === 'DUPLICATE')) {
        const parent = plan.positions.find(row => row.id === duplicate.duplicateOfPositionId);
        expect(parent).toMatchObject({ kind: 'SAMPLE', sampleId: duplicate.sampleId });
        expect(parent.position).toBeLessThan(duplicate.position);
    }
    expect(plan.forecast.qcRule.resolved.maxBatchSize).toMatchObject({ value: 23, source: 'QC_RULE' });
    expect(plan.duplicateSelection.picks).toHaveLength(3);
    expect(plan.duplicateSelection.picks.every(id => sampleIds(23).includes(id))).toBe(true);
});

test('default capacity refuses 23 without writing a run, measurement or audit', async () => {
    const f = await fixture(), before = { batches: await prisma.batch.count(), audit: await prisma.auditLog.count() };
    expect(() => planSequence({ criteria: f.criteria, sampleIds: sampleIds(23), crmOrdinal: 1 })).toThrow(expect.objectContaining({
        statusCode: 422, code: 'QC_BATCH_TOO_LARGE', details: { analysisCode: f.analysisCode, maxBatchSize: 20, requested: 23 } }));
    expect(await prisma.batch.count()).toBe(before.batches);
    expect(await prisma.auditLog.count()).toBe(before.audit);
});

test('replaying the recorded seed and algorithm reproduces parents including a partial final group', async () => {
    const f = await fixture({ maxBatchSize: 23, crmEveryNBatches: 0 });
    const input = { criteria: f.criteria, sampleIds: sampleIds(23), crmOrdinal: 1, seed: 'replay-me' };
    const first = planSequence(input), replay = planSequence(input);
    expect(replay.duplicateSelection).toEqual(first.duplicateSelection);
    expect(first.duplicateSelection.algorithm).toBe(DUPLICATE_ALGORITHM);
    // UUIDs are deliberately new; repeatability is about the selected samples.
    expect(first.positions[0].id).not.toBe(replay.positions[0].id);
});

test('CRM planning uses the supplied forecast without consuming an ordinal or modifying a batch', async () => {
    const f = await fixture({ crmEveryNBatches: 2 }), before = await prisma.batch.count();
    const input = { criteria: f.criteria, sampleIds: sampleIds(3), seed: 'crm-forecast' };
    expect(countKind(planSequence({ ...input, crmOrdinal: 1 }), 'CRM')).toBe(1);
    expect(countKind(planSequence({ ...input, crmOrdinal: 2 }), 'CRM')).toBe(0);
    expect(countKind(planSequence({ ...input, crmOrdinal: 3 }), 'CRM')).toBe(1);
    expect(await prisma.batch.count()).toBe(before);
});

test('calibration positions are opt-in and intervals count samples rather than QC positions', async () => {
    const f = await fixture({ maxBatchSize: 23, crmEveryNBatches: 0 });
    const input = { sampleIds: sampleIds(23), crmOrdinal: 1, seed: 'instrumental-sequence' };
    expect(planSequence({ ...input, criteria: f.criteria }).positions.some(row => ['ICV', 'CCV', 'CCB'].includes(row.kind))).toBe(false);
    await policies.change(actor, f.labId, { reason: 'Enable recorded instrument checks', changes: [
        { key: 'qc.calibrationVerification', value: true, analysisCode: f.analysisCode, methodologyId: f.methodologyId } ] });
    const plan = planSequence({ ...input, criteria: await resolveSequenceCriteria(f.labId, f.analysisCode, f.methodologyId, prisma) });
    expect(plan.positions.slice(0, 2).map(row => row.kind)).toEqual(['ICV', 'CCB']);
    expect(plan.positions.slice(-2).map(row => row.kind)).toEqual(['CCV', 'CCB']);
    expect(countKind(plan, 'CCV')).toBe(3);
    expect(countKind(plan, 'CCB')).toBe(4);
    const ccvSamples = plan.positions.filter(row => row.kind === 'CCV').map(ccv =>
        plan.positions.filter(row => row.kind === 'SAMPLE' && row.position < ccv.position).length);
    expect(ccvSamples).toEqual([10, 20, 23]);
});

test('OFF inserts only samples even with configured frequencies and calibration enabled', async () => {
    const f = await fixture();
    await policies.change(actor, f.labId, { reason: 'Choose lab mode', changes: [
        { key: 'qc.mode', value: 'OFF' }, { key: 'qc.calibrationVerification', value: true } ] });
    const criteria = await resolveSequenceCriteria(f.labId, f.analysisCode, f.methodologyId, prisma);
    const plan = planSequence({ criteria, sampleIds: sampleIds(3), crmOrdinal: 1 });
    expect(plan.positions.map(row => row.kind)).toEqual(['SAMPLE', 'SAMPLE', 'SAMPLE']);
});

test('lab and method frequencies differ without changing the other laboratory default', async () => {
    const f = await fixture(), other = await fixture();
    await policies.change(actor, f.labId, { reason: 'Method-specific sequence', changes: [
        { key: 'qc.duplicateEvery', value: 3, analysisCode: f.analysisCode, methodologyId: f.methodologyId },
        { key: 'qc.blankPerBatch', value: 2, analysisCode: f.analysisCode, methodologyId: f.methodologyId } ] });
    const plan = criteria => planSequence({ criteria, sampleIds: sampleIds(8), crmOrdinal: 2 });
    const changed = plan(await resolveSequenceCriteria(f.labId, f.analysisCode, f.methodologyId, prisma));
    expect(countKind(changed, 'BLANK')).toBe(2);
    expect(countKind(changed, 'DUPLICATE')).toBe(3);
    const unchanged = plan(await resolveSequenceCriteria(other.labId, other.analysisCode, other.methodologyId, prisma));
    expect(countKind(unchanged, 'BLANK')).toBe(1);
    expect(countKind(unchanged, 'DUPLICATE')).toBe(1);
});

test('mixed A-only, B-only and shared samples meet each analyte need with real shared duplicate parents', async () => {
    const a = await fixture({ duplicateEvery: 10, crmEveryNBatches: 0 }), b = await fixture({ duplicateEvery: 5, crmEveryNBatches: 0 });
    const samples = [
        ...sampleIds(10).map(sampleId => ({ sampleId: `A-${sampleId}`, analysisCodes: [a.analysisCode] })),
        ...sampleIds(10).map(sampleId => ({ sampleId: `B-${sampleId}`, analysisCodes: [b.analysisCode] })),
        ...sampleIds(5).map(sampleId => ({ sampleId: `AB-${sampleId}`, analysisCodes: [a.analysisCode, b.analysisCode] })) ];
    const input = { samples, analyses: [{ ...a.criteria, crmOrdinal: 2 }, { ...b.criteria, crmOrdinal: 2 }], seed: 'mixed-cohort' };
    const plan = planRunSequence(input);
    expect(countKind(plan, 'SAMPLE')).toBe(25);
    expect(plan.forecasts.map(row => row.sampleCount)).toEqual([15, 15]);
    expect(countKind(plan, 'DUPLICATE')).toBe(3);
    const duplicates = plan.positions.filter(row => row.kind === 'DUPLICATE');
    expect(duplicates.filter(row => row.servedAnalytes.includes(a.analysisCode)).length).toBeGreaterThanOrEqual(2);
    expect(duplicates.filter(row => row.servedAnalytes.includes(b.analysisCode))).toHaveLength(3);
    for (const row of duplicates) {
        const parent = plan.positions.find(position => position.id === row.duplicateOfPositionId);
        expect(row.servedAnalytes).toEqual(parent.servedAnalytes);
        expect(row.sampleId).toBe(parent.sampleId);
        expect(row.servedAnalytes).toEqual(samples.find(sample => sample.sampleId === parent.sampleId).analysisCodes);
    }
    expect(planRunSequence(input).duplicateSelection).toEqual(plan.duplicateSelection);
});

test('calibration pairs use the union of each analyte sample boundaries and share coincident boundaries', async () => {
    const a = await fixture({ maxBatchSize: 30, ccvEvery: 10 }), b = await fixture({ maxBatchSize: 30, ccvEvery: 4 });
    for (const f of [a, b]) {
        await policies.change(actor, f.labId, { reason: 'Enable instrument checks', changes: [{ key: 'qc.calibrationVerification', value: true }] });
        f.criteria = await resolveSequenceCriteria(f.labId, f.analysisCode, f.methodologyId, prisma);
    }
    const samples = sampleIds(30).map(sampleId => ({ sampleId, analysisCodes: [a.analysisCode, b.analysisCode] }));
    const plan = planRunSequence({ samples, analyses: [{ ...a.criteria, crmOrdinal: 2 }, { ...b.criteria, crmOrdinal: 2 }] });
    const boundaries = plan.positions.filter(row => row.kind === 'CCV').map(row =>
        plan.positions.filter(position => position.kind === 'SAMPLE' && position.position < row.position).length);
    expect(boundaries).toEqual([4, 8, 10, 12, 16, 20, 24, 28, 30]);
    expect(new Set(boundaries).size).toBe(boundaries.length);
    for (const row of plan.positions.filter(position => position.kind === 'CCV')) {
        expect(plan.positions[row.position]).toMatchObject({ kind: 'CCB', servedAnalytes: row.servedAnalytes });
    }
    for (const every of [10, 4]) {
        const includingStart = [0, ...boundaries];
        expect(includingStart.slice(1).every((boundary, i) => boundary - includingStart[i] <= every)).toBe(true);
    }
});

test('one analyte over its own capacity refuses the mixed sequence without writing a batch or audit', async () => {
    const a = await fixture({ maxBatchSize: 12 }), b = await fixture({ maxBatchSize: 20 });
    const before = { batches: await prisma.batch.count(), audit: await prisma.auditLog.count() };
    const samples = sampleIds(15).map(sampleId => ({ sampleId, analysisCodes: [a.analysisCode, b.analysisCode] }));
    expect(() => planRunSequence({ samples, analyses: [{ ...a.criteria, crmOrdinal: 1 }, { ...b.criteria, crmOrdinal: 1 }] }))
        .toThrow(expect.objectContaining({ statusCode: 422, code: 'QC_BATCH_TOO_LARGE',
            details: { analysisCode: a.analysisCode, maxBatchSize: 12, requested: 15 } }));
    expect(await prisma.batch.count()).toBe(before.batches);
    expect(await prisma.auditLog.count()).toBe(before.audit);
});

test('mixed-sample calibration counts only the samples carrying that analyte', async () => {
    const a = await fixture({ ccvEvery: 10 }), b = await fixture({ ccvEvery: 4 });
    for (const f of [a, b]) {
        await policies.change(actor, f.labId, { reason: 'Enable instrument checks', changes: [{ key: 'qc.calibrationVerification', value: true }] });
        f.criteria = await resolveSequenceCriteria(f.labId, f.analysisCode, f.methodologyId, prisma);
    }
    const samples = [
        ...sampleIds(10).map(sampleId => ({ sampleId: `A-${sampleId}`, analysisCodes: [a.analysisCode] })),
        ...sampleIds(10).map(sampleId => ({ sampleId: `B-${sampleId}`, analysisCodes: [b.analysisCode] })),
        ...sampleIds(5).map(sampleId => ({ sampleId: `AB-${sampleId}`, analysisCodes: [a.analysisCode, b.analysisCode] })) ];
    const plan = planRunSequence({ samples, analyses: [{ ...a.criteria, crmOrdinal: 2 }, { ...b.criteria, crmOrdinal: 2 }] });
    const boundaries = plan.positions.filter(row => row.kind === 'CCV').map(ccv =>
        plan.positions.filter(row => row.kind === 'SAMPLE' && row.position < ccv.position).length);
    expect(boundaries).toEqual([10, 14, 18, 22, 25]);
    for (const [code, every] of [[a.analysisCode, 10], [b.analysisCode, 4]]) {
        let gap = 0;
        for (const row of plan.positions) {
            if (row.kind === 'SAMPLE' && row.servedAnalytes.includes(code)) gap++;
            expect(gap).toBeLessThanOrEqual(every);
            if (row.kind === 'CCV' && row.servedAnalytes.includes(code)) gap = 0;
        }
        expect(gap).toBe(0);
    }
});
