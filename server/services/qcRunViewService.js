const scopeGuard = require('../utils/scopeGuard');
const policyService = require('./policyService');
const { runAnalyteCode } = require('./analysisCodesService');
const WORK_ITEM_SELECT = { id: true, sampleId: true, analysis: true, status: true, rackPosition: true, batchId: true,
    methodologyId: true, sample: { select: { id: true, originalId: true, labId: true, assignedLab: true } } };
const QC_RUN_INCLUDE = {
    analytes: true, positions: { include: { workItems: { include: { workItem: { select: WORK_ITEM_SELECT } } }, references: true }, orderBy: { position: 'asc' } },
    measurements: true, evaluations: { orderBy: [{ analysisCode: 'asc' }, { version: 'asc' }] },
    dispositions: true, events: true,
    workItems: { select: WORK_ITEM_SELECT, orderBy: { rackPosition: 'asc' } }
};
function parsed(value, fallback = null) {
    if (typeof value !== 'string') return value ?? fallback;
    try { return JSON.parse(value); } catch { return fallback; }
}
const time = value => value === null || value === undefined ? 0 : new Date(value).getTime() || 0;
const decisions = { ACCEPT_WITH_DEVIATION: 'PROCEED_WITH_WARNING', REPEAT_BATCH: 'REANALYZE_BATCH', REPEAT_BRACKET: 'REANALYZE_BATCH', REJECT: 'REJECT_BATCH' };

function latestEvaluation(batch, analysisCode) {
    return (batch.evaluations || []).filter(row => row.analysisCode === analysisCode).reduce((latest, row) => !latest || row.version > latest.version ? row : latest, null);
}
function activeReopenEvent(batch, analysisCode) {
    const evaluation = latestEvaluation(batch, analysisCode);
    return (batch.events || []).filter(row => row.type === 'REOPENED' &&
        parsed(row.payload, {}).previousEvaluationIds?.includes(evaluation?.id)).sort((a, b) => time(b.at) - time(a.at))[0] || null;
}
function currentDisposition(batch, evaluation, analysisCode) {
    const details = parsed(evaluation?.details, {});
    const latest = (batch.dispositions || []).filter(row => !row.analysisCode || row.analysisCode === analysisCode)
        .sort((a, b) => time(b.decidedAt) - time(a.decidedAt) || (b.id > a.id ? 1 : b.id < a.id ? -1 : 0))[0];
    if (!latest) return details.legacy ? parsed(details.disposition) : null;
    const reopen = (batch.events || []).filter(row => {
        const payload = parsed(row.payload, {});
        return row.type === 'REOPENED' && (Array.isArray(payload.analysisCodes) ? payload.analysisCodes.includes(analysisCode)
            : !payload.analysisCode || payload.analysisCode === analysisCode);
    }).sort((a, b) => time(b.at) - time(a.at))[0];
    if (reopen && time(reopen.at) >= time(latest.decidedAt)) return null;
    return { id: latest.id, scope: parsed(latest.scope), decision: decisions[latest.decision] || latest.decision, canonicalDecision: latest.decision,
        reason: latest.reason, by: latest.decidedBy, at: latest.decidedAt, analysisCode: latest.analysisCode };
}
function currentAnalyteEvidence(batch, analysisCode = batch.analysis) {
    const evaluation = latestEvaluation(batch, analysisCode), details = parsed(evaluation?.details, {});
    const isolatedRound = details.legacy === true || details.entryMode === 'LEGACY_RESUBMISSION' || details.entryMode === 'CORRECTION' && details.compatibility === true;
    const reopenEvent = activeReopenEvent(batch, analysisCode);
    const hiddenRound = isolatedRound && parsed(reopenEvent?.payload, {}).discardCurrentEvidence;
    const currentVerdict = reopenEvent ? null : evaluation?.verdict ?? null;
    const selectedPositions = new Set(hiddenRound ? [] : details.positionIds || []), selectedMeasurements = new Set(hiddenRound ? [] : details.measurementIds || []);
    const built = (batch.events || []).filter(row => ['RUN_BUILT', 'RUN_REORDERED', 'RUN_STARTED'].includes(row.type)).slice().reverse().sort((a, b) => time(b.at) - time(a.at))[0];
    const served = new Map((parsed(built?.payload, {}).positions || []).map(row => [row.id, row.servedAnalytes || []]));
    function serves(row) {
        if (row.kind === 'SAMPLE') return (row.workItems || []).some(link => runAnalyteCode(batch, link.analysisCode) === analysisCode);
        if (isolatedRound) return selectedPositions.has(row.id);
        if (row.kind === 'DUPLICATE' && row.duplicateOfPositionId) return serves((batch.positions || []).find(parent => parent.id === row.duplicateOfPositionId) || { kind: 'SAMPLE' });
        if ((row.references || []).some(reference => reference.analysisCode === analysisCode && !reference.supersededById && reference.serviceStatus === 'NOT_SERVED')) return false;
        // Retained extras are visible through their immutable placement, even
        // after a pre-start rebuild no longer requires that position kind.
        if (row.provenance === 'NATIVE' && ((row.references || []).some(reference => reference.analysisCode === analysisCode && !reference.supersededById) ||
            (batch.measurements || []).some(measurement => measurement.positionId === row.id && measurement.analysisCode === analysisCode))) return true;
        if (served.has(row.id)) return served.get(row.id).includes(analysisCode);
        return row.provenance === 'NATIVE' ? (batch.measurements || []).some(measurement => measurement.positionId === row.id && measurement.analysisCode === analysisCode)
            : (parsed(row.legacySource, {}).entry?.analysisCode || batch.analysis) === analysisCode;
    }
    const positions = (batch.positions || []).filter(row => row.historicalSnapshotSeq === null || row.historicalSnapshotSeq === undefined)
        .filter(serves).sort((a, b) => a.position - b.position);
    const current = (batch.measurements || []).filter(row => row.analysisCode === analysisCode && !row.supersededById &&
        (!isolatedRound || selectedMeasurements.has(row.id)) && positions.some(position => position.id === row.positionId));
    const at = (positionId, replicateNo = 1) => current.find(row => row.positionId === positionId && row.replicateNo === replicateNo);
    const evaluated = parsed(details.evaluation ?? details.qcResults, {});
    const qcResults = { ...evaluated, blanks: [], controls: [], duplicates: [] }, qcItems = [];
    for (const position of positions) {
        if (position.kind === 'SAMPLE') continue;
        const source = parsed(position.legacySource, {}), collection = position.kind === 'BLANK' || position.kind === 'CCB' ? 'blanks'
            : position.kind === 'DUPLICATE' ? 'duplicates' : 'controls';
        const original = (evaluated?.[collection] || []).find(row => row.id === position.id || row.positionId === position.id) || source.entry || {};
        const measurement = at(position.id), parent = position.duplicateOfPositionId ? at(position.duplicateOfPositionId) : null;
        const second = position.duplicateOfPositionId ? measurement : at(position.id, 2);
        if (!measurement && !second && !parent) continue;
        const row = { ...original, id: position.id, positionId: position.id, position: position.position, kind: position.kind,
            status: original.status || 'INCOMPLETE' };
        if (collection === 'duplicates') {
            const first = position.duplicateOfPositionId ? parent : measurement;
            row.value1 = first?.value ?? null; row.value2 = second?.value ?? null;
            row.rawInput = { value1: first?.rawInput ?? null, value2: second?.rawInput ?? null };
            row.censoringLimits = [first, second].map(observation => observation?.censoring
                ? { qualifier: observation.censoring, limit: observation.censoringLimit, literalLoq: /^<LOQ$/i.test(observation.rawInput || '') } : null);
            row.duplicateOfPositionId = position.duplicateOfPositionId;
        } else if (collection === 'blanks') {
            row.value = measurement?.value ?? null; row.rawInput = { value: measurement?.rawInput ?? null };
        } else {
            const binding = (position.references || []).find(reference => reference.analysisCode === analysisCode && !reference.supersededById);
            row.measured = measurement?.value ?? null; row.rawInput = { measured: measurement?.rawInput ?? null };
            if (binding) Object.assign(row, { referenceMaterialId: binding.referenceMaterialId, referenceValueId: binding.referenceValueId,
                referenceUse: binding.referenceUse, referenceSnapshot: parsed(binding.referenceSnapshot), expected: parsed(binding.referenceSnapshot)?.expected ?? original.expected ?? null });
        }
        qcResults[collection].push(row);
        qcItems.push({ id: row.id, batchId: batch.id, positionId: position.id, type: collection === 'blanks' ? 'BLANK' : collection === 'duplicates' ? 'DUPLICATE' : 'CONTROL',
            label: row.label ?? null, expected: row.expected ?? null, measured: row.value ?? row.measured ?? null,
            value1: row.value1 ?? null, value2: row.value2 ?? null, recoveryPct: row.recoveryPct ?? null, rpd: row.rpd ?? null,
            status: row.status, details: JSON.stringify({ evaluation: row.details ?? null, rawInput: row.rawInput,
                policyVersion: evaluation?.policyVersion ?? null, qcRule: evaluated?.qcRule ?? null,
                criterion: row.criterion, loq: row.loq, loqSource: row.loqSource, methodologyId: row.methodologyId,
                notes: row.notes || [], failAction: row.failAction, maxAllowed: row.maxAllowed,
                absMax: row.absMax ?? null, absoluteDifference: row.absoluteDifference ?? null,
                censoringLimits: row.censoringLimits ?? null, crmAbsWindow: row.crmAbsWindow, lrmWindowPct: row.lrmWindowPct,
                referenceUse: row.referenceUse ?? null, referenceSnapshot: row.referenceSnapshot ?? null }),
            referenceMaterialId: row.referenceMaterialId ?? null, referenceValueId: row.referenceValueId ?? null });
    }
    return { analysisCode, result: currentVerdict, evaluation, positions, measurements: current,
        qcResults: qcItems.length || currentVerdict === 'NOT_REQUIRED' ? { ...qcResults, result: currentVerdict } : null, qcItems,
        disposition: currentDisposition(batch, evaluation, analysisCode) };
}

function historyView(batch) {
    const entries = [], importedSeq = new Set();
    for (const evaluation of batch.evaluations || []) {
        const source = parsed(evaluation.legacySource, {});
        if (source.seq === null || source.seq === undefined || importedSeq.has(source.seq)) continue;
        const event = source.auditRow ? parsed(source.auditRow.details) : source.historyEvent;
        if (!event) continue;
        importedSeq.add(source.seq); entries.push({ index: source.historyIndex ?? Number.MAX_SAFE_INTEGER, at: event.snapshot?.timestamp,
            entry: event, seq: source.seq });
    }
    for (const event of batch.events || []) {
        if (event.type === 'LEGACY_IMPORTED') continue;
        const payload = parsed(event.payload, {});
        if (payload.legacy && payload.event) entries.push({ index: payload.historyIndex, at: event.at, entry: payload.event });
        else entries.push({ index: Number.MAX_SAFE_INTEGER, at: event.at, entry: payload.historyEntry || {
            ...payload, action: event.type, changedBy: event.by, timestamp: event.at } });
    }
    return entries.sort((a, b) => a.index - b.index || time(a.at) - time(b.at) || (a.seq || 0) - (b.seq || 0)).map(row => row.entry);
}
function batchApiView(batch, { serialized = false } = {}) {
    const current = currentAnalyteEvidence(batch), history = historyView(batch);
    const analytes = (batch.analytes || []).map(row => ({ ...row, ...currentAnalyteEvidence(batch, row.analysisCode) }));
    const workItemIds = [...new Set((batch.positions || []).flatMap(position => (position.workItems || []).map(link => link.workItemId)))];
    const workItems = [...new Map((batch.positions || []).filter(position => position.kind === 'SAMPLE')
        .flatMap(position => (position.workItems || []).filter(link => link.workItem).map(link => [link.workItemId,
            { ...link.workItem, rackPosition: position.position, currentBatchId: link.workItem.batchId }]))).values()].sort((a, b) => a.rackPosition - b.rackPosition);
    return { ...batch, analytes, result: current.result, qcItems: current.qcItems, qcResults: serialized && current.qcResults !== null ? JSON.stringify(current.qcResults) : current.qcResults,
        workItemIds: serialized ? JSON.stringify(workItemIds) : workItemIds,
        workItems: Array.isArray(batch.positions) ? workItems : batch.workItems || [],
        disposition: serialized && current.disposition !== null ? JSON.stringify(current.disposition) : current.disposition,
        history: serialized ? JSON.stringify(history) : history,
        positions: [...new Map([...analytes.flatMap(row => row.positions), ...(batch.positions || []).filter(row => row.provenance === 'NATIVE' && row.historicalSnapshotSeq == null)]
            .map(row => [row.id, row])).values()].sort((a, b) => a.position - b.position) };
}
async function readQcRun(db, batchId, actor, options = {}) {
    const batch = await db.batch.findUnique({ where: { id: batchId }, include: QC_RUN_INCLUDE });
    if (!batch) throw Object.assign(new Error('Batch not found.'), { statusCode: 404, code: 'BATCH_NOT_FOUND' });
    const [actorLab, targetLab] = db.lab ? await Promise.all([policyService.resolveLab(actor.labId, db), policyService.resolveLab(batch.labId, db)]) : [];
    try { scopeGuard.ensureScope({ ...actor, labId: actorLab?.id || actor.labId }, { ...batch, labId: targetLab?.id || batch.labId }, { labField: 'labId', altLabField: null }); }
    catch (error) { error.code = error.code || 'QC_BATCH_SCOPE_DENIED'; if (error.statusCode === 403) error.message = 'Access denied: Batch outside your laboratory scope'; throw error; }
    return batchApiView(batch, options);
}
module.exports = { QC_RUN_INCLUDE, currentAnalyteEvidence, activeReopenEvent, batchApiView, readQcRun };
