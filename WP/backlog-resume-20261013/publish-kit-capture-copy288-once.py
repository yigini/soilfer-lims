"""Publish closed LOCAL capture copy/provenance source; no host operator."""
from concurrent.futures import ThreadPoolExecutor
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'capture-copy288-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='419ff38112ad0966a536ad4b7f28b306803088a6'
assert not git('diff','--cached','--name-only').strip()
runs=['capture-copy287-first','capture-copy288-reviewed'];closed=[]
for label,total in zip(runs,[287,288]):
    folder=K/('local-tests-'+label);value=json.loads((folder/'verification.json').read_bytes())
    log=(folder/'stderr-original.txt').read_text(encoding='utf-8')
    assert value['exitCode']==0 and value['sourceBefore']==value['sourceAfter'] and len(value['sourceBefore'])==128
    assert ('Ran '+str(total)+' tests in ') in log and log.rstrip().endswith('OK')
    closed.append(value)
v=closed[-1];log=(K/('local-tests-'+runs[-1])/'stderr-original.txt').read_text(encoding='utf-8')
test_summary=[line for line in log.splitlines() if line.startswith('Ran ')];assert len(test_summary)==1
assert all(sha((K/name).read_bytes())==digest for name,digest in v['sourceBefore'].items())
assert not (K/'copy-site-closure.json').exists() and not list(K.glob('release-package-*'))
assert subprocess.run(['git','diff','--check','--',str(K.relative_to(W))],cwd=W,capture_output=True).returncode==0
endpoints={
 'main':'repos/yigini/soilfer-lims/git/ref/heads/main','main-ci':'repos/yigini/soilfer-lims/actions/runs/38772398721',
 'issue191':'repos/yigini/soilfer-lims/issues/191','pr207':'repos/yigini/soilfer-lims/pulls/300',
 'pr208':'repos/yigini/soilfer-lims/pulls/299','ci207':'repos/yigini/soilfer-lims/actions/runs/38956418902',
 'ci208':'repos/yigini/soilfer-lims/actions/runs/38953786365',
 'release-comments':'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T21%3A00%3A00Z&per_page=100',
 'audit207-comments':'repos/yigini/soilfer-lims/issues/300/comments?since=2026-10-16T20%3A23%3A55Z&per_page=100',
 'audit208-comments':'repos/yigini/soilfer-lims/issues/299/comments?since=2026-10-16T20%3A03%3A51Z&per_page=100'}
def fetch(item):
    name,endpoint=item
    return name,subprocess.check_output(['gh','api',endpoint],cwd=W)
with ThreadPoolExecutor(max_workers=4) as pool:raws=dict(pool.map(fetch,endpoints.items()))
current={name:json.loads(raw) for name,raw in raws.items()}
assert current['main']['object']['sha']==current['main-ci']['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
assert current['main-ci']['status']=='completed' and current['main-ci']['conclusion']=='success' and current['issue191']['state']=='closed'
for label,head in [('207','f83f3cddfee97f9115737ae85a07650c83cef885'),('208','153f10e6bac02b1a962213431141fd1c54906e99')]:
    assert current['pr'+label]['head']['sha']==current['ci'+label]['head_sha']==head
    assert current['ci'+label]['run_attempt']==1 and current['ci'+label]['event']=='pull_request'
    assert current['ci'+label]['status']=='completed' and current['ci'+label]['conclusion']=='success'
for name in ('release-comments','audit207-comments','audit208-comments'):
    assert len(current[name])<100
    assert not [row for row in current[name] if (row.get('performed_via_github_app') or {}).get('id')==1236702], 'Read full new actual verdict before publication'
D.mkdir()
for name,raw in raws.items():save(D,'api-'+name+'-original.json',raw)
prior_names=[
 'shared-evidence161-publication-once/all-local-fixtures-hash-inventory.json',
 'emergency-http176-inventory-successor-publication-once/new-local-fixtures-hash-inventory.json',
 'prestart188-fixed-envelopes-publication-once/new-local-fixtures-hash-inventory.json',
 'apache199-copy-prewrite-publication-once/new-local-fixtures-hash-inventory.json',
 'copy-admissions208-publication-once/new-local-fixtures-hash-inventory.json',
 'seal-sqlite212-exact-verdict-successor-publication-once/new-local-fixtures-hash-inventory.json',
 'reader-live-backup221-publication-once/new-local-fixtures-hash-inventory.json',
 'live-backup-journal225-publication-once/new-local-fixtures-hash-inventory.json',
 'application-snapshots234-publication-once/new-local-fixtures-hash-inventory.json',
 'order-output242-publication-once/new-local-fixtures-hash-inventory.json',
 'controller-output253-publication-once/new-local-fixtures-hash-inventory.json',
 'cli-pipes263-publication-once/new-local-fixtures-hash-inventory.json',
 'capture-owners276-publication-once/new-local-fixtures-hash-inventory.json']
known=set();refs=[]
for name in prior_names:
    path=K/name;raw=path.read_bytes();known.update(row['path'] for row in json.loads(raw)['fixtures'])
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
notes=f'''LOCAL SEPARATE CAPTURE BUDGET / FILESYSTEM COPY PROVENANCE /288 PASS - {when}.

New kit_capture_budget.py supplies a SEPARATE CaptureBudget/CaptureDisk for the proposed170000 capture root/unit. Eight stages declare17 database-copy equivalents: fresh raw+reader+backup+reader-index4, scientific clone1, canonical policy1,206 post-preparation seal4,214 policy+post-preparation seal5,209 read-only order-impact snapshots2; integrity/chart-impact have no DB-copy producer. One retained asset tree is charged; three-asset conservative free-space reserve remains. The25percent margin/minimum64, unchanged floor/additional10GB/global4GiB log reserve and eight physical stage-growth shares remain. Apache8MiB and all three outer-seal directories have separate declared allowances. Normal release41/min64 and Capture17/min64 are distinct tables, neither a capacity PASS. Source claims and complete before-create admissions are single-use and mandatory for stage closure. Release budget/root,209 APPLY/default startup, predecessor recovery/restart are refused by this capture domain. Shared storage topology/du measurements are reused without changing their predicates. This does NOT close SQLite writer journals/WAL growth, daemon storage, systemd lifecycle logs or physical metadata.

New kit_capture_copy.py validates the full exact original source PASS PLUS explicit capture root/unit/table/filesystem-only/raw-master-never-SQLite/206214-preparation/no209APPLY tokens BEFORE any root/mount/kernel/Docker/live-file read in this component. Durable snapshot intent precedes first production file stat/content open and predecessor observation; failed/lost outcomes cannot retry. Exact healthy normal959d predecessor identity/configuration/mounts/PID/jobs/heap/oldMemorySwap1610612736 must remain equal before/after collection. No production stop/restart/ingress mutation is exposed. The complete future launcher must STILL independently refresh primary provider authority; this component does not claim that a stored PASS proves absence of later direction.

Production input is ONLY the pinned filesystem dev.db/WAL/SHM window: canonical ancestors, independent regular nlink1/same-device/distinct inodes/no dangling alias/no rollback journal. The existing complete before/copy/after equality happens ONCE. Raw masters NEVER connect SQLite; independent new owned reader with its admitted WAL index and detached memory-journal backup supply full integrity/FK/logical equality and exact106tables39receipts. Production may evolve after the closed handoff; no later live-content equality is demanded and no cross-file DB/assets atomic snapshot is claimed. All raw/reader/backup/assets and outer handoffs are explicitly fsynced through the Linux-only durability boundary before provenance publication; this boundary was substituted in LOCAL tests, never tested on Linux. Source hash/length/full metadata and live directory identity remain guarded. All original files/failed partial output stay retained.

The immutable bounded snapshot provenance pair binds full source review/table/root/head/image, both complete normal-predecessor projection controls, raw triple byte identities, backup/logical-state/handoff/copy-window originals and complete retained asset file identities/directory names. Clone creation requires and rehashes this provenance, uses ONLY its NEW detached backup with full pre-mkdir content/entry admission, syncs the independent new scientific-database and binds its initial bytes/directory/main inode. Missing/mutated masters, backup sidecars, hardlinks, asset changes/extra empty directories, foreign control pairs or same-byte clone inode substitution refuse. Every capture CLI now revalidates the retained provenance before and after pre-create control admission. Clone contents may later change ONLY through the separate reviewed preparation sequence; complete stage/order/installer-preservation orchestration is still required. This is copy provenance and scoped alias/durability admission, NOT a completed launcher, atomic absence or global filesystem closure.

First frozen287PASS33.618s/start2026-10-16T21:11:26.804509Z/closed21:12:01.104448Z,128sources unchanged. Review added retained asset/directory rehash, both predecessor control-pair validation, strict integer provenance fields and meaningful actual-clone-to-real-CLI-precreate integration. Final {test_summary[0]}, started{v['startedUtc']}/closed{v['closedUtc']}; ALL128sources unchanged. README only afterward. No failed test run this boundary. Both original streams/verification/source-at-test retained. Tests use NEW native LOCAL Python SQLite WAL106/39 databases, real filesystem copies/hardlinks/control pairs and source/admission guards; exact review records, predecessor Docker/kernel/free-space/physical growth and scientific execution are LOCAL stand-ins. SQL connection tracing confirms no live/raw-master connection. Native WAL evolution after handoff is allowed; mutation during window consumes failure. No actual full science owner, Docker/systemd/kernel memory, Linux fsync, production count/copy or host result is claimed. Tool-only reads named missing kit_predecessor.py and two not-yet-created test closure artifacts while runs were active; no file contents/proof/mutation inferred. New fixture-hash delta references161176188199208212221225234242253263276; old fixture bytes NOT reread/private bytes LOCAL withheld. Release stop-post was SOURCEONLY rebuilt for REQUIRED_SOURCE additions; neither hook executed.

Fresh primary reads still show no new actual Claude release direction or exact-head207/208 verdict.207request6224015713/f83f/CI38956418902SUCCESS3745716 and208request6223680579/153f/CI38953786365SUCCESS3765761 remain PENDING; no duplicate body/ready/label/request/native/merge. Existing207208 agents DONE/idle/no new agents/worktrees. Old207FAILED6218788735 immutable; old208 actual unprinted row/receipt equality UNKNOWN/no retrospectivePASS. CurrentbeKIT206214209ONLY/future207custodyDRYplannedblockedcounts+3nonblockersrequired.

KEEP IMPLEMENTING wholecopy/evidence/filesystem closure AND COMPLETE executable fresh reviewed host-consumer-Apache-scientific capture launcher. Next: source/provider authority, actual206214 preparation+preservation/full214209scientific originals, consumer2pass/Apache/capture-receipt, separate controller transport/unit/package/preparer/launcher and corrected captureRoot-vs-releaseRoot package binding. copy-site-closure.json ABSENT/no actual SourceReview/PASS exists to wait for. SQLscratch/internalwriterjournals/WALgrowth/originaltargetROindex/candidateTMPDIR/candidateDockerlogs+daemonoverlay/systemdmanagerlifecycle+physicaljournald/physicalmetadata STILLUNCLOSED. Proposed170000capture/150000release roots UNCREATED/unreserved/no actual package/host/SSH/Linuxfsync/productionSQL/Docker/cgroup/newqualification/unit/gate/attempt/deployment. ALLmainmergesHOLD actualbeDEPLOYED+actualClpostcheckPASS.621299+621326govern/ACK621326ONLYnextCOMPLETEkitSourceReview/ALLnativefallbacksCANCELLEDforever/no duplicateACK/GH/native. SameheartbeatACTIVE2min/restore10ONLYactualmilestone/R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanfilesdraftscards preserved. Earlier history unchanged.

'''
prior=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+prior)
assert {name for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}=={'README.md'}
save(D,'boundary-record.json',canonical({'publishedUtc':when,'tests':288,'sourceFiles':128,'finalRun':v,
 'priorSuccessfulRuns':runs[:1],'captureCopyEquivalents':17,'minimumDatabaseEquivalents':64,
 'captureRootCreated':False,'releaseRootCreated':False,'hostCalls':0,'productionSql':0,
 'globalFilesystemClosure':False,'captureLauncherComplete':False,'sourceReviewRequested':False,'mainMergeHold':True})+b'\n')
lead='LATEST CONCRETE SEPARATE CAPTURE BUDGET / COPY PROVENANCE /288 LOCAL PASS - '+when+'.\n'+notes.split('\n',2)[2]
extras={path for path in K.iterdir() if path.is_file()}
for run in runs:extras|={path for path in (K/('local-tests-'+run)).rglob('*') if path.is_file()}
extras.add(pathlib.Path(__file__).resolve())
print(json.dumps(boundary_publish(D,extras,'feat(release): admit capture copies and bind retained clone provenance',lead)))
