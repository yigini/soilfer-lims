const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const rules = require('../../services/workflowStateRules');
const { canonicalWorkItemWhere } = require('../../services/workAttemptContract');
const { allocateExecution, insertExecution } = require('../../services/workAttemptWriteService');
const { createResultFixture } = require('../../services/resultWriteService');

// #190 pin6056586906: positive fixtures explicitly request a complete recorded
// execution. Missing canonical work is refused, never manufactured here.
async function assertExecutionFixtureDatabase(db) {
    rules.assertFixtureContext();
    const databases = await db.$queryRawUnsafe('PRAGMA database_list');
    const file = databases.find(row => row.name === 'main')?.file;
    if (!file || !fs.existsSync(file)) throw Error('Execution fixture requires an owned database file.');
    const resolved = fs.realpathSync(file);
    const relative = path.relative(path.resolve(__dirname, '../..'), resolved).replace(/\\/g, '/');
    if (!/^tests\/\.tmp\/[^/]+\.db$/.test(relative)) throw Error('Execution fixture refuses a non-test-owned file.');
    if (process.env.PRODUCTION_DATABASE_PATH && resolved.toLowerCase() ===
        path.resolve(process.env.PRODUCTION_DATABASE_PATH).toLowerCase()) throw Error('Execution fixture refuses production.');
}

async function insertFixtureExecution(tx, ctx, allocation, evidence, attemptStatus) {
    if (['ACCEPTED', 'SUBMITTED'].includes(attemptStatus)) {
        // Pins6057445449 /6059085200: explicit final status must match the work.
        if (ctx.item.status !== attemptStatus) throw Error('Final fixture evidence requires matching canonical work.');
        const evidenceData = JSON.stringify({ ...evidence, equipmentReadiness: ctx.equipmentReadiness }), now = new Date();
        await tx.workAttempt.create({ data: { id: allocation.id, workItemId: ctx.item.id, attemptNo: allocation.attemptNo,
            status: attemptStatus, reason: allocation.reason, author: ctx.performedBy, authorName: ctx.performedBy,
            batchId: ctx.batchId, qcBatchId: ctx.batchId, instrumentId: ctx.equipmentReadiness?.equipmentId || null,
            executedMethodRevision: null, version: (ctx.item.version || 0) + 1, evidenceData,
            evidenceHash: createHash('sha256').update(evidenceData).digest('hex'), createdAt: now, updatedAt: now } });
    } else {
        if (attemptStatus != null && attemptStatus !== 'RECORDED') throw Error('Unknown positive fixture attempt status.');
        await insertExecution(tx, ctx, allocation, evidence, new Date());
    }
}

async function createExecutionResultFixture(db, args) {
    const { attemptStatus, textureSourceResultIds, ...resultArgs } = args;
    await assertExecutionFixtureDatabase(db);
    return rules.inTransaction(db, async tx => {
        const data = args.data;
        if (!data?.id || data.attemptId != null) throw Error('Execution fixture requires a new Result id without a supplied attempt.');
        const items = await tx.workItem.findMany({ where: canonicalWorkItemWhere(data.sampleId, data.param) });
        if (items.length !== 1) throw Error('Execution fixture requires exactly one existing canonical WorkItem.');
        const item = items[0];
        const equipmentReadiness = data.equipmentReadiness ? JSON.parse(data.equipmentReadiness) : null;
        let textureSources;
        if (textureSourceResultIds != null) {
            // Pin6059445324: explicit, already-recorded separate fraction owners.
            if (data.param !== 'TEXTURE' || attemptStatus != null && attemptStatus !== 'RECORDED' ||
                equipmentReadiness || !Array.isArray(textureSourceResultIds) || textureSourceResultIds.length !== 3 ||
                new Set(textureSourceResultIds).size !== 3) throw Error('Texture fixture requires three explicit fraction Results.');
            const fractions = ['SAND', 'SILT', 'CLAY'];
            const sourceRows = await tx.result.findMany({ where: { id: { in: textureSourceResultIds } } });
            if (sourceRows.length !== 3 || fractions.some(param => sourceRows.filter(row => row.param === param).length !== 1) ||
                sourceRows.some(row => row.sampleId !== data.sampleId || row.replicateNo !== (data.replicateNo ?? 1) ||
                    row.provenance !== 'MEASURED' || !row.isCurrent || !row.attemptId)) {
                throw Error('Texture fixture refuses unrelated or unrecorded fraction Results.');
            }
            textureSources = fractions.map(param => sourceRows.find(row => row.param === param));
            for (const row of textureSources) {
                const owners = await tx.workItem.findMany({ where: canonicalWorkItemWhere(data.sampleId, row.param) });
                const attempt = await tx.workAttempt.findUnique({ where: { id: row.attemptId } });
                if (owners.length !== 1 || !attempt || attempt.workItemId !== owners[0].id || attempt.status !== 'RECORDED') {
                    throw Error('Texture fixture requires recorded evidence on each existing canonical fraction owner.');
                }
            }
        }
        // Pin6060110991: preserve a Result's literal batch id; executions only
        // reference a Batch that exists when this fixture is inserted.
        const batch = data.batchId ? await tx.batch.findUnique({ where: { id: data.batchId }, select: { id: true } }) : null;
        const ctx = { item, performedBy: 'system:fixture', batchId: batch?.id ?? null,
            method: null, equipmentReadiness, equipmentReadinessText: data.equipmentReadiness ?? null };
        const allocation = await allocateExecution(tx, ctx);
        const evidence = { source: textureSources || data.provenance === 'DERIVED' ? 'test-fixture' : 'fixture',
            sourceResultIds: textureSources ? textureSources.map(row => row.id) : [data.id],
            ...(textureSources && { sourceAttemptIds: textureSources.map(row => row.attemptId) }),
            measurements: [{ resultId: data.id, param: data.param, replicateNo: data.replicateNo ?? 1,
                value: data.value, rawInput: data.rawInput ?? null, numericValue: data.numericValue ?? null }] };
        await insertFixtureExecution(tx, ctx, allocation, evidence, attemptStatus);
        return createResultFixture(tx, { ...resultArgs, data: { ...data, attemptId: allocation.id } });
    });
}

// Pin6059042857: only the two named publication tests may request this shape.
// All four unchanged measured rows belong to one existing TEXTURE execution.
async function createCompositeTextureExecutionFixture(db, args) {
    await assertExecutionFixtureDatabase(db);
    if (!args || Object.keys(args).some(key => !['data', 'attemptStatus'].includes(key)) ||
        !Array.isArray(args.data) || args.data.length !== 4 ||
        args.attemptStatus != null && !['RECORDED', 'SUBMITTED', 'ACCEPTED'].includes(args.attemptStatus)) {
        throw Error('Composite texture fixture requires exactly four explicit rows and a permitted final status.');
    }
    const rows = args.data, parameters = ['TEXTURE', 'SAND', 'SILT', 'CLAY'];
    if (rows.some(row => !row || !row.id || !row.sampleId || row.sampleId !== rows[0].sampleId ||
        ['attemptId', 'attemptNo', 'status'].some(key => Object.hasOwn(row, key)) ||
        row.provenance != null && row.provenance !== 'MEASURED' || row.equipmentReadiness != null ||
        (row.batchId ?? null) !== (rows[0].batchId ?? null)) ||
        new Set(rows.map(row => row.id)).size !== 4 ||
        parameters.some(param => rows.filter(row => row.param === param).length !== 1)) {
        throw Error('Composite texture fixture refuses changed ownership, parameters or execution metadata.');
    }
    return rules.inTransaction(db, async tx => {
        const items = await tx.workItem.findMany({ where: { sampleId: rows[0].sampleId, duplicateOf: null,
            analysis: { in: parameters } } });
        if (items.length !== 1 || items[0].analysis !== 'TEXTURE') {
            throw Error('Composite texture fixture requires one existing TEXTURE item and no canonical fraction work.');
        }
        const ctx = { item: items[0], performedBy: 'system:fixture', batchId: rows[0].batchId ?? null,
            method: null, equipmentReadiness: null, equipmentReadinessText: null };
        const allocation = await allocateExecution(tx, ctx);
        const evidence = { source: 'test-fixture', sourceResultIds: rows.map(row => row.id),
            measurements: rows.map(row => ({ resultId: row.id, param: row.param, value: row.value,
                unit: row.unit ?? null, numericValue: row.numericValue ?? null, rawInput: row.rawInput ?? null,
                replicateNo: row.replicateNo ?? 1 })) };
        await insertFixtureExecution(tx, ctx, allocation, evidence, args.attemptStatus);
        const results = [];
        for (const data of rows) results.push(await createResultFixture(tx, { data: { ...data, attemptId: allocation.id } }));
        return results;
    });
}

// Pin6069938801 extends the explicit positive-fixture rule to one supplied
// result set. It never reuses or edits a previously recorded execution.
async function createExecutionResultsFixture(db, args) {
    await assertExecutionFixtureDatabase(db);
    if(!args || Object.keys(args).some(key=>!['data','attemptStatus','textureSourceResultIds'].includes(key)) ||
        !Array.isArray(args.data) || !args.data.length)throw Error('Execution fixture requires an explicit nonempty result set.');
    const rows=args.data;
    if(rows.some(row=>!row || !row.id || !row.sampleId || row.sampleId!==rows[0].sampleId || row.param!==rows[0].param ||
        row.attemptId!=null || !Number.isInteger(row.replicateNo ?? 1) || (row.replicateNo ?? 1)<1 ||
        (row.equipmentReadiness ?? null)!==(rows[0].equipmentReadiness ?? null) ||
        (row.batchId ?? null)!==(rows[0].batchId ?? null)) || new Set(rows.map(row=>row.id)).size!==rows.length) {
        throw Error('Execution fixture refuses changed owners or execution context.');
    }
    const current=rows.filter(row=>row.isCurrent!==false);
    if(new Set(current.map(row=>row.replicateNo ?? 1)).size!==current.length)throw Error('Execution fixture refuses two current Results for one replicate.');
    return rules.inTransaction(db,async tx=>{
        const items=await tx.workItem.findMany({where:canonicalWorkItemWhere(rows[0].sampleId,rows[0].param)});
        if(items.length!==1)throw Error('Execution fixture requires exactly one existing canonical WorkItem.');
        const item=items[0];
        if(await tx.workAttempt.count({where:{workItemId:item.id}}))throw Error('Execution result set refuses reuse of an existing attempt.');
        const sourceGroups=[];
        if(args.textureSourceResultIds!=null) {
            // Pins6059445324 /6069938801 together: each explicitly supplied
            // texture replica retains its three existing fraction owners.
            if(rows[0].param!=='TEXTURE' || args.attemptStatus!=null && args.attemptStatus!=='RECORDED' ||
                !Array.isArray(args.textureSourceResultIds) || args.textureSourceResultIds.length!==rows.length)throw Error('Texture result set requires explicit source groups.');
            for(const [index,ids] of args.textureSourceResultIds.entries()) {
                if(!Array.isArray(ids) || ids.length!==3 || new Set(ids).size!==3)throw Error('Texture fixture requires three explicit sources.');
                const candidates=await tx.result.findMany({where:{id:{in:ids}}});
                const sources=['SAND','SILT','CLAY'].map(param=>candidates.find(row=>row.param===param));
                if(candidates.length!==3 || sources.some(row=>!row || row.sampleId!==rows[index].sampleId || row.replicateNo!==(rows[index].replicateNo ?? 1) ||
                    !row.isCurrent || row.provenance!=='MEASURED' || !row.attemptId))throw Error('Texture fixture refuses unrelated fraction sources.');
                for(const source of sources) {
                    const owners=await tx.workItem.findMany({where:canonicalWorkItemWhere(source.sampleId,source.param)});
                    const attempt=await tx.workAttempt.findUnique({where:{id:source.attemptId}});
                    if(owners.length!==1 || attempt?.workItemId!==owners[0].id || attempt.status!=='RECORDED')throw Error('Texture fixture requires recorded canonical fraction owners.');
                }
                sourceGroups.push(sources);
            }
        }
        const batch=rows[0].batchId ? await tx.batch.findUnique({where:{id:rows[0].batchId},select:{id:true}}) : null;
        const ctx={item,performedBy:'system:fixture',batchId:batch?.id ?? null,method:null,
            equipmentReadiness:rows[0].equipmentReadiness ? JSON.parse(rows[0].equipmentReadiness) : null,
            equipmentReadinessText:rows[0].equipmentReadiness ?? null};
        const allocation=await allocateExecution(tx,ctx);
        const evidence={source:sourceGroups.length?'test-fixture':'fixture',
            sourceResultIds:sourceGroups.length?sourceGroups.flat().map(row=>row.id):rows.map(row=>row.id),
            ...(sourceGroups.length && {sourceAttemptIds:sourceGroups.flat().map(row=>row.attemptId)}),
            measurements:rows.map((row,index)=>({resultId:row.id,param:row.param,
            replicateNo:row.replicateNo ?? 1,value:row.value,rawInput:row.rawInput ?? null,numericValue:row.numericValue ?? null,
            methodologyId:row.methodologyId ?? null,unit:row.unit ?? null,isCurrent:row.isCurrent ?? true,isValid:row.isValid ?? true,
            ...(sourceGroups.length && {sourceResultIds:sourceGroups[index].map(source=>source.id),sourceAttemptIds:sourceGroups[index].map(source=>source.attemptId)})}))};
        await insertFixtureExecution(tx,ctx,allocation,evidence,args.attemptStatus);
        const inserted=[];
        for(const data of rows)inserted.push(await createResultFixture(tx,{data:{...data,attemptId:allocation.id}}));
        return inserted;
    });
}

module.exports = { createExecutionResultFixture, createCompositeTextureExecutionFixture, createExecutionResultsFixture };
