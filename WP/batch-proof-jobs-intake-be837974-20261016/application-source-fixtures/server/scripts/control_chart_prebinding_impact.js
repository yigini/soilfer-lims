const Database = require('better-sqlite3');
const policyService = require('../services/policyService');
const qcRuleService = require('../services/qcRuleService');
const { validateRunSequence } = require('../services/qcRunSequenceValidation');

// No default Prisma import, connection pragmas, installer, or write API. Capture
// the required rows in one SQLite read transaction, then resolve policies from
// this injected, in-memory reader using the application's actual precedence.
const TABLES = ['Lab', 'Analysis', 'Methodology', 'LabPolicy', 'LabPolicyOverride', 'QcRule',
    'Batch', 'BatchAnalyte', 'BatchPosition', 'BatchPositionReference', 'BatchPositionWorkItem'];
const date = value => value == null ? null : new Date(value);
const same = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
function reader(rows) {
    return {
        lab: { findUnique: async ({ where }) => rows.Lab.find(row => same(row, where)) || null },
        analysis: { findUnique: async ({ where }) => rows.Analysis.find(row => same(row, where)) || null },
        labPolicy: { findUnique: async ({ where }) => rows.LabPolicy.find(row => same(row, where)) || null },
        labPolicyOverride: { findMany: async ({ where }) => rows.LabPolicyOverride.filter(row => same(row, where))
            .sort((a, b) => date(a.setAt) - date(b.setAt)) },
        qcRule: { findFirst: async ({ where }) => rows.QcRule.filter(row => row.labId === where.labId && row.analysisCode === where.analysisCode &&
            (row.methodologyId || null) === where.methodologyId && date(row.effectiveFrom) <= where.effectiveFrom.lte)
            .sort((a, b) => b.version - a.version)[0] || null }
    };
}
async function evaluateImpact(rows, { observedAt = new Date(), profile } = {}) {
    if (!Number.isFinite(observedAt.getTime())) throw new Error('A valid observation time is required.');
    const db = reader(rows), scopes = new Map(), add = (labId, analysisCode, methodologyId) => {
        const lab = rows.Lab.find(row => row.id === labId || row.code === labId);
        if (!lab) throw new Error(`Unknown laboratory in impact scope: ${labId}`);
        const scope = { labId: lab.id, analysisCode, methodologyId: methodologyId || null };
        scopes.set(JSON.stringify(scope), scope);
    };
    for (const lab of rows.Lab) for (const analysis of rows.Analysis.filter(row => !row.labId || [lab.id, lab.code].includes(row.labId))) {
        add(lab.id, analysis.code, null);
        for (const method of rows.Methodology.filter(row => row.analysisCode === analysis.code && (!row.labId || [lab.id, lab.code].includes(row.labId)))) {
            add(lab.id, analysis.code, method.id);
        }
    }
    for (const row of [...rows.QcRule, ...rows.LabPolicyOverride.filter(row => !row.revokedAt), ...rows.BatchAnalyte.filter(row => row.provenance === 'NATIVE')]) {
        if (row.labId && row.analysisCode) add(row.labId, row.analysisCode, row.methodologyId);
    }
    const contexts = [], resolved = new Map();
    for (const scope of [...scopes.values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))) {
        const policy = await policyService.snapshot(scope.labId, { db, ...scope, ...(profile !== undefined && { profile }) });
        const rule = await qcRuleService.resolve(scope.labId, scope.analysisCode, { db, methodologyId: scope.methodologyId,
            policySnapshot: policy, evaluatedAt: observedAt });
        const context = { ...scope, qcMode: policy.values['qc.mode'], lrmMode: rule.resolved.lrmMode.value,
            lrmPerBatch: rule.resolved.lrmPerBatch.value, policyVersion: policy.version,
            lrmModeSource: rule.resolved.lrmMode.source, ruleId: rule.id, ruleVersion: rule.version };
        contexts.push(context);
        resolved.set(JSON.stringify(scope), { ...scope, qcMode: context.qcMode, qcRule: rule,
            calibrationVerification: policy.values['qc.calibrationVerification'] });
    }
    const affectedRuns = [], sequenceRefusals = [];
    for (const batch of rows.Batch.filter(row => row.startedAt == null)) {
        const analytes = rows.BatchAnalyte.filter(row => row.batchId === batch.id);
        if (!analytes.length || analytes.some(row => row.provenance !== 'NATIVE')) continue;
        const analyses = analytes.map(row => {
            const lab = rows.Lab.find(item => item.id === (row.labId || batch.labId) || item.code === (row.labId || batch.labId));
            const scope = { labId: lab?.id, analysisCode: row.analysisCode, methodologyId: row.methodologyId || null };
            const criterion = resolved.get(JSON.stringify(scope));
            if (!criterion) throw new Error(`Unresolved created-run context: ${batch.id}/${row.analysisCode}`);
            const prior = rows.BatchAnalyte.filter(item => item.provenance === 'NATIVE' && item.crmOrdinal != null &&
                item.analysisCode === row.analysisCode && (item.methodologyId || null) === scope.methodologyId &&
                [lab.id, lab.code].includes(item.labId) && rows.Batch.some(run => run.id === item.batchId && run.startedAt != null)).length;
            return { ...criterion, crmOrdinal: prior + 1 };
        });
        const positions = rows.BatchPosition.filter(row => row.batchId === batch.id).map(row => ({ ...row,
            references: rows.BatchPositionReference.filter(ref => ref.positionId === row.id),
            workItems: rows.BatchPositionWorkItem.filter(link => link.positionId === row.id) }));
        const unbound = positions.filter(row => row.kind === 'LRM' && row.historicalSnapshotSeq == null).flatMap(position => analyses
            .filter(row => row.qcMode !== 'OFF' && row.qcRule.resolved.lrmMode.value === 'CONTROL_CHART' && row.qcRule.resolved.lrmPerBatch.value > 0 &&
                !position.references.some(ref => ref.analysisCode === row.analysisCode && !ref.supersededById && ref.serviceStatus !== 'NOT_SERVED'))
            .map(row => ({ positionId: position.id, sequenceIndex: position.position, analysisCode: row.analysisCode, methodologyId: row.methodologyId })));
        let sequenceReady = true;
        try { validateRunSequence({ positions, analyses }); }
        catch (error) {
            if (!error.code) throw error;
            sequenceReady = false;
            sequenceRefusals.push({ batchId: batch.id, code: error.code, details: error.details });
        }
        if (unbound.length) affectedRuns.push({ batchId: batch.id, labId: batch.labId, status: batch.status, sequenceReady, unbound });
    }
    const chartContexts = contexts.filter(row => row.lrmMode === 'CONTROL_CHART');
    return { observedAt: observedAt.toISOString(), access: 'SQLITE_READONLY_SNAPSHOT', productionMutations: 0,
        contextUniverse: 'Catalogue lab/analysis/generic-and-method contexts plus registered policy, QC-rule and Native-run scopes',
        counts: { contexts: contexts.length, controlChartContexts: chartContexts.length,
            controlChartLabs: new Set(chartContexts.map(row => row.labId)).size,
            controlChartAnalytes: new Set(chartContexts.map(row => JSON.stringify([row.labId, row.analysisCode]))).size,
            controlChartMethods: chartContexts.filter(row => row.methodologyId).length,
            createdUnstartedNativeRunsWithUnboundLrm: affectedRuns.length,
            unboundLrmPlacements: affectedRuns.reduce((n, row) => n + row.unbound.length, 0),
            otherSequenceRefusals: sequenceRefusals.length },
        controlChartContexts: chartContexts, affectedRuns, sequenceRefusals };
}
async function collectReadonly(dbPath, options = {}) {
    if (typeof dbPath !== 'string' || !dbPath) throw new Error('An explicit existing SQLite path is required.');
    const connection = new Database(dbPath, { readonly: true, fileMustExist: true });
    let rows;
    try { rows = connection.transaction(() => Object.fromEntries(TABLES.map(table => [table, connection.prepare(`SELECT * FROM "${table}"`).all()])))(); }
    finally { connection.close(); }
    return evaluateImpact(rows, options);
}
if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--db' || !args[1]) {
        process.stderr.write('Usage: node scripts/control_chart_prebinding_impact.js --db /explicit/existing/database.sqlite\n');
        process.exitCode = 1;
    } else collectReadonly(args[1]).then(report => process.stdout.write(JSON.stringify(report, null, 2) + '\n')).catch(error => {
        process.stderr.write(JSON.stringify({ code: error.code || 'QC_CHART_IMPACT_UNAVAILABLE', message: error.message }) + '\n');
        process.exitCode = 1;
    });
}
module.exports = { collectReadonly, evaluateImpact };
