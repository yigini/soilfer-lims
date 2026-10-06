const { createHash, randomBytes, randomUUID } = require('node:crypto');
const policyService = require('./policyService');
const qcRuleService = require('./qcRuleService');

const DUPLICATE_ALGORITHM = 'sha256-unmet-analytes-v1';
function error(statusCode, code, details = {}) {
    return Object.assign(new Error(code), { statusCode, code, details });
}

// Forecast resolution is read-only. The caller records it in RUN_BUILT and
// resolves it again in the first-start transaction before freezing criteria.
async function resolveSequenceCriteria(labId, analysisCode, methodologyId, db) {
    if (!db) return require('../prisma').$transaction(tx => resolveSequenceCriteria(labId, analysisCode, methodologyId, tx));
    const policy = await policyService.snapshot(labId, { db, analysisCode, methodologyId });
    const qcRule = await qcRuleService.resolve(labId, analysisCode, { db, methodologyId, policySnapshot: policy });
    return { analysisCode, methodologyId, qcRule, policyVersion: policy.version, policySnapshot: policy,
        methodContext: await require('./qcMethodContextService').resolveLoq(analysisCode, methodologyId, db),
        numberFormat: await require('./numberFormatService').getNumberFormat(labId, { db, snapshot: policy }),
        qcMode: policy.values['qc.mode'], calibrationVerification: policy.values['qc.calibrationVerification'] };
}

function countsFor(criteria, sampleCount, crmOrdinal) {
    const value = field => criteria.qcRule.resolved[field].value;
    const maxBatchSize = value('maxBatchSize');
    if (maxBatchSize !== null && sampleCount > maxBatchSize) {
        throw error(422, 'QC_BATCH_TOO_LARGE', { analysisCode: criteria.analysisCode, maxBatchSize, requested: sampleCount });
    }
    const enabled = criteria.qcMode !== 'OFF';
    const duplicateEvery = enabled ? value('duplicateEvery') : 0;
    const crmEvery = enabled ? value('crmEveryNBatches') : 0;
    if (!Number.isSafeInteger(crmOrdinal) || crmOrdinal < 1) throw error(400, 'QC_SEQUENCE_ORDINAL_INVALID');
    return { blank: enabled ? value('blankPerBatch') : 0, lrm: enabled ? value('lrmPerBatch') : 0,
        duplicateEvery, duplicate: duplicateEvery > 0 ? Math.ceil(sampleCount / duplicateEvery) : 0,
        crm: crmEvery > 0 && (crmOrdinal - 1) % crmEvery === 0 ? 1 : 0,
        calibration: enabled && criteria.calibrationVerification, ccvEvery: value('ccvEvery') };
}

// A hash for each selection avoids runtime-specific PRNG implementations.
// The seed, algorithm version and selected sample ids are retained by the run.
function parentIndex(seed, step, size) {
    const bytes = createHash('sha256').update(JSON.stringify([DUPLICATE_ALGORITHM, seed, step])).digest();
    return Math.floor(bytes.readUInt32BE(0) / 0x100000000 * size);
}

// #186 part 6: each analyte retains its own sample set. Greedy coverage chooses
// the parent covering most unmet analytes; seeded tie-breaking is replayable.
function selectParents(samples, forecasts, seed) {
    const remaining = new Map(forecasts.map(row => [row.analysisCode, row.counts.duplicate]));
    const parents = [];
    while ([...remaining.values()].some(count => count > 0)) {
        const scores = samples.map(sample => ({ sample, score: sample.analysisCodes.filter(code => remaining.get(code) > 0).length }));
        const best = scores.reduce((maximum, row) => Math.max(maximum, row.score), 0);
        const eligible = scores.filter(row => row.score === best).map(row => row.sample);
        const parent = eligible[parentIndex(seed, parents.length, eligible.length)];
        parents.push(parent);
        parent.analysisCodes.forEach(code => remaining.set(code, Math.max(0, remaining.get(code) - 1)));
    }
    return parents;
}

// Read-only forecast: no lot selection, ordinal allocation or invented values.
function planRunSequence({ samples, analyses, seed = randomBytes(16).toString('hex') }) {
    if (!Array.isArray(analyses)) throw error(400, 'QC_SEQUENCE_ANALYSES_INVALID');
    const codes = analyses.map(row => row?.analysisCode);
    if (!codes.length || codes.some(code => typeof code !== 'string' || !code) || new Set(codes).size !== codes.length) {
        throw error(400, 'QC_SEQUENCE_ANALYSES_INVALID');
    }
    if (!Array.isArray(samples) || !samples.length || samples.some(row => typeof row?.sampleId !== 'string' || !row.sampleId ||
        !Array.isArray(row.analysisCodes) || !row.analysisCodes.length || new Set(row.analysisCodes).size !== row.analysisCodes.length ||
        row.analysisCodes.some(code => !codes.includes(code))) || new Set(samples.map(row => row.sampleId)).size !== samples.length) {
        throw error(400, 'QC_SEQUENCE_SAMPLES_INVALID');
    }
    if (typeof seed !== 'string' || !seed) throw error(400, 'QC_SEQUENCE_SEED_INVALID');
    const forecasts = analyses.map(criteria => {
        const sampleCount = samples.filter(row => row.analysisCodes.includes(criteria.analysisCode)).length;
        if (!sampleCount) throw error(400, 'QC_SEQUENCE_ANALYSES_INVALID');
        return { ...criteria, sampleCount, counts: countsFor(criteria, sampleCount, criteria.crmOrdinal) };
    });
    const parents = selectParents(samples, forecasts, seed), positions = [], recordedParents = [];
    const calibrationCodes = forecasts.filter(row => row.counts.calibration).map(row => row.analysisCode);
    const boundaries = new Set();
    for (const row of forecasts.filter(row => row.counts.calibration && row.counts.ccvEvery > 0)) {
        let count = 0;
        samples.forEach((sample, index) => {
            if (sample.analysisCodes.includes(row.analysisCode) && ++count % row.counts.ccvEvery === 0) boundaries.add(index);
        });
    }
    const add = (kind, data = {}) => {
        const row = { id: randomUUID(), position: positions.length + 1, kind, sampleId: null,
            duplicateOfPositionId: null, referenceMaterialId: null, servedAnalytes: [], ...data };
        positions.push(row);
        return row;
    };
    const calibrationPair = () => { add('CCV', { servedAnalytes: calibrationCodes }); add('CCB', { servedAnalytes: calibrationCodes }); };
    if (calibrationCodes.length) { add('ICV', { servedAnalytes: calibrationCodes }); add('CCB', { servedAnalytes: calibrationCodes }); }
    for (const [field, kind] of [['blank', 'BLANK'], ['lrm', 'LRM']]) {
        const required = forecasts.reduce((maximum, row) => Math.max(maximum, row.counts[field]), 0);
        const servedAnalytes = forecasts.filter(row => row.counts[field] > 0).map(row => row.analysisCode);
        for (let i = 0; i < required; i++) add(kind, { servedAnalytes });
    }
    for (const [index, source] of samples.entries()) {
        const sample = add('SAMPLE', { sampleId: source.sampleId, servedAnalytes: source.analysisCodes });
        for (const parent of parents.filter(row => row.sampleId === source.sampleId)) {
            const duplicate = add('DUPLICATE', { sampleId: parent.sampleId, duplicateOfPositionId: sample.id, servedAnalytes: parent.analysisCodes });
            recordedParents.push({ position: duplicate.position, parentSampleId: parent.sampleId, servedAnalytes: parent.analysisCodes });
        }
        // Counts physical samples, including no QC positions in the interval.
        // The final boundary is served by the closing pair after the CRM.
        if (boundaries.has(index) && index < samples.length - 1) calibrationPair();
    }
    const crmCodes = forecasts.filter(row => row.counts.crm > 0).map(row => row.analysisCode);
    if (crmCodes.length) add('CRM', { servedAnalytes: crmCodes });
    if (calibrationCodes.length) calibrationPair();
    return { positions, duplicateSelection: { seed, algorithm: DUPLICATE_ALGORITHM, parents: recordedParents,
        picks: parents.map(row => row.sampleId) }, forecasts: forecasts.map(({ counts, ...criteria }) => ({ ...criteria, crmDue: counts.crm > 0 })) };
}

function planSequence({ sampleIds, criteria, crmOrdinal, seed }) {
    if (!Array.isArray(sampleIds)) throw error(400, 'QC_SEQUENCE_SAMPLES_INVALID');
    const plan = planRunSequence({ samples: sampleIds.map(sampleId => ({ sampleId, analysisCodes: [criteria.analysisCode] })),
        analyses: [{ ...criteria, crmOrdinal }], seed });
    return { ...plan, forecast: plan.forecasts[0] };
}

module.exports = { resolveSequenceCriteria, planSequence, planRunSequence, sequenceRequirements: countsFor, DUPLICATE_ALGORITHM };
