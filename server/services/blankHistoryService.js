// #216 evidence authority: Claudio6243750035. Proposals only; never apply limits.
const { createHash } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const scopeGuard = require('../utils/scopeGuard');
const policyService = require('./policyService');
const { inTransaction, actorName } = require('./workflowStateRules');
const { QC_RUN_INCLUDE, currentAnalyteEvidence } = require('./qcRunViewService');
const { ordered, statistics } = require('./controlChartRules');
const fail = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });
const parse = value => { try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; } };
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const seriesKey = row => ({ labId: row.labId, analysisCode: row.analysisCode, methodologyId: row.methodologyId,
    methodRevision: row.methodRevision, analysisUnit: row.analysisUnit });
const identity = row => JSON.stringify(seriesKey(row));
const POLICY_KEYS = ['qc.blankHistoryWindow', 'qc.blankHistoryMinPoints', 'qc.blankLodMultiplier', 'qc.blankLoqMultiplier'];

async function scopedLab(db, actor, input, write = false) {
    if (!hasPermission(actor, write ? 'MANAGE_ANALYSES' : 'VIEW_ANALYTICAL_RESULTS')) {
        throw fail(403, 'LOD_LOQ_PERMISSION_REQUIRED', 'LOD/LOQ proposal permission is required.');
    }
    if (input?.labId !== undefined && (typeof input.labId !== 'string' || !input.labId.trim())) {
        throw fail(400, 'LOD_LOQ_SERIES_INVALID', 'Choose one laboratory.');
    }
    const lab = await policyService.resolveLab(input?.labId || actor.labId, db);
    const actorLab = await policyService.resolveLab(actor.labId, db);
    if (!lab) throw fail(404, 'LOD_LOQ_LAB_NOT_FOUND', 'Laboratory not found.');
    try { scopeGuard.ensureScope({ ...actor, labId: actorLab?.id || actor.labId }, { labId: lab.id }, { labField: 'labId', altLabField: null }); }
    catch { throw fail(403, 'LOD_LOQ_SCOPE_DENIED', 'Laboratory is outside your scope.'); }
    return lab;
}

function unitAtStart(criteria, batch, analyte) {
    if (Object.hasOwn(criteria, 'analysisUnit')) return typeof criteria.analysisUnit === 'string' && criteria.analysisUnit
        ? { unit: criteria.analysisUnit, source: 'STARTED_RUN' } : { reason: 'UNIT_UNKNOWN' };
    // The only legacy fallback is this run's retained LRM snapshot, never a live catalogue lookup.
    const snapshots = (batch.positions || []).filter(row => row.kind === 'LRM').flatMap(row => row.references || [])
        .filter(row => row.analysisCode === analyte.analysisCode && row.referenceUse === 'LRM' && !row.supersededById && row.serviceStatus !== 'NOT_SERVED')
        .map(row => parse(row.referenceSnapshot));
    snapshots.push(...(Array.isArray(criteria.controlCharts) ? criteria.controlCharts : []).map(row => parse(row?.referenceSnapshot)).filter(Boolean));
    const units = new Set(snapshots.filter(row => row.methodologyId === analyte.methodologyId)
        .map(row => row.analysisUnit).filter(value => typeof value === 'string' && value));
    return units.size > 1 ? { reason: 'UNIT_CONFLICT' } : units.size ? { unit: [...units][0], source: 'FROZEN_LRM' } : { reason: 'UNIT_UNKNOWN' };
}

async function collect(db, labId, filter = {}, now = new Date()) {
    const rows = await db.batchAnalyte.findMany({ where: { labId, batch: { labId },
        ...(filter.analysisCode && { analysisCode: filter.analysisCode }), ...(filter.methodologyId && { methodologyId: filter.methodologyId }) },
    include: { batch: { include: QC_RUN_INCLUDE } } });
    const points = [], exclusions = [];
    for (const analyte of rows) {
        const batch = analyte.batch, evidence = currentAnalyteEvidence(batch, analyte.analysisCode);
        const evaluation = evidence.evaluation, details = parse(evaluation?.details), criteria = parse(analyte.criteriaSnapshot);
        const evaluatedIds = new Set(Array.isArray(details.measurementIds) ? details.measurementIds : []);
        const blanks = batch.positions.filter(row => row.kind === 'BLANK' && (evidence.positions.some(p => p.id === row.id) ||
            batch.measurements.some(m => m.positionId === row.id && m.analysisCode === analyte.analysisCode)));
        const unavailable = (position, reason, measurements = []) => exclusions.push({ reason, runId: batch.id, positionId: position.id,
            evaluationId: evaluation?.id || null, measurementIds: measurements.map(row => row.id),
            values: measurements.map(row => Number.isFinite(row.value) ? row.value : null) });
        for (const position of blanks) {
            const all = batch.measurements.filter(row => row.positionId === position.id && row.analysisCode === analyte.analysisCode);
            const legacy = analyte.provenance !== 'NATIVE' || position.provenance !== 'NATIVE' || position.historicalSnapshotSeq != null ||
                details.legacy === true || details.entryMode === 'LEGACY_RESUBMISSION' || details.entryMode === 'CORRECTION' && details.compatibility === true;
            if (legacy) { unavailable(position, 'LEGACY', all); continue; }
            const superseded = all.filter(row => row.supersededById);
            if (superseded.length) unavailable(position, 'SUPERSEDED', superseded);
            const current = all.filter(row => !row.supersededById);
            if (!evaluation || evidence.result === null) { unavailable(position, evaluation ? 'REOPENED' : 'UNEVALUATED', current); continue; }
            if (current.length > 1) { unavailable(position, 'MULTIPLE_READINGS', current); continue; }
            const measurement = current[0];
            if (!measurement || !evaluatedIds.has(measurement.id)) { unavailable(position, 'UNEVALUATED_MEASUREMENT', current); continue; }
            if (measurement.censoring) { unavailable(position, 'CENSORED', current); continue; }
            if (!Number.isFinite(measurement.value)) { unavailable(position, 'NON_FINITE', current); continue; }
            const revision = criteria.methodRevision;
            if (!revision || revision.methodologyId !== analyte.methodologyId || !Number.isSafeInteger(revision.version) || revision.version < 1) {
                unavailable(position, 'METHOD_REVISION_UNKNOWN', current); continue;
            }
            const unit = unitAtStart(criteria, batch, analyte);
            if (unit.reason) { unavailable(position, unit.reason, current); continue; }
            const started = batch.startedAt && new Date(batch.startedAt).getTime();
            if (!Number.isFinite(started) || started > now.getTime()) { unavailable(position, 'EXECUTION_TIME_UNKNOWN', current); continue; }
            const checks = details.evaluation?.blanks;
            const blank = Array.isArray(checks) ? checks.find(row => (row.positionId || row.id) === position.id) : null;
            points.push({ labId, analysisCode: analyte.analysisCode, methodologyId: analyte.methodologyId, methodRevision: revision.version,
                methodName: revision.name || analyte.methodologyId, analysisUnit: unit.unit, unitSource: unit.source,
                measurementId: measurement.id, evaluationId: evaluation.id, runId: batch.id, positionId: position.id,
                executionTime: batch.startedAt, sequenceIndex: position.position, value: measurement.value,
                blankStatus: blank?.status || 'UNKNOWN', verdict: evaluation.verdict, selected: true });
        }
    }
    return { points: ordered(points), exclusions };
}
const counts = rows => rows.reduce((result, row) => ({ ...result, [row.reason]: (result[row.reason] || 0) + 1 }), {});

async function listSeries(db, actor, input = {}) {
    return inTransaction(db, async tx => {
        const lab = await scopedLab(tx, actor, input), history = await collect(tx, lab.id);
        const series = new Map();
        for (const point of history.points) {
            const key = identity(point), current = series.get(key);
            series.set(key, { ...seriesKey(point), methodName: point.methodName, observations: (current?.observations || 0) + 1 });
        }
        return { labId: lab.id, series: [...series.values()], excludedCounts: counts(history.exclusions) };
    });
}
async function context(db, actor, input, write = false) {
    const lab = await scopedLab(db, actor, input, write);
    if (!input || ['analysisCode', 'methodologyId', 'analysisUnit'].some(key => typeof input[key] !== 'string' || !input[key]) ||
        !/^\d+$/.test(String(input.methodRevision)) || !Number.isSafeInteger(Number(input.methodRevision)) || Number(input.methodRevision) < 1) {
        throw fail(400, 'LOD_LOQ_SERIES_INVALID', 'Choose a complete blank-history series.');
    }
    const method = await db.methodology.findUnique({ where: { id: input.methodologyId } });
    if (!method || method.analysisCode !== input.analysisCode || method.labId && ![lab.id, lab.code].includes(method.labId)) {
        throw fail(422, 'LOD_LOQ_SERIES_INVALID', 'Methodology is outside this laboratory and analysis.');
    }
    const series = seriesKey({ ...input, labId: lab.id, methodRevision: Number(input.methodRevision) });
    return { lab, method, series };
}
async function windowFor(db, actor, input, write = false) {
    const { lab, method, series } = await context(db, actor, input, write);
    const resolved = await Promise.all(POLICY_KEYS.map(key => policyService.get(lab.id, key, { analysisCode: series.analysisCode, methodologyId: series.methodologyId, db })));
    const [windowSize, minimumPoints, lodMultiplier, loqMultiplier] = resolved;
    if (!Number.isSafeInteger(windowSize) || !Number.isSafeInteger(minimumPoints) || minimumPoints > windowSize ||
        !Number.isFinite(lodMultiplier) || !Number.isFinite(loqMultiplier) || lodMultiplier <= 0 || loqMultiplier < lodMultiplier) {
        throw fail(422, 'LOD_LOQ_POLICY_INVALID', 'The blank window, minimum and multipliers must be consistent.');
    }
    const policy = Object.fromEntries(POLICY_KEYS.map((key, index) => [key, resolved[index]]));
    const history = await collect(db, lab.id, series), eligible = history.points.filter(row => identity(row) === identity(series));
    for (const point of history.points.filter(row => identity(row) !== identity(series))) history.exclusions.push({ reason:
        point.methodRevision !== series.methodRevision ? 'REVISION_SPLIT' : 'UNIT_SPLIT', measurementIds: [point.measurementId],
    values: [point.value], evaluationId: point.evaluationId, runId: point.runId, positionId: point.positionId });
    const points = eligible.slice(-windowSize);
    const fingerprint = hash({ series, policy, points, currentMethodVersion: method.version });
    const proposals = await db.auditLog.findMany({ where: { labId: lab.id, entity: 'METHODOLOGY', entityId: method.id, action: 'LOD_LOQ_PROPOSED' }, orderBy: [{ timestamp: 'desc' }, { id: 'asc' }] });
    return { labId: lab.id, series, points, excludedCounts: counts(history.exclusions), historyExclusions: history.exclusions,
        windowSize, minimumPoints, lodMultiplier, loqMultiplier, policy, fingerprint, currentMethodVersion: method.version,
        canPropose: hasPermission(actor, 'MANAGE_ANALYSES'), applyDeferred: true,
        proposals: proposals.map(row => ({ id: row.id, ...parse(row.details) })) };
}
async function readHistory(db, actor, input) { return inTransaction(db, tx => windowFor(tx, actor, input)); }

async function propose(db, actor, input) {
    return inTransaction(db, async tx => {
        const { lab, method, series } = await context(tx, actor, input, true), by = actorName(actor);
        if (typeof input.reason !== 'string' || !input.reason.trim() || typeof input.fingerprint !== 'string' ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId || '') ||
            !Array.isArray(input.selectedMeasurementIds) || input.selectedMeasurementIds.some(id => typeof id !== 'string') ||
            !Array.isArray(input.exclusions) || input.exclusions.some(row => !row || typeof row.measurementId !== 'string' || typeof row.reason !== 'string' || !row.reason.trim())) {
            throw fail(400, 'LOD_LOQ_PROPOSAL_INVALID', 'A request id, reviewed selection, fingerprint and reason are required.');
        }
        const selection = [...input.selectedMeasurementIds].sort(), exclusions = input.exclusions.map(row => ({ measurementId: row.measurementId, reason: row.reason.trim() }))
            .sort((a, b) => a.measurementId.localeCompare(b.measurementId));
        const requestFingerprint = hash({ series, reason: input.reason.trim(), fingerprint: input.fingerprint, selection, exclusions });
        const existing = await tx.auditLog.findUnique({ where: { id: input.requestId } });
        if (existing) {
            const retained = parse(existing.details);
            if (existing.action !== 'LOD_LOQ_PROPOSED' || existing.entity !== 'METHODOLOGY' || existing.entityId !== method.id ||
                existing.labId !== lab.id || existing.performedBy !== by || retained.requestFingerprint !== requestFingerprint) {
                throw fail(409, 'LOD_LOQ_REQUEST_CONFLICT', 'This request id already identifies a different action.');
            }
            return { id: existing.id, ...retained };
        }
        const view = await windowFor(tx, actor, series, true);
        if (input.fingerprint !== view.fingerprint) throw fail(409, 'LOD_LOQ_HISTORY_CHANGED', 'Blank history or policy changed. Refresh and review again.');
        const selected = new Set(selection), excluded = new Map(exclusions.map(row => [row.measurementId, row.reason]));
        if (selected.size !== selection.length || excluded.size !== exclusions.length ||
            [...selected].some(id => excluded.has(id) || !view.points.some(row => row.measurementId === id)) ||
            [...excluded.keys()].some(id => !view.points.some(row => row.measurementId === id)) ||
            view.points.some(row => !selected.has(row.measurementId) && !excluded.has(row.measurementId))) {
            throw fail(422, 'LOD_LOQ_SELECTION_INVALID', 'Select or exclude every window observation with a reason.');
        }
        const effective = view.points.filter(row => selected.has(row.measurementId));
        if (effective.length < view.minimumPoints) throw fail(422, 'LOD_LOQ_MIN_POINTS_REQUIRED', 'Too few selected blank observations for this policy.');
        let computed;
        try { computed = statistics(effective.map(row => row.value)); }
        catch { throw fail(422, 'LOD_LOQ_SD_INVALID', 'Selected blanks need a positive finite sample SD.'); }
        const lod = view.lodMultiplier * computed.sd, loq = view.loqMultiplier * computed.sd;
        if (!Number.isFinite(lod) || !Number.isFinite(loq)) throw fail(422, 'LOD_LOQ_SD_INVALID', 'The proposed limits must be finite.');
        if (!Number.isSafeInteger(method.version) || method.version < 1) throw fail(409, 'LOD_LOQ_METHOD_VERSION_UNKNOWN', 'The current methodology version is unknown.');
        const at = new Date();
        const proposal = { series, ...computed, lod, loq, formula: 'K_TIMES_SAMPLE_SD', windowSize: view.windowSize,
            policy: view.policy, methodologyVersion: method.version, proposedMethodologyVersion: method.version + 1,
            proposedBy: by, proposedAt: at.toISOString(), reason: input.reason.trim(), applyDeferred: true, requestFingerprint,
            observations: view.points.map(row => ({ ...row, selected: selected.has(row.measurementId), exclusionReason: excluded.get(row.measurementId) || null })),
            historyExclusions: view.historyExclusions, excludedCounts: view.excludedCounts };
        await tx.auditLog.create({ data: { id: input.requestId, entity: 'METHODOLOGY', entityId: method.id, labId: lab.id,
            analysisCode: series.analysisCode, action: 'LOD_LOQ_PROPOSED', performedBy: by, timestamp: at, details: JSON.stringify(proposal) } });
        return { id: input.requestId, ...proposal };
    });
}
module.exports = { listSeries, readHistory, propose };
