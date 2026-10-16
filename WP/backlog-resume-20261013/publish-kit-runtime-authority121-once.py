"""Publish closed LOCAL runtime/authority source milestone; zero host action."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'runtime-authority121-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='2c6cdc4d2508c6e89e270d2cf1fc8c3c6e5f68d9'
assert not git('diff','--cached','--name-only').strip()
run='local-tests-runtime-authority-whole-outage-final'
v=json.loads((K/run/'verification.json').read_bytes())
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter']
assert b'Ran 121 tests' in (K/run/'stderr-original.txt').read_bytes()
changed={name:{'testedSha256':digest,'currentSha256':sha((K/name).read_bytes())}
    for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}
assert set(changed)=={'README.md'},'Runtime source changed after final frozen121 run'
assert {p.name for p in K.iterdir() if p.is_file() and p.suffix in ('.py','.md','.json','.yml','.cjs','.js')}==set(v['sourceBefore'])
captures=[]
for endpoint in ['repos/yigini/soilfer-lims/git/ref/heads/main','repos/yigini/soilfer-lims/actions/runs/38772398721',
    'repos/yigini/soilfer-lims/issues/191','repos/yigini/soilfer-lims/pulls/299','repos/yigini/soilfer-lims/pulls/300',
    'repos/yigini/soilfer-lims/actions/runs/38898578537','repos/yigini/soilfer-lims/actions/runs/38898969962']:
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
save(D,'boundary-record.json',canonical({'publishedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'closedUtc':v['closedUtc'],'localTests':121,'sourceUnchangedDuringFinalRun':True,'postRunREADMEOnly':changed,
    'hostCalls':0,'productionSqlConnections':0,'newQualificationRuns':0,'deployment':False,
    'linuxDirectoryFsyncDockerCgroupAndExecStopPostTested':False,
    'implemented':['fresh bounded TLS provider and full pagination','exact standing authorities and full four app verdict bodies',
        'new source/kit/human validation and immediate gate refresh','full scientific projection excluding only retention metadata and clock',
        'concrete Linux runtime component construction','run_release.py entry point','proposed complete whole-outage disclosure'],
    'stillMissing':['whole-graph copy/evidence closure','fresh reviewed host metadata and scientific capture',
        'freeze/package/preparer/launcher/Linux unit integration','complete actual exact source and kit reviews','fresh actual YY gate'],
    'sourceReviewRequested':False,'remoteRootCreated':False,'realKitGateCreated':False,
    'capacityPassClaimed':False,'declaredCopyTriples':37,'minimumDbEquivalents':64,
    'wholeOutageProposalSeconds':2997.171478350916,'wholeOutageProposalMinutes':50,'proposalIsProductionMeasurement':False,
    'readinessSecondsUnchanged':600,'controllerSecondsUnchanged':5400,'postApplyFailureReopenPromise':False,
    'originalFailuresRetained':['115:114PASS1appVerdictPinFAIL','119:118PASS1WindowsDirectoryFsyncFixtureERROR',
        '119:118PASS1WindowsPosixPathFixtureERROR'],'final121':'PASS',
    'productionGuardsRelaxed':False,'syntheticDbOrKeyBytesPublished':False,'parallelPrs':status,
    'parentReadyOrAuditRequested':False,'mainMergeHold':True})+b'\n')
fixtures=[];public=set()
for directory in sorted(K.glob('*-local-retained-fixtures')):
    for path in sorted(directory.rglob('*')):
        if not path.is_file():continue
        raw=path.read_bytes();s=path.stat();name=path.name.lower()
        withheld=('.db' in name or path.suffix in ('.sqlite','.sqlite3') or name.endswith(('-wal','-shm','-journal')) or
            raw.startswith(b'SQLite format 3\0') or 'key' in name or directory.name=='reader-local-retained-fixtures')
        fixtures.append({'path':path.relative_to(K).as_posix(),'bytes':len(raw),'sha256':sha(raw),
            'localModeObserved':s.st_mode&0o777,'localLinksObserved':s.st_nlink,'publishedBytes':not withheld})
        if not withheld:public.add(path)
save(D,'all-local-synthetic-fixtures-hash-inventory.json',canonical({'fixtures':fixtures,
    'withheldDbAndSyntheticKeyBytesRetainedLocally':True,'productionBytes':0,'privateHostBytesFetched':0})+b'\n')
extras={p for p in K.iterdir() if p.is_file()}|public
for name in ['local-tests-fresh-provider-full-science-first','local-tests-full-app-verdict-pin-successor',
    'local-tests-concrete-runtime-construction-first','local-tests-concrete-runtime-windows-fixture-successor',
    'local-tests-concrete-runtime-posix-root-fixture-successor','local-tests-runtime-authority-whole-outage-final']:
    extras|={p for p in (K/name).rglob('*') if p.is_file()}
extras.add(pathlib.Path(__file__))
when=datetime.datetime.now(datetime.timezone.utc).isoformat()
lead=f"""LATEST CONCRETE KIT RUNTIME / FRESH AUTHORITY / FULL SCIENTIFIC PROJECTION /121 LOCAL PASS - {when}.
SAME be837974/acc15844 source kit now has121LOCAL tests PASS, all runtime/Python/JS/JSON/YAML/README bytes unchanged during final run, README-only explanation updated afterward. Concrete kit_construction.py and run_release.py now assemble real ProductionOps, fresh measured budgets, controller-before+periodic numeric memory guards,15 supervised CLI owners, predecessor/candidate, normal+independent503 ingress, natural first full intake/probes/post-probe full equality/second normal receipt and exact preAPPLY recovery. Construction has only been exercised with NEW local files and Docker/Linux stand-ins; no actual unit/runtime/host operation.
New bounded TLS primary GitHub provider retains originals before predicates, permits only explicit endpoints, requires complete pagination and refuses full final pages, duplicates, foreign issue rows, network/deadline failure and changed main during collection. All standing accepted predicates are AST-identical copies with no historical operational approval exports. NEW exact wrappers additionally pin full semantic bodies of all four application verdicts: first115 run exposed the inherited first-line/head-only gap (114PASS1FAIL), now fixed without changing accepted copied predicates. Actual621299+621326/new exactSourcePASS/exactKitPASS/currentmainCI/four merges/#191closed/allstandingauthorities and a fresh actual unedited human workload/intake/outage/scientific-list acknowledgement are independently required. Unknown later actualCl direction refuses even without repeated head/root. Immediate provider/human/consumer/Apache refresh precedes exclusive gate; lost/failed preflight or gate cannot retry. No actual fresh source/kit/human approvals exist.
New scientific projection retains EVERY214context/policysetting/affectedrun/sequence-refusal/count and EVERY209cause/refusal/sample/ownerID list. Only collection clocks and enumerated retained-copy metadata are excluded; original hash/path/physical allocation checks remain independent. Fresh capture must follow THIS actualSourcePASS and precede exactKitPASS; old actual lists cannot be relabelled fresh. No fresh production scientific capture/SQL/copy occurred.
whole-outage-disclosure.json now exists as a PROPOSAL for exact review: expected about50minutes/2997.171478350916seconds from nine historicalcde8/B5 CLI timings plus acceptedacc158already-installed readiness and20explicit UNMEASURED allowances. NOT a measured production sequence, approved outage, YY limit or new killpoint. Existing600candidate readiness/90mincontroller unchanged; postAPPLYfailure can remain503 beyond controller until separately reviewed forwardfix. No performance detour/installer transaction killpoint. The full disclosure must be actually reviewed and freshYY accepted before any release gate.
Final121LOCALPASS includes real class construction with only local fake kernel/Docker boundaries. Earlier119runs each118PASS1LOCALWindowsfixtureERROR (directoryfsync, then Windows-vs-POSIX root string) retained; only LOCAL fixture projections adapted, production POSIX directoryfsync/root/0400 guards unchanged. ActualLOCALNode24.13/syntheticSQLite only; no host/Docker/cgroup/Linuxfsync/realHTTP/productionSQL/newqualification/du/memorysampling/stop/retry/cleanup. Synthetic DB/key bytes LOCALwithheld/hashinventory public.
STILL ACTUALLY IMPLEMENT complete whole-graph copy/evidence closure (current37/min64 table NOT capacityPASS), fresh reviewed host consumer/Apache/scientific capture and held bytes, complete freeze/package/preparer/launcher/Linux unit integration, then ONE complete concrete source review/frozen exactkit review/freshYY gate. Do NOT wait for nonexistent SourcePASS. Proposed150000root remains UNCREATED/unreserved/no remote package/unit/gate/attempt/deployment.621299+621326 govern;621326 ACK ONLYnextCOMPLETEconcretesourcereview. Both old questions ANSWERED/ALL10:04:23+10:28:25nativefallbacks CANCELLEDforever/no duplicate ACK/GH/native.193Sample23Hold20oldcross1ZMBnotice/otherlabs0/maygrow must remain freshYY visible. PreAPPLY same959d exactrawDBWALSHM/nootherwriters recovery ONCE/noDBrestore preserves OLDexistingMemorySwap1610612736/hostSwap805306368, never claim candidateSwap0.
Both existing207208 agents now have full ordinary LOCALPASS and source-only PRs, attached to parent.208PR299/head457fba5cbffe4157e1c2b428800a620f131854d6/tree26a56ccb234c49d85d1d3c96374904aa239ccbe5/44paths/full375suites5702testsPASS/buildlintPASS14existingwarnings; originalCI38898578537 attempt1 {ci299['status']}/{ci299['conclusion']}.207PR300/head827760b8b83c5a4bd0581ee1369648b91818d584/basebe/full374suites5697testsPASS/buildlintPASS14existingwarnings; originalCI38898969962 attempt1 {ci300['status']}/{ci300['conclusion']}. Both frozen visible fixture/source/runtime/index hashes verified; only expected generated help manifest output retained/restored AFTERfullclosure. Earlier hidden-path failed runs remain retained/excluded. No retry/newagents/worktrees/ready/audit/merge. Parent ONEready/exact-head audit ONLYactualCOMPLETEgreen ordinary PRCI inclALLrealDocker steps. ALLmainmerges held actualbeDEPLOYED+actualClpostcheck.
Fresh localGH confirms samebe/mainCI38772398721attempt1CLOSEDSUCCESS/#191CLOSED/no lateractualCl after621326 at this publication. Sameheartbeat ACTIVE2min; restore10ONLYactualdeployment+actualClpostdeployPASS. R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanfilesdraftscards preserved. ALL earlier history remains verbatim below.

"""
print(json.dumps(boundary_publish(D,extras,'feat(release): construct runtime and authenticate fresh release authority',lead)))
