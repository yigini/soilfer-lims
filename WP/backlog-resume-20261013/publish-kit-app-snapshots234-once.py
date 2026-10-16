"""Closed LOCAL source publication only. No host/capture/release operator."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *

K=W/'WP/batch-release-kit-be837974-20261016'
D=K/'application-snapshots234-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='6b9d55163772e8090942af8f09186f6e6c489c5e'
assert not git('diff','--cached','--name-only').strip()
run=K/'local-tests-app-snapshots234-final'
v=json.loads((run/'verification.json').read_bytes());log=(run/'stderr-original.txt').read_bytes()
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==110
assert b'Ran 234 tests in 23.706s' in log and log.rstrip().endswith(b'OK')
assert all(sha((K/n).read_bytes())==digest for n,digest in v['sourceBefore'].items())
assert not (K/'copy-site-closure.json').exists() and not list(K.glob('release-package-*'))
proof=json.loads((K/'application-snapshot-source.json').read_bytes())
assert len(proof['files'])==4 and proof['snapshotCounts']['209-each-phase']==2
assert proof['filesystemClosureClaimed'] is False and proof['childArgvChanged'] is False

E=pathlib.Path('C:/Users/yigin/AppData/Local/Temp/soilfer-207-verify-af36ba07-768c-4bb9-8aa6-79263be8c197')
review_raw=(E/'audit-6218788735-full-1-review.json').read_bytes()
assert sha(review_raw)=='3974ff5c46d87b6607afc3173335a7b94b109e90ad8634dbb8e02850f79b1099'
review=json.loads(review_raw);agent_files={'full-review.json':review_raw}
for name,row in review['artifacts'].items():
    raw=pathlib.Path(row['path']).read_bytes()
    assert sha(raw)==row['sha256'] and len(raw)==row['bytes']
    agent_files[name]=raw
parent=(E/'parent-closed-review-1940-once.json').read_bytes()
assert sha(parent)=='29445b1f0cae91597fd841efd321826a8af7cbb6dcd1812ec69011613bb70891'
agent_files['parent-closed-review.json']=parent
assert review['exitCode']==0 and '374 passed, 374 total' in review['literalSummary'] and '5716 passed, 5716 total' in review['literalSummary']
for name in ['staging.json','commit.json','pushed.json','staged.patch','postpush-pr.json','postpush-commit-api.json','postpush-runs.json',
             'before-push-audit.json','prepush.json','stage.log','commit.log','push.log']:
    path=E/('audit-6218788735-correction-'+name);agent_files['correction-'+name]=path.read_bytes()
assert sha(agent_files['correction-staging.json'])=='1904eaf9164e0971259e4f433f6780669db012d46515e0e1f625f63246166334'
commit=json.loads(agent_files['correction-commit.json'])
assert commit['head']=='f83f3cddfee97f9115737ae85a07650c83cef885' and commit['tree']=='2555f0b98b14c92cc0f895b6cd44a6ef0423a8ef'
assert commit['parent']=='ad9d2660041c4db380d73a759871987d625f7404' and len(commit['paths'])==16
W207=pathlib.Path(review['source'])
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=W207).decode().strip()==commit['head']
assert not subprocess.check_output(['git','diff','--cached','--name-only'],cwd=W207).strip()
comparisons=[]
for name,row in commit['workingAndCommittedFiles'].items():
    working=(W207/name).read_bytes();committed=subprocess.check_output(['git','show',commit['head']+':'+name],cwd=W207)
    assert sha(working)==row['workingSha256'] and sha(committed)==row['stagedSha256']
    if row['comparison']=='BYTE_IDENTICAL':assert working==committed
    else:assert row['comparison']=='ONLY_CRLF_TO_LF' and working.replace(b'\r\n',b'\n')==committed
    comparisons.append(row['comparison'])
assert comparisons.count('BYTE_IDENTICAL')==11 and comparisons.count('ONLY_CRLF_TO_LF')==5

D.mkdir()
endpoints={
    'main':'repos/yigini/soilfer-lims/git/ref/heads/main',
    'main-ci':'repos/yigini/soilfer-lims/actions/runs/38772398721',
    'issue191':'repos/yigini/soilfer-lims/issues/191',
    'pr207':'repos/yigini/soilfer-lims/pulls/300','pr208':'repos/yigini/soilfer-lims/pulls/299',
    'new-ci207':'repos/yigini/soilfer-lims/actions/runs/38956418902',
    'new-ci208':'repos/yigini/soilfer-lims/actions/runs/38953786365',
    'release-comments':'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T19%3A23%3A15Z&per_page=100',
    'audit207':'repos/yigini/soilfer-lims/issues/comments/6218788735'}
current={}
for name,endpoint in endpoints.items():
    raw=subprocess.check_output(['gh','api',endpoint],cwd=W)
    save(D,'api-'+name+'-original.json',raw);current[name]=json.loads(raw)
assert current['main']['object']['sha']==current['main-ci']['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
assert current['main-ci']['status']=='completed' and current['main-ci']['conclusion']=='success'
assert current['issue191']['state']=='closed'
assert current['pr207']['head']['sha']==current['new-ci207']['head_sha']==commit['head']
assert current['pr208']['head']['sha']==current['new-ci208']['head_sha']=='153f10e6bac02b1a962213431141fd1c54906e99'
for name in ('new-ci207','new-ci208'):
    assert current[name]['run_attempt']==1 and current[name]['event']=='pull_request'
assert current['audit207']['created_at']==current['audit207']['updated_at']=='2026-10-16T15:25:42Z'
assert sha(current['audit207']['body'].encode())=='0d7f5742628798c07f78df01728c40d98e1d825b450b9096f71bc75194fe8f73'
assert len(current['release-comments'])<100
assert not [c for c in current['release-comments'] if (c.get('performed_via_github_app') or {}).get('id')==1236702], 'Read full new actual direction before publication'
for name,raw in agent_files.items():save(D,'issue207-'+name,raw)

prior_paths=[K/'shared-evidence161-publication-once/all-local-fixtures-hash-inventory.json',
    K/'emergency-http176-inventory-successor-publication-once/new-local-fixtures-hash-inventory.json',
    K/'prestart188-fixed-envelopes-publication-once/new-local-fixtures-hash-inventory.json',
    K/'apache199-copy-prewrite-publication-once/new-local-fixtures-hash-inventory.json',
    K/'copy-admissions208-publication-once/new-local-fixtures-hash-inventory.json',
    K/'seal-sqlite212-exact-verdict-successor-publication-once/new-local-fixtures-hash-inventory.json',
    K/'reader-live-backup221-publication-once/new-local-fixtures-hash-inventory.json',
    K/'live-backup-journal225-publication-once/new-local-fixtures-hash-inventory.json']
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
    'focusedFirst':'Tool-output transcription only:56 tests50PASS4stale generated-hook FAIL2fixture ERROR. Original command output remains in chat; after-run source snapshot retained before edits. Windows POSIX root projection and synthetic Ops admission fixture corrected; hook source rebuilt only, never executed.',
    'fullFirst':'Frozen233 tests232PASS1stale recovery fixture ERROR24.710s/110sources unchanged. Original full files retained. Recovery fixture now uses mandatory COPY_ADMISSION_SITES.',
    'fullSecond':'Frozen233PASS23.940s/110sources unchanged. Later added meaningful positive parent/control/completion integration test and final link-count recheck.',
    'finalFull':'Frozen234PASS23.706s/110sources unchanged; README only afterward.',
    'sourceBinding':'All4actual be837974 raw Git snapshot caller sources and native source proof hash independently checked by tests. Actual local native WAL and exact canonical policy installer retained both nested copies with unchanged main/WAL/source triple.',
    'scope':'Source-derived snapshot copies and reader-index allowance under mandatory source quiescence; NOT a content hard limit, quota, SQL scratch/writer-journal/WAL-growth/candidate-startup/daemon/unit/physical-metadata/global closure.',
    'parent207Inspection':'Earlier readonly parent verifier expected reporterLines6269 to be test-only5716.553describe/context lines account for difference; originalUTF8 has exactly5716sqrt reporter lines. All6269saved strings match original log after explicit reversibleCP1252-to-UTF8 inverse; derived inventory bytes unchanged. Refusal preceded any review-file/source/stage/commit/push mutation.',
    'hostCalls':0,'productionSql':0,'linuxDirectoryFsyncTested':False})+b'\n')

when=utc()
notes=f'''LOCAL APPLICATION POLICY SNAPSHOT ADMISSIONS /234 PASS - {when}.

The unmodified canonical policy CLI and214/209 installers now reserve their retained policy-copy content, directory/file entries and ordinary-reader WAL-index growth BEFORE their /tmp directory or container exists. Fresh no-volume-writer checks bracket the source triple hash and source-derived admission. The original main/WAL/SHM must still match before mkdir. Each209/order-impact owner reserves BOTH primary and secondary copies; its held allowance uses two already-declared DB equivalents rather than one. Counts remain normal41/min64, NOT capacity PASS.

New kit_app_snapshots.py and application-snapshot-source.json bind the4actual pinned be837974 caller sources. A stopped child's full snapshot main/WAL identities, bounded SHM lengths, exact copy count, independent regular files and absence of journals/unknown snapshot directories are checked before its existing final-memory/exit permission. Source copy/race guards, child argv, installer transactions, heap and600-second clock are unchanged. The retained record explicitly says this is a source-derived bound requiring quiescence, NOT an enforced content quota. SQL scratch files, writer journals/WAL growth, the outer impact child's output, candidate startup, Docker/overlay/unit output and physical metadata are STILL UNCLOSED.

Real LOCAL native SQLite/WAL plus the exact canonical policy owner produced two nested retained copies while preserving originals. Capacity/writer/source-change refusals precede tmp mkdir; missing/reused claims, changed main/WAL, oversized index, journals, extra copies/directories refuse. First focused56 had50PASS4stale-generated-hook FAIL2fixture ERROR (tool-output provenance only), then frozen233 had232PASS1stale recovery-fixture ERROR24.710s. Corrected233PASS23.940s preceded an additional meaningful positive control-file integration test and link-count recheck. FINAL234PASS23.706s/110source files unchanged; README only after. All originals retained; standalone hook SOURCE BUILT ONLY, never executed. New fixture hash delta references all161/176/188/199/208/212/221/225 inventories; old fixture bytes not reread.

207 same frozen ordinary LOCAL full actually CLOSED19:27:51.853Z exit0:374suites5716testsPASS2238.129s. Parent independently verified19 original artifacts,4928source/fixture/runtime/template hashes, exact374uniquePASS discovery/literal summary, unchanged16-file reviewed patch/index and sole help output captured/restored AFTERclosure. Windows template attributes are writable; SQLite source readers are readonly; byte hashes unchanged. Derived inventory's6269reporter/context strings match original UTF8 after explicit reversible CP1252/UTF8 correction; test-only count5716 independently rederived. Earlier parent count assumption and both agent postflight-script assumptions are retained as evidence failures, not test failures.

ONE authorized16-file correction commit/push to existing PR300 ACTUALLY completed f83f3cddfee97f9115737ae85a07650c83cef885/tree2555f0b98b14c92cc0f895b6cd44a6ef0423a8ef/parentad9d. Eleven staged files byte-identical to tested working bytes; five differ ONLY CRLF-to-LF. PR body unedited. New automatic ordinaryCI38956418902attempt1 exactf83f status={current['new-ci207']['status']}/{current['new-ci207']['conclusion']}; observe SAME run only. Previous ad9d audit6218788735 remains immutable FAILED; no retrospective PASS.208 automatic ordinaryCI38953786365attempt1 exact153f status={current['new-ci208']['status']}/{current['new-ci208']['conclusion']}; observe SAME only. Neither authorizes ready/audit before actual COMPLETE green incl ALL realDocker. No retry, PR-body publication, native, label or merge.

KEEP ACTUALLY IMPLEMENTING full copy/evidence/filesystem closure and the complete executable fresh source-reviewed host/consumer/Apache/scientific capture launcher. copy-site-closure.json remains ABSENT/no actual SourceReview or SourcePASS exists to wait for. Proposed170000capture and150000release roots UNCREATED/unreserved/no package/host/SSH/Linuxfsync/productionSQL/Docker/cgroup/newqualification/unit/gate/attempt/deployment. Current be kit206214209ONLY; future207kit requires custody DRY planned/blocked counts plus the3nonblockers. All main merges HOLD actualbe deployment plus actualCl postcheck.621299+621326 govern/ACK621326only next COMPLETE source review/all native fallbacks cancelled forever. Earlier history follows unchanged.

'''
prior=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+prior)
changed={name:{'testedSha256':digest,'currentSha256':sha((K/name).read_bytes())} for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}
assert set(changed)=={'README.md'}
lead=f'''LATEST CONCRETE APPLICATION POLICY SNAPSHOT ADMISSIONS /234 LOCAL PASS +207 CORRECTION PUSH - {when}.
SAME be837974/acc15844 kit234LOCALtestsPASS/110sourcesunchanged/READMEonlyafter. New snapshot source binding and before-tmpmkdir/container admission reserve unmodified app policy triple copies+ordinary-reader WAL-index+all declared entries/dirs; mandatory fresh no-writer checks and exact source triple bracket admission.209/order-impact BOTH primary+secondary copies admitted inside their existing2DB-equivalent allowance; normal41/min64 NOTcapacityPASS. Stopped-child exact main/WAL hashes/count/index/no-journal checks precede existing final-memory/exit permission. RealLOCAL native WAL+exact policy owner nested-copy PASS/source originals unchanged. First focused50PASS4stalehookFAIL2fixtureERROR/tool-only provenance; frozen233232PASS1stale fixture ERROR then233PASS, meaningful parent-control test+link check thenFINAL234PASS23.706s. HookSOURCEONLYneverexecuted; new fixture hash delta/oldfixturebytesNOTREREAD. This is source-derived scoped admission requiring quiescence, NOT hard content quota or SQLtemp/writerjournal/WALgrowth/candidate-startup/daemon/unit/physical-metadata/global closure.
207 SAME frozen ordinaryLOCAL full CLOSED19:27:51.853Z exit0/374suites5716testsPASS2238.129s. Parent19rawhashes+4928mappedreads+exact374PASS/literals+unchanged16patch/index/help-restoredONLYafterclosure verified. Template attributes writable/SQLite source readers readonly distinction retained; derived6269reporter/context lines reversibly decoded against originals,5716test-only independently matched. Parent count assumption/agent postflight assumptions retained honestly, no test retries. ONE16-file correction actuallyPUSHED f83f3cddfee97f9115737ae85a07650c83cef885/tree2555f0b98b14c92cc0f895b6cd44a6ef0423a8ef/parentad9d;11byteexact+5ONLYCRLFtoLF. New automatic ordinaryCI38956418902attempt1 status={current['new-ci207']['status']}/{current['new-ci207']['conclusion']}.208 SAME ordinaryCI38953786365attempt1/exact153f status={current['new-ci208']['status']}/{current['new-ci208']['conclusion']}. Existing agents observe SAME runs only/no retry/extraedits/PRbody/ready/audit/native/labels/merge. Actualold207audit6218788735FAILED immutable;208oldrows/receipt actualequality stillUNKNOWN/no retrospectivePASS.
KEEP ACTUALLY IMPLEMENT wholecopy/evidence/filesystem closure AND full executable fresh reviewed host-consumer-Apache-scientific capture launcher. SQLscratch/internalwriterjournals/WALgrowth/candidateTMPDIR/daemonDockerlogs+overlay/unitjournald/physicalmetadata remainUNCLOSED. copy-site-closure.json ABSENT/noactualSourceReview or SourcePASS to waitfor. Proposed170000CAPTURE+150000RELEASE rootsUNCREATED/unreserved/noactualpackage/host/SSH/Linuxfsync/productionSQL/Docker/cgroup/newqualification/unit/gate/attempt/deployment. Currentbekit206214209ONLY/future207custodyDRYplannedblockedcounts+3nonblockersrequired. ALLmainmergesHOLD actualbeDEPLOYED+actualClpostcheckPASS. SameheartbeatACTIVE2min/restore10ONLYactualmilestone.621299+621326govern/ACK621326ONLYnextCOMPLETEkitSourceReview/ALLnativefallbacksCANCELLEDforever/no duplicates. R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanspreserved. Earlierhistoryunchanged.

'''
save(D,'boundary-record.json',canonical({'publishedUtc':when,'tests':234,'sources':110,'finalRun':v,
    'READMEOnlyAfter':changed,'normalDatabaseEquivalents':41,'capacityPass':False,'globalFilesystemClosure':False,
    'captureLauncherComplete':False,'sourceReviewRequested':False,'hostCalls':0,'productionSql':0,
    'remotePackage':False,'root':False,'unit':False,'gate':False,'deployment':False,
    'issue207ParentReviewSha256':sha(parent),'issue207NewHead':commit['head'],'issue207NewCi':38956418902,
    'issue207NewCiStatus':current['new-ci207']['status'],'issue207NewCiConclusion':current['new-ci207']['conclusion'],
    'issue208NewCi':38953786365,'issue208NewCiStatus':current['new-ci208']['status'],
    'issue208NewCiConclusion':current['new-ci208']['conclusion'],'mainMergeHold':True})+b'\n')
extras={p for p in K.iterdir() if p.is_file()}
for dirname in ['local-tests-app-snapshots-focused-first-tool-transcription','local-tests-local-tests-app-snapshots233',
                'local-tests-app-snapshots233-final','local-tests-app-snapshots234-final']:
    extras|={p for p in (K/dirname).rglob('*') if p.is_file()}
extras.add(pathlib.Path(__file__).resolve())
print(json.dumps(boundary_publish(D,extras,'feat(release): admit retained application policy snapshots',lead)))
