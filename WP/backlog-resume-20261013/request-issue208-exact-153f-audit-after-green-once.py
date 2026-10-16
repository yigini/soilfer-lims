"""One authorized PR-ready transition and exact-head audit after reviewed GREEN."""
from prechecks6210209468_boundary_publication import *
D=W/'WP/backlog-resume-20261013/issue208-exact-153f-audit-request-once'
E=W/'WP/backlog-resume-20261013/issue208-ci38953786365-parent-once'
assert not D.exists() and not git('diff','--cached','--name-only').strip()
assert git('rev-parse','HEAD').decode().strip()=='59cd49393e5fce07b5a2bfe0c51610e26702c07a'
verified=json.loads((E/'parent-independent-verification.json').read_bytes())
assert verified['all5761ZipReporterLinesEqualFullGhLog'] and verified['exact376FrozenDiscovery']
assert verified['all22ZipEntryHashesVerified'] and verified['all20ClosedEvidenceHashesVerified']
assert verified['allRealDockerStepsSuccess'] and verified['status']=='completed' and verified['conclusion']=='success'
head='153f10e6bac02b1a962213431141fd1c54906e99';tree='34f6d9be9c00b2fd923989e4d4291a06ec333e32'
base='be8379745bdfae52ce46496ff26514dc7d729640'
def api(endpoint):return subprocess.check_output(['gh','api',endpoint],cwd=W)
endpoints=['repos/yigini/soilfer-lims/pulls/299','repos/yigini/soilfer-lims/actions/runs/38953786365',
    'repos/yigini/soilfer-lims/actions/runs/38953786365/jobs','repos/yigini/soilfer-lims/git/commits/'+head,
    'repos/yigini/soilfer-lims/git/ref/heads/main','repos/yigini/soilfer-lims/actions/runs/38772398721']
raws=[api(endpoint) for endpoint in endpoints];pr,run,jobs,commit,main,mainci=map(json.loads,raws)
assert pr['state']=='open' and pr['draft'] and pr['head']['sha']==run['head_sha']==commit['sha']==head
assert commit['tree']['sha']==tree and pr['base']['sha']==main['object']['sha']==mainci['head_sha']==base
assert mainci['run_attempt']==1 and mainci['status']=='completed' and mainci['conclusion']=='success'
assert run['run_attempt']==1 and run['event']=='pull_request' and run['status']=='completed' and run['conclusion']=='success'
assert jobs['total_count']==len(jobs['jobs'])==1 and all(j['status']=='completed' and j['conclusion']=='success' for j in jobs['jobs'])
steps={s['name']:s for j in jobs['jobs'] for s in j['steps']}
for name in ['Run server test suite','Build Docker image','Build Supported Baseline Docker Image (v3.5.30 / 48d0e52)',
    'Run Real Disposable Docker Boundary Rehearsal','Run Real Docker Deployment Readiness Acceptance']:
    assert steps[name]['status']=='completed' and steps[name]['conclusion']=='success'
graph=subprocess.check_output(['gh','pr','view','299','--json','headRefOid,baseRefOid,closingIssuesReferences,url'],cwd=W)
g=json.loads(graph);assert g['headRefOid']==head and g['baseRefOid']==base and g['closingIssuesReferences']==[]
history=subprocess.check_output(['gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/299/comments?per_page=100'],cwd=W)
pages=json.loads(history);assert len(pages)<=32 and all(len(page)<=100 for page in pages)
assert not any(head in c['body'] and ('ready for audit' in c['body'].lower() or 'audit passed' in c['body'].lower()) for page in pages for c in page)
assert 'ready-for-audit' not in {row['name'] for row in pr['labels']}
description=f'''References #208.

Sample, container and aliquot labels use the exact issued identity in both QR and Code128. One scoped server command commits an immutable `LabelPrintEvent` before the browser print dialog opens; reprints require a reason. Print-time permission/state checks and SQL guards protect identity, counts, ordering, scope and historical evidence, with localized errors in all five locales.

The supported predecessor can lack the four approved #180 schema objects. A guarded schema owner now installs the unchanged approved DDL before #206 containers and #208 labels only when all four objects are absent. Canonical or exact Prisma storage is a no-op; partial/modified storage refuses. It adds no sequence rows, backfill, code allocation, renumbering or receipt writes. The scanner adds only the digest-bound owner entry, with no writer exemption.

The readiness preservation comparator permits only the exact appended nullable TEXT/no-default `Sample.labSampleCode`, NULL for existing rows. Every old column/value, row and receipt remains protected. Other schema additions, changed types/defaults/constraints, old-value changes and non-NULL backfills refuse; the unchanged old SQL is compared verbatim after removing only that one canonical column declaration.

Label sizes are preserved, with larger stock required when Code128 modules would fall below0.19mm. Documentation records the ISO7064 MOD37,36 hybrid system's adjacent-transposition limitation. Physical printer/scanner acceptance remains pending. A retained print event can reach the existing generic500 deletion response when a RESTRICT foreign key prevents preanalytic deletion; deletion authority is unchanged.

Validation of exact head `{head}` / tree `{tree}` / base `{base}`:

- [Ordinary CI38953786365, attempt1](https://github.com/yigini/soilfer-lims/actions/runs/38953786365): **376 suites /5,761 tests passed**,1838.22s. Client/theme, BOTH real candidate/supported-baseline Docker builds, all five boundary scenarios and full real deployment-readiness acceptance passed.
- Frozen ordinary LOCAL full:376 suites /5,761 tests passed,13327.782s. The final comparator correction passed4 focused suites /190 tests. Client build and lint passed with0errors/14existing warnings.
- Parent independently verified every test reporter line between original ZIP and full CI log, exact376-suite frozen discovery, all22archive entries and20closed evidence files. [Closed originals and independent review](https://github.com/yigini/soilfer-lims/blob/59cd49393e5fce07b5a2bfe0c51610e26702c07a/WP/backlog-resume-20261013/issue208-ci38953786365-parent-once/publication-index.json).

Windows LOCAL tests used a retained visible Temp fixture with both ordinary setup files, stock assertions and repository CI/Jest rules unchanged. Frozen mapped inputs/runtime files and the read-only scanner index were checked before/after. The sole generated help manifest was retained and restored only after full closure. The final two-file correction matches tested working bytes exactly for the contract and solely CRLF-to-LF for the readiness script. Approved #180 owner/loader/DDL pins are unchanged.

Original CI38898578537 and38915551182 remain immutable FAILED runs, never retried. The latter's original row/receipt payloads were not emitted, so their sole mismatch and equality remain unknown; this new exact-tree real readiness result does not retrospectively change either failure.

Exact-head audit and actual post-deploy acceptance remain pending. All main merges remain held until the actual be837974 release deployment and Claudio postcheck PASS. This PR has no automatic closing references; #208 stays open for actual acceptance.
'''
body=f'''@claude ready for audit at {head}

Please perform the final exact-head audit of #208 labels/check-character/QR+Code128 and append-only print evidence, including the unchanged approved #180 schema owner and the final two-file preservation-comparator correction.

Head `{head}`; tree `{tree}`; base `{base}`. [Ordinary CI38953786365 attempt1](https://github.com/yigini/soilfer-lims/actions/runs/38953786365) actually completed SUCCESS19:57:07Z: **376 suites /5761 tests PASS**,1838.22s. Both real candidate/supported-baseline Docker builds, ALL5boundary scenarios and full deployment-readiness acceptance passed. Actual checkout ca0de122750de6bdc9ef8f878818959f6631330a has the exact tested tree and parents base/head.

Parent independently matched ALL5761test reporter lines between original ZIP and full GH log, reconciled376uniquePASS paths with frozen discovery, excluded129console checkmarks by explicit console/stack context, and verified ALL20closed evidence files/ALL22archive-entry hashes. [Originals and independent parent verification](https://github.com/yigini/soilfer-lims/blob/59cd49393e5fce07b5a2bfe0c51610e26702c07a/WP/backlog-resume-20261013/issue208-ci38953786365-parent-once/publication-index.json).

The final comparator allows ONLY the exact nullable TEXT/no-default appended Sample.labSampleCode with NULL existing rows, while preserving every old row/column/value/receipt and all remaining schema SQL verbatim. #180 owner/loader/DDL are unchanged. Original failed38898578537 and38915551182 remain immutable; original unprinted row/receipt payload equality stays UNKNOWN/no retrospective PASS. The PR description now names the current head and final results.

Known limitation: existing preanalytic deletion can return generic500 for RESTRICT evidence references; physical printer/scanner acceptance remains pending. The MOD37,36 adjacent-transposition limitation is documented. No automatic closing references. All main merges HOLD actual be837974 production deployment+actualCl postcheck PASS regardless of source audit; no deployment authority is requested here.
'''
D.mkdir()
for i,raw in enumerate(raws):save(D,'api-before-'+str(i)+'.json',raw)
save(D,'pr-closing-references-before.json',graph);save(D,'comments-before.json',history)
save(D,'pr-body-before.md',pr['body'].encode());save(D,'pr-body-request.json',canonical({'body':description}))
save(D,'audit-request-body.md',body.encode());save(D,'comment-request.json',canonical({'body':body}))
save(D,'label-request.json',canonical({'labels':['ready-for-audit']}))
save(D,'send-intent.json',canonical({'head':head,'run':38953786365,'attempt':1,'neverRetry':True,
    'mainMergeHold':True,'readyDraftTransitionOnce':True,'bodyUpdateOnce':True})+b'\n')
# Recheck the original body immediately before replacing its stale head/results.
fresh=json.loads(api('repos/yigini/soilfer-lims/pulls/299'))
assert fresh['head']['sha']==head and fresh['body']==pr['body'] and fresh['draft']
response=subprocess.check_output(['gh','api','--method','PATCH','repos/yigini/soilfer-lims/pulls/299',
    '--input',str(D/'pr-body-request.json')],cwd=W);save(D,'body-update-response-original.json',response)
assert json.loads(response)['body']==description
ready=subprocess.check_output(['gh','pr','ready','299'],cwd=W,stderr=subprocess.STDOUT);save(D,'ready-response-original.txt',ready)
fresh=api('repos/yigini/soilfer-lims/pulls/299');save(D,'pr-ready-fresh-original.json',fresh)
assert json.loads(fresh)['draft'] is False and json.loads(fresh)['body']==description and json.loads(fresh)['head']['sha']==head
label=subprocess.check_output(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/299/labels',
    '--input',str(D/'label-request.json')],cwd=W);save(D,'label-response-original.json',label)
assert 'ready-for-audit' in {r['name'] for r in json.loads(label)}
response=subprocess.check_output(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/299/comments',
    '--input',str(D/'comment-request.json')],cwd=W);save(D,'comment-response-original.json',response)
created=json.loads(response);assert created['body']==body and created['created_at']==created['updated_at']
fresh=api('repos/yigini/soilfer-lims/issues/comments/'+str(created['id']));save(D,'comment-fresh-original.json',fresh)
assert json.loads(fresh)['id']==created['id'] and json.loads(fresh)['body']==body
save(D,'send-result.json',canonical({'commentId':created['id'],'url':created['html_url'],'createdAt':created['created_at'],
    'bodySha256':sha(body.encode()),'prDescriptionSha256':sha(description.encode()),
    'actualResponseAndFreshReadbackEqual':True,'readyLabelAppliedOnce':True,'draftToReadyOnce':True,
    'head':head,'tree':tree,'mainMergeHold':True,'mergePerformed':False,'nativeFallbackSent':False})+b'\n')
lead=f'''ACTUAL ONE #208 READY / EXACT-HEAD AUDIT REQUEST - {created['created_at']}.
PR299 description updated ONCE to current153f10e6bac02b1a962213431141fd1c54906e99/tree34f6d9be9c00b2fd923989e4d4291a06ec333e32 and final376/5761results; draft transitioned ready ONCE, ready-for-audit label ONCE, actual@claude request{created['id']} postedONCE: {created['html_url']} . Requestbody=actualresponse=freshuneditedreadback/bodySHA{sha(body.encode())}. OrdinaryCI38953786365attempt1COMPLETE/SUCCESS/ALLrealDocker independently verified;59raw parent closed originals published59cd49393. Old38898578537+38915551182 immutableFAILED/oldactualrowreceiptpayload equality UNKNOWN/no retrospectivePASS. Actual final exact-head audit nowPENDING/no duplicate request/native fallback/merge. ALLmainmerges HOLD actualbeDEPLOYED+actualClpostcheck.207SAME38956418902attempt1 observedonly. Kit242LOCALPASS999a1d11/wholefilesystemclosure+freshcapturelauncher stillunfinished/copy-site-closure.json ABSENT/noSourceReview/package/host/root/unit/gate/deployment.621299+621326govern/ACK621326ONLYnextCOMPLETEkitSourceReview/ALLnativefallbacksCANCELLEDforever. SameheartbeatACTIVE2min/restore10ONLYactualmilestone. Earlierhistoryunchanged.

'''
print(json.dumps(boundary_publish(D,{pathlib.Path(__file__).resolve()},'docs(audit): request exact labels head review after green CI',lead)))
