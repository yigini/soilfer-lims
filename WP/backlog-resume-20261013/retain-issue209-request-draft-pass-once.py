"""Retain the closed first209 request draft and focused proof, not a completed209 implementation."""
import datetime,hashlib,json,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-request-draft-focused'
assert not (dest/'index.json').exists()
summary=json.loads((dest/'summary.json').read_bytes());assert summary['status']=='PASS' and summary['suites']==1 and summary['tests']==17
assert summary['sourceUnchanged'] and summary['selectedInventoryEqual'] and summary['fullDiscovery']==367
before=json.loads((dest/'source-before.json').read_bytes());after=json.loads((dest/'source-after.json').read_bytes());assert before==after
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
def command(*args):return subprocess.run(args,cwd=root,capture_output=True,check=True).stdout
def git(*args):return command('git',*args)
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
audit=git('rev-parse','HEAD').decode().strip();assert audit=='f08b489a84a621655cc48f934afd09503bf5e3af'
assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==audit
application=['server/services/orderRevisionContract.js','server/tests/contracts/issue_209_order_revision_request.test.js']
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_FIRST_REQUEST_DRAFT_FOCUSED_PASS',
 'summary':summary,'acceptedScopeComment':6163271808,'precedingScopeAudit':audit,'applicationDraftPaths':application,
 'liveServiceWiringComplete':False,'migrationComplete':False,'full209ProofComplete':False,'issue209PrCreated':False,
 'nextWork':['orderService transaction shared by both routes and intake','additive guarded migration with no historical cleanup',
 'insert-only new-attempt order-line resolution with legacy single-match fallback','readonly refusal/ACTIVE ambiguity impact counts for kit',
 'real concurrency/history-preservation/attempt reservation/installer tests and full ordinary verification'],
 'productionOperations':0,'rawFiles':{p.name:{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in dest.iterdir() if p.is_file()}}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 first request-validation draft CLOSED focused PASS

ActualCl209direction6163271808 fully retainedf08b489a; historical installercleanup prohibited/triggerACTIVEguard/explicitfulltargetrepair/priorIDs audit/newinsertlinks/legacyexactsinglematch/historicalOPENNULLpreservation/kitreadonlycounts govern. First NEW source draft orderRevisionContract.js and issue_209_order_revision_request.test.js now exist. CLOSED focused runner passes1/1suite17/17tests at07:36:48.920830UTC/exit0/0failedpendingtodo/all11frozeninputsunchanged/exactselectedinventory/full367discovery. Bothordinarysetups/stockassertions/oneworker512MB/blanklocalNODE_OPTIONS; local retention-onlyteardown preservesheldDBs, stockCIhooks unchanged. Originals/config/discovery/sourcebeforeafter/command/report/exit/summary retained issue209-request-draft-focused/index.json. This is ONLYrequestvalidationdraft, NOTlivewiredorderService/full209PASS/PR/audit. Transaction/schema/installer/new-attemptlegacyresolution/readonlyimpactcounts+behavioralhistory/concurrencyproof remain next. No209 schema/history/productionchanges; no localrunner remains. No newchat/worker/worktree. PR296/#214 exactheadPASS+merge2242/nativefinalhandoff+mergeack COMPLETE/neverrepeat; automaticmainCI38528593695 remainsACTIVE/no terminalresult; #214+#206undeployed/open. KitpolicyPRESENT/NO_OP0 orSTOP/snapshotdisk/actual214impactcounts/Clkitreview/freshgate required. Humancontent/103noapply/science/historyguards preserved.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for path in readmes:
 f=root/path;f.write_bytes(lead.encode()+f.read_bytes())
owned=[p.relative_to(root).as_posix() for p in dest.iterdir()]+application+readmes+[
 Path(__file__).relative_to(root).as_posix(),(wp/'verify-issue209-request-draft-once.py').relative_to(root).as_posix()]
pins={path:hashlib.sha256((root/path).read_bytes()).hexdigest() for path in owned if path not in readmes}
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for path,digest in pins.items():assert hashlib.sha256(git('show',':'+path)).hexdigest()==digest,path
git('commit','-m','feat(209): start reasoned order request contract and retain focused draft proof')
retained=git('rev-parse','HEAD').decode().strip()
for path,digest in pins.items():assert hashlib.sha256(git('show',retained+':'+path)).hexdigest()==digest,path
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'draftSourcePaths':application,'focusedSuites':1,'focusedTests':17,'full209Proof':False,'verifiedBlobs':len(pins)}))
