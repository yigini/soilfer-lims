"""Publish closed LOCAL source tests only. Never a capture or release operator."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'reader-live-backup221-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='f76aeb95564edb6f382da1a2e7ffd6e5c2de70b5'
assert not git('diff','--cached','--name-only').strip()
run=K/'local-tests-reader-index-live-backup221-first'
v=json.loads((run/'verification.json').read_bytes());log=(run/'stderr-original.txt').read_bytes()
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==106
assert b'Ran 221 tests in 27.632s' in log and log.rstrip().endswith(b'OK')
assert all(sha((K/name).read_bytes())==digest for name,digest in v['sourceBefore'].items())
assert not (K/'copy-site-closure.json').exists() and not list(K.glob('release-package-*'))
agent=pathlib.Path('C:/Users/yigin/AppData/Local/Temp/soilfer-207-verify-af36ba07-768c-4bb9-8aa6-79263be8c197')
review_raw=(agent/'audit-6218788735-local-review.json').read_bytes()
assert sha(review_raw)=='95097f18fb7c92de269484d64d2758a81dd51f62bf02b385bb801adafcb507b0'
review=json.loads(review_raw);agent_files={'local-review.json':review_raw}
for key,item in review['files'].items():
    raw=pathlib.Path(item['path']).read_bytes();assert sha(raw)==item['sha256'];agent_files[pathlib.Path(item['path']).name]=raw
for name,digest in [('inputs-audit-6218788735-full-1.json','ab972e52dd03cc0051a0ee51c4477431743219d9aba6ec30a96597493c3697d7'),
    ('audit-6218788735-full-1-inventory-before.json','e8531cebd45778e29e8be59271889f79c45418b094177f399dc298235d2385f7')]:
    raw=(agent/name).read_bytes();assert sha(raw)==digest;agent_files[name]=raw
start=(agent/'audit-6218788735-full-1-start.json').read_bytes();started=json.loads(start)
assert started['startedAt']=='2026-10-16T18:50:30.444Z' and started['pid']==25440
assert started['sourceHead']=='ad9d2660041c4db380d73a759871987d625f7404'
agent_files['full-start.json']=start
endpoints={
    'main':'repos/yigini/soilfer-lims/git/ref/heads/main',
    'main-ci':'repos/yigini/soilfer-lims/actions/runs/38772398721',
    'issue191':'repos/yigini/soilfer-lims/issues/191',
    'pr207':'repos/yigini/soilfer-lims/pulls/300','pr208':'repos/yigini/soilfer-lims/pulls/299',
    'release-comments':'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T15%3A35%3A33Z&per_page=100',
    'audit207':'repos/yigini/soilfer-lims/issues/comments/6218788735'}
captures={name:subprocess.check_output(['gh','api',endpoint],cwd=W) for name,endpoint in endpoints.items()}
current={name:json.loads(raw) for name,raw in captures.items()}
assert current['main']['object']['sha']==current['main-ci']['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
assert current['main-ci']['status']=='completed' and current['main-ci']['conclusion']=='success'
assert current['issue191']['state']=='closed'
assert current['pr207']['head']['sha']=='ad9d2660041c4db380d73a759871987d625f7404'
assert current['pr208']['head']['sha']=='72adbe43b36319e6f9d8088baa61b0fbe26bb3ff'
assert current['audit207']['created_at']==current['audit207']['updated_at']=='2026-10-16T15:25:42Z'
assert sha(current['audit207']['body'].encode())=='0d7f5742628798c07f78df01728c40d98e1d825b450b9096f71bc75194fe8f73'
assert not [c for c in current['release-comments'] if (c.get('performed_via_github_app') or {}).get('id')==1236702], 'Read full new actual release direction before publication'
D.mkdir()
for name,raw in captures.items():save(D,'api-'+name+'-original.json',raw)
for name,raw in agent_files.items():save(D,'issue207-'+name,raw)
prior_paths=[K/'shared-evidence161-publication-once/all-local-fixtures-hash-inventory.json',
    K/'emergency-http176-inventory-successor-publication-once/new-local-fixtures-hash-inventory.json',
    K/'prestart188-fixed-envelopes-publication-once/new-local-fixtures-hash-inventory.json',
    K/'apache199-copy-prewrite-publication-once/new-local-fixtures-hash-inventory.json',
    K/'copy-admissions208-publication-once/new-local-fixtures-hash-inventory.json',
    K/'seal-sqlite212-exact-verdict-successor-publication-once/new-local-fixtures-hash-inventory.json']
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
save(D,'exploratory-results-derived.json',canonical({
    'recordKind':'TOOL_OUTPUT_TRANSCRIPTION_NOT_ORIGINAL_COMMAND_LOG',
    'readerFocusedFirst':'38 tests:37PASS1 stale expected214/209 budget FAIL; corrected8/11 then38PASS1.396s',
    'exclusiveReadOnlyProbe':'exclusive-yxzx_do7 refused disk I/O; all original bytes unchanged; abandoned, no production locking change',
    'combinedFocusedFirst':'58 tests:56PASS2ERROR: completion ledger required existing parent; one requested nonexistent verify_kit_launch module',
    'combinedFocusedSecond':'58 tests:54PASS4FAIL from intentionally stale generated standalone-hook source; rebuilt SOURCE ONLY before final full run',
    'full':'221PASS27.632s/106 sources unchanged; real LOCAL Node24.13/synthetic SQLite/stand-ins only',
    'linuxDirectoryFsyncTested':False,'hostCalls':0,'productionSql':0})+b'\n')
notes='''LOCAL READER WAL-INDEX / LIVE-BACKUP CONTENT ADMISSION /221 PASS - 2026-10-16.

Every ordinary read-only owned reader reserves its possible WAL-index BEFORE the first SQL open: conservative minimum512-byte pages plus24-byte frame headers,32KiB for the first4062 frames and every later4096, or a larger copied SHM rounded upward. Both possible SHM/zero-WAL entries are charged. Each of four source sites consumes one additional DB-equivalent; normal41/min64 remains a declared model, NOT capacity PASS or whole-filesystem closure. Main and WAL bytes are checked after each owned read, SHM must remain within the admitted bound and an unexpected rollback journal refuses. No immutable WAL bypass or production locking change. The exploratory LOCAL exclusive read-only probe refused disk I/O and was abandoned; all originals stayed unchanged.

The two live-backup CLIs now consume a single-spend output-file admission before their temporary directory/container creation. An immutable canonical limit file binds the held content+entry maximum. The child establishes an ordinary read-only transaction by reading sqlite_schema, pins page_count/page_size, and refuses an oversized snapshot BEFORE exclusive output creation. A real LOCAL WAL test advances a separate writer by3MiB after snapshot pinning; the backup retains the earlier row and exact earlier page length. Failed output stays retained, native better-sqlite3 deletion is prevented by exclusive precreation, sealing reads at most expected length+one byte, and exact descriptor/path/length guards precede chmod/fsync. Production source journal settings and installer transactions are unchanged. SQLite internal destination journals, application TMPDIR, daemon/unit journal output and physical filesystem metadata remain unclosed; this content admission does not claim their bounds. Primary references: https://www.sqlite.org/backup.html and https://www.sqlite.org/c3ref/backup_finish.html ; WAL-index layout https://www.sqlite.org/walformat.html .

The evidence ledger now permits admission of one exact unused direct parent before mkdir; existing alias/depth/root/category and shared-pool guards remain. Exhausted completion allowance refuses before creating that directory. Earlier exploratory tool-only failures are described in exploratory-results-derived.json. The final frozen221 tests PASS27.632s with106 top-level source hashes unchanged. Standalone hook rebuilt SOURCE ONLY/never executed. Only README explanation follows this run; new fixture hashes form a delta and old fixture bytes were not reread.

207 parent completed concrete16-file review, independently checked all9 referenced evidence hashes/16 inputs/exact patch paths/literal5 suites176 tests/HEAD/staged-empty, and authorized ONE ordinary frozen374-suite LOCAL full run only. It actually started18:50:30.444Z in the existing visible fixture:2441 mapped source/build+21 generated inputs, default heap/stock setups/single worker. Source stays frozen; no final result inferred. Earlier path-provisioning refusal ran no tests. Focused JSX lint6errors16warnings exactly matches untouched ad9d; no unrelated fixes or weakened rules. No commit/push/new CI/PR publication/ready/audit/merge is authorized before parent closed review. Actual audit6218788735 remains FAILED on ad9d. 208 same frozen376-suite run from15:29:27.4082281Z remains ACTIVE at its latest actual agent report:67PASS suite headers/0FAIL, no closure file; a polling timeout resumed observation of the same session, never restarted tests. Old CI failures remain immutable.

KEEP IMPLEMENTING full copy/evidence/filesystem closure and complete executable fresh reviewed host/consumer/Apache/scientific capture launcher. copy-site-closure.json is ABSENT, no actual SourceReview/PASS exists to wait for, proposed capture170000/release150000 roots uncreated/unreserved/no package/host/unit/gate/attempt/deployment. Current be kit deploys206/214/209 ONLY; later207 custody kit still requires DRY planned/blocked counts. ALL main merges hold actual be deployment plus Claudio postcheck.621299+621326 govern; ACK621326 only next COMPLETE source review/all native fallbacks cancelled forever. Older history follows unchanged.

'''
prior=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+prior)
changed={name:{'testedSha256':digest,'currentSha256':sha((K/name).read_bytes())} for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}
assert set(changed)=={'README.md'}
when=utc()
lead=f'''LATEST CONCRETE READER WAL-INDEX / LIVE-BACKUP CONTENT ADMISSION /221 LOCAL PASS - {when}.
SAME be837974/acc15844 kit221LOCALtestsPASS27.632s/106sourcesunchanged/READMEonlyafter. Four reader-index sites reserve conservative SHM growth BEFORE SQL, verify main/WAL bytes/index bound/absent journal afterward; normal41/min64 NOTcapacityPASS. Two live-backup CLI outputs now consume pre-create content+entry admissions/immutable limits; source read snapshot/page layout pinned BEFORE exclusive destination creation, oversized snapshots refuse before output, failed outputs retained, bounded expected-length-plus-one sealing. RealLOCALWAL concurrent-source-growth snapshot PASS. SQLite internal backup journals/applicationTMPDIR/daemon/unitjournal/physicalfilesystem closure STILLMISSING. Completion evidence reserves one exact unused parent BEFOREmkdir. StandalonehookSOURCEONLYneverexecuted/newfixturedelta/oldfixturebytesNOTREREAD. Exploratory focused ledger/stale-generated-hook failures retained as TOOL-ONLY transcription; final221PASS.
KEEP ACTUALLY IMPLEMENTING complete wholecopy/evidence/filesystem closure and executable fresh reviewed host-consumer-Apache-scientific capture launcher. copy-site-closure.json ABSENT/no SourceReview/PASS to waitfor/proposed170000capture+150000release rootsUNCREATED/unreserved/no package/host/SSH/Linuxfsync/productionSQL/Docker/cgroup/newqualification/unit/gate/attempt/deployment.
207 actualCl6218788735 remainsFAILED/ad9d unchanged. All4correctionsLOCAL16files/focused5suites176PASS177.847s/JSX+5localesPASS; lint6errors16warnings identicalbaseline. Parentconcrete review+9hashes+16inputs+exact16patchpaths+literal5/176+HEAD/stagedEMPTY verified. ONE ordinary frozen374-suiteLOCALfull ACTUALLYstarted18:50:30.444Z/rootsoilfer-207-verify-af36ba07-768c-4bb9-8aa6-79263be8c197/app/2441mapped+21generated, ACTIVE/no result inferred. 208 SAME frozen376full ACTIVE from15:29:27.4082281Z/rootsoilfer-issue208-comparator-full-o776za/latestactual67PASS0FAIL/no closure; pollingtimeout didNOTrestart tests. No sourceedits/extra runs/stage/commitpush/newCI/PRedit/ready/audit/native/merge untilparentclosedreviews. Later207kitDRYplannedblocked counts required/currentbekit206214209ONLY. ALLmainmergesHOLD actualbeDEPLOYED+actualClpostcheckPASS. SameheartbeatACTIVE2min/restore10ONLYactualmilestone.621299+621326govern/ACK621326ONLYnextCOMPLETEkitSourceReview/ALLnativefallbacksCANCELLEDforever/no duplicates. R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanspreserved. Earlierhistoryunchanged.

'''
save(D,'boundary-record.json',canonical({'publishedUtc':when,'tests':221,'sources':106,'seconds':27.632,
    'sourceUnchangedDuringRun':True,'READMEOnlyAfter':changed,'normalDatabaseEquivalents':41,'capacityPass':False,
    'globalFilesystemClosure':False,'captureLauncherComplete':False,'sourceReviewRequested':False,
    'hostCalls':0,'productionSql':0,'remotePackage':False,'root':False,'unit':False,'gate':False,'deployment':False,
    'issue207FullStatusAtLatestActualObservation':'ACTIVE','issue208FullStatusAtLatestActualObservation':'ACTIVE',
    'mainMergeHold':True})+b'\n')
extras={p for p in K.iterdir() if p.is_file()}|{p for p in run.rglob('*') if p.is_file()}
extras.add(pathlib.Path(__file__).resolve())
print(json.dumps(boundary_publish(D,extras,'feat(release): admit reader WAL indexes and live backup output before creation',lead)))
