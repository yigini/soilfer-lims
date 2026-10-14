"""Classify all20 QC118 cases and preserve source/assertions while declaring owned order witnesses."""
import datetime,hashlib,json,re,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-qc-disposition-context-review'
assert not dest.exists() and (wp/'issue209-result-views-legacy-review-context-singles/index.json').exists()
path=root/'server/tests/contracts/qc_disposition_release_gate.test.js';original=path.read_bytes()
assert hashlib.sha256(original).hexdigest()=='726e810a0576ec163376e22ee4b75e9a8930dd78a02925e0de41a0fa50779d23'
parser="""const fs=require('node:fs'),crypto=require('node:crypto'),parser=require('@babel/parser'),traverse=require('@babel/traverse').default;
const source=fs.readFileSync('tests/contracts/qc_disposition_release_gate.test.js','utf8'),ast=parser.parse(source,{sourceType:'script'}),sites=[];
function property(n,k){return n.properties.find(p=>p.type==='ObjectProperty'&&((p.key.type==='Identifier'&&p.key.name===k)||(p.key.type==='StringLiteral'&&p.key.value===k)))?.value;}
traverse(ast,{CallExpression(p){if(p.node.callee.type!=='Identifier'||!['createExecutionResultFixture','createExecutionResultsFixture'].includes(p.node.callee.name))return;
if(p.node.arguments[0].type!=='Identifier'||p.node.arguments[0].name!=='prisma')throw Error('Unexpected fixture connection');
const data=property(p.node.arguments[1],'data'),first=data.type==='ArrayExpression'?data.elements[0]:data;
const sample=first.type==='Identifier'?first.name+'.sampleId':source.slice(property(first,'sampleId').start,property(first,'sampleId').end);
const st=p.getStatementParent(),test=p.findParent(q=>q.isCallExpression()&&q.node.callee.type==='Identifier'&&q.node.callee.name==='test');
sites.push({line:p.node.loc.start.line,statementType:st.node.type,byteOffset:Buffer.byteLength(source.slice(0,st.node.start),'utf8'),indent:source.slice(source.lastIndexOf('\\n',st.node.start-1)+1,st.node.start),sampleExpression:sample,test:test?.node.arguments[0]?.value||'beforeAll'});}});
console.log(JSON.stringify({sourceSha256:crypto.createHash('sha256').update(Buffer.from(source)).digest('hex'),sites},null,2));
"""
parsed=subprocess.run(['node','-e',parser],cwd=root/'server',capture_output=True,check=True);sites=json.loads(parsed.stdout)
assert sites['sourceSha256']==hashlib.sha256(original).hexdigest() and len(sites['sites'])==17
dest.mkdir();(dest/'qc_disposition_release_gate.test.js.before-original').write_bytes(original)
(dest/'execution-witness-sites-original.json').write_bytes(parsed.stdout)
report=json.loads((wp/'issue209-full-ordinary-companion/report-original.json').read_bytes());suite=next(s for s in report['testResults'] if Path(s['name']).name==path.name)
cases=[]
for c in suite['assertionResults']:
 assert c['status']=='failed';m='\n'.join(c['failureMessages']);assert m.splitlines()[0]=='Error: A reasoned order revision with the complete analysis set is required before starting this execution.'
 cases.append({'suite':path.name,'test':c['fullName'],'originalFailureSha256':hashlib.sha256(m.encode()).hexdigest(),'originalCaseLineNumbers':re.findall(re.escape(path.name)+r':(\d+):',m),'classification':'SHARED_BEFOREALL_POSITIVE_ACCEPTED_WITNESS_MISSING_ORDER; LATER_WITNESSES_AND_FUTURE_REPEAT_RESERVATIONS_SOURCE_REVIEWED','sourceDecision':'Initial accepted PH_H2O witness, seventeen direct evidence sites and two REANALYZE setups receive explicit usable legacy NULL order lines in NEW owned fixture assembly. Read actual existing canonical WIs; preserve retained line identities; append only a line for a newly assembled additional owner. Duplicate children share the unchanged exact legacy match; no new owners or historical relink. Manual-invalid/sensor/unknown/malformed/QC-only flags, all scalar values/units, terminal/published/superseded records, roles/scope/idempotency/queue/conflict/concurrency/batch-membership/history/cleanup assertions remain unchanged.','assertionChanges':0,'runtimeChanges':0,'productionInspections':0,'runtimeVariant':'Released48d absent-order WIs remain runtime-reachable zero-write refused; separate readonly noACTIVE/noMatching/fraction and approvednonzeroSTOP lists per6167740581. No automatic runtime correction.'})
assert len(cases)==20
(dest/'pre-correction-classification.json').write_bytes((json.dumps({'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'reviewedBeforeChanges':True,'originalFailedCases':20,'cases':cases,'witnessSitesReviewed':17,'additionalReservationSitesReviewed':[9,15],'productionOperations':0},indent=2)+'\n').encode())
newline='\r\n' if b'\r\n' in original else '\n';additions=[];modified=original
for site in sorted(sites['sites'],key=lambda s:s['byteOffset'],reverse=True):
 assert site['statementType'] in ['ExpressionStatement','VariableDeclaration'] and site['indent'].isspace()
 text='await declareOwnedQcOrderContext('+site['sampleExpression']+');'+newline+site['indent'];raw=text.encode();offset=site['byteOffset']
 modified=modified[:offset]+raw+modified[offset:];additions.append(text)
function="""// #209: order context belongs only to this NEW owned QC fixture assembly.
async function declareOwnedQcOrderContext(sampleId) {
    require('../../services/workflowStateRules').assertFixtureContext();
    await prisma.$transaction(async tx => {
        const main = (await tx.$queryRawUnsafe('PRAGMA database_list')).find(row => row.name === 'main');
        const path = require('node:path'), fs = require('node:fs');
        if (!main?.file || !fs.existsSync(main.file) || path.dirname(fs.realpathSync(main.file)) !== path.resolve(__dirname, '../.tmp'))
            throw Error('QC order context requires this owned test database.');
        if (process.env.PRODUCTION_DATABASE_PATH && path.resolve(main.file).toLowerCase() === path.resolve(process.env.PRODUCTION_DATABASE_PATH).toLowerCase())
            throw Error('QC order context refuses production.');
        const owners = await tx.workItem.findMany({ where: { sampleId, duplicateOf: null } });
        const codes = [...new Set(owners.map(item => item.analysis.trim()))];
        if (!codes.length) throw Error('QC order context requires existing canonical owners.');
        const active = await tx.sampleOrderRevision.findMany({ where: { sampleId, status: 'ACTIVE' }, include: { lines: true } });
        if (active.length > 1) throw Error('QC owned assembly requires a single declared active order.');
        const uuid = () => require('node:crypto').randomUUID();
        if (!active.length) {
            await tx.sampleOrderRevision.create({ data: { id: uuid(), sampleId, version: 1, status: 'ACTIVE',
                reason: 'Owned retained QC execution order context', requestedBy: 'system:fixture',
                lines: { create: codes.map(analysis => ({ id: uuid(), analysis, workItemId: null, status: 'ACTIVE', isRequired: true })) } } });
        } else for (const analysis of codes) {
            const matching = active[0].lines.filter(line => line.analysis === analysis && line.status === 'ACTIVE');
            if (matching.length > 1) throw Error('QC owned assembly refuses ambiguous declared lines.');
            if (!matching.length) await tx.orderLine.create({ data: { id: uuid(), revisionId: active[0].id,
                analysis, workItemId: null, status: 'ACTIVE', isRequired: true } });
        }
    });
}

""".replace('\n',newline)
anchor=b"describe('QC Batch Inspection, Disposition & Release Gates Contract Tests (#118)'";assert modified.count(anchor)==1
modified=modified.replace(anchor,function.encode()+anchor);additions.append(function)
for name in ['reanalyzeBatchId','batchWiTestId']:
 anchor=('        await normalizeLegacyQcFixture(prisma, '+name+');').encode();assert modified.count(anchor)==1
 text='        await declareOwnedQcOrderContext(activeSample.id);'+newline;modified=modified.replace(anchor,text.encode()+anchor);additions.append(text)
recovered=modified
for text in reversed(additions):assert text.encode() in recovered;recovered=recovered.replace(text.encode(),b'',1)
assert recovered==original
path.write_bytes(modified)
(dest/'fixture-additions-original.json').write_bytes((json.dumps([{'path':path.relative_to(root).as_posix(),'beforeSha256':hashlib.sha256(original).hexdigest(),'afterSha256':hashlib.sha256(modified).hexdigest(),'oldSourceAndEveryAssertionExactlyRecoveredByRemovingAdditions':True,'additions':additions}],indent=2)+'\n').encode())
print(json.dumps({'classifiedOriginalCases':20,'fixturePaths':1,'directWitnessContexts':17,'repeatReservationContexts':2,'ownedDatabaseGuard':True,'oldSourceAndAssertionsRecovered':True,'runtimeChanges':0,'productionOperations':0}))
