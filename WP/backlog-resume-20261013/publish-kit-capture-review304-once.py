"""Publish closed LOCAL capture authority/science sequence; no host operator."""
from concurrent.futures import ThreadPoolExecutor
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'capture-review304-publication-once'
R=W/'WP/backlog-resume-20261013/actual207208-source-passes6224662770-6224793665-once'
review=json.loads((R/'independent-verdict-and-deferral-review.json').read_bytes())
assert review['mainMergeHold'] and review['commentsLabelsReadyMergesCreated']==0
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='87a21feda4d1e3dd11cb56f4c9df4bd26e905975'
assert not git('diff','--cached','--name-only').strip()
runs=['capture-review304-first','capture-review304-reviewed','capture-review304-final-originals','capture-review304-final-json-types'];closed=[]
for label,total,exit_code in zip(runs,[304,304,304,304],[1,0,0,0]):
    folder=K/('local-tests-'+label);value=json.loads((folder/'verification.json').read_bytes())
    log=(folder/'stderr-original.txt').read_text(encoding='utf-8')
    assert value['exitCode']==exit_code and value['sourceBefore']==value['sourceAfter'] and len(value['sourceBefore'])==133
    assert ('Ran '+str(total)+' tests in ') in log
    assert log.rstrip().endswith('OK' if exit_code==0 else 'FAILED (errors=1)')
    if exit_code:assert "NameError: name 'files' is not defined" in log
    rows=[line.split(' ... ')[0] for line in log.splitlines() if line.startswith('test_') and ' ... ' in line]
    expected=304
    assert len(rows)==expected and len(set(rows))==expected
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
 'release-comments':'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T21%3A44%3A59Z&per_page=100',
 'audit207-comments':'repos/yigini/soilfer-lims/issues/300/comments?since=2026-10-16T20%3A23%3A55Z&per_page=100',
 'audit208-comments':'repos/yigini/soilfer-lims/issues/299/comments?since=2026-10-16T20%3A03%3A51Z&per_page=100'}
D.mkdir()
def fetch(item):
    name,endpoint=item
    raw=subprocess.check_output(['gh','api',endpoint],cwd=W)
    save(D,'api-'+name+'-original.json',raw)
    return name,raw
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
 'capture-copy288-actual-audits-successor-publication-once/new-local-fixtures-hash-inventory.json',
 'capture-science297-publication-once/new-local-fixtures-hash-inventory.json']
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
NOTES='LATEST CONCRETE CONSUMER / APACHE / COMPLETE CAPTURE CONTENT RECEIPT /304 LOCAL PASS - {when}.\n\nSAME be837974/acc15844 kit has304 UNIQUE LOCAL tests PASS: {summary}; started {started}, closed {closed};133 source files unchanged throughout the frozen final run, README only afterward. All four full-run original streams, verification records and source-at-test copies are retained. First frozen304 had303PASS+one NameError49.234s from a boolean-physical negative block accidentally placed in the new lost-return test; ONLY that test block was moved before the second304PASS48.810s. Subsequent source review added required integrity+canonical-policy originals and their semantic checks; third304PASS followed. Final review added exact canonical-JSON comparison for stage closures/integrity so Python True==1/False==0 cannot admit boolean claim counts or FK counts; the explicit recomputed boolean-copy-claim guard passes in the final run. Earlier focused tool-output observations are explicitly transcriptions, not independently retained child original files:18 executions/15PASS+3 import errors0.008s (new import cycle);45/41PASS+4ERROR31.187s (LOCAL path projection+stale package capture pins);21/20PASS+1ERROR18.641s (malformed tamper fixture);28PASS18.437s. Fixes use lazy package writer import, explicit LOCAL POSIX path projection, full updated capture pins, and a well-shaped changed-main fixture. Two apply-patch context refusals and one duplicate-target patch refusal made NO edits; all are tool-only preparation observations.\n\nNEW kit_capture_review.py composes fresh full primary authority, filesystem-only production handoff, NEW detached clone206/214 preparation, ALL original214/209 science, complete two-pass consumer collection and original/held Apache bytes. Apache runs INSIDE first active budget stage with its existing8MiB declaration; consumers run INSIDE final stage after all six owners have closed. The exact running170000 capture unit must appear in BOTH passes; only its exact capture_controller_output.py and nonignored capture_stop_post.py are classified, while all process commands remain for later kit review. Both release and capture unit classifiers now refuse manual lifecycle refusal settings. Unknown definitions, hooks, actions, drift, missing full passes or consumer verdict fabrication STOP; NO actual absence/review assertion is manufactured.\n\nThe original stable Apache bytes are now admitted and retained BEFORE the supported-profile rendering predicate: unsupported input retains consumed intent+full original, no held file/receipt/production snapshot. Full metadata/xattrs/unchanged source and complete original/held binding remain. Rendering is NOT syntax/serving proof. CaptureAuthority separately retains bounded complete primary snapshot bytes BEFORE standing predicates; its original is independent immutable nlink1, not an8192B control pair. All fresh standing rules, full review identity/body equality and later-direction refusals are independently rerun by receipt verification.\n\nComplete capture CONTENT receipt v2 binds19 required original/reference files, source/root/unit/head/image/table, ALL six owner originals plus both full preparation preservation reports, full consumer inventory, Apache originals, snapshot/clone provenance and all eight physical stage closures plus final post-content physical observation. Stage verifier independently reconstructs CaptureBudget from exact inputs, all claims/admissions/order, full disjoint allocation/free/device samples, unchanged500MB unexplained-growth predicate, per-stage remaining reserves, measured growth and bounds. Final science/consumer/content growth is checked against the existing last-stage allowance. No last-write measurement or whole filesystem closure is invented. Package now REQUIRES every content reference and independently rechecks full semantic predicates, including swapped roots/table, malicious recomputed hashes, primary main changes, missing stage/original, bool physical values, bad clone origin, consumer drift and Apache installation assertion. Lost receipt return AFTER actual LOCAL immutable write cannot resume or redispatch.\n\nThis remains a SOURCE component, NOT the complete executable capture launcher: separate silent capture controller transport, numeric cgroup controller guard, unit/package/preparer/launcher and independent failure-stop outcome receipt STILL REQUIRED. The exact unit classifier pins proposed transport source that is NOT YET implemented, so no actual approved operational graph exists. Both hooks rebuilt SOURCE ONLY, NEITHER executed. Native LOCAL Python SQLite/new Apache files/copies/admissions/semantic package checks are real; application scientific CLIs, provider network, Docker/kernel, hardware/du/free-space and Linux durability are explicitly stand-ins.10639/10840/11241 are LOCAL fixtures ONLY, not fresh production observations.\n\ncopy-site-closure.json ABSENT; SQL scratch/internal writer journals/WAL growth/original-target RO index/candidate TMPDIR/candidate Docker logs+daemon overlay/systemd manager lifecycle+physical journald/physical metadata STILL UNCLOSED. Capture17/min64 and release41/min64 are NOT capacity PASS or whole-filesystem closure. No actual source-review request/PASS to wait for. KEEP implementing remaining closure AND the complete fresh reviewed capture launcher. Proposed170000 capture/150000 release roots UNCREATED/unreserved; no actual package, host/SSH/Linuxfsync/production SQL/Docker/cgroup/new qualification/unit/gate/attempt/deployment.\n\nFresh publication primary reads retain all API originals before predicates and independently confirm mainbe/CI38772398721SUCCESS/#191closed,207f83f/CI38956418902SUCCESS3745716,208153f/CI38953786365SUCCESS3765761 and unchanged actual audits6224662770/6224793665/full description hashes.207 Claudio LOCAL full is373PASS+one Playwright environment exception, NOT374PASS.208 Claudio LOCAL376PASS followed disclosed headless-shell shim; physical printer acceptance remains pending. All207 nonblockers/future DRY counts and208 explicit deferrals are preserved. NO duplicate body edit, ready label, audit request, ACK, native fallback, followup code, new issue or merge. ALL main merges HOLD actualbeDEPLOYED+actualClpostcheckPASS. Existing207208 agents DONE/idle, no new agents/worktrees.621299+621326 govern; ACK621326 ONLY next COMPLETE kit SourceReview, ALL native fallbacks CANCELLED forever. R2 COMPLETE/233000 KEEPIT/no prune/no host grow/restart/no103/human files/drafts/cards preserved. New fixture hash delta references161176188199208212221225234242253263276288297; prior fixture bytes NOT reread.\n\n'
when=utc()
notes=NOTES.format(when=when,summary=test_summary[0],started=v['startedUtc'],closed=v['closedUtc'])
prior=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+prior)
assert {name for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}=={'README.md'}
save(D,'boundary-record.json',canonical({'publishedUtc':when,'tests':304,'uniqueTests':304,'sourceFiles':133,
 'finalRun':v,'priorClosedRuns':closed[:-1],'firstRunFailedMisplacedTestBlock':True,'laterReviewAddedTwoOriginalsAndStrictJsonTypes':True,
 'captureCopyEquivalents':17,'minimumDatabaseEquivalents':64,'captureRootCreated':False,'releaseRootCreated':False,
 'hostCalls':0,'productionSql':0,'globalFilesystemClosure':False,'captureLauncherComplete':False,
 'sourceReviewRequested':False,'mainMergeHold':True,'actualSourceAuditResults':review['results']})+b'\n')
lead='LATEST CONCRETE CONSUMER / APACHE / COMPLETE CAPTURE CONTENT RECEIPT /304 LOCAL PASS - '+when+'.\n'+notes.split('\n',2)[2]
extras={path for path in K.iterdir() if path.is_file()}
for run in runs:extras|={path for path in (K/('local-tests-'+run)).rglob('*') if path.is_file()}
extras.add(pathlib.Path(__file__).resolve())
print(json.dumps(boundary_publish(D,extras,'feat(release): bind consumers Apache and all capture content in verified receipt',lead)))
