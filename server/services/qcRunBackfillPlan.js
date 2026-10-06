const { createHash } = require('node:crypto');
const { legacyBatchAnalyteStatus } = require('../workflowContract');
const hash = value => createHash('sha256').update(value).digest('hex');
const identity = (...parts) => `qc186-${hash(JSON.stringify(parts))}`;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function parsed(value) {
    if (value === null || value === undefined) return { value: null, invalid: false };
    if (typeof value !== 'string') return { value, invalid: false };
    try { return { value: JSON.parse(value), invalid: false }; } catch { return { value: null, invalid: true }; }
}
function timestamp(value) {
    if (value === null || value === undefined) return null;
    const source = typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(' ', 'T') + 'Z' : value;
    const date = new Date(source);
    return Number.isFinite(date.getTime()) ? date.getTime() : null;
}
const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const collections = [['blanks', 'BLANK', ['value']], ['duplicates', 'DUPLICATE', ['value1', 'value2']], ['controls', 'CONTROL', ['measured']]];

// Import recorded observations, never rerun a scientific calculation or resolve
// today's policy against a historical value. Qualified strings have no measured
// number; already-recorded censoring limits take precedence over lexical limits.
function observation(entry, field, replicateNo, counts) {
    const value = entry[field], raw = object(entry.rawInput) && Object.hasOwn(entry.rawInput, field) ? entry.rawInput[field] : null;
    const recorded = entry.censoringLimits?.[replicateNo - 1];
    let censoring = ['<', '<=', '>', '>='].includes(recorded?.qualifier) ? recorded.qualifier : null;
    let censoringLimit = censoring ? finite(recorded.limit) : null;
    if (!censoring && field.startsWith('value') && field !== 'value') {
        const source = typeof value === 'string' ? value : typeof raw === 'string' ? raw : '';
        const qualified = source.trim().match(/^(<=|>=|<|>|≤|≥)\s*(LOQ|[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/i);
        if (qualified) {
            censoring = qualified[1].replace('≤', '<=').replace('≥', '>=');
            censoringLimit = /^LOQ$/i.test(qualified[2]) ? finite(entry.loq) : finite(Number(qualified[2]));
        }
    }
    if (!censoring && value !== null && value !== undefined && finite(value) === null) counts.unresolvedNumbers++;
    return { value: censoring ? null : finite(value), rawInput: raw === null || raw === undefined ? null : String(raw), censoring, censoringLimit };
}
function sameTypedCopy(entry, typedRow, type, fields) {
    if (typedRow.status !== entry.status) return false;
    const details = parsed(typedRow.details).value;
    const copy = { ...typedRow, ...(object(details) ? details : {}), value: typedRow.measured,
        measured: typedRow.measured, value1: typedRow.value1, value2: typedRow.value2 };
    return fields.every((field, index) => {
        const left = observation(entry, field, index + 1, { unresolvedNumbers: 0 });
        const right = observation(copy, field, index + 1, { unresolvedNumbers: 0 });
        return JSON.stringify(left) === JSON.stringify(right);
    });
}

function inventoryLegacyQcRuns(db) {
    const rows = { BatchAnalyte: [], BatchPosition: [], BatchPositionWorkItem: [], BatchPositionReference: [],
        QcMeasurement: [], QcEvaluation: [], BatchDisposition: [], BatchEvent: [] };
    const counts = Object.fromEntries(['batches', 'analytes', 'samplePositions', 'qcPositions', 'historicalSnapshots', 'currentEvaluations',
        'evaluations', 'measurements', 'typedRows', 'historicalTypedRows', 'jsonEntries', 'typedFallbackEntries', 'typedJsonConflicts',
        'historyAuditConflicts', 'unresolvedMethods', 'unresolvedAnalysts', 'unresolvedInstruments', 'unlinkedReferences',
        'unresolvedNumbers', 'unresolvedDuplicateParents', 'unresolvedRackPositions', 'missingWorkItems', 'malformedHistory',
        'malformedQcResults', 'orphanSnapshots', 'refusals'].map(key => [key, 0]));
    const diagnostics = [], refusals = [], metadata = [];
    const batches = db.prepare('SELECT id,labId,analysis,instrument,status,createdBy,createdAt,notes,qcResults,workItemIds,maxCapacity,profile,disposition,history FROM "Batch" ORDER BY id').all();
    const workItems = db.prepare('SELECT id,sampleId,analysis,methodologyId,batchId,rackPosition FROM "WorkItem" WHERE batchId IS NOT NULL ORDER BY batchId,rackPosition,id').all();
    const typedRows = db.prepare('SELECT * FROM "BatchQcResult" ORDER BY batchId,type,id').all();
    const audits = db.prepare('SELECT * FROM "AuditLog" WHERE entity=\'BATCH\' AND action=\'QC_EVIDENCE_SNAPSHOT\' ORDER BY entityId,id').all();
    const users = new Set(db.prepare('SELECT username FROM "User"').all().map(row => row.username));
    const methods = new Map(db.prepare('SELECT id,analysisCode FROM "Methodology"').all().map(row => [row.id, row]));
    const assets = db.prepare('SELECT id,labId,name FROM "EquipmentAsset" ORDER BY id').all();
    const labs = db.prepare('SELECT id,code FROM "Lab"').all();
    const materials = new Set(db.prepare('SELECT id FROM "ReferenceMaterial"').all().map(row => row.id));
    const values = new Map(db.prepare('SELECT id,referenceMaterialId,analysisCode FROM "ReferenceValue"').all().map(row => [row.id, row]));
    const rules = new Map(db.prepare('SELECT id,version,analysisCode FROM "QcRule"').all().map(row => [row.id, row]));
    const refuse = (batchId, code, source) => refusals.push({ batchId, code, source });
    const diagnostic = (batchId, code, source) => diagnostics.push({ batchId, code, source });
    for (const audit of audits.filter(row => !batches.some(batch => batch.id === row.entityId))) {
        counts.orphanSnapshots++; refuse(audit.entityId, 'QC_LEGACY_BATCH_UNRESOLVED', audit);
    }

    for (const batch of batches) {
        counts.batches++;
        const history = parsed(batch.history), historyEntries = Array.isArray(history.value) ? history.value : [];
        if (history.invalid || (history.value !== null && !Array.isArray(history.value))) {
            counts.malformedHistory++; refuse(batch.id, 'QC_LEGACY_HISTORY_INVALID', batch.history);
        }
        const members = workItems.filter(row => row.batchId === batch.id), currentTyped = typedRows.filter(row => row.batchId === batch.id);
        counts.typedRows += currentTyped.length;
        const storedMembers = parsed(batch.workItemIds);
        if (Array.isArray(storedMembers.value)) counts.missingWorkItems += storedMembers.value.filter(id => !members.some(row => row.id === id)).length;
        const analysisCodes = [...new Set([batch.analysis, ...members.map(row => row.analysis)])].sort();
        const snapshots = new Map();
        const historyCopies = new Map();
        for (const [index, event] of historyEntries.entries()) {
            if (!object(event)) { refuse(batch.id, 'QC_LEGACY_HISTORY_INVALID', { index, event }); continue; }
            if (event.action !== 'QC_EVIDENCE_SNAPSHOT') continue;
            if (!Number.isInteger(event.seq) || event.seq < 1 || !object(event.snapshot) || historyCopies.has(event.seq)) {
                refuse(batch.id, 'QC_LEGACY_SNAPSHOT_INVALID', { index, event }); continue;
            }
            historyCopies.set(event.seq, { event, index });
            snapshots.set(event.seq, { seq: event.seq, snapshot: event.snapshot, source: 'BATCH_HISTORY', historyIndex: index, historyEvent: event });
        }
        const authoritative = new Set();
        for (const audit of audits.filter(row => row.entityId === batch.id)) {
            const event = parsed(audit.details).value;
            if (!object(event) || !Number.isInteger(event.seq) || event.seq < 1 || !object(event.snapshot) || authoritative.has(event.seq)) {
                refuse(batch.id, 'QC_LEGACY_SNAPSHOT_INVALID', audit); continue;
            }
            authoritative.add(event.seq);
            const copy = historyCopies.get(event.seq);
            if (copy && JSON.stringify(copy.event) !== JSON.stringify(event)) {
                counts.historyAuditConflicts++; diagnostic(batch.id, 'HISTORY_AUDIT_CONFLICT', { seq: event.seq, auditId: audit.id });
            }
            snapshots.set(event.seq, { seq: event.seq, snapshot: event.snapshot, source: 'AUDIT_LOG', auditRow: audit,
                historyIndex: copy?.index ?? null, historyEvent: copy?.event ?? null });
        }
        const historical = [...snapshots.values()].sort((a, b) => a.seq - b.seq);
        counts.historicalSnapshots += historical.length;
        const reopened = batch.status === 'OPEN' && (historical.some(row => row.snapshot.status && row.snapshot.status !== 'OPEN') ||
            historyEntries.some(event => event?.status && event.status !== 'OPEN'));
        const frozen = batch.status !== 'OPEN' || historical.length > 0 || currentTyped.length > 0 || batch.qcResults !== null || batch.disposition !== null || reopened;
        const disposition = parsed(batch.disposition).value;
        let status;
        try { status = legacyBatchAnalyteStatus(batch.status, { reopened, decision: disposition?.decision }); }
        catch { refuse(batch.id, 'QC_LEGACY_STATUS_INVALID', batch.status); status = 'QC_PENDING'; }
        const firstStart = historyEntries.find(event => event?.status === 'RUNNING' || event?.status === 'IN_RUN');
        const originalActor = firstStart?.changedBy ?? firstStart?.by ?? null;
        const analystUsername = users.has(originalActor) ? originalActor : null;
        if (!analystUsername) counts.unresolvedAnalysts++;
        const lab = labs.find(row => row.id === batch.labId || row.code === batch.labId);
        const matchingAssets = batch.instrument && lab ? assets.filter(row => row.labId === lab.id && (row.id === batch.instrument || row.name === batch.instrument)) : [];
        const instrumentId = matchingAssets.length === 1 ? matchingAssets[0].id : null;
        if (!instrumentId) counts.unresolvedInstruments++;
        metadata.push({ batchId: batch.id, analystUsername, instrumentId });
        for (const analysisCode of analysisCodes) {
            const candidateMembers = members.filter(row => row.analysis === analysisCode), methodIds = [...new Set(candidateMembers.map(row => row.methodologyId))];
            const methodologyId = methodIds.length === 1 && methods.get(methodIds[0])?.analysisCode === analysisCode ? methodIds[0] : null;
            if (!methodologyId) counts.unresolvedMethods++;
            rows.BatchAnalyte.push({ id: identity(batch.id, 'analyte', analysisCode), batchId: batch.id, labId: batch.labId, analysisCode,
                methodologyId, methodResolution: methodologyId ? 'RESOLVED_LEGACY' : 'UNRESOLVED_LEGACY', status,
                provenance: 'LEGACY_MIGRATED', legacyMembershipFrozen: frozen ? 1 : 0,
                legacySource: JSON.stringify({ batch, originalActor, workItems: candidateMembers }) });
        }

        let positionNumber = 0;
        const occupied = new Set(), samples = new Map();
        for (const member of members) {
            if (samples.has(member.sampleId)) {
                const previous = samples.get(member.sampleId);
                if (previous.rackPosition !== member.rackPosition || previous.codes.has(member.analysis)) {
                    refuse(batch.id, 'QC_LEGACY_MEMBERSHIP_AMBIGUOUS', { sampleId: member.sampleId, workItemId: member.id }); continue;
                }
                previous.codes.add(member.analysis);
                rows.BatchPositionWorkItem.push({ id: identity(batch.id, 'membership', member.id), positionId: previous.id, workItemId: member.id, analysisCode: member.analysis });
                continue;
            }
            let position = member.rackPosition;
            if (!Number.isInteger(position) || position < 1) { counts.unresolvedRackPositions++; position = Math.max(positionNumber, ...occupied, 0) + 1; }
            if (occupied.has(position)) { refuse(batch.id, 'QC_LEGACY_MEMBERSHIP_AMBIGUOUS', { workItemId: member.id, rackPosition: member.rackPosition }); continue; }
            occupied.add(position); positionNumber = Math.max(positionNumber, position);
            const id = identity(batch.id, 'sample', member.sampleId);
            samples.set(member.sampleId, { id, rackPosition: member.rackPosition, codes: new Set([member.analysis]) });
            rows.BatchPosition.push({ id, batchId: batch.id, position, kind: 'SAMPLE', sampleId: member.sampleId,
                duplicateOfPositionId: null, historicalSnapshotSeq: null, provenance: 'LEGACY_MIGRATED', legacySource: JSON.stringify({ workItem: member }) });
            rows.BatchPositionWorkItem.push({ id: identity(batch.id, 'membership', member.id), positionId: id, workItemId: member.id, analysisCode: member.analysis });
            counts.samplePositions++;
        }
        const versions = [...historical, { seq: null, snapshot: { qcResults: parsed(batch.qcResults).value,
            qcItems: currentTyped, status: batch.status, disposition, workItemIds: storedMembers.value }, source: 'CURRENT_ROWS',
            rawQcResults: batch.qcResults, qcResultsInvalid: parsed(batch.qcResults).invalid }];
        const previousEvaluations = new Map();
        for (const [versionIndex, record] of versions.entries()) {
            const snapshot = record.snapshot, qc = parsed(snapshot.qcResults), json = object(qc.value) ? qc.value : null;
            const invalidJson = record.qcResultsInvalid || qc.invalid || (qc.value !== null && !json);
            if (invalidJson) { counts.malformedQcResults++; diagnostic(batch.id, 'QC_LEGACY_JSON_UNPARSEABLE', { seq: record.seq }); }
            const typed = Array.isArray(snapshot.qcItems) ? snapshot.qcItems : [];
            if (record.seq !== null) counts.historicalTypedRows += typed.length;
            const entries = [];
            if (json) {
                for (const [collection, type, fields] of collections) {
                    const sourceEntries = Array.isArray(json[collection]) ? json[collection] : [];
                    const typedGroup = typed.filter(row => row.type === type);
                    const unmatchedTyped = new Set(typedGroup);
                    if (sourceEntries.length !== typedGroup.length) {
                        counts.typedJsonConflicts++; diagnostic(batch.id, 'TYPED_JSON_CONFLICT', { seq: record.seq, collection, jsonCount: sourceEntries.length, typedCount: typedGroup.length });
                    }
                    for (const [index, entry] of sourceEntries.entries()) {
                        if (!object(entry)) { refuse(batch.id, 'QC_LEGACY_ENTRY_INVALID', { seq: record.seq, collection, index, entry }); continue; }
                        // Old typed UUIDs and id-sorted arrays cannot identify a
                        // JSON slot. Match only a complete recorded copy within
                        // this snapshot, otherwise preserve an explicit candidate.
                        const exactCopy = [...unmatchedTyped].find(row => sameTypedCopy(entry, row, type, fields));
                        const typedRow = exactCopy || [...unmatchedTyped][0] || null;
                        if (typedRow) unmatchedTyped.delete(typedRow);
                        const conflict = typedRow && !exactCopy;
                        if (conflict) { counts.typedJsonConflicts++; diagnostic(batch.id, 'TYPED_JSON_CONFLICT', { seq: record.seq, collection, index, typedId: typedRow.id }); }
                        counts.jsonEntries++;
                        entries.push({ entry, type, fields, index, collection, typedRow, typedRowMatch: exactCopy ? 'EXACT_RECORDED_COPY' : typedRow ? 'UNRESOLVED_CANDIDATE' : null, valueSource: 'QC_RESULTS_JSON' });
                    }
                }
            } else for (const [index, typedRow] of typed.entries()) {
                const definition = collections.find(row => row[1] === typedRow.type);
                if (!definition) { refuse(batch.id, 'QC_LEGACY_TYPE_UNRESOLVED', { seq: record.seq, typedRow }); continue; }
                const details = parsed(typedRow.details).value;
                entries.push({ entry: { ...typedRow, ...(object(details) ? details : {}), value: typedRow.measured,
                    measured: typedRow.measured, value1: typedRow.value1, value2: typedRow.value2, status: typedRow.status },
                    type: typedRow.type, fields: definition[2], index, collection: null, typedRow, valueSource: 'TYPED_ROW' });
                counts.typedFallbackEntries++;
            }
            const measurementIds = new Map(analysisCodes.map(code => [code, []])), positionIds = new Map(analysisCodes.map(code => [code, []]));
            // A snapshot actor/time attributes the later replacement, not the
            // original measurement or evaluation. Keep those unknowns null.
            const evaluatedBy = json?.evaluatedBy ?? json?.summary?.evaluatedBy ?? null;
            const evaluatedAt = timestamp(json?.summary?.evaluatedAt);
            for (const source of entries) {
                const { entry, type, fields, index, collection, typedRow, typedRowMatch = null, valueSource } = source;
                const analysisCode = entry.analysisCode || batch.analysis;
                if (!measurementIds.has(analysisCode)) { refuse(batch.id, 'QC_LEGACY_ANALYSIS_UNRESOLVED', { seq: record.seq, entry }); continue; }
                const referenceValue = values.get(entry.referenceValueId);
                const linked = type === 'CONTROL' && ['CRM', 'LRM'].includes(entry.referenceUse) && materials.has(entry.referenceMaterialId) &&
                    referenceValue?.referenceMaterialId === entry.referenceMaterialId && referenceValue.analysisCode === analysisCode && object(entry.referenceSnapshot);
                const kind = linked ? entry.referenceUse : type;
                const sourcePayload = { seq: record.seq, source: record.source, sourceRowId: valueSource === 'TYPED_ROW' ? typedRow.id : entry.id ?? null,
                    type, arrayIndex: index, collection, valueSource, entry, typedRow, typedRowMatch };
                const positionId = identity(batch.id, 'qc-position', versionIndex, collection, index, analysisCode);
                rows.BatchPosition.push({ id: positionId, batchId: batch.id, position: ++positionNumber, kind, sampleId: null,
                    duplicateOfPositionId: null, historicalSnapshotSeq: record.seq, provenance: 'LEGACY_MIGRATED', legacySource: JSON.stringify(sourcePayload) });
                counts.qcPositions++;
                positionIds.get(analysisCode).push(positionId);
                if (type === 'DUPLICATE') counts.unresolvedDuplicateParents++;
                if (type === 'CONTROL' && !linked) counts.unlinkedReferences++;
                if (linked) rows.BatchPositionReference.push({ id: identity(positionId, 'reference'), positionId, analysisCode,
                    referenceMaterialId: entry.referenceMaterialId, referenceValueId: entry.referenceValueId, referenceUse: entry.referenceUse,
                    referenceSnapshot: JSON.stringify(entry.referenceSnapshot), boundBy: null, boundAt: null, supersededById: null, correctionReason: null });
                for (const [fieldIndex, field] of fields.entries()) {
                    const replicateNo = fieldIndex + 1, id = identity(positionId, 'measurement', replicateNo);
                    rows.QcMeasurement.push({ id, batchId: batch.id, positionId, analysisCode, replicateNo,
                        ...observation(entry, field, replicateNo, counts), enteredBy: null, enteredAt: null, supersededById: null,
                        correctionReason: null, legacySource: JSON.stringify({ ...sourcePayload, field, originalValue: entry[field] ?? null }) });
                    measurementIds.get(analysisCode).push(id); counts.measurements++;
                }
            }
            for (const analysisCode of analysisCodes) {
                const ids = measurementIds.get(analysisCode), id = identity(batch.id, 'evaluation', versionIndex, analysisCode);
                const recordedStatus = json?.overallStatus ?? snapshot.status;
                const verdict = !ids.length ? 'INCOMPLETE' : recordedStatus === 'QC_FAIL' ? 'FAIL'
                    : json?.summary?.warnings?.length ? 'WARN' : recordedStatus === 'QC_PASS' ? 'PASS' : 'INCOMPLETE';
                const qcRule = json?.qcRule, candidateRuleId = qcRule?.ruleId ?? qcRule?.id ?? null, candidateRuleVersion = qcRule?.ruleVersion ?? qcRule?.version ?? null;
                const linkedRule = rules.get(candidateRuleId)?.version === candidateRuleVersion && rules.get(candidateRuleId)?.analysisCode === analysisCode;
                const policyVersion = Number.isInteger(json?.policyVersion) && json.policyVersion >= 0 ? json.policyVersion : null;
                const details = { legacy: true, snapshotSeq: record.seq, measurementIds: ids, positionIds: positionIds.get(analysisCode),
                    reason: record.seq === null && !ids.length && historical.length ? 'LEGACY_CLEARED' : null, qcResults: snapshot.qcResults,
                    typedRows: typed, status: snapshot.status, disposition: snapshot.disposition };
                rows.QcEvaluation.push({ id, batchId: batch.id, analysisCode, version: versionIndex + 1,
                    ruleId: linkedRule ? candidateRuleId : null, ruleVersion: linkedRule ? candidateRuleVersion : null, policyVersion,
                    verdict, details: JSON.stringify(details), evaluatedBy, evaluatedAt,
                    supersedesId: previousEvaluations.get(analysisCode) || null, legacySource: JSON.stringify(record) });
                previousEvaluations.set(analysisCode, id); counts.evaluations++;
                if (record.seq === null) counts.currentEvaluations++;
            }
            const originalDisposition = parsed(snapshot.disposition).value;
            if (object(originalDisposition)) {
                const decisions = { PROCEED_WITH_WARNING: 'ACCEPT_WITH_DEVIATION', REANALYZE_BATCH: 'REPEAT_BATCH', REJECT_BATCH: 'REJECT' };
                const decision = decisions[originalDisposition.decision];
                if (!decision) refuse(batch.id, 'QC_LEGACY_DISPOSITION_UNRESOLVED', originalDisposition);
                else rows.BatchDisposition.push({ id: identity(batch.id, 'disposition', versionIndex), batchId: batch.id, analysisCode: batch.analysis,
                    decision, reason: originalDisposition.reason ?? originalDisposition.justification ?? null,
                    decidedBy: originalDisposition.decidedBy ?? originalDisposition.by ?? null,
                    decidedAt: timestamp(originalDisposition.decidedAt ?? originalDisposition.at), legacySource: JSON.stringify({ seq: record.seq, originalDisposition }) });
            }
        }
        let leftOpen = false;
        for (const [index, event] of historyEntries.entries()) {
            if (!object(event) || event.action === 'QC_EVIDENCE_SNAPSHOT') {
                if (event?.snapshot?.status && event.snapshot.status !== 'OPEN') leftOpen = true;
                continue;
            }
            const explicitReopen = event.action === 'REOPENED' || event.type === 'REOPENED' || (event.status === 'OPEN' && leftOpen);
            rows.BatchEvent.push({ id: identity(batch.id, 'history', index), batchId: batch.id,
                type: explicitReopen ? 'REOPENED' : event.action || event.type || (event.status ? 'LEGACY_STATUS' : 'LEGACY_HISTORY'),
                payload: JSON.stringify({ legacy: true, historyIndex: index, event }), by: event.changedBy ?? event.by ?? null,
                at: timestamp(event.timestamp ?? event.at) });
            if (event.status && event.status !== 'OPEN') leftOpen = true;
        }
        rows.BatchEvent.push({ id: identity(batch.id, 'import'), batchId: batch.id, type: 'LEGACY_IMPORTED',
            payload: JSON.stringify({ batch, originalActor, instrumentId, analystUsername, latestEvaluationIds: Object.fromEntries(previousEvaluations) }), by: null, at: null });
    }
    counts.analytes = rows.BatchAnalyte.length; counts.refusals = refusals.length;
    const plan = { rows, metadata, counts, diagnostics, refusals };
    return { ...plan, fingerprint: hash(JSON.stringify(plan)) };
}
module.exports = { inventoryLegacyQcRuns };
