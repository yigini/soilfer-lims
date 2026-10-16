"""ONE reviewed current-head audit after independent closed-original review."""
from prechecks6210209468_boundary_publication import *
D=W/'WP/backlog-resume-20261013/issue207-exact-f83f-audit-request-once'
E=W/'WP/backlog-resume-20261013/issue207-ci38956418902-parent-utf8-successor-once'
assert not D.exists() and not git('diff','--cached','--name-only').strip()
assert git('rev-parse','HEAD').decode().strip()=='f14fd25851203300a77c2db6572a0592dab0673e'
verified=json.loads((E/'parent-independent-verification.json').read_bytes())
assert verified['all5716OriginalZipReporterLinesEqualFullGhLog'] and verified['exact374FrozenDiscoveryAndPerSuiteCounts']
assert verified['allArchiveEntryHashesRetained']==22 and verified['agentArtifactsIndependentlyVerified']==15 and verified['summaryAlsoVerified']
assert verified['all20StepsSuccess'] and verified['noUuidNormalization'] and verified['literalCaseNamesIdentical'] is False
head='f83f3cddfee97f9115737ae85a07650c83cef885';tree='2555f0b98b14c92cc0f895b6cd44a6ef0423a8ef';base='be8379745bdfae52ce46496ff26514dc7d729640'
def api(endpoint):return subprocess.check_output(['gh','api',endpoint],cwd=W)
endpoints=['repos/yigini/soilfer-lims/pulls/300','repos/yigini/soilfer-lims/actions/runs/38956418902',
 'repos/yigini/soilfer-lims/actions/runs/38956418902/jobs','repos/yigini/soilfer-lims/git/commits/'+head,
 'repos/yigini/soilfer-lims/git/ref/heads/main','repos/yigini/soilfer-lims/actions/runs/38772398721',
 'repos/yigini/soilfer-lims/issues/comments/6218788735']
raws=[api(endpoint) for endpoint in endpoints];pr,run,jobs,commit,main,mainci,old=map(json.loads,raws)
assert pr['state']=='open' and not pr['draft'] and pr['head']['sha']==run['head_sha']==commit['sha']==head
assert commit['tree']['sha']==tree and pr['base']['sha']==main['object']['sha']==mainci['head_sha']==base
assert mainci['run_attempt']==1 and mainci['status']=='completed' and mainci['conclusion']=='success'
assert run['run_attempt']==1 and run['event']=='pull_request' and run['status']=='completed' and run['conclusion']=='success'
assert jobs['total_count']==len(jobs['jobs'])==1 and len(jobs['jobs'][0]['steps'])==20
assert all(s['status']=='completed' and s['conclusion']=='success' for s in jobs['jobs'][0]['steps'])
assert old['created_at']==old['updated_at']=='2026-10-16T15:25:42Z' and sha(old['body'].encode())=='0d7f5742628798c07f78df01728c40d98e1d825b450b9096f71bc75194fe8f73'
prior_pr=json.loads((E/'api-fresh-pr.json').read_bytes());assert pr['body']==prior_pr['body']
graph=subprocess.check_output(['gh','pr','view','300','--json','headRefOid,baseRefOid,closingIssuesReferences,url'],cwd=W)
g=json.loads(graph);assert g['headRefOid']==head and g['baseRefOid']==base and g['closingIssuesReferences']==[]
history=subprocess.check_output(['gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/300/comments?per_page=100'],cwd=W)
pages=json.loads(history);assert len(pages)<=32 and all(len(page)<=100 for page in pages)
assert not any(head in c['body'] and ('ready for audit' in c['body'].lower() or 'audit passed' in c['body'].lower()) for page in pages for c in page)
assert 'ready-for-audit' not in {row['name'] for row in pr['labels']}
description=f'''References #207.

Sample storage uses controlled InventoryLocation rows with SAMPLE/REAGENT purpose. Receipt, transfer, external custody and disposal append custody events; immutable container identity projects its current location from that ledger. Publication resolves sample.retentionDaysAfterReport through policyService and optional project settings, records report/deadline evidence and exposes an overdue disposal queue. Disposal rechecks retention, holds and amendments; rejected material requires a reason. Shared UI and five locales cover the workflow.

The additive installer has dry-run/apply/no-op classification, exact source/schema/guard checks, provenance-checked legacy receipt backfill and retained-row/receipt preservation. Readiness compares every predecessor column/value/row/receipt, permits only declared custody additions/defaults and requires an empty new ledger. It preserves unknown old report-retention dates.

The final16-file correction addresses all four findings in audit6218788735:

- RECEIVED events and receipt views retain declared deliverer text separately from authenticated acknowledgement. Client-confirmed signature synthesis is removed; original receipt expectations are restored.
- Receive/reject acknowledgement resolves only the assigned lab, records that lab in the same transition before the event and returns409 CUSTODY_LAB_REQUIRED when absent.
- Null/undefined/blank receipt dates refuse instead of becoming1970; installer legacy provenance refuses missing receipt time.
- Retention override no-ops preserve raw NULL/configuration. Real changes append old/new day values to the project audit; unchanged client settings are not rewritten.

Validation of exact head `{head}` / tree `{tree}` / base `{base}`:

- [Ordinary CI38956418902 attempt1](https://github.com/yigini/soilfer-lims/actions/runs/38956418902) completed SUCCESS20:14:43Z: **374 suites /5,716 tests passed**,1653.038s. Client/theme checks, BOTH actual candidate/supported-baseline Docker builds, all five boundary scenarios and full real deployment readiness passed. Custody proof is COMPLETE_207/DRY_RUN then NO_OP, zero changes/backfill, empty ledger and exact DB-WAL-SHM preservation.
- Frozen ordinary LOCAL full:374 suites /5,716 tests passed,2238.129s; focused corrections:5 suites /176 tests passed. Both ordinary setups and stock assertions stayed unchanged. Focused JSX lint has6errors/16warnings identical to untouched ad9d; these baseline findings were not changed. The CI client production build passes.
- [Independent closed-original review](https://github.com/yigini/soilfer-lims/blob/f14fd25851203300a77c2db6572a0592dab0673e/WP/backlog-resume-20261013/issue207-ci38956418902-parent-utf8-successor-once/publication-index.json) matches ALL5,716 reporter lines between original ZIP and full GH log, exact374-suite frozen discovery/per-suite counts, all22archive-entry hashes and15agent artifacts plus summary. Five reference-placement case names contain generated method UUIDs: both literal sets remain retained, their equality is explicitly false, with no UUID normalization. Actual CI checkout0a92d4b2 has the exact tested tree and base/head parents.

LOCAL Windows verification uses a retained visible Temp fixture, verified mapped inputs/runtime/SQLite template bytes and read-only scanner index. The sole generated help manifest was retained then restored only after closure. Eleven corrected working files equal committed bytes; five differ only by CRLF-to-LF. Source/runtime/test bytes stayed frozen during the full run. Earlier failed local/postflight attempts remain retained; Windows templates were writable files, with read-only SQLite/source connections and unchanged bytes.

Three disclosed nonblockers remain: walk-in creation can log RECEIVE_SAMPLE under existing manager/surveyor create policy; legacy PUBLISHED retainUntil=NULL is deferred without backfill and excluded from the disposal queue; receiptView still queries per row (#204). Future #207 deployment-kit review must show actual authorized-copy custody dry-run planned/blocked counts and refuse missing assigned lab/receipt date. The current be837974 release kit includes #206/#214/#209 only.

Original CI38898969962 remains FAILED. Prior ad9d CI38911857904 was green but audit6218788735 FAILED and stays immutable; this current-head correction/result does not retrospectively change that verdict. Disposable CI restore tests grant no production recovery authority.

Exact-head audit and actual post-deploy acceptance remain pending. ALL main merges remain held until actual be837974 deployment plus Claudio postcheck PASS, regardless of this source audit. No automatic closing references; #207 remains open for actual acceptance.
'''
body=f'''@claude ready for audit at {head}

Please perform the final exact-head re-audit of #207 custody/retention after all four findings in immutable FAILED audit6218788735 were corrected. Head `{head}`; tree `{tree}`; base `{base}`.

The16-file correction retains declared deliverer text in RECEIVED/receiptView, removes client CONFIRMED synthesis, requires assigned lab with409 CUSTODY_LAB_REQUIRED before receive/reject events, refuses missing receipt dates/provenance instead of1970, and preserves no-op retention NULL/configuration while auditing actual old/new day changes.

[Ordinary CI38956418902 attempt1](https://github.com/yigini/soilfer-lims/actions/runs/38956418902) actually completed SUCCESS20:14:43Z: **374 suites /5716 tests PASS**,1653.038s; client/theme, BOTH real candidate/supported-baseline Docker builds, ALL5boundary scenarios and full readiness PASS. Actual checkout0a92d4b2b1859d3583eba3b5901f512ff410a3e1 has exact tree/parents. Custody readiness proves COMPLETE_207 dry/no-op0changes/0backfill/emptyledger/exactDB-WAL-SHM.

Parent independently compared ALL5716actualUTF8 reporter lines ZIP-vs-fullGHlog, exact374frozen suite discovery/per-suite counts, excluded129console checkmarks by explicit context, verified ALL22archive-entry hashes/ALL15agent artifacts+summary and16working-vs-committed mappings. [Originals and independent verification](https://github.com/yigini/soilfer-lims/blob/f14fd25851203300a77c2db6572a0592dab0673e/WP/backlog-resume-20261013/issue207-ci38956418902-parent-utf8-successor-once/publication-index.json). Five parameterized test names differ by generated method UUIDs; both raw sets retained/literal equalityFALSE/no normalization. Frozen LOCAL374/5716 and focused5/176 passed; baseline focused JSX lint6errors16warnings identical to untouched ad9d is disclosed. The PR description now reflects this final head and validation.

Nonblockers disclosed: walk-in RECEIVE_SAMPLE follows existing create policy; old PUBLISHED retainUntil=NULL remains deferred/no backfill/disposal-queue exclusion; per-row receiptView queries remain #204. Future207kit must show actual authorized-copy custody DRY planned/blocked counts and refuse missing lab/date. Current be release kit is206214209ONLY.

Old failed38898969962 and FAILED audit6218788735 remain immutable; oldad9dgreenCI never overrides that verdict. CI rollback/restore tests are disposable and grant no production recovery authority. No closing references. ALLmainmerges HOLD actualbeDEPLOYED+actualClpostcheck regardless of source audit; no deployment authority is requested here.
'''
D.mkdir()
for i,raw in enumerate(raws):save(D,'api-before-'+str(i)+'.json',raw)
save(D,'pr-closing-references-before.json',graph);save(D,'comments-before.json',history)
save(D,'pr-body-before.md',pr['body'].encode());save(D,'pr-body-request.json',canonical({'body':description}))
save(D,'audit-request-body.md',body.encode());save(D,'comment-request.json',canonical({'body':body}))
save(D,'label-request.json',canonical({'labels':['ready-for-audit']}))
save(D,'send-intent.json',canonical({'head':head,'run':38956418902,'attempt':1,'neverRetry':True,'mainMergeHold':True,
 'alreadyNonDraft':True,'noDraftTransitionNeeded':True,'bodyUpdateOnce':True})+b'\n')
fresh=json.loads(api('repos/yigini/soilfer-lims/pulls/300'))
assert fresh['head']['sha']==head and fresh['body']==pr['body'] and not fresh['draft']
response=subprocess.check_output(['gh','api','--method','PATCH','repos/yigini/soilfer-lims/pulls/300','--input',str(D/'pr-body-request.json')],cwd=W)
save(D,'body-update-response-original.json',response);assert json.loads(response)['body']==description
label=subprocess.check_output(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/300/labels','--input',str(D/'label-request.json')],cwd=W)
save(D,'label-response-original.json',label);assert 'ready-for-audit' in {r['name'] for r in json.loads(label)}
response=subprocess.check_output(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/300/comments','--input',str(D/'comment-request.json')],cwd=W)
save(D,'comment-response-original.json',response);created=json.loads(response)
assert created['body']==body and created['created_at']==created['updated_at']
fresh=api('repos/yigini/soilfer-lims/issues/comments/'+str(created['id']));save(D,'comment-fresh-original.json',fresh)
assert json.loads(fresh)['id']==created['id'] and json.loads(fresh)['body']==body and json.loads(fresh)['updated_at']==created['created_at']
fresh=api('repos/yigini/soilfer-lims/pulls/300');save(D,'pr-after-original.json',fresh)
assert json.loads(fresh)['body']==description and json.loads(fresh)['head']['sha']==head
save(D,'send-result.json',canonical({'commentId':created['id'],'url':created['html_url'],'createdAt':created['created_at'],
 'bodySha256':sha(body.encode()),'prDescriptionSha256':sha(description.encode()),'actualResponseAndFreshReadbackEqual':True,
 'readyLabelAppliedOnce':True,'alreadyNonDraftNoTransition':True,'head':head,'tree':tree,'mainMergeHold':True,
 'mergePerformed':False,'nativeFallbackSent':False})+b'\n')
lead=f'''ACTUAL ONE CORRECTED #207 EXACT-HEAD AUDIT REQUEST - {created['created_at']}.
PR300 description updated ONCE to exactf83f3cddfee97f9115737ae85a07650c83cef885/tree2555f0b98b14c92cc0f895b6cd44a6ef0423a8ef/final3745716/all4corrections/3nonblockers/future207DRYplannedblockedcounts; already nondraft/no duplicate transition. Ready-for-audit label ONCE and actual@claude request{created['id']} postedONCE: {created['html_url']} . Request=response=freshuneditedreadback/bodySHA{sha(body.encode())}. OrdinaryCI38956418902attempt1ACTUALSUCCESS/ALLrealDocker/3745716 independently reviewed;106raw parent originals publishedf14fd2585. Old6218788735 remains immutableFAILED/oldad9dgreenNOoverride. Actual final current-head verdictPENDING/no duplicate bodyedit/label/request/native/merge.208actual6223680579alsoPENDING/no duplicates. ALLmainmergesHOLD actualbeDEPLOYED+actualClpostcheck. Kit253LOCALPASS6ca233f81/608raw/fullfilesystemclosure+capturelauncherunfinished/copy-site-closure.json ABSENT/no actualSourceReview/package/host/root/unit/gate/attempt/deployment.621299+621326govern/allnativefallbacksCANCELLED/ACK621326ONLYnextCOMPLETEkitSourceReview. HeartbeatACTIVE2min. Earlier history unchanged.

'''
print(json.dumps(boundary_publish(D,{pathlib.Path(__file__).resolve()},'docs(audit): request corrected custody exact-head re-audit after green CI',lead)))
