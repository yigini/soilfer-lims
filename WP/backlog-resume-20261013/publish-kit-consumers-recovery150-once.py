"""Publish closed LOCAL consumer/recovery source and immutable failed CI observations."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016';D=K/'consumers-recovery150-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='aaa0257b676d393ccf436c3428ac658b442976e6'
assert not git('diff','--cached','--name-only').strip()
run='local-tests-recovery-scheduler-consumers-final';v=json.loads((K/run/'verification.json').read_bytes())
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter']
assert b'Ran 150 tests' in (K/run/'stderr-original.txt').read_bytes()
changed={n:{'testedSha256':digest,'currentSha256':sha((K/n).read_bytes())}
    for n,digest in v['sourceBefore'].items() if sha((K/n).read_bytes())!=digest}
assert set(changed)=={'README.md'}
assert {p.name for p in K.iterdir() if p.is_file() and p.suffix in ('.py','.md','.json','.yml','.cjs','.js')}==set(v['sourceBefore'])
assert not (K/'copy-site-closure.json').exists()
assert not list(K.glob('release-package-*')) and not list(K.glob('release-launch-*'))
captures=[]
for endpoint in ['repos/yigini/soilfer-lims/git/ref/heads/main','repos/yigini/soilfer-lims/actions/runs/38772398721',
    'repos/yigini/soilfer-lims/issues/191','repos/yigini/soilfer-lims/pulls/299','repos/yigini/soilfer-lims/pulls/300',
    'repos/yigini/soilfer-lims/actions/runs/38898578537','repos/yigini/soilfer-lims/actions/runs/38898969962',
    'repos/yigini/soilfer-lims/actions/runs/38898578537/jobs','repos/yigini/soilfer-lims/actions/runs/38898969962/jobs']:
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
    'closedUtc':v['closedUtc'],'localTests':150,'sourceUnchangedDuringFinalRun':True,'postRunREADMEOnly':changed,
    'runs':['143PASS loaded/transient two-pass','149tests148PASS1FAIL test JS-vs-JSON node count','150PASS complete revised local run'],
    'hostCalls':0,'productionSqlConnections':0,'newQualificationRuns':0,'deployment':False,
    'sourceReviewRequested':False,'remoteRootCreated':False,'realPackageCreated':False,'realKitGateCreated':False,
    'consumerLoadedTransientAndTwoPassImplemented':True,'consumerSnapshotAtomic':False,
    'recoveryBeforeRootFixedReservationBytes':229376,'recoveryFixedMarginPercent':25,
    'recoveryPinnedOldSources':162,'recoveryStartupRoots':29,'recoveryTransitiveFiles':156,
    'recoveryJavascriptNodes':154,'recoveryJsonDependencies':2,'recoveryMaximumStartupDbCopies':0,
    'recoveryMaximumRetainedPrefixDbCopies':5,'oldDailyBackupFirstInvocationMilliseconds':86400000,
    'normalDeclaredCopies':37,'minimumDbEquivalents':64,'capacityPassClaimed':False,
    'naturalTranscriptSubBudgetBytes':1073741824,'allEvidenceClosureClaimed':False,
    'stillMissing':['whole-graph copy/evidence closure including combined memory/controller/transport/journal bounds',
        'command-output overshoot bound','source-reviewed executable fresh host/Apache/scientific capture and held bytes',
        'actual complete source review/exact-kit review/fresh human gate'],
    'oldSwapConfigurationPreservedNotCandidateSwap0':True,'noNewInstallerTransactionKillPoints':True,
    'parallelOriginalCIs':{str(c['id']):{'head':c['head_sha'],'attempt':c['run_attempt'],
        'status':c['status'],'conclusion':c['conclusion']} for c in (ci299,ci300)},
    'parallelAgentsPreparingNarrowSourceOnlyCorrections':True,'replacementCiPushed':False,
    'parentReadyOrAuditRequested':False,'mainMergeHold':True})+b'\n')
extras={p for p in K.iterdir() if p.is_file()}
for name in ['local-tests-loaded-transient-two-pass-first','local-tests-recovery-branch-transcript-admission-first',
    'local-tests-recovery-scheduler-consumers-final','predecessor-copy-scheduler-extension-source-only-once']:
    extras|={p for p in (K/name).rglob('*') if p.is_file()}
for name in ['derive-predecessor-recovery-copy-binding-once.py','extend-predecessor-recovery-scheduler-binding-once.py',
    pathlib.Path(__file__).name]:extras.add(W/'WP/backlog-resume-20261013'/name)
when=datetime.datetime.now(datetime.timezone.utc).isoformat()
lead=f'''LATEST CONCRETE LOADED/TRANSIENT CONSUMERS / PRE-APPLY COPY BRANCH /150 LOCAL PASS - {when}.
SAME be837974/acc15844 source kit now has150LOCALtestsPASS/all source bytes unchanged during final run/README-only explanation added afterward. New bounded consumer collection covers persistent plus loaded/transient units, complete Docker/cron/process observations, two independent full passes with exact configuration equality and end-catalogue/timer re-enumeration. Only typed scopes with NO executable/trigger/watchdog/lifecycle action have stable classes; ALL process commands still require exact-kit review. Only the exact compiled new controller/ExecStart/nonignoredStopPost/noextra hooks/actions/dropins can appear after capture. Executable command text/order/flags remain pinned; enumerated systemd time/PID/exit metadata only is excluded, ambiguous serialization refuses. Two-pass equality is NOT an atomic host snapshot or an actual absence verdict. No actual host inventory ran.
New kit_recovery_copy.py/predecessor-copy-source-binding.json bind162 actual959d rawGit files:29 startup roots/156 transitive dependencies (154JavaScript+2JSON), exact shell/schema/image-build and explicit daily-backup edges. Startup installer graph has0DBcopy producers; schema86118/two possible markers/32directories reserve229376physicalB plus25percent BEFORE_ROOT onward. Dailybackup first runs after24h, outside5400controller; its backup producer is explicitly pinned, not assumed absent/cache-hit. New alternative preAPPLY budget reserves before SAMEold restart, refuses replay/normal-sequence resumption and physically closes after600readiness BEFOREreopen; at most5retainedprefixDBcopies plus fixed recovery. Original oldMemorySwap1610612736/hostSwap805306368 preserved, never called candidateSwap0. NoDBrestore/no newinstaller transaction killpoints.
Natural observation count256 now refuses BEFORE capture, preventing earlier257th full log read. Each next raw transcript needs a complete command reservation against retained1GiB sub-budget before Dockerlogs; hardlinked metadata bytes counted once plus EVERY directory entry. All originals retained/no truncation. This does NOT close global4GiBevidence: combined memory/controller/transport/journal maxima and between-poll command-output overshoot remain explicit missing work. Normal37/min64 is still NOTcapacityPASS. copy-site-closure.json STILLMISSING/source-index construction refuses incomplete graph.
Prior143LOCALPASS; first149run148PASS1FAIL was a test asserting156 JavaScript nodes although graph has154JS+2JSON (production total156 already validated). Failure/source snapshot retained; corrected assertion and explicit delayed-backup source extension precede final150PASS. ActualLOCALWindows/new retained files/rawGit/Node24.13/syntheticSQLite/Docker-kernel-systemd stand-ins ONLY. No host/SSH/Docker/cgroup/Linuxfsync/productionSQL/du/memorysampling/newqualification/package/root/unit/gate/attempt/deployment. New fixture bytes LOCALwithheld/full hash inventory public.
KEEP ACTUALLY IMPLEMENT whole-graph copy/evidence closure and executable fresh source-reviewed host/Apache/scientific capture/held bytes. No nonexistentSourcePASS wait. Then ONE complete actual source review carrying621326ACKONLYthere, exact frozenkit review and fresh uneditedYY workload/193Sample23Hold20oldcross1ZMBnotice/otherlabs0/maygrow/scientific-list/whole-outage acceptance. Wholeoutage50min/2997.171478350916s remains PROPOSAL/historical+20unmeasured allowances/NOT measured production or YYacceptedlimit; readiness600/controller5400 unchanged.621299+621326 govern/both old questions ANSWERED/ALL nativefallbacks CANCELLEDforever/no duplicateACKGHnative. Proposed150000root UNCREATED/unreserved.
BOTH ORIGINAL PRCI CLOSEDFAILED:299 head457fba5cbffe4157e1c2b428800a620f131854d6/run38898578537attempt1 failed12:48:37Z LABEL_PRINT_PREREQUISITE_REQUIRED/missingSample.labSampleCode;300 head827760b8b83c5a4bd0581ee1369648b91818d584/run38898969962attempt1 failed12:54:13Z old-row SELECT-star preservation sees newnullable207columns. Server375/5702 and374/5697/client/bothrealDockerbuilds/realboundaryPASS do NOT make readiness green. Existing agents retain full closed originals and now prepare smallest source-only corrections:208 guarded unchanged approved180DDLowner/no backfill/allocation/renumber;207 exactoldcolumnrows+explicitsole207nullable/default additions/emptyledger/newreceipt. Parent authorized LOCAL correction/tests ONLY; no newpush/replacementCI/retry/ready/audit/merge/newagents/worktrees. ParentONEready/exacthead audit ONLYactualCOMPLETEgreen ordinaryPRCI inclALLrealDocker. Allmainmerges HOLD until actualbeDEPLOYED+actualClpostcheck.
Fresh localGH samebe/mainCI38772398721attempt1CLOSEDSUCCESS/#191CLOSED/no lateractualCl after621326 at publication. SameheartbeatACTIVE2min/restore10ONLYactualdeployment+actualClpostdeployPASS. R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanfilesdraftscards preserved. ALL earlier history remains verbatim below.

'''
print(json.dumps(boundary_publish(D,extras,'feat(release): cover transient consumers and pre-apply copy branch',lead)))
