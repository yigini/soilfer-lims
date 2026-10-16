"""Publish closed LOCAL source work; no host operator, review or deployment."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016';D=K/'prestart188-fixed-envelopes-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='8cc41dee7306398990d91161802a7532f56b5ee8'
assert not git('diff','--cached','--name-only').strip()
failed='local-tests-prestart-cli-pool-controller-originals-first';final='local-tests-prestart-cli-fixed-envelopes-final'
a=json.loads((K/failed/'verification.json').read_bytes());v=json.loads((K/final/'verification.json').read_bytes())
assert a['exitCode']==1 and a['sourceBefore']==a['sourceAfter'] and len(a['sourceBefore'])==99
assert b'Ran 184 tests' in (K/failed/'stderr-original.txt').read_bytes() and b'FAILED (errors=2)' in (K/failed/'stderr-original.txt').read_bytes()
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==100
assert b'Ran 188 tests' in (K/final/'stderr-original.txt').read_bytes() and (K/final/'stderr-original.txt').read_bytes().rstrip().endswith(b'OK')
assert all(sha((K/name).read_bytes())==digest for name,digest in v['sourceBefore'].items())
assert {p.name for p in K.iterdir() if p.is_file() and p.suffix in ('.py','.md','.json','.yml','.cjs','.js')}==set(v['sourceBefore'])
assert not (K/'copy-site-closure.json').exists() and not list(K.glob('release-package-*')) and not list(K.glob('release-launch-*'))
captures=[]
for endpoint in ['repos/yigini/soilfer-lims/git/ref/heads/main','repos/yigini/soilfer-lims/actions/runs/38772398721',
    'repos/yigini/soilfer-lims/issues/191','repos/yigini/soilfer-lims/pulls/299','repos/yigini/soilfer-lims/pulls/300',
    'repos/yigini/soilfer-lims/actions/runs/38898578537','repos/yigini/soilfer-lims/actions/runs/38898969962',
    'repos/yigini/soilfer-lims/actions/runs/38911857904']:
    captures.append((endpoint,subprocess.check_output(['gh','api',endpoint],cwd=W)))
endpoint='repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T10%3A15%3A48Z&per_page=100'
paged=subprocess.check_output(['gh','api','--paginate','--slurp',endpoint],cwd=W);captures.append((endpoint,paged))
pages=json.loads(paged);assert isinstance(pages,list) and len(pages)<=32 and all(isinstance(p,list) and len(p)<=100 for p in pages)
comments=[c for page in pages for c in page];assert len({c['id'] for c in comments})==len(comments)
main,ci,issue,pr299,pr300,old299,old300,new300=[json.loads(raw) for _,raw in captures[:8]]
assert main['object']['sha']==ci['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
assert ci['run_attempt']==1 and ci['status']=='completed' and ci['conclusion']=='success' and issue['state']=='closed'
assert old299['head_sha']=='457fba5cbffe4157e1c2b428800a620f131854d6' and old300['head_sha']=='827760b8b83c5a4bd0581ee1369648b91818d584'
assert all(c['run_attempt']==1 and c['status']=='completed' and c['conclusion']=='failure' for c in (old299,old300))
assert pr300['head']['sha']==new300['head_sha']=='ad9d2660041c4db380d73a759871987d625f7404' and new300['run_attempt']==1
assert pr299['base']['sha']==pr300['base']['sha']==main['object']['sha']
assert not [c for c in comments if c['id']>6213266959 and (c.get('performed_via_github_app') or {}).get('id')==1236702], 'Read new actual Claudio direction first'
P=pathlib.Path('C:/Users/yigin/AppData/Local/Temp/soilfer-issue208-correction-d4GZfH/evidence')
report=json.loads((P/'final-correction-report.json').read_bytes());post=json.loads((P/'post-run-input-check.json').read_bytes())
assert report['server']['suites']==376 and report['server']['tests']==5725 and report['server']['exitCode']==0 and report['server']['exactInventoryMatch'] is True
assert report['tree']=='2e562ca28eff2229b321db490b4f243882e44021' and not post['changed']
for row in json.loads((P/'closed-evidence-sha256.json').read_bytes()):assert sha(pathlib.Path(row['path']).read_bytes())==row['sha256']
D.mkdir()
for i,(endpoint,raw) in enumerate(captures):save(D,'api-original-'+str(i)+'.json',raw)
for name in ['final-correction-report.json','post-run-input-check.json','post-run-index-original-ci-check.json',
    'post-restoration-input-check.json','closed-test-inventory.json','closed-evidence-sha256.json','run-contract.json','correction.patch']:
    save(D,'issue208-'+name,(P/name).read_bytes())
# Hash only new retained LOCAL fixture paths. Prior inventories remain immutable
# references; this publication makes no claim that old fixture bytes were reread.
prior_paths=[K/'shared-evidence161-publication-once/all-local-fixtures-hash-inventory.json',
    K/'emergency-http176-inventory-successor-publication-once/new-local-fixtures-hash-inventory.json']
known=set();prior_refs=[]
for path in prior_paths:
    raw=path.read_bytes();known|={row['path'] for row in json.loads(raw)['fixtures']}
    prior_refs.append({'path':path.relative_to(W).as_posix(),'sha256':sha(raw),'gitBlobOid':oid(raw)})
fixtures=[]
for directory in sorted(K.glob('*-local-retained-fixtures')):
    for path in sorted(directory.rglob('*')):
        if path.is_file() and path.relative_to(K).as_posix() not in known:
            raw=path.read_bytes();s=path.stat();fixtures.append({'path':path.relative_to(K).as_posix(),'bytes':len(raw),
                'sha256':sha(raw),'localModeObserved':s.st_mode&0o777,'localLinksObserved':s.st_nlink})
save(D,'new-local-fixtures-hash-inventory.json',canonical({'fixtures':fixtures,'newFixtureBytesPublic':False,
    'priorInventories':prior_refs,'priorFixtureFilesNotReread':True,'privateHostBytesFetched':0,'productionBytes':0})+b'\n')
notes="""Current source milestone:188 LOCAL tests PASS,100 frozen source files unchanged during the complete run. New kit_cli_evidence.py holds the full3044MiB command/memory/controller/journal envelope against one shared pool BEFORE container creation. An insufficient next allowance refuses before create. Exact child/default heap/original600s clock and the existing256MiB per-owner memory guard are unchanged; eligible exact stops precede releasing the unused allowance on failure. No concurrent/nested window, reused path or closed reservation may resume. Conservative source maxima cover302 memory observations,608 full inspections,612 commands and800 controller observations. This does NOT claim all fifteen future CLI runs fit or capacityPASS.

Docker inspection stdout now uses its existing4MiB semantic limit at the supervised pipe, with the original64MiB stderr maximum. Create/start stdout admits128B and requires the exact returned full ID; command intent/result metadata has an8KiB source bound. Periodic controller records retain all eight original kernel streams as exact private bytes plus a compact hash/reference record. own_snapshot predicates are AST-identical to the prior accepted copy; the full BEFORE shape used by the independent hook remains. No memory predicate or observation frequency changed.

The declared existing4GiB evidence allowance is now fully assigned:3200MiB shared pool,800MiB independent emergency streams,64MiB for exactly two standalone controller records plus one result,32MiB for six static Apache transition sites including complete bounded xattrs. Independent hook metadata names/size are fixed; generic files cannot bypass the common ledger. Apache atomic_config AST is unchanged and no quota was added before emergency rehold/stops. Source allocation allowances are NOT actual filesystem measurement or whole-graph copy/producer closure; copy-site-closure.json is still absent. Fresh reviewed host/Apache/scientific capture and held bytes remain to implement.

First frozen184-test run closed182PASS/2fixtureERROR with source unchanged: a transport stand-in lacked output_limits, and a new padded keyed-file fixture introduced a malformed blank line. Both originals are retained. Those fixtures were corrected; independent hook/Apache partition guards were then added, preceding final188PASS. Only this README was added after the final run. Real LOCAL Windows children/Node24.13/syntheticSQLite/Docker-kernel-systemd stand-ins only; no host/SSH/Linuxfsync/production SQL/new qualification/package/root/unit/gate/deployment.

Existing208 corrected full LOCAL validation closed376suites5725tests PASS; parent read all twelve changed paths and independently verified the exact full inventory,14 closed-evidence hashes and4932 source/fixture hash reads using each explicit sourcePath mapping. The default fixture DB was mapped to the canonical owned backup, not the separate worktree dev.db; no paired source-dev.db claim is made. Tested working/staged files match raw or solely CRLF-to-LF. Parent authorizes ONE reviewed correction commit/push to existingPR299 plus ordinary new-head CI. Existing207 new headad9d26600/run38911857904 attempt1 is observed only; original207/208 failed CIs remain immutable. No ready/audit/merge yet; all main merges hold for actual release deployment plus actual Claudio postcheck. Earlier history follows unchanged.

"""
old=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+old);assert (K/'README.md').read_bytes()[len(notes.encode()):]==old
changed={name:{'testedSha256':digest,'currentSha256':sha((K/name).read_bytes())} for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}
assert set(changed)=={'README.md'}
save(D,'boundary-record.json',canonical({'publishedUtc':utc(),'localTests':188,'closedUtc':v['closedUtc'],'frozenSourceFiles':100,
    'sourceUnchangedDuringFinalRun':True,'firstRun':{'tests':184,'pass':182,'fixtureErrors':2,'sourceUnchanged':True},
    'postRunREADMEOnly':changed,'perCliPreCreateEnvelopeBytes':3044*1024**2,'sharedPoolBytes':3200*1024**2,
    'cliSourceMaxima':{'memoryObservations':302,'fullInspections':608,'commands':612,'controllerObservations':800},
    'independentEmergencyBytes':800*1024**2,'independentHookRecordsBytes':64*1024**2,'apacheDeclaredAllowanceBytes':32*1024**2,
    'totalDeclaredEvidenceAllowanceBytes':4*1024**3,'unassignedBytes':0,'filesystemClosureClaimed':False,'allFutureCliFitClaimed':False,
    'capacityPassClaimed':False,'copySiteClosureCreated':False,'sourceReviewRequested':False,
    'hostCalls':0,'productionSqlConnections':0,'newQualificationRuns':0,'remoteRootCreated':False,'realPackageCreated':False,
    'realKitGateCreated':False,'deployment':False,'mainMergeHold':True,'parentReadyOrAuditRequested':False,
    'parallel208ParentConcreteReviewComplete':True,'parallel208ClosedFull':report['server'],
    'parallel208IndependentRehashReads':4932,'parallel208MappedInputRowHonoured':True,'parallel208OneReviewedPushAuthorized':True,
    'parallelCurrentHeads':{'299':pr299['head']['sha'],'300':pr300['head']['sha']},
    'parallel207ObservedCi':{k:new300[k] for k in ('id','head_sha','status','conclusion','run_attempt')},
    'stillMissing':['whole-graph copy/evidence/filesystem closure',
        'source-reviewed executable fresh host/Apache/scientific capture and held bytes',
        'actual complete source review/exact-kit review/fresh human gate']})+b'\n')
extras={p for p in K.iterdir() if p.is_file()}
for run in (failed,final):extras|={p for p in (K/run).rglob('*') if p.is_file()}
extras.add(W/'WP/backlog-resume-20261013'/pathlib.Path(__file__).name)
when=utc()
lead=f"""LATEST CONCRETE PRE-START CLI ENVELOPES / FIXED HOOK-APACHE ALLOWANCES /188 LOCAL PASS - {when}.
SAME be837974/acc15844 source kit has188LOCALtestsPASS/100sourcefiles unchanged throughout final frozen run/README-only afterward. Full3044MiB command-memory-controller-journal window is held BEFORECLIcreate against shared3200MiB; next insufficient envelope refuses BEFOREcreate. Conservative302memory/608fullinspect/612command/800controller maxima, existing256MiB per-owner guard/defaultheap/child/original600clock unchanged. Fullpool is single-spend; unused allowance releases after synchronous pipe closure and exact-stop attempts on failure, never permits a closed reservation/path to resume. This does NOT prove all15futureCLIs fit or production capacity.
Controller periodic evidence now keeps every original kernel byte once plus full validated-snapshot hash/references; own_snapshot predicates AST-identical/full BEFORE shape retained. Docker pipe stdout uses existing4MiB semantic limit/stderr64MiB; exactcreate/startID128B and bounded8KiB command metadata. Existing4GiB DECLARED allowances now all assigned: shared3200MiB+independent emergency800MiB+three fixed hook records64MiB+six static Apache transitions/xattrs32MiB. Hook names/16MiB limits are exact; unknown names cannot bypass ledger. Apache atomic_config AST unchanged/no new quota before emergency actions. This is NOT actual filesystem/global copy closure; copy-site-closure.json STILLABSENT/source-index refuses incomplete graph/normal37-min64 NOTcapacityPASS.
Initial184run182PASS2fixtureERROR/sourceunchanged retained; fixture output_limits signature and malformed padded keyed line corrected, then fixed-envelope guards added before final188PASS. All458app/162oldsource bindings validate locally. Windows/Node24.13/newsyntheticSQLite/realLOCALchildren and Docker-kernel-systemd stand-ins ONLY. New fixture-byte hashes form an explicit delta referencing prior immutable inventories/old fixtures NOT reread. No host/SSH/Linuxfsync/productionSQL/Docker/cgroup/du/memorysampling/newqualification/package/root/unit/gate/attempt/deployment.
KEEP ACTUALLY IMPLEMENT whole-graph copy/evidence/filesystem closure and executable fresh source-reviewed host/Apache/scientific capture/held bytes. No actual SourcePASS/review request exists to wait for. Proposed150000root UNCREATED/unreserved. Then ONE COMPLETE source review carrying621326ACKONLYthere/exact frozenkit review/fresh actual uneditedYY workload+193Sample23Hold20oldcross1ZMBnotice/otherlabs0/maygrow/scientific-list/whole-outage acceptance. Wholeoutage50min/2997.171478350916s remains historical+20UNMEASUREDproposal/NOTmeasuredproduction/YYacceptedlimit;600readiness5400controller unchanged.621299+621326 govern/both questionsANSWERED/ALL nativefallbacksCANCELLEDforever/no duplicateACKGHnative.
207 reviewed2-file correction pushedad9d2660041c4db380d73a759871987d625f7404/tree0470e4a5549e4048ae35f39f8b8a2e22d9cd5bfa; SAME ordinaryCI38911857904attempt1 observed{new300['status']}/{new300['conclusion']}. Observe ONLYsameNEWheadrun/no retry/redispatch. Original38898969962attempt1/exact827760b8 CLOSEDFAILEDimmutable. Corrected374suites5710LOCALPASS retained.208 corrected fullLOCAL CLOSED376suites5725testsPASS/2445mappedsource-build-template+21runtime unchanged, sole expected stock help output retained/restored AFTERclosure. Parent READ complete12-file patch and independently checked14closedfilehashes/exact376inventory/4932source+fixture hash reads using declared sourcePath DB substitution. Earlier optional parent verifier used wrong server-prefix/domain assumptions; corrected READONLY, no source mutation. All12working/staged contents match raw or ONLYCRLFtoLF, distinction retained. Parent NOWauthorizes ONE reviewed12-file correctioncommit/push to EXISTINGPR299+ordinarynewheadCI; actualPR299 head at capture{pr299['head']['sha']}, no push outcome inferred. Original38898578537attempt1/exact457f CLOSEDFAILEDimmutable. No ready/audit/merge until actualCOMPLETEgreen ordinarynewheadCI includingALLrealDocker and parentONErequest. ALLmainmerges HOLD actualbeDEPLOYED+actualClpostcheckPASS.
Fresh localGH samebe/mainCI38772398721attempt1CLOSEDSUCCESS/#191CLOSED/no lateractualCl after621326 at publication. SameheartbeatACTIVE2min/restore10ONLYactualdeployment+actualClpostdeployPASS. R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanfilesdraftscards preserved. ALL earlier history remains verbatim below.

"""
print(json.dumps(boundary_publish(D,extras,'feat(release): reserve complete pre-start CLI evidence envelopes',lead)))
