"""Retain the closed failure and the stock help-publisher output mutation honestly."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-full-ordinary-companion'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes())
assert summary['status']=='FAILED_OR_INCOMPLETE' and summary['exit']==int((dest/'exit-original.txt').read_text())==1
assert summary['suites']==370 and summary['tests']==5630 and summary['passedSuites']==305 and summary['failedSuites']==65
assert summary['passedTests']==4980 and summary['failed']==650 and summary['pending']==summary['todo']==0
assert summary['sourceUnchanged'] is False and summary['selectedInventoryEqual'] and summary['visibleAssetsUnchanged']
before=json.loads((dest/'source-before.json').read_bytes());after=json.loads((dest/'source-after.json').read_bytes())
changed=[path for path in before if before[path]!=after[path]]
assert len(before)==len(after)==1310 and changed==['server/data/help/RELEASE_MANIFEST_v1.json']
for path,digest in after.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
report=json.loads((dest/'report-original.json').read_bytes());inventory=json.loads((dest/'inventory-original.json').read_bytes())
assert len(inventory)==len(set(inventory))==370 and set(row['name'] for row in report['testResults'])==set(inventory)
assert report['numFailedTests']==650 and report['numPassedTests']==4980 and not report['success']
help_result=next(row for row in report['testResults'] if row['name'].replace('\\','/').endswith('/tests/contracts/help_release_rollout.test.js'))
assert help_result['status']=='passed'
manifest=(root/changed[0]).read_bytes();assert hashlib.sha256(manifest).hexdigest()==after[changed[0]]
assert json.loads(manifest)['publishedAt']=='2026-10-14T11:38:04.549Z'
(dest/'help-manifest-after-original.json').write_bytes(manifest)
for path,name in [('server/tests/contracts/help_release_rollout.test.js','help-rollout-source-original.js'),
 ('server/scripts/publish_help_release.cjs','help-publisher-source-original.cjs')]:
 data=(root/path).read_bytes();assert hashlib.sha256(data).hexdigest()==before[path]==after[path]
 (dest/name).write_bytes(data)
provenance={'onlyChangedFrozenPath':changed[0],'beforeSha256':before[changed[0]],'afterSha256':after[changed[0]],
 'beforeArtifactBytesRetained':False,'beforeArtifactShaRetained':True,'afterArtifactBytesRetained':True,
 'stockTest':'help_release_rollout.test.js beforeAll calls publishHelpRelease({dryRun:false})',
 'stockPublisher':'publish_help_release.cjs writes RELEASE_MANIFEST_v1.json with publication timestamp and test revision UUIDs',
 'stockHelpSuitePassed':True,'other1309FrozenInputsUnchanged':True,'generatedManifestRestoredOrStagedAsApplication':False,
 'applicationSummaryStillSourceUnchangedFalse':True,'productionOperations':0}
(dest/'derived-output-provenance.json').write_bytes((json.dumps(provenance,indent=2)+'\n').encode())
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
source=git('diff','--name-only','2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8','HEAD','--','server','client','docs/audit','Dockerfile','docker-entrypoint.sh','.gitattributes').decode().splitlines()
assert len(source)==57 and all(path in before and before[path]==after[path] for path in source)
held=[]
for line in (dest/'physical-retention-original.jsonl').read_text(encoding='utf8').splitlines():
 row=json.loads(line);p=Path(row['path']);assert p.exists(),p
 if p.is_file():held.append({'path':str(p),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(dest/'physical-retained-terminal-index.json').write_bytes((json.dumps({'terminalUtc':summary['closedUtc'],'allTeardownTargetsRetained':True,'files':held},indent=2)+'\n').encode())
rawPins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file() and p.name!='open-retention-index.json'}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_FULL_ORDINARY_FAILURE','summary':summary,'derivedOutput':provenance,
 'sourceDraftPaths':source,'actualApplicationDiffCount':57,'scopeComments':[6163271808,6166518424],
 'originalPreparedTerminalHelperUnusedSuperseded':'retain-issue209-full-companion-terminal-once.py',
 'applicationFullyVerified':False,'productionOperations':0,'rawFiles':rawPins}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 full ordinary CLOSED FAILURE370/5630:305 suites4980 tests passed/650 failures

Actualclosed11:39:13.632135UTC/exit1/exact370inventory/305PASS65FAILsuites/4980PASS650FAILtests/0pendingtodo; originals unchanged at issue209-full-ordinary-companion/index.json. Rawsummary sourceUnchanged=false HONEST: stockhelp_release_rollout beforeAll calls realpublishHelpRelease(dryRun:false), rewrites generatedserver/data/help/RELEASE_MANIFEST_v1.json timestamp11:38:04.549+testrevisionUUIDs. BeforeSHA retained butoriginalpre-runartifactbytes notcaptured; afterbytes+stocktest/publisher/provenance retained, no restore/applicationstage. ALLother1309frozeninputs inclALL57 appdraftpaths/template unchanged; visibleassets byteidentical/everyownedteardownDB/WAL/SHM held. Preparedunusedretain-issue209-full-companion-terminal-once.py requiresall1310unchanged and isSUPERSEDED/MUSTNEVEREXECUTE; newhonestderived-output retainer consumes thisboundary. No runner/fullPASS/209PR/ready/finalaudit/merge/kit/gate/productionoperation. NEXTread650CLOSEDerrors/classifyEACHunderactualClnative11:34 requirement BEFOREfixturecorrection: reachableproductionmissingorder/matchingline =runtimegap/reportCl/distinctreadonlyimpactcause+YYlist; unreachablefixture-only addexplicitnormalcontext/stockassertions unchanged. Original6163271808 exactlegacyfallbackotherwise409+reasonedrevisionremedy/no backfill/relink and6166518424 companions remain. Nativeusercheck248/fullprogress andClreply ONCEd0e1e3bd preserved/neverduplicate. Samewriter/humancontent/103noapply/214+206sourcegreenundeployed/allhistoryguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(rawPins)+[(dest/'index.json').relative_to(root).as_posix()]+source+readmes+[Path(__file__).relative_to(root).as_posix()]
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,pin in rawPins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==pin['sha256'],path
for path in source:assert git('show',':'+path)==(root/path).read_bytes().replace(b'\r\n',b'\n'),path
git('commit','-m','audit(209): retain closed full failure and generated-help output honestly')
retained=git('rev-parse','HEAD').decode().strip()
for path,pin in rawPins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==pin['sha256'],path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8')
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'status':'CLOSED_FULL_ORDINARY_FAILURE','passedTests':4980,'failedTests':650,'closedRawBlobsVerified':len(rawPins),'applicationPathsUnchanged':57,'productionOperations':0}))
