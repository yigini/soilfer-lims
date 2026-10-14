"""Preserve original ACTIVE-order fixture and observe the real response before correction."""
import datetime,hashlib,json,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-single-entry-refusal-observation-review'
assert not dest.exists() and (wp/'issue209-profile-scope-workspace-context-singles/index.json').exists()
p=root/'server/tests/contracts/workbench_single_entry.test.js';old=p.read_bytes()
assert b'// Initial Order Revision v1' in old and b"{ id: `OL-PH-${timestamp}`, analysis: 'PH'" in old
newline='\r\n' if b'\r\n' in old else '\n';text=old.decode()
anchor='            await sampleController.updateSampleAnalyses(req, res);'+newline
assert text.count(anchor)==1
block="            console.info('[issue209-single-entry-actual-response]', JSON.stringify({ status: statusVal, body: jsonVal }));"+newline
dest.mkdir();(dest/'workbench_single_entry.test.js.before-original').write_bytes(old)
r=json.loads((wp/'issue209-full-ordinary-companion/report-original.json').read_bytes());s=next(s for s in r['testResults'] if Path(s['name']).name==p.name)
cases=[{'suite':p.name,'test':c['fullName'],'originalFailureSha256':hashlib.sha256('\n'.join(c['failureMessages']).encode()).hexdigest(),'classification':'CAUSE_UNRESOLVED_BEFORE_RUNTIME_RESPONSE_OBSERVATION','sourceDecision':'Fixture already has one ACTIVE revision with PH and EC usable legacy NULL lines. Original update requested PH/EC/POTASSIUM and supplied reason. Do not add redundant order, alter old definitions/statuses/assertions, invent diagnosis or hide possible runtime reconciliation gap. Append observation only after actual controller returns, before unchanged assertion.','assertionChanges':0,'runtimeChanges':0,'productionInspections':0} for c in s['assertionResults'] if c['status']=='failed']
assert len(cases)==2
(dest/'pre-observation-classification.json').write_bytes((json.dumps({'createdUtc':datetime.datetime.now(datetime.UTC).isoformat(),'reviewedBeforeChanges':True,'cases':cases,'realRefusalCausePending':True,'productionOperations':0},indent=2)+'\n').encode())
modified=text.replace(anchor,anchor+block).encode();assert modified.replace(block.encode(),b'',1)==old
p.write_bytes(modified)
(dest/'observation-addition-original.json').write_bytes((json.dumps([{'path':p.relative_to(root).as_posix(),'beforeSha256':hashlib.sha256(old).hexdigest(),'afterSha256':hashlib.sha256(modified).hexdigest(),'oldSourceAndEveryAssertionExactlyRecoveredByRemovingAdditions':True,'additions':[block.replace('\r\n','\n')]}],indent=2)+'\n').encode())
print(json.dumps({'originalCasesObserved':2,'corrections':0,'assertionChanges':0,'runtimeChanges':0,'productionOperations':0}))
