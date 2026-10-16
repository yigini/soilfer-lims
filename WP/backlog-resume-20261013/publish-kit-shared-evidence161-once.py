"""Publish bounded transport/shared-admission LOCAL source; no host operation."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016';D=K/'shared-evidence161-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='ee42e2450db5573a57be17a06adae7f2b72c627b'
assert not git('diff','--cached','--name-only').strip()
runs=['local-tests-shared-admission-bounded-streams-first','local-tests-shared-admission-bounded-streams-lf-final']
verifications=[json.loads((K/run/'verification.json').read_bytes()) for run in runs]
for run,value in zip(runs,verifications):
    assert value['exitCode']==0 and value['sourceBefore']==value['sourceAfter']
    assert b'Ran 161 tests' in (K/run/'stderr-original.txt').read_bytes()
v=verifications[-1]
changed={name:{'testedSha256':digest,'currentSha256':sha((K/name).read_bytes())}
    for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}
assert set(changed)=={'README.md'}
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
assert pr300['head']['sha']==ci300['head_sha']=='827760b8b83c5a4bd0581ee1369648b91818d584'
assert ci299['run_attempt']==ci300['run_attempt']==1
assert all(c['status']=='completed' and c['conclusion']=='failure' for c in (ci299,ci300))
assert not [c for c in comments if c['id']>6213266959 and (c.get('performed_via_github_app') or {}).get('id')==1236702], 'Read actual new Claudio direction first'
D.mkdir()
for i,(endpoint,raw) in enumerate(captures):save(D,'api-original-'+str(i)+'.json',raw)
fixtures=[]
for directory in sorted(K.glob('*-local-retained-fixtures')):
    for path in sorted(directory.rglob('*')):
        if path.is_file():
            raw=path.read_bytes();s=path.stat()
            fixtures.append({'path':path.relative_to(K).as_posix(),'bytes':len(raw),'sha256':sha(raw),
                'localModeObserved':s.st_mode&0o777,'localLinksObserved':s.st_nlink})
save(D,'all-local-fixtures-hash-inventory.json',canonical({'fixtures':fixtures,'newFixtureBytesPublic':False,
    'privateHostBytesFetched':0,'productionBytes':0,'syntheticFutureReviewsAreNotActualApprovals':True})+b'\n')
save(D,'boundary-record.json',canonical({'publishedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'closedUtc':v['closedUtc'],'localTests':161,'sourceUnchangedDuringBothRuns':True,'frozenSourceFiles':len(v['sourceBefore']),
    'postRunREADMEOnly':changed,'firstRunPassedBeforeRetainedFilesLfNormalization':True,
    'hostCalls':0,'productionSqlConnections':0,'newQualificationRuns':0,'deployment':False,
    'sourceReviewRequested':False,'remoteRootCreated':False,'realPackageCreated':False,'realKitGateCreated':False,
    'commandStreamPredicateBytes':67108864,'commandRetainedMaximumBytesPerStream':67108865,
    'successfulCommandRequiresBothEofAndAllOriginals':True,'fileSizePollingReplacedByBoundedPipeReads':True,
    'noReaderThreadsOrPostSealWriters':True,'commandOutputAllocationOvershootFromPollingRemoved':True,
    'sharedCoveredEvidenceSubsetBytes':3221225472,'commandShareBytes':1610612736,
    'combinedAllOwnerMemoryShareBytes':536870912,'combinedControllerShareBytes':536870912,'combinedJournalShareBytes':536870912,
    'unassignedWithinExisting4GiBBytes':1073741824,'ledgerIsNotFilesystemMeasurement':True,
    'atomicMetadataDataCountedOnceAndBothEntryNamesCounted':True,'nestedDirectoryAllocationsCharged':True,
    'allEvidenceClosureClaimed':False,'capacityPassClaimed':False,'copySiteClosureCreated':False,
    'stillMissing':['fetch/HTTP/private-key/cron/control and standalone emergency/hook producer closure',
        'complete per-CLI/pre-start evidence envelope and whole-graph physical copy/evidence closure',
        'source-reviewed executable fresh host/Apache/scientific capture and held bytes',
        'actual complete source review/exact-kit review/fresh human gate'],
    'oldSwapConfigurationPreservedNotCandidateSwap0':True,'readinessSecondsUnchanged':600,
    'parallelOriginalCIs':{str(c['id']):{'head':c['head_sha'],'attempt':c['run_attempt'],
        'status':c['status'],'conclusion':c['conclusion']} for c in (ci299,ci300)},
    'parallelCorrectedFullLocalRunsActive':True,'replacementCiPushed':False,
    'parentReadyOrAuditRequested':False,'mainMergeHold':True})+b'\n')
extras={p for p in K.iterdir() if p.is_file()}
for run in runs:extras|={p for p in (K/run).rglob('*') if p.is_file()}
extras.add(W/'WP/backlog-resume-20261013'/pathlib.Path(__file__).name)
when=datetime.datetime.now(datetime.timezone.utc).isoformat()
lead=f'''LATEST CONCRETE BOUNDED PIPE TRANSPORT / SHARED EVIDENCE ADMISSION /161 LOCAL PASS - {when}.
SAME be837974/acc15844 kit has161LOCALtestsPASS in both complete frozen runs,95sourcefiles unchanged during each. First run passed; retained_files.py then normalized CRLF to LF after Git whitespace check; final complete161PASS followed, with README-only explanation afterward. Bounded nonblocking pipe reads replace direct child file output and50ms file-size polling. Each stdout/stderr can retain at most67108865originalB (64MiB+one overflow-proof byte). Both EOFs plus complete originals are mandatory for success; an oversized/timeout prefix is explicitly incomplete and refuses. Fast child exit cannot bypass final drains, simultaneous stdin/stdout/stderr do not deadlock, no reader threads/late file writers exist. Natural pre-capture reservation includes the extra sentinel allocation. All successful original stream bytes remain exact; over-limit failure never claims a complete transcript.
New kit_evidence.py is bound once before controller reads, with shared3GiB admissions across command1536MiB, ALL CLI/candidate/recovery memory512MiB, controller512MiB and journal512MiB. Complete command streams are reserved BEFORE child launch, unused allowance settles only after pipes close/files seal; failed/existing names remain consumed. Atomic metadata charges data once plus BOTH retained hardlink entry names; nested directory allocations/entries are charged once. Shared memory is no longer an independently spendable256MiB for each of15owners. This is a single-process allocation allowance, NOT an actual filesystem/host measurement or global4GiB closure. Remaining1GiB is intentionally UNASSIGNED pending fetch/HTTP/private-key/cron/control/emergency/hook producer sweep and complete pre-start CLI envelopes. Standalone hook stays unbound so quota/retention failures cannot suppress exact stops. No actual runtime quota, host command, stop or new installer transaction killpoint ran.
Both161runs use actualLOCALWindows child processes/syntheticSQLite/Node24.13 and Docker/kernel/systemd stand-ins only. Local burst/exact-bound/binary/fast-exit/stdin/timeout/shared-owner/hardlink/nested-entry/prelaunch-refusal guards pass. All frozen source and actual458app/162oldsource Git bindings validate locally; generated standalone stop-post has exact embedded ASTs and was built ONLY, never executed. New fixture bytes LOCALwithheld/fullhashinventorypublic. No host/SSH/Docker/cgroup/Linuxfsync/productionSQL/du/memorysampling/newqualification/package/root/unit/gate/attempt/deployment.
KEEP ACTUALLY IMPLEMENT complete whole-graph copy/evidence closure and executable fresh source-reviewed host/Apache/scientific capture/held bytes. copy-site-closure.json STILLABSENT/source-index refuses incomplete graph/normal37-min64 NOTcapacityPASS. No actual source-review request or SourcePASS exists: do NOTwait for one. Proposed150000root UNCREATED/unreserved. Then ONE complete actual source review carrying621326ACKONLYthere, exact frozenkit review and fresh uneditedYY workload/193Sample23Hold20oldcross1ZMBnotice/otherlabs0/maygrow/scientific-list/whole-outage acceptance. Wholeoutage50min/2997.171478350916s stays PROPOSAL/historical+20unmeasured allowances, NOT measured production/YYacceptedlimit.600readiness/5400controller unchanged.621299+621326 govern/both questions ANSWERED/ALL nativefallbacks CANCELLEDforever/no duplicateACKGHnative.
Existing207208 ONLY corrected full LOCAL runs ACTIVE/frozen/no source edits while active.207two-file preservation harness correction focused142PASS;20812-path unchanged approved180DDLowner/no backfill/allocation/renumber/digest-only scanner entry focused235PASS/buildlintPASS14baselinewarnings, visible preflight14suites259PASS/full376inventory. Parent authorization remains LOCAL corrections/tests ONLY, no commit/push/replacementCI/retry/ready/audit/merge until concrete full result/patch reviewed. BOTH original PR299457f/run38898578537attempt1 andPR300827760b/run38898969962attempt1 CLOSEDFAILED readiness; server/bothrealDockerbuilds/boundary successes do NOT make overallCI green. ParentONEready/exacthead audit ONLYactualCOMPLETEgreen ordinaryPRCI inclALLrealDocker. ALLmainmerges HOLD actualbeDEPLOYED+actualClpostcheckPASS.
Fresh localGH samebe/mainCI38772398721attempt1CLOSEDSUCCESS/#191CLOSED/no lateractualCl after621326 at publication. SameheartbeatACTIVE2min/restore10ONLYactualdeployment+actualClpostdeployPASS. R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanfilesdraftscards preserved. ALL earlier history remains verbatim below.

'''
print(json.dumps(boundary_publish(D,extras,'feat(release): bound command streams and share evidence admissions',lead)))
