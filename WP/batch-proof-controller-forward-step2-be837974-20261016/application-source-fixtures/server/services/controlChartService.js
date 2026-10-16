const { randomUUID, createHash } = require('node:crypto');
const { hasPermission } = require('../config/roles');
const scopeGuard = require('../utils/scopeGuard');
const policyService = require('./policyService');
const { inTransaction, actorName } = require('./workflowStateRules');
const { QC_RUN_INCLUDE, currentAnalyteEvidence } = require('./qcRunViewService');
const { ordered, statistics, evaluateSeries } = require('./controlChartRules');
const fail = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const parsed = value => typeof value === 'string' ? JSON.parse(value) : value;
const seriesWhere = ({ labId, analysisCode, methodologyId, referenceMaterialId }) => ({ labId, analysisCode, methodologyId, referenceMaterialId });
function permission(actor, name) {
    if (!hasPermission(actor, name)) throw fail(403, 'QC_CHART_PERMISSION_REQUIRED', 'Control chart permission is required.');
    return actorName(actor);
}
async function scopedSeries(db, actor, input, access = 'VIEW_ANALYTICAL_RESULTS') {
    permission(actor, access);
    if (!input || ['labId', 'analysisCode', 'methodologyId', 'referenceMaterialId'].some(key => typeof input[key] !== 'string' || !input[key])) {
        throw fail(400, 'QC_CHART_SERIES_INVALID', 'Provide the complete control series.');
    }
    const lab = await policyService.resolveLab(input.labId, db), actorLab = await policyService.resolveLab(actor.labId, db);
    if (!lab) throw fail(404, 'QC_CHART_SERIES_NOT_FOUND', 'Control series not found.');
    scopeGuard.ensureScope({ ...actor, labId: actorLab?.id || actor.labId }, { labId: lab.id }, { labField: 'labId', altLabField: null });
    const [method, material] = await Promise.all([db.methodology.findUnique({ where: { id: input.methodologyId } }),
        db.referenceMaterial.findUnique({ where: { id: input.referenceMaterialId } })]);
    if (!method || method.analysisCode !== input.analysisCode || method.labId && ![lab.id, lab.code].includes(method.labId) ||
        !material || material.labId !== lab.id || !['CRM', 'LRM', 'CHECK_STANDARD'].includes(material.kind)) {
        throw fail(422, 'QC_CHART_SERIES_INVALID', 'The method and reference lot must belong to this laboratory and analysis.');
    }
    return { ...seriesWhere(input), labId: lab.id };
}
function fixedBasis(criteria, referenceSnapshot) {
    const values = Object.fromEntries(Object.entries(criteria.qcRule.resolved).map(([key,row]) => [key,row.value]));
    const expected = referenceSnapshot.expected;
    const low = values.lrmWindowPct == null ? values.crmRecoveryMin : 100 - values.lrmWindowPct;
    const high = values.lrmWindowPct == null ? values.crmRecoveryMax : 100 + values.lrmWindowPct;
    const window = { expected, lower: expected * low / 100, upper: expected * high / 100 };
    if (!Number.isFinite(expected) || expected <= 0 || !Number.isFinite(window.lower) || !Number.isFinite(window.upper)) {
        throw fail(422, 'QC_CHART_BASIS_INVALID', 'The frozen reference needs a finite fixed window.');
    }
    const mode = values.lrmMode === 'CONTROL_CHART' ? 'PROVISIONAL' : 'FIXED_WINDOW';
    return { mode, fixedWindow: window, key: fingerprint({ mode, window }) };
}
function storedBasis(details, check, criteria) {
    const chart = details.evaluation?.controlCharts?.find(row => row.series.referenceMaterialId === check.referenceMaterialId);
    if (chart) return chart.basis;
    // Older evaluations can supply proposal points from their own retained
    // fixed-window criteria. No catalogue value or current policy is consulted.
    if (!criteria?.qcRule?.resolved || !check.referenceSnapshot) return null;
    return fixedBasis(criteria, check.referenceSnapshot);
}
async function observations(db, series) {
    const rows = await db.batchAnalyte.findMany({ where: { labId: series.labId, analysisCode: series.analysisCode,
        methodologyId: series.methodologyId, provenance: 'NATIVE' }, include: { batch: { include: QC_RUN_INCLUDE } } });
    const points = [];
    for (const row of rows) {
        const batch = row.batch, evidence = currentAnalyteEvidence(batch, series.analysisCode);
        if (!evidence.evaluation || evidence.result === null) continue;
        const details = parsed(evidence.evaluation.details), criteria = row.criteriaSnapshot && parsed(row.criteriaSnapshot);
        const evaluatedIds = new Set(details.measurementIds || []);
        for (const position of evidence.positions.filter(item => item.kind === 'LRM')) {
            const reference = position.references?.find(item => item.analysisCode === series.analysisCode && !item.supersededById &&
                item.serviceStatus !== 'NOT_SERVED' && item.referenceMaterialId === series.referenceMaterialId);
            if (!reference) continue;
            const check = (details.evaluation?.controls || []).find(item => item.positionId === position.id || item.id === position.id);
            if (!check) continue;
            const basis = storedBasis(details, check, criteria);
            if (!basis) continue;
            for (const measurement of evidence.measurements.filter(item => item.positionId === position.id && evaluatedIds.has(item.id))) {
                if (measurement.supersededById || measurement.censoring || !Number.isFinite(measurement.value)) continue;
                points.push({ measurementId: measurement.id, runId: batch.id, executionTime: batch.startedAt,
                    sequenceIndex: position.position, value: measurement.value, basisKey: basis.key,
                    evaluationId: evidence.evaluation.id, verdict: evidence.evaluation.verdict, inControl: check.status === 'PASS', basis,
                    referenceMaterialId: series.referenceMaterialId, analysisUnit: parsed(reference.referenceSnapshot)?.analysisUnit || null,
                    replacesMeasurementId: batch.measurements.find(old => old.supersededById === measurement.id)?.id || null });
            }
        }
    }
    return ordered(points);
}
async function freezeRunCharts(db, batch, analyte, criteria, servedPositions) {
    if (criteria.qcMode === 'OFF' || criteria.qcRule.resolved.lrmMode.value !== 'CONTROL_CHART') return [];
    const servedIds = new Set(servedPositions.filter(row => row.kind === 'LRM' && row.servedAnalytes.includes(analyte.analysisCode)).map(row => row.id));
    for (const position of servedPositions.filter(row => servedIds.has(row.id))) {
        const bound = batch.positions.find(row => row.id === position.id)?.references?.some(row => row.analysisCode === analyte.analysisCode && !row.supersededById && row.serviceStatus !== 'NOT_SERVED');
        if (!bound) throw fail(422, 'QC_CHART_LOT_REQUIRED', `Bind the LRM lot at QC position ${position.position} (${position.id}) before starting the run.`);
    }
    const bindings = batch.positions.filter(position => servedIds.has(position.id)).flatMap(position => position.references || [])
        .filter(reference => reference.analysisCode === analyte.analysisCode && !reference.supersededById && reference.serviceStatus !== 'NOT_SERVED');
    const result = [];
    for (const reference of bindings) {
        if (result.some(row => row.series.referenceMaterialId === reference.referenceMaterialId)) continue;
        const series = { labId: batch.labId, analysisCode: analyte.analysisCode, methodologyId: analyte.methodologyId,
            referenceMaterialId: reference.referenceMaterialId };
        const minimumPoints = criteria.policySnapshot.values['qc.controlChartMinPoints'];
        if (!Number.isSafeInteger(minimumPoints) || minimumPoints < 2) throw fail(422, 'QC_CHART_POLICY_INVALID', 'A frozen chart minimum is required.');
        let basis = fixedBasis(criteria, parsed(reference.referenceSnapshot));
        const set = basis.mode === 'PROVISIONAL' ? await db.controlLimitSet.findFirst({ where: { ...series, status: 'APPROVED' } }) : null;
        if (set && set.n >= minimumPoints) basis = { mode: 'CONTROL_CHART', key: 'set:' + set.id, controlLimitSetId: set.id,
            mean: set.mean, sd: set.sd, n: set.n, fromDate: set.fromDate, approvedBy: set.approvedBy };
        const all = basis.mode === 'FIXED_WINDOW' ? [] : await observations(db, series);
        // Do not carry observations over a limit-basis/mode transition.
        let start = all.length;
        while (start > 0 && all[start - 1].basisKey === basis.key) start--;
        result.push({ series, basis, minimumPoints, history: all.slice(start),
            positions: batch.positions.filter(position => servedIds.has(position.id)).flatMap(position => (position.references || [])
                .filter(row => row.analysisCode === analyte.analysisCode && !row.supersededById && row.serviceStatus !== 'NOT_SERVED' && row.referenceMaterialId === reference.referenceMaterialId)
                .map(row => ({ positionId: position.id, bindingId: row.id, referenceMaterialId: row.referenceMaterialId, referenceValueId: row.referenceValueId }))),
            referenceSnapshot: parsed(reference.referenceSnapshot), rules: criteria.policySnapshot.values['qc.westgardRules'] });
    }
    return result;
}
function evaluateRunCharts(batch, analyte, evidence) {
    const criteria = parsed(analyte.criteriaSnapshot);
    // Runs started before #214 retain their original behaviour byte for byte.
    if (!Object.hasOwn(criteria, 'controlCharts')) return [];
    const contexts = criteria.controlCharts;
    const references = evidence.positions.filter(row => row.kind === 'LRM').flatMap(position => (position.references || [])
        .filter(reference => reference.analysisCode === analyte.analysisCode && !reference.supersededById && reference.serviceStatus !== 'NOT_SERVED')
        .map(reference => ({ position, reference })));
    for (const { reference } of references) if (criteria.qcRule.resolved.lrmMode.value === 'CONTROL_CHART' &&
        !contexts.some(row => row.series.referenceMaterialId === reference.referenceMaterialId)) {
        throw fail(409, 'QC_CHART_REFERENCE_FROZEN', 'The started run has no frozen limit basis for this reference lot.');
    }
    return contexts.map(context => {
        const positions = references.filter(row => row.reference.referenceMaterialId === context.series.referenceMaterialId);
        if (criteria.qcRule.resolved.lrmMode.value === 'CONTROL_CHART' && positions.some(({ position }) => !context.positions.some(row => row.positionId === position.id))) {
            throw fail(409, 'QC_CHART_LOT_FROZEN', 'The started control-chart position must keep its frozen lot.');
        }
        const current = positions.flatMap(({position}) => evidence.measurements.filter(row => row.positionId === position.id)
            .map(row => ({ measurementId: row.id, runId: batch.id, executionTime: batch.startedAt, sequenceIndex: position.position,
                value: row.censoring ? NaN : row.value, basisKey: context.basis.key })));
        return { series: context.series, minimumPoints: context.minimumPoints,
            ...evaluateSeries({ basis: context.basis, history: context.history, current, rules: context.rules }) };
    });
}
async function listSeries(db, actor, labReference) {
    permission(actor, 'VIEW_ANALYTICAL_RESULTS');
    const lab = await policyService.resolveLab(labReference || actor.labId, db), actorLab = await policyService.resolveLab(actor.labId, db);
    if (!lab) throw fail(404, 'QC_CHART_SERIES_NOT_FOUND', 'Laboratory not found.');
    scopeGuard.ensureScope({ ...actor, labId: actorLab?.id || actor.labId }, { labId: lab.id }, { labField:'labId',altLabField:null });
    const references = await db.batchPositionReference.findMany({ where: { referenceUse:'LRM', supersededById:null,
        position:{ batch:{labId:lab.id} } }, include:{referenceMaterial:true,position:{include:{batch:{include:{analytes:true}}}}} });
    const unique = new Map();
    for (const reference of references) {
        const analyte = reference.position.batch.analytes.find(row => row.analysisCode === reference.analysisCode && row.methodologyId && row.provenance === 'NATIVE');
        if (!analyte) continue;
        const series = { labId:lab.id,analysisCode:analyte.analysisCode,methodologyId:analyte.methodologyId,referenceMaterialId:reference.referenceMaterialId,
            lotNumber:reference.referenceMaterial.lotNumber,referenceName:reference.referenceMaterial.name };
        unique.set(JSON.stringify(seriesWhere(series)),series);
    }
    return [...unique.values()];
}
async function readSeries(db, actor, input) {
    return inTransaction(db, async tx => {
        const series = await scopedSeries(tx, actor, input), points = await observations(tx, series);
        const policy = await policyService.snapshot(series.labId, { db:tx,analysisCode:series.analysisCode,methodologyId:series.methodologyId });
        const [sets, proposals] = await Promise.all([tx.controlLimitSet.findMany({where:series,orderBy:{fromDate:'desc'}}),
            tx.controlLimitProposal.findMany({where:series,include:{approvedSet:true},orderBy:{proposedAt:'desc'}})]);
        const current = sets.find(row => row.status === 'APPROVED') || null;
        const minimumPoints = policy.values['qc.controlChartMinPoints'];
        const rule = await require('./qcRuleService').resolve(series.labId, series.analysisCode, { db:tx,methodologyId:series.methodologyId,policySnapshot:policy });
        const mode = rule.resolved.lrmMode.value === 'FIXED_WINDOW' ? 'FIXED_WINDOW' : !current || current.n < minimumPoints ? 'PROVISIONAL' : 'CONTROL_CHART';
        return { series, points, sets, proposals:proposals.map(row => ({...row,selectionSnapshot:parsed(row.selectionSnapshot),policySnapshot:parsed(row.policySnapshot)})),
            current, minimumPoints, mode, provisional: mode === 'PROVISIONAL',
            canPropose:hasPermission(actor,'CHANGE_STATUS'),canApprove:hasPermission(actor,'APPROVE_CONTROL_LIMITS') };
    });
}
async function propose(db, actor, input) {
    return inTransaction(db, async tx => {
        const series = await scopedSeries(tx, actor, input, 'CHANGE_STATUS'), by = actorName(actor);
        if (typeof input.reason !== 'string' || !input.reason.trim() || !Array.isArray(input.selectedMeasurementIds) ||
            !Array.isArray(input.exclusions) || input.exclusions.some(row => !row || typeof row.measurementId !== 'string' || typeof row.reason !== 'string' || !row.reason.trim())) {
            throw fail(400,'QC_CHART_PROPOSAL_INVALID','Select points and document every exclusion and the proposal reason.');
        }
        const eligible = (await observations(tx,series)).filter(row => row.inControl);
        const selected = new Set(input.selectedMeasurementIds), excluded = new Map(input.exclusions.map(row => [row.measurementId,row.reason.trim()]));
        if (selected.size !== input.selectedMeasurementIds.length || excluded.size !== input.exclusions.length ||
            [...selected].some(id => !eligible.some(row => row.measurementId === id) || excluded.has(id)) ||
            [...excluded.keys()].some(id => !eligible.some(row => row.measurementId === id)) || eligible.some(row => !selected.has(row.measurementId) && !excluded.has(row.measurementId))) {
            throw fail(422,'QC_CHART_SELECTION_INVALID','Every eligible observation must be explicitly selected or excluded with a reason.');
        }
        const policy = await policyService.snapshot(series.labId,{db:tx,analysisCode:series.analysisCode,methodologyId:series.methodologyId});
        if (selected.size < policy.values['qc.controlChartMinPoints']) throw fail(422,'QC_CHART_MIN_POINTS_REQUIRED','Too few selected in-control points for the frozen policy.');
        const effective = eligible.filter(row => selected.has(row.measurementId));
        const computed = statistics(effective.map(row => row.value)), now = new Date();
        const proposal = await tx.controlLimitProposal.create({ data:{id:randomUUID(),...series,...computed,reason:input.reason.trim(),proposedBy:by,proposedAt:now,
            selectionSnapshot:JSON.stringify(eligible.map(row => ({...row,selected:selected.has(row.measurementId),exclusionReason:excluded.get(row.measurementId)||null}))),
            policySnapshot:JSON.stringify(policy)} });
        await tx.auditLog.create({data:{id:randomUUID(),entity:'CONTROL_LIMIT_PROPOSAL',entityId:proposal.id,labId:series.labId,action:'CONTROL_LIMITS_PROPOSED',performedBy:by,timestamp:now,
            details:JSON.stringify({proposalId:proposal.id,series,n:computed.n,selectionSnapshot:proposal.selectionSnapshot})}});
        return proposal;
    });
}
async function approve(db, actor, proposalId) {
    permission(actor,'APPROVE_CONTROL_LIMITS');
    return inTransaction(db,async tx => {
        const proposal = await tx.controlLimitProposal.findUnique({where:{id:proposalId},include:{approvedSet:true}});
        if (!proposal) throw fail(404,'QC_CHART_PROPOSAL_NOT_FOUND','Proposal not found.');
        const series = await scopedSeries(tx,actor,proposal,'APPROVE_CONTROL_LIMITS'), by=actorName(actor);
        if (proposal.proposedBy === by) throw fail(403,'QC_CHART_SECOND_PERSON_REQUIRED','A different named user must approve the proposal.');
        if (proposal.approvedSet) return proposal.approvedSet;
        // Validate the retained proposal; never recalculate it from live values.
        const snapshot=parsed(proposal.policySnapshot), selected=parsed(proposal.selectionSnapshot).filter(row=>row.selected);
        if (proposal.n !== selected.length || proposal.n < snapshot.values['qc.controlChartMinPoints']) throw fail(409,'QC_CHART_PROPOSAL_INVALID','The frozen proposal does not meet its policy.');
        const now=new Date();
        await tx.controlLimitSet.updateMany({where:{...series,status:'APPROVED'},data:{status:'SUPERSEDED',toDate:now}});
        const set=await tx.controlLimitSet.create({data:{id:randomUUID(),...series,proposalId,mean:proposal.mean,sd:proposal.sd,n:proposal.n,fromDate:now,approvedBy:by,status:'APPROVED'}});
        await tx.auditLog.create({data:{id:randomUUID(),entity:'CONTROL_LIMIT_SET',entityId:set.id,labId:series.labId,action:'CONTROL_LIMITS_APPROVED',performedBy:by,timestamp:now,
            details:JSON.stringify({proposalId,setId:set.id,series})}});
        return set;
    });
}
async function createReviews(db, evaluation, labId) {
    const charts=parsed(evaluation.details).evaluation?.controlCharts || [];
    for (const rule of new Set(charts.flatMap(row=>row.review))) {
        const snapshot=charts.filter(row=>row.review.includes(rule));
        await db.qcReviewObligation.upsert({where:{evaluationId_rule:{evaluationId:evaluation.id,rule}},update:{},
            create:{id:randomUUID(),labId,evaluationId:evaluation.id,rule,evidenceSnapshot:JSON.stringify(snapshot)}});
    }
}
async function reviews(db, actor, labReference) {
    permission(actor,'VIEW_ANALYTICAL_RESULTS');
    const lab=await policyService.resolveLab(labReference || actor.labId,db), actorLab=await policyService.resolveLab(actor.labId,db);
    if (!lab) throw fail(404,'QC_CHART_SERIES_NOT_FOUND','Laboratory not found.');
    scopeGuard.ensureScope({...actor,labId:actorLab?.id||actor.labId},{labId:lab.id},{labField:'labId',altLabField:null});
    const rows=await db.qcReviewObligation.findMany({where:{labId:lab.id},include:{resolutions:true,evaluation:{select:{batchId:true,analysisCode:true}}},orderBy:{createdAt:'desc'}});
    return {canResolve:hasPermission(actor,'APPROVE_CONTROL_LIMITS'),obligations:rows.map(row=>({...row,status:row.resolutions.length?'RESOLVED':'OPEN',ownerPermission:'APPROVE_CONTROL_LIMITS',evidenceSnapshot:parsed(row.evidenceSnapshot)}))};
}
async function resolveReview(db, actor, obligationId, input) {
    const by=permission(actor,'APPROVE_CONTROL_LIMITS');
    if (!['NO_ACTION','INVESTIGATE_NEW_LIMITS'].includes(input?.outcome) || typeof input.note !== 'string' || !input.note.trim()) {
        throw fail(400,'QC_CHART_RESOLUTION_INVALID','A supported outcome and note are required.');
    }
    return inTransaction(db,async tx=>{
        const obligation=await tx.qcReviewObligation.findUnique({where:{id:obligationId},include:{resolutions:true}});
        if (!obligation) throw fail(404,'QC_CHART_REVIEW_NOT_FOUND','Review obligation not found.');
        const actorLab=await policyService.resolveLab(actor.labId,tx);
        scopeGuard.ensureScope({...actor,labId:actorLab?.id||actor.labId},obligation,{labField:'labId',altLabField:null});
        if (obligation.resolutions.length) throw fail(409,'QC_CHART_REVIEW_RESOLVED','The retained resolution cannot be overwritten.');
        const now=new Date(),resolution=await tx.qcReviewResolution.create({data:{id:randomUUID(),obligationId,outcome:input.outcome,note:input.note.trim(),resolvedBy:by,resolvedAt:now}});
        await tx.auditLog.create({data:{id:randomUUID(),entity:'QC_REVIEW',entityId:obligationId,labId:obligation.labId,action:'QC_REVIEW_RESOLVED',performedBy:by,timestamp:now,
            details:JSON.stringify({resolutionId:resolution.id,outcome:input.outcome,note:resolution.note})}});
        return resolution;
    });
}
module.exports={scopedSeries,seriesWhere,fixedBasis,observations,freezeRunCharts,evaluateRunCharts,listSeries,readSeries,propose,approve,createReviews,reviews,resolveReview};
