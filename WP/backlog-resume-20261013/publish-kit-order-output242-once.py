"""Publish closed LOCAL source/tests only; no operational capture/release call."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *

K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'order-output242-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='3d9bd1bf7ea51dc828c7c93a2f609b36a70d469f'
assert not git('diff','--cached','--name-only').strip()
run=K/'local-tests-order-output242-final'
v=json.loads((run/'verification.json').read_bytes());log=(run/'stderr-original.txt').read_bytes()
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==114
assert b'Ran 242 tests in 26.100s' in log and log.rstrip().endswith(b'OK')
assert all(sha((K/name).read_bytes())==digest for name,digest in v['sourceBefore'].items())
assert not (K/'copy-site-closure.json').exists() and not list(K.glob('release-package-*'))
proof=json.loads((K/'order-impact-transport-source.json').read_bytes())
assert proof['applicationSourceChanged'] is False and proof['outerWrapperArgvChanged'] is True
assert proof['scientificChildArgvChanged'] is False and proof['installerTransactionsChanged'] is False
assert proof['filesystemClosureClaimed'] is False and proof['maximumStreamBytes']==67108864
for key in ('originalWrapper','unchangedScientificOwner'):
    row=proof[key];raw=git('show',proof['applicationHead']+':'+row['path'])
    assert len(raw)==row['bytes'] and sha(raw)==row['sha256'] and oid(raw)==row['gitBlob']
D.mkdir()
endpoints={
    'main':'repos/yigini/soilfer-lims/git/ref/heads/main',
    'main-ci':'repos/yigini/soilfer-lims/actions/runs/38772398721',
    'issue191':'repos/yigini/soilfer-lims/issues/191',
    'pr207':'repos/yigini/soilfer-lims/pulls/300','pr208':'repos/yigini/soilfer-lims/pulls/299',
    'ci207':'repos/yigini/soilfer-lims/actions/runs/38956418902',
    'ci208':'repos/yigini/soilfer-lims/actions/runs/38953786365',
    'release-comments':'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T19%3A41%3A00Z&per_page=100',
    'old-audit207':'repos/yigini/soilfer-lims/issues/comments/6218788735'}
current={}
for name,endpoint in endpoints.items():
    raw=subprocess.check_output(['gh','api',endpoint],cwd=W)
    save(D,'api-'+name+'-original.json',raw);current[name]=json.loads(raw)
assert current['main']['object']['sha']==current['main-ci']['head_sha']==proof['applicationHead']
assert current['main-ci']['status']=='completed' and current['main-ci']['conclusion']=='success'
assert current['issue191']['state']=='closed'
assert current['pr207']['head']['sha']==current['ci207']['head_sha']=='f83f3cddfee97f9115737ae85a07650c83cef885'
assert current['pr208']['head']['sha']==current['ci208']['head_sha']=='153f10e6bac02b1a962213431141fd1c54906e99'
for name in ('ci207','ci208'):assert current[name]['run_attempt']==1 and current[name]['event']=='pull_request'
old=current['old-audit207']
assert old['created_at']==old['updated_at']=='2026-10-16T15:25:42Z'
assert sha(old['body'].encode())=='0d7f5742628798c07f78df01728c40d98e1d825b450b9096f71bc75194fe8f73'
assert len(current['release-comments'])<100
assert not [c for c in current['release-comments'] if (c.get('performed_via_github_app') or {}).get('id')==1236702], 'Read full new actual direction before publication'

prior_paths=[K/'shared-evidence161-publication-once/all-local-fixtures-hash-inventory.json',
    K/'emergency-http176-inventory-successor-publication-once/new-local-fixtures-hash-inventory.json',
    K/'prestart188-fixed-envelopes-publication-once/new-local-fixtures-hash-inventory.json',
    K/'apache199-copy-prewrite-publication-once/new-local-fixtures-hash-inventory.json',
    K/'copy-admissions208-publication-once/new-local-fixtures-hash-inventory.json',
    K/'seal-sqlite212-exact-verdict-successor-publication-once/new-local-fixtures-hash-inventory.json',
    K/'reader-live-backup221-publication-once/new-local-fixtures-hash-inventory.json',
    K/'live-backup-journal225-publication-once/new-local-fixtures-hash-inventory.json',
    K/'application-snapshots234-publication-once/new-local-fixtures-hash-inventory.json']
known=set();refs=[]
for path in prior_paths:
    raw=path.read_bytes();known.update(row['path'] for row in json.loads(raw)['fixtures'])
    refs.append({'path':path.relative_to(W).as_posix(),'sha256':sha(raw),'gitBlobOid':oid(raw)})
fixtures=[]
for directory in sorted(K.glob('*-local-retained-fixtures')):
    for path in sorted(directory.rglob('*')):
        if not path.is_file() or path.relative_to(K).as_posix() in known:continue
        raw=path.read_bytes();info=path.stat()
        fixtures.append({'path':path.relative_to(K).as_posix(),'bytes':len(raw),'sha256':sha(raw),
            'localModeObserved':info.st_mode&0o777,'localLinksObserved':info.st_nlink})
save(D,'new-local-fixtures-hash-inventory.json',canonical({'fixtures':fixtures,'priorInventories':refs,
    'priorFixtureFilesNotReread':True,'newFixtureBytesPublic':False,'privateHostBytesFetched':0,'productionBytes':0})+b'\n')

when=utc()
notes=f'''LOCAL ORDER-IMPACT PIPE CAPTURE /242 PASS - {when}.

The release-owned order-impact wrapper now calls the exact pinned install_order_revisions.js --dry-run scientific owner through bounded pipes. Both original streams reserve64MiB plus one sentinel EACH, an8192-byte exit record and ledger entry/directory allowances BEFORE tmp mkdir/container creation. These are charged inside the existing shared3200MiB evidence pool; no new reserve is added. Each read requests at most65536 bytes and the exact remaining allowance before writing. Both EOFs and complete originals are mandatory before parsing. Fast-exit/burst overflow cannot exceed the retained sentinel; overflow kills ONLY this read-only dry-run child and records incomplete prefixes. No APPLY command/transaction/default heap/original600-second owner clock changes.

New order_impact.cjs/kit_order_output.py/order-impact-transport-source.json replace ONLY the old direct-file order_revision_impact wrapper. The outer wrapper argv changes explicitly; the actual scientific child argv and application source remain exact. TEMP/TMP/TMPDIR now use the existing /tmp bind directly, eliminating the extra outer directory. The same two primary/secondary policy copies remain admitted and verified. Both full streams are fsynced/sealed, and source before/after hashes plus status/signal/error/EOF/hash/length are retained in the exit record. Parent closure independently binds those hashes to the before-create snapshot admission before the existing final-memory/exit permission. Missing/changed/reused evidence refuses. Full original scientific values pass through unchanged; independent allocation checks still cover both policy snapshots.

First frozen focused31tests:29PASS2FAIL1.542s. One fixture expected10 bytes for a9-byte original. The other exposed a real control-reader gap: the parent admission is a retained atomic hardlink pair. The new reader now accepts ONLY that exact two-link same-inode canonical control pair; all stream/snapshot files still require independent one-link inodes. First frozen full242PASS26.859s/114sources unchanged. Review then bounded the admission read BEFORE any content read to8192+1 bytes and added consumed-output/foreign-pair refusal coverage. FINAL242PASS26.100s/start19:56:33.529924Z/closed19:56:59.960837Z/114sources unchanged. README only afterward; all originals retained. Standalone hook SOURCE built only, never executed. Real LOCAL Node binary pipes, simultaneous/exact/empty/fast exit/oversized bursts/nonzero/spawn refusal/parent ledger integration passed. The scientific owner in the new pipe integration is a stand-in, not an actual full order installer run; the unchanged native policy-owner test also remains green. Windows/local files only, no Linux fsync/host/Docker/production proof.

Current207 exactf83f CI38956418902attempt1={current['ci207']['status']}/{current['ci207']['conclusion']};208 exact153f CI38953786365attempt1={current['ci208']['status']}/{current['ci208']['conclusion']}. Existing agents observe SAME automatic runs only. Old207audit6218788735 remains FAILED; old208actual-row/receipt equality remains UNKNOWN. No retry/redispatch/PRbody/ready/audit/native/labels/merge. Parent ONE ready/exact-head audit for EACH only after actual COMPLETE green ordinary CI including ALL real Docker steps and independent closed-log review.

Whole filesystem closure and complete fresh host/consumer/Apache/scientific capture launcher remain unfinished. SQL scratch/internal writer journals/WAL growth/original target reader index/candidate TMPDIR/Docker daemon logs+overlay/unit journald/physical metadata remain unclosed. copy-site-closure.json ABSENT; no actual SourceReview/PASS exists to wait for. Normal41/min64 is NOT capacity PASS. Proposed170000capture/150000release roots remain UNCREATED/unreserved; no actual package/host/SSH/Linuxfsync/productionSQL/Docker/cgroup/new qualification/unit/gate/attempt/deployment. KEEP IMPLEMENTING. Current be kit206214209ONLY; future207 custody DRY planned/blocked counts and3nonblockers required. All main merges HOLD actual be deployment+actualCl postcheck.621299+621326 govern; ACK621326only next COMPLETE source review, all native fallbacks cancelled forever. Earlier history unchanged.

'''
prior=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+prior)
changed={name for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}
assert changed=={'README.md'}
lead=f'''LATEST CONCRETE ORDER-IMPACT BOUNDED PIPES /242 LOCAL PASS - {when}.
Same be837974/acc15844 source: order_impact.cjs replaces the old unbounded direct-file wrapper around the SAME exact read-only --dry-run scientific owner.64MiB+1 per original stream plus8192-byte exit/entries/dirs reserved BEFORE tmp mkdir/container creation inside unchanged shared3200MiB; no extra reserve. Bounded reads precede writes; both EOFs/full original hashes/lengths/status/source triple equality required. Overflow retains incomplete prefixes and kills ONLY read-only dry-run child; APPLY transactions/child argv/defaultheap/600clock unchanged. Outer wrapper argv explicitly changed; extra outer directory eliminated; same2 policy copies independently admitted/verified. Parent output closure precedes final-memory/exit permission. Focused31:29PASS2FAIL retained (9-byte fixture expectation and real immutable control hardlink-reader gap); first242PASS26.859s then bounded admission-read review/consumed-name guards; FINAL242PASS26.100s/114sources unchanged. Hook SOURCEONLY neverexecuted; LOCAL binary pipes/stand-in science plus existing exact native policy-owner test, no host claim. New fixture delta references161176188199208212221225234; oldfixturebytesNOTREREAD.
207 SAME automatic CI38956418902attempt1/exactf83f={current['ci207']['status']}/{current['ci207']['conclusion']};208 SAME38953786365attempt1/exact153f={current['ci208']['status']}/{current['ci208']['conclusion']}. Existing agents observe same runs only; no retry/ready/audit/native/merge. Actual old207audit FAILED immutable/208oldrows receipt equality UNKNOWN. ALL main merges HOLD actualbe deployment+actualCl postcheck.
KEEP IMPLEMENTING wholecopy/evidence/filesystem closure AND full executable fresh reviewed host-consumer-Apache-scientific capture launcher. copy-site-closure.json ABSENT/no actual SourceReview or SourcePASS to waitfor. SQLscratch/writerjournals/WALgrowth/originaltargetindex/candidateTMPDIR/daemonDockerlogs+overlay/unitjournald/physicalmetadata STILLUNCLOSED; normal41/min64 NOTcapacityPASS. Proposed170000capture/150000release roots UNCREATED/unreserved/noactualpackage/host/SSH/Linuxfsync/productionSQL/Docker/cgroup/newqualification/unit/gate/attempt/deployment. Currentbekit206214209ONLY/future207custodyDRYplannedblockedcounts+3nonblockersrequired.621299+621326govern/ACK621326ONLYnextCOMPLETEsourceReview/ALLnativefallbacksCANCELLEDforever. SameheartbeatACTIVE2min/restore10ONLYactualmilestone/R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanspreserved. Earlier history unchanged.

'''
save(D,'boundary-record.json',canonical({'publishedUtc':when,'tests':242,'sourceFiles':114,
    'finalRun':v,'READMEOnlyAfter':sorted(changed),'sourceProof':proof,
    'hostCalls':0,'productionSql':0,'globalFilesystemClosure':False,'captureLauncherComplete':False,
    'sourceReviewRequested':False,'mainMergeHold':True,
    'ci207':{'id':38956418902,'status':current['ci207']['status'],'conclusion':current['ci207']['conclusion']},
    'ci208':{'id':38953786365,'status':current['ci208']['status'],'conclusion':current['ci208']['conclusion']}})+b'\n')
extras={p for p in K.iterdir() if p.is_file()}
for dirname in ('local-tests-order-output-focused-first','local-tests-order-output242-first','local-tests-order-output242-final'):
    extras|={p for p in (K/dirname).rglob('*') if p.is_file()}
extras.add(pathlib.Path(__file__).resolve())
print(json.dumps(boundary_publish(D,extras,'feat(release): bound read-only order impact child streams',lead)))
