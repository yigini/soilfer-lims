"""Publish frozen LOCAL controller/hook source milestone; no production action."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'controller104-standalone-stop-post-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='f73efe6750ba2fe23f902d29bcae8eb0cd1f63ca'
assert not git('diff','--cached','--name-only').strip()
run='local-tests-standalone-stop-permit-windows-fixture-successor'
v=json.loads((K/run/'verification.json').read_bytes())
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter']
assert b'Ran 104 tests' in (K/run/'stderr-original.txt').read_bytes()
changed={name:{'testedSha256':digest,'currentSha256':sha((K/name).read_bytes())}
    for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}
assert set(changed)=={'README.md'},'Runtime source changed after final frozen104 run'
assert {p.name for p in K.iterdir() if p.is_file() and p.suffix in ('.py','.md','.json','.yml','.cjs','.js')}==set(v['sourceBefore']), 'Source filename set changed after run'
captures=[]
for endpoint in ['repos/yigini/soilfer-lims/git/ref/heads/main','repos/yigini/soilfer-lims/actions/runs/38772398721',
    'repos/yigini/soilfer-lims/issues/191','repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T10%3A15%3A48Z&per_page=100']:
    captures.append((endpoint,subprocess.check_output(['gh','api',endpoint],cwd=W)))
main,ci,issue,comments=[json.loads(raw) for _,raw in captures]
assert main['object']['sha']==ci['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
assert ci['run_attempt']==1 and ci['status']=='completed' and ci['conclusion']=='success' and issue['state']=='closed'
assert not [c for c in comments if c['id']>6213266959 and (c.get('performed_via_github_app') or {}).get('id')==1236702], 'Read actual new Claudio direction first'
D.mkdir()
for i,(endpoint,raw) in enumerate(captures):save(D,'api-original-'+str(i)+'.json',raw)
save(D,'boundary-record.json',canonical({'publishedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'closedUtc':v['closedUtc'],'localTests':104,'sourceUnchangedDuringFinalRun':True,'postRunREADMEOnly':changed,
    'hostCalls':0,'productionSqlConnections':0,'newQualificationRuns':0,'deployment':False,
    'linuxDirectoryFsyncDockerCgroupAndExecStopPostTested':False,
    'sourceComponentsImplemented':['ProductionOps phase wiring','15 CLI owners','31API+6 exact probes+full post-probe backup equality',
        'serving-final memory identity','same-predecessor recovery reader22READY23NOOP','standalone stdlib-only stop-post',
        'independent503 rehold with mode owner extended-attribute preservation','exact source/kit gate predicates'],
    'sourceGraphStillIncomplete':['actual controller construction/entry point','complete whole-graph/copy-site closure',
        'reviewed current host inventory/Apache bytes/scientific lists/outage allowances',
        'fresh provider authority/freeze/gate/package/launcher/Linux unit integration'],
    'actualLocalGitApplicationSourcesValidated':458,'appValidatorCopiedByteIdenticallyFrom':'187636984895aec44044635fb63498b0fcb3102e',
    'compiledCliOwners':15,'declaredCopyTriples':37,'minimumDbEquivalents':64,'capacityPassClaimed':False,
    'sourceReviewRequested':False,'remoteRootCreated':False,'realKitGateCreated':False,
    'historicalAcceptanceIds':[6212990400,6213266959],
    'earlierFrozenRuns':{'89':'PASS','100':'PASS','first104':'103PASS1WindowsFixturePermissionERROR',
        'final104':'PASS; LOCAL permission projection only; production0400 guard unchanged'},
    'originalFailedRunAndAllSyntheticFixtureBytesRetained':True,'syntheticDbAndKeyBytesPublished':False,
    'readmeOnlyUpdatedAfterFinalTest':True})+b'\n')
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
for name in ['local-tests-exact-source-kit-gate-postflight-emergency-first','local-tests-controller-stop-post-recovery-first',
    'local-tests-standalone-stop-final-membership-source-closure-first','local-tests-standalone-stop-permit-windows-fixture-successor',
    'current-authority-controller100-readonly-once']:
    extras|={p for p in (K/name).rglob('*') if p.is_file()}
extras.add(pathlib.Path(__file__))
when=datetime.datetime.now(datetime.timezone.utc).isoformat()
lead=f'''LATEST CONCRETE KIT CONTROLLER / STANDALONE STOP-POST /104 LOCAL PASS - {when}.
SAME be837974/acc15844 source kit now has104LOCAL tests PASS; all Python/JS/JSON/YAML/README source bytes unchanged during final run, README-only explanation updated afterward. New ProductionOps component connects installer preservation, all declared budget phases, ordinary default startup/readiness, first natural full preservation,31 API+6 byte-identical readonly probes and new post-probe consistent backup/full112-table42-receipt equality, exact historical container preservation and serving-final memory. Fifteen compiled CLI owners; fullcopy-source closure still incomplete/current37/min64 table is NOT capacityPASS.
New standalone stop_post.py bundles exact AST bodies/stdlib only/no local module imports. It attempts ALL15 CLI owners BEFORE source/receipt/controller validation; missing controller modules or evidence root, OOM/memory refusal, failed503 rehold or raw-command retention cannot suppress eligible candidate stop attempts. Valid frozen source/kit plus atomic exact terminal permit/current candidate identity+health/first+second receipts/final memory is required to leave serving candidate. Failure reholds503 when consumed gate observed, stops candidate and durably attempted early predecessor recovery, retains everything/no restart/restore/removal/retry. Controller and hook raw-command namespaces are distinct. No actualLinuxExecStopPost has run.
Early recovery reader preserves SAME959d predecessor original configuration, memory805 and existingMemorySwap1610612736/hostSwapMax805306368, explicitly NOT newcandidateSwap0 proof. NumericPID/cgroup eight raw reads including final membership,OOM0/75percent, source-derived22READY23NOOP/logs only since restart/HTTP200200401/exact600 from dispatch. Only full raw DBWALSHM equality/no other writers BEFORE ANYAPPLY intent permits this one restart/noDBrestore. Candidate600 clock starts immediately before Dockerstart aftercreate; create remains in whole outage. Emergency rehold and exact stops do not require new journal writes; failed partial seal still attempts outbox162. Apache atomic install now preserves mode/owner/complete bounded extended attributes including ACL/SELinux; no actual hostbytes collected.
Local89 and100 frozen tests PASS. First104run103PASS1fixtureERROR because Windows readonly reports0444 versus Linux0400; original snapshot/log retained. Final104PASS adapts ONLY localfixture permission projection/production0400 guard unchanged. ActualLOCALNode24.13/newsyntheticSQLite/statefulDockerHTTPkernel standins only; localGit all458 application source blobs revalidated, copied app copy-validator byteidentical to18763698/derived8default startup policy snapshots. No host/Docker/cgroup/Linuxfsync/realHTTP/productionSQL/newqualification/du/memorysampling/stop/retry/cleanup operation. Synthetic DB/key bytes remain LOCALwithheld/hashinventory public.
Complete executable construction/entrypoint/whole-graph copy-site closure/current reviewed host inventory+Apache bytes+scientificimpact+whole-outage allowances/fresh provider authority/freeze/YYgate/package/launcher/Linux unit integration are STILL MISSING. Source-index predicate explicitly refuses current incomplete graph. Continue ACTUALLY implementing them; do NOT wait for nonexistent SourcePASS. Proposed150000root UNCREATED/unreserved/no remote package/unit/gate/attempt/deployment. No operational review request yet; ACK621326 only next COMPLETE concrete source review.621299+621326 govern/both questions answered/ALL10:04:23+10:28:25nativefallbacks CANCELLEDforever/no duplicate ACK/GH/native. Wholeoutage honest/freshYY-visible193Sample23Hold20oldcross1ZMBnotice/otherlabs0/maygrow; no9to10YYlimit/600readiness unchanged/no performance detour/new transaction killpoint.
Both authorized207208 existingagents/worktrees only. BOTH earlier fullhidden-path runs CLOSEDFAILED/retained/excluded; both corrected source/build/input inventories frozen and fresh complete ordinary visible-fixture full suites ACTIVE.208 visible preflight12suites216PASS/all375 inventory;207 visible preflight7suites164PASS/all374 inventory, latest64suitesPASS0FAIL. No PR or greenCI reported. Git-free fixture is LOCALtest storage only with exact input hashes/readonly existingGit discovery/index copy/linked deps+Prisma runtime/both default+selected complete backupDBs; sole expected stock-generated RELEASE_MANIFEST output explicitly retained. No new authority/worktree/agents. Parent ONE ready/exact-head audit ONLY actualcompletegreen ordinary PRCI. ALL mainmerges held actualbeDEPLOYED+Clpostcheck.
Fresh localGH read confirms samebe/mainCI38772398721attempt1CLOSEDSUCCESS/#191CLOSED/no lateractualCl after621326 at this publication. Sameheartbeat ACTIVE2min; restore10 ONLY actualdeployment+actualClpostdeployPASS. R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanfilesdraftscards preserved. ALL earlier history remains verbatim below.

'''
print(json.dumps(boundary_publish(D,extras,'feat(release): wire controller phases and standalone exact stop-post',lead)))
