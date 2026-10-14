"""Correct only named owned teardown parent retention after honest closed failure, once."""
import datetime,hashlib,json,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;prior=wp/'issue209-workbench-request-order-context-review';dest=wp/'issue209-workbench-request-order-retention-corrected-context-review'
assert not dest.exists() and (wp/'issue209-workbench-request-order-context-singles/index.json').exists()
summary=json.loads((wp/'issue209-workbench-request-order-context-singles/summary-observed.json').read_bytes());assert summary['status']=='FAILED_OR_INCOMPLETE' and summary['closedSuites']==1 and summary['passedTests']==13
rows=json.loads((prior/'fixture-additions-original.json').read_bytes())
for row in rows:assert hashlib.sha256((root/row['path']).read_bytes()).hexdigest()==row['afterSha256']
dest.mkdir();classification=json.loads((prior/'pre-correction-classification.json').read_bytes());classification['correctedBeforeSuccessor']=True;classification['retainedParentCleanupDecision']='After all13 original assertions passed, original teardown FK refused orderLine deletion referenced by retained WorkAttempt. Guard only two old orderLine/revision delete calls when retained attempts exist; keep original statements/all assertions/runtime FK/history guards. Not a runtime repair or hidden failing assertion.'
(dest/'pre-correction-classification.json').write_bytes((json.dumps(classification,indent=2)+'\n').encode())
for row in rows:
 name=Path(row['path']).name;(dest/(name+'.before-original')).write_bytes((prior/(name+'.before-original')).read_bytes())
 if name=='workbench_single_entry.test.js':
  path=root/row['path'];raw=path.read_bytes();newline='\r\n' if b'\r\n' in raw else '\n';text=raw.decode();(dest/'single-entry-before-parent-guard-original.js').write_bytes(raw)
  first='        await prisma.orderLine.deleteMany({ where: { revision: { sampleId: testSampleId } } });';last='        await prisma.sampleOrderRevision.deleteMany({ where: { sampleId: testSampleId } });'+newline
  prefix='        // #209: retained execution parents remain until this owned database is torn down.'+newline+"        require('../../services/workflowStateRules').assertFixtureContext();"+newline+'        if (await prisma.workAttempt.count({ where: { workItem: { sampleId: testSampleId } } }) === 0) {'+newline
  suffix='        }'+newline
  assert text.count(first)==text.count(last)==1;text=text.replace(first,prefix+first).replace(last,last+suffix);raw=text.encode();path.write_bytes(raw)
  row['additions'] += [prefix.replace('\r\n','\n'),suffix.replace('\r\n','\n')];row['afterSha256']=hashlib.sha256(raw).hexdigest();row['teardownRetainsAttemptOrderParents']=True
 recovered=(root/row['path']).read_text(encoding='utf8')
 for added in reversed(row['additions']):assert added in recovered;recovered=recovered.replace(added,'',1)
 assert recovered==(dest/(name+'.before-original')).read_text(encoding='utf8'),name
(dest/'fixture-additions-original.json').write_bytes((json.dumps(rows,indent=2)+'\n').encode())
print(json.dumps({'originalCasesClassified':11,'fixturePaths':4,'parentGuardOnlyAfterAssertions':True,'oldSourceAndAllAssertionsRecovered':True,'runtimeChanges':0,'productionOperations':0}))
