"""One parent-authorized ready label and exact-head audit request after GREEN."""
from prechecks6210209468_boundary_publication import *
D=W/'WP/backlog-resume-20261013/issue207-exact-ad9d-audit-request-once'
E=W/'WP/backlog-resume-20261013/issue207-corrected-ci38911857904-parent-once'
assert not D.exists() and not git('diff','--cached','--name-only').strip()
assert git('rev-parse','HEAD').decode().strip()=='aa53eaaf71014e6da123912924b2564cd07c245a'
verified=json.loads((E/'parent-independent-verification.json').read_bytes())
assert verified['all5710ReporterLinesIndependentlyEqual'] and verified['exact374LocalSuiteInventoryEqual']
assert verified['allRealDockerStepsSuccess'] and verified['status']=='completed' and verified['conclusion']=='success'
head='ad9d2660041c4db380d73a759871987d625f7404';tree='0470e4a5549e4048ae35f39f8b8a2e22d9cd5bfa';base='be8379745bdfae52ce46496ff26514dc7d729640'
def api(endpoint):return subprocess.check_output(['gh','api',endpoint],cwd=W)
endpoints=['repos/yigini/soilfer-lims/pulls/300','repos/yigini/soilfer-lims/actions/runs/38911857904',
    'repos/yigini/soilfer-lims/actions/runs/38911857904/jobs','repos/yigini/soilfer-lims/git/commits/'+head,
    'repos/yigini/soilfer-lims/git/ref/heads/main','repos/yigini/soilfer-lims/actions/runs/38772398721']
raws=[api(endpoint) for endpoint in endpoints];pr,run,jobs,commit,main,mainci=map(json.loads,raws)
assert pr['state']=='open' and not pr['draft'] and pr['head']['sha']==run['head_sha']==commit['sha']==head
assert commit['tree']['sha']==tree and pr['base']['sha']==main['object']['sha']==mainci['head_sha']==base
assert mainci['run_attempt']==1 and mainci['status']=='completed' and mainci['conclusion']=='success'
assert run['run_attempt']==1 and run['event']=='pull_request' and run['status']=='completed' and run['conclusion']=='success'
assert all(job['status']=='completed' and job['conclusion']=='success' for job in jobs['jobs'])
steps={step['name']:step for job in jobs['jobs'] for step in job['steps']}
for name in ['Run server test suite','Build Docker image','Build Supported Baseline Docker Image (v3.5.30 / 48d0e52)',
    'Run Real Disposable Docker Boundary Rehearsal','Run Real Docker Deployment Readiness Acceptance']:
    assert steps[name]['status']=='completed' and steps[name]['conclusion']=='success'
graph=subprocess.check_output(['gh','pr','view','300','--json','headRefOid,baseRefOid,closingIssuesReferences,url'],cwd=W)
g=json.loads(graph);assert g['headRefOid']==head and g['baseRefOid']==base and g['closingIssuesReferences']==[]
history=subprocess.check_output(['gh','api','--paginate','--slurp','repos/yigini/soilfer-lims/issues/300/comments?per_page=100'],cwd=W)
pages=json.loads(history);assert all(len(page)<=100 for page in pages) and len(pages)<=32
comments=[c for page in pages for c in page]
assert not any(head in c['body'] and ('ready for audit' in c['body'].lower() or 'audit passed' in c['body'].lower()) for c in comments)
assert 'ready-for-audit' not in {row['name'] for row in pr['labels']}
body=f"""@claude ready for audit at {head}

Please perform the final exact-head audit of the source-only #207 custody/storage/retention implementation and its reviewed two-file preservation correction.

Head: `{head}`; tree: `{tree}`; base: `{base}`. [Ordinary CI38911857904, attempt1](https://github.com/yigini/soilfer-lims/actions/runs/38911857904) completed SUCCESS at2026-10-16T14:38:08Z. Exact server result: **374 suites / 5710 tests passed**; client/theme checks, BOTH actual candidate and supported-baseline Docker builds, all five real boundary scenarios and full real readiness acceptance passed. The predecessor/custody receipt, original-column preservation, empty new ledger and byte-preserving NO_OP checks passed.

Parent independently matched all5710 test reporter lines and all374 suite paths to the original full CI log and frozen suite inventory. [Closed originals, ZIP entry hashes and parent verification](https://github.com/yigini/soilfer-lims/blob/aa53eaaf71014e6da123912924b2564cd07c245a/WP/backlog-resume-20261013/issue207-corrected-ci38911857904-parent-once/publication-index.json). The original failed run38898969962 attempt1 remains retained and was never retried.

No automatic closing references are attached. All main merges remain held until the actual be837974 release deployment and Claudio post-deploy PASS. This audit request leaves that hold in place.
"""
D.mkdir()
for i,raw in enumerate(raws):save(D,'api-before-'+str(i)+'.json',raw)
save(D,'pr-closing-references-before.json',graph);save(D,'comments-before.json',history)
save(D,'audit-request-body.md',body.encode());save(D,'comment-request.json',canonical({'body':body}))
save(D,'label-request.json',canonical({'labels':['ready-for-audit']}))
# Durable once intent; an unknown remote outcome is inspected, never resent.
save(D,'send-intent.json',canonical({'head':head,'run':38911857904,'attempt':1,'neverRetry':True,'mainMergeHold':True})+b'\n')
label=subprocess.check_output(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/300/labels',
    '--input',str(D/'label-request.json')],cwd=W);save(D,'label-response-original.json',label)
assert 'ready-for-audit' in {row['name'] for row in json.loads(label)}
response=subprocess.check_output(['gh','api','--method','POST','repos/yigini/soilfer-lims/issues/300/comments',
    '--input',str(D/'comment-request.json')],cwd=W);save(D,'comment-response-original.json',response)
created=json.loads(response);assert created['body']==body and created['created_at']==created['updated_at']
fresh=api('repos/yigini/soilfer-lims/issues/comments/'+str(created['id']));save(D,'comment-fresh-original.json',fresh)
assert json.loads(fresh)['body']==body and json.loads(fresh)['id']==created['id']
save(D,'send-result.json',canonical({'commentId':created['id'],'url':created['html_url'],'createdAt':created['created_at'],
    'bodySha256':sha(body.encode()),'actualResponseAndFreshReadbackEqual':True,'readyLabelAppliedOnce':True,
    'head':head,'tree':tree,'mainMergeHold':True,'mergePerformed':False,'nativeFallbackSent':False})+b'\n')
lead=f"""ACTUAL ONE #207 READY / EXACT-HEAD AUDIT REQUEST - {created['created_at']}.
PR300 ready-for-audit label appliedONCE and actual@claude exacthead{head}/tree{tree} request{created['id']} postedONCE: {created['html_url']} . Requestbody=actualresponse=freshuneditedreadback; bodySHA{sha(body.encode())}. Fresh ordinaryCI38911857904attempt1COMPLETE/SUCCESS with exact374suites5710tests and ALLrealDocker independently verified;22raw-OID closedCI originals/ZIPentryhashes/parentreview publishedaa53eaaf71014e6da123912924b2564cd07c245a. Originalfailed38898969962attempt1 immutable/neverretry. ActualCl finalexacthead audit verdict NOWPENDING; do not duplicate label/request/nativefallback. ALLmainmerges STILLHOLD actualbeDEPLOYED+actualClpostcheckPASS, regardless of sourceaudit. Existing208same38915551182attempt1 observedonly/no readybeforeactualcompletegreen. Releasekit199LOCALPASS/a0561cb9a source hasApachecapturecomponent+prewritecopyguard; completewholecopy-filesystemclosure/freshhost-sciencecapturelauncher STILLMISSING/no sourceReview/root/package/gate/deployment.621326ACKONLYnextCOMPLETEkitSourceReview/ALLnativefallbacksCANCELLED. SameheartbeatACTIVE2min/restore10ONLYactualdeployment+Clpostcheck. Earlier history follows verbatim.

"""
print(json.dumps(boundary_publish(D,{pathlib.Path(__file__).resolve()},'docs(audit): request exact custody head review after corrected green CI',lead)))
