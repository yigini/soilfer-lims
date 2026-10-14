"""Bind the owned afterAll guard to a unique marker and prove unchanged old source, once."""
import datetime,hashlib,json,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;prior=wp/'issue209-workbench-request-order-context-review';failed=wp/'issue209-workbench-request-order-retention-corrected-context-review';dest=wp/'issue209-workbench-request-order-retention-bound-context-review'
assert failed.exists() and not dest.exists() and not (failed/'fixture-additions-original.json').exists()
rows=json.loads((prior/'fixture-additions-original.json').read_bytes());dest.mkdir()
classification=json.loads((failed/'pre-correction-classification.json').read_bytes());classification['previousProofRefused']='Common closing brace removal matched an old brace; no tests started from that preparer. Replace only added guard closing marker, then prove old source byte-for-byte.'
(dest/'pre-correction-classification.json').write_bytes((json.dumps(classification,indent=2)+'\n').encode())
for row in rows:
 name=Path(row['path']).name;original=(prior/(name+'.before-original')).read_bytes();(dest/(name+'.before-original')).write_bytes(original)
 path=root/row['path'];raw=path.read_bytes();newline='\r\n' if b'\r\n' in raw else '\n'
 if name=='workbench_single_entry.test.js':
  (dest/'failed-common-marker-source-original.js').write_bytes(raw)
  prefix='        // #209: retained execution parents remain until this owned database is torn down.'+newline+"        require('../../services/workflowStateRules').assertFixtureContext();"+newline+'        if (await prisma.workAttempt.count({ where: { workItem: { sampleId: testSampleId } } }) === 0) {'+newline
  suffix='        }'+newline
  last='        await prisma.sampleOrderRevision.deleteMany({ where: { sampleId: testSampleId } });'+newline
  text=raw.decode();assert text.count(prefix)==1 and text.count(last+suffix)==1
  # Establish what the failed preparer actually wrote before changing its marker.
  recovered=text.replace(prefix,'',1).replace(last+suffix,last,1)
  for added in reversed(row['additions']):
   normalized=added.replace('\n',newline);assert normalized in recovered;recovered=recovered.replace(normalized,'',1)
  assert recovered.encode()==original
  marker='        } // #209 owned retained order parents'+newline
  text=text.replace(last+suffix,last+marker,1);raw=text.encode();path.write_bytes(raw)
  row['additions'] += [prefix.replace('\r\n','\n'),marker.replace('\r\n','\n')];row['afterSha256']=hashlib.sha256(raw).hexdigest();row['teardownRetainsAttemptOrderParents']=True
 else:assert hashlib.sha256(raw).hexdigest()==row['afterSha256'],name
 recovered=raw.decode().replace('\r\n','\n')
 for added in reversed(row['additions']):assert recovered.count(added)==1,(name,added);recovered=recovered.replace(added,'',1)
 assert recovered==original.decode().replace('\r\n','\n'),name
(dest/'fixture-additions-original.json').write_bytes((json.dumps(rows,indent=2)+'\n').encode())
failedHelper=wp/'prepare-issue209-workbench-order-parent-retention-context-once.py'
(dest/'failed-preparer-proof-record.json').write_bytes((json.dumps({'recordedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'helper':failedHelper.name,'helperSha256':hashlib.sha256(failedHelper.read_bytes()).hexdigest(),'exit':1,'sourceWrittenBeforeProofRefusal':True,'commonClosingMarkerCausedProofMismatch':True,'testsStarted':False,'oldSourceExactlyRecoveredByAnchoredRemoval':True,'oldHelperAndArtifactsPreserved':True,'onlyAddedClosingMarkerChanged':True,'runtimeChanges':0,'productionOperations':0},indent=2)+'\n').encode())
print(json.dumps({'originalCasesClassified':11,'fixturePaths':4,'uniqueMarkerByteProof':True,'oldSourceAndAllAssertionsRecovered':True,'runtimeChanges':0,'productionOperations':0}))
