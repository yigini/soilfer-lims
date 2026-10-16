"""Retain fresh exact app verdicts; update only their new PR status/deferrals."""
from concurrent.futures import ThreadPoolExecutor
from prechecks6210209468_evidence import *
D=W/'WP/backlog-resume-20261013/actual207208-source-passes6224662770-6224793665-once'
assert not D.exists() and not git('diff','--cached','--name-only').strip()
assert git('rev-parse','HEAD').decode().strip()=='419ff38112ad0966a536ad4b7f28b306803088a6'
base='be8379745bdfae52ce46496ff26514dc7d729640'
specs={
 '207':{'pr':300,'id':6224662770,'head':'f83f3cddfee97f9115737ae85a07650c83cef885',
    'tree':'2555f0b98b14c92cc0f895b6cd44a6ef0423a8ef','run':38956418902,'stamp':'2026-10-16T21:04:14Z',
    'oldBodySha256':'0c2c6e929714e1779e773c1b90bbe221a3a8b5f0ed57660a6a4f547dc0a556e2'},
 '208':{'pr':299,'id':6224793665,'head':'153f10e6bac02b1a962213431141fd1c54906e99',
    'tree':'34f6d9be9c00b2fd923989e4d4291a06ec333e32','run':38953786365,'stamp':'2026-10-16T21:12:59Z',
    'oldBodySha256':'b7a3a96f67d3ff601c228831801b22be21a6f0e6bad8c5b8377d2cd7af1651d3'}}
endpoints={'main':'repos/yigini/soilfer-lims/git/ref/heads/main',
 'main-ci':'repos/yigini/soilfer-lims/actions/runs/38772398721',
 'release-comments':'repos/yigini/soilfer-lims/issues/162/comments?since=2026-10-16T21%3A00%3A00Z&per_page=100'}
for label,spec in specs.items():
    endpoints.update({label+'-verdict':'repos/yigini/soilfer-lims/issues/comments/'+str(spec['id']),
        label+'-pr':'repos/yigini/soilfer-lims/pulls/'+str(spec['pr']),
        label+'-ci':'repos/yigini/soilfer-lims/actions/runs/'+str(spec['run']),
        label+'-commit':'repos/yigini/soilfer-lims/git/commits/'+spec['head'],
        label+'-comments':'repos/yigini/soilfer-lims/issues/'+str(spec['pr'])+'/comments?since=2026-10-16T20%3A00%3A00Z&per_page=100'})
def fetch(item):return item[0],subprocess.check_output(['gh','api',item[1]],cwd=W)
with ThreadPoolExecutor(max_workers=4) as pool:raws=dict(pool.map(fetch,endpoints.items()))
current={name:json.loads(raw) for name,raw in raws.items()}
assert current['main']['object']['sha']==current['main-ci']['head_sha']==base
assert current['main-ci']['status']=='completed' and current['main-ci']['conclusion']=='success'
assert len(current['release-comments'])<100 and not [row for row in current['release-comments']
    if (row.get('performed_via_github_app') or {}).get('id')==1236702]
graphs={};new_bodies={}
for label,spec in specs.items():
    verdict=current[label+'-verdict'];pr=current[label+'-pr'];run=current[label+'-ci'];commit=current[label+'-commit']
    assert verdict['id']==spec['id'] and verdict['created_at']==verdict['updated_at']==spec['stamp']
    assert verdict['performed_via_github_app']['id']==1236702 and verdict['performed_via_github_app']['slug']=='claude'
    assert verdict['issue_url']=='https://api.github.com/repos/yigini/soilfer-lims/issues/'+str(spec['pr'])
    assert verdict['html_url']=='https://github.com/yigini/soilfer-lims/pull/'+str(spec['pr'])+'#issuecomment-'+str(spec['id'])
    assert verdict['body'].splitlines()[0]=='Audit passed: OK to merge and deploy'
    assert all(token in verdict['body'] for token in [spec['head'],spec['tree'],base,'merging still waits'])
    comments=current[label+'-comments'];assert len(comments)<100
    actual=[row for row in comments if (row.get('performed_via_github_app') or {}).get('id')==1236702]
    assert [row['id'] for row in actual]==[spec['id']]
    assert all(actual[0][key]==verdict[key] for key in ('id','body','created_at','updated_at','issue_url','html_url'))
    assert pr['state']=='open' and not pr['draft'] and pr['merged_at'] is None
    assert pr['head']['sha']==run['head_sha']==commit['sha']==spec['head'] and commit['tree']['sha']==spec['tree']
    assert pr['base']['sha']==base and run['status']=='completed' and run['conclusion']=='success' and run['run_attempt']==1
    assert sha(pr['body'].encode())==spec['oldBodySha256']
    graph=subprocess.check_output(['gh','pr','view',str(spec['pr']),'--json','headRefOid,baseRefOid,closingIssuesReferences,url'],cwd=W)
    g=json.loads(graph);assert g['headRefOid']==spec['head'] and g['baseRefOid']==base and g['closingIssuesReferences']==[]
    graphs[label]=graph
    previous='Exact-head audit and actual post-deploy acceptance remain pending.'
    assert pr['body'].count(previous)==1
    replacement='[Exact-head source audit passed]('+verdict['html_url']+') at `'+spec['head']+'`. Actual post-deploy acceptance remains pending.'
    new_bodies[label]=pr['body'].replace(previous,replacement)
deferred='''

### Deferred following the exact-head source audit

- Queue a small forward follow-up after the current release: `removePreAnalyticSample` must return a stable409 retained-evidence code when print events or containers exist. The current RESTRICT protection rolls the transaction back and can return generic500; no evidence is deleted. This follow-up is deferred and no additional code change is included here.
- Batch preview can fail the whole batch with409 `LABEL_PRINT_CODE_REQUIRED` without identifying the uncoded row. Naming that row or preselecting coded rows is deferred.
- Samples without issued codes no longer have pre-arrival labels. This visible reception change must be shown to YY before a future #208 deployment gate.
- Print buttons in `SamplesTable.jsx` and `SampleSummary.jsx` do not yet hide or disable based on `PRINT_LABELS`. The server enforces the permission and returns a localized refusal; UI polish is deferred.
- A future #208 release kit must retain authorized-production-copy DRY results and classifications for both `install_sample_code_schema` and `install_label_print_events`, and budget every extra read-only temporary DB snapshot on each default startup. Physical printer/scanner acceptance remains pending. The current be837974 release kit remains #206/#214/#209 only.
'''
new_bodies['208']+=deferred
assert 'Deferred following the exact-head source audit' not in current['208-pr']['body']
D.mkdir()
for name,raw in raws.items():save(D,'api-'+name+'-original.json',raw)
for label,raw in graphs.items():save(D,label+'-closing-references-before.json',raw)
results={}
for label,spec in specs.items():
    original=current[label+'-pr']['body'];body=new_bodies[label]
    save(D,label+'-description-before.txt',original.encode());save(D,label+'-description-request.txt',body.encode())
    save(D,label+'-body-update-intent.json',canonical({'pr':spec['pr'],'head':spec['head'],
        'sourceAuditId':spec['id'],'bodySha256':sha(body.encode()),'neverRetry':True,'noCommentLabelReadyMerge':True})+b'\n')
    response=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/pulls/'+str(spec['pr']),
        '--method','PATCH','--input','-'],cwd=W,input=canonical({'body':body}))
    save(D,label+'-body-update-response-original.json',response)
    fresh=subprocess.check_output(['gh','api','repos/yigini/soilfer-lims/pulls/'+str(spec['pr'])],cwd=W)
    save(D,label+'-body-update-readback-original.json',fresh);readback=json.loads(fresh)
    assert json.loads(response)['body']==readback['body']==body
    assert readback['head']['sha']==spec['head'] and readback['base']['sha']==base and readback['state']=='open' and readback['merged_at'] is None
    assert {row['name'] for row in readback['labels']}=={row['name'] for row in current[label+'-pr']['labels']}
    graph=subprocess.check_output(['gh','pr','view',str(spec['pr']),'--json','headRefOid,baseRefOid,closingIssuesReferences,url'],cwd=W)
    save(D,label+'-closing-references-after.json',graph);assert json.loads(graph)['closingIssuesReferences']==[]
    results[label]={'sourceAuditId':spec['id'],'createdAt':spec['stamp'],'head':spec['head'],'tree':spec['tree'],
        'verdictBodySha256':sha(current[label+'-verdict']['body'].encode()),'updatedDescriptionSha256':sha(body.encode()),
        'uneditedActualAppVerdict':True,'mergeHoldRemains':True,'descriptionUpdatedOnceForNewVerdict':True}
save(D,'independent-verdict-and-deferral-review.json',canonical({'results':results,'observedUtc':utc(),
    'main':base,'mainMergeHold':True,'nativeFallbacksCancelled':True,'commentsLabelsReadyMergesCreated':0,
    'issue208Small409FollowupQueuedInDescription':True,'productionCalls':0,
    'claudio207LocalFullSuiteExceptionPreservedNotRelabelledPass':True})+b'\n')
print(json.dumps({'directory':str(D),'results':results,'mainMergeHold':True}))
