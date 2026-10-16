"""Publish closed LOCAL source results. Never a host/capture/release operator."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'live-backup-journal225-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='125d8afd6b5451ddb4e1ae94d70e9f0939c11f85'
assert not git('diff','--cached','--name-only').strip()
run=K/'local-tests-live-backup-journal225-final'
v=json.loads((run/'verification.json').read_bytes());log=(run/'stderr-original.txt').read_bytes()
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==107
assert b'Ran 225 tests in ' in log and log.rstrip().endswith(b'OK')
assert all(sha((K/name).read_bytes())==digest for name,digest in v['sourceBefore'].items())
assert not (K/'copy-site-closure.json').exists() and not list(K.glob('release-package-*'))
proof=json.loads((K/'live-backup-sqlite-source.json').read_bytes())
assert proof['maximumJournalBytes']==131072 and len(proof['files'])==9 and proof['filesystemClosureClaimed'] is False
E=pathlib.Path('C:/Users/yigin/AppData/Local/Temp/soilfer-issue208-comparator-full-o776za/evidence')
closure=(E/'closed-evidence-sha256.json').read_bytes()
assert sha(closure)=='54496e3e4a8fa09c927ebbc1e19ab3d2ee66653e2901d8c188668fe2d4b522ce'
agent_files={'closed-evidence-sha256.json':closure}
for row in json.loads(closure):
    raw=(E/row['path']).read_bytes();assert sha(raw)==row['sha256'] and len(raw)==row['bytes'];agent_files[row['path']]=raw
parent=(E/'parent-closed-review-1917-once.json').read_bytes()
assert sha(parent)=='7f50f8f027a7d5654919d4dfbd0b58c62c40d789692cf1a3fe403e6322fa602e'
agent_files['parent-closed-review.json']=parent
report=json.loads(agent_files['final-comparator-full-report.json'])
assert report['server']['suites']==376 and report['server']['tests']==5761 and report['server']['exitCode']==0
D.mkdir()
endpoints={
    'main':'repos/yigini/soilfer-lims/git/ref/heads/main',
    'main-ci':'repos/yigini/soilfer-lims/actions/runs/38772398721',
    'issue191':'repos/yigini/soilfer-lims/issues/191',
    'pr207':'repos/yigini/soilfer-lims/pulls/300','pr208':'repos/yigini/soilfer-lims/pulls/299',
    'new-ci208':'repos/yigini/soilfer-lims/actions/runs/38953786365',
    'release-comments':'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T18%3A59%3A31Z&per_page=100',
    'audit207':'repos/yigini/soilfer-lims/issues/comments/6218788735'}
current={}
for name,endpoint in endpoints.items():
    raw=subprocess.check_output(['gh','api',endpoint],cwd=W);save(D,'api-'+name+'-original.json',raw);current[name]=json.loads(raw)
assert current['main']['object']['sha']==current['main-ci']['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
assert current['main-ci']['status']=='completed' and current['main-ci']['conclusion']=='success'
assert current['issue191']['state']=='closed'
assert current['pr207']['head']['sha']=='ad9d2660041c4db380d73a759871987d625f7404'
assert current['pr208']['head']['sha']==current['new-ci208']['head_sha']=='153f10e6bac02b1a962213431141fd1c54906e99'
assert current['new-ci208']['run_attempt']==1 and current['new-ci208']['event']=='pull_request'
assert current['audit207']['created_at']==current['audit207']['updated_at']=='2026-10-16T15:25:42Z'
assert sha(current['audit207']['body'].encode())=='0d7f5742628798c07f78df01728c40d98e1d825b450b9096f71bc75194fe8f73'
assert len(current['release-comments'])<100
assert not [c for c in current['release-comments'] if (c.get('performed_via_github_app') or {}).get('id')==1236702], 'Read full actual new direction before proceeding'
for name,raw in agent_files.items():save(D,'issue208-'+name,raw)
prior_paths=[K/'shared-evidence161-publication-once/all-local-fixtures-hash-inventory.json',
    K/'emergency-http176-inventory-successor-publication-once/new-local-fixtures-hash-inventory.json',
    K/'prestart188-fixed-envelopes-publication-once/new-local-fixtures-hash-inventory.json',
    K/'apache199-copy-prewrite-publication-once/new-local-fixtures-hash-inventory.json',
    K/'copy-admissions208-publication-once/new-local-fixtures-hash-inventory.json',
    K/'seal-sqlite212-exact-verdict-successor-publication-once/new-local-fixtures-hash-inventory.json',
    K/'reader-live-backup221-publication-once/new-local-fixtures-hash-inventory.json']
known=set();refs=[]
for path in prior_paths:
    raw=path.read_bytes();known.update(row['path'] for row in json.loads(raw)['fixtures'])
    refs.append({'path':path.relative_to(W).as_posix(),'sha256':sha(raw),'gitBlobOid':oid(raw)})
fixtures=[]
for directory in sorted(K.glob('*-local-retained-fixtures')):
    for path in sorted(directory.rglob('*')):
        if not path.is_file() or path.relative_to(K).as_posix() in known:continue
        raw=path.read_bytes();s=path.stat()
        fixtures.append({'path':path.relative_to(K).as_posix(),'bytes':len(raw),'sha256':sha(raw),
            'localModeObserved':s.st_mode&0o777,'localLinksObserved':s.st_nlink})
save(D,'new-local-fixtures-hash-inventory.json',canonical({'fixtures':fixtures,'priorInventories':refs,
    'priorFixtureFilesNotReread':True,'newFixtureBytesPublic':False,'privateHostBytesFetched':0,'productionBytes':0})+b'\n')
save(D,'local-observations-derived.json',canonical({
    'primaryDependencyVerification':'Tool-output provenance only: primary npm tarball SHA512 matched actual be837974 package lock; nine listed source/build files matched installed bytes. Tarball bytes were read only in memory, not retained as an original archive.',
    'firstFocused':'8 tests:7 PASS1 test assertion FAIL because65536-byte page fixture completed in one256-page transfer. Original focused files/logs retained; no source changed during run.',
    'secondFocused':'8 PASS2.803s; smaller test-only transfer batches and32MiB512-byte-page fixture exercise multiple transfers/cache spills.',
    'firstFull':'224 PASS28.004s/107 source files unchanged. A further meaningful real after-spill failure/retention test was then added.',
    'finalFull':'225 PASS/107 source files unchanged; no host/production calls. Exact timing in original verification/log.',
    'journalProgressObservations':'512-byte page32MiB payload:8257 samples/max1024B;4096-byte page8MiB:257/max512B;65536-byte page8MiB:17/max512B. These are LOCAL samples, not continuous peak or production measurements.',
    'readOnlyInspectionOutputRefusal':'One parent inspection printed a Unicode native test tick under cp1252 and refused stdout; no source/evidence mutation. UTF8 successor read the full original.',
    'linuxDirectoryFsyncTested':False,'hostCalls':0,'productionSql':0})+b'\n')
notes='''LOCAL EMPTY-DESTINATION SQLITE BACKUP JOURNAL /225 PASS - 2026-10-16.

The two live-backup CLI admissions now hold BOTH main content and131072 journal bytes plus both file-entry/inode allowances BEFORE tmp directory/container creation. The held25percent DB envelope is unchanged; maximum main bytes decrease to make room for the journal. Canonical version2 admissions require the exact journal limit and explicitly do not claim global filesystem closure.

The new live-backup-sqlite-source.json pins nine files from the actual be837974 better-sqlite3 12.6.2 lock dependency: full primary npm tarball SHA512 checked against the lock, each listed source/build file byte-identical locally. The runtime checks all nine exact hashes/lengths before source access and checks native sqlite_version()/sqlite_source_id() before output creation. Its new destination handle receives an exclusively precreated zero-byte regular file; main/journal/WAL/SHM names must all be unused. No destination SQL statement, savepoint, attached DB, extension or custom VFS occurs. The descriptor stays held through backup and final identity is checked. Source journal settings/installer behavior are unchanged.

The pinned pager starts dbOrigSize0, so positive backup page numbers create no old-page rollback records. It writes one initial sector header; a first cache spill may append a second while clearing NEED_SYNC and entering WRITER_DBMOD. Later new pages do not set that flag, later spills cannot append another, and commit uses newHdr0/null super-journal. The source clamps sector size to65536; two headers reserve131072. Source excerpts and the full derivation/preconditions are in the new JSON and require exact review, not a universal bound for other SQLite uses. Successful backup must leave no journal/WAL/SHM; failure never retries. A real LOCAL after-cache-spill refusal retains its consumed zero-byte destination and preserves source main/WAL bytes.

Real LOCAL512/4096/65536-byte page backups retained full rows/integrity/exact lengths. A32MiB512-byte-page fixture observed1024B journal over8257 progress samples; these are samples, not continuous peak or production proof. The first focused run had7PASS1 fixture-assumption FAIL (large page copy completed in one transfer), then8PASS2.803s. Frozen224PASS28.004s preceded the additional real failure test; final225PASS has107 source files unchanged. All originals retained. Standalone hook rebuilt SOURCE ONLY, never executed. New fixture hashes reference prior inventories; old fixture bytes were not reread.

208 corrected frozen ordinary LOCAL full closed19:11:38.8809970Z exit0:376suites5761tests PASS13327.782s. Parent read the complete2-file comparator patch and independently verified17 closure files, exact376 PASS inventory, literal summary,4932 mapped source/fixture/runtime hashes, frozen/current read-only index, exact2 stage paths/raw-vs-CRLF-only and unchanged approved180 owner/loader/DDL. Sole stock generated help manifest before/after bytes retained, then restored only after closure. Parent reviewSHA7f50f8f027a7d5654919d4dfbd0b58c62c40d789692cf1a3fe403e6322fa602e. ONE correction commit/push ACTUALLY completed153f10e6bac02b1a962213431141fd1c54906e99/tree34f6d9be9c00b2fd923989e4d4291a06ec333e32. ONE new automatic ordinary CI38953786365attempt1 is observed only; current original API retained. Old38915551182+38898578537 remain immutable FAILED; discarded original row/receipt equality remains unknown. No new ready/audit/native/merge.

207 SAME frozen ordinary374-suite LOCAL full from18:50:30.444Z remains ACTIVE at latest actual19:16:57Z report38PASS0FAIL. No source edits/extra runs/stage/commit/push/newCI/PR publication/ready/audit/native/merge until parent closed review. Actual ad9d audit6218788735 remains FAILED; old green CI cannot override it. Current release kit remains206/214/209 ONLY; future207 kit needs custody DRY planned/blocked counts.

KEEP IMPLEMENTING application TMPDIR/nested reader/snapshot/journal/WAL growth, Docker daemon logs/overlay, unit journal and physical metadata closure AND the complete executable fresh reviewed host/consumer/Apache/scientific capture launcher. copy-site-closure.json remains ABSENT, normal41/min64 is not capacity PASS, no actual SourceReview/PASS exists to wait for. Proposed170000 capture and150000 release roots remain uncreated/unreserved/no package/host/SSH/Linuxfsync/productionSQL/Docker/cgroup/new qualification/unit/gate/attempt/deployment. ALL main merges HOLD actual be deployment plus actual Claudio postcheck.621299+621326 govern; ACK621326 only next COMPLETE source review/all native fallbacks cancelled forever. Older history follows unchanged.

'''
prior=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+prior)
changed={name:{'testedSha256':digest,'currentSha256':sha((K/name).read_bytes())} for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}
assert set(changed)=={'README.md'}
when=utc()
lead=f'''LATEST CONCRETE EMPTY-DESTINATION SQLITE JOURNAL /225 LOCAL PASS +208 CORRECTION PUSH - {when}.
SAME be837974/acc15844 kit225LOCALtestsPASS/107sourcesunchanged/READMEonlyafter. Live-backup version2 admissions hold main+131072B journal+both entry/inode allowances BEFOREtmpmkdir/containercreate within unchanged25percent envelope. Nine exact dependency/build sources and native SQLite3.51.2/sourceID pinned; new0Bdestination/no existingsidecars/one nativebackup transaction bounds at most two65536B sector headers. Full source derivation/excerpts in live-backup-sqlite-source.json; no destination SQL/savepoint/attach/extension/customVFS. Held descriptor identity/full snapshot lengths/no final sidecars. RealLOCAL page512/4096/65536 backups+after-cache-spill refusal/retained destination/source-main-WAL preservation PASS; sampled journal maxima1024/512/512 NOTcontinuous peak. Initial focused7PASS1 fixture FAIL retained; corrected8PASS; frozen224PASS then additional real failure test/final225PASS. HookSOURCEONLYneverexecuted/newfixturehashdelta/oldfixturebytesNOTREREAD.
208 SAME frozen ordinary full CLOSED19:11:38.8809970Z exit0/376suites5761testsPASS13327.782s. Parent complete patch review+17files+4932 mappedsourcefixture/runtimehashes+exact376 inventory/index/stage/ownerloaderDDLverified; sole generated help output retained/restored AFTERclosure. ONE authorized2-file correction PUSHED153f10e6bac02b1a962213431141fd1c54906e99/tree34f6d9be9c00b2fd923989e4d4291a06ec333e32. ONE ordinary automaticCI38953786365attempt1 actual status={current['new-ci208']['status']}/{current['new-ci208']['conclusion']}; observe same only/no retry. Both original failed CI immutable/actual oldrowpayload equality UNKNOWN/no retrospective PASS. No ready/audit/native/merge.207 SAME frozen374LOCALfull ACTIVE/latest19:16:57Z38PASS0FAIL/no sourceedits/extra runs/stage/commitpushnewCI/PRpublication/ready/audit/native/merge untilparentclosedreview; actualad9d audit6218788735 FAILED unchanged.
KEEP ACTUALLY IMPLEMENT full wholecopy/evidence/filesystemclosure+complete fresh reviewed host-consumer-Apache-scientific capture launcher; applicationTMPDIR/nested snapshots/internaljournalWALgrowth/daemonDockerlogs+overlay/unitjournald/physicalmetadata STILLUNCLOSED. copy-site-closure.json ABSENT/normal41min64 NOTcapacityPASS/noSourceReview or SourcePASS to waitfor. Proposed170000capture+150000release rootsUNCREATED/unreserved/no package/host/SSH/Linuxfsync/productionSQL/Docker/cgroup/newqualification/unit/gate/attempt/deployment. Currentbekit206214209ONLY/future207custodyDRYplannedblockedcounts required. ALLmainmergesHOLD actualbeDEPLOYED+actualClpostcheckPASS. SameheartbeatACTIVE2min/restore10ONLYactualmilestone.621299+621326govern/ACK621326ONLYnextCOMPLETEkitSourceReview/ALLnativefallbacksCANCELLEDforever/no duplicates. R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanspreserved. Earlierhistoryunchanged.

'''
save(D,'boundary-record.json',canonical({'publishedUtc':when,'tests':225,'sources':107,'finalRun':json.loads((run/'verification.json').read_bytes()),
    'READMEOnlyAfter':changed,'normalDatabaseEquivalents':41,'capacityPass':False,'globalFilesystemClosure':False,
    'captureLauncherComplete':False,'sourceReviewRequested':False,'hostCalls':0,'productionSql':0,'remotePackage':False,
    'root':False,'unit':False,'gate':False,'deployment':False,'issue208ParentReviewSha256':sha(parent),
    'issue208NewHead':current['pr208']['head']['sha'],'issue208NewCi':current['new-ci208']['id'],
    'issue208NewCiStatus':current['new-ci208']['status'],'issue208NewCiConclusion':current['new-ci208']['conclusion'],
    'issue207LatestActualFullStatus':'ACTIVE','mainMergeHold':True})+b'\n')
extras={p for p in K.iterdir() if p.is_file()}
for dirname in ['local-tests-live-backup-journal-focused-first','local-tests-live-backup-journal-focused-second',
                'local-tests-live-backup-journal224-first','local-tests-live-backup-journal225-final']:
    extras|={p for p in (K/dirname).rglob('*') if p.is_file()}
extras.add(pathlib.Path(__file__).resolve())
print(json.dumps(boundary_publish(D,extras,'feat(release): reserve empty backup journals and pin SQLite source',lead)))
