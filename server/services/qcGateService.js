const { randomUUID } = require('node:crypto');
const policy = require('./policyService');
const { currentAnalyteEvidence, QC_RUN_INCLUDE } = require('./qcRunViewService');
const { runAnalyteCode } = require('./analysisCodesService');
const { isNonMeasurement } = require('./resultEntryPolicy');

const MODES = ['OFF', 'ADVISORY', 'REQUIRED_WARN', 'REQUIRED_BLOCKING'];
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const failure = (code, items) => Object.assign(new Error(code), { statusCode: 409, code, details: { items } });

function decision(gate, { acknowledgement, publication = false } = {}) {
    const reason = acknowledgement?.reason;
    const acknowledged = typeof reason === 'string' && Boolean(reason.trim());
    let code = null, acknowledgementRequired = gate.acknowledgementRequired === true;
    if (gate.value === 'REPEAT') code = 'QC_GATE_REPEAT_ORDERED';
    else if (!MODES.includes(gate.mode) || gate.error) code = 'QC_GATE_NOT_EVALUATED';
    else if (!['ADVISORY', 'OFF'].includes(gate.mode)) {
        if (gate.value === 'WARN') acknowledgementRequired = true;
        else if (gate.value === 'FAIL' && !gate.acceptedWithDeviation) {
            if (gate.mode === 'REQUIRED_BLOCKING') code = 'QC_GATE_FAILED';
            else acknowledgementRequired = true;
        } else if (['NOT_EVALUATED', 'NO_BATCH'].includes(gate.value) && gate.required) {
            if (gate.mode === 'REQUIRED_BLOCKING') code = `QC_GATE_${gate.value}`;
            else acknowledgementRequired = true;
        }
    }
    if (!code && acknowledgementRequired && (!acknowledged || publication && !acknowledgement.auditLogId)) code = 'QC_ACKNOWLEDGEMENT_REQUIRED';
    return { allowed: !code, code, gate, acknowledgementRequired };
}

// The pure projection is shared by review/readiness and publication. The IO
// boundary supplies live requirements and the frozen mode, never batch status
// as a substitute for a current evaluation.
function gateFromEvidence(result, items, batches, { mode, modeSource = 'LIVE', required = true } = {}) {
    const { linkedBatchIds, governingItems } = require('./reportResultGovernance');
    const batchIds = linkedBatchIds(result, items), governing = governingItems(result, items);
    const base = { mode, modeSource, required, batchIds, evaluationId: null, dispositionId: null };
    if (!batchIds.length) return { ...base, value: 'NO_BATCH', contributions: [] };
    const contributions = batchIds.map(batchId => {
        const batch = batches.find(row => row.id === batchId);
        if (!batch) return { batchId, value: 'NOT_EVALUATED', error: 'BATCH_NOT_FOUND' };
        const code = runAnalyteCode(batch, governing.find(row => row.batchId === batchId)?.analysis || result.param);
        const analyte = batch.analytes?.find(row => row.analysisCode === code);
        if (!analyte) return { batchId, value: 'NOT_EVALUATED', error: 'QC_ANALYSIS_NOT_IN_RUN' };
        const evidence = currentAnalyteEvidence(batch, code), disposition = evidence.disposition;
        const identity = { batchId, analysisCode: code, evaluationId: evidence.evaluation?.id || null,
            dispositionId: disposition?.id || null, dispositionReason: disposition?.reason || null };
        const canonical = disposition?.canonicalDecision || disposition?.decision;
        if (['REPEAT_BATCH', 'REANALYZE_BATCH', 'REJECT', 'REJECT_BATCH'].includes(canonical) ||
            ['REPEAT_ORDERED', 'REJECTED'].includes(analyte.status)) return { ...identity, value: 'REPEAT' };
        if (canonical === 'REPEAT_BRACKET') {
            const scope = parse(disposition.scope);
            if (!scope || !Array.isArray(scope.affectedPositionIds) || !Array.isArray(scope.affectedWorkItemIds)) throw Error('QC bracket scope is unavailable');
            const affected = governing.some(row => scope.affectedWorkItemIds.includes(row.id)) ||
                evidence.positions.some(position => scope.affectedPositionIds.includes(position.id) && position.sampleId === result.sampleId);
            return { ...identity, value: affected ? 'REPEAT' : 'PASS', calibrationBracketRepeat: {
                batchId, failedPositionIds: scope.failedPositionIds } };
        }
        if (!evidence.result || !evidence.evaluation || !['PASS', 'WARN', 'FAIL', 'NOT_REQUIRED'].includes(evidence.result)) return { ...identity, value: 'NOT_EVALUATED' };
        return { ...identity, value: evidence.result === 'NOT_REQUIRED' ? 'PASS' : evidence.result,
            notRequired: evidence.result === 'NOT_REQUIRED',
            acceptedWithDeviation: ['ACCEPT_WITH_DEVIATION', 'PROCEED_WITH_WARNING'].includes(canonical) };
    });
    const rank = ['PASS', 'NO_BATCH', 'NOT_EVALUATED', 'WARN', 'FAIL', 'REPEAT'];
    // An incomplete required run remains a blocker even beside a WARN/accepted
    // deviation. Decide each contribution before combining their presentation.
    const refused = contributions.find(row => !decision({ ...base, ...row }).allowed &&
        decision({ ...base, ...row }).code !== 'QC_ACKNOWLEDGEMENT_REQUIRED');
    const selected = contributions.find(row => row.value === 'REPEAT') || refused ||
        contributions.reduce((a, b) => rank.indexOf(b.value) > rank.indexOf(a.value) ? b : a);
    return { ...base, ...selected, batchIds, contributions,
        acknowledgementRequired: contributions.some(row => decision({ ...base, ...row }).acknowledgementRequired) };
}

async function requirement(item, sample, db) {
    if (isNonMeasurement(item)) return false;
    const labId = sample.assignedLab || sample.labId || item.assignedLab;
    const context = { analysisCode: item.analysis, methodologyId: item.methodologyId || null, db };
    const value = await policy.get(labId, 'qc.requireBatchQc', context);
    if (value === 'REQUIRED') return true;
    if (value === 'NOT_REQUIRED') return false;
    if (value !== 'AUTO') throw Error('Invalid QC requirement policy');
    const rule = await require('./qcRuleService').resolve(labId, item.analysis, context);
    return ['blankPerBatch', 'duplicateEvery', 'lrmPerBatch', 'crmEveryNBatches'].some(key => rule.resolved[key].value > 0) ||
        await policy.get(labId, 'qc.calibrationVerification', context) && rule.resolved.ccvEvery.value > 0;
}

async function forResult(result, options = {}) {
    const db = options.db || require('../prisma');
    if (!options.db) return db.$transaction(tx => forResult(result, { ...options, db: tx }));
    try {
        const sample = options.sample || await db.sample.findUnique({ where: { id: String(result.sampleId) } });
        if (!sample) throw Error('Sample not found');
        const items = options.workItems || await db.workItem.findMany({ where: { sampleId: String(result.sampleId) } });
        const { governingItems, linkedBatchIds } = require('./reportResultGovernance');
        const governing = governingItems(result, items);
        const ids = linkedBatchIds(result, items);
        const batches = options.qcBatches || (ids.length ? await db.batch.findMany({ where: { id: { in: ids } }, include: QC_RUN_INCLUDE }) : []);
        const contributions = [];
        for (const id of ids.length ? ids : [null]) {
            const batch = batches.find(row => row.id === id);
            const item = governing.find(row => row.batchId === id) || governing[0] || { analysis: result.param, methodologyId: result.methodologyId };
            const code = batch ? runAnalyteCode(batch, item.analysis) : item.analysis;
            const analyte = batch?.analytes?.find(row => row.analysisCode === code);
            let mode, source = 'LIVE';
            if (analyte?.provenance === 'NATIVE' && batch.startedAt) {
                mode = parse(analyte.criteriaSnapshot)?.qcMode; source = 'FROZEN';
            } else mode = await policy.get(sample.assignedLab || sample.labId, 'qc.mode', {
                analysisCode: item.analysis, methodologyId: result.methodologyId || item.methodologyId || null, db });
            if (!MODES.includes(mode)) throw Error('QC mode unavailable');
            contributions.push({ batchId: id, mode, source });
        }
        const effective = contributions.reduce((a, b) => MODES.indexOf(b.mode) > MODES.indexOf(a.mode) ? b : a);
        const required = (await Promise.all((governing.length ? governing : [{ analysis: result.param, methodologyId: result.methodologyId }])
            .map(item => requirement(item, sample, db)))).some(Boolean);
        return gateFromEvidence(result, items, batches, { required, mode: effective.mode,
            modeSource: contributions.some(row => row.mode === effective.mode && row.source === 'FROZEN') ? 'FROZEN' : 'LIVE' });
    } catch (error) {
        return { value: 'NOT_EVALUATED', mode: policy.getStrict('qc.mode'), modeSource: 'ERROR', required: true,
            batchIds: result.batchId ? [result.batchId] : [], evaluationId: null, dispositionId: null,
            error: error.code || 'QC_GATE_READ_FAILED' };
    }
}

async function forWorkItem(item, db) {
    const sample = item.sample || await db.sample.findUnique({ where: { id: String(item.sampleId) } });
    if (isNonMeasurement(item)) return [];
    const results = (await db.result.findMany({ where: { sampleId: String(item.sampleId), isCurrent: true } }))
        .filter(result => require('./reportResultGovernance').governsResult(item, result));
    const candidates = results.length ? results : [{ sampleId: item.sampleId, param: item.analysis, batchId: item.batchId, methodologyId: item.methodologyId }];
    const workItems = await db.workItem.findMany({ where: { sampleId: String(item.sampleId) } });
    return Promise.all(candidates.map(async result => ({ workItemId: item.id, ...(result.id && { resultId: result.id }),
        gate: await forResult(result, { sample, workItems, db }) })));
}

async function requireAcceptance(items, acknowledgement, db) {
    const rows = (await Promise.all(items.map(item => forWorkItem(item, db)))).flat();
    const refused = rows.map(row => ({ ...row, ...decision(row.gate, { acknowledgement }) })).filter(row => !row.allowed);
    if (refused.length) throw failure(refused[0].code, refused.map(({ workItemId, resultId, gate }) => ({ workItemId, resultId, gate })));
    return rows;
}

async function recordAcknowledgements(rows, acknowledgement, actor, tx, now = new Date()) {
    const records = [];
    for (const row of rows.filter(row => decision(row.gate).acknowledgementRequired)) {
        const reason = acknowledgement?.reason?.trim();
        if (!reason) throw failure('QC_ACKNOWLEDGEMENT_REQUIRED', [row]);
        const id = randomUUID(), details = { workItemId: row.workItemId, resultId: row.resultId || null,
            reason, gate: row.gate, actor: actor.username, at: now.toISOString() };
        await tx.auditLog.create({ data: { id, entity: row.resultId ? 'RESULT' : 'WORK_ITEM', entityId: row.resultId || row.workItemId,
            action: 'QC_GATE_ACKNOWLEDGED', details: JSON.stringify(details), performedBy: actor.username, timestamp: now } });
        records.push({ ...details, auditLogId: id });
    }
    return records;
}

function evidenceKey(gate) {
    return JSON.stringify({ value: gate.value, mode: gate.mode, modeSource: gate.modeSource,
        batchIds: [...gate.batchIds].sort(), evaluationId: gate.evaluationId, dispositionId: gate.dispositionId,
        contributions: (gate.contributions || []).map(row => ({ batchId: row.batchId, value: row.value,
            evaluationId: row.evaluationId, dispositionId: row.dispositionId })).sort((a, b) => a.batchId.localeCompare(b.batchId)) });
}

async function resolveForSample(sample, batches, db) {
    const qcGates = {}, qcAcknowledgements = {};
    const results = (sample.results || []).filter(row => row.isCurrent &&
        !isNonMeasurement({ analysis: row.param }));
    const audits = results.length ? await db.auditLog.findMany({ where: { entity: 'RESULT',
        entityId: { in: results.map(row => row.id) }, action: 'QC_GATE_ACKNOWLEDGED' }, orderBy: { timestamp: 'desc' } }) : [];
    for (const result of results) {
        const gate = await forResult(result, { sample, qcBatches: batches, workItems: sample.workItems || [], db });
        qcGates[result.id] = gate;
        for (const audit of audits.filter(row => row.entityId === result.id)) {
            let record;
            try {
                record = parse(audit.details);
                if (record?.resultId === result.id && typeof record.reason === 'string' && record.reason.trim() &&
                    record.actor === audit.performedBy && new Date(record.at).getTime() === new Date(audit.timestamp).getTime() &&
                    record.gate && evidenceKey(record.gate) === evidenceKey(gate)) {
                    qcAcknowledgements[result.id] = { ...record, auditLogId: audit.id }; break;
                }
            } catch (_) { /* Malformed or stale audit evidence cannot authorize publication. */ }
        }
    }
    return { qcGates, qcAcknowledgements };
}

module.exports = { forResult, gateFromEvidence, decision, forWorkItem, requireAcceptance, recordAcknowledgements, resolveForSample };
