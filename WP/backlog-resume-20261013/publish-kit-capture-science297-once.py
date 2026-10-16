"""Publish closed LOCAL capture authority/science sequence; no host operator."""
from concurrent.futures import ThreadPoolExecutor
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'capture-science297-publication-once'
R=W/'WP/backlog-resume-20261013/actual207208-source-passes6224662770-6224793665-once'
review=json.loads((R/'independent-verdict-and-deferral-review.json').read_bytes())
assert review['mainMergeHold'] and review['commentsLabelsReadyMergesCreated']==0
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='034549f48a2493a96dffa5c607f8afd1acfc4d59'
assert not git('diff','--cached','--name-only').strip()
runs=['capture-science295-first','capture-science295-second','capture-science297-reviewed'];closed=[]
for label,total,exit_code in zip(runs,[289,297,297],[1,0,0]):
    folder=K/('local-tests-'+label);value=json.loads((folder/'verification.json').read_bytes())
    log=(folder/'stderr-original.txt').read_text(encoding='utf-8')
    assert value['exitCode']==exit_code and value['sourceBefore']==value['sourceAfter'] and len(value['sourceBefore'])==131
    assert ('Ran '+str(total)+' tests in ') in log
    assert log.rstrip().endswith('OK' if exit_code==0 else 'FAILED (errors=1)')
    if exit_code:assert "cannot import name 'CAPTURE_SNAPSHOTS'" in log
    rows=[line.split(' ... ')[0] for line in log.splitlines() if line.startswith('test_') and ' ... ' in line]
    expected=288 if exit_code else 297
    assert len(rows)==expected and len(set(rows))==(295 if label==runs[1] else expected)
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
    actual=[row for row in current[name] if (row.get('performed_via_github_app') or {}).get('id')==1236702]
    if name=='release-comments':assert not actual
    else:
        label='207' if name=='audit207-comments' else '208';expected=review['results'][label]
        assert len(actual)==1 and actual[0]['id']==expected['sourceAuditId']
        assert actual[0]['created_at']==actual[0]['updated_at']==expected['createdAt']
        assert sha(actual[0]['body'].encode())==expected['verdictBodySha256']
        assert sha(current['pr'+label]['body'].encode())==expected['updatedDescriptionSha256']
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
 'capture-owners276-publication-once/new-local-fixtures-hash-inventory.json',
 'capture-copy288-actual-audits-successor-publication-once/new-local-fixtures-hash-inventory.json']
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
NOTES='LOCAL FRESH CAPTURE AUTHORITY / ORDERED PREPARATION / FULL SCIENCE /297 PASS - {when}.\n\nNew kit_capture_authority.py performs the full exact source PASS plus explicit170000capture root/unit/table/filesystem-only/raw-master-never-SQLite/206214preparation/no209APPLY checks before provider dispatch. It fetches a NEW source-only primary provider snapshot, runs every existing standing authority predicate, compares the complete actual source review identity/body with its frozen original and rejects any unknown later actual release direction. Current main/CI/four application audit semantic pins/all standing rules/qualification621299/timing621326/#191closed remain mandatory. The fresh original provider responses use the existing bounded transport, complete pagination and race/deadline refusal. No nonexistent kit or human deployment approval is invented. A durable capture-fresh-authority record binds source/root/unit/table and the full snapshot hash. Single-use in-memory guards prevent re-entry; the still-required complete launcher must independently enforce durable package/dispatch consumption. No release gate/restart/serving/merge authority is supplied.\n\nNew kit_capture_science.py implements the eight-stage CaptureBudget/CaptureDisk sequence. Fresh authority precedes durable science intent and the existing ONCE filesystem snapshot/independent reader+backup/clone provenance. The six typed capture owners run in exact order: kernel-readonly integrity, canonical policy NO_OP,206 APPLY preparation,214 APPLY preparation, actual214chart impact and actual209readonly order impact. Only the NEW detached scientific clone is writable for206/214. No209APPLY/default startup/production SQL/ingress/predecessor operation exists. Every CLI consumes its exact active-stage budget claim before create through CaptureBudgetedCli. Full original stdout is retained unchanged and admitted before writing a separate immutable/fsynced original; each original is bounded16MiB. The existing native pipes still retain complete originals, original600-second clocks/default heap/scientific child argv remain unchanged, and no installer transaction killpoint was added.\n\nEach206/214 preparation has a durable once intent BEFORE its APPLY dispatch; unknown/lost return or failed plan cannot retry or advance. Immediately after successful full original plan validation, a retained full raw/reader/detached-backup seal and delta_from_state verify every original table/column/value/receipt/schema object, exact declared EMPTY new tables, zero backfill and exactly one schema receipt. Expected clone inventories are108tables40receipts after206 and112tables41receipts after214. Prior state comes from the bound snapshot record and prior backups are never reopened SQLite. Both full preparation original and preservation reports are separately retained and later package-required. Every read-only capture owner brackets the complete clone DB/WAL/SHM metadata/hash triple, rechecks clone/snapshot provenance and requires fresh no-writer observations. The concrete capture_no_writers guard uses the unchanged full Docker mount inventory and numeric host descriptor access/inode guard on the retained clone, bracketed by independent clone provenance checks.\n\nAll214 chart contexts/policy settings/affected runs/sequence refusals/counts and all209 causes/refusals/sample IDs/owner IDs remain in the full original and scientific projection.209 primary AND secondary retained snapshot files are independently hashed/length/allocation checked before acceptance. The existing approved-amendment nonzero STOP is unchanged: its complete original list is retained before the refusal, and no final science capture is published. Any read-only triple mutation, old-row change, nonempty new table, extra table, backfill, missing physical stage closure or changed original similarly retains partial originals/intents without a final success. Every stage must close its exact source claims, pre-create admissions and physical-growth allowance; the standalone capture hook remains responsible for independent exact stops in the future full launcher. There is still no actual controller unit or dispatch here.\n\nScientific capture is now version2 with distinct170000capture root and150000releaseRoot, exact capture table hash and both206/214 preparation original/preservation reference pairs. kit_science independently verifies all six originals, complete prepared-schema preservation reports and exact full science projections. kit_package requires the four preparation files and rejects swapped roots/table/invalid preparation even when attacker-supplied reference hashes are recomputed. The existing release source index/manifest still binds the150000 release root. This closes the former source-only package root mismatch; it does NOT create an actual capture receipt, package, approval or deployment.\n\nFrozen first run label capture-science295-first ACTUALLY ran289tests/288PASS+one import ERROR32.744s,131sources unchanged. The test imported CAPTURE_SNAPSHOTS from the wrong module; corrected to its actual kit_capture_owned owner. Production source had no failure reported by that run. A review also closed public first-stage entry before fresh authority. Frozen second label capture-science295-second ACTUALLY ran297executions ALLPASS39.583s,131sources unchanged, but only295unique tests because an imported existing Science TestCase was rediscovered twice. Its original log remains honest, never relabelled297unique. The test import now uses a module alias; review added two meaningful tests for lost preparation return after a real LOCAL native commit and the concrete full-container/numeric-descriptor writer boundary. Final {summary},297UNIQUE tests,131sources unchanged/start{started}/closed{closed}. All three original streams/verification/source-at-test snapshots retained. README only afterward. The final meaningful tests cover full standing primary originals with a SYNTHETIC future source review, native LOCAL106/39 SQLite snapshot/backup/clone/preparation/preservation, exact eight-stage closure, full list retention and negative mutations. Every SQLite connection was traced to exclude live/raw masters. The206/214 science owners are explicit stand-ins using native SQL; no actual application scientific CLI or Docker was executed. The source-added runtime reports expected108/40 and112/41 only from these LOCAL fixtures, NOT production observations. Provider network, Docker, kernel descriptors, physical growth/free-space and Linux all-file/directory fsync are explicitly LOCAL stand-ins. Generated release and capture stop-post hooks were rebuilt SOURCE ONLY, neither executed.\n\nNew fixture hash delta references all161176188199208212221225234242253263276288 inventories; earlier fixture bytes NOT reread. Private LOCAL fixture DB/control bytes withheld. All current source/frozen original app/old-startup bindings remain unchanged and ordinary existing tests pass. There was no host/SSH/Linuxfsync/productionSQL/Docker/cgroup/new qualification/root/unit/gate/attempt/deployment. Proposed170000capture and150000release roots remain UNCREATED/unreserved. Capture17/min64 and release41/min64 remain DECLARED source allowances, neither capacity PASS or whole-filesystem closure.\n\nFresh publication primary reads require mainbe837974/mainCI38772398721SUCCESS/#191closed, same207headf83f+CI38956418902attempt1SUCCESS and208head153f+CI38953786365attempt1SUCCESS. Actual207Cl6224662770 and208Cl6224793665 source audit verdicts, unedited full bodies and the prior bounded description updates remain exact.207ClLOCAL full remains373PASS+one Playwright environment exception, NOT374PASS;208ClLOCAL376PASS remains only after disclosed headless-shell shim.207three nonblockers/future custody DRY counts and208all explicitly deferred items remain. No duplicate descriptions/labels/ready/audit request/ACK/native/issue/follow-up code/merge was created. Both actual source verdicts explicitly KEEP main merge hold until actualbeDEPLOYED and actualClpostcheckPASS. Currentbe kit remains206214209ONLY. Existing207208 agents DONE/idle/no new agents/worktrees.\n\nKEEP ACTUALLY IMPLEMENTING wholecopy/evidence/filesystem closure AND COMPLETE executable fresh reviewed host-consumer-Apache-scientific capture launcher. NEXT integrate consumer two-pass and fresh Apache original/held bytes with complete capture receipt; separate capture controller transport, numeric cgroup controller guard, unit/package/preparer/launcher and independent failure/stop receipts remain required. copy-site-closure.json ABSENT/no actual complete SourceReview/PASS exists to wait for. SQLscratch/internal writer journals/WAL growth/original target RO index/candidateTMPDIR/candidateDockerlogs+daemonoverlay/systemd manager lifecycle+physicaljournald/physicalmetadata remain UNCLOSED. No actual SourceReview request until the complete source exists;621326 ACK ONLY there.621299+621326 govern/ALL native fallbacks CANCELLEDforever/no duplicateACK/GH/native. Same heartbeat ACTIVE2min/restore10ONLYactual deployment+Clpostcheck. R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanfilesdraftscards preserved. Earlier history unchanged.\n\n'
when=utc()
notes=NOTES.format(when=when,summary=test_summary[0],started=v['startedUtc'],closed=v['closedUtc'])
prior=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+prior)
assert {name for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}=={'README.md'}
save(D,'boundary-record.json',canonical({'publishedUtc':when,'tests':297,'uniqueTests':297,'sourceFiles':131,
 'finalRun':v,'priorClosedRuns':closed[:-1],'firstRunFailedImport':True,'secondRunDuplicatedExistingTestCount':2,
 'captureCopyEquivalents':17,'minimumDatabaseEquivalents':64,'captureRootCreated':False,'releaseRootCreated':False,
 'hostCalls':0,'productionSql':0,'globalFilesystemClosure':False,'captureLauncherComplete':False,
 'sourceReviewRequested':False,'mainMergeHold':True,'actualSourceAuditResults':review['results']})+b'\n')
lead='LATEST CONCRETE FRESH CAPTURE AUTHORITY / ORDERED PREPARATION / FULL SCIENCE /297 LOCAL PASS - '+when+'.\n'+notes.split('\n',2)[2]
extras={path for path in K.iterdir() if path.is_file()}
for run in runs:extras|={path for path in (K/('local-tests-'+run)).rglob('*') if path.is_file()}
extras.add(pathlib.Path(__file__).resolve())
print(json.dumps(boundary_publish(D,extras,'feat(release): sequence fresh capture authority and detached scientific preparation',lead)))
