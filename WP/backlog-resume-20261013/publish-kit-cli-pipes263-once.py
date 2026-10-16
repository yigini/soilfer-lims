"""Publish closed LOCAL CLI pipe source and originals; no operational call."""
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'cli-pipes263-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='3a1c0b063f3ff59d3948901381ef1feb8296363f'
assert not git('diff','--cached','--name-only').strip()
runs=['cli-pipes262-first','cli-pipes261-second','cli-pipes263-final','cli-pipes263-reviewed','cli-pipes263-immutable-final']
closed=[]
for name,code,total in zip(runs,[1,1,1,0,0],[261,261,263,263,263]):
    folder=K/('local-tests-'+name);v=json.loads((folder/'verification.json').read_bytes());log=(folder/'stderr-original.txt').read_bytes()
    assert v['exitCode']==code and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==119
    assert ('Ran '+str(total)+' tests in ').encode() in log
    closed.append(v)
v=closed[-1];log=(K/('local-tests-'+runs[-1])/'stderr-original.txt').read_text()
assert log.rstrip().endswith('OK')
test_summary=[line for line in log.splitlines() if line.startswith('Ran ')];assert len(test_summary)==1
assert all(sha((K/name).read_bytes())==digest for name,digest in v['sourceBefore'].items())
assert not (K/'copy-site-closure.json').exists() and not list(K.glob('release-package-*'))
current={};raws={}
for name,endpoint in {
 'main':'repos/yigini/soilfer-lims/git/ref/heads/main','main-ci':'repos/yigini/soilfer-lims/actions/runs/38772398721',
 'issue191':'repos/yigini/soilfer-lims/issues/191','pr207':'repos/yigini/soilfer-lims/pulls/300',
 'pr208':'repos/yigini/soilfer-lims/pulls/299','ci207':'repos/yigini/soilfer-lims/actions/runs/38956418902',
 'ci208':'repos/yigini/soilfer-lims/actions/runs/38953786365',
 'release-comments':'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T20%3A26%3A31Z&per_page=100',
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
 K/'controller-output253-publication-once/new-local-fixtures-hash-inventory.json']
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
notes=f'''LOCAL CLI ORIGINAL PIPES /263 PASS - {when}.

All15 new owned CLI specifications now explicitly select Docker --log-driver none and verify exact HostConfig.LogConfig none/empty Config. This closes those declared CLI daemon-log producers. Scientific child argv/default heap/environment/transactions and original600-second owner clocks stay unchanged. cli_guard now asynchronously captures BOTH native pipes through cli_output.cjs instead of inheriting Docker output. The guard itself is silent. Its extra process already existed; this changes its transport, not installer commands. Candidate Docker logs, Docker manager lifecycle/overlay, systemd-manager lifecycle/physical journald and physical filesystem metadata remain UNCLOSED.

Each original stream has32MiB plus one retained overflow sentinel. Each read is <=65536 AND remaining allowance BEFORE write. On overflow/write failure the strict bounded prefix stays explicitly incomplete, further bytes are drained UNRETAINED, and the scientific child is NEVER signalled/killed/terminated or given a new timer. Both EOFs can be true while completeOriginals is false. Capture does not publish completion until the real child has closed. Streams are fsynced/sealed BEFORE the atomic existing8192-byte completion pair. A failed capture cannot acquire the existing final-memory/exit permission.

Before mkdir/containercreate, the shared ledger holds BOTH full raw-stream allocations, all declared entries/inodes/directory allowances and full8192-byte admission/pending pair. The canonical same-inode two-link admission binds exact child argv. Parent independently checks immutable same-inode completion pair, argv/status, both one-link raw files/full hashes/lengths/EOF/no overflow/no unretained bytes BEFORE final-memory permission; it rehashes both again AFTER stopped wrapper before consuming stdout. Missing/mutated/partial/foreign-pair evidence refuses. Nonempty stderr still refuses success. There is no CLI docker logs read or daemon stdout/stderr producer. Existing emergency stops remain eligible even when runtime logging settings are violated.

The old128MiB final Docker-log allowance is replaced by64MiB native originals plus64MiB existing Docker-command failure headroom. The command/memory/controller/journal window is now2980MiB plus separately held64MiB native streams/declared metadata, inside SAME3200MiB shared pool (3184generic+16fixedcontroller); independent800+hook64+Apache32 keep SAME4GiB. Order impact separately retains its128MiB inner originals as before. These are DECLARED admissions, not physical preallocation, proof all15 future CLI owners fit, or global filesystem closure. No Docker control-command stderr limit was reduced.

Integration exposed the order-impact allocation walk rejecting the new outer producer. It now validates ONLY the exact outer CLI admission and bounded independent outer stream names before excluding those independently charged files; unknown files/directories still refuse. The independent outer parent must close its own full originals. Consumer inventory also now accepts ONLY the actual controller_output.py ExecStart with nonignored stop-post, and rejects the obsolete direct run_release.py unit.

Frozen first run label cli-pipes262-first actually ran261tests:255PASS/5FAIL/1ERROR29.981s,119sources unchanged. Real order-impact outer-file rejection plus stale envelope/fixture admissions were retained honestly. Second261:260PASS/1ERROR27.961s; a test attempted to reuse the correctly consumed failed-admission ledger. Its positive case now uses a separate LOCAL fixture. Third263:262PASS/1fixtureFAIL29.340s because that new fixture built its specification before the LOCAL root projection; source exact-spec guard correctly refused. Fourth263PASS27.892s. Review then required immutable admission mode BEFORE child launch and tested actual same-inode oversized/writable admission refusals. Final {test_summary[0]}; started{v['startedUtc']}/closed{v['closedUtc']}; ALL119sources unchanged in every frozen run. README only afterward. All failed originals/source snapshots retained; hook SOURCEONLY rebuilt/neverexecuted. Real LOCAL binary/empty/exact/fast-exit/simultaneous/burst-overflow/write-failure/nonzero/spawn-failure pipes, pre-mkdir capacity refusal, foreign/missing control pairs and real silent supervisor/parent/final-permission integration PASS. Scientific owners and Docker/kernel/systemd remain STAND-INS. No Linux/production result claimed. Tool-only PowerShell quote parsing and apply-patch expected-context refusals occurred before edits; they made no source/README/Git/host mutation.

Both corrected source audits remain PENDING at fresh primary reads:207request6224015713/exactf83f/CI38956418902SUCCESS3745716 and208request6223680579/exact153f/CI38953786365SUCCESS3765761. No duplicate body/ready/label/request/native/merge. Both existing agents DONE/idle; no new agents/worktrees. Old207actualFAILED6218788735 remains immutable; old208unprinted row/receipt equality UNKNOWN/no retrospectivePASS.

KEEP IMPLEMENTING wholecopy/evidence/filesystem closure AND full executable fresh reviewed host-consumer-Apache-scientific capture launcher. copy-site-closure.json ABSENT/no actual SourceReview/PASS to waitfor. SQLscratch/internal writer journals/WALgrowth/originaltargetROindex/candidateTMPDIR/candidate Dockerlogs+daemonoverlay/systemd lifecycle journal/physicalmetadata STILLUNCLOSED; normal41/min64 NOTcapacityPASS. Proposed170000capture/150000release roots UNCREATED/unreserved/no actualpackage/host/SSH/Linuxfsync/productionSQL/Docker/cgroup/newqualification/unit/gate/attempt/deployment. Currentbekit206214209ONLY/future207custodyDRYplannedblockedcounts+3nonblockersrequired. ALLmainmergesHOLD actualbeDEPLOYED+actualClpostcheck.621299+621326govern/ACK621326ONLYnextCOMPLETEkitSourceReview/ALLnativefallbacksCANCELLEDforever. SameheartbeatACTIVE2min/restore10ONLYactualmilestone/R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanspreserved. Earlierhistoryunchanged.

'''
prior=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+prior)
assert {n for n,h in v['sourceBefore'].items() if sha((K/n).read_bytes())!=h}=={'README.md'}
save(D,'boundary-record.json',canonical({'publishedUtc':when,'tests':263,'sourceFiles':119,'finalRun':v,
 'failedRunsRetained':runs[:3],'cliStreamBytes':32*1024**2,'cliEnvelopeBytes':2980*1024**2,
 'hostCalls':0,'productionSql':0,'globalFilesystemClosure':False,'captureLauncherComplete':False,
 'sourceReviewRequested':False,'mainMergeHold':True})+b'\n')
lead='LATEST CONCRETE OWNED CLI ORIGINAL PIPES /263 LOCAL PASS - '+when+'.\n'+notes.split('\n',2)[2]
extras={p for p in K.iterdir() if p.is_file()}
for run in runs:extras|={p for p in (K/('local-tests-'+run)).rglob('*') if p.is_file()}
extras.add(pathlib.Path(__file__).resolve())
print(json.dumps(boundary_publish(D,extras,'feat(release): retain bounded CLI originals without daemon logging',lead)))
