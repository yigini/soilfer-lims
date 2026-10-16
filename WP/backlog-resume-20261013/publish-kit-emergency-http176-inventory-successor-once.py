"""Publish the176-test LOCAL transport correction; no host operator or review."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016';D=K/'emergency-http176-inventory-successor-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='ef42f8986216c2f62d42cda5203cdb2f9cab7953'
assert not git('diff','--cached','--name-only').strip()
runs=['local-tests-independent-emergency-http-wait-final','local-tests-independent-emergency-http-wait-root-guard-final']
verifications=[json.loads((K/run/'verification.json').read_bytes()) for run in runs]
for run,value in zip(runs,verifications):
    assert value['exitCode']==0 and value['sourceBefore']==value['sourceAfter']
    assert b'Ran 176 tests' in (K/run/'stderr-original.txt').read_bytes()
v=verifications[-1]
assert len(v['sourceBefore'])==97 and all(sha((K/name).read_bytes())==digest for name,digest in v['sourceBefore'].items())
assert {p.name for p in K.iterdir() if p.is_file() and p.suffix in ('.py','.md','.json','.yml','.cjs','.js')}==set(v['sourceBefore'])
assert not (K/'copy-site-closure.json').exists()
assert not list(K.glob('release-package-*')) and not list(K.glob('release-launch-*'))
captures=[]
for endpoint in ['repos/yigini/soilfer-lims/git/ref/heads/main','repos/yigini/soilfer-lims/actions/runs/38772398721',
    'repos/yigini/soilfer-lims/issues/191','repos/yigini/soilfer-lims/pulls/299','repos/yigini/soilfer-lims/pulls/300',
    'repos/yigini/soilfer-lims/actions/runs/38898578537','repos/yigini/soilfer-lims/actions/runs/38898969962']:
    captures.append((endpoint,subprocess.check_output(['gh','api',endpoint],cwd=W)))
endpoint='repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T10%3A15%3A48Z&per_page=100'
paged=subprocess.check_output(['gh','api','--paginate','--slurp',endpoint],cwd=W)
captures.append((endpoint,paged));pages=json.loads(paged)
assert isinstance(pages,list) and len(pages)<=32 and all(isinstance(p,list) and len(p)<=100 for p in pages)
comments=[c for page in pages for c in page];assert len({c['id'] for c in comments})==len(comments)
main,ci,issue,pr299,pr300,ci299,ci300=[json.loads(raw) for _,raw in captures[:7]]
assert main['object']['sha']==ci['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
assert ci['run_attempt']==1 and ci['status']=='completed' and ci['conclusion']=='success' and issue['state']=='closed'
assert pr299['head']['sha']==ci299['head_sha']=='457fba5cbffe4157e1c2b428800a620f131854d6'
assert ci300['head_sha']=='827760b8b83c5a4bd0581ee1369648b91818d584' and pr300['base']['sha']==main['object']['sha']
assert ci299['run_attempt']==ci300['run_attempt']==1
assert all(c['status']=='completed' and c['conclusion']=='failure' for c in (ci299,ci300))
assert not [c for c in comments if c['id']>6213266959 and (c.get('performed_via_github_app') or {}).get('id')==1236702], 'Read actual new Claudio direction first'
P=pathlib.Path('C:/Users/yigin/AppData/Local/Temp/soilfer-207-verify-af36ba07-768c-4bb9-8aa6-79263be8c197')
parallel=json.loads((P/'harness-validation-summary.json').read_bytes())
post=json.loads((P/'postflight-harness.json').read_bytes())
assert parallel['result']=='PASS' and parallel['suites']==374 and parallel['tests']==5710 and parallel['exitCode']==0
assert not post['sourceChanges'] and not post['generatedChanges'] and not post['templateChanges'] and post['indexChanged'] is False
for field,hashfield in [('log','logSha256'),('patch','patchSha256'),('inventory','inventorySha256')]:
    assert sha(pathlib.Path(parallel[field]).read_bytes())==parallel[hashfield]
inventory=json.loads(pathlib.Path(parallel['inventory']).read_bytes());assert inventory['identical'] and inventory['discovered']==inventory['executed']==374 and len(inventory['suites'])==len(set(inventory['suites']))==374
D.mkdir()
save(D,'prior-local-publisher-refusal.json',(W/'WP/backlog-resume-20261013/kit-emergency-http176-publisher-inventory-refusal.json').read_bytes())
for i,(endpoint,raw) in enumerate(captures):save(D,'api-original-'+str(i)+'.json',raw)
for name in ['harness-validation-summary.json','postflight-harness.json','inventory-harness.json','harness-correction.patch']:
    save(D,'issue207-'+name,(P/name).read_bytes())
# Earlier fixture originals were fully hashed in the prior immutable public
# inventory. This is an explicit append-only delta; do not spend time reading
# a gigabyte of old synthetic files again or imply fresh revalidation of them.
prior_path=K/'shared-evidence161-publication-once/all-local-fixtures-hash-inventory.json'
prior_raw=prior_path.read_bytes();prior=json.loads(prior_raw)
old_names={row['path'] for row in prior['fixtures']};fixtures=[]
for directory in sorted(K.glob('*-local-retained-fixtures')):
    for path in sorted(directory.rglob('*')):
        if path.is_file() and path.relative_to(K).as_posix() not in old_names:
            raw=path.read_bytes();s=path.stat()
            fixtures.append({'path':path.relative_to(K).as_posix(),'bytes':len(raw),'sha256':sha(raw),
                'localModeObserved':s.st_mode&0o777,'localLinksObserved':s.st_nlink})
save(D,'new-local-fixtures-hash-inventory.json',canonical({'fixtures':fixtures,'newFixtureBytesPublic':False,
    'priorInventory':prior_path.relative_to(W).as_posix(),'priorInventorySha256':sha(prior_raw),
    'priorInventoryGitBlobOid':oid(prior_raw),'priorFixtureFilesNotReread':True,
    'privateHostBytesFetched':0,'productionBytes':0,'syntheticFutureReviewsAreNotActualApprovals':True})+b'\n')
notes='''Current source milestone:176 LOCAL tests PASS in both frozen runs,97 source files unchanged during each. HTTP bodies now use the bounded original stdout pipe with an exact final status suffix; no curl body file can grow outside transport accounting. Each command can declare smaller independent stdout/stderr limits within the existing64MiB maximum. Binary bodies, marker collisions, exact limits, fast exit and over-limit bursts pass real LOCAL-child checks.

CLI final memory permission is followed by ONE docker wait and ONE full final inspection, replacing the unbounded repeated-inspect loop. Both statuses, full identity and the original600-second deadline remain mandatory. The child command/default heap/installer transaction is unchanged. Child completion and its retained hardlink are fully charged before container creation; private-key and cron originals now have pre-write admissions.

Independent emergency commands now use the same nonblocking pipe drain with no reader threads,4MiB stdout/64KiB stderr maxima plus one overflow byte each, both EOFs required for complete originals. Each of controller and standalone-hook namespaces retains at most96 calls within its own400MiB data/metadata/hardlink-entry envelope. Commands always launch BEFORE retention admission; exhausted/full/aliased evidence cannot suppress later eligible stops. Metadata bypass of the main ledger is restricted to those exact bounded namespace names and sizes. Standalone source embeds exact ASTs and was only built. The existing3GiB shared subset plus800MiB independent allowances still leaves224MiB UNASSIGNED; this is NOT global4GiB filesystem/copy closure.

Both176-test runs passed. Between them only kit_stop.py and generated stop_post.py gained a post-command real-directory retention guard and its explanation. Only this README was added after the final run. Complete pre-start CLI observation/command/controller envelopes, remaining hook/Apache allocation accounting, whole-graph copy closure and executable fresh source-reviewed host/Apache/scientific capture/held bytes remain unfinished. copy-site-closure.json is still absent and incomplete source-index construction refuses. No actual complete source review exists to wait for; continue implementing. LOCAL Windows/Node24.13/syntheticSQLite/stand-ins only; no host/SSH/Linuxfsync/production SQL/qualification/package/root/unit/gate/deployment.

Existing207 corrected full LOCAL run closed374suites5710tests PASS with frozen inputs; parent read the concrete2-file patch and independently checked closed log/inventory/hash evidence. Its tested readiness-script working bytes differ from the staged blob ONLY by CRLF-to-LF normalization; test-file bytes match exactly. Parent now authorizes ONE correction commit/push to existingPR300 and ordinary new-head CI once; no retry of original failed CI or ready/audit/merge. Existing208 remains LOCAL-only/frozen full run active. All main merges remain held for actual release deployment plus actual Claudio postcheck. Earlier history follows unchanged.

'''
old_readme=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+old_readme)
assert (K/'README.md').read_bytes()[len(notes.encode()):]==old_readme
changed={name:{'testedSha256':digest,'currentSha256':sha((K/name).read_bytes())}
    for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}
assert set(changed)=={'README.md'}
between={name for name,digest in verifications[0]['sourceAfter'].items() if v['sourceBefore'][name]!=digest}
assert between=={'kit_stop.py','stop_post.py'}
save(D,'boundary-record.json',canonical({'publishedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'closedUtc':v['closedUtc'],'localTests':176,'sourceUnchangedDuringBothRuns':True,'frozenSourceFiles':97,
    'sourceChangesBetweenSuccessfulRuns':sorted(between),'postRunREADMEOnly':changed,
    'hostCalls':0,'productionSqlConnections':0,'newQualificationRuns':0,'deployment':False,
    'sourceReviewRequested':False,'remoteRootCreated':False,'realPackageCreated':False,'realKitGateCreated':False,
    'httpBodyDirectFileProducerRemoved':True,'httpBodyMaximumBytes':4194304,
    'oneWrapperWaitAndOneFinalFullInspect':True,'readinessSecondsUnchanged':600,
    'emergencyNoReaderThreadsOrLateWriters':True,'emergencyBothEofsRequired':True,
    'emergencyNamespaceCallMaximum':96,'emergencyNamespaceMaximumBytes':419430400,
    'emergencyStdoutMaximumBytes':4194304,'emergencyStderrMaximumBytes':65536,'overflowSentinelPerStream':1,
    'independentEmergencyAllowanceBytes':838860800,'sharedCoveredEvidenceSubsetBytes':3221225472,
    'unassignedWithinExisting4GiBBytes':234881024,'ledgerIsNotFilesystemMeasurement':True,
    'atomicMetadataDataCountedOnceAndBothEntryNamesCounted':True,'nestedDirectoryAllocationsCharged':True,
    'allEvidenceClosureClaimed':False,'capacityPassClaimed':False,'copySiteClosureCreated':False,
    'stillMissing':['complete per-CLI pre-start command/memory/controller evidence envelopes',
        'remaining hook/Apache envelope accounting and whole-graph physical copy/evidence closure',
        'source-reviewed executable fresh host/Apache/scientific capture and held bytes',
        'actual complete source review/exact-kit review/fresh human gate'],
    'parallelOriginalCIs':{str(c['id']):{'head':c['head_sha'],'attempt':c['run_attempt'],
        'status':c['status'],'conclusion':c['conclusion']} for c in (ci299,ci300)},
    'parallelCurrentHeads':{'299':pr299['head']['sha'],'300':pr300['head']['sha']},
    'issue207ClosedCorrectedFullLocal':{'suites':374,'tests':5710,'parentConcreteReviewCompleted':True,
        'oneExistingPrCorrectionPushAndOrdinaryNewHeadCiAuthorized':True,'originalCiRetryAuthorized':False},
    'issue208CorrectedFullLocalActiveAndLocalOnly':True,'parentReadyOrAuditRequested':False,'mainMergeHold':True})+b'\n')
extras={p for p in K.iterdir() if p.is_file()}
for run in runs:extras|={p for p in (K/run).rglob('*') if p.is_file()}
extras.add(W/'WP/backlog-resume-20261013'/pathlib.Path(__file__).name)
extras.add(W/'WP/backlog-resume-20261013/publish-kit-emergency-http176-once.py')
extras.add(W/'WP/backlog-resume-20261013/kit-emergency-http176-publisher-inventory-refusal.json')
when=datetime.datetime.now(datetime.timezone.utc).isoformat()
lead=f'''LATEST CONCRETE INDEPENDENT EMERGENCY / PIPE-BOUND HTTP / SINGLE CLI WAIT /176 LOCAL PASS - {when}.
SAME be837974/acc15844 kit has176LOCALtestsPASS in both frozen runs,97sourcefiles unchanged during each. HTTP body direct writes removed: exact binary bodies plus a final status suffix stay in bounded original stdout with TLS unchanged. Smaller independent command stdout/stderr limits are admitted BEFORElaunch. CLI final host memory permission now precedes ONE docker wait and ONE complete final inspection, with exact status/identity and original600clock unchanged; no repeated-inspect output explosion or installer/heap/transaction change. Child completion plus pending hardlink reserves8192B BEFOREcontainercreate. Private-key and cron originals now admitted before writes.
Independent emergency transport has no reader threads or late writers; both EOFs and full original bytes are mandatory.4MiBstdout/64KiBstderr plus one sentinel each, at most96retainedcalls per controller/standalone-hook namespace fit separate400MiB envelopes including metadata/dataonce/both hardlink entries. Execution ALWAYSprecedes retention admission; exhausted/full/aliased evidence still attempts subsequent eligible exact stops and records explicit retention failure. Exact bounded namespace metadata is independent of main journalquota. Standalonehook exactAST source built ONLY/neverexecuted. Existing shared3GiB plus independent800MiB leaves224MiB STILLUNASSIGNED; NOT actual filesystem/global4GiB/copy closure.
Both176runs passed; only post-command real-directory retention guard/explanation in kit_stop.py and generated stop_post.py changed between successful runs; README-only after final. RealLOCALWindows child processes/Node24.13/syntheticSQLite/Docker-kernel-systemd stand-ins only. All458app/162oldsource bindings locally validate. New fixture bytes LOCALwithheld/new-file fullhash delta references prior immutable full inventory without falsely claiming old fixtures reread. No host/SSH/Linuxfsync/productionSQL/Docker/cgroup/du/memorysampling/newqualification/package/root/unit/gate/attempt/deployment.
KEEP ACTUALLY IMPLEMENT complete pre-start CLI command/memory/controller envelopes, remaining hook/Apache allocation accounting and whole-graph copy/evidence closure, executable fresh source-reviewed host/Apache/scientific capture/held bytes. copy-site-closure.json STILLABSENT/source-index refuses incomplete graph/normal37-min64 NOTcapacityPASS. No actual source-review request or SourcePASS exists to wait for. Proposed150000root UNCREATED/unreserved. Then ONE complete actual source review carrying621326ACKONLYthere/exact frozenkit review/fresh actual uneditedYY workload+193Sample23Hold20oldcross1ZMBnotice/otherlabs0/maygrow/scientific-list/whole-outage acceptance. Wholeoutage50min/2997.171478350916s remains historical+20UNMEASUREDproposal/NOTmeasuredproduction/YYacceptedlimit;600readiness5400controller unchanged.621299+621326 govern/both questions ANSWERED/ALL nativefallbacks CANCELLEDforever/no duplicateACKGHnative.
207 corrected fullLOCAL CLOSED374suites5710testsPASS/2441sourcebuild+21generated+2templates unchanged/exact374inventory; sole expected stock help manifest retained then restored AFTERclosure. Parent READ concrete2-file patch and independently checked log/patch/inventory hashes and source/index. Tested readiness workingbytes differ from staged ONLYCRLF-to-LF; testfileexact. Parent now explicitly approves ONE reviewed correction commit/push to EXISTINGPR300 plus ordinary new-head CI once; original38898969962attempt1 staysCLOSEDFAILED/neverretry. CurrentPR300 head at primary capture:{pr300['head']['sha']}; no new outcome inferred. No ready/audit/merge until actualCOMPLETEgreen new-head ordinaryCI includingALLrealDocker and parentONErequest.208 fullLOCAL remainsACTIVE/frozen/LOCAL-only12-path approved180DDLowner/digestscanner correction/focused235PASS/buildlintPASS14baselinewarnings/preflight259PASS; no commit/push/CI until parent complete concrete review. OriginalPR299457f/run38898578537attempt1 remainsCLOSEDFAILED. Successfulserver/bothDocker/boundary do NOTmake overallCIgreen. ALLmainmerges HOLD actualbeDEPLOYED+actualClpostcheckPASS.
Fresh localGH samebe/mainCI38772398721attempt1CLOSEDSUCCESS/#191CLOSED/no lateractualCl after621326 at publication. SameheartbeatACTIVE2min/restore10ONLYactualdeployment+actualClpostdeployPASS. R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanfilesdraftscards preserved. ALL earlier history remains verbatim below.

'''
print(json.dumps(boundary_publish(D,extras,'feat(release): bound emergency and HTTP evidence transports',lead)))
