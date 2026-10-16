"""Publish frozen LOCAL typed-capture owners; no host/operational calls."""
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'capture-owners276-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='778801a3049541c02911d86949e12373fac0ad45'
assert not git('diff','--cached','--name-only').strip()
runs=['capture-owners274-first','capture-owners276-reviewed','capture-owners276-alias-final']
closed=[]
for label,total in zip(runs,[274,276,276]):
    folder=K/('local-tests-'+label);v=json.loads((folder/'verification.json').read_bytes())
    log=(folder/'stderr-original.txt').read_text(encoding='utf-8')
    assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==125
    assert ('Ran '+str(total)+' tests in ') in log and log.rstrip().endswith('OK')
    closed.append(v)
v=closed[-1];log=(K/('local-tests-'+runs[-1])/'stderr-original.txt').read_text(encoding='utf-8')
test_summary=[line for line in log.splitlines() if line.startswith('Ran ')];assert len(test_summary)==1
assert all(sha((K/name).read_bytes())==digest for name,digest in v['sourceBefore'].items())
assert not (K/'copy-site-closure.json').exists() and not list(K.glob('release-package-*'))
assert subprocess.run(['git','diff','--check','--',str(K.relative_to(W))],cwd=W,capture_output=True).returncode==0
current={};raws={}
for name,endpoint in {
 'main':'repos/yigini/soilfer-lims/git/ref/heads/main','main-ci':'repos/yigini/soilfer-lims/actions/runs/38772398721',
 'issue191':'repos/yigini/soilfer-lims/issues/191','pr207':'repos/yigini/soilfer-lims/pulls/300',
 'pr208':'repos/yigini/soilfer-lims/pulls/299','ci207':'repos/yigini/soilfer-lims/actions/runs/38956418902',
 'ci208':'repos/yigini/soilfer-lims/actions/runs/38953786365',
 'release-comments':'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T20%3A44%3A00Z&per_page=100',
 'audit207-comments':'repos/yigini/soilfer-lims/issues/300/comments?since=2026-10-16T20%3A23%3A55Z&per_page=100',
 'audit208-comments':'repos/yigini/soilfer-lims/issues/299/comments?since=2026-10-16T20%3A03%3A51Z&per_page=100'}.items():
    raw=subprocess.check_output(['gh','api',endpoint],cwd=W);raws[name]=raw;current[name]=json.loads(raw)
assert current['main']['object']['sha']==current['main-ci']['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
assert current['main-ci']['status']=='completed' and current['main-ci']['conclusion']=='success' and current['issue191']['state']=='closed'
for label,head in [('207','f83f3cddfee97f9115737ae85a07650c83cef885'),('208','153f10e6bac02b1a962213431141fd1c54906e99')]:
    assert current['pr'+label]['head']['sha']==current['ci'+label]['head_sha']==head
    assert current['ci'+label]['run_attempt']==1 and current['ci'+label]['event']=='pull_request'
    assert current['ci'+label]['status']=='completed' and current['ci'+label]['conclusion']=='success'
for name in ('release-comments','audit207-comments','audit208-comments'):
    assert len(current[name])<100
    assert not [r for r in current[name] if (r.get('performed_via_github_app') or {}).get('id')==1236702], 'Read full new actual verdict before publication'
D.mkdir()
for name,raw in raws.items():save(D,'api-'+name+'-original.json',raw)
prior_paths=[K/'shared-evidence161-publication-once/all-local-fixtures-hash-inventory.json',
 K/'emergency-http176-inventory-successor-publication-once/new-local-fixtures-hash-inventory.json',
 K/'prestart188-fixed-envelopes-publication-once/new-local-fixtures-hash-inventory.json',
 K/'apache199-copy-prewrite-publication-once/new-local-fixtures-hash-inventory.json',
 K/'copy-admissions208-publication-once/new-local-fixtures-hash-inventory.json',
 K/'seal-sqlite212-exact-verdict-successor-publication-once/new-local-fixtures-hash-inventory.json',
 K/'reader-live-backup221-publication-once/new-local-fixtures-hash-inventory.json',
 K/'live-backup-journal225-publication-once/new-local-fixtures-hash-inventory.json',
 K/'application-snapshots234-publication-once/new-local-fixtures-hash-inventory.json',
 K/'order-output242-publication-once/new-local-fixtures-hash-inventory.json',
 K/'controller-output253-publication-once/new-local-fixtures-hash-inventory.json',
 K/'cli-pipes263-publication-once/new-local-fixtures-hash-inventory.json']
known=set();refs=[]
for path in prior_paths:
    raw=path.read_bytes();known.update(r['path'] for r in json.loads(raw)['fixtures'])
    refs.append({'path':path.relative_to(W).as_posix(),'sha256':sha(raw),'gitBlobOid':oid(raw)})
fixtures=[]
for directory in sorted(K.glob('*-local-retained-fixtures')):
    for path in sorted(directory.rglob('*')):
        if not path.is_file() or path.relative_to(K).as_posix() in known:continue
        raw=path.read_bytes();info=path.stat();fixtures.append({'path':path.relative_to(K).as_posix(),'bytes':len(raw),
            'sha256':sha(raw),'localModeObserved':info.st_mode&0o777,'localLinksObserved':info.st_nlink})
save(D,'new-local-fixtures-hash-inventory.json',canonical({'fixtures':fixtures,'priorInventories':refs,
 'priorFixtureFilesNotReread':True,'newFixtureBytesPublic':False,'privateHostBytesFetched':0,'productionBytes':0})+b'\n')
when=utc()
notes=f'''LOCAL SEPARATE FRESH-CAPTURE OWNERS /276 PASS - {when}.

New kit_capture_owned.py compiles SIX owners under the distinct proposed170000 review-capture root/label/names/unit. All database mounts are binds to its NEW scientific-database clone. Only206+214 preparation mounts are writable; canonical-policy/integrity/chart-impact/order-impact mounts are read-only. There is no production named-volume mount, release150000 owner,209 APPLY/repeat, default entrypoint, serving permit or ingress route. These specifications DO NOT prepare or launch a real capture package/root/unit. CaptureBudget, full copy provenance/physical closure, source authority and complete host-consumer-Apache-scientific orchestration/launcher remain required.

CaptureOwnedCli uses the existing original600-second lifecycle/default heap/805Swap0/networkNONE/no restart/no removal/no Docker daemon logging. Release and capture wrappers validate mutually exclusive complete specifications BEFORE journal intent or create. Shared selected_fields preserves all existing inspected identity/configuration/resource/mount predicates; typed wrappers supply exact domain label/command. Shared control callbacks still reserve both32MiB+1 original streams, all declared metadata/completion/admission pairs BEFORE mkdir/create, close inner order-impact/snapshot evidence, independently verify full originals before final memory permission and rehash after wrapper stop. Existing release specifications/commands are unchanged. Only capture_cli_guard.cjs exposes the six exact capture argv combinations and reuses the same silent bounded transport; invalid labels/paths/209 APPLY refuse silently.

Capture preparation now requires a fresh clone-writer callback even for206 preparation. Before ANY capture CLI directory, numeric bounded mountinfo refuses a mount at the capture root or any descendant, avoiding a bind-mount alias of production. Clone paths/ancestors must be canonical, its only entries dev.db/WAL/SHM, each independent regular nlink1 on the same filesystem, with distinct inodes; dangling sidecars/journals/extra entries refuse. Clone directory/file identities are rechecked before container create. This is scoped alias/writer admission, NOT atomic filesystem absence or a complete copy provenance/global filesystem closure proof. No production DB content is opened by these guards.

New capture memory sampler accepts ONLY its compiled capture label/root/spec and positive host PID, uses the existing numeric PID/cgroup paths/read bounds/raw retention and unchanged memory gate, and rereads membership/directory/identity after every sample. Release memory identity refuses capture owners and vice versa. No cgroup/host memory measurement ran.

New self-contained capture_stop_post.py is generated from exact selected AST bodies. It attempts ALL six exact capture owners BEFORE source/receipt/controller/evidence-root authority reads, including lost create/start returns. Full image/name/label/command/mount identity is mandatory for a stop; memory/OOM/logging violations cannot suppress otherwise exact stops. A failed inventory/stop or raw retention for one owner cannot suppress later attempts. Already-stopped containers are inspected/retained, empty inventories remain explicit absence with nonvacuous count0, and foreign/release/live-volume substitutions are never stopped. This hook has no candidate/predecessor restart, ingress or serving branch. Both release and capture hooks were SOURCEONLY rebuilt/neverexecuted.

First frozen274PASS31.055s/125sources unchanged. Review added numeric mount/clone alias admission plus actual lost-stop-return continuation: second276PASS29.387s/125unchanged. Final review also refused dangling sidecars and tested exact Linux170000 root/descendant bind mounts (the earlier LOCAL Windows path itself is noncanonical mountinfo). Final {test_summary[0]}, started{v['startedUtc']}/closed{v['closedUtc']}; ALL125sources unchanged. README only afterward. No failed test run this boundary. All three closed raw streams/verification/source-at-test retained. LOCAL real Node guard parsing/silent refusals/real hardlinks/control files and Docker/kernel stand-ins only. Scientific child execution is still a stand-in in the new capture lifecycle tests; no actual full scientific collector/installer, Docker, Linux fsync, systemd or production result is claimed. Two exploratory source reads named nonexistent kit_scientific.py/kit_memory.py; no mutation occurred and no source files were inferred from those failed reads.

Fresh primary reads still show no new actual Claude release direction or exact-head207/208 verdict.207request6224015713/f83f/CI38956418902SUCCESS3745716 and208request6223680579/153f/CI38953786365SUCCESS3765761 remain PENDING; no duplicate body/ready/label/request/native/merge. Existing207208 agents DONE/idle/no new agents/worktrees. Old207FAILED6218788735 is immutable; old208unprinted row/receipt equality UNKNOWN/no retrospectivePASS. CurrentbeKIT206214209ONLY/future207custodyDRYplannedblockedcounts+3nonblockersrequired.

KEEP IMPLEMENTING wholecopy/evidence/filesystem closure AND full executable fresh source-reviewed capture launcher. copy-site-closure.json ABSENT/no SourceReview/PASS to wait for; normal41/min64 NOTcapacityPASS. SQLscratch/internal writer journals/WAL growth/originaltargetROindex/candidateTMPDIR/candidate Dockerlogs+daemonoverlay/systemd lifecycle journald/physicalmetadata remain UNCLOSED. Proposed170000capture and150000release roots UNCREATED/unreserved; no actualpackage/host/SSH/Linuxfsync/productionSQL/Docker/cgroup/newqualification/unit/gate/attempt/deployment. ALLmainmergesHOLD actualbeDEPLOYED+actualClpostcheckPASS.621299+621326govern/ACK621326ONLYnextCOMPLETEkitSourceReview/ALLnativefallbacksCANCELLEDforever. SameheartbeatACTIVE2min/restore10ONLYactualmilestone/R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanspreserved. Earlier history remains unchanged.

'''
prior=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+prior)
assert {n for n,h in v['sourceBefore'].items() if sha((K/n).read_bytes())!=h}=={'README.md'}
save(D,'boundary-record.json',canonical({'publishedUtc':when,'tests':276,'sourceFiles':125,'finalRun':v,
 'priorSuccessfulRuns':runs[:2],'captureOwnerCount':6,'captureRootCreated':False,'releaseRootCreated':False,
 'hostCalls':0,'productionSql':0,'globalFilesystemClosure':False,'captureLauncherComplete':False,
 'sourceReviewRequested':False,'mainMergeHold':True})+b'\n')
lead='LATEST CONCRETE SEPARATE FRESH-CAPTURE OWNERS /276 LOCAL PASS - '+when+'.\n'+notes.split('\n',2)[2]
extras={p for p in K.iterdir() if p.is_file()}
for run in runs:extras|={p for p in (K/('local-tests-'+run)).rglob('*') if p.is_file()}
extras.add(pathlib.Path(__file__).resolve())
print(json.dumps(boundary_publish(D,extras,'feat(release): isolate review capture owners and emergency stops',lead)))
