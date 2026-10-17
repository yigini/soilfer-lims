'use strict';

const prisma = require('../prisma');
const policyService = require('./policyService');
const scopeGuard = require('../utils/scopeGuard');
const { hasPermission } = require('../config/roles');
const { eligibility } = require('./referenceMaterialRules');
const { qualificationAtRead } = require('./equipmentQualificationService');
const { activeReopenEvent } = require('./qcRunViewService');
const { unresolvedQcWhere } = require('./qcRunGateService');

const DAY = 86400000;
const fail = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });

// #215 scope pin 6241038348: current batch/analyte, then its evaluation date.
// A superseded failure is not another evaluated run. An accepted deviation
// does not turn the retained FAIL verdict into a PASS.
function qcRates(batches, since, asOf) {
    const groups = new Map();
    for (const batch of batches) for (const { analysisCode } of batch.analytes) {
        const evaluation = batch.evaluations.filter(row => row.analysisCode === analysisCode)
            .reduce((latest, row) => !latest || row.version > latest.version ? row : latest, null);
        const evaluatedAt = evaluation?.evaluatedAt ? new Date(evaluation.evaluatedAt) : null;
        if (evaluatedAt && (evaluatedAt < since || evaluatedAt > asOf)) continue;
        const row = groups.get(analysisCode) || { analysisCode, evaluated: 0, failed: 0, notEvaluable: 0, undated: 0 };
        if (!evaluatedAt || !['PASS', 'WARN', 'FAIL'].includes(evaluation.verdict) || activeReopenEvent(batch, analysisCode)) {
            row.notEvaluable++; if (!evaluatedAt) row.undated++;
        } else {
            row.evaluated++; if (evaluation.verdict === 'FAIL') row.failed++;
        }
        groups.set(analysisCode, row);
    }
    return [...groups.values()].sort((a, b) => a.analysisCode.localeCompare(b.analysisCode))
        .map(row => ({ ...row, rate: row.evaluated ? row.failed / row.evaluated : null }));
}

async function repeatRates(tx, labId, since, asOf) {
    // Match the facility precedence in scopeGuard: explicit work assignment,
    // then sample assignment, then the legacy primary lab. Never widen to an
    // OR of unrelated historical and current facilities.
    const unassigned = { OR: [{ assignedLab: null }, { assignedLab: '' }] };
    const attempts = await tx.workAttempt.findMany({ where: {
        createdAt: { gte: since, lte: asOf }, evidenceHash: { not: null }, evidenceData: { not: null }, status: { not: 'OPEN' },
        workItem: { OR: [{ assignedLab: labId }, { AND: [unassigned, { sample: { assignedLab: labId } }] },
            { AND: [unassigned, { sample: unassigned }, { labId }] }] }
    }, select: { id: true, workItemId: true, author: true, executedMethodRevision: true } });
    const children = [], results = [];
    // Keep SQLite parameter lists bounded without truncating the cohort.
    for (let index = 0; index < attempts.length; index += 500) {
        const ids = attempts.slice(index, index + 500).map(row => row.id);
        children.push(...await tx.workAttempt.findMany({ where: { parentAttemptId: { in: ids }, requestedAt: { lte: asOf } },
            select: { parentAttemptId: true, workItemId: true, reason: true } }));
        results.push(...await tx.result.findMany({ where: { attemptId: { in: ids } }, select: { attemptId: true, methodologyId: true } }));
    }
    const reasonsByParent = new Map(), methodsByAttempt = new Map();
    const owners = new Map(attempts.map(row => [row.id, row.workItemId]));
    for (const child of children) {
        if (owners.get(child.parentAttemptId) !== child.workItemId) continue;
        const reasons = reasonsByParent.get(child.parentAttemptId) || new Set();
        reasons.add(child.reason || 'UNKNOWN'); reasonsByParent.set(child.parentAttemptId, reasons);
    }
    // Corrections retain their attempt id and cannot create a child request.
    // Every retained Result participates: missing/mixed method history stays
    // unknown, even if today's WorkItem now has a different method assigned.
    for (const result of results) {
        const methods = methodsByAttempt.get(result.attemptId) || new Set();
        methods.add(result.methodologyId); methodsByAttempt.set(result.attemptId, methods);
    }
    const byReason = new Map(), byAnalystMethod = new Map(); let repeated = 0;
    for (const attempt of attempts) {
        const reasons = reasonsByParent.get(attempt.id) || new Set(), methods = methodsByAttempt.get(attempt.id);
        const methodologyId = methods?.size === 1 ? [...methods][0] : null;
        const analyst = attempt.author || null, methodRevision = methodologyId ? attempt.executedMethodRevision : null;
        const key = JSON.stringify([analyst, methodologyId, methodRevision]);
        const row = byAnalystMethod.get(key) || { analyst, methodologyId, methodRevision, executions: 0, repeated: 0 };
        row.executions++; if (reasons.size) { row.repeated++; repeated++; }
        byAnalystMethod.set(key, row);
        for (const reason of reasons) byReason.set(reason, (byReason.get(reason) || 0) + 1);
    }
    const withRate = row => ({ ...row, rate: row.executions ? row.repeated / row.executions : null });
    return { ...withRate({ executions: attempts.length, repeated }),
        byReason: [...byReason].sort(([a], [b]) => a.localeCompare(b))
            .map(([reason, count]) => withRate({ reason, repeated: count, executions: attempts.length })),
        byAnalystMethod: [...byAnalystMethod].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => withRate(row)) };
}

// One explicit laboratory and one read transaction: summary cards and their
// detail rows must describe the same snapshot and canonical lab identity.
async function getQaDashboard(actor, query = {}, { db = prisma, now = new Date() } = {}) {
    if (!hasPermission(actor, 'VIEW_AUDIT') || actor.isActive === false || actor.status === 'INACTIVE') {
        throw fail(403, 'QA_DASHBOARD_FORBIDDEN', 'QA dashboard permission required.');
    }
    const days = query.days === undefined ? 30 : Number(query.days);
    if (query.days !== undefined && !['string', 'number'].includes(typeof query.days) ||
        !['30', '90'].includes(String(query.days ?? 30)) || ![30, 90].includes(days)) {
        throw fail(400, 'QA_DASHBOARD_WINDOW_INVALID', 'Choose a 30 or 90 day window.');
    }
    if (query.labId !== undefined && (typeof query.labId !== 'string' || !query.labId.trim())) {
        throw fail(400, 'QA_DASHBOARD_LAB_INVALID', 'Choose a laboratory.');
    }
    const asOf = new Date(now), since = new Date(asOf.getTime() - days * DAY);
    const expiryThrough = new Date(asOf.getTime() + 30 * DAY);
    return db.$transaction(async tx => {
        const actorLab = await policyService.resolveLab(actor.labId, tx);
        const scopedActor = { ...actor, labId: actorLab?.id || actor.labId };
        const catalogue = await tx.lab.findMany({ select: { id: true, code: true, name: true, country: true },
            orderBy: [{ name: 'asc' }, { id: 'asc' }] });
        const laboratories = catalogue.filter(lab => scopeGuard.canAccessEntity(scopedActor, lab,
            { labField: 'id', altLabField: null }));
        const reference = query.labId ?? actorLab?.id ?? laboratories[0]?.id;
        const lab = laboratories.find(row => row.id === reference) || laboratories.find(row => row.code === reference);
        if (!lab) throw fail(403, 'QA_DASHBOARD_SCOPE_DENIED', 'Laboratory is outside your scope.');
        scopeGuard.ensureScope(scopedActor, lab, { labField: 'id', altLabField: null });

        const [openNcrs, materials, assets, ptResults, awaitingDisposition, batches, repeats] = await Promise.all([
            tx.nonconformityReport.count({ where: { labId: lab.id, status: { in: ['OPEN', 'ACTION'] } } }),
            tx.referenceMaterial.findMany({ where: { labId: lab.id, status: 'ACTIVE' },
                select: { id: true, code: true, name: true, labId: true, status: true, expiryDate: true, inventoryLotId: true,
                    inventoryLot: { select: { labId: true, status: true, expiryDate: true } } } }),
            tx.equipmentAsset.findMany({ where: { labId: lab.id, status: { not: 'DECOMMISSIONED' } },
                select: { id: true, name: true, internalAssetTag: true, status: true, criticality: true, qualification: true,
                    scheduleRules: { where: { active: true, scheduleType: 'CALIBRATION' } } } }),
            tx.proficiencyRound.findMany({ where: { labId: lab.id, deletedAt: null, date: { gte: since, lte: asOf } },
                select: { id: true, analysisCode: true, provider: true, roundRef: true, date: true, assignedValue: true,
                    labResult: true, zScore: true, outcome: true, legacyScoreFlag: true }, orderBy: [{ date: 'asc' }, { id: 'asc' }] }),
            tx.batch.count({ where: { labId: lab.id, AND: [unresolvedQcWhere()] } }),
            tx.batch.findMany({ where: { labId: lab.id }, select: { id: true, analytes: { select: { analysisCode: true } },
                evaluations: { where: { OR: [{ evaluatedAt: { lte: asOf } }, { evaluatedAt: null }] },
                    select: { id: true, analysisCode: true, version: true, verdict: true, evaluatedAt: true } },
                events: { where: { type: 'REOPENED', at: { lte: asOf } }, select: { type: true, at: true, payload: true } } } }),
            repeatRates(tx, lab.id, since, asOf)
        ]);
        const expiringMaterials = materials.flatMap(material => {
            // The inventory expiry can be earlier than the certificate expiry.
            // A link to another laboratory is never used to disclose its data.
            if (material.inventoryLotId && material.inventoryLot?.labId !== lab.id) return [];
            const { effectiveExpiry } = eligibility(material, asOf);
            return effectiveExpiry > asOf && effectiveExpiry <= expiryThrough
                ? [{ id: material.id, code: material.code, name: material.name, expiresAt: effectiveExpiry }] : [];
        }).sort((a, b) => a.expiresAt - b.expiresAt || a.id.localeCompare(b.id));
        const calibrationDue = assets.flatMap(asset => {
            const qualification = qualificationAtRead(asset, asOf);
            const dueAt = qualification?.nextCalibrationDueDate;
            const dueSoonDays = asset.scheduleRules[0]?.dueSoonDays;
            const status = qualification?.calibrationStatus;
            const due = ['FAILED', 'OVERDUE', 'DUE_SOON'].includes(status) || dueAt &&
                new Date(dueAt).getTime() <= asOf.getTime() + (dueSoonDays ?? 0) * DAY;
            if (!due) return [];
            return [{ id: asset.id, name: asset.name, tag: asset.internalAssetTag, dueAt,
                status: status === 'FAILED' ? status : dueAt && new Date(dueAt) <= asOf ? 'OVERDUE'
                    : dueAt && status !== 'OVERDUE' ? 'DUE_SOON' : status }];
        }).sort((a, b) => new Date(a.dueAt || 0) - new Date(b.dueAt || 0) || a.id.localeCompare(b.id));
        return { lab, laboratories: laboratories.map(({ id, code, name }) => ({ id, code, name })),
            asOf, window: { days, since, through: asOf }, expiryThrough,
            awaitingDisposition, qcFailures: qcRates(batches, since, asOf), repeats,
            openNcrs, expiringMaterials, calibrationDue, ptResults };
    }, { timeout: 15000 });
}

module.exports = { getQaDashboard };
