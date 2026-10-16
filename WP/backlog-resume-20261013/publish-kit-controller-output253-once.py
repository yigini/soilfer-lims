"""Publish closed LOCAL controller transport source; no operational call."""
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'controller-output253-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='40fdedbfdf037073061d79fe3429f2d6b852dd93'
assert not git('diff','--cached','--name-only').strip()
runs=['controller-output250-first','controller-output251-second','controller-output251-binary','controller-output253-final']
closed=[]
for name,code,total in zip(runs,[1,1,0,0],[250,251,251,253]):
    folder=K/('local-tests-'+name);v=json.loads((folder/'verification.json').read_bytes());log=(folder/'stderr-original.txt').read_bytes()
    assert v['exitCode']==code and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==116
    assert ('Ran '+str(total)+' tests in ').encode() in log
    closed.append(v)
v=closed[-1];assert b'Ran 253 tests in 28.569s' in (K/('local-tests-'+runs[-1])/'stderr-original.txt').read_bytes()
assert all(sha((K/name).read_bytes())==digest for name,digest in v['sourceBefore'].items())
assert not (K/'copy-site-closure.json').exists() and not list(K.glob('release-package-*'))
D.mkdir();current={}
for name,endpoint in {
 'main':'repos/yigini/soilfer-lims/git/ref/heads/main','main-ci':'repos/yigini/soilfer-lims/actions/runs/38772398721',
 'issue191':'repos/yigini/soilfer-lims/issues/191','pr207':'repos/yigini/soilfer-lims/pulls/300',
 'pr208':'repos/yigini/soilfer-lims/pulls/299','ci207':'repos/yigini/soilfer-lims/actions/runs/38956418902',
 'ci208':'repos/yigini/soilfer-lims/actions/runs/38953786365',
 'release-comments':'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T20%3A04%3A00Z&per_page=100',
 'audit208-comments':'repos/yigini/soilfer-lims/issues/299/comments?since=2026-10-16T20%3A03%3A51Z&per_page=100'}.items():
    raw=subprocess.check_output(['gh','api',endpoint],cwd=W);save(D,'api-'+name+'-original.json',raw);current[name]=json.loads(raw)
assert current['main']['object']['sha']==current['main-ci']['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
assert current['main-ci']['status']=='completed' and current['main-ci']['conclusion']=='success' and current['issue191']['state']=='closed'
for label,head in [('207','f83f3cddfee97f9115737ae85a07650c83cef885'),('208','153f10e6bac02b1a962213431141fd1c54906e99')]:
    assert current['pr'+label]['head']['sha']==current['ci'+label]['head_sha']==head
    assert current['ci'+label]['run_attempt']==1 and current['ci'+label]['event']=='pull_request'
    assert current['ci'+label]['status']=='completed' and current['ci'+label]['conclusion']=='success'
for name in ('release-comments','audit208-comments'):
    assert len(current[name])<100
    assert not [r for r in current[name] if (r.get('performed_via_github_app') or {}).get('id')==1236702], 'Read full new actual verdict before publication'
prior_paths=[K/'shared-evidence161-publication-once/all-local-fixtures-hash-inventory.json',
 K/'emergency-http176-inventory-successor-publication-once/new-local-fixtures-hash-inventory.json',
 K/'prestart188-fixed-envelopes-publication-once/new-local-fixtures-hash-inventory.json',
 K/'apache199-copy-prewrite-publication-once/new-local-fixtures-hash-inventory.json',
 K/'copy-admissions208-publication-once/new-local-fixtures-hash-inventory.json',
 K/'seal-sqlite212-exact-verdict-successor-publication-once/new-local-fixtures-hash-inventory.json',
 K/'reader-live-backup221-publication-once/new-local-fixtures-hash-inventory.json',
 K/'live-backup-journal225-publication-once/new-local-fixtures-hash-inventory.json',
 K/'application-snapshots234-publication-once/new-local-fixtures-hash-inventory.json',
 K/'order-output242-publication-once/new-local-fixtures-hash-inventory.json']
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
notes=f'''LOCAL CONTROLLER OUTPUT /253 PASS - {when}.

New stdlib controller_output.py captures the SAME run_release.py argv in the SAME805306368/Swap0/5400-second unit/cgroup. ExecStart explicitly changes to the silent transport; the actual controller is its pipe child. Both original streams retain at most4MiB+1 EACH; three8192-byte control records, BOTH atomic-control names and all declared file/inode/entry allowances fit16MiB BEFORE files/child. Carve16MiB from old journal640: journal624/four producer shares3184+fixed16=SAME3200MiB. Emergency800+hook64+Apache32 still partition the existing4GiB. Generic ledger writers/custom shares cannot double-spend fixed names/space. No filesystem preallocation/global capacity PASS.

Reads<=65536 AND remaining sentinel allowance BEFORE writes. Both EOFs/full hashes/lengths/status/independent immutable one-link streams/exact canonical same-inode two-link controls required. Fsync/seal streams precedes atomic closure. Overflow/write failure retains explicit incomplete prefixes and drains unretained remainder honestly; completeOriginals=false. It NEVER signals/terminates/kills controller/installers or adds a timer. Scientific commands/transactions/defaultheap/original600 clocks unchanged. The independent stop-post rehashes actual originals and requires exact intent/argv/status/EOF/no overflow/no missing bytes BEFORE ANY serving permit, including pre-APPLY recovery. Deployment requires controller exit0; verified old recovery exit1. Missing/mutated/partial/boolean-status/foreign-pair evidence refuses. Consumed bootstrap refuses without adding a failure record to old evidence.

Transport/hook are silent; null stdout/stderr applies ONLY to these silent processes. Actual controller output/tracebacks travel through captured pipes; complete hook result stays in its existing independent record. Failed bootstrap/import/capture cannot manufacture complete closure/serving authority. This closes the declared application-output producer, NOT systemd-manager lifecycle/physical journald storage, Docker daemon output or full filesystem graph. Extra interpreter memory shares SAME unit/cgroup guard; no actual host memory/Linux proof.

First frozen250tests FAILED17errors29.630s/116sources unchanged. Second251 FAILED14errors27.697s/116unchanged. New raw-descriptor code exposed Windows ctime projections and text-mode CRLF/control-byte conversion. Full Linux metadata guards stay strict; Windows compares ctime independently, and all raw/control descriptors now use O_BINARY (0 on Linux). Raw LOCAL observation fixtures and both failed originals retained. Third251PASS27.796s/116unchanged. Review then added consumed-bootstrap/no-new-record and missing-closure-before-query guards; FINAL253PASS28.569s/start20:17:34.494531Z/closed20:18:03.414344Z/116sources unchanged. README only afterward. Hook SOURCEONLY rebuilt/neverexecuted. Real LOCAL simultaneous/binary/empty/exact/fast-exit/burst overflow/nonzero/spawn/write failure pipes and independent closure passed; controller/scientific operations STAND-INS, not production. No Linux fsync/host/systemd/Docker/production claim.

An attempted publisher-preparation command had a nested-triple-quote SyntaxError BEFORE creating its file; the subsequent file-open failed because no helper existed. No evidence directory/README/Git/host mutation occurred in that preparation attempt. This paragraph is a TOOL_OUTPUT_TRANSCRIPTION, not a retained original shell transcript.

Both SAME new-head ordinary CIs actually completed SUCCESS:20738956418902attempt1/exactf83f updated20:14:43Z, agent closed originals now available/independent parent review pending;20838953786365attempt1/exact153f parent-reviewed376/5761 and ONEactualready/audit6223680579 already posted20:03:51Z/finalCl verdictpending. No retry/duplicate body/ready/label/request/native/merge. Old207audit6218788735 immutableFAILED; old208unprinted row/receipt equality UNKNOWN/no retrospectivePASS. Parent ONEnew207audit only after independent closed-original review.

KEEP IMPLEMENTING wholecopy/evidence/filesystem closure AND full executable fresh reviewed host-consumer-Apache-scientific capture launcher. copy-site-closure.json ABSENT/no actual SourceReview/PASS to waitfor. SQLscratch/internal writer journals/WALgrowth/originaltargetROindex/candidateTMPDIR/Docker daemon logs+overlay/systemd lifecycle journal/physicalmetadata STILLUNCLOSED; normal41/min64 NOTcapacityPASS. Proposed170000capture/150000release roots UNCREATED/unreserved/no actualpackage/host/SSH/Linuxfsync/productionSQL/Docker/cgroup/newqualification/unit/gate/attempt/deployment. Currentbekit206214209ONLY/future207custodyDRYplannedblockedcounts+3nonblockersrequired. ALLmainmergesHOLD actualbeDEPLOYED+actualClpostcheck.621299+621326govern/ACK621326ONLYnextCOMPLETEkitSourceReview/ALLnativefallbacksCANCELLEDforever. SameheartbeatACTIVE2min/restore10ONLYactualmilestone/R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanspreserved. Earlierhistoryunchanged.

'''
prior=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+prior)
assert {n for n,h in v['sourceBefore'].items() if sha((K/n).read_bytes())!=h}=={'README.md'}
save(D,'boundary-record.json',canonical({'publishedUtc':when,'tests':253,'sourceFiles':116,'finalRun':v,
 'failedRunsRetained':runs[:2],'fixedControllerOutputBytes':16*1024**2,'sharedPoolIncludingFixedOutput':3200*1024**2,
 'hostCalls':0,'productionSql':0,'globalFilesystemClosure':False,'captureLauncherComplete':False,
 'sourceReviewRequested':False,'mainMergeHold':True})+b'\n')
lead='LATEST CONCRETE CONTROLLER OUTPUT /253 LOCAL PASS - '+when+'.\n'+notes.split('\n',2)[2]
extras={p for p in K.iterdir() if p.is_file()}
for run in runs:extras|={p for p in (K/('local-tests-'+run)).rglob('*') if p.is_file()}
extras.add(pathlib.Path(__file__).resolve())
print(json.dumps(boundary_publish(D,extras,'feat(release): retain bounded controller output before serving authority',lead)))
