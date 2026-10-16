"""Publish closed LOCAL package/launcher source; no operational host access."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'staged-package135-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='03299a10b730e62fcae3eb6f1bad489c261a5392'
assert not git('diff','--cached','--name-only').strip()
run='local-tests-package-directory-allocation-final'
v=json.loads((K/run/'verification.json').read_bytes())
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter']
assert b'Ran 135 tests' in (K/run/'stderr-original.txt').read_bytes()
changed={name:{'testedSha256':digest,'currentSha256':sha((K/name).read_bytes())}
    for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}
assert set(changed)=={'README.md'},'Source changed after final frozen135 run'
assert {p.name for p in K.iterdir() if p.is_file() and p.suffix in ('.py','.md','.json','.yml','.cjs','.js')}==set(v['sourceBefore'])
assert not (K/'copy-site-closure.json').exists(),'Incomplete whole graph must not be mislabelled complete'
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
comments=[c for page in pages for c in page]
assert len({c['id'] for c in comments})==len(comments)
main,ci,issue,pr299,pr300,ci299,ci300=[json.loads(raw) for _,raw in captures[:7]]
assert main['object']['sha']==ci['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
assert ci['run_attempt']==1 and ci['status']=='completed' and ci['conclusion']=='success' and issue['state']=='closed'
assert pr299['head']['sha']==ci299['head_sha']=='457fba5cbffe4157e1c2b428800a620f131854d6'
assert pr300['head']['sha']==ci300['head_sha']=='827760b8b83c5a4bd0581ee1369648b91818d584'
assert ci299['run_attempt']==ci300['run_attempt']==1 and pr299['state']==pr300['state']=='open'
assert not [c for c in comments if c['id']>6213266959 and (c.get('performed_via_github_app') or {}).get('id')==1236702], 'Read actual new Claudio direction first'
D.mkdir()
for i,(endpoint,raw) in enumerate(captures):save(D,'api-original-'+str(i)+'.json',raw)
status={'299':{'head':pr299['head']['sha'],'ci':ci299['id'],'status':ci299['status'],'conclusion':ci299['conclusion']},
        '300':{'head':pr300['head']['sha'],'ci':ci300['id'],'status':ci300['status'],'conclusion':ci300['conclusion']}}
jobs={'299':json.loads(captures[7][1]),'300':json.loads(captures[8][1])}
save(D,'boundary-record.json',canonical({'publishedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'closedUtc':v['closedUtc'],'localTests':135,'sourceUnchangedDuringFinalRun':True,'postRunREADMEOnly':changed,
    'hostCalls':0,'productionSqlConnections':0,'newQualificationRuns':0,'deployment':False,
    'linuxDirectoryFsyncDockerCgroupSshAndSystemdTested':False,
    'implemented':['immutable staged payload/manifest/review/human package verification','bounded raw Git batch preparer',
        'fresh existing-auth gh primary source/standing pre-package checks','fixed one-use package/launch evidence paths',
        'full exact Linux remote-program AST render and compile before any SSH','exact runtime budget/stat-reader AST capacity programs',
        'future package charged before ROOT and zero future package after upload','full upload file/directory/alias/link/byte verification',
        'new Linux unit with nonignored independent stop-post hook','full frozen-file authority preflight and exclusive gate local integration'],
    'stillMissing':['whole-graph retained-copy and evidence closure including early recovery',
        'executable fresh source-reviewed host consumer/Apache/scientific capture and held bytes',
        'loaded/transient consumer inventory and collection-race closure',
        'complete actual source and exact frozen-kit reviews','fresh actual human gate'],
    'sourceReviewRequested':False,'remoteRootCreated':False,'realPackageCreated':False,'realKitGateCreated':False,
    'capacityPassClaimed':False,'normalDeclaredCopies':37,'minimumDbEquivalents':64,
    'payloadMaxFiles':1024,'payloadMaxBytes':134217728,'perFileMaxBytes':16777216,
    'wholeOutageProposalSeconds':2997.171478350916,'wholeOutageProposalMinutes':50,'proposalIsProductionMeasurement':False,
    'readinessSecondsUnchanged':600,'controllerSecondsUnchanged':5400,'postApplyFailureReopenPromise':False,
    'runs':['131PASS first staged package','131PASS full authority integration','134PASS authenticated local transport and rendered unit standin',
        '135PASS directory-entry allocation and immutable inode fsync'],
    'newFailedRuns':[],'productionGuardsRelaxed':False,'allNewPackageFixtureBytesPublic':False,
    'parallelPrs':status,'parallelOriginalJobs':jobs,'parentReadyOrAuditRequested':False,'mainMergeHold':True})+b'\n')
fixtures=[]
for directory in sorted(K.glob('*-local-retained-fixtures')):
    for path in sorted(directory.rglob('*')):
        if not path.is_file():continue
        raw=path.read_bytes();s=path.stat()
        fixtures.append({'path':path.relative_to(K).as_posix(),'bytes':len(raw),'sha256':sha(raw),
            'localModeObserved':s.st_mode&0o777,'localLinksObserved':s.st_nlink,
            'newFixtureBytesPublishedByThisPublication':False})
save(D,'all-local-fixtures-hash-inventory.json',canonical({'fixtures':fixtures,
    'allNewPackageAndOtherFixtureBytesRetainedLocally':True,'syntheticFutureReviewsAreNotActualApprovals':True,
    'productionBytes':0,'privateHostBytesFetched':0})+b'\n')
extras={p for p in K.iterdir() if p.is_file()}
for name in ['local-tests-staged-package-launch-first','local-tests-staged-package-authority-integration',
    'local-tests-package-primary-auth-unit-standin','local-tests-package-directory-allocation-final']:
    extras|={p for p in (K/name).rglob('*') if p.is_file()}
extras.add(pathlib.Path(__file__))
when=datetime.datetime.now(datetime.timezone.utc).isoformat()
lead=f"""LATEST CONCRETE STAGED FREEZER / RAW-GIT PREPARER / LINUX UNIT LAUNCHER /135 LOCAL PASS - {when}.
SAME be837974/acc15844 source kit now has135LOCAL tests PASS with all source bytes unchanged during final run; README-only explanation updated afterward. New kit_package.py/prepare_release.py/kit_launch_programs.py/launch_release.py implement immutable payload-to-manifest freezing, later append-only exact-kit/human originals, complete raw Git batch checks, fixed one-use package/launch paths, exact capacity/render/upload verification and the new Linux unit dispatch path. NONE of these operators has prepared a real release package or made any SSH/host call; proposed150000root remains UNCREATED/unreserved/no unit/gate/attempt/deployment.
Manifest binds full tooling plus ALL458 actual pinned app sources, qualified receipt/image/index, full fresh scientific originals/projection/capture receipt, consumer inventory/reviewed classes, Apache original/held bytes and honest whole-outage disclosure. Later exact-kit and human records bind manifest without a self-hash cycle; no missing/extra/changed bytes, aliases, hardlinks or empty/extra directories. Complete bounded map1024payloadfiles/128MiBtotal/16MiBfile with directory allocation for EVERY entry plus base/index blocks; each independent file has both bytes+immutable inode mode fsynced/no replacement/deletion. Lost append/failed unknown launch cannot resume/retry through a different evidence path. Local primary authority uses already-connected GH CLI auth without reading/exporting credentials; actual host runtime keeps bounded TLS curl. Every actual remote program rendered by one AST literal substitution and compiled BEFORE firstSSH; exact runtime Budget/metadata-reader AST bodies copied, full package charged BEFORE_ROOT then zero future package after upload. New unit805306368/Swap0/Runtime5400/Restartno/TimeoutStop300/nonignored standaloneExecStopPost; no actualLinuxunitresult claimed.
All135LOCALPASS includes complete frozen-file Authority preflight+exclusive consume using NEWlocalfiles/real retained standing authority/build/458app originals and SYNTHETIC future source/kit/human records. Apache drift after successful preflight consumes attempt WITHOUT gate. Actual rendered Linux upload/unit program ran only against NEWLOCALfiles with systemd/kernel/platform/directoryfsync stand-ins, including extra-directory refusal before dispatch. Prior131 then131 then134 local runs also PASS/sourceunchanged; no new failed run. ActualLOCALNode24.13/syntheticSQLite only/no host/Docker/cgroup/Linuxfsync/realSSH/systemd/HTTP/productionSQL/newqualification/du/memorysampling/stop/retry/cleanup. New package/synthetic-review/DB/key fixture bytes stay LOCAL; full hash inventory public.
STILL ACTUALLY IMPLEMENT whole-graph retained-copy/evidence closure including early recovery (normal37/min64 NOTcapacityPASS), executable fresh source-reviewed host consumer/Apache/scientific capture/held bytes, loaded/transient consumer coverage and collection-race closure. copy-site-closure.json intentionally STILL MISSING, so actual complete source-index construction refuses current graph. Do NOT wait for nonexistentSourcePASS. Then ONE complete concrete source review (ACK621326ONLYthere), actual fresh capture, frozen exact-kit review and fresh actual unedited YY workload/intake/scientific-list/whole-outage acceptance before any gate.621299+621326 govern/both old questions ANSWERED/ALL nativefallbacks CANCELLEDforever/no duplicateACK/GH/native.
Whole-outage50minutes/2997.171478350916seconds remains a PROPOSAL from historical timings+20UNMEASUREDallowances, NOT measured production or acceptedYYlimit; readiness600/controller5400 unchanged/no performance detour/new transaction killpoints.193Sample23Hold20oldcross1ZMBnotice/otherlabs0/maygrow stay freshYYvisible. PreAPPLY only exactrawDBWALSHM+same959d+noOtherwriters permits same-old recoveryONCE/noDBrestore preserving OLDMemorySwap1610612736/hostSwap805306368; anyAPPLYintent/unknown/entrypoint=>forward503/stopretain/partial162/separatelyreviewedforwardfix.
Both existing207208 agents/source PRs remain only authorized parallel work. PR299 exact457fba5cbffe4157e1c2b428800a620f131854d6 originalCI38898578537 attempt1 {ci299['status']}/{ci299['conclusion']}; PR300 exact827760b8b83c5a4bd0581ee1369648b91818d584 originalCI38898969962 attempt1 {ci300['status']}/{ci300['conclusion']}. FullLOCAL375/5702 and374/5697/buildlintPASS14baselinewarnings retained. Exact step snapshots retained; parent ONEready/exact-head audit ONLYactualCOMPLETEgreen ordinaryPRCI including ALLrealDocker steps. No retry/newagents/worktrees/ready/audit/merge. All main merges held until actualbeDEPLOYED+actualClpostcheck.
Fresh localGH samebe/mainCI38772398721attempt1CLOSEDSUCCESS/#191CLOSED/no lateractualCl after621326 at publication. SAMEheartbeatACTIVE2min; restore10ONLYactualdeployment+actualClpostdeployPASS. R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanfilesdraftscards preserved. ALL earlier history remains verbatim below.

"""
print(json.dumps(boundary_publish(D,extras,'feat(release): freeze staged payload and wire guarded Linux launch',lead)))
