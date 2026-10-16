"""Publish the tested source-only adapter milestone. No production operation."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'production-adapters82-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='6a77f97d6f29478f6d29022cea5c69ff75ae210d'
assert not git('diff','--cached','--name-only').strip()
v=json.loads((K/'local-tests-production-adapters-budget-portable-flags-successor/verification.json').read_bytes())
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter']
assert b'Ran 82 tests' in (K/'local-tests-production-adapters-budget-portable-flags-successor/stderr-original.txt').read_bytes()
changed={name:{'testedSha256':digest,'currentSha256':sha((K/name).read_bytes())}
         for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}
assert set(changed)=={'README.md'},'Runtime source changed after frozen local82 run'
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
save(D,'boundary-record.json',canonical({'closedUtc':v['closedUtc'],'localTests':82,'sourceUnchangedDuringRun':True,
    'documentationOnlyChangedAfterRun':changed,'hostCalls':0,'productionCalls':0,'productionSqlConnections':0,
    'newQualificationRuns':0,'sourceOnly':True,'actualDockerOrHttpTested':False,'linuxDirectoryFsyncTested':False,
    'completeCombinedOps':False,'completeCopySiteSweep':False,'completeFrozenAuthorityGateLauncherStopPost':False,
    'sourceReviewRequested':False,'remoteRootCreated':False,'kitGateCreated':False,'deployment':False,
    'compiledCliOwners':14,'currentDeclaredMaxCopyEquivalents':37,'minimumBudgetDbEquivalents':64,
    'historicalAcceptanceIds':[6212990400,6213266959],
    'earlier59TestRun':{'passed':58,'errors':1,'cause':'test patched global os.open, also preventing subprocess DEVNULL launch'},
    'successor60Passed':True,'syntheticInstallation65Passed':True,'runtime72Passed':True,
    'syntaxPretestRefusal':{'testsStarted':False,'provenance':'TOOL_OUTPUT_TRANSCRIPTION_ONLY; no original subprocess stderr log claimed',
        'cause':'multiline with statement missing continuation in new test; partial source-at-test retained'},
    'next77TestRun':{'passed':76,'errors':1,'cause':'Windows os.O_ACCMODE absent; explicit POSIX access-bit parser used in successor'},
    'final82Passed':True})+b'\n')
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
for name in ['local-tests-owned-cli-integrity-stop-first','local-tests-owned-cli-integrity-stop-retention-successor',
             'local-tests-actual-installer-preservation-chain-first','local-tests-normal-candidate-default-readiness-first',
             'local-tests-natural-ingress-writer-boundaries-first','local-tests-natural-ingress-writer-boundaries-syntax-successor',
             'local-tests-production-adapters-budget-portable-flags-successor']:
    extras|={p for p in (K/name).rglob('*') if p.is_file()}
extras.add(pathlib.Path(__file__))
lead='''LATEST CONCRETE KIT PRODUCTION-ADAPTER COMPONENTS /82 LOCAL PASS - 2026-10-16T11:22Z.
SAME be837974/acc15844 source kit now has82LOCAL tests PASS; all source hashes unchanged during final run, README-only explanation updated afterward. New actual command paths implement14 exact CLI owners with fixed scripts/arguments/heap/memory805Swap0/networkNONE/no restart/no removal, durable before-create intent, final memory permission, private logs and exact stop after lost create/start return. DRY runs use NEW retained clones; APPLY/NO_OP repeat use the stopped live volume. Kernel-read-only stopped integrity and first-sync consistent-backup scripts exist, but have NOT run on host/Docker. Independent CLI emergency stops attempt all owners despite other failures/resource violations/evidence-write failure; exact foreign identity refusal/full-object unordered mount equality remain.
New installer adapter wires stopped raw/reader/consistent backup, canonical policy, actual214 chart and209 order-impact/primary+secondary snapshot verification,206->214->209 DRY/APPLY/full installed preservation BEFORE repeat. Actual NEW synthetic106/39->112/42 all-column preservation/tamper/backfill tests pass. Normal predecessor/candidate source derives observed env/network/ports/named volumes, retains predecessor and uses one ordinary default entrypoint. One600s readiness clock includes26READY/27NOOP/HTTP/logs/final memory. Natural first-sync full provenance+five counts is sealed BEFORE ingress reopens; later normal per-config receipt does NOT claim a new full-DB idempotence proof or attribute human scientific writes to Kobo. Actual isolated qualification already proved second-sync idempotence.
New source physical adapter uses fresh nonadditive three-path hardware, all retained release/Docker/containerd du-x, accepted unchanged overlay predicate,500MB unexplained abort/floor4GiBlogs+10GB. Current declared copy table37 maxDB equivalents/25percent/min64/3assets/eight startup snapshot maxima/schema+marker+directory allowance is NOT measured capacity or a closed whole-graph sweep yet. Full combined production Ops, complete copy-site/app-source closure, actual reviewed inventory/ingress bytes/outage allowances, post-probe full preservation, authority/freeze/freshYY gate/package/launcher/full independent stop-post are STILL MISSING. Continue ACTUALLY implementing them; no nonexistent SourcePASS wait. Proposed150000root remains UNCREATED/no remote package/unit/gate/attempt/deployment/hostcall/productionSQL/du/memorysampling/cleanup.
All local failures preserved:59run58PASS1faulty global-os.open test stub;60then65then72PASS; later test SyntaxError before discovery with tool-output provenance only/partial source snapshot, then77run76PASS1Windows missingO_ACCMODE; final82PASS after portable POSIX access-bit parser. Real LOCALNode children/newsyntheticSQLite/localjournal+config files/stateful DockerHTTPkernel stand-ins only; NO Linux/Docker/production result claimed. Synthetic DB/key bytes withheld locally/hashinventory public. No actual private host DB/key/inspect/payload fetched.
621299acceptance and621326timing direction govern/both questions answered/all10:04:23+10:28:25nativefallbacks CANCELLEDforever/no duplicateACKGHnative. ACK621326 only next COMPLETE concrete source review. Whole outage honestly disclosed+freshYY gated/no9to10limit/600readiness unchanged/no performance detour/no new installer transaction killpoints. PreAPPLY only exact retained rawDBWALSHM equality+same predecessor+no writers permits same-old restart ONCE/readiness/reopen/noDBrestore; ANYAPPLYintent/unknownoutcome/entrypoint=>503forwardhold/stopretain/partial162. First193new23Hold20oldcross1ZMBnotice/otherlabs0/maygrow must stay freshYY-visible.
Existing authorized207208 agents only/source-only worktrees; no PR/greenCI yet.208 frozen hidden-path full375suites370PASS5FAIL/5701tests5695PASS6FAIL CLOSED; failures3Express dotpath suites+CRLF fixture+telemetry26->27; originals retained, exactblob restored afterclosure, telemetry focused2suites11PASS, visible final fixture being prepared.207 diagnostic full last238suitesPASS18FAIL, sources frozen, identified fixture/startup-count/CRLF/dotpath conflicts; wait closure before edits. Parent authorized retained Git-free visible Temp test fixtures for both, exact frozen inputs/beforeafter hashes/read-only dependency links; readonly Git discovery uses existing admin dir, GIT_OPTIONAL_LOCKS0 and retained hash-verified READ-ONLY index copy. No new Git branch/worktree/checkout authority. Stock-generated RELEASE_MANIFEST beforeafter explicitly retained as expected output, not falsely all-source-unchanged. Normal PR CI unchanged/once; parent ONE ready/exacthead audit ONLY actualfullgreenCI. ALL merges held actualbeDEPLOYED+Clpostcheck.
Same heartbeat ACTIVE2min; restore10 ONLY actualdeployment+actualClpostdeployPASS. R2COMPLETE/233000KEEPIT/no prune/nohostgrowrestart/no103/humanfilesdraftscards preserved. ALL earlier history remains verbatim below.

'''
print(json.dumps(boundary_publish(D,extras,'feat(release): implement production adapter components and preservation',lead)))
