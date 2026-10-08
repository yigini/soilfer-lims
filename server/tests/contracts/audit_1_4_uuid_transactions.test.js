const { createResultFixture } = require('../../services/resultWriteService');
const { createExecutionResultsFixture } = require('../helpers/workAttemptFixtures');
const { createSampleFixture, createWorkItemFixture, createSamplesFixture } = require('../helpers/workflowFixtures');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const jwt = require('jsonwebtoken');
const request = require('supertest');
const Database = require('better-sqlite3');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken, ensureTestLab } = require('../setup');
const { generateWorkItemsForSample } = require('../../controllers/workItemController');
const importController = require('../../controllers/importController');
const { diagnoseCurrentResults } = require('../../scripts/diagnose_current_results');
const { calculateUsdaTexture } = require('../../utils/soilCalculations');
const id = () => crypto.randomUUID();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const labId = 'LAB-AUDIT-14';

// Inspect bound ids as well as inline Prisma and SQL writes. A text search of
// create({ data: { id: ... } }) alone misses aliases and prepared statements.
function weakAuditIds(source) {
    const failures = new Set();
    const propertyName = node => node?.property?.name || node?.property?.value;
    const key = node => node?.key?.name || node?.key?.value;
    function bound(node, scope) {
        if (node?.type !== 'Identifier') return { node, scope };
        const binding = scope.getBinding(node.name);
        return binding?.path.node.type === 'VariableDeclarator'
            ? { node: binding.path.node.init, scope: binding.path.scope } : { node, scope };
    }
    function weak(node, scope, seen = new Set()) {
        if (!node || seen.has(node)) return false;
        seen.add(node);
        if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' &&
            ((node.callee.object.name === 'Date' && propertyName(node.callee) === 'now') ||
             (node.callee.object.name === 'Math' && propertyName(node.callee) === 'random'))) return true;
        const resolved = bound(node, scope);
        if (resolved.node !== node) return weak(resolved.node, resolved.scope, seen);
        return Object.values(node).some(value => Array.isArray(value)
            ? value.some(child => child?.type && weak(child, scope, seen))
            : value?.type && weak(value, scope, seen));
    }
    function dataIds(node, scope, seen = new Set()) {
        if (!node || seen.has(node)) return;
        seen.add(node);
        const resolved = bound(node, scope);
        if (resolved.node !== node) return dataIds(resolved.node, resolved.scope, seen);
        if (node.type === 'ArrayExpression') return node.elements.forEach(item => dataIds(item, scope, seen));
        if (node.type !== 'ObjectExpression') return;
        for (const property of node.properties) {
            if (property.type === 'SpreadElement') dataIds(property.argument, scope, seen);
            else if (key(property) === 'id' && weak(property.value, scope)) failures.add(property.loc.start.line);
        }
    }
    traverse(parse(source, { sourceType: 'unambiguous' }), {
        VariableDeclarator(p) {
            if (/^audit.*id$/i.test(p.node.id.name || '') && weak(p.node.init, p.scope)) failures.add(p.node.loc.start.line);
        },
        CallExpression(p) {
            const call = p.node, callee = call.callee;
            if (callee.type !== 'MemberExpression') return;
            if (callee.object.type === 'MemberExpression' && propertyName(callee.object) === 'auditLog' &&
                ['create', 'createMany', 'upsert'].includes(propertyName(callee))) {
                const argument = bound(call.arguments[0], p.scope);
                const data = argument.node?.properties?.find(property => key(property) ===
                    (propertyName(callee) === 'upsert' ? 'create' : 'data'))?.value;
                dataIds(data, argument.scope);
            }
            if (propertyName(callee) === 'run' && callee.object.type === 'CallExpression' &&
                propertyName(callee.object.callee) === 'prepare') {
                const sql = callee.object.arguments[0];
                const text = sql?.type === 'TemplateLiteral' ? sql.quasis.map(part => part.value.cooked).join('') : sql?.value;
                if (/INSERT\s+INTO\s+["`]?AuditLog\b/i.test(text || '') && weak(call.arguments[0], p.scope)) {
                    failures.add(call.loc.start.line);
                }
            }
        }
    });
    return [...failures].sort((a, b) => a - b);
}

describe('Audit 1.4: UUID writes and atomic replicate supersession', () => {
    let token, username;
    beforeAll(async () => {
        await ensureTestLab(labId, 'GTM');
        token = await getAuthToken('LAB_MANAGER', labId);
        username = jwt.decode(token).username;
    });
    afterEach(() => jest.restoreAllMocks());

    test('the source guard catches timestamp/random audit ids through aliases, inline writes and SQL', () => {
        for (const source of [
            'const auditLogId = `audit-${Date.now()}`;',
            'db.auditLog.create({ data: { id: `log-${Math.random()}` } });',
            'const rowId = Date.now().toString(); db.auditLog.create({ data: { id: rowId } });',
            'const row = { id: `${Math.random()}` }; db.auditLog.create({ data: row });',
            'db.prepare(`INSERT INTO AuditLog (id, entity) VALUES (?, ?)`).run(`audit-${Date.now()}`, "SAMPLE");'
        ]) expect(weakAuditIds(source)).not.toEqual([]);
        expect(weakAuditIds('db.auditLog.create({ data: { id: crypto.randomUUID(), timestamp: Date.now() } });')).toEqual([]);
    });

    test('active audit ids never derive from Date.now or Math.random', () => {
        const serverDir = path.resolve(__dirname, '../..');
        const files = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
            const filename = path.join(directory, entry.name);
            return entry.isDirectory() ? files(filename) : entry.name.endsWith('.js') ? [filename] : [];
        });
        const failures = ['controllers', 'services', 'utils', 'routes'].flatMap(directory =>
            files(path.join(serverDir, directory)).flatMap(filename =>
                weakAuditIds(fs.readFileSync(filename, 'utf8')).map(line => `${path.relative(serverDir, filename)}:${line}`)));
        expect(failures).toEqual([]);
    });

    // Inject a storage failure inside the real SQLite transaction, rather than
    // mocking rollback or the controller's response.
    function failCreate(model, predicate) {
        const original = prisma.$transaction.bind(prisma);
        return jest.spyOn(prisma, '$transaction').mockImplementation((callback, options) => {
            if (typeof callback !== 'function') return original(callback, options);
            return original(tx => callback(new Proxy(tx, { get(target, key) {
                if (key !== model) return target[key];
                return new Proxy(target[key], { get(delegate, method) {
                    if (method !== 'create') return delegate[method];
                    return args => {
                        if (predicate(args.data)) throw new Error('Audit 1.4 injected storage failure');
                        return delegate.create(args);
                    };
                } });
            } })), options);
        });
    }

    async function textureFixture({repeatFractions=['SAND','SILT','CLAY']}={}) {
        const sampleId = id();
        await createSampleFixture(prisma, { data: { id: sampleId, originalId: `CODE-${sampleId}`, labId, assignedLab: labId,
            status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE', receptionDate: new Date(),
            requiredAnalyses: '["SAND","SILT","CLAY"]' } });
        // Pin6059445324: explicit ordered owners, with the original workbench state.
        const items = {};
        for (const analysis of ['SAND', 'SILT', 'CLAY', 'TEXTURE']) {
            items[analysis] = await createWorkItemFixture(prisma, { data: { id: id(), sampleId, assignedLab: labId,
                labId, analysis, status: 'ASSIGNED', assignedTo: username, version: 0 } });
        }
        const rows=[];
        for(const [param,value] of [['SAND','20'],['SILT','20'],['CLAY','60']])rows.push(...await createExecutionResultsFixture(prisma,{data:[1,2].map(replicateNo=>({
            id:id(),sampleId,param,value,numericValue:Number(value),replicateNo,unit:'%',isCurrent:true,isValid:true}))}));
        const sourceGroups=[1,2].map(replicateNo=>['SAND','SILT','CLAY'].map(param=>rows.find(row=>row.param===param && row.replicateNo===replicateNo)));
        const textures=await createExecutionResultsFixture(prisma,{textureSourceResultIds:sourceGroups.map(group=>group.map(row=>row.id)),
            data:[1,2].map(replicateNo=>({id:id(),sampleId,param:'TEXTURE',value:'Old class',numericValue:null,replicateNo,unit:'%',isCurrent:true,isValid:true}))});
        rows.push(...textures);
        for(const [index,texture] of textures.entries()) {
            const attempt=await prisma.workAttempt.findUnique({where:{id:texture.attemptId}});
            expect(attempt).toMatchObject({workItemId:items.TEXTURE.id,status:'RECORDED',attemptNo:1});
            expect(JSON.parse(attempt.evidenceData).measurements.find(row=>row.resultId===texture.id)).toMatchObject({
                sourceResultIds:sourceGroups[index].map(row=>row.id),sourceAttemptIds:sourceGroups[index].map(row=>row.attemptId)});
            for(const fraction of sourceGroups[index])expect(await prisma.workAttempt.findUnique({where:{id:fraction.attemptId}}))
                .toMatchObject({workItemId:items[fraction.param].id,status:'RECORDED',attemptNo:1});
        }
        // Pin6069938801: retain the old determinations and request the actual
        // new fraction executions before the original save/rollback exercise.
        for(const param of repeatFractions)await require('../../services/workRepeatService').requestRepeat(prisma,items[param].id,jwt.decode(token),
            {reason:'CONFIRMATION',note:'Confirm retained fraction determinations with a new execution'});
        for (const analysis of Object.keys(items)) items[analysis] = await prisma.workItem.findUnique({ where: { id: items[analysis].id } });
        return { sampleId, rows, items };
    }
    const sampleSave = (f, measurements) => request(app).post(`/api/results/${f.sampleId}`)
        .set('Authorization', `Bearer ${token}`).send({ measurements });
    const measurements = replicateNo => [['SAND', '50'], ['SILT', '35'], ['CLAY', '15']]
        .map(([param, value]) => ({ param, value, unit: '%', replicateNo }));

    test('the production generator creates 500 distinct UUID WorkItems and audit rows at the same timestamp', async () => {
        const samples = Array.from({ length: 250 }, () => ({ id: id(), originalId: id(), labId, assignedLab: labId,
            status: 'PROCESSING', requiredAnalyses: '[]' }));
        await createSamplesFixture(prisma, { data: samples });
        jest.spyOn(Date, 'now').mockReturnValue(1234567890000);
        jest.spyOn(Math, 'random').mockReturnValue(0);
        const generated = [];
        for (const sample of samples) generated.push(...await generateWorkItemsForSample(sample));
        expect(generated).toHaveLength(500);
        expect(new Set(generated.map(row => row.id)).size).toBe(500);
        for (const row of generated) expect(row.id).toMatch(uuid);
        const audits = await prisma.auditLog.findMany({ where: { entityId: { in: samples.map(row => row.id) }, action: 'WORKITEM_GENERATED' } });
        expect(audits).toHaveLength(500);
        expect(new Set(audits.map(row => row.id)).size).toBe(500);
        for (const row of audits) expect(row.id).toMatch(uuid);
        const stored = await prisma.sample.findMany({ where: { id: { in: samples.map(row => row.id) } } });
        expect(new Map(stored.map(row => [row.id, row.originalId]))).toEqual(new Map(samples.map(row => [row.id, row.originalId])));
    }, 60000);

    test('diagnostic reports duplicate-current groups per replicate without changing any row', () => {
        const db = new Database(':memory:');
        try {
            db.exec('CREATE TABLE Result(id TEXT, sampleId TEXT, param TEXT, replicateNo INTEGER, isCurrent INTEGER)');
            const insert = { run: (id, sampleId, param, replicateNo, isCurrent) => require('../../services/resultWriteService').createRawResultFixture(db, { id, sampleId, param, replicateNo, isCurrent }) };
            insert.run('old', 'sample', 'PH', 1, 0);
            insert.run('a', 'sample', 'PH', 1, 1); insert.run('b', 'sample', 'PH', 1, 1);
            insert.run('other-replicate', 'sample', 'PH', 2, 1);
            const before = db.prepare('SELECT * FROM Result ORDER BY id').all();
            expect(diagnoseCurrentResults(db)).toEqual({ groupCount: 1, currentRowCount: 2,
                groups: [{ sampleId: 'sample', param: 'PH', replicateNo: 1, currentCount: 2 }] });
            expect(db.prepare('SELECT * FROM Result ORDER BY id').all()).toEqual(before);
        } finally { db.close(); }
    });

    test('typed QC creates UUID rows even when supplied QC identifiers repeat', async () => {
        const batchId = id();
        await prisma.batch.create({ data: { id: batchId, labId, analysis: 'PH_H2O', profile: 'RACK_40',
            status: 'OPEN', createdBy: username, history: '[]', qcResults: '{}' } });
        await require('../helpers/normalizedQcFixture').normalizeLegacyQcFixture(prisma, batchId);
        const response = await request(app).post(`/api/qc/batches/${batchId}/evaluate`)
            .set('Authorization', `Bearer ${token}`).send({
                blanks: [{ id: 'same-legacy-id', value: 0 }, { id: 'same-legacy-id', value: 0 }],
                controls: [{ id: 'same-legacy-id', expected: 7, measured: 7 }],
                duplicates: [{ id: 'same-legacy-id', value1: 7, value2: 7 }]
            });
        expect(response.status).toBe(200);
        const normalized = await prisma.batch.findUnique({ where: { id: batchId }, include: require('../../services/qcRunViewService').QC_RUN_INCLUDE });
        const rows = require('../../services/qcRunViewService').batchApiView(normalized).qcItems;
        expect(rows).toHaveLength(4);
        expect(new Set(rows.map(row => row.id)).size).toBe(4);
        for (const row of rows) expect(row.id).toMatch(uuid);
        const snapshot = await prisma.auditLog.findFirst({ where: { entityId: batchId, action: 'QC_EVIDENCE_SNAPSHOT' } });
        expect(snapshot.id).toMatch(uuid);
    });

    test('sample result save derives texture within the matching replicate and retains all old values', async () => {
        const f = await textureFixture();
        const parent=await prisma.workAttempt.findUnique({where:{id:f.rows.find(row=>row.param==='TEXTURE').attemptId}});
        const response = await sampleSave(f, measurements(2));
        expect(response.status).toBe(200);
        const after = await prisma.result.findMany({ where: { sampleId: f.sampleId } });
        for (const old of f.rows) {
            const row = after.find(row => row.id === old.id);
            expect(row.value).toBe(old.value);
            expect(row.isCurrent).toBe(old.replicateNo === 1);
            if (old.replicateNo === 2) expect(row.supersededBy).toMatch(uuid);
        }
        const texture = after.find(row => row.param === 'TEXTURE' && row.replicateNo === 2 && row.isCurrent);
        expect(texture.value).toBe(calculateUsdaTexture(50, 35, 15).className);
        expect(texture.id).toMatch(uuid);
        expect(after.filter(row => row.replicateNo === 2 && row.isCurrent)).toHaveLength(4);
        expect(await prisma.workAttempt.findUnique({where:{id:parent.id}})).toEqual(parent);
        expect(await prisma.workAttempt.count({where:{workItemId:f.items.TEXTURE.id}})).toBe(1);
        const event=await prisma.auditLog.findFirst({where:{entity:'WORK_ATTEMPT',entityId:parent.id,action:'DERIVED_RECALCULATED'}});
        const sources=after.filter(row=>['SAND','SILT','CLAY'].includes(row.param) && row.replicateNo===2 && row.isCurrent);
        const causes=await prisma.auditLog.findMany({where:{entity:'WORK_ATTEMPT',action:'FIRST_FILL',entityId:{in:sources.map(row=>row.attemptId)}},
            orderBy:[{timestamp:'asc'},{id:'asc'}]});
        expect(causes).toHaveLength(3);
        expect(JSON.parse(event.details)).toMatchObject({oldResultIds:[f.rows.find(row=>row.param==='TEXTURE' && row.replicateNo===2).id],
            newResultIds:[texture.id],sourceEventIds:causes.map(row=>row.id),
            oldSourceResultIds:['SAND','SILT','CLAY'].map(param=>f.rows.find(row=>row.param===param && row.replicateNo===2).id),
            newSourceResultIds:['SAND','SILT','CLAY'].map(param=>sources.find(row=>row.param===param).id)});
        expect(JSON.parse(event.details)).not.toHaveProperty('sourceEventId');
    });

    test('sample result save rolls back fractions, texture supersession and audit when texture storage fails', async () => {
        const f = await textureFixture();
        const audits = await prisma.auditLog.count();
        failCreate('result', row => row.sampleId === f.sampleId && row.param === 'TEXTURE');
        expect((await sampleSave(f, measurements(2))).status).toBe(500);
        expect(await prisma.result.findMany({ where: { sampleId: f.sampleId }, orderBy: { id: 'asc' } }))
            .toEqual([...f.rows].sort((a, b) => a.id.localeCompare(b.id)));
        expect(await prisma.auditLog.count()).toBe(audits);
    });

    test.each([false, true])('workbench fraction save is atomic with derived texture (storage failure: %s)', async fail => {
        const f = await textureFixture({repeatFractions:['SAND']});
        const item = f.items.SAND;
        const audits = await prisma.auditLog.count();
        if (fail) failCreate('result', row => row.sampleId === f.sampleId && row.param === 'TEXTURE');
        const response = await request(app).post('/api/workbench/batch-save').set('Authorization', `Bearer ${token}`)
            .send({ draft: false, entries: [{ workItemId: item.id, value: '20', replicateNo: 2 }] });
        if (fail) {
            expect(response.status).toBe(500);
            expect(await prisma.workItem.findUnique({ where: { id: item.id } })).toEqual(item);
            expect(await prisma.result.findMany({ where: { sampleId: f.sampleId }, orderBy: { id: 'asc' } }))
                .toEqual([...f.rows].sort((a, b) => a.id.localeCompare(b.id)));
            expect(await prisma.auditLog.count()).toBe(audits);
        } else {
            expect(response.status).toBe(200); expect(response.body.saved).toBe(1);
            const rows = await prisma.result.findMany({ where: { sampleId: f.sampleId } });
            expect(rows.find(row => row.param === 'TEXTURE' && row.replicateNo === 2 && row.isCurrent).value)
                .toBe(calculateUsdaTexture(20, 20, 60).className);
            for (const old of f.rows.filter(row => row.replicateNo === 1)) expect(rows.find(row => row.id === old.id)).toEqual(old);
            const audit = await prisma.auditLog.findFirst({ where: { entityId: item.id, action: 'WORKBENCH_COMPLETE' } });
            expect(audit.id).toMatch(uuid);
            const event=await prisma.auditLog.findFirst({where:{sampleId:f.sampleId,entity:'WORK_ATTEMPT',action:'DERIVED_RECALCULATED'}});
            expect(JSON.parse(event.details).sourceEventIds).toHaveLength(1);
        }
    });

    test('derived recalculation refuses a source event from an earlier transaction with zero writes',async()=>{
        const f=await textureFixture({repeatFractions:['SAND']});
        await prisma.$transaction(tx=>require('../../services/resultWriteService').writeResult(tx,{sampleId:f.sampleId,workItemId:f.items.SAND.id,
            actor:jwt.decode(token),measurement:{param:'SAND',value:'20',unit:'%',replicateNo:2}}));
        const before=await Promise.all([prisma.result.findMany({orderBy:{id:'asc'}}),prisma.workAttempt.findMany({orderBy:{id:'asc'}}),
            prisma.workItem.findMany({orderBy:{id:'asc'}}),prisma.auditLog.findMany({orderBy:{id:'asc'}})]);
        await expect(prisma.$transaction(tx=>require('../../services/resultWriteService').deriveTextureResult(tx,
            {sampleId:f.sampleId,replicateNo:2,actor:jwt.decode(token)}))).rejects.toMatchObject({code:'WORK_ATTEMPT_EVENT_INVALID'});
        expect(await Promise.all([prisma.result.findMany({orderBy:{id:'asc'}}),prisma.workAttempt.findMany({orderBy:{id:'asc'}}),
            prisma.workItem.findMany({orderBy:{id:'asc'}}),prisma.auditLog.findMany({orderBy:{id:'asc'}})])).toEqual(before);
    });

    test('an accepted derived attempt stays frozen while a recalculated Result requires a new real review',async()=>{
        const f=await textureFixture({repeatFractions:[]}),actor=jwt.decode(token),texture=f.rows.find(row=>row.param==='TEXTURE' && row.replicateNo===2);
        await require('../helpers/qcPolicyFixture').setFixtureQcRequirement(prisma,actor,labId);
        await require('../../services/workItemStateService').transitionWorkItem(f.items.TEXTURE.id,'COMPLETED',actor,'Derived fixture ready for review',{},prisma);
        await require('../../services/submissionStateService').createSubmissionForItems({db:prisma,actor,sampleId:f.sampleId,type:'PARTIAL',workItemIds:[f.items.TEXTURE.id]});
        expect((await request(app).post(`/api/work/${f.items.TEXTURE.id}/review`).set('Authorization',`Bearer ${token}`)
            .send({decision:'ACCEPT',attemptId:texture.attemptId,note:'Reviewed original derived value'})).status).toBe(200);
        const frozen=await prisma.workAttempt.findUnique({where:{id:texture.attemptId}});expect(frozen.status).toBe('ACCEPTED');
        const repeat=await require('../../services/workRepeatService').requestRepeat(prisma,f.items.SAND.id,actor,{reason:'CONFIRMATION',note:'Confirm sand determination'});
        const changed=await request(app).post('/api/workbench/batch-save').set('Authorization',`Bearer ${token}`)
            .send({draft:false,entries:[{workItemId:f.items.SAND.id,value:'20',replicateNo:2,version:repeat.workItem.version}]});
        expect(changed.status).toBe(200);
        const item=await prisma.workItem.findUnique({where:{id:f.items.TEXTURE.id}}),current=await prisma.result.findFirst({where:{sampleId:f.sampleId,param:'TEXTURE',replicateNo:2,isCurrent:true}});
        expect(item).toMatchObject({status:'SUBMITTED',reviewedBy:null,reviewedAt:null,reviewDecision:null});
        expect(await prisma.workAttempt.findUnique({where:{id:frozen.id}})).toEqual(frozen);
        expect(require('../../services/reportResultGovernance').isReviewedReportResult(current,[item],'OFF')).toBe(false);
        expect(await prisma.reviewDecision.count({where:{workItemId:item.id}})).toBe(1);
        expect((await request(app).post(`/api/work/${item.id}/review`).set('Authorization',`Bearer ${token}`)
            .send({decision:'ACCEPT',attemptId:frozen.id,note:'Reviewed recalculation and new source evidence'})).status).toBe(200);
        expect(await prisma.workAttempt.findUnique({where:{id:frozen.id}})).toEqual(frozen);
        expect(await prisma.reviewDecision.count({where:{workItemId:item.id}})).toBe(2);
        const events=await prisma.auditLog.findMany({where:{entity:'WORK_ATTEMPT',entityId:frozen.id,action:'ACCEPTED'}});
        expect(events).toHaveLength(2);expect(events.some(event=>JSON.parse(event.details).newResultIds.includes(current.id))).toBe(true);
        const before=await prisma.auditLog.count();
        await expect(prisma.$transaction(tx=>require('../../services/workAttemptEventService').transitionAttempt(tx,item,frozen.id,'ACCEPTED',actor)))
            .rejects.toMatchObject({code:'WORK_ATTEMPT_TRANSITION_REFUSED'});
        expect(await prisma.auditLog.count()).toBe(before);
    });

    async function importFixture() {
        const analysis = await prisma.analysis.findFirst({ where: { code: 'PH_H2O' } });
        const method = await prisma.methodology.findFirst({ where: { analysisCode: analysis.code } }) || await prisma.methodReference.findFirst();
        expect(method).not.toBeNull();
        const unit = await prisma.unit.findFirst();
        const sampleId = id();
        await createSampleFixture(prisma, { data: { id: sampleId, originalId: sampleId, labId, assignedLab: labId, status: 'APPROVED' } });
        const rows = [];
        for (const replicateNo of [1, 2]) rows.push(await createResultFixture(prisma, { data: {
            id: id(), sampleId, param: analysis.code, value: '5', replicateNo, isCurrent: true, isValid: true,
            provenance: 'IMPORTED', attemptId: null } }));
        return { sampleId, rows, request: { body: { sampleIdColumn: 'sample', labId,
            columnMappings: [{ column: 'value', analysisCode: analysis.code, methodologyId: method.id, unitCode: unit.code }],
            rows: [{ sample: sampleId, value: '6.5' }] }, user: { username, role: 'LAB_MANAGER', labId } } };
    }
    async function executeImport(req) {
        const result = { status: 200 };
        const res = { status(code) { result.status = code; return res; }, json(body) { result.body = body; } };
        await importController.executeImport(req, res);
        return result;
    }
    test('legacy import supersedes only replicate 1, retains old rows, and writes UUID results/audits', async () => {
        const f = await importFixture();
        const response = await executeImport(f.request);
        expect(response.status).toBe(200); expect(response.body.importedResults).toBe(1);
        expect(await prisma.workItem.count({ where: { sampleId: f.sampleId } })).toBe(0);
        expect(await prisma.workAttempt.count({ where: { workItem: { sampleId: f.sampleId } } })).toBe(0);
        const rows = await prisma.result.findMany({ where: { sampleId: f.sampleId } });
        expect(rows.find(row => row.id === f.rows[0].id)).toMatchObject({ value: '5', isCurrent: false });
        expect(rows.find(row => row.id === f.rows[1].id)).toEqual(f.rows[1]);
        const current = rows.find(row => row.replicateNo === 1 && row.isCurrent);
        expect(current.id).toMatch(uuid); expect(current.value).toBe('6.5');
        expect(rows.find(row => row.id === f.rows[0].id).supersededBy).toBe(current.id);
        const audit = await prisma.auditLog.findFirst({ where: { action: 'IMPORT_LEGACY_DATA', performedBy: username }, orderBy: { timestamp: 'desc' } });
        expect(audit.id).toMatch(uuid);
    });
    test.each(['result', 'auditLog'])('legacy import rolls back supersession and new samples when %s storage fails', async model => {
        const f = await importFixture();
        const newSampleId = id();
        f.request.body.rows.push({ sample: newSampleId, value: '7' });
        const audits = await prisma.auditLog.count();
        failCreate(model, row => model === 'result' ? row.sampleId === newSampleId : row.action === 'IMPORT_LEGACY_DATA');
        expect((await executeImport(f.request)).status).toBe(500);
        expect(await prisma.workItem.count({ where: { sampleId: f.sampleId } })).toBe(0);
        expect(await prisma.workAttempt.count({ where: { workItem: { sampleId: f.sampleId } } })).toBe(0);
        expect(await prisma.sample.findUnique({ where: { id: newSampleId } })).toBeNull();
        expect(await prisma.result.findMany({ where: { sampleId: f.sampleId }, orderBy: { replicateNo: 'asc' } })).toEqual(f.rows);
        expect(await prisma.auditLog.count()).toBe(audits);
    });
});
