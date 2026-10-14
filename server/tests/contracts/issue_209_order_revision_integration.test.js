const fs = require('node:fs');
const { randomUUID, createHash } = require('node:crypto');
const Database = require('better-sqlite3');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const installer = require('../../scripts/install_order_revisions');
const order = require('../../services/orderService');
const { resolveOrderLine } = require('../../services/orderLineResolutionService');

const held = [];
const triples = file => Object.fromEntries(['', '-wal', '-shm'].map(suffix => [suffix,
    fs.existsSync(file + suffix) ? createHash('sha256').update(fs.readFileSync(file + suffix)).digest('hex') : null]));

async function fixture({ revisions = 1, lines = 1, historicalOpen = false } = {}) {
    const f = await qcGateFixture({ resolvedRules: false, fixedWindowPolicy: false, installOrderRevisions: false }); held.push(f);
    const item = f.items[0];
    await require('../../services/sampleStateService').transitionSample(item.sampleId, 'PROCESSING', f.actor,
        'Declared complete order context', { requiredAnalyses: JSON.stringify([item.analysis]) }, f.db);
    const db = new Database(f.file, { fileMustExist: true });
    try {
        db.pragma('foreign_keys=ON');
        for (let version = 1; version <= revisions; version++) {
            const revisionId = randomUUID();
            db.prepare('INSERT INTO SampleOrderRevision(id,sampleId,version,status,reason,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)')
                .run(revisionId, item.sampleId, version, 'ACTIVE', 'Retained order context', 1, 1);
            for (let index = 0; index < lines; index++) db.prepare('INSERT INTO OrderLine(id,revisionId,analysis,isRequired,status,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?)')
                .run(randomUUID(), revisionId, item.analysis, 1, 'ACTIVE', 1, 1);
        }
    } finally { db.close(); }
    if (historicalOpen) {
        f.openId = randomUUID();
        // A retained #191 reservation uses its ordinary Prisma timestamp representation.
        await f.db.workAttempt.create({ data: { id: f.openId, workItemId: item.id, attemptNo: 1, status: 'OPEN',
            version: 1, createdAt: new Date(1), updatedAt: new Date(1) } });
    }
    return f;
}

async function rows(f) {
    const db = new Database(f.file, { readonly: true, fileMustExist: true });
    try { return {
        revisions: db.prepare('SELECT id,sampleId,version,status,reason,createdAt,updatedAt FROM SampleOrderRevision ORDER BY id').all(),
        lines: db.prepare('SELECT id,revisionId,analysis,methodologyId,methodRevision,isRequired,status,omissionReason,omissionAuthorizedBy,omissionAuthorizedAt,predecessorLineId,createdAt,updatedAt FROM OrderLine ORDER BY id').all(),
        attempts: db.prepare('SELECT * FROM WorkAttempt ORDER BY id').all()
    }; } finally { db.close(); }
}

afterAll(async () => { for (const f of held) await f.db.$disconnect(); }); // Retain every owned fixture/triple.

async function textureFixture({ fractions = ['SAND','SILT','CLAY'], completed = false, initial = true } = {}) {
    const f = await qcGateFixture({resolvedRules:false,fixedWindowPolicy:false}); held.push(f);
    const {createSampleFixture,createWorkItemFixture}=require('../helpers/workflowFixtures');
    for(const analysis of ['SAND','SILT','CLAY','TEXTURE']) await f.db.analysis.upsert({where:{code:analysis},update:{},
        create:{code:analysis,name:'Owned order '+analysis,units:'%'}});
    f.textureSample=await createSampleFixture(f.db,{data:{id:randomUUID(),originalId:randomUUID(),assignedLab:f.labId,
        status:'PROCESSING',dryingStatus:'DONE',preparationStatus:'DONE',requiredAnalyses:'["TEXTURE"]'}});
    f.textureOwners=[];
    for(const analysis of [...fractions,'TEXTURE']) f.textureOwners.push(await createWorkItemFixture(f.db,{data:{id:randomUUID(),
        sampleId:f.textureSample.id,assignedLab:f.labId,analysis,status:completed&&analysis==='SAND'?'COMPLETED':'IN_PROGRESS',history:'[]'}}));
    if(initial) await f.db.$transaction(tx=>order.createInitialOrder(tx,f.textureSample,['TEXTURE'],f.actor));
    return f;
}

test('a TEXTURE target retains all existing fraction owners including completed work and fixes four linked lines in one revision',async()=>{
    const f=await textureFixture({completed:true}),before=await rows(f);
    const originalItems=await f.db.workItem.findMany({where:{sampleId:f.textureSample.id},orderBy:{id:'asc'}});
    const revised=await order.reviseAnalyses(f.textureSample.id,{analyses:['SAND','SILT','CLAY','TEXTURE'],
        reason:'Reviewed retained fraction companions'},f.actor,{tx:f.db,mode:'order'});
    expect(await f.db.workItem.findMany({where:{sampleId:f.textureSample.id},orderBy:{id:'asc'}})).toEqual(originalItems);
    const lines=await f.db.orderLine.findMany({where:{revisionId:revised.revision.id}});
    expect(lines).toHaveLength(4);expect(lines.map(line=>line.analysis).sort()).toEqual(['CLAY','SAND','SILT','TEXTURE']);
    for(const item of f.textureOwners) expect(await f.db.$transaction(tx=>resolveOrderLine(tx,item)))
        .toBe(lines.find(line=>line.workItemId===item.id).id);
    const after=await rows(f);expect(after.lines.filter(line=>before.lines.some(old=>old.id===line.id))).toEqual(before.lines);
    expect(after.attempts).toEqual(before.attempts);
    expect((await f.db.sample.findUnique({where:{id:f.textureSample.id}})).requiredAnalyses).toBe('["TEXTURE"]');
    const audit=await f.db.auditLog.findFirst({where:{sampleId:f.textureSample.id,action:'ORDER_REVISION_APPLIED'}});
    expect(JSON.parse(audit.details).companionWorkItemIds.sort()).toEqual(f.textureOwners.filter(item=>item.analysis!=='TEXTURE').map(item=>item.id).sort());
});

test('one or two retained fractions refuse a TEXTURE alias with named missing owners and zero row changes',async()=>{
    for(const fractions of [['SAND'],['SAND','SILT']]){
        const f=await textureFixture({fractions}),before=JSON.stringify(await f.snapshot());
        await expect(order.reviseAnalyses(f.textureSample.id,{analyses:['SOIL_TEXTURE'],reason:'Reviewed partial owners'},f.actor,{tx:f.db}))
            .rejects.toMatchObject({code:'TEXTURE_FRACTION_OWNERS_INCOMPLETE',statusCode:409,
                details:{missingFractions:['SAND','SILT','CLAY'].filter(code=>!fractions.includes(code))}});
        expect(JSON.stringify(await f.snapshot())).toBe(before);
    }
});

test('TEXTURE without explicit fraction selections still preserves all existing owners; explicit removal waives them with the reason',async()=>{
    const f=await textureFixture();
    await order.reviseAnalyses(f.textureSample.id,{analyses:['TEXTURE'],reason:'Reviewed existing companions'},f.actor,{tx:f.db});
    expect(await f.db.orderLine.count({where:{revision:{sampleId:f.textureSample.id,status:'ACTIVE'}}})).toBe(4);
    await order.reviseAnalyses(f.textureSample.id,{analyses:[],reason:'Explicit removal of fraction work'},f.actor,{tx:f.db});
    const items=await f.db.workItem.findMany({where:{sampleId:f.textureSample.id}});
    expect(items.every(item=>item.status==='WAIVED'&&item.reanalysisReason==='Explicit removal of fraction work')).toBe(true);
});

test('initial generation for a new four-selection sample still creates only the logical TEXTURE measurement owner',async()=>{
    const f=await textureFixture({fractions:[],initial:false});
    const sample=await require('../helpers/workflowFixtures').createSampleFixture(f.db,{data:{id:randomUUID(),originalId:randomUUID(),
        assignedLab:f.labId,status:'PROCESSING',requiredAnalyses:'["SAND","SILT","CLAY","TEXTURE"]'}});
    await f.db.$transaction(async tx=>{const intake=require('../../services/intakeWorkItemService');
        await intake.generate(tx,sample,await intake.planForSample(tx,sample),f.actor);});
    const items=await f.db.workItem.findMany({where:{sampleId:sample.id,analysis:{notIn:['DRYING','PREPARATION']}}});
    expect(items.map(item=>item.analysis)).toEqual(['TEXTURE']);
    const lines=await f.db.orderLine.findMany({where:{revision:{sampleId:sample.id,status:'ACTIVE'}}});
    expect(lines).toHaveLength(1);expect(lines[0]).toMatchObject({analysis:'TEXTURE',workItemId:items[0].id});
});

test('kit counts separate fraction line refusals and incomplete owner samples without touching the original triple',async()=>{
    const f=await textureFixture({fractions:['SAND','SILT']}),physical=triples(f.file);
    const result=installer.installOrderRevisions({dbPath:f.file});
    expect(triples(f.file)).toEqual(physical);
    expect(result.impact).toMatchObject({fractionOwnerRefusalCount:2,incompleteTextureOwnerSampleCount:1,
        refusalCounts:{FRACTION_OWNER_LINE_REQUIRED:2}});
    expect(result.impact.incompleteTextureOwners).toEqual([{sampleId:f.textureSample.id,
        workItemIds:expect.arrayContaining(f.textureOwners.filter(item=>item.analysis!=='TEXTURE').map(item=>item.id)),missingFractions:['CLAY']}]);
    expect(result.impact.refusedOpenWorkItems.filter(item=>item.sampleId===f.textureSample.id)).toEqual(expect.arrayContaining([
        expect.objectContaining({analysis:'SAND',cause:'FRACTION_OWNER_LINE_REQUIRED',orderLineCause:'NO_LINE'}),
        expect.objectContaining({analysis:'SILT',cause:'FRACTION_OWNER_LINE_REQUIRED',orderLineCause:'NO_LINE'})]));
});

test('installer dry/apply/repeat retains three ACTIVE histories, every line and a null historical OPEN identity', async () => {
    const f = await fixture({ revisions: 3, historicalOpen: true }), before = await rows(f), physical = triples(f.file);
    const dry = installer.installOrderRevisions({ dbPath: f.file });
    expect(dry).toMatchObject({ classification: 'PRE_209', mode: 'DRY_RUN', totalChanges: 0, backfilledCount: 0,
        impact: { multipleActiveSampleCount: 1 } });
    expect(triples(f.file)).toEqual(physical);
    expect(dry.impact).toMatchObject({ continuingReservedOpenCount: 1,
        refusalCounts: { NO_LINE: 0, AMBIGUOUS_LINE: 0, MULTIPLE_ACTIVE_REVISIONS: 0 } });
    expect(dry.impact.continuingReservedOpenWorkItems).toEqual([expect.objectContaining({ attemptId: f.openId, retainedOrderLineId: null })]);
    expect(installer.installOrderRevisions({ dbPath: f.file, apply: true })).toMatchObject({ classification: 'COMPLETE_209', originalRowsPreserved: true, backfilledCount: 0 });
    expect(await rows(f)).toEqual(before);
    const after = triples(f.file);
    expect(installer.installOrderRevisions({ dbPath: f.file, apply: true })).toMatchObject({ classification: 'COMPLETE_209', mode: 'NO_OP', totalChanges: 0 });
    expect(triples(f.file)).toEqual(after);
});

test('a full reasoned revision supersedes all three ACTIVE ids while every old line and attempt stays byte-equivalent', async () => {
    const f = await fixture({ revisions: 3, historicalOpen: true }), before = await rows(f);
    installer.installOrderRevisions({ dbPath: f.file, apply: true });
    const result = await order.reviseAnalyses(f.items[0].sampleId, { analyses: [f.items[0].analysis], reason: 'Reviewed complete target against actual work' }, f.actor, { tx: f.db, mode: 'order' });
    expect(result.revision.status).toBe('ACTIVE');
    expect(await f.db.sampleOrderRevision.count({ where: { sampleId: f.items[0].sampleId, status: 'ACTIVE' } })).toBe(1);
    expect(await f.db.sampleOrderRevision.count({ where: { sampleId: f.items[0].sampleId, status: 'SUPERSEDED' } })).toBe(3);
    const after = await rows(f);
    expect(after.lines.filter(line => before.lines.some(old => old.id === line.id))).toEqual(before.lines);
    expect(after.attempts).toEqual(before.attempts);
    const audit = await f.db.auditLog.findFirst({ where: { sampleId: f.items[0].sampleId, action: 'ORDER_REVISION_APPLIED' } });
    expect(JSON.parse(audit.details)).toMatchObject({ priorActiveCount: 3, supersededRevisionIds: before.revisions.map(row => row.id) });
    const newLines = await f.db.orderLine.findMany({ where: { revisionId: result.revision.id } });
    expect(newLines).toHaveLength(1); expect(newLines[0].workItemId).toBe(f.items[0].id);
});

test('legacy single-match resolution writes only the newly inserted attempt link', async () => {
    const f = await fixture(), before = await rows(f);
    installer.installOrderRevisions({ dbPath: f.file, apply: true });
    const result = await f.result(f.items[0]);
    const attempt = await f.db.workAttempt.findUnique({ where: { id: result.attemptId } });
    expect(attempt.orderLineId).toBe(before.lines[0].id);
    expect((await rows(f)).lines).toEqual(before.lines);
    expect((await f.db.orderLine.findUnique({ where: { id: before.lines[0].id } })).workItemId).toBeNull();
});

test.each([[0, 0, 'NO_LINE'], [1, 2, 'AMBIGUOUS_LINE'], [2, 1, 'MULTIPLE_ACTIVE_REVISIONS']])(
    'a legacy %i-revision/%i-line context refuses with %s and no row writes', async (revisions, lines, cause) => {
        const f = await fixture({ revisions, lines }); installer.installOrderRevisions({ dbPath: f.file, apply: true });
        const before = await rows(f);
        await expect(f.db.$transaction(tx => resolveOrderLine(tx, f.items[0]))).rejects.toMatchObject({ code: 'ORDER_LINE_REQUIRED', statusCode: 409, details: { cause } });
        expect(await rows(f)).toEqual(before);
        expect(installer.installOrderRevisions({ dbPath: f.file }).impact.refusalCounts[cause]).toBe(1);
    });

test('a retained OPEN attempt fills with its original null order-line identity', async () => {
    const f = await fixture({ historicalOpen: true }); installer.installOrderRevisions({ dbPath: f.file, apply: true });
    const before = (await rows(f)).attempts.find(row => row.id === f.openId);
    let result;
    try { result = await f.result(f.items[0]); }
    catch (error) { throw new Error('Historical first-fill guard: ' + error.code + ': ' + error.message); }
    expect(result.attemptId).toBe(f.openId);
    expect(await f.db.workAttempt.findUnique({ where: { id: f.openId } })).toMatchObject({ status: 'RECORDED', orderLineId: null });
    const after = (await rows(f)).attempts.find(row => row.id === f.openId);
    for (const field of ['id','workItemId','orderLineId','attemptNo','batchId','reason','requestedBy','requestedAt','parentAttemptId','note',
        'rawData','calcVersion','dilutionFactor','aliquotId','legacyAttemptNoConflict','version','createdAt','updatedAt']) expect(after[field]).toEqual(before[field]);
});

test('two concurrent complete revisions leave exactly one ACTIVE revision', async () => {
    const f = await fixture({ revisions: 3 }); installer.installOrderRevisions({ dbPath: f.file, apply: true });
    const outcomes = await Promise.allSettled([1, 2].map(index => order.reviseAnalyses(f.items[0].sampleId,
        { analyses: [f.items[0].analysis], reason: 'Reviewed concurrent full target ' + index }, f.actor, { tx: f.db, mode: 'order' })));
    expect(outcomes.some(outcome => outcome.status === 'fulfilled')).toBe(true);
    for (const outcome of outcomes) if (outcome.status === 'rejected') expect(outcome.reason).toMatchObject({ code: 'ORDER_REVISION_CHANGED', statusCode: 409 });
    expect(await f.db.sampleOrderRevision.count({ where: { sampleId: f.items[0].sampleId, status: 'ACTIVE' } })).toBe(1);
});

test('raw new-attempt insertion cannot select one ambiguous legacy line', async () => {
    const f = await fixture({ lines: 2 }); installer.installOrderRevisions({ dbPath: f.file, apply: true });
    const line = await f.db.orderLine.findFirst({ where: { revision: { sampleId: f.items[0].sampleId } } });
    const connection = new Database(f.file, { fileMustExist: true });
    try {
        expect(() => connection.prepare('INSERT INTO WorkAttempt(id,workItemId,orderLineId,attemptNo,status,version,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?)')
            .run(randomUUID(), f.items[0].id, line.id, 1, 'OPEN', 1, 1, 1)).toThrow('ORDER_LINE_REQUIRED');
    } finally { connection.close(); }
    expect(await f.db.workAttempt.count({ where: { workItemId: f.items[0].id } })).toBe(0);
});

test('a new linked line cannot have its ownership or analysis rewritten', async () => {
    const f = await fixture({ revisions: 3 }); installer.installOrderRevisions({ dbPath: f.file, apply: true });
    const revised = await order.reviseAnalyses(f.items[0].sampleId, { analyses: [f.items[0].analysis], reason: 'Reviewed immutable line identity' }, f.actor, { tx: f.db, mode: 'order' });
    const line = await f.db.orderLine.findFirst({ where: { revisionId: revised.revision.id } }), before = JSON.stringify(line);
    const connection = new Database(f.file, { fileMustExist: true });
    try {
        expect(() => connection.prepare('UPDATE OrderLine SET workItemId=NULL WHERE id=?').run(line.id)).toThrow('ORDER_LINE_IDENTITY_IMMUTABLE');
        expect(() => connection.prepare('UPDATE OrderLine SET analysis=? WHERE id=?').run('OTHER', line.id)).toThrow('ORDER_LINE_IDENTITY_IMMUTABLE');
    } finally { connection.close(); }
    expect(JSON.stringify(await f.db.orderLine.findUnique({ where: { id: line.id } }))).toBe(before);
});

test('a reasoned repeat receives its resolved legacy line at the new reservation INSERT', async () => {
    const f = await fixture(); installer.installOrderRevisions({ dbPath: f.file, apply: true });
    const original = await f.result(f.items[0]);
    const originalAttempt = await f.db.workAttempt.findUnique({ where: { id: original.attemptId } });
    const result = await require('../../services/workRepeatService').requestRepeat(f.db, f.items[0].id, f.actor,
        { reason: 'INSTRUMENT_FAULT', note: 'Reviewed remeasurement request' });
    expect(result.attempt).toMatchObject({ status: 'OPEN', orderLineId: originalAttempt.orderLineId, parentAttemptId: originalAttempt.id });
    expect(result.attempt.id).not.toBe(originalAttempt.id);
    expect(await f.db.workAttempt.findUnique({ where: { id: originalAttempt.id } })).toMatchObject({ orderLineId: originalAttempt.orderLineId });
});

test('scientific amendment authorisation links only its newly reserved attempt to the current order', async () => {
    const f = await qcGateFixture({ status: 'ACCEPTED', resolvedRules: false, fixedWindowPolicy: false }); held.push(f);
    const item = f.items[0], original = await f.result(item);
    await require('../../services/sampleStateService').transitionSample(item.sampleId, 'APPROVED', f.actor,
        'Owned completed approval before amendment', {}, f.db);
    const before = await rows(f), service = require('../../services/scientificAmendmentService');
    const requested = await service.requestScientificAmendment(f.db, item.sampleId, f.actor,
        { reason: 'Reviewed client retest of retained finding', reasonCode: 'CLIENT_RETEST', selectedWorkItemIds: [item.id] });
    const approved = await service.authoriseScientificAmendment(f.db, item.sampleId, requested.amendment.id,
        { ...f.actor, username: 'system:other-authoriser' }, { expectedVersion: requested.amendment.version });
    expect(approved.attempts).toHaveLength(1);
    expect(approved.attempts[0]).toMatchObject({ status: 'OPEN', parentAttemptId: original.attemptId, orderLineId: before.lines[0].id });
    const after = await rows(f);
    expect(after.lines).toEqual(before.lines);
    expect(after.attempts.filter(row => row.id === original.attemptId)).toEqual(before.attempts);
});

test('order revisions enforce permission and laboratory scope before changing retained rows', async () => {
    const f = await fixture(); installer.installOrderRevisions({ dbPath: f.file, apply: true });
    const before = await rows(f), input = { analyses: [f.items[0].analysis], reason: 'Reviewed complete order' };
    await expect(order.reviseAnalyses(f.items[0].sampleId, input, { ...f.actor, role: 'TECHNICIAN' }, { tx: f.db }))
        .rejects.toMatchObject({ code: 'EDIT_ANALYSES_FORBIDDEN', statusCode: 403 });
    await expect(order.reviseAnalyses(f.items[0].sampleId, input, { ...f.actor, role: 'LAB_MANAGER', labId: randomUUID() }, { tx: f.db }))
        .rejects.toMatchObject({ statusCode: 403 });
    expect(await rows(f)).toEqual(before);
});

test('the read-only kit collector preserves an active WAL triple and accounts for every nested retained snapshot', async () => {
    const f = await fixture({ revisions: 3, historicalOpen: true });
    const writer = new Database(f.file, { fileMustExist: true });
    try {
        writer.pragma('journal_mode=WAL');
        writer.prepare('INSERT INTO AuditLog(id,entity,entityId,action,performedBy,timestamp) VALUES(?,?,?,?,?,?)')
            .run(randomUUID(), 'SAMPLE', f.items[0].sampleId, 'OWNED_IMPACT_WAL_CONTEXT', 'system:fixture', Date.now());
        const before = triples(f.file), result = require('../../scripts/order_revision_impact').collectOrderRevisionImpact({ dbPath: f.file });
        expect(before['-wal']).not.toBeNull(); expect(triples(f.file)).toEqual(before);
        expect(result).toMatchObject({ classification: 'PRE_209', access: 'RETAINED_SNAPSHOT_ONLY', totalChanges: 0,
            originalFilesPreserved: true, productionMutations: 0, impact: { multipleActiveSampleCount: 1, continuingReservedOpenCount: 1 } });
        expect(result.retainedAllocation.files.filter(row => row.path.endsWith('snapshot.db')).length).toBeGreaterThanOrEqual(2);
        expect(result.retainedAllocation.conservativeAllocationBytes).toBeGreaterThanOrEqual(result.retainedAllocation.logicalBytes);
        for (const retained of result.retainedAllocation.files) {
            expect(fs.existsSync(retained.path)).toBe(true);
            expect(createHash('sha256').update(fs.readFileSync(retained.path)).digest('hex')).toBe(retained.sha256);
        }
    } finally { writer.close(); }
});

test('the actual shipped post-start order programme preserves an owned WAL-mode original without sidecars', async () => {
    const f = await qcGateFixture({ resolvedRules:false,fixedWindowPolicy:false }); held.push(f); await f.db.$disconnect();
    const target = f.file + '.post-order-' + randomUUID() + '.db';
    for (const suffix of ['','-wal','-shm']) if (fs.existsSync(f.file + suffix)) fs.copyFileSync(f.file + suffix,target + suffix,fs.constants.COPYFILE_EXCL);
    const writer = new Database(target,{fileMustExist:true}); try { writer.pragma('journal_mode=WAL'); } finally { writer.close(); }
    const before = triples(target); expect(before['-wal']).toBeNull(); expect(before['-shm']).toBeNull();
    const path = require('node:path'), root = path.resolve(__dirname,'../../..');
    const rehearsal = fs.readFileSync(path.join(root,'server/scripts/rehearsal_deployment_readiness.cjs'),'utf8');
    const section = rehearsal.slice(rehearsal.indexOf('const orderAfterOutput ='),rehearsal.indexOf('const orderAfter = JSON.parse'));
    const programme = section.match(/IMAGE_TAG,'node','-e',\s*`([\s\S]*?)`\s*\]/)[1].replace("'/owned-order/dev.db'",JSON.stringify(target));
    const actual = JSON.parse(require('node:child_process').execFileSync(process.execPath,['-e',programme],{cwd:path.join(root,'server'),encoding:'utf8'}));
    expect(actual).toMatchObject({ready:{classification:'COMPLETE_209',totalChanges:0},again:{mode:'NO_OP',totalChanges:0},
        impact:{originalFilesPreserved:true,totalChanges:0},dbWalShmPreserved:true,secondaryInspectionsOnRetainedSnapshot:true});
    expect(triples(target)).toEqual(before);
});

test.each([
    ['wrong type', connection => connection.exec('ALTER TABLE OrderLine ADD COLUMN workItemId INTEGER')],
    ['unreviewed foreign key', connection => connection.exec('ALTER TABLE OrderLine ADD COLUMN workItemId TEXT REFERENCES WorkItem(id)')],
    ['tampered index', connection => connection.exec('ALTER TABLE OrderLine ADD COLUMN workItemId TEXT; CREATE INDEX OrderLine_workItemId_idx ON OrderLine(analysis)')],
    ['partial guard', connection => connection.exec("CREATE TRIGGER SampleOrderRevision_active_insert BEFORE INSERT ON SampleOrderRevision BEGIN SELECT RAISE(ABORT,'OWNED_PARTIAL_209'); END;")]
])('the read-only owner refuses partial or mismatched schema without touching the original triple: %s', async (_name, change) => {
    const f = await fixture(), connection = new Database(f.file,{fileMustExist:true});
    try { change(connection); } finally { connection.close(); }
    const before = triples(f.file), retained = await rows(f);
    expect(() => installer.installOrderRevisions({dbPath:f.file,apply:true})).toThrow('Order storage differs');
    expect(triples(f.file)).toEqual(before); expect(await rows(f)).toEqual(retained);
});

test('an actual Prisma-wrapped native order guard returns the service-owned stable code', async () => {
    const f = await fixture({lines:2}); installer.installOrderRevisions({dbPath:f.file,apply:true});
    const before = await rows(f), lineId = before.lines[0].id;
    await expect(f.db.$transaction(tx => require('../../services/orderAttemptWriteService').insertOrderBoundAttempt(tx,
        {id:randomUUID(),workItemId:f.items[0].id,orderLineId:lineId,attemptNo:1,status:'OPEN',version:1,createdAt:new Date(),updatedAt:new Date()})))
        .rejects.toMatchObject({code:'ORDER_ATTEMPT_INSERT_REFUSED',statusCode:409});
    expect(await rows(f)).toEqual(before);
});

function addOwnedInsertRefusal(f) {
    const connection = new Database(f.file,{fileMustExist:true});
    try { connection.exec("CREATE TRIGGER owned_order_attempt_refusal BEFORE INSERT ON WorkAttempt BEGIN SELECT RAISE(ABORT,'OWNED_GUARD_REFUSAL'); END;"); }
    finally { connection.close(); }
}

function addOwnedInitialRevisionRefusal(f) {
    const connection=new Database(f.file,{fileMustExist:true});
    try {connection.exec("CREATE TRIGGER owned_initial_order_refusal BEFORE INSERT ON SampleOrderRevision BEGIN SELECT RAISE(ABORT,'OWNED_INITIAL_ORDER_REFUSAL'); END;");}
    finally {connection.close();}
}
function addOwnedInitialLineRefusal(f) {
    const connection=new Database(f.file,{fileMustExist:true});
    try {connection.exec("CREATE TRIGGER owned_initial_line_refusal BEFORE INSERT ON OrderLine BEGIN SELECT RAISE(ABORT,'OWNED_INITIAL_LINE_REFUSAL'); END;");}
    finally {connection.close();}
}

test.each([['revision',addOwnedInitialRevisionRefusal],['line',addOwnedInitialLineRefusal]])(
    'an actual initial %s INSERT failure rolls back all generated WorkItems, order rows and audits in the same intake transaction',async(_name,refuse)=>{
        const f=await qcGateFixture({resolvedRules:false,fixedWindowPolicy:false});held.push(f);
        const sample=await require('../helpers/workflowFixtures').createSampleFixture(f.db,{data:{id:randomUUID(),originalId:randomUUID(),
            assignedLab:f.labId,status:'PROCESSING',requiredAnalyses:JSON.stringify([f.analysisCode])}});
        refuse(f);const before=await f.snapshot();
        await expect(f.db.$transaction(async tx=>{const intake=require('../../services/intakeWorkItemService');
            await intake.generate(tx,sample,await intake.planForSample(tx,sample),f.actor);})) .rejects.toBeDefined();
        expect(await f.snapshot()).toEqual(before);
        expect(await f.db.workItem.count({where:{sampleId:sample.id}})).toBe(0);
        expect(await f.db.sampleOrderRevision.count({where:{sampleId:sample.id}})).toBe(0);
    });

test('runtime-reachable missing revision and missing matching line remain zero-write refusals and have distinct read-only impact lists',async()=>{
    for(const [revisions,contextCause] of [[0,'NO_ACTIVE_REVISION'],[1,'NO_MATCHING_LINE']]){
        const f=await fixture({revisions,lines:0});installer.installOrderRevisions({dbPath:f.file,apply:true});
        const before=await f.snapshot();
        await expect(f.db.$transaction(tx=>resolveOrderLine(tx,f.items[0]))).rejects.toMatchObject({code:'ORDER_LINE_REQUIRED',statusCode:409,
            details:{cause:'NO_LINE',contextCause}});
        expect(await f.snapshot()).toEqual(before);
        const physical=triples(f.file),impact=installer.installOrderRevisions({dbPath:f.file}).impact;
        expect(triples(f.file)).toEqual(physical);
        expect(impact.refusalCounts.NO_LINE).toBe(1);
        expect(impact.noActiveRevisionCount).toBe(revisions===0?1:0);
        expect(impact.noMatchingLineCount).toBe(revisions===1?1:0);
        expect(impact.refusedOpenWorkItems).toEqual([expect.objectContaining({sampleId:f.items[0].sampleId,contextCause})]);
    }
});

test('an approved orphan remains non-editable and its prospective amendment impact requires STOP with sample ids, without writes',async()=>{
    const f=await qcGateFixture({resolvedRules:false,fixedWindowPolicy:false});held.push(f);
    const helpers=require('../helpers/workflowFixtures');
    const sample=await helpers.createSampleFixture(f.db,{data:{id:randomUUID(),originalId:randomUUID(),assignedLab:f.labId,
        status:'APPROVED',requiredAnalyses:JSON.stringify([f.analysisCode])}});
    const item=await helpers.createWorkItemFixture(f.db,{data:{id:randomUUID(),sampleId:sample.id,assignedLab:f.labId,
        analysis:f.analysisCode,status:'ACCEPTED'}});
    const before=await f.snapshot();
    await expect(order.reviseAnalyses(sample.id,{analyses:[f.analysisCode],reason:'Orphan order remedy requested'},f.actor,{tx:f.db}))
        .rejects.toMatchObject({code:'AMENDMENT_WORKFLOW_REQUIRED',statusCode:409});
    await expect(f.db.$transaction(tx=>resolveOrderLine(tx,item))).rejects.toMatchObject({code:'ORDER_LINE_REQUIRED',statusCode:409});
    expect(await f.snapshot()).toEqual(before);
    const physical=triples(f.file),impact=installer.installOrderRevisions({dbPath:f.file}).impact;
    expect(triples(f.file)).toEqual(physical);
    expect(impact).toMatchObject({prospectiveApprovedAmendmentRefusalCount:1,prospectiveApprovedAmendmentSampleCount:1,
        approvedAmendmentSampleIds:[sample.id],approvedAmendmentKitGate:'STOP_APPROVED_AMENDMENT_REMEDIATION_REQUIRED'});
    expect(impact.prospectiveApprovedAmendmentRefusals).toEqual([expect.objectContaining({sampleId:sample.id,workItemId:item.id,
        cause:'NO_LINE',contextCause:'NO_ACTIVE_REVISION'})]);
    expect(impact.refusedOpenWorkItems.some(row=>row.workItemId===item.id)).toBe(false);
});
test('first execution maps an actual wrapped INSERT refusal and rolls back all result and audit writes', async () => {
    const f = await fixture(); installer.installOrderRevisions({dbPath:f.file,apply:true}); addOwnedInsertRefusal(f);
    const before = await f.snapshot();
    await expect(f.result(f.items[0])).rejects.toMatchObject({code:'ORDER_ATTEMPT_INSERT_REFUSED',statusCode:409});
    expect(await f.snapshot()).toEqual(before);
});

test('approved impact excludes unmatched WAIVED and marked duplicate work while an ACCEPTED current orphan still requires STOP', async () => {
    const f = await qcGateFixture({ resolvedRules: false, fixedWindowPolicy: false }); held.push(f);
    const helpers = require('../helpers/workflowFixtures');
    const sample = await helpers.createSampleFixture(f.db, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: f.labId,
        status: 'APPROVED', requiredAnalyses: JSON.stringify([f.analysisCode]) } });
    const waived = await helpers.createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: sample.id, assignedLab: f.labId,
        analysis: f.analysisCode, status: 'WAIVED' } });
    await helpers.createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: sample.id, assignedLab: f.labId,
        analysis: f.analysisCode, status: 'ACCEPTED', duplicateOf: waived.id } });
    let before = await f.snapshot(), physical = triples(f.file);
    const excluded = installer.installOrderRevisions({ dbPath: f.file }).impact;
    expect(triples(f.file)).toEqual(physical);
    expect(excluded).toMatchObject({ prospectiveApprovedAmendmentRefusalCount: 0, approvedAmendmentSampleIds: [],
        prospectiveApprovedAmendmentRefusals: [], approvedAmendmentKitGate: 'NO_APPROVED_AMENDMENT_REFUSALS' });
    expect(await f.snapshot()).toEqual(before);
    const accepted = await helpers.createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: sample.id, assignedLab: f.labId,
        analysis: f.analysisCode, status: 'ACCEPTED' } });
    before = await f.snapshot(); physical = triples(f.file);
    const required = installer.installOrderRevisions({ dbPath: f.file }).impact;
    expect(triples(f.file)).toEqual(physical);
    expect(required).toMatchObject({ prospectiveApprovedAmendmentRefusalCount: 1, approvedAmendmentSampleIds: [sample.id],
        approvedAmendmentKitGate: 'STOP_APPROVED_AMENDMENT_REMEDIATION_REQUIRED' });
    expect(required.prospectiveApprovedAmendmentRefusals).toEqual([expect.objectContaining({ workItemId: accepted.id,
        sampleId: sample.id, cause: 'NO_LINE', contextCause: 'NO_ACTIVE_REVISION' })]);
    expect(await f.snapshot()).toEqual(before);
});

test.each(['{', '{"TEXTURE":true}', '[42]', '[null]', '[""]', '["   "]'])(
    'malformed stored fraction analyses %s are listed read-only and cannot refuse schema-ready startup', async raw => {
        const f = await qcGateFixture({ resolvedRules: false, fixedWindowPolicy: false }); held.push(f);
        const helpers = require('../helpers/workflowFixtures');
        await f.db.analysis.upsert({ where: { code: 'SAND' }, update: {}, create: { code: 'SAND', name: 'Owned fraction impact', units: '%' } });
        f.textureSample = await helpers.createSampleFixture(f.db, { data: { id: randomUUID(), originalId: randomUUID(), assignedLab: f.labId,
            status: 'PROCESSING', requiredAnalyses: raw } });
        f.textureOwners = [await helpers.createWorkItemFixture(f.db, { data: { id: randomUUID(), sampleId: f.textureSample.id,
            assignedLab: f.labId, analysis: 'SAND', status: 'IN_PROGRESS' } })];
        const before = await f.snapshot(), physical = triples(f.file);
        const dry = installer.installOrderRevisions({ dbPath: f.file });
        const ready = installer.assertOrderRevisionStartupReady(f.file);
        expect(triples(f.file)).toEqual(physical);
        for (const result of [dry, ready]) {
            expect(result).toMatchObject({ classification: 'COMPLETE_209', mode: 'DRY_RUN', totalChanges: 0, backfilledCount: 0,
                impact: { invalidStoredAnalysisSampleCount: 1 } });
            expect(result.impact.invalidStoredAnalyses).toEqual([{ sampleId: f.textureSample.id, cause: 'INVALID_STORED_ANALYSES',
                workItemIds: f.textureOwners.filter(item => item.analysis === 'SAND').map(item => item.id) }]);
        }
        expect(await f.snapshot()).toEqual(before);
        expect((await f.db.sample.findUnique({ where: { id: f.textureSample.id } })).requiredAnalyses).toBe(raw);
    });
test('repeat reservation maps an actual wrapped INSERT refusal and rolls back its parent transition', async () => {
    const f = await fixture(); installer.installOrderRevisions({dbPath:f.file,apply:true}); await f.result(f.items[0]); addOwnedInsertRefusal(f);
    const before = await f.snapshot(), attempts = (await rows(f)).attempts;
    await expect(require('../../services/workRepeatService').requestRepeat(f.db,f.items[0].id,f.actor,
        {reason:'INSTRUMENT_FAULT',note:'Owned rejected repeat'})).rejects.toMatchObject({code:'ORDER_ATTEMPT_INSERT_REFUSED',statusCode:409});
    expect(await f.snapshot()).toEqual(before); expect((await rows(f)).attempts).toEqual(attempts);
});
test('scientific reservation maps an actual wrapped INSERT refusal and retains its PENDING authorisation', async () => {
    const f = await qcGateFixture({status:'ACCEPTED',resolvedRules:false,fixedWindowPolicy:false}); held.push(f);
    const item = f.items[0]; await f.result(item);
    await require('../../services/sampleStateService').transitionSample(item.sampleId,'APPROVED',f.actor,'Owned completed approval',{},f.db);
    const service = require('../../services/scientificAmendmentService');
    const requested = await service.requestScientificAmendment(f.db,item.sampleId,f.actor,
        {reason:'Owned client retest',reasonCode:'CLIENT_RETEST',selectedWorkItemIds:[item.id]}); addOwnedInsertRefusal(f);
    const before = await f.snapshot(), attempts = (await rows(f)).attempts;
    await expect(service.authoriseScientificAmendment(f.db,item.sampleId,requested.amendment.id,
        {...f.actor,username:'system:other-authoriser'},{expectedVersion:requested.amendment.version}))
        .rejects.toMatchObject({code:'ORDER_ATTEMPT_INSERT_REFUSED',statusCode:409});
    expect(await f.snapshot()).toEqual(before); expect((await rows(f)).attempts).toEqual(attempts);
    expect(await f.db.sampleAmendment.findUnique({where:{id:requested.amendment.id}})).toMatchObject({status:'PENDING',version:requested.amendment.version});
});
