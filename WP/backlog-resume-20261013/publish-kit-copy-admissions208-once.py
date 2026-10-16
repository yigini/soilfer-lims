"""Publish closed LOCAL content/entry admission work; no host operator."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016';D=K/'copy-admissions208-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='93fb539bc87cdac7b92d3c60232b01baeb5dc425'
assert not git('diff','--cached','--name-only').strip()
runs=[K/('local-tests-'+n) for n in ('copy-admissions206-first','copy-admissions206-final','copy-admissions208-final')]
v=json.loads((runs[-1]/'verification.json').read_bytes());log=(runs[-1]/'stderr-original.txt').read_bytes()
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==105
assert b'Ran 208 tests' in log and log.rstrip().endswith(b'OK')
assert all(sha((K/name).read_bytes())==digest for name,digest in v['sourceBefore'].items())
for run in runs[:-1]:
    failed=json.loads((run/'verification.json').read_bytes())
    assert failed['exitCode']==1 and failed['sourceBefore']==failed['sourceAfter']
assert not (K/'copy-site-closure.json').exists() and not list(K.glob('release-package-*'))
endpoints=['repos/yigini/soilfer-lims/git/ref/heads/main','repos/yigini/soilfer-lims/actions/runs/38772398721',
    'repos/yigini/soilfer-lims/issues/191','repos/yigini/soilfer-lims/pulls/300','repos/yigini/soilfer-lims/pulls/299',
    'repos/yigini/soilfer-lims/actions/runs/38911857904','repos/yigini/soilfer-lims/actions/runs/38915551182',
    'repos/yigini/soilfer-lims/actions/runs/38915551182/jobs',
    'repos/yigini/soilfer-lims/issues/300/comments?since=2026-10-16T14%3A47%3A15Z&per_page=100',
    'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T14%3A49%3A31Z&per_page=100']
captures=[(endpoint,subprocess.check_output(['gh','api',endpoint],cwd=W)) for endpoint in endpoints]
main,ci,issue,pr207,pr208,ci207,ci208,jobs208,comments207,comments162=[json.loads(raw) for _,raw in captures]
assert main['object']['sha']==ci['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
assert ci['run_attempt']==1 and ci['status']=='completed' and ci['conclusion']=='success' and issue['state']=='closed'
assert pr207['head']['sha']==ci207['head_sha']=='ad9d2660041c4db380d73a759871987d625f7404'
assert ci207['run_attempt']==1 and ci207['conclusion']=='success' and ci207['status']=='completed'
assert pr208['head']['sha']==ci208['head_sha']=='72adbe43b36319e6f9d8088baa61b0fbe26bb3ff'
assert ci208['run_attempt']==1 and ci208['conclusion']=='failure' and ci208['status']=='completed'
assert pr207['base']['sha']==pr208['base']['sha']==main['object']['sha']
actual207=[c for c in comments207 if c['id']!=6218049200 and (c.get('performed_via_github_app') or {}).get('id')==1236702]
assert not actual207,'Read full new actual207 audit before publication'
assert not [c for c in comments162 if (c.get('performed_via_github_app') or {}).get('id')==1236702], 'Read full new release direction before publication'
D.mkdir()
for i,(endpoint,raw) in enumerate(captures):save(D,'api-original-'+str(i)+'.json',raw)
prior_paths=[K/'shared-evidence161-publication-once/all-local-fixtures-hash-inventory.json',
    K/'emergency-http176-inventory-successor-publication-once/new-local-fixtures-hash-inventory.json',
    K/'prestart188-fixed-envelopes-publication-once/new-local-fixtures-hash-inventory.json',
    K/'apache199-copy-prewrite-publication-once/new-local-fixtures-hash-inventory.json']
known=set();prior_refs=[]
for path in prior_paths:
    raw=path.read_bytes();known|={row['path'] for row in json.loads(raw)['fixtures']}
    prior_refs.append({'path':path.relative_to(W).as_posix(),'sha256':sha(raw),'gitBlobOid':oid(raw)})
fixtures=[]
for directory in sorted(K.glob('*-local-retained-fixtures')):
    for path in sorted(directory.rglob('*')):
        if not path.is_file():continue
        name=path.relative_to(K).as_posix()
        if name in known:continue
        raw=path.read_bytes();s=path.stat()
        fixtures.append({'path':name,'bytes':len(raw),'sha256':sha(raw),'localModeObserved':s.st_mode&0o777,'localLinksObserved':s.st_nlink})
save(D,'new-local-fixtures-hash-inventory.json',canonical({'fixtures':fixtures,'priorInventories':prior_refs,
    'priorFixtureFilesNotReread':True,'newFixtureBytesPublic':False,'privateHostBytesFetched':0,'productionBytes':0})+b'\n')
notes="""LOCAL COPY CONTENT/ENTRY ADMISSIONS AND APACHE TIMESTAMP - 2026-10-16.

208 LOCAL tests PASS,105 top-level source hashes unchanged during the final frozen run. Controller-owned raw triples, database clones and asset trees now declare their entire file/directory layout before their first destination directory exists. Every file has a content-block, entry and inode allowance, including empty files; directories carry base and parent-entry allowances. Fresh stat-only input sizing now exposes observed file allocations separately from these DECLARED metadata allowances. The exact copied Linux preflight AST includes this calculation. These are source allowances, NOT actual filesystem metadata closure or a capacity PASS.

The active-stage producer claim is single-spend: each controller copy requires its own before-create admission and stage closure refuses missing admissions. Oversize layout or reused claim refuses before destination creation. Owned-reader SQLite backups begin a read-only snapshot, obtain page count/page size, and admit its complete main-file content before exclusively creating the destination; the result must have exactly the pinned page layout. This is NOT a hard filesystem quota or proof of SQLite's internal temporary/journal files. No installer transaction timeout, kill point, default heap, candidate readiness clock or production database path changed. The outer seal directory and remaining SQLite/app TMPDIR/daemon/unit-journal producers still need complete closure.

File hashing now reads at most the initial source length plus one original overflow byte, checks exact byte count and descriptor/path identity before/after, and refuses growth without unbounded reads. Linux requires full ctime equality. Windows path-versus-descriptor creation-time projections are compared independently in this reader; Linux guards are unchanged. The existing Apache capture test also needed an explicitly LOCAL Windows ctime projection; the production Apache predicate still requires complete stable Linux metadata. The capture now emits the whole-second UTC format required by package verification; a new LOCAL capture-to-real-package-semantic-check roundtrip passes.

Two earlier frozen206-test runs remain retained honestly: first204PASS2fixtureERROR because two budget fixtures omitted the newly required admission; second205PASS1LOCAL Windows Apache stat-projection ERROR. Both source sets were unchanged during their runs. The corrected208-test run is fully PASS; only this README explanation follows it. Earlier exploratory focused failures were tool outputs only, not a full frozen verification. Windows/Node/new synthetic SQLite/real LOCAL files and Docker/kernel/systemd stand-ins only. New fixture hash delta references old immutable inventories; old fixture bytes were not reread. Standalone hook rebuilt SOURCE ONLY, never executed.

The whole-graph copy/evidence/filesystem closure and full executable fresh reviewed host/consumer/Apache/scientific capture launcher remain unfinished. copy-site-closure.json is ABSENT. No actual source-review request or SourcePASS exists to wait for. Continue implementing. Proposed170000 capture and150000 release roots remain UNCREATED; no real package/host call/production SQLite/Docker/cgroup/Linux fsync/new qualification/unit/gate/attempt/deployment.

207 ready label and exact-head audit request6218049200 were already posted ONCE; actual final Claudio audit remains pending. Do not duplicate them. 208 same ordinary new-head CI38915551182 attempt1 on72adbe43 is now CLOSED FAILED: server, both real Docker builds and boundary passed, readiness retained-row comparison failed. Existing208 agent retains originals and investigates read-only; no correction/retry/replacement CI/ready/audit/merge is yet authorized. Both original failed runs remain immutable. Main merges still hold for actualbe deployment and actual Claudio postcheck. Earlier history follows unchanged.

"""
old=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+old);assert (K/'README.md').read_bytes()[len(notes.encode()):]==old
changed={name:{'testedSha256':digest,'currentSha256':sha((K/name).read_bytes())} for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}
assert set(changed)=={'README.md'}
when=utc()
lead=f"""LATEST CONCRETE COPY CONTENT/ENTRY ADMISSIONS / APACHE TIMESTAMP /208 LOCAL PASS - {when}.
SAME be837974/acc15844 kit has208LOCALtestsPASS/105sourcefiles unchanged during final frozen run/README-only after. Full raw-triple/clone/asset content-entry-directory layouts admitted BEFORE destination creation; empty files charged; active-stage claims single-spend and missing admissions refuse stage closure. Stat-only sizing separates observed file allocations from DECLARED entry/inode/directory allowances; exact remote preflight AST includes calculation. Owned-reader backup pins read-only page layout and admits main-file content BEFORE exclusive backup creation; exact final page length required. NOT filesystem quota/SQLite internal journal-temp/global closure. File hash bounded to original length+one overflow byte/full descriptor-path checks; Linux ctime strict/Windows projections explicit. Apache timestamp now package-compatible UTC; LOCAL capture-to-package roundtrip PASS. Two frozen206 runs204PASS2fixtureERROR then205PASS1LOCALApacheWindowsstatERROR retained/sourceunchanged; final208PASS. Newfixturehash delta/oldfixturebytesNOTREREAD/stop-post rebuilt SOURCEONLY neverexecuted.
KEEP IMPLEMENTING whole-graph copy/evidence/filesystem closure incl outer seal dirs/SQLite internalfiles/appTMPDIR/daemon/unitjournal plus full fresh reviewed host-consumer-Apache-scientific capture launcher. copy-site-closure.json ABSENT/normal37-min64 NOTcapacityPASS/no actual sourceReview or SourcePASS to wait for. Proposed170000CAPTURE+150000RELEASE roots UNCREATED/unreserved/no realpackage/host/SSH/Linuxfsync/productionSQL/Docker/cgroup/newqualification/unit/gate/attempt/deployment.621299+621326govern/ACK621326ONLYnextCOMPLETEsourceReview/ALLnativefallbacksCANCELLED/no duplicates.
207 exactad9d ordinaryCI38911857904attempt1 COMPLETE/SUCCESS374suites5710tests/ALLrealDocker independently retained; actualONEready+request6218049200 alreadyPOSTED/finalactualClAUDITPENDING/no duplicate/native/merge. 208 exact72adbe43 ordinaryCI38915551182attempt1 nowCOMPLETE/FAILURE/readiness retained-row comparison; server+bothrealDocker+boundaryPASS do NOT make overallgreen. Existing208 agent READONLYclosed-original retention/investigation ONLY/no corrections/push/retry/replacementCI/ready/audit/merge yet. Originalfailed38898969962+38898578537 immutable. ALLmainmerges HOLD actualbeDEPLOYED+actualClpostcheckPASS. SameheartbeatACTIVE2min/restore10ONLYactualmilestone. R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humansheld. Earlier history verbatim below.

"""
save(D,'boundary-record.json',canonical({'publishedUtc':when,'tests':208,'sources':105,'sourceUnchangedDuringRun':True,
    'READMEOnlyAfter':changed,'fullFilesystemClosure':False,'copySiteClosureCreated':False,
    'captureLauncherComplete':False,'sourceReviewRequested':False,'hostCalls':0,'productionSqlConnections':0,
    'realPackage':False,'remoteRoot':False,'unit':False,'gate':False,'deployment':False,'mainMergeHold':True,
    'ci207':{k:ci207[k] for k in ('id','status','conclusion','head_sha','run_attempt')},
    'ci208':{k:ci208[k] for k in ('id','status','conclusion','head_sha','run_attempt')}})+b'\n')
extras={p for p in K.iterdir() if p.is_file()}|{p for run in runs for p in run.rglob('*') if p.is_file()}
extras.add(W/'WP/backlog-resume-20261013'/pathlib.Path(__file__).name)
print(json.dumps(boundary_publish(D,extras,'feat(release): admit owned copy layouts before creation',lead)))
