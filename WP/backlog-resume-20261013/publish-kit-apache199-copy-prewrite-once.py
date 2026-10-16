"""Publish closed LOCAL Apache/copy work; no host operator or review request."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016';D=K/'apache199-copy-prewrite-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='5ae36101dd504c36406d5c68ad3d8d6e0035a486'
assert not git('diff','--cached','--name-only').strip()
run=K/'local-tests-apache-capture-copy-prewrite199-final'
v=json.loads((run/'verification.json').read_bytes());log=(run/'stderr-original.txt').read_bytes()
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==103
assert b'Ran 199 tests' in log and log.rstrip().endswith(b'OK')
assert all(sha((K/name).read_bytes())==digest for name,digest in v['sourceBefore'].items())
assert {p.name for p in K.iterdir() if p.is_file() and p.suffix in ('.py','.md','.json','.yml','.cjs','.js')}==set(v['sourceBefore'])
assert not (K/'copy-site-closure.json').exists() and not list(K.glob('release-package-*')) and not list(K.glob('release-launch-*'))
endpoints=['repos/yigini/soilfer-lims/git/ref/heads/main','repos/yigini/soilfer-lims/actions/runs/38772398721',
    'repos/yigini/soilfer-lims/issues/191','repos/yigini/soilfer-lims/pulls/300','repos/yigini/soilfer-lims/pulls/299',
    'repos/yigini/soilfer-lims/actions/runs/38911857904','repos/yigini/soilfer-lims/actions/runs/38911857904/jobs',
    'repos/yigini/soilfer-lims/actions/runs/38915551182']
captures=[(endpoint,subprocess.check_output(['gh','api',endpoint],cwd=W)) for endpoint in endpoints]
main,ci,issue,pr207,pr208,new207,jobs207,new208=[json.loads(raw) for _,raw in captures]
assert main['object']['sha']==ci['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
assert ci['run_attempt']==1 and ci['status']=='completed' and ci['conclusion']=='success' and issue['state']=='closed'
assert pr207['head']['sha']==new207['head_sha']=='ad9d2660041c4db380d73a759871987d625f7404'
assert new207['run_attempt']==1 and new207['status']=='completed' and new207['conclusion']=='success'
steps={step['name']:step for job in jobs207['jobs'] for step in job['steps']}
for name in ['Run server test suite','Build Docker image','Build Supported Baseline Docker Image (v3.5.30 / 48d0e52)',
             'Run Real Disposable Docker Boundary Rehearsal','Run Real Docker Deployment Readiness Acceptance']:
    assert steps[name]['status']=='completed' and steps[name]['conclusion']=='success'
assert pr208['head']['sha']==new208['head_sha']=='72adbe43b36319e6f9d8088baa61b0fbe26bb3ff' and new208['run_attempt']==1
assert pr207['base']['sha']==pr208['base']['sha']==main['object']['sha']
endpoint='repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T10%3A15%3A48Z&per_page=100'
paged=subprocess.check_output(['gh','api','--paginate','--slurp',endpoint],cwd=W);captures.append((endpoint,paged))
pages=json.loads(paged);assert len(pages)<=32 and all(isinstance(p,list) and len(p)<=100 for p in pages)
comments=[c for page in pages for c in page];assert len({c['id'] for c in comments})==len(comments)
assert not [c for c in comments if c['id']>6213266959 and (c.get('performed_via_github_app') or {}).get('id')==1236702], 'Read new actual Claudio direction first'
D.mkdir()
for i,(endpoint,raw) in enumerate(captures):save(D,'api-original-'+str(i)+'.json',raw)
prior_paths=[K/'shared-evidence161-publication-once/all-local-fixtures-hash-inventory.json',
    K/'emergency-http176-inventory-successor-publication-once/new-local-fixtures-hash-inventory.json',
    K/'prestart188-fixed-envelopes-publication-once/new-local-fixtures-hash-inventory.json']
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
notes="""Current source milestone:199 LOCAL tests PASS;103 frozen source files unchanged during the complete run. New kit_apache_capture.py implements a fresh read-only bounded original plus owner/mode/identity/allocation and complete xattr capture, deterministic held bytes, and a durable consumed intent before its first source read. Only the entire explicit two-vhost lims profile is supported. Unknown directives, changed TLS/proxy/address, nested blocks, includes, error documents, existing rewrites, aliases/hardlinks, mixed endings and observed content/attribute races refuse. All original bytes remain verbatim; only the two HTTPS503 rewrite lines are inserted. This rendering is NOT an Apache syntax/serving test. Apache's documented R=503 behavior stops rewriting and discards the substitution: https://httpd.apache.org/docs/2.4/rewrite/flags.html#flag_r . No Apache process, host file, certificate or private key was read here.

The component requires a NEW exact source verdict before source reads and keeps outputs in the distinct proposed170000 capture root, never the150000 release root. Both roots remain UNCREATED. The complete capture launcher must still reserve its separate8MiB Apache files/entry envelope before capture-root creation; this source bound is NOT physical admission or global filesystem closure. Fresh host/consumer/scientific capture orchestration remains missing. Package construction now requires apache-capture.json, matching fresh source/time/full stable metadata/opaque xattrs/exact deterministic original-held bytes; the full capture receipt separately binds its raw SHA. Twelve tamper cases refresh generic hashes and still refuse on the semantic capture predicates. Synthetic future package fixtures are explicitly LOCAL stand-ins, not actual host captures.

retained_files.copy_file now validates the expected hash/length and runs its reserve check BEFORE destination creation; a growing source refuses BEFORE the next chunk write instead of writing then refusing. New real LOCAL tests cover first/later overflow chunks, exact empty/binary copies, source preservation, reused paths and precheck-before-create. Existing SQLite backup/app-TMPDIR/daemon-output and whole-graph physical closures remain required; normal37/min64 is NOT capacityPASS. copy-site-closure.json is still absent, so no complete source-index/review/package/gate/deployment exists. The standalone hook was rebuilt as SOURCE ONLY to bind the new required module; it was never executed.

All199 tests passed on the first frozen full run after focused LOCAL passes.103 source hashes remained unchanged; only this README explanation was added afterward. Windows/Node24.13/synthetic SQLite/real LOCAL file/child and Docker-kernel-systemd stand-ins only. New fixture bytes remain LOCAL with a public hash delta referencing prior immutable inventories; old fixture bytes were not reread.

Existing207 corrected ordinary CI38911857904 attempt1 is now actually COMPLETE/SUCCESS on ad9d2660041c4db380d73a759871987d625f7404, including full server/client and BOTH real Docker builds/boundary/readiness. Parent still requires closed-log exact inventory verification before its ONE ready/exact-head audit request. Existing208 ordinary new-head CI38915551182 attempt1 on72adbe43b36319e6f9d8088baa61b0fbe26bb3ff is observed only; neither original failed CI is retried. All main merges remain held for actualbe deployment plus actual Claudio postcheck. No native fallback/duplicate acknowledgement/review request was sent. Earlier history follows unchanged.

"""
old=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+old);assert (K/'README.md').read_bytes()[len(notes.encode()):]==old
changed={name:{'testedSha256':digest,'currentSha256':sha((K/name).read_bytes())} for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}
assert set(changed)=={'README.md'}
save(D,'boundary-record.json',canonical({'publishedUtc':utc(),'localTests':199,'closedUtc':v['closedUtc'],
    'frozenSourceFiles':103,'sourceUnchangedDuringFinalRun':True,'postRunREADMEOnly':changed,
    'apacheComponentImplemented':True,'apacheActualCaptureOrSyntaxTest':False,'captureLauncherImplemented':False,
    'proposedCaptureRoot':'/opt/lims/releases/workflow-batch-review-capture-be837974-20261016T170000Z',
    'captureRootCreated':False,'apacheSeparateDeclaredFileEnvelopeBytes':8*1024**2,'capturePhysicalAdmissionClaimed':False,
    'copyOverflowRefusesBeforeWrite':True,'filesystemClosureClaimed':False,'capacityPassClaimed':False,
    'copySiteClosureCreated':False,'sourceReviewRequested':False,'hostCalls':0,'productionSqlConnections':0,
    'newQualificationRuns':0,'remoteRootCreated':False,'realPackageCreated':False,'realKitGateCreated':False,
    'deployment':False,'mainMergeHold':True,'parentReadyOrAuditRequestedAtPublication':False,
    'parallel207Ci':{k:new207[k] for k in ('id','head_sha','status','conclusion','run_attempt')},
    'parallel208Ci':{k:new208[k] for k in ('id','head_sha','status','conclusion','run_attempt')},
    'stillMissing':['whole-graph copy/evidence/filesystem closure','complete fresh reviewed host/Apache/scientific capture launcher',
        'actual complete source review/exact-kit review/fresh human gate']})+b'\n')
when=utc()
lead=f"""LATEST CONCRETE APACHE CAPTURE COMPONENT / PRE-WRITE COPY GUARD /199 LOCAL PASS - {when}.
SAME be837974/acc15844 kit has199LOCALtestsPASS/103sourcefiles unchanged throughout the frozen full run/README-only afterward. New fresh read-only Apache component retains exact original bytes/full owner-mode-identity-allocation/xattrs and renders held bytes ONLY for the complete explicit two-vhost lims profile. Unknown directives/TLS/proxy/address/blocks/includes/error-documents/rewrites/aliases/hardlinks/mixed endings/observed file-attribute races refuse. Original bytes preserved verbatim; only HTTPS503 rewrite lines inserted. Rendering is NOT Apache syntax/serving proof. Missing actual source PASS refuses BEFORE reads; durable intent before read prevents retry. Distinct proposed170000CAPTUREroot UNCREATED;150000RELEASEroot UNCREATED. Separate8MiB Apache file/entry allowance is DECLARED only: full capture launcher/physical admission still MISSING.
Package requires fresh apache-capture.json/source-id/time/fullstablemetadata/opaque-xattrs/exactrenderedheld+capture-receipt rawSHA binding. Synthetic future packages remain LOCAL stand-ins. copy_file now validates exact hash/length+reserve check BEFORE destination creation and refuses a growing-source chunk BEFOREwrite; exact empty/binary/sourcepreservation/reuse/precheck guards pass. Existing backup/TMPDIR/daemon output and whole-graph copy/evidence/filesystem closure STILLMISSING; copy-site-closure.json ABSENT/normal37-min64 NOTcapacityPASS. KEEP IMPLEMENTING whole closure and complete executable fresh reviewed host/Apache/scientific capture launcher, not waiting for nonexistent SourcePASS. No actual source-review request/package/host/SSH/Linuxfsync/productionSQL/Docker/cgroup/newqualification/root/unit/gate/attempt/deployment. Standalone hook rebuilt SOURCEONLY/neverexecuted. Newfixture hash delta references old immutable inventories/oldfixturebytes NOTREREAD.
Existing207 NEW ordinaryCI38911857904attempt1 actuallyCOMPLETE/SUCCESS onad9d2660041c4db380d73a759871987d625f7404 inclALLrealDocker; parent closedlog/exactinventory verification BEFORE ONEready/exacthead audit. Existing208 NEW ordinaryCI38915551182attempt1 on72adbe43b36319e6f9d8088baa61b0fbe26bb3ff observed{new208['status']}/{new208['conclusion']}; observeONLYsame/no retry/redispatch. Both originalfailedCIs immutable. ALLmainmerges HOLD actualbeDEPLOYED+actualClpostcheckPASS.621299+621326govern/ACK621326ONLYnextCOMPLETEsourceReview/ALLnativefallbacksCANCELLEDforever/no duplicates. Wholeoutage50min historical+20UNMEASUREDproposal/NOTmeasuredproduction/YYacceptedlimit;600readiness5400controller unchanged. SameheartbeatACTIVE2min/restore10ONLYactualdeployment+Clpostcheck. R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanfilesdraftscards preserved. All earlier history follows verbatim.

"""
extras={p for p in K.iterdir() if p.is_file()}|{p for p in run.rglob('*') if p.is_file()}
extras.add(W/'WP/backlog-resume-20261013'/pathlib.Path(__file__).name)
print(json.dumps(boundary_publish(D,extras,'feat(release): capture reviewed Apache bytes and guard copy writes',lead)))
