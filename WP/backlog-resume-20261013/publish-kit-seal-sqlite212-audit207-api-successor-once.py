"""Publish this closed LOCAL seal/SQLite iteration, never a host operator."""
import sys
sys.dont_write_bytecode=True
from prechecks6210209468_boundary_publication import *
K=W/'WP/batch-release-kit-be837974-20261016';D=K/'seal-sqlite212-audit207-api-successor-publication-once'
assert not D.exists() and git('rev-parse','HEAD').decode().strip()=='23fde6cf354c376d8b360dc043a0895545a504b8'
assert not git('diff','--cached','--name-only').strip()
run=K/'local-tests-seal-sqlite212-first'
v=json.loads((run/'verification.json').read_bytes());log=(run/'stderr-original.txt').read_bytes()
assert v['exitCode']==0 and v['sourceBefore']==v['sourceAfter'] and len(v['sourceBefore'])==105
assert b'Ran 212 tests' in log and log.rstrip().endswith(b'OK')
assert all(sha((K/name).read_bytes())==digest for name,digest in v['sourceBefore'].items())
assert not (K/'copy-site-closure.json').exists() and not list(K.glob('release-package-*'))
A=pathlib.Path('C:/Users/yigin/.codex/worktrees/issue-208-labels/soilfer-lims')
review_path=A/'server/tests/.tmp_issue208/comparator-exact-sql-review.json'
review_raw=review_path.read_bytes();assert sha(review_raw)=='50e8073d02def9f443676f2419e809aec954c10c94f8085a75f168da34aa30fa'
review=json.loads(review_raw);agent_files={'comparator-exact-sql-review.json':review_raw}
for item in [review['patch'],review['focused'],*review['files'],*review['applicationPins']]:
    path=A/item.get('path',item.get('log',''));raw=path.read_bytes();assert sha(raw)==item['sha256']
    agent_files[path.name]=raw
for item in review['applicationPins']:
    assert sha(subprocess.check_output(['git','show','HEAD:'+item['path']],cwd=A))==item['sha256']
assert subprocess.check_output(['git','diff','--cached','--name-only'],cwd=A).decode().splitlines()==review['paths']
for item in review['files']:
    raw=(A/item['path']).read_bytes();staged=subprocess.check_output(['git','show',':'+item['path']],cwd=A)
    assert raw==staged or raw.replace(b'\r\n',b'\n')==staged
    agent_files['staged-'+pathlib.Path(item['path']).name]=staged
assert review['focused']=={'suites':4,'tests':190,'seconds':35.648,
    'log':'server/tests/.tmp_issue208/comparator-exact-sql-focused.log',
    'sha256':'d2fb253b1a9a21e9addcc35de40a0c61e7d985671e9ba6cfa74f534b823f6e12'}
full=pathlib.Path('C:/Users/yigin/AppData/Local/Temp/soilfer-issue208-comparator-full-o776za/evidence')
opening={}
for name,digest in [('frozen-inputs.json','81e855b66e6d95c1d2e225c9b66bf884f559b09a0ab14ae39bcf83504ddab2ec'),
    ('test-inventory.json','b932b165ee44e7e4bcb4a78dbe7dfb925098063ca6767561bd15fdd903e2e6ea'),
    ('run-contract.json','a8355fa445a3d0fe492837570a61e16af01c0c6a0ae26a456b1d24782ca976ba')]:
    raw=(full/name).read_bytes();assert sha(raw)==digest;opening[name]=raw
endpoints=['repos/yigini/soilfer-lims/git/ref/heads/main','repos/yigini/soilfer-lims/actions/runs/38772398721',
    'repos/yigini/soilfer-lims/issues/191','repos/yigini/soilfer-lims/pulls/300','repos/yigini/soilfer-lims/pulls/299',
    'repos/yigini/soilfer-lims/actions/runs/38911857904','repos/yigini/soilfer-lims/actions/runs/38915551182',
    'repos/yigini/soilfer-lims/issues/300/comments?since=2026-10-16T14%3A47%3A15Z&per_page=100',
    'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T15%3A12%3A30Z&per_page=100']
captures=[(endpoint,subprocess.check_output(['gh','api',endpoint],cwd=W)) for endpoint in endpoints]
main,ci,issue,pr207,pr208,ci207,ci208,comments207,comments162=[json.loads(raw) for _,raw in captures]
assert main['object']['sha']==ci['head_sha']=='be8379745bdfae52ce46496ff26514dc7d729640'
assert ci['run_attempt']==1 and ci['status']=='completed' and ci['conclusion']=='success' and issue['state']=='closed'
assert pr207['head']['sha']==ci207['head_sha']=='ad9d2660041c4db380d73a759871987d625f7404'
assert ci207['run_attempt']==1 and ci207['status']=='completed' and ci207['conclusion']=='success'
assert pr208['head']['sha']==ci208['head_sha']=='72adbe43b36319e6f9d8088baa61b0fbe26bb3ff'
assert ci208['run_attempt']==1 and ci208['status']=='completed' and ci208['conclusion']=='failure'
assert pr207['base']['sha']==pr208['base']['sha']==main['object']['sha']
actual207=[c for c in comments207 if c['id']!=6218049200 and (c.get('performed_via_github_app') or {}).get('id')==1236702]
assert len(actual207)==1 and actual207[0]['id']==6218788735
assert actual207[0]['created_at']==actual207[0]['updated_at']=='2026-10-16T15:25:42Z'
assert actual207[0]['body'].splitlines()[0]=='Audit failed' and pr207['head']['sha'] in actual207[0]['body']
verdict_raw=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/issues/comments/6218788735'],cwd=W)
single=json.loads(verdict_raw);listed=actual207[0]
assert {k:v for k,v in single.items() if k!='performed_via_github_app'}=={k:v for k,v in listed.items() if k!='performed_via_github_app'}
assert listed['performed_via_github_app']=={**single['performed_via_github_app'],'client_id':'Iv23liqTIFEtdIu6Vn1r'}
assert sha(single['body'].encode())=='0d7f5742628798c07f78df01728c40d98e1d825b450b9096f71bc75194fe8f73'
assert not [c for c in comments162 if (c.get('performed_via_github_app') or {}).get('id')==1236702], 'Read full actual release direction first'
D.mkdir()
save(D,'issue207-actual-audit-failed6218788735-original.json',verdict_raw)
save(D,'issue207-actual-audit-failed6218788735-body.txt',actual207[0]['body'].encode())
save(D,'second-publisher-api-shape-refusal-derived.json',canonical({'helper':'publish-kit-seal-sqlite212-audit207-successor-once.py','helperSha256':sha((W/'WP/backlog-resume-20261013/publish-kit-seal-sqlite212-audit207-successor-once.py').read_bytes()),'reason':'List endpoint includes exact Claude app client_id whereas single-comment endpoint omits it','allOtherFieldsAndEntireUneditedBodyExactEqual':True,'bothOriginalApiSerializationsRetained':True,'refusedBeforeEvidenceDirectoryREADMEGitOrHostMutation':True,'originalNeverReplayed':True,'recordKind':'TOOL_OUTPUT_TRANSCRIPTION_NOT_ORIGINAL_COMMAND_LOG'})+b'\n')
save(D,'first-publisher-preflight-refusal-derived.json',canonical({'helper':'publish-kit-seal-sqlite212-once.py','helperSha256':sha((W/'WP/backlog-resume-20261013/publish-kit-seal-sqlite212-once.py').read_bytes()),'reason':'New actual207 audit must be read before publication','refusedBeforeEvidenceDirectoryREADMEGitOrHostMutation':True,'originalNeverReplayed':True,'recordKind':'TOOL_OUTPUT_TRANSCRIPTION_NOT_ORIGINAL_COMMAND_LOG'})+b'\n')
for i,(_,raw) in enumerate(captures):save(D,'api-original-'+str(i)+'.json',raw)
for name,raw in agent_files.items():save(D,'issue208-'+name,raw)
for name,raw in opening.items():save(D,'issue208-full-opening-'+name,raw)
prior_paths=[K/'shared-evidence161-publication-once/all-local-fixtures-hash-inventory.json',
    K/'emergency-http176-inventory-successor-publication-once/new-local-fixtures-hash-inventory.json',
    K/'prestart188-fixed-envelopes-publication-once/new-local-fixtures-hash-inventory.json',
    K/'apache199-copy-prewrite-publication-once/new-local-fixtures-hash-inventory.json',
    K/'copy-admissions208-publication-once/new-local-fixtures-hash-inventory.json']
known=set();prior_refs=[]
for path in prior_paths:
    raw=path.read_bytes();known|={row['path'] for row in json.loads(raw)['fixtures']}
    prior_refs.append({'path':path.relative_to(W).as_posix(),'sha256':sha(raw),'gitBlobOid':oid(raw)})
fixtures=[]
for directory in sorted(K.glob('*-local-retained-fixtures')):
    for path in sorted(directory.rglob('*')):
        if not path.is_file():continue
        name=path.relative_to(K).as_posix()
        if name in known:continue
        raw=path.read_bytes();s=path.stat()
        fixtures.append({'path':name,'bytes':len(raw),'sha256':sha(raw),'localModeObserved':s.st_mode&0o777,'localLinksObserved':s.st_nlink})
save(D,'new-local-fixtures-hash-inventory.json',canonical({'fixtures':fixtures,'priorInventories':prior_refs,
    'priorFixtureFilesNotReread':True,'newFixtureBytesPublic':False,'privateHostBytesFetched':0,'productionBytes':0})+b'\n')
notes="""LOCAL OUTER SEAL ADMISSIONS / SQLITE TEMPORARIES /212 PASS - 2026-10-16.

Every outer controller seal directory now consumes a distinct source claim and complete directory/entry allowance BEFORE mkdir or the first source-content read. Its fixed three-block allowance is included independently in every applicable stage and the exact Linux preflight AST; missing or reused admissions refuse stage closure. The normal37/min64 database-equivalent model is unchanged. These are declared allowances, not measured filesystem metadata or a global quota.

Every Python retained-copy integrity/sort/preservation connection now requests memory-only temporary storage and rejects compile-time TEMP_STORE=0, missing/ambiguous options or a refused pragma before its queries. Only a NEW detached backup uses an in-memory rollback journal, before backup and again afterward because SQLite can inherit the source's WAL-mode header. Its complete page length remains pinned/admitted, no detached journal/WAL/SHM may remain, and the output is explicitly fsynced before immutable sealing and full logical equality. Raw masters and production/installer journal settings are unchanged. A crash can leave this new unsealed backup incomplete; it stays retained and cannot become successful evidence or be retried. This is not a global memory bound, reader-WAL-index proof, application TMPDIR bound or whole-filesystem closure.

SQLite primary references: https://www.sqlite.org/pragma.html#pragma_temp_store ; https://www.sqlite.org/pragma.html#pragma_journal_mode ; https://www.sqlite.org/tempfiles.html . Memory temporaries use existing controller memory limits; no heap/limit changes, performance detour or new installer-transaction kill point. Local real-WAL tests retain the full detached snapshot and check all original bytes, row values and absent detached side files. Unsupported compile configurations, early directory refusal and missing/reused claims are exercised.

Focused50 tests PASS after a retained tool-output-only exploratory50 run had48PASS2Windows fsync ERROR: a read-only file descriptor cannot be fsynced on Windows. The new owned backup is now opened r+b solely to flush/fsync before chmod400; no output bytes are changed by that step. The first exploratory focused command's session ID was accidentally omitted from its displayed output; it was observed closed before the explicit retained-result successor. The final full frozen212 tests PASS/105 source files unchanged. Standalone hook rebuilt SOURCE ONLY, never executed. Only this README explanation follows the frozen full run. New local fixtures are hash-inventoried as a delta; old fixture bytes were not reread. No Linux fsync/host/Docker/production SQLite execution is claimed.

Parent reviewed both #208 comparator revisions and found whitespace normalization could conflate old SQL tokens/bracket identifiers. The final two-file correction now retains exact original CREATE SQL bytes around only the canonical nullable Sample.labSampleCode addition, all old columns/row values/order and predecessor receipt bytes. Parent independently verified patch/report/focused/source/owner/loader/DDL hashes, exact two staged paths and raw-equal versus CRLF-to-LF distinction. Focused4 suites190 tests PASS35.648s; actual unchanged #180 ALTER integration passes. Parent authorized ONE new frozen376-suite LOCAL full run only, started15:29:27.4082281Z in the existing agent's new visible fixture with2445 mapped inputs+21 linked runtime files. It is ACTIVE at this boundary; no full result/commit/push/new-head CI/PR edit/ready/audit/merge is inferred. Original38915551182 and38898578537 remain immutable FAILED; their actual old-row payloads remain unavailable.

Whole-graph copy/evidence/filesystem closure and the complete executable fresh source-reviewed host/consumer/Apache/scientific capture launcher remain required. copy-site-closure.json is ABSENT; no actual source review/PASS exists to wait for. Proposed170000 capture and150000 release roots are uncreated/unreserved, no real package/host/unit/gate/attempt/deployment.207 actual final audit6218788735 is FAILED on exactad9d. Parent read the complete unedited actual Claude-app response and authorized the existing207 agent LOCAL corrections/focused tests for all four findings: declared deliverer text preservation, receiving assignedLab/409 guard, missing receipt-time refusal, and audit/no-op retention override. Parent review is required before any full run/commit/push/new-head CI. Walk-in permission, null legacy retention and per-row receipt queries must be disclosed as directed. A later207 deployment kit must include custody DRY planned/blocked counts; the currentbe kit still deploys206/214/209 only. No duplicate ready/request/native. The first212 publisher refused this newly observed audit BEFORE evidence-directory/README/Git/host mutation; original helper preserved and never replayed. The second publisher also refused BEFORE mutation because the list endpoint includes Claude app client_id while the single-comment endpoint omits it. All other fields, exact body and app properties match. Both original API serializations are retained; both earlier helpers stay unchanged/never replayed. This unique successor explicitly validates only that known API-shape difference and retains the full actual response. ALL main merges hold for actualbe deployment and Claudio postcheck.621299+621326 govern; ACK621326 only at the next COMPLETE source review; every native fallback remains cancelled. Earlier history follows unchanged.

"""
old=(K/'README.md').read_bytes();(K/'README.md').write_bytes(notes.encode()+old)
changed={name:{'testedSha256':digest,'currentSha256':sha((K/name).read_bytes())} for name,digest in v['sourceBefore'].items() if sha((K/name).read_bytes())!=digest}
assert set(changed)=={'README.md'}
when=utc()
lead=f"""LATEST CONCRETE OUTER SEAL ADMISSIONS / OWNED SQLITE TEMP-JOURNAL /212 LOCAL PASS - {when}.
SAME be837974/acc15844 kit has212LOCALtestsPASS/105sourcefilesunchanged during frozenfullrun/READMEonlyafter. Each outerseal directory has a separately budgeted single-spend sourceclaim and full directory/entry allowance BEFOREmkdir/sourcecontentread; missing/reused admissions refuse stage closure; exactremoteASTupdated. All Python retained-copy query/sort/integrity connections enforce memory-only temporary storage with compile-option override checks. Only NEW detached backup uses memory rollback journal before/after backup, normalizes copied WAL header, fsyncs and requires no detached sidefiles/full logical equality. Rawmasters/production/installerjournalsettings unchanged. A failed/unsealed newbackup stays incomplete/retained/no retry. These are scoped connection controls/DECLARED metadata allowances, NOT readerWAL-index/appTMPDIR/wholefilesystemquota/globalclosure. Focused50PASS after exploratory48PASS2Windowsread-onlyfsyncERROR/tooloutputs only; correctedr+bflush changes no bytes. Two exploratory SQLiteWAL behavior probes retainedLOCAL. Final212fullPASS; standalonehookSOURCEONLY/neverexecuted/newfixturehashdelta/oldfixturebytesNOTREREAD.
KEEP ACTUALLY IMPLEMENTING remaining wholecopy/evidence/filesystem closure incl readerSHM/appTMPDIR/daemon/unitjournal and complete executable fresh reviewed host-consumer-Apache-scientific capture launcher. copy-site-closure.json ABSENT/normal37-min64 NOTcapacityPASS/no sourceReview or SourcePASS to waitfor. Proposed170000CAPTURE+150000RELEASE rootsUNCREATED/unreserved/no realpackage/host/SSH/Linuxfsync/productionSQL/Docker/cgroup/newqualification/unit/gate/attempt/deployment.
208 parent READ complete two-file comparator patch, rejected whitespace-normalization gap, reviewed exactSQL revision and independently verified8report/patch/focused/source/owner/loader/DDLhashes+exact2stagedpaths/raworCRLFtoLF distinction. Finaltree34f6d9be9c00b2fd923989e4d4291a06ec333e32/HEAD72adbe43 unchanged/focused4suites190PASS35.648s. Parent NOWauthorizes ONE frozen ordinary376-suite LOCALfull ONLY; actualstart15:29:27.4082281Z/rootsoilfer-issue208-comparator-full-o776za/2445mappedinputs+21runtime/exact376discovery remainsACTIVE atpublication. No source edits whileactive/fullresult/commit/push/newheadCI/PRedit/ready/audit/merge authorized yet. Original38915551182+38898578537 immutableFAILED/actualoldrowpayloadsunavailable/no retrospective reconciliation.
207 exactad9d/CI38911857904completeSUCCESS BUT actualCl6218788735/15:25:42Z FINALAUDITFAILED. FULL uneditedactualappresponseREAD/retained: deliverer declaredtext dropped; null assignedLab500; installer nulltime=>invented1970; retentionoverrideold/newvaluesunaudited/nooprewrite. Existing207agentNOWauthorizedLOCALsmallestcorrections+focusedONLY/reportconcretepatchhashesBEFOREfullrun/commit/push/newheadCI. NonblockerswalkinRECEIVE_SAMPLE/legacyretainUntilNULLdeferred/perrowreceiptView204; later207kitDRYplannedblockedcounts required/currentbeKIT206214209only. No duplicate ready/request/native/merge. First212publisher refusednewauditBEFOREDmkdir/README/Git/host; unchangedhelperpreserved/neverreplayed. Secondpublisher refusedknownappclient_idlist-versus-singleAPIshapeBEFOREmutation/allotherfields+bodyexact/bothrawsretained/secondhelperpreserved/neverreplayed/uniqueAPI-shapesuccessor. ALLmainmergesHOLD actualbeDEPLOYED+actualClpostcheckPASS. SameheartbeatACTIVE2min/restore10ONLYactualmilestone.621299+621326govern/ACK621326ONLYnextCOMPLETEsourceReview/ALLnativefallbacksCANCELLEDforever. R2COMPLETE/233000KEEPIT/noprune/nohostgrowrestart/no103/humanfilesdraftscards preserved. Earlier history verbatim below.

"""
save(D,'boundary-record.json',canonical({'publishedUtc':when,'tests':212,'sources':105,'sourceUnchangedDuringRun':True,
    'READMEOnlyAfter':changed,'fullFilesystemClosure':False,'copySiteClosureCreated':False,'captureLauncherComplete':False,
    'sourceReviewRequested':False,'hostCalls':0,'productionSqlConnections':0,'realPackage':False,'remoteRoot':False,
    'unit':False,'gate':False,'deployment':False,'mainMergeHold':True,'issue208FullRunStatusAtPublication':'ACTIVE',
    'issue208FullRunAuthorizedLocalOnly':True,'issue208Head':pr208['head']['sha'],
    'issue208Tree':review['tree'],'issue208FocusedTests':190,'issue207FinalAuditPending':False,'issue207FinalAuditFailed':True,'issue207ActualAuditId':6218788735,'issue207ActualAuditBodySha256':sha(actual207[0]['body'].encode())})+b'\n')
extras={p for p in K.iterdir() if p.is_file()}|{p for p in run.rglob('*') if p.is_file()}
extras.add(W/'WP/backlog-resume-20261013'/pathlib.Path(__file__).name)
extras.add(W/'WP/backlog-resume-20261013/publish-kit-seal-sqlite212-once.py')
extras.add(W/'WP/backlog-resume-20261013/publish-kit-seal-sqlite212-audit207-successor-once.py')
print(json.dumps(boundary_publish(D,extras,'feat(release): admit seal directories and bound owned SQLite temporaries',lead)))
