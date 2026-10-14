"""Retain this same frozen successor only after actual closure, including failures."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-orphan-impact-intake-rollback-focused'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes())
assert summary['suites']==6 and summary['tests']==214 and summary['status']=='PASS' and summary['sourceUnchanged'] and summary['selectedInventoryEqual'] and summary['fullDiscovery']==370
before=json.loads((dest/'source-before.json').read_bytes());assert before==json.loads((dest/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
report=json.loads((dest/'report-original.json').read_bytes())
assert summary['tests']==report['numTotalTests'] and summary['failed']==report['numFailedTests']
assert int((dest/'exit-original.txt').read_text())==summary['exit']
if summary['status']=='PASS':
 assert summary['exit']==0 and summary['passedTests']==summary['tests'] and report['success']
 assert all(report[k]==0 for k in ['numFailedTests','numPendingTests','numTodoTests','numFailedTestSuites','numPendingTestSuites'])
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=json.loads((wp/'issue209-full-ordinary-companion/index.json').read_bytes())['sourceDraftPaths']
source=list(dict.fromkeys(source+['server/services/textureOrderContract.js','server/services/workItemReconciliationService.js',
 'server/tests/contracts/audit_3_3_separate_texture.test.js','server/tests/contracts/texture_work_item_atomic.test.js']))
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 row=json.loads(line);p=Path(row['path']);assert p.exists(),p
 if p.is_file():held.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'terminalUtc':summary['closedUtc'],'allTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
rawPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_ORPHAN_IMPACT_INTAKE_ROLLBACK_'+summary['status'],'summary':summary,
 'scopeComments':[6163271808,6166518424,6167740581],'sourceDraftPaths':source,'applicationFullyVerified':False,'productionOperations':0,'rawFiles':rawPins}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 approved-orphan impact and real intake rollback focused PASS6/214

Closed12:03:50.067591UTC6/6suites214/214tests0failedpendingtodo/allfrozeninputsunchanged/exact6inventory/full370discovery. Actualcurrentnativeinitialrevision INSERT failure andinitialline INSERT failure each rollback ALLnewWIs/orderrows/lines/audits in SAMEintakeTX; no caught-and-continue neworphans. MissingACTIVE vsnomatchingline distinctruntimecontext/readonlysamplelists; primaryORDER_LINE_REQUIRED/NO_LINE andexactlegacyfallback unchanged. Approvedorphan ordinaryedit409+linepreflightzero writes andreadonlyapprovedSTOP/sampleIDs proved; no amendment-sideorderstep/backfill/relink. Existing scientific/refusal/continuingOPEN/ownerDRYAPPLYNOOP/originaltriple/diskcopies/scanners allpassed. ActualCl6167740581 required lists/zeroapprovedcountproceed/nonzeroSTOP remainkitconditions/no actualproductioncollection. Closedraws issue209-orphan-impact-intake-rollback-focused/index.json; all57appdraftpaths retained/tested, no runner. Full650failures/65suites still require PERCASEproductionreachability classification BEFOREcorrections; no blanketfixture rewrite/oldassertion weakening. Full3705630closedfailedhonestdaca; onlystockderivedhelpmanifestchanged/all1309coreunchanged. NEXT classify/fixonly currentintake-equivalentpositivecontexts, retainnegativelegacyruntimeboundaries, thennewfullordinary expected5634. No full209PASS/PR/ready/finalaudit/merge/kit/gate/productionoperation. Question6167703632/answer6167740581/nativehandoff alreadyONCE neverrepeat; samewriter/humancontent/103noapply/214+206sourcegreenundeployed/allhistoryguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+[(dest/'index.json').relative_to(root).as_posix()]+source+readmes+[
 Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-orphan-impact-intake-rollback-focused-once.py').relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in rawPins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain closed orphan impact and intake rollback proof')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in rawPins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'passedTests':summary['passedTests'],'failedTests':summary['failed'],'sourceDraftPaths':len(source),'closedRawBlobsVerified':len(rawPins),'productionOperations':0}))
